/**
 * Sync Push Queue Operations
 *
 * Handles reading and updating the trigger-populated sync_push_queue table.
 * This is the client-side queue of changes to push to the server.
 * Note: Different from the server's sync_change_log which is stateless.
 *
 * @module lib/sync/outbox
 */

import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import type { SQLiteTableWithColumns } from "drizzle-orm/sqlite-core";
import * as localSchema from "../../../drizzle/schema-sqlite";
import {
  getPrimaryKey,
  type SyncableTableName,
} from "../../../shared/table-meta";
import type { SqliteDatabase } from "../db/client-sqlite";
import { toCamelCase } from "./casing";

const { syncPushQueue } = localSchema;

function randomHexId(bytesLength = 16): string {
  const bytes = new Uint8Array(bytesLength);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && "getRandomValues" in cryptoObj) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Outbox item status
 */
export type OutboxStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * Outbox item from the sync_push_queue table
 */
export interface OutboxItem {
  id: string;
  tableName: string;
  rowId: string;
  operation: string;
  status: string;
  changedAt: string;
  syncedAt: string | null;
  attempts: number;
  lastError: string | null;
}

/**
 * Get pending outbox items for sync
 *
 * @param db - SQLite database instance
 * @param limit - Maximum number of items to return
 * @returns Array of pending outbox items ordered by changedAt
 */
export async function getPendingOutboxItems(
  db: SqliteDatabase,
  limit = 100
): Promise<OutboxItem[]> {
  const items = await db
    .select()
    .from(syncPushQueue)
    .where(eq(syncPushQueue.status, "pending"))
    .orderBy(asc(syncPushQueue.changedAt))
    .limit(limit);

  return items;
}

/**
 * Backfill outbox entries for practice_record rows.
 *
 * Why this exists:
 * During syncDown, the engine suppresses triggers to prevent remote changes from
 * re-entering the outbox. If the user writes local data during that window, those
 * writes won't be captured by triggers and will never be pushed.
 */
export async function backfillPracticeRecordOutbox(
  db: SqliteDatabase,
  sinceIso: string
): Promise<number> {
  const { practiceRecord } = localSchema;

  const rows = await db
    .select({ id: practiceRecord.id })
    .from(practiceRecord)
    .where(gte(practiceRecord.lastModifiedAt, sinceIso));

  const ids = rows
    .map((r) => r.id)
    .filter(
      (id): id is string | number =>
        typeof id === "string" || typeof id === "number"
    )
    .map((id) => String(id))
    .filter((id) => id.length > 0);

  if (ids.length === 0) return 0;

  const existing = await db
    .select({ rowId: syncPushQueue.rowId })
    .from(syncPushQueue)
    .where(
      and(
        eq(syncPushQueue.tableName, "practice_record"),
        inArray(syncPushQueue.rowId, ids)
      )
    );

  const existingIds = new Set(existing.map((e) => e.rowId));
  const missingIds = ids.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return 0;

  const nowIso = new Date().toISOString();
  await db.insert(syncPushQueue).values(
    missingIds.map((id) => ({
      id: randomHexId(),
      tableName: "practice_record",
      rowId: id,
      operation: "UPDATE",
      status: "pending",
      changedAt: nowIso,
      attempts: 0,
      lastError: null,
      syncedAt: null,
    }))
  );

  return missingIds.length;
}

/**
 * Mark an outbox item as in progress
 *
 * @param db - SQLite database instance
 * @param id - Outbox item ID
 */
export async function markOutboxInProgress(
  db: SqliteDatabase,
  id: string
): Promise<void> {
  await db
    .update(syncPushQueue)
    .set({ status: "in_progress" })
    .where(eq(syncPushQueue.id, id));
}

/**
 * Mark an outbox item as completed (synced successfully)
 * We delete it from the outbox to keep the table small.
 *
 * @param db - SQLite database instance
 * @param id - Outbox item ID
 */
export async function markOutboxCompleted(
  db: SqliteDatabase,
  id: string
): Promise<void> {
  await db.delete(syncPushQueue).where(eq(syncPushQueue.id, id));
}

/**
 * Mark an outbox item as failed (for retry)
 * Sets status back to pending for retry, increments attempts, stores error.
 *
 * @param db - SQLite database instance
 * @param id - Outbox item ID
 * @param errorMessage - Error message to store
 */
