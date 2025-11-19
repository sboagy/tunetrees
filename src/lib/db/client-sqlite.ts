/**
 * SQLite WASM Database Client (Offline Storage)
 *
 * This module provides a Drizzle ORM client for interacting with SQLite WASM.
 * Used for local offline storage in the browser with IndexedDB persistence.
 *
 * @module client-sqlite
 */

import { drizzle } from "drizzle-orm/sql-js";
import type { Database as SqlJsDatabase } from "sql.js";
import initSqlJs from "sql.js";
import * as relations from "../../../drizzle/relations";
import * as schema from "../../../drizzle/schema-sqlite";
import { initializeViews, recreateViews } from "./init-views";
import {
  clearLocalDatabaseForMigration,
  clearMigrationParams,
  getCurrentSchemaVersion,
  getLocalSchemaVersion,
  isForcedReset,
  needsMigration,
  setLocalSchemaVersion,
} from "./migration-version";

/**
 * SQLite WASM instance
 * Initialized on first access via `initializeDb()`
 */
let sqliteDb: SqlJsDatabase | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;
let dbReady = false;
let isClearing = false;

/**
 * IndexedDB database name for persistence
 */
const INDEXEDDB_NAME = "tunetrees-storage";
const INDEXEDDB_STORE = "databases";
const DB_KEY = "tunetrees-db";
const DB_VERSION_KEY = "tunetrees-db-version";

/**
 * Current database version
 * Increment this to force all clients to recreate their local database
 * Version 3: Added name and genre_default columns
 * Version 4: Removed playlist.user_ref + instrument_ref unique constraint
 */
const CURRENT_DB_VERSION = 4;

/**
 * Initialize SQLite WASM database
 *
 * This function:
 * 1. Loads the sql.js WASM module
 * 2. Checks IndexedDB for existing database
 * 3. Creates new database or loads existing one
 * 4. Initializes Drizzle ORM
 * 5. Seeds with test data if new database
 *
 * @param userId - User ID for seeding data (optional)
 * @returns Drizzle ORM instance
 *
 * @example
 * ```typescript
 * import { initializeDb } from '@/lib/db/client-sqlite';
 *
 * const db = await initializeDb();
 * ```
 */
export async function initializeDb(): Promise<ReturnType<typeof drizzle>> {
  if (drizzleDb) {
    dbReady = true;
    return drizzleDb;
  }

  console.log("🔧 Initializing SQLite WASM database...");

  // Check if schema migration is needed (e.g., integer IDs → UUIDs)
  const migrationNeeded = needsMigration();
  const forcedReset = isForcedReset();

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

    // Clear local data so new schema can be populated from Supabase
    // Note: This happens before creating the drizzle instance
    // Actual table clearing will happen after DB is initialized
  }

  // Load sql.js WASM module
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/sql-wasm/${file}`,
  });

  // Try to load existing database from IndexedDB
  const existingData = await loadFromIndexedDB(DB_KEY);
  const storedVersion = await loadFromIndexedDB(DB_VERSION_KEY);
  const storedVersionNum =
    storedVersion && storedVersion.length > 0 ? storedVersion[0] : 0;

  // Check if we need to recreate the database due to version mismatch
  if (existingData && storedVersionNum === CURRENT_DB_VERSION) {
    // Load existing database with matching version
    sqliteDb = new SQL.Database(existingData);
    console.log(
      `✅ Loaded existing SQLite database from IndexedDB (v${CURRENT_DB_VERSION})`
    );

    // CRITICAL: Always recreate views on load to ensure latest definitions
    // View definitions can change between app versions without bumping DB_VERSION
    drizzleDb = drizzle(sqliteDb, { schema: { ...schema, ...relations } });
    console.log("🔄 Recreating views with latest definitions...");
    await recreateViews(drizzleDb);
    console.log("✅ Views recreated successfully");
  } else {
    // Create new database (either first time or version mismatch)
    if (existingData) {
      console.log(
        `🔄 Database version mismatch (stored: ${storedVersionNum}, current: ${CURRENT_DB_VERSION}). Recreating...`
      );
      // Clear old database
      await deleteFromIndexedDB(DB_KEY);
      await deleteFromIndexedDB(DB_VERSION_KEY);
    }

    sqliteDb = new SQL.Database();

    // Apply schema migrations in order
    console.log("📋 Applying SQLite schema migrations...");
    const migrations = [
      "/drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql",
      "/drizzle/migrations/sqlite/0001_thin_chronomancer.sql",
      "/drizzle/migrations/sqlite/0002_nappy_roland_deschain.sql",
      "/drizzle/migrations/sqlite/0003_friendly_cerebro.sql",
    ];

    try {
      for (const migrationPath of migrations) {
        console.log(`📄 Loading migration: ${migrationPath}`);
        // Always bypass HTTP cache to avoid serving stale migration assets
        const response = await fetch(migrationPath, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(
            `Failed to load migration ${migrationPath}: ${response.status} ${response.statusText}`
          );
        }
        const migrationSql = await response.text();

        // Split by statement breakpoint and execute each statement
        const statements = migrationSql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          if (statement && !statement.startsWith("--")) {
            sqliteDb.run(statement);
          }
        }

        console.log(
          `✅ Applied ${statements.length} statements from ${migrationPath.split("/").pop()}`
        );
      }

      console.log(`✅ Applied all ${migrations.length} migrations`);
    } catch (error) {
      console.error("❌ Failed to apply migrations:", error);
      throw new Error(
        `Database migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    console.log("✅ Created new SQLite database with schema");
  }

  // Initialize Drizzle ORM
  drizzleDb = drizzle(sqliteDb, { schema: { ...schema, ...relations } });

  // Initialize database views
  await initializeViews(drizzleDb);

  // Defensive: ensure critical columns exist even if an older DB slipped through
  try {
    ensureColumnExists("user_profile", "avatar_url", "avatar_url text");
  } catch (err) {
    console.warn("⚠️ Column ensure check failed:", err);
  }

  // Create sync_queue table if it doesn't exist (missing from migration)
  try {
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        attempts INTEGER DEFAULT 0 NOT NULL,
        last_error TEXT
      )
    `);
    sqliteDb.run(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)
    `);
    console.log("✅ Ensured sync_queue table exists");
  } catch (error) {
    console.error("❌ Failed to create sync_queue table:", error);
  }

  // Database is ready - sync will handle populating with real data from Supabase
  console.log("✅ SQLite WASM database ready");
  dbReady = true;

  // Handle schema migration if needed
  if (migrationNeeded) {
    console.log("🔄 Executing schema migration...");
    try {
      await clearLocalDatabaseForMigration(drizzleDb);
      setLocalSchemaVersion(getCurrentSchemaVersion());
      clearMigrationParams(); // Remove URL params like ?reset=true

      if (forcedReset) {
        console.log("✅ Forced reset complete. Local database cleared.");
      } else {
        console.log(
          "✅ Schema migration complete. Ready for re-sync from Supabase."
        );
      }
    } catch (error) {
      console.error("❌ Migration failed:", error);
      // Continue anyway - sync will handle populating data
    }
  } else {
    // Ensure version is set even if no migration needed
    const currentLocal = getLocalSchemaVersion();
    if (!currentLocal) {
      setLocalSchemaVersion(getCurrentSchemaVersion());
    }
  }

  // DEBUG: Check what data exists in tune table
  const tuneCount = sqliteDb.exec("SELECT COUNT(*) as count FROM tune");
  const count = Number(tuneCount[0]?.values[0]?.[0] || 0);
  console.log(
    `🔍 DEBUG: Found ${count} tunes in database after initialization`
  );

  if (count > 0) {
    const sampleTunes = sqliteDb.exec(
      "SELECT id, title, genre FROM tune LIMIT 5"
    );
    console.log("🔍 DEBUG: Sample tunes:", sampleTunes[0]?.values || []);
  }

  return drizzleDb;
}

