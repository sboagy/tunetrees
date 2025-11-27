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
import { generateId } from "@/lib/utils/uuid";
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
  // Reference data (shared across users, read-only for non-admins)
  | "genre"
  | "tune_type"
  | "genre_tune_type"
  | "instrument"
  // User profiles (critical for auth and FK relationships)
  | "user_profile"
  // User preferences
  | "prefs_scheduling_options"
  | "prefs_spaced_repetition"
  | "table_state"
  | "tab_group_main_state"
  // User data (existing)
  | "tune"
  | "playlist"
  | "playlist_tune"
  | "note"
  | "reference"
  | "tag"
  | "practice_record"
  | "daily_practice_queue"
  | "table_transient_data" // Staging data for practice evaluations
  | "tune_override";

/**
 * Queue a change for sync
 *
 * @param db - SQLite database instance
 * @param tableName - Name of the table
 * @param operation - Type of operation (insert, update, delete)
 * @param data - Record data containing all necessary fields (including id or composite keys)
 * @returns The created queue item
 *
 * @example
 * ```typescript
 * // Single key table
 * await queueSync(db, "tune", "update", {
 *   id: "123",
 *   title: "New Title",
 *   type: "Reel"
 * });
 *
 * // Composite key table
 * await queueSync(db, "table_transient_data", "update", {
 *   userId: "...",
 *   tuneId: "...",
 *   playlistId: "...",
 *   quality: 3
 * });
 * ```
 */
export async function queueSync(
  db: SqliteDatabase,
  tableName: SyncableTable,
  operation: SyncOperation,
  data: Record<string, unknown>
): Promise<SyncQueueItem> {
  const now = new Date().toISOString();

  const [queueItem] = await db
    .insert(syncQueue)
    .values({
      id: generateId(),
      tableName: tableName,
      recordId: generateId(), // Dummy UUID for backwards compatibility (field is deprecated)
      operation,
      data: JSON.stringify(data),
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
  itemId: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  await db
    .update(syncQueue)
    .set({
      status,
      attempts: sql.raw(`${syncQueue.attempts.name} + 1`),
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
  itemId: string
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
  itemId: string
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
 * Clear ALL items from sync queue
 *
 * Used for anonymous users who don't sync to Supabase.
 *
 * @param db - SQLite database instance
 */
export async function clearSyncQueue(db: SqliteDatabase): Promise<void> {
  await db.delete(syncQueue);
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
