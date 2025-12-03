/**
 * Sync Module
 *
 * Exports sync-related functions and types.
 * NOTE: sync_queue is deprecated. Use sync_outbox (trigger-based) instead.
 *
 * @module lib/sync
 */

export { clearSyncOutbox, getOutboxStats } from "./outbox";
export type {
  SyncableTable,
  SyncOperation,
  SyncStatus,
} from "./queue";

export { type SyncResult, SyncService, startSyncWorker } from "./service";
