/**
 * Sync Queue Operations
 *
 * Handles queuing local changes for synchronization with Supabase.
 * Implements offline-first pattern: local changes are queued and synced
 * asynchronously in the background.
 *
 * @module lib/sync/queue
 */

import { desc, eq, sql } from "drizzle-orm";
import type { SqliteDatabase } from "../db/client-sqlite";
import { syncQueue } from "../db/schema";
import type { SyncQueueItem } from "../db/types";

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
 */
export type SyncableTable =
  | "tune"
  | "playlist"
  | "playlist_tune"
  | "note"
  | "reference"
  | "tag"
  | "practice_record"
  | "daily_practice_queue"
  | "tune_override"
  | "user_annotation_set";

/**
 * Queue a change for sync
 *
 * @param db - SQLite database instance
 * @param tableName - Name of the table
 * @param recordId - Primary key of the record (as string)
 * @param operation - Type of operation (insert, update, delete)
 * @param data - Record data (optional for delete)
 * @returns The created queue item
 *
 * @example
 * ```typescript
 * await queueSync(db, "tune", "123", "update", {
 *   title: "New Title",
 *   type: "Reel"
 * });
 * ```
 */
export async function queueSync(
  db: SqliteDatabase,
  tableName: SyncableTable,
  recordId: string | number,
  operation: SyncOperation,
  data?: Record<string, unknown>
): Promise<SyncQueueItem> {
  const now = new Date().toISOString();

  const [queueItem] = await db
    .insert(syncQueue)
    .values({
      tableName: tableName,
      recordId: String(recordId),
      operation,
      data: data ? JSON.stringify(data) : null,
      createdAt: now,
      attempts: 0,
      status: "pending",
    })
    .returning();

  return queueItem;
}

/**
 * Get pending sync items
 *
 * @param db - SQLite database instance
 * @param limit - Maximum number of items to return
 * @returns Array of pending sync queue items
 */
export async function getPendingSyncItems(
  db: SqliteDatabase,
  limit = 100
): Promise<SyncQueueItem[]> {
  return await db
    .select()
    .from(syncQueue)
    .where(eq(syncQueue.status, "pending"))
    .orderBy(syncQueue.createdAt)
    .limit(limit);
}

/**
 * Get failed sync items
 *
 * @param db - SQLite database instance
 * @param limit - Maximum number of items to return
 * @returns Array of failed sync queue items
 */
export async function getFailedSyncItems(
  db: SqliteDatabase,
  limit = 100
): Promise<SyncQueueItem[]> {
  return await db
    .select()
    .from(syncQueue)
    .where(eq(syncQueue.status, "failed"))
    .orderBy(desc(syncQueue.createdAt))
    .limit(limit);
}

/**
 * Update sync item status
 *
 * @param db - SQLite database instance
 * @param itemId - Sync queue item ID
 * @param status - New status
 * @param error - Error message (if failed)
 */
export async function updateSyncStatus(
  db: SqliteDatabase,
  itemId: number,
  status: SyncStatus,
  error?: string
): Promise<void> {
  await db
    .update(syncQueue)
    .set({
      status,
      attempts: sql`${syncQueue.attempts} + 1`,
      lastError: error || null,
    })
    .where(eq(syncQueue.id, itemId));
}

/**
 * Mark sync item as synced and remove from queue
 *
 * @param db - SQLite database instance
 * @param itemId - Sync queue item ID
 */
export async function markSynced(
  db: SqliteDatabase,
  itemId: number
): Promise<void> {
  await db.delete(syncQueue).where(eq(syncQueue.id, itemId));
}

/**
 * Retry a failed sync item
 *
 * @param db - SQLite database instance
 * @param itemId - Sync queue item ID
 */
export async function retrySyncItem(
  db: SqliteDatabase,
  itemId: number
): Promise<void> {
  await db
    .update(syncQueue)
    .set({
      status: "pending",
      lastError: null,
    })
    .where(eq(syncQueue.id, itemId));
}

/**
 * Clear all synced items from queue
 *
 * @param db - SQLite database instance
 */
export async function clearSyncedItems(db: SqliteDatabase): Promise<void> {
  await db.delete(syncQueue).where(eq(syncQueue.status, "synced"));
}

/**
 * Get sync queue stats
 *
 * @param db - SQLite database instance
 * @returns Queue statistics
 */
export async function getSyncQueueStats(db: SqliteDatabase): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  total: number;
}> {
  const allItems = await db.select().from(syncQueue);

  return {
    pending: allItems.filter((item) => item.status === "pending").length,
    syncing: allItems.filter((item) => item.status === "syncing").length,
    failed: allItems.filter((item) => item.status === "failed").length,
    total: allItems.length,
  };
}
