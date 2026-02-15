/* @refresh skip */
/**
 * SQLite WASM Database Client (Offline Storage)
 *
 * This module provides a Drizzle ORM client for interacting with SQLite WASM.
 * Used for local offline storage in the browser with IndexedDB persistence.
 *
 * @module client-sqlite
 */

import { drizzle } from "drizzle-orm/sql-js";
import type { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";
import initSqlJs from "sql.js";
// Use Vite asset URL for wasm to avoid path resolution issues under dev/HMR
// The ?url import ensures stable resolution regardless of build strategy.
// Falls back to locateFile default for ancillary files if any.
// eslint-disable-next-line import/no-unresolved
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import * as schema from "../../../drizzle/schema-sqlite";
import { initializeViewColumnMeta } from "./init-view-column-meta";
import { initializeViews, recreateViews } from "./init-views";
import {
  createSyncPushQueueTable,
  installSyncTriggers,
} from "./install-triggers";
import {
  clearLocalDatabaseForMigration,
  clearMigrationParams,
  getCurrentSchemaVersion,
  getLocalSchemaVersion,
  isForcedReset,
  needsMigration,
  setLocalSchemaVersion,
} from "./migration-version";
import { createOutboxBackup, type IOutboxBackup } from "./outbox-backup";

/**
 * SQLite WASM instance
 * Initialized on first access via `initializeDb()`
 */
let sqliteDb: SqlJsDatabase | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;
let dbReady = false;
let isClearing = false; // set while clearDb executes
let isInitializingDb = false; // guard flag for abort logic

// Promise for an in-progress clearDb(). Used to gate initialization and avoid
// using a DB while it is being torn down.
let clearDbPromise: Promise<void> | null = null;

// Monotonic cancellation token for async initialization.
// Each `clearDb()` increments this value, invalidating any in-flight `initializeDb()`.
let initEpoch = 0;

// Singleton sql.js initialization management
let sqlJsInitPromise: Promise<SqlJsStatic> | null = null;
let sqlJsModule: SqlJsStatic | null = null;
let sqlJsInitAttempts = 0;
const SQL_JS_MAX_RETRIES = 3; // allow one extra recovery attempt
let cachedWasmBinary: ArrayBuffer | null = null;
// Guard for overall database initialization (prevents overlapping initializeDb calls)
let initializeDbPromise: Promise<ReturnType<typeof drizzle>> | null = null;

// E2E diagnostic: track persist/export activity to debug OOM
let e2ePersistCount = 0;
let e2eCumulativeExportBytes = 0;

// Optional diagnostics (off by default).
// Enable via `VITE_SYNC_DIAGNOSTICS=true`.
const SYNC_DIAGNOSTICS = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";

function diagLog(...args: unknown[]): void {
  if (SYNC_DIAGNOSTICS) console.log(...args);
}

function isE2eClearInProgress(): boolean {
  return (
    typeof window !== "undefined" && (window as any).__ttE2eIsClearing === true
  );
}

function isDbInitAbortedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Database initialization aborted") ||
    msg.includes("clearDb() was called during initialization")
  );
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsModule) return Promise.resolve(sqlJsModule);
  if (sqlJsInitPromise) return sqlJsInitPromise;

  sqlJsInitAttempts += 1;
  diagLog("⚙️ initSqlJs attempt", sqlJsInitAttempts);
  // Manually fetch wasm binary to avoid race with locateFile callback disposal under HMR
  if (!cachedWasmBinary) {
    try {
      const resp = await fetch(sqlWasmUrl, { cache: "no-store" });
      if (!resp.ok)
        throw new Error(`Failed to fetch sql.js wasm binary ${resp.status}`);
      cachedWasmBinary = await resp.arrayBuffer();
      diagLog(
        `📦 sql.js wasm binary fetched (${cachedWasmBinary.byteLength} bytes)`
      );
    } catch (e) {
      console.warn(
        "⚠️ Failed to prefetch wasm binary, falling back to locateFile",
        e
      );
    }
  }

  sqlJsInitPromise = initSqlJs({
    locateFile: (file: string) => {
      if (file === "sql-wasm.wasm") return sqlWasmUrl;
      return `/sql-wasm/${file}`;
    },
    wasmBinary: cachedWasmBinary || undefined,
  })
    .then((mod) => {
      sqlJsModule = mod;
      return mod;
    })
    .catch((err: any) => {
      console.error("sql.js init failed", err);
      sqlJsInitPromise = null;
      if (
        sqlJsInitAttempts < SQL_JS_MAX_RETRIES &&
        /callback is no longer runnable/i.test(String(err))
      ) {
        console.warn("🔁 Retrying sql.js init after callback error...");
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            getSqlJs().then(resolve).catch(reject);
          }, 50);
        });
      }
      throw err;
    });
  return sqlJsInitPromise;
}

