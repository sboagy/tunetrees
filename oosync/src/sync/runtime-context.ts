/**
 * Runtime configuration for `oosync`.
 *
 * Consumers must provide schema metadata, sync infrastructure tables,
 * and platform-specific helpers (SQLite, triggers, logger).
 */
import type { SQLJsDatabase } from "drizzle-orm/sql-js";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import type { Database as SqlJsDatabase } from "sql.js";
import type { TableRegistry } from "../shared/table-meta";

/** Drizzle SQL.js database (typed queries/select/insert/update). */
export type SqliteDatabase = SQLJsDatabase<Record<string, unknown>>;
/** Raw sql.js Database instance (provides exec/run, used for triggers/maintenance). */
export type SqliteRawDatabase = SqlJsDatabase;

export interface IOutboxBackupItem {
  tableName: SyncableTableName;
  rowId: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | string;
  changedAt: string;
  rowData?: Record<string, unknown>;
}

export interface IOutboxBackup {
  version: 1;
  createdAt: string;
  items: IOutboxBackupItem[];
}

export interface SyncSchemaDescription {
  syncableTables: readonly string[];
  tableRegistry: TableRegistry;
  tableSyncOrder: Record<string, number>;
  tableToSchemaKey: Record<string, string>;
}

export type SyncableTableName = SyncSchemaDescription["syncableTables"][number];

export type SyncPushQueueTable = AnySQLiteTable & {
  // Column accessors used by outbox operations; concrete type comes from consumer schema.
  id: any;
  tableName: any;
  rowId: any;
  operation: any;
  status: any;
  changedAt: any;
  syncedAt: any;
  attempts: any;
  lastError: any;
};

export interface SyncRuntime {
  schema: SyncSchemaDescription;
  syncPushQueue: SyncPushQueueTable;
  localSchema: Record<string, unknown>;
  getSqliteInstance: () => Promise<SqliteRawDatabase | null>;
  loadOutboxBackupForUser: (userId: string) => Promise<IOutboxBackup | null>;
  clearOutboxBackupForUser: (userId: string) => Promise<void>;
  replayOutboxBackup: (
    db: SqliteRawDatabase,
    backup: IOutboxBackup
  ) => { applied: number; skipped: number; errors: string[] };
  enableSyncTriggers: (db: SqliteRawDatabase) => Promise<void> | void;
  suppressSyncTriggers: (db: SqliteRawDatabase) => Promise<void> | void;
  persistDb?: () => Promise<void>;
  logger: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

let runtime: SyncRuntime | null = null;

export function setSyncRuntime(next: SyncRuntime): void {
  runtime = next;
}

export function getSyncRuntime(): SyncRuntime {
  if (!runtime) {
    throw new Error(
      "Sync runtime not configured. Call setSyncRuntime() first."
    );
  }
  return runtime;
}
