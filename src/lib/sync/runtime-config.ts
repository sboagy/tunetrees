/**
 * Configure runtime dependencies for the TuneTrees app.
 *
 * This wires app-specific schema, SQLite helpers, and logger into the
 * schema-agnostic oosync runtime layer.
 */
import {
  type SyncPushQueueTable,
  type SyncRuntime,
  setSyncRuntime,
} from "@oosync/sync";
import * as localSchema from "../../../drizzle/schema-sqlite";
import {
  SYNCABLE_TABLES,
  TABLE_REGISTRY,
  TABLE_SYNC_ORDER,
  TABLE_TO_SCHEMA_KEY,
} from "../../../shared/table-meta";
import {
  clearOutboxBackupForUser,
  getSqliteInstance,
  loadOutboxBackupForUser,
  persistDb,
} from "../db/client-sqlite";
import {
  enableSyncTriggers,
  suppressSyncTriggers,
} from "../db/install-triggers";
import {
  type IOutboxBackup as AppOutboxBackup,
  replayOutboxBackup,
} from "../db/outbox-backup";
import { log } from "../logger";

export function ensureSyncRuntimeConfigured(): void {
  const runtime: SyncRuntime = {
    schema: {
      syncableTables: SYNCABLE_TABLES,
      tableRegistry: TABLE_REGISTRY,
      tableSyncOrder: TABLE_SYNC_ORDER,
      tableToSchemaKey: TABLE_TO_SCHEMA_KEY,
    },
    syncPushQueue: localSchema.syncPushQueue as unknown as SyncPushQueueTable,
    localSchema,
    getSqliteInstance,
    loadOutboxBackupForUser,
    clearOutboxBackupForUser,
    replayOutboxBackup: (db, backup) =>
      replayOutboxBackup(db, backup as AppOutboxBackup),
    enableSyncTriggers,
    suppressSyncTriggers,
    persistDb,
    logger: log,
  };

  setSyncRuntime(runtime);
}

// Configure immediately on import to keep consumer ergonomics simple.
ensureSyncRuntimeConfigured();