/**
 * IndexedDB database configuration
 */
const INDEXEDDB_NAME = "tunetrees-storage";
const INDEXEDDB_STORE = "databases";
const INDEXEDDB_OPERATION_TIMEOUT_MS = 5000;
// Base keys - will be namespaced by user ID
const DB_KEY_PREFIX = "tunetrees-db";
const DB_VERSION_KEY_PREFIX = "tunetrees-db-version";
const OUTBOX_BACKUP_KEY_PREFIX = "tunetrees-outbox-backup";
// Current serialized database schema version. Increment to force recreation after schema-affecting changes.
const CURRENT_DB_VERSION = 12; // v12: rename repertoire schema objects to repertoire

// Sync watermark key prefix used by SyncEngine (duplicated here to avoid import cycles)
const LAST_SYNC_TIMESTAMP_KEY_PREFIX = "TT_LAST_SYNC_TIMESTAMP";

function clearLastSyncTimestampForUser(userId: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(`${LAST_SYNC_TIMESTAMP_KEY_PREFIX}_${userId}`);
  } catch (e) {
    console.warn("⚠️ Failed to clear last sync timestamp:", e);
  }
}

// Track which user's database is currently loaded
let currentUserId: string | null = null;

/**
 * Get the IndexedDB key for a user's database
 */
function getDbKey(userId: string): string {
  return `${DB_KEY_PREFIX}-${userId}`;
}

/**
 * Get the IndexedDB key for a user's database version
 */
function getDbVersionKey(userId: string): string {
  return `${DB_VERSION_KEY_PREFIX}-${userId}`;
}

function getOutboxBackupKey(userId: string): string {
  return `${OUTBOX_BACKUP_KEY_PREFIX}-${userId}`;
}

function encodeJsonToBytes(value: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(value));
}

function decodeJsonFromBytes(data: Uint8Array): unknown {
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(data));
}

export async function saveOutboxBackupForUser(
  userId: string,
  backup: IOutboxBackup
): Promise<void> {
  await saveToIndexedDB(getOutboxBackupKey(userId), encodeJsonToBytes(backup));
}

export async function loadOutboxBackupForUser(
  userId: string
): Promise<IOutboxBackup | null> {
  const bytes = await loadFromIndexedDB(getOutboxBackupKey(userId));
  if (!bytes) return null;

  const parsed = decodeJsonFromBytes(bytes);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1
  ) {
    return null;
  }

  return parsed as IOutboxBackup;
}

export async function clearOutboxBackupForUser(userId: string): Promise<void> {
  await deleteFromIndexedDB(getOutboxBackupKey(userId));
}

async function backupPendingOutboxBestEffort(
  userId: string,
  db: SqlJsDatabase
): Promise<void> {
  try {
    // Avoid replaying stale backups if there's nothing to preserve this time.
    await clearOutboxBackupForUser(userId);
    const backup = createOutboxBackup(db);
    if (backup.items.length === 0) return;
    await saveOutboxBackupForUser(userId, backup);
    diagLog(
      `💾 Backed up ${backup.items.length} outbox item(s) for migration/recreate replay`
    );
  } catch (e) {
    console.warn("⚠️ Failed to back up outbox before migration/recreate:", e);
  }
}

let initializeDbCalls = 0;

/**
 * Initialize SQLite database for a specific user
 *
 * Each user gets their own namespaced database in IndexedDB.
 * If switching users, the previous user's database is persisted and closed,
 * then the new user's database is loaded (or created fresh).
 *
 * @param userId - The user's ID (Supabase auth UUID or anonymous ID)
 */
