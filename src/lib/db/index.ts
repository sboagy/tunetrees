/**
 * Database Client Exports
 *
 * This module provides convenient exports for both database clients:
 * - PostgreSQL (Supabase) - Cloud storage
 * - SQLite WASM - Local offline storage
 *
 * @module db
 */

export type {
  Database as PostgresDatabase,
  Schema as PostgresSchema,
} from "./client-postgres";
// PostgreSQL (Supabase) client
export {
  closeConnection as closePostgresConnection,
  db as postgresDb,
  relations as postgresRelations,
  schema as postgresSchema,
} from "./client-postgres";
export type { Schema as SqliteSchema, SqliteDatabase } from "./client-sqlite";
// SQLite WASM client
export {
  clearDb as clearSqliteDb,
  getDb as getSqliteDb,
  initializeDb as initializeSqliteDb,
  persistDb as persistSqliteDb,
  relations as sqliteRelations,
  schema as sqliteSchema,
  setupAutoPersist,
} from "./client-sqlite";
