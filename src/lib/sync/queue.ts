/**
 * Sync Queue Types
 *
 * DEPRECATED: The sync_queue table has been replaced by sync_outbox (trigger-based).
 * This file only exports types for backwards compatibility.
 * Use sync_outbox via the outbox.ts module instead.
 *
 * @module lib/sync/queue
 */

/**
 * Sync operation type
 */
export type SyncOperation = "insert" | "update" | "delete";

/**
 * Sync status type
 */
export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

/**
 * Table names that can be synced
 * @deprecated Use SYNCABLE_TABLES from shared/table-meta.ts instead
 */
export type SyncableTable =
  | "genre"
  | "tune_type"
  | "genre_tune_type"
  | "instrument"
  | "user_profile"
  | "prefs_scheduling_options"
  | "prefs_spaced_repetition"
  | "table_state"
  | "tab_group_main_state"
  | "tune"
  | "playlist"
  | "playlist_tune"
  | "note"
  | "reference"
  | "tag"
  | "practice_record"
  | "daily_practice_queue"
  | "table_transient_data"
  | "tune_override";