/**
 * Get current database instance
 *
 * @throws Error if database not initialized
 * @returns Drizzle ORM instance
 */
export function getDb(): ReturnType<typeof drizzle> {
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
  if (!dbReady) {
    console.warn("⏭️  Skipping persist until DB initialization completes");
    return;
  }

  const data = sqliteDb.export();
  await saveToIndexedDB(DB_KEY, data);
  // Save version number
  await saveToIndexedDB(DB_VERSION_KEY, new Uint8Array([CURRENT_DB_VERSION]));
  console.log("💾 Database persisted to IndexedDB");

  // DEV VERIFICATION: load saved blob and verify critical table counts match
  try {
    // Only run verification in development builds to avoid extra overhead in prod
    if (import.meta.env.MODE !== "production") {
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sql-wasm/${file}`,
      });
      const savedDb = new SQL.Database(data);

      // Count rows in table_transient_data in-memory vs saved blob
      const inMemRes = sqliteDb.exec(
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
        console.log(
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
  } catch (err) {
    console.error("Error during persist verification:", err);
  }
}

/**
 * Clear local database
 *
 * Removes the database from memory and IndexedDB.
 * Useful for logout or data reset scenarios.
 */
export async function clearDb(): Promise<void> {
  isClearing = true;
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    drizzleDb = null;
  }

  await deleteFromIndexedDB(DB_KEY);
  dbReady = false;
  isClearing = false;
  console.log("🗑️  Local database cleared");
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
  const persistHandler = () => {
    if (drizzleDb) {
      persistDb().catch(console.error);
    }
  };

  // Persist on page unload
  window.addEventListener("beforeunload", persistHandler);

  // Persist when tab becomes hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      persistHandler();
    }
  });

  // Periodic persistence (every 30 seconds)
  const intervalId = setInterval(persistHandler, 300000);

  // Return cleanup function
  return () => {
    window.removeEventListener("beforeunload", persistHandler);
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
      console.log(
        `🛠️  Missing column '${column}' on '${table}'. Adding via ALTER TABLE...`
      );
      sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
      console.log(`✅ Added column '${column}' to '${table}'`);
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
    const request = indexedDB.open(INDEXEDDB_NAME);

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
            resolve();
          };
          tx.onerror = () => {
            udb.close();
            reject(tx.error);
          };
        };
        upgradeReq.onerror = () => reject(upgradeReq.error);
        return;
      }

      const tx = db.transaction(INDEXEDDB_STORE, "readwrite");
      const store = tx.objectStore(INDEXEDDB_STORE);
      store.put(data, key);

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

/**
 * Export schema for convenient imports
 */
export { schema, relations };

/**
 * Type exports
 */
export type SqliteDatabase = ReturnType<typeof drizzle>;
export type Schema = typeof schema;
