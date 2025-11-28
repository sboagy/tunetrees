/**
 * Database Client Exports
 *
 * This module provides convenient exports for the browser database client:
 * - SQLite WASM - Local offline storage
 *
 * Note: PostgreSQL client (client-postgres.ts) is NOT exported here.
 * It uses Node.js-only dependencies and is only for server-side scripts.
 * For browser Supabase access, use @/lib/supabase/client directly.
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
  relations as sqliteRelations,
  schema as sqliteSchema,
  setupAutoPersist,
} from "./client-sqlite";
