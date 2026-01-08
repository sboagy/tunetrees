/**
 * Sync Module
 *
 * Exports sync-related functions and types.
 * NOTE: sync_queue is deprecated. Use sync_push_queue (trigger-based) instead.
 *
 * @module lib/sync
 */

export {
  clearOldOutboxItems,
  clearSyncOutbox,
  getOutboxStats,
  getFailedOutboxItems,
  retryOutboxItem,
} from "./outbox";
export type {
  SyncableTable,
  SyncOperation,
  SyncStatus,
} from "./queue";

export {
  SyncInProgressError,
  type SyncResult,
  SyncService,
  startSyncWorker,
} from "./service";

export { SyncEngine } from "./engine";
export { RealtimeManager } from "./realtime";
