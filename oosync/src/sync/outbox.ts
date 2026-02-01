/**
 * Sync Push Queue Operations
 *
 * Handles reading and updating the trigger-populated sync_push_queue table.
 * This is the client-side queue of changes to push to the server.
 * Note: Different from the server's sync_change_log which is stateless.
 *
 * @module lib/sync/outbox
 */

import { getPrimaryKey } from "../shared/table-meta";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { toCamelCase } from "./casing";
import {
  getSyncRuntime,
  type SqliteDatabase,
  type SyncPushQueueTable,
  type SyncableTableName,
} from "./runtime-context";

function getRuntime() {
  const runtime = getSyncRuntime();
  const { schema, syncPushQueue, localSchema } = runtime;
  const { tableToSchemaKey } = schema;
  return {
    runtime,
    schema,
    tableRegistry: schema.tableRegistry,
    syncPushQueue,
    localSchema,
    tableToSchemaKey,
  } as const;
}

function getSyncPushQueueTable(): SyncPushQueueTable {
  return getRuntime().syncPushQueue;
}

function getDrizzleTableFromSchema(
  tableName: string
): AnySQLiteTable | undefined {
  const { localSchema, tableToSchemaKey } = getRuntime();
  const schemaKey = tableToSchemaKey[tableName];
  if (!schemaKey) return undefined;
  return (localSchema as Record<string, AnySQLiteTable>)[schemaKey];
}

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
  const queue = getSyncPushQueueTable();
  const items = await db
    .select()
    .from(queue)
    .where(eq(queue.status, "pending"))
    .orderBy(asc(queue.changedAt))
    .limit(limit);

  return items as OutboxItem[];
}

function isSyncableTableName(value: string): value is SyncableTableName {
  const { tableRegistry } = getRuntime();
  return value in tableRegistry;
}

function buildCompositeRowId(
  primaryKey: string[],
  row: Record<string, unknown>
): string {
  const obj: Record<string, unknown> = {};
  for (const key of primaryKey) {
    obj[key] = row[key];
  }
  return JSON.stringify(obj);
}

/**
 * Backfill outbox entries for rows that may have been written while triggers were suppressed.
 *
 * Why this exists:
 * During syncDown, the engine suppresses triggers to prevent remote changes from
 * re-entering the outbox. If the user writes local data during that window, those
 * writes won't be captured by triggers and will never be pushed.
 *
 * This must remain generic (no per-table hacks).
 */