export async function initializeDb(
  userId: string
): Promise<ReturnType<typeof drizzle>> {
  initializeDbCalls += 1;
  diagLog(
    `🔁 initializeDb call #${initializeDbCalls} for user: ${userId.substring(0, 8)}...`
  );

  // E2E can trigger async clears; never initialize while a clear is in-flight.
  if (isClearing && clearDbPromise) {
    diagLog("⏳ Waiting for clearDb() to finish before initializeDb...");
    await clearDbPromise;
  }

  const myInitEpoch = initEpoch;
  const ensureNotCleared = () => {
    if (initEpoch !== myInitEpoch) {
      throw new Error(
        "Database initialization aborted: clearDb() was called during initialization. " +
          `initEpoch=${initEpoch} myInitEpoch=${myInitEpoch} ` +
          `isClearing=${isClearing} isInitializingDb=${isInitializingDb} ` +
          `e2eClearing=${isE2eClearInProgress()}`
      );
    }
  };

  // If we have an existing DB for a DIFFERENT user, persist and close it
  if (drizzleDb && currentUserId && currentUserId !== userId) {
    diagLog(
      `🔄 Switching users: ${currentUserId.substring(0, 8)}... → ${userId.substring(0, 8)}...`
    );
    // Persist current user's data before switching
    try {
      await persistDb();
      diagLog(`💾 Persisted previous user's database before switching`);
    } catch (e) {
      console.warn("⚠️ Failed to persist previous user's DB:", e);
    }
    // Close current database
    if (sqliteDb) {
      sqliteDb.close();
      sqliteDb = null;
    }
    drizzleDb = null;
    dbReady = false;
    initializeDbPromise = null;
  }

  // If we already have a DB for this same user, return it
  if (drizzleDb && currentUserId === userId) {
    dbReady = true;
    return drizzleDb;
  }
  // If initialization already in progress, await same promise
  if (initializeDbPromise) {
    return initializeDbPromise;
  }

  diagLog(
    `🔧 Initializing SQLite WASM database (call #${initializeDbCalls})...`
  );
  isInitializingDb = true;

  initializeDbPromise = (async () => {
    try {
      // Load sql.js WASM module via singleton
      const SQL = await getSqlJs();
      ensureNotCleared();

      const requireSqliteDb = (): SqlJsDatabase => {
        ensureNotCleared();
        if (!sqliteDb) {
          throw new Error(
            "Database initialization aborted: sqliteDb was cleared during initialization."
          );
        }
        return sqliteDb;
      };
      // (Rest of original body moved inside try below)
      // Check if schema migration is needed (e.g., integer IDs → UUIDs)
      const migrationNeeded = needsMigration();
      const forcedReset = isForcedReset();

      if (forcedReset) {
        try {
          await clearOutboxBackupForUser(userId);
        } catch (e) {
          console.warn("⚠️ Failed to clear outbox backup for forced reset:", e);
        }
      }

      if (migrationNeeded) {
        const localVersion = getLocalSchemaVersion();
        const currentVersion = getCurrentSchemaVersion();

        if (forcedReset) {
          console.warn(
            "🔄 FORCED RESET via URL parameter - clearing all local data"
          );
        } else {
          console.warn(
            `⚠️ Schema migration detected: ${localVersion || "none"} → ${currentVersion}`
          );
          console.warn("🔄 Clearing local database for migration...");
        }
      }

      // Try to load existing database from IndexedDB (namespaced by user ID)
      const dbKey = getDbKey(userId);
      const dbVersionKey = getDbVersionKey(userId);
      const existingData = await loadFromIndexedDB(dbKey);
      const storedVersion = await loadFromIndexedDB(dbVersionKey);
      ensureNotCleared();
      const storedVersionNum =
        storedVersion && storedVersion.length > 0 ? storedVersion[0] : 0;

      if (existingData && storedVersionNum === CURRENT_DB_VERSION) {
        sqliteDb = new SQL.Database(existingData);
        diagLog(
          `✅ Loaded existing SQLite database from IndexedDB (v${CURRENT_DB_VERSION})`
        );
        drizzleDb = drizzle(sqliteDb, { schema: { ...schema } });
        diagLog("🔄 Recreating views with latest definitions...");
        await recreateViews(drizzleDb);
        diagLog("✅ Views recreated successfully");
      } else {
        if (existingData) {
          // If we're about to drop/recreate the DB due to a serialized-version mismatch,
          // preserve any pending local changes so we can replay them after the next full sync.
          try {
            const oldDb = new SQL.Database(existingData);
            await backupPendingOutboxBestEffort(userId, oldDb);
            oldDb.close();
          } catch (e) {
            console.warn("⚠️ Failed to inspect old DB for outbox backup:", e);
          }
          diagLog(
            `🔄 Database version mismatch (stored: ${storedVersionNum}, current: ${CURRENT_DB_VERSION}). Recreating...`
          );
          await deleteFromIndexedDB(dbKey);
          await deleteFromIndexedDB(dbVersionKey);
        }

        // DB is being recreated; any persisted incremental sync watermark is now invalid.
        clearLastSyncTimestampForUser(userId);

        sqliteDb = new SQL.Database();
        diagLog("📋 Applying SQLite schema migrations...");
        const migrations = [
          "/drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql",
          "/drizzle/migrations/sqlite/0001_thin_chronomancer.sql",
          "/drizzle/migrations/sqlite/0002_nappy_roland_deschain.sql",
          "/drizzle/migrations/sqlite/0003_friendly_cerebro.sql",
          // Note: 0004_true_union_jack.sql skipped - avatar_url already exists in base schema
          "/drizzle/migrations/sqlite/0005_add_display_order.sql",
          "/drizzle/migrations/sqlite/0006_add_auto_schedule_new.sql",
          "/drizzle/migrations/sqlite/0007_add_hybrid_fields.sql",
          "/drizzle/migrations/sqlite/0008_add_sync_change_log.sql",
          "/drizzle/migrations/sqlite/0009_add_view_column_meta.sql",
          "/drizzle/migrations/sqlite/0009_add_plugins.sql",
          "/drizzle/migrations/sqlite/0010_add_plugin_goals.sql",
          "/drizzle/migrations/sqlite/0011_rename_user_profile_id.sql",
          "/drizzle/migrations/sqlite/0012_rename_playlist_to_repertoire.sql",
        ];
        for (const migrationPath of migrations) {
          const response = await fetch(migrationPath, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(
              `Failed to load migration ${migrationPath}: ${response.status} ${response.statusText}`
            );
          }
          const migrationSql = await response.text();
          const statements = migrationSql
            .split("--> statement-breakpoint")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          for (const statement of statements) {
            if (statement && !statement.startsWith("--")) {
              requireSqliteDb().run(statement);
            }
          }
          diagLog(
            `✅ Applied ${statements.length} statements from ${migrationPath.split("/").pop()}`
          );
        }
        diagLog("✅ Applied all migrations");
        diagLog("✅ Created new SQLite database with schema");
        drizzleDb = drizzle(requireSqliteDb(), {
          schema: { ...schema },
        });
      }

      await initializeViews(drizzleDb);
      await initializeViewColumnMeta(drizzleDb);
      ensureNotCleared();
      try {
        ensureColumnExists("user_profile", "avatar_url", "avatar_url text");

        // Required for trigger install and server-side incremental sync.
        // Older local DBs may be missing this table because it's not part of the historical
        // sqlite migration set that seeded IndexedDB.
        requireSqliteDb().run(`
          CREATE TABLE IF NOT EXISTS sync_change_log (
            table_name TEXT PRIMARY KEY NOT NULL,
            changed_at TEXT NOT NULL
          )
        `);
        requireSqliteDb().run(
          "CREATE INDEX IF NOT EXISTS idx_sync_change_log_changed_at ON sync_change_log(changed_at)"
        );

        // user_profile.id is the canonical user key.
        // Ensure local helper tables use id-based FKs.

        // Backward-compatible adds for hybrid tune fields.
        // Some existing IndexedDB DBs were created before these columns existed,
        // but sync may deliver rows containing them (e.g., tune_override.composer).
        ensureColumnExists("tune", "composer", "composer text");
        ensureColumnExists("tune", "artist", "artist text");
        ensureColumnExists("tune", "id_foreign", "id_foreign text");
        ensureColumnExists("tune", "release_year", "release_year integer");

        ensureColumnExists("tune_override", "composer", "composer text");
        ensureColumnExists("tune_override", "artist", "artist text");
        ensureColumnExists("tune_override", "id_foreign", "id_foreign text");
        ensureColumnExists(
          "tune_override",
          "release_year",
          "release_year integer"
        );
        requireSqliteDb().run(`
          CREATE TABLE IF NOT EXISTS view_column_meta (
            view_name TEXT NOT NULL,
            column_name TEXT NOT NULL,
            description TEXT NOT NULL,
            PRIMARY KEY (view_name, column_name)
          )
        `);
        requireSqliteDb().run(
          "CREATE INDEX IF NOT EXISTS idx_view_column_meta_view ON view_column_meta(view_name)"
        );

        requireSqliteDb().run(`
          CREATE TABLE IF NOT EXISTS user_genre_selection (
            user_id TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
            genre_id TEXT NOT NULL REFERENCES genre(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_modified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_version INTEGER NOT NULL DEFAULT 1,
            device_id TEXT,
            PRIMARY KEY (user_id, genre_id)
          )
        `);
        requireSqliteDb().run(
          "CREATE INDEX IF NOT EXISTS idx_user_genre_selection_user_id ON user_genre_selection(user_id)"
        );
        requireSqliteDb().run(
          "CREATE INDEX IF NOT EXISTS idx_user_genre_selection_genre_id ON user_genre_selection(genre_id)"
        );
        ensureColumnExists(
          "user_genre_selection",
          "created_at",
          "created_at text not null default CURRENT_TIMESTAMP"
        );
        ensureColumnExists(
          "user_genre_selection",
          "last_modified_at",
          "last_modified_at text not null default CURRENT_TIMESTAMP"
        );
        ensureColumnExists(
          "user_genre_selection",
          "sync_version",
          "sync_version integer not null default 1"
        );
        ensureColumnExists(
          "user_genre_selection",
          "device_id",
          "device_id text"
        );
      } catch (err) {
        console.warn("⚠️ Column ensure check failed:", err);
      }

      // Install sync push queue and triggers for automatic change tracking
      // The sync_push_queue table and triggers are used for the trigger-based sync architecture
      try {
        const db = requireSqliteDb();
        createSyncPushQueueTable(db);
        installSyncTriggers(db);
      } catch (error) {
        console.error("❌ Failed to install sync triggers:", error);
      }

      diagLog(
        `✅ SQLite WASM database ready for user: ${userId.substring(0, 8)}...`
      );

      // Only publish global state if this init hasn't been invalidated.
      ensureNotCleared();
      currentUserId = userId;
      dbReady = true;

      if (migrationNeeded) {
        diagLog("🔄 Executing schema migration...");
        try {
          // Local data will be cleared; force next syncDown to run as a full sync.
          clearLastSyncTimestampForUser(userId);

          // Preserve any pending local changes before we clear user tables.
          // Forced resets are explicitly user-initiated wipes; don't preserve.
          if (!forcedReset && sqliteDb) {
            await backupPendingOutboxBestEffort(userId, sqliteDb);
          }
          await clearLocalDatabaseForMigration(drizzleDb);

          // Important: schema migrations invalidate any existing local outbox.
          // If we don't clear it, the app may attempt to upload thousands of stale changes
          // before allowing syncDown, which can fail due to request size or server rejection.
          try {
            sqliteDb?.run("DELETE FROM sync_push_queue");
            sqliteDb?.run(
              "UPDATE sync_trigger_control SET disabled = 0 WHERE id = 1"
            );
            diagLog("✅ Cleared sync outbox after migration");
          } catch (e) {
            console.warn("⚠️ Failed to clear sync outbox after migration:", e);
          }

          setLocalSchemaVersion(getCurrentSchemaVersion());
          clearMigrationParams();
          if (forcedReset) {
            diagLog("✅ Forced reset complete. Local database cleared.");
          } else {
            diagLog(
              "✅ Schema migration complete. Ready for re-sync from Supabase."
            );
          }
        } catch (error) {
          console.error("❌ Migration failed:", error);
        }
      } else {
        const currentLocal = getLocalSchemaVersion();
        if (!currentLocal) {
          console.warn(
            `ℹ️ Setting initial schema_version=${getCurrentSchemaVersion()}`
          );
          setLocalSchemaVersion(getCurrentSchemaVersion());
        }
      }

      const tuneCount = requireSqliteDb().exec(
        "SELECT COUNT(*) as count FROM tune"
      );
      const count = Number(tuneCount[0]?.values[0]?.[0] || 0);
      diagLog(
        `🔍 DEBUG: Found ${count} tunes in database after initialization`
      );
      if (count > 0) {
        const sampleTunes = requireSqliteDb().exec(
          "SELECT id, title, genre FROM tune LIMIT 5"
        );
        diagLog("🔍 DEBUG: Sample tunes:", sampleTunes[0]?.values || []);
      }
      return drizzleDb;
    } catch (err) {
      // During Playwright teardown we intentionally clear IndexedDB / the in-memory
      // sql.js handle. That can abort an in-flight initializeDb(). Avoid emitting
      // noisy console errors for this expected E2E-only race.
      if (isDbInitAbortedError(err) && (isClearing || isE2eClearInProgress())) {
        console.warn("⚠️ initializeDb aborted during clear", err);
      } else {
        console.error("❌ initializeDb failed", err);
      }
      // Reset promise only on failure to allow retry; keep it for successful resolution
      initializeDbPromise = null;
      throw err;
    }
  })();

  return initializeDbPromise.finally(() => {
    isInitializingDb = false;
    // If aborted during init ensure state reflects not ready
    if (initEpoch !== myInitEpoch && drizzleDb) {
      try {
        sqliteDb?.close();
      } catch (_) {
        /* ignore */
      }
      sqliteDb = null;
      drizzleDb = null;
      dbReady = false;
      initializeDbPromise = null;
    }
  });
}