export async function markOutboxFailed(
  db: SqliteDatabase,
  id: string,
  errorMessage: string,
  currentAttempts: number
): Promise<void> {
  await db
    .update(syncPushQueue)
    .set({
      status: "pending", // Back to pending for retry
      attempts: currentAttempts + 1,
      lastError: errorMessage,
    })
    .where(eq(syncPushQueue.id, id));
}

/**
 * Mark an outbox item as permanently failed (no more retries)
 *
 * @param db - SQLite database instance
 * @param id - Outbox item ID
 * @param errorMessage - Error message to store
 */
export async function markOutboxPermanentlyFailed(
  db: SqliteDatabase,
  id: string,
  errorMessage: string
): Promise<void> {
  await db
    .update(syncPushQueue)
    .set({
      status: "failed",
      lastError: errorMessage,
      syncedAt: new Date().toISOString(),
    })
    .where(eq(syncPushQueue.id, id));
}

/**
 * Get failed outbox items
 *
 * @param db - SQLite database instance
 * @param limit - Maximum number of items to return
 * @returns Array of failed outbox items ordered by changedAt desc
 */
export async function getFailedOutboxItems(
  db: SqliteDatabase,
  limit = 100
): Promise<OutboxItem[]> {
  const { desc } = await import("drizzle-orm");
  const items = await db
    .select()
    .from(syncPushQueue)
    .where(eq(syncPushQueue.status, "failed"))
    .orderBy(desc(syncPushQueue.changedAt))
    .limit(limit);

  return items;
}

/**
 * Reset a failed outbox item for retry
 *
 * @param db - SQLite database instance
 * @param id - Outbox item ID
 */
export async function retryOutboxItem(
  db: SqliteDatabase,
  id: string
): Promise<void> {
  await db
    .update(syncPushQueue)
    .set({
      status: "pending",
      lastError: null,
    })
    .where(eq(syncPushQueue.id, id));
}

/**
 * Get outbox statistics
 *
 * @param db - SQLite database instance
 * @returns Object with pending, in_progress, failed, and total counts
 */