export async function backfillOutboxForTable(
  db: SqliteDatabase,
  tableName: SyncableTableName,
  sinceIso: string,
  deviceId?: string
): Promise<number> {
  const { tableRegistry } = getRuntime();
  const queue = getSyncPushQueueTable();
  const meta = tableRegistry[tableName];
  if (!meta?.supportsIncremental) {
    return 0;
  }

  const lastModifiedCol = "last_modified_at";
  if (!meta.timestamps.includes(lastModifiedCol)) {
    return 0;
  }

  const primaryKey = getPrimaryKey(tableRegistry, tableName);
  const pkCols = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  const selectCols = pkCols.map((c) => `"${c}"`).join(", ");

  // NOTE: Avoid drizzle tagged-template `sql\`...\`` here.
  // The typescript SQL tagged-template plugin does not understand `sql.raw(...)`
  // and treats interpolations as `$1/$2/...` params, which makes `FROM $2` invalid.
  // This query only uses vetted identifiers (SyncableTableName + known column) and
  // a guarded ISO timestamp.
  if (sinceIso.includes("'")) {
    throw new Error("Invalid sinceIso: unexpected quote");
  }

  if (deviceId?.includes("'")) {
    throw new Error("Invalid deviceId: unexpected quote");
  }

  // When applying remote changes during syncDown, we suppress triggers. Any rows written in
  // that window will have their remote device_id (or null). We only want to backfill rows
  // written by THIS device while triggers were suppressed (e.g., user edits).
  const deviceClause = deviceId ? ` AND "device_id" = '${deviceId}'` : "";

  const query = sql.raw(
    `SELECT ${selectCols} FROM "${tableName}" WHERE "${lastModifiedCol}" >= '${sinceIso}'${deviceClause}`
  );

  const rows = (await db.all(query)) as Array<Record<string, unknown>>;
  if (rows.length === 0) return 0;

  const rowIds = rows
    .map((row) => {
      if (Array.isArray(primaryKey)) {
        return buildCompositeRowId([...primaryKey], row);
      }
      if (typeof primaryKey === "string") {
        const value = row[primaryKey];
        return typeof value === "undefined" || value === null
          ? ""
          : String(value);
      }
      return "";
    })
    .filter((id) => id.length > 0);

  if (rowIds.length === 0) return 0;

  const existing = await db
    .select({ rowId: queue.rowId })
    .from(queue)
    .where(and(eq(queue.tableName, tableName), inArray(queue.rowId, rowIds)));

  const existingIds = new Set(existing.map((e) => e.rowId));
  const missingIds = rowIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return 0;

  const nowIso = new Date().toISOString();
  await db.insert(queue).values(
    missingIds.map((rowId) => ({
      id: randomHexId(),
      tableName,
      rowId,
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

export async function backfillOutboxSince(
  db: SqliteDatabase,
  sinceIso: string,
  tableNames?: string[],
  deviceId?: string
): Promise<number> {
  const { tableRegistry } = getRuntime();
  const targets: SyncableTableName[] = (
    tableNames ?? Object.keys(tableRegistry)
  )
    .filter(isSyncableTableName)
    .filter((t) => tableRegistry[t]?.supportsIncremental);

  let total = 0;
  for (const tableName of targets) {
    total += await backfillOutboxForTable(db, tableName, sinceIso, deviceId);
  }
  return total;
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
  const queue = getSyncPushQueueTable();
  await db.update(queue).set({ status: "in_progress" }).where(eq(queue.id, id));
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
  const queue = getSyncPushQueueTable();
  await db.delete(queue).where(eq(queue.id, id));
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
  const queue = getSyncPushQueueTable();
  await db
    .update(queue)
    .set({
      status: "pending", // Back to pending for retry
      attempts: currentAttempts + 1,
      lastError: errorMessage,
    })
    .where(eq(queue.id, id));
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
  const queue = getSyncPushQueueTable();
  await db
    .update(queue)
    .set({
      status: "failed",
      lastError: errorMessage,
      syncedAt: new Date().toISOString(),
    })
    .where(eq(queue.id, id));
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
  const queue = getSyncPushQueueTable();
  const items = await db
    .select()
    .from(queue)
    .where(eq(queue.status, "failed"))
    .orderBy(desc(queue.changedAt))
    .limit(limit);

  return items as OutboxItem[];
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
  const queue = getSyncPushQueueTable();
  await db
    .update(queue)
    .set({
      status: "pending",
      lastError: null,
    })
    .where(eq(queue.id, id));
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
  const pendingRows = await db.all(sql`
    SELECT COUNT(*) AS n
    FROM sync_push_queue
    WHERE status = 'pending'
  `);

  const inProgressRows = await db.all(sql`
    SELECT COUNT(*) AS n
    FROM sync_push_queue
    WHERE status = 'in_progress'
  `);

  const failedRows = await db.all(sql`
    SELECT COUNT(*) AS n
    FROM sync_push_queue
    WHERE status = 'failed'
  `);

  const totalRows = await db.all(sql`
    SELECT COUNT(*) AS n
    FROM sync_push_queue
  `);

  const pending = Number((pendingRows as Array<{ n: unknown }>)[0]?.n ?? 0);
  const inProgress = Number(
    (inProgressRows as Array<{ n: unknown }>)[0]?.n ?? 0
  );
  const failed = Number((failedRows as Array<{ n: unknown }>)[0]?.n ?? 0);
  const total = Number((totalRows as Array<{ n: unknown }>)[0]?.n ?? 0);

  return { pending, inProgress, failed, total };
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
  const queue = getSyncPushQueueTable();
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  // Get failed items older than cutoff and delete them
  const failedItems = await db
    .select({ id: queue.id })
    .from(queue)
    .where(eq(queue.status, "failed"));

  for (const item of failedItems) {
    // Check timestamp manually since Drizzle lt() can be tricky with strings
    const fullItem = await db
      .select()
      .from(queue)
      .where(eq(queue.id, item.id))
      .limit(1);
    if (fullItem[0] && fullItem[0].changedAt < cutoff) {
      await db.delete(queue).where(eq(queue.id, item.id));
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
  const queue = getSyncPushQueueTable();
  await db.delete(queue);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleTable = AnySQLiteTable;

/**
 * Get the Drizzle table object for a table name.
 *
 * @param tableName - Table name (snake_case)
 * @returns Drizzle table object or undefined if not found
 */
export function getDrizzleTable(
  tableName: string
): AnyDrizzleTable | undefined {
  return getDrizzleTableFromSchema(tableName);
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

  const { tableRegistry } = getRuntime();
  const primaryKey = getPrimaryKey(tableRegistry, tableName);
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