/**
 * Get current database instance
 *
 * @throws Error if database not initialized
 * @returns Drizzle ORM instance
 */
export function getDb(): ReturnType<typeof drizzle> {
  if (isClearing) {
    throw new Error(
      "SQLite database is clearing. Wait for clearDb() to finish before using the database."
    );
  }
  if (!drizzleDb) {
    throw new Error(
      "SQLite database not initialized. Call initializeDb() first."
    );
  }
  return drizzleDb;
}

/**
 * Persist current database to IndexedDB
 *
 * Should be called after any writes to ensure data is persisted.
 * Can be called periodically or on specific events (e.g., before page unload).
 *
 * @example
 * ```typescript
 * import { persistDb } from '@/lib/db/client-sqlite';
 *
 * await db.insert(tune).values({ ... });
 * await persistDb(); // Save to IndexedDB
 * ```
 */
export async function persistDb(): Promise<void> {
  if (isClearing) {
    console.warn("⏭️  Skipping persist while clearing local DB");
    return;
  }
  if (!sqliteDb) {
    throw new Error("SQLite database not initialized");
  }

  // Capture a stable reference to avoid races if the global is cleared while this async
  // function is running (e.g., Playwright teardown calling clearLocalDatabase).
  const dbToPersist = sqliteDb;

  if (!dbReady) {
    console.warn("⏭️  Skipping persist until DB initialization completes");
    return;
  }

  if (!currentUserId) {
    throw new Error("Cannot persist database: no user ID set");
  }
  const dbKey = getDbKey(currentUserId);
  const dbVersionKey = getDbVersionKey(currentUserId);
  const data = dbToPersist.export();

  const isE2E = typeof window !== "undefined" && !!(window as any).__ttTestApi;
  if (isE2E && SYNC_DIAGNOSTICS) {
    e2ePersistCount++;
    e2eCumulativeExportBytes += data.byteLength;
    diagLog(
      `🔬 [E2E Persist #${e2ePersistCount}] Export size: ${(data.byteLength / 1024).toFixed(1)}KB, cumulative: ${(e2eCumulativeExportBytes / 1024 / 1024).toFixed(2)}MB`
    );
  }

  await saveToIndexedDB(dbKey, data);
  // Save version number
  await saveToIndexedDB(dbVersionKey, new Uint8Array([CURRENT_DB_VERSION]));
  diagLog("💾 Database persisted to IndexedDB");

  // DEV VERIFICATION: load saved blob and verify critical table counts match
  try {
    // Only run verification in development builds to avoid extra overhead in prod.
    // Skip in Playwright E2E: verification duplicates the full DB in WASM memory and
    // can OOM when many tests run in parallel.
    const isE2E =
      typeof window !== "undefined" && !!(window as any).__ttTestApi;

    if (import.meta.env.MODE !== "production" && !isE2E) {
      // Reuse existing module; if not yet initialized skip verification
      if (!sqlJsModule) {
        console.warn("Persist verification skipped: sql.js module not ready");
      } else {
        const savedDb = new sqlJsModule.Database(data);

        // Count rows in table_transient_data in-memory vs saved blob
        const inMemRes = dbToPersist.exec(
          "SELECT COUNT(*) as c FROM table_transient_data;"
        );
        const savedRes = savedDb.exec(
          "SELECT COUNT(*) as c FROM table_transient_data;"
        );

        const inMemCount =
          (inMemRes[0] && (inMemRes[0].values[0][0] as number)) || 0;
        const savedCount =
          (savedRes[0] && (savedRes[0].values[0][0] as number)) || 0;

        if (inMemCount !== savedCount) {
          console.error(
            `Persist verification failed: in-memory table_transient_data=${inMemCount}, saved=${savedCount}`
          );
        } else {
          diagLog(
            `✅ Persist verification OK - table_transient_data count=${inMemCount}`
          );
        }

        // free temporary DB
        try {
          savedDb.close();
        } catch (_) {
          // ignore
        }
      }
    }
  } catch (err) {
    console.error("Error during persist verification:", err);
  }
}

