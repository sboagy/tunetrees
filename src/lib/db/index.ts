/**
 * Database Client Exports
 *
 * This module provides convenient exports for the browser database client:
 * - SQLite WASM - Local offline storage
 *
 * Note: This module is browser-focused; it does not export a Postgres Drizzle client.
 * Browser network access uses the Supabase JS client; server-side Postgres access happens in the sync worker.
 *
 * @module db
 */

export type { Schema as SqliteSchema, SqliteDatabase } from "./client-sqlite";
// SQLite WASM client
export {
  clearDb as clearSqliteDb,
  closeDb as closeSqliteDb,
  getDb as getSqliteDb,
  initializeDb as initializeSqliteDb,
  persistDb as persistSqliteDb,
  schema as sqliteSchema,
  setupAutoPersist,
} from "./client-sqlite";
