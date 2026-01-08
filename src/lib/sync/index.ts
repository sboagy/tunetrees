/**
 * Sync Module - Re-export Layer
 *
 * Temporary re-export layer for backward compatibility.
 * All sync functionality has been moved to oosync/src/sync/.
 *
 * TODO: Remove this re-export layer after all imports have been migrated to use
 * `import { ... } from "@oosync"` or `import { ... } from "oosync/src/sync/..."`
 *
 * @module lib/sync
 */

import "./runtime-config";

// Re-export everything from the new oosync location
export {
  SyncEngine,
  SyncService,
  SyncInProgressError,
  startSyncWorker,
  RealtimeManager,
  clearOldOutboxItems,
  clearSyncOutbox,
  getOutboxStats,
  getFailedOutboxItems,
  retryOutboxItem,
} from "@oosync/sync";

export type {
  SyncableTable,
  SyncOperation,
  SyncStatus,
  SyncResult,
} from "@oosync/sync";

export { ensureSyncRuntimeConfigured } from "./runtime-config";