// TEST HOOK: Expose persistDb on window for Playwright to force persistence between reloads
// This prevents losing in-memory changes (e.g., newly inserted practice_record rows) when
// the test triggers a full page reload before the auto-persist interval fires.
if (typeof window !== "undefined" && !(window as any).__persistDbForTest) {
  (window as any).__persistDbForTest = () => {
    try {
      return persistDb();
    } catch (e) {
      console.warn("__persistDbForTest failed", e);
    }
  };
}

/**
 * Close current database without deleting from IndexedDB
 *
 * Persists current database and closes it, but keeps it in IndexedDB
 * for later reloading. Useful for sign-out scenarios where we want to
 * preserve user data.
 */
export async function closeDb(): Promise<void> {
  if (sqliteDb && dbReady) {
    try {
      await persistDb();
      diagLog("💾 Persisted database before closing");
    } catch (e) {
      console.warn("⚠️ Failed to persist before close:", e);
    }
  }

  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  drizzleDb = null;
  currentUserId = null;
  dbReady = false;
  initializeDbPromise = null;
  diagLog("🔒 Database closed (data preserved in IndexedDB)");
}

/**
 * Clear local database
 *
 * Removes the database from memory and IndexedDB.
 * Useful for logout or data reset scenarios.
 */
export async function clearDb(): Promise<void> {
  if (clearDbPromise) return clearDbPromise;

  // Mark clearing immediately so callers can gate.
  isClearing = true;
  dbReady = false;

  // Invalidate any in-flight initializeDb() ASAP.
  initEpoch += 1;
  if (isInitializingDb) {
    console.warn("⚠️ clearDb called during initialization; aborting init.");
  }

  // Allow a subsequent initializeDb() call to start fresh.
  initializeDbPromise = null;

  const userIdToClear = currentUserId;
  currentUserId = null;

  clearDbPromise = (async () => {
    if (sqliteDb) {
      sqliteDb.close();
      diagLog(
        `🧹 [E2E ClearDb] Resetting database instance (${e2ePersistCount} persists, ${(e2eCumulativeExportBytes / 1024 / 1024).toFixed(2)}MB exported)`
      );
      // Reset per-test diagnostic counters
      e2ePersistCount = 0;
      e2eCumulativeExportBytes = 0;
      sqliteDb = null;
      drizzleDb = null;
    } else {
      drizzleDb = null;
    }

    // NOTE: DO NOT reset sqlJsModule or sqlJsInitPromise in E2E
    // Resetting causes reallocation of wasm memory, which can exhaust heap across many tests.
    // Instead, reuse the same sql.js Module instance and let each test get a fresh Database.
    // sql.js memory is allocated per-Module, not per-Database, so reusing is more efficient.

    if (userIdToClear) {
      await deleteFromIndexedDB(getDbKey(userIdToClear));
      await deleteFromIndexedDB(getDbVersionKey(userIdToClear));
      clearLastSyncTimestampForUser(userIdToClear);
    }

    diagLog("🗑️  Local database cleared");
  })().finally(() => {
    isClearing = false;
    clearDbPromise = null;
  });

  return clearDbPromise;
}

