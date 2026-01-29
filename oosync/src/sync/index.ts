/**
 * Sync Module
 *
 * Exports sync-related functions and types.
 * NOTE: sync_queue is deprecated. Use sync_push_queue (trigger-based) instead.
 *
 * @module lib/sync
 */

export { applyRemoteChangesToLocalDb } from "./apply-remote-changes";
export { SyncEngine } from "./engine";
export {
  backfillOutboxSince,
  clearOldOutboxItems,
  clearSyncOutbox,
  getFailedOutboxItems,
  getOutboxStats,
  retryOutboxItem,
} from "./outbox";
export type {
  SyncableTable,
  SyncOperation,
  SyncStatus,
} from "./queue";
export { RealtimeManager } from "./realtime";
export {
  SyncInProgressError,
  type SyncResult,
  SyncService,
  startSyncWorker,
} from "./service";
export { WorkerClient } from "./worker-client";
