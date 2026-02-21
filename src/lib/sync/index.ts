/**
 * Sync Module - Re-export Layer
 *
 * Temporary re-export layer for backward compatibility.
 * All sync functionality has moved to the linked `oosync` package.
 *
 * TODO: Remove this re-export layer after all imports have been migrated to use
 * `import { ... } from "@oosync/sync"`
 *
 * @module lib/sync
 */

import "./runtime-config";

export type {
  SyncableTable,
  SyncOperation,
  SyncResult,
  SyncStatus,
} from "@oosync/sync";
// Re-export everything from the new oosync location
export {
  clearOldOutboxItems,
  clearSyncOutbox,
  getFailedOutboxItems,
  getOutboxStats,
  RealtimeManager,
  retryOutboxItem,
  SyncEngine,
  SyncInProgressError,
  SyncService,
  startSyncWorker,
} from "@oosync/sync";

export { ensureSyncRuntimeConfigured } from "./runtime-config";