/**
 * Auto-persist setup
 *
 * Sets up automatic persistence on:
 * - Page unload
 * - Visibility change (when tab becomes hidden)
 * - Periodic interval (every 30 seconds)
 */
export function setupAutoPersist(): () => void {
  // Skip auto-persist in E2E tests - reduces memory pressure and GC burden
  const isE2E =
    typeof window !== "undefined" && !!(window as unknown as any).__ttTestApi;
  if (isE2E) {
    diagLog("⏸️  Auto-persist disabled in E2E mode");
    return () => {}; // Return empty cleanup function
  }

  const persistHandler = () => {
    if (drizzleDb) {
      persistDb().catch(console.error);
    }
  };

  // Persist on page unload
  window.addEventListener("beforeunload", persistHandler);

  // Persist when tab becomes hidden
  const visibilityHandler = () => {
    if (document.hidden) {
      persistHandler();
    }
  };
  document.addEventListener("visibilitychange", visibilityHandler);

  // Periodic persistence (every 30 seconds)
  const intervalId = setInterval(persistHandler, 30_000);

  // Return cleanup function
  return () => {
    window.removeEventListener("beforeunload", persistHandler);
    document.removeEventListener("visibilitychange", visibilityHandler);
    clearInterval(intervalId);
  };
}

// ============================================================================
// IndexedDB Helpers
// ============================================================================

