/**
 * Sync Module
 *
 * Exports sync-related functions and types.
 *
 * @module lib/sync
 */

export {
  clearSyncedItems,
  getFailedSyncItems,
  getPendingSyncItems,
  getSyncQueueStats,
  markSynced,
  queueSync,
  retrySyncItem,
  type SyncableTable,
  type SyncOperation,
  type SyncStatus,
  updateSyncStatus,
} from "./queue";

export { type SyncResult, SyncService, startSyncWorker } from "./service";
