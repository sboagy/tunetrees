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
 * Table names that can be synced.
 * Schema-specific unions are supplied via runtime schema configuration.
 */
export type SyncableTable = string;