/**
 * Ensure a column exists on a table; if missing, add it.
 * Safe to call repeatedly. Only supports ADD COLUMN operations that are backward compatible.
 */
function ensureColumnExists(
  table: string,
  column: string,
  definition: string
): void {
  if (!sqliteDb) return;
  try {
    const result = sqliteDb.exec(`PRAGMA table_info(${table})`);
    const values = result[0]?.values ?? [];
    const hasColumn = values.some((row) => row?.[1] === column);
    if (!hasColumn) {
      diagLog(
        `🛠️  Missing column '${column}' on '${table}'. Adding via ALTER TABLE...`
      );
      sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
      diagLog(`✅ Added column '${column}' to '${table}'`);
    }
  } catch (e) {
    console.error(
      `❌ Failed to ensure column '${column}' on table '${table}':`,
      e
    );
  }
}

/**
 * Save database to IndexedDB
 */
async function saveToIndexedDB(key: string, data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      fn();
    };
    const resolveOnce = () => finish(() => resolve());
    const rejectOnce = (error: unknown) =>
      finish(() =>
        reject(
          error instanceof Error
            ? error
            : new Error(error ? String(error) : "IndexedDB save failed")
        )
      );

    const timeoutId = setTimeout(() => {
      rejectOnce(new Error(`[IndexedDB] Save timed out for key: ${key}`));
    }, INDEXEDDB_OPERATION_TIMEOUT_MS);

    const request = indexedDB.open(INDEXEDDB_NAME);

    request.onblocked = () => {
      rejectOnce(
        new Error(`[IndexedDB] Open blocked while saving key: ${key}`)
      );
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
        db.createObjectStore(INDEXEDDB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      // If the store is missing (possible after races with delete), perform an upgrade to create it
      if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
        const currentVersion = db.version || 1;
        db.close();

        const upgradeReq = indexedDB.open(INDEXEDDB_NAME, currentVersion + 1);
        upgradeReq.onblocked = () => {
          rejectOnce(
            new Error(
              `[IndexedDB] Upgrade blocked while saving key: ${key}`
            )
          );
        };
        upgradeReq.onupgradeneeded = () => {
          const udb = upgradeReq.result;
          if (!udb.objectStoreNames.contains(INDEXEDDB_STORE)) {
            udb.createObjectStore(INDEXEDDB_STORE);
          }
        };
        upgradeReq.onsuccess = () => {
          const udb = upgradeReq.result;
          const tx = udb.transaction(INDEXEDDB_STORE, "readwrite");
          const store = tx.objectStore(INDEXEDDB_STORE);
          store.put(data, key);
          tx.oncomplete = () => {
            udb.close();
            resolveOnce();
          };
          tx.onerror = () => {
            udb.close();
            rejectOnce(tx.error ?? new Error("IndexedDB upgrade write failed"));
          };
          tx.onabort = () => {
            udb.close();
            rejectOnce(tx.error ?? new Error("IndexedDB upgrade write aborted"));
          };
        };
        upgradeReq.onerror = () =>
          rejectOnce(
            upgradeReq.error ?? new Error("IndexedDB upgrade open failed")
          );
        return;
      }

      const tx = db.transaction(INDEXEDDB_STORE, "readwrite");
      const store = tx.objectStore(INDEXEDDB_STORE);
      store.put(data, key);

      tx.oncomplete = () => {
        db.close();
        resolveOnce();
      };
      tx.onerror = () => {
        db.close();
        rejectOnce(tx.error ?? new Error("IndexedDB write failed"));
      };
      tx.onabort = () => {
        db.close();
        rejectOnce(tx.error ?? new Error("IndexedDB write aborted"));
      };
    };

    request.onerror = () =>
      rejectOnce(request.error ?? new Error("IndexedDB open failed"));
  });
}