export async function getOutboxStats(db: SqliteDatabase): Promise<{
  pending: number;
  inProgress: number;
  failed: number;
  total: number;
}> {
  // IMPORTANT: Don't fetch all outbox rows into JS.
  // The outbox can grow large (especially when offline), and selecting all rows
  // will allocate a huge array and can crash the tab.
  const [{ count: pendingCount } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(syncPushQueue)
    .where(eq(syncPushQueue.status, "pending"));

  const [{ count: inProgressCount } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(syncPushQueue)
    .where(eq(syncPushQueue.status, "in_progress"));

  const [{ count: failedCount } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(syncPushQueue)
    .where(eq(syncPushQueue.status, "failed"));

  const [{ count: totalCount } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(syncPushQueue);

  return {
    pending: Number(pendingCount ?? 0),
    inProgress: Number(inProgressCount ?? 0),
    failed: Number(failedCount ?? 0),
    total: Number(totalCount ?? 0),
  };
}

/**
 * Parse row ID from outbox entry.
 * Simple IDs are returned as-is, composite keys are parsed from JSON.
 *
 * @param rowId - Row ID string (simple or JSON-encoded composite)
 * @returns Parsed row ID (string or object)
 */
export function parseRowId(rowId: string): string | Record<string, unknown> {
  if (rowId.startsWith("{")) {
    try {
      return JSON.parse(rowId);
    } catch {
      // If parse fails, return as-is
      return rowId;
    }
  }
  return rowId;
}

/**
 * Clear completed/failed items older than a threshold
 * Useful for cleanup of the outbox table.
 *
 * @param db - SQLite database instance
 * @param olderThanMs - Clear items older than this many milliseconds
 */
export async function clearOldOutboxItems(
  db: SqliteDatabase,
  olderThanMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days default
): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  // Get failed items older than cutoff and delete them
  const failedItems = await db
    .select({ id: syncPushQueue.id })
    .from(syncPushQueue)
    .where(eq(syncPushQueue.status, "failed"));

  for (const item of failedItems) {
    // Check timestamp manually since Drizzle lt() can be tricky with strings
    const fullItem = await db
      .select()
      .from(syncPushQueue)
      .where(eq(syncPushQueue.id, item.id))
      .limit(1);
    if (fullItem[0] && fullItem[0].changedAt < cutoff) {
      await db.delete(syncPushQueue).where(eq(syncPushQueue.id, item.id));
    }
  }
}

/**
 * Clear ALL items from sync push queue
 *
 * Used at login to clear stale queue items from previous sessions.
 * The data will be synced down fresh from Supabase, so stale queue items
 * would cause errors when trying to upload outdated data.
 *
 * @param db - SQLite database instance
 */
export async function clearSyncOutbox(db: SqliteDatabase): Promise<void> {
  await db.delete(syncPushQueue);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleTable = SQLiteTableWithColumns<any>;

/**
 * Map from snake_case table name to Drizzle table object.
 * Only includes syncable tables (not sync_queue, sync_push_queue, or local-only tables).
 */
const TABLE_MAP: Record<string, AnyDrizzleTable> = {
  daily_practice_queue: localSchema.dailyPracticeQueue,
  genre: localSchema.genre,
  genre_tune_type: localSchema.genreTuneType,
  instrument: localSchema.instrument,
  note: localSchema.note,
  playlist: localSchema.playlist,
  playlist_tune: localSchema.playlistTune,
  practice_record: localSchema.practiceRecord,
  prefs_scheduling_options: localSchema.prefsSchedulingOptions,
  prefs_spaced_repetition: localSchema.prefsSpacedRepetition,
  reference: localSchema.reference,
  tab_group_main_state: localSchema.tabGroupMainState,
  table_state: localSchema.tableState,
  table_transient_data: localSchema.tableTransientData,
  tag: localSchema.tag,
  tune: localSchema.tune,
  tune_override: localSchema.tuneOverride,
  tune_type: localSchema.tuneType,
  user_profile: localSchema.userProfile,
};

/**
 * Get the Drizzle table object for a table name.
 *
 * @param tableName - Table name (snake_case)
 * @returns Drizzle table object or undefined if not found
 */
export function getDrizzleTable(
  tableName: string
): AnyDrizzleTable | undefined {
  return TABLE_MAP[tableName];
}

/**
 * Fetch a local row by primary key for sync operations.
 *
 * This is used when processing INSERT/UPDATE operations from the outbox.
 * The rowId from the outbox is parsed (simple or composite) and used
 * to fetch the current local row data.
 *
 * @param db - SQLite database instance
 * @param tableName - Table name (snake_case)
 * @param rowId - Row ID string (simple or JSON-encoded composite)
 * @returns The local row data (with column names as stored in DB) or null if not found
 */
export async function fetchLocalRowByPrimaryKey(
  db: SqliteDatabase,
  tableName: SyncableTableName,
  rowId: string
): Promise<Record<string, unknown> | null> {
  const table = getDrizzleTable(tableName);
  if (!table) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  const primaryKey = getPrimaryKey(tableName);
  const parsedRowId = parseRowId(rowId);

  // Fetch all rows from table and filter in memory.
  // This is simpler than trying to do dynamic column access in Drizzle.
  // For sync operations, tables are typically small enough for this approach.
  const rows = await db.select().from(table);

  if (typeof primaryKey === "string") {
    // Simple primary key
    const pkColumnCamel = toCamelCase(primaryKey);
    const pkValue =
      typeof parsedRowId === "string" ? parsedRowId : String(parsedRowId);

    const matchingRow = rows.find((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (row as any)[pkColumnCamel] === pkValue;
    });

    return matchingRow ?? null;
  } else {
    // Composite primary key
    if (typeof parsedRowId !== "object") {
      throw new Error(
        `Expected composite key object for table ${tableName}, got: ${rowId}`
      );
    }

    const matchingRow = rows.find((row) => {
      for (const keySnake of primaryKey) {
        const keyCamel = toCamelCase(keySnake);
        const expectedValue = parsedRowId[keySnake] ?? parsedRowId[keyCamel];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((row as any)[keyCamel] !== expectedValue) {
          return false;
        }
      }
      return true;
    });

    return matchingRow ?? null;
  }
}
