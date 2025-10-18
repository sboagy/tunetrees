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

/**
 * SQLite WASM instance
 * Initialized on first access via `initializeDb()`
 */
let sqliteDb: SqlJsDatabase | null = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;

/**
 * IndexedDB database name for persistence
 */
const INDEXEDDB_NAME = "tunetrees-storage";
const INDEXEDDB_STORE = "databases";
const DB_KEY = "tunetrees-db";
const DB_VERSION_KEY = "tunetrees-db-version";

/**
 * Current database schema version
 * Increment this when schema changes to force re-initialization
 */
const CURRENT_DB_VERSION = 3; // Incremented to force migration with name and genre_default columns

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
    return drizzleDb;
  }

  console.log("🔧 Initializing SQLite WASM database...");

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
    ];

    try {
      for (const migrationPath of migrations) {
        console.log(`📄 Loading migration: ${migrationPath}`);
        const response = await fetch(migrationPath);
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
          `✅ Applied ${statements.length} statements from ${migrationPath
            .split("/")
            .pop()}`
        );
      }

      console.log(`✅ Applied all ${migrations.length} migrations`);
    } catch (error) {
      console.error("❌ Failed to apply migrations:", error);
      throw new Error(
        `Database migration failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    console.log("✅ Created new SQLite database with schema");
  }

  // Initialize Drizzle ORM
  drizzleDb = drizzle(sqliteDb, { schema: { ...schema, ...relations } });

  // Initialize database views
  await initializeViews(drizzleDb);

  // Create sync_queue table if it doesn't exist (missing from migration)
  try {
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT,
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
  if (!sqliteDb) {
    throw new Error("SQLite database not initialized");
  }

  const data = sqliteDb.export();
  await saveToIndexedDB(DB_KEY, data);
  // Save version number
  await saveToIndexedDB(DB_VERSION_KEY, new Uint8Array([CURRENT_DB_VERSION]));
  console.log("💾 Database persisted to IndexedDB");
}

/**
 * Clear local database
 *
 * Removes the database from memory and IndexedDB.
 * Useful for logout or data reset scenarios.
 */
export async function clearDb(): Promise<void> {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    drizzleDb = null;
  }

  await deleteFromIndexedDB(DB_KEY);
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
 * Save database to IndexedDB
 */
async function saveToIndexedDB(key: string, data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(INDEXEDDB_STORE)) {
        db.createObjectStore(INDEXEDDB_STORE);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
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
    const request = indexedDB.open(INDEXEDDB_NAME, 1);

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
    const request = indexedDB.open(INDEXEDDB_NAME, 1);

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