/**
 * Load database from IndexedDB
 */
async function loadFromIndexedDB(key: string): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
        db.createObjectStore(INDEXEDDB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
        db.close();
        resolve(null);
        return;
      }

      const tx = db.transaction(INDEXEDDB_STORE, "readonly");
      const store = tx.objectStore(INDEXEDDB_STORE);
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        db.close();
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete database from IndexedDB
 */
async function deleteFromIndexedDB(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME);

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
        db.close();
        resolve();
        return;
      }

      const tx = db.transaction(INDEXEDDB_STORE, "readwrite");
      const store = tx.objectStore(INDEXEDDB_STORE);
      store.delete(key);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the raw SQLite WASM instance (for debugging/admin tools)
 *
 * @returns The sql.js Database instance or null if not initialized
 * @example
 * ```typescript
 * const sqliteDb = await getSqliteInstance();
 * const result = sqliteDb.exec("SELECT * FROM tune LIMIT 10;");
 * ```
 */
export async function getSqliteInstance(): Promise<SqlJsDatabase | null> {
  return sqliteDb;
}

export type ISqlJsDebugInfo = {
  hasModule: boolean;
  wasmHeapBytes?: number;
};

export function getSqlJsDebugInfo(): ISqlJsDebugInfo {
  try {
    const modAny = sqlJsModule as any;
    const heapBytes = Number(modAny?.HEAP8?.buffer?.byteLength ?? 0);
    return {
      hasModule: !!sqlJsModule,
      wasmHeapBytes: heapBytes > 0 ? heapBytes : undefined,
    };
  } catch {
    return { hasModule: !!sqlJsModule };
  }
}

export type IClientSqliteDebugState = {
  initEpoch: number;
  isClearing: boolean;
  isInitializingDb: boolean;
  dbReady: boolean;
  hasSqliteDb: boolean;
  hasDrizzleDb: boolean;
  currentUser?: string | null;
};

export function getClientSqliteDebugState(): IClientSqliteDebugState {
  return {
    initEpoch,
    isClearing,
    isInitializingDb,
    dbReady,
    hasSqliteDb: !!sqliteDb,
    hasDrizzleDb: !!drizzleDb,
    currentUser: currentUserId,
  };
}

/**
 * Export schema for convenient imports
 */
export { schema };

/**
 * Type exports
 */
export type SqliteDatabase = ReturnType<typeof drizzle>;
export type Schema = typeof schema;
