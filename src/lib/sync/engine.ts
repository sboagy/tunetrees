/**
 * Sync Engine - Bidirectional Sync Between Local SQLite and Supabase
 *
 * Implements offline-first sync architecture:
 * 1. Local changes → Sync Outbox → Worker → Supabase (push)
 * 2. Supabase changes → Worker → Local SQLite (pull)
 * 3. Conflict detection and resolution (last-write-wins)
 *
 * @module lib/sync/engine
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import * as localSchema from "../../../drizzle/schema-sqlite";
import type { SyncChange } from "../../../shared/sync-types";
import { getSqliteInstance, type SqliteDatabase } from "../db/client-sqlite";
import {
  enableSyncTriggers,
  suppressSyncTriggers,
} from "../db/install-triggers";
import { log } from "../logger";
import { getAdapter, type SyncableTableName } from "./adapters";
import { toCamelCase } from "./casing";
import {
  backfillPracticeRecordOutbox,
  fetchLocalRowByPrimaryKey,
  getOutboxStats,
  getPendingOutboxItems,
  markOutboxCompleted,
  type OutboxItem,
} from "./outbox";
import { WorkerClient } from "./worker-client";

// Debug flag for sync logging (set VITE_SYNC_DEBUG=true in .env to enable)
const SYNC_DEBUG = import.meta.env.VITE_SYNC_DEBUG === "true";
const syncLog = (...args: any[]) =>
  SYNC_DEBUG && log.debug("[SyncEngine]", ...args);

/** LocalStorage key prefix for persisting last sync timestamp across app restarts */
const LAST_SYNC_TIMESTAMP_KEY_PREFIX = "TT_LAST_SYNC_TIMESTAMP";

/**
 * Sync result for tracking what happened during sync
 */
export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  conflicts: number;
  errors: string[];
  timestamp: string;
  affectedTables: string[];
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  batchSize: number; // Max items per sync batch
  maxRetries: number; // Max retry attempts for failed items
  timeoutMs: number; // Network timeout in milliseconds
}

const DEFAULT_CONFIG: SyncConfig = {
  batchSize: 100,
  maxRetries: 3,
  timeoutMs: 30000, // 30 seconds
};

/**
 * Table dependency order for sync operations.
 * Parent tables (lower numbers) must be synced before child tables (higher numbers)
 * to avoid foreign key constraint violations.
 *
 * Order rationale:
 * - Reference data tables (genre, tune_type) come first (no dependencies)
 * - User profile comes next (referenced by many tables)
 * - Tunes before playlist_tune (FK: tune_ref)
 * - Playlists before playlist_tune, practice_record (FK: playlist_ref)
 * - playlist_tune before practice_record (implicit practice dependency)
 */
import {
  TABLE_SYNC_ORDER,
  TABLE_TO_SCHEMA_KEY,
} from "../../../shared/table-meta";

/**
 * Sort outbox items by table dependency order.
 * This ensures parent tables are synced before child tables to avoid FK violations.
 *
 * For INSERT operations: parent tables first (ascending order)
 * For DELETE operations: child tables first (descending order)
 *
 * @param items - Array of outbox items to sort
 * @returns Sorted array of outbox items
 */
function sortOutboxItemsByDependency(items: OutboxItem[]): OutboxItem[] {
  return [...items].sort((a, b) => {
    const orderA = TABLE_SYNC_ORDER[a.tableName] ?? 100;
    const orderB = TABLE_SYNC_ORDER[b.tableName] ?? 100;

    // For DELETE operations, reverse the order (children first)
    if (
      a.operation.toLowerCase() === "delete" &&
      b.operation.toLowerCase() === "delete"
    ) {
      return orderB - orderA;
    }

    // For INSERT/UPDATE, parent tables first
    if (
      a.operation.toLowerCase() !== "delete" &&
      b.operation.toLowerCase() !== "delete"
    ) {
      return orderA - orderB;
    }

    // Mixed operations: INSERT/UPDATE before DELETE
    if (a.operation.toLowerCase() === "delete") return 1;
    if (b.operation.toLowerCase() === "delete") return -1;

    return orderA - orderB;
  });
}

function sanitizeData(data: any) {
  const sanitized = { ...data };
  // Convert boolean to integer for SQLite
  for (const key in sanitized) {
    if (typeof sanitized[key] === "boolean") {
      sanitized[key] = sanitized[key] ? 1 : 0;
    }
  }
  return sanitized;
}

/**
 * Sync Engine Class
 *
 * Manages bidirectional sync between local SQLite and Supabase PostgreSQL
 * via Cloudflare Worker endpoint.
 *
 * @example
 * ```typescript
 * const engine = new SyncEngine(localDb, supabase, userId);
 *
 * // Bidirectional sync (push + pull)
 * const result = await engine.sync();
 * ```
 */
export class SyncEngine {
  private localDb: SqliteDatabase;
  private supabase: SupabaseClient;
  private config: SyncConfig;
  private lastSyncTimestamp: string | null = null;
  private userId: string;

  /** Get the user-specific localStorage key for sync timestamp */
  private get syncTimestampKey(): string {
    return `${LAST_SYNC_TIMESTAMP_KEY_PREFIX}_${this.userId}`;
  }

  constructor(
    localDb: SqliteDatabase,
    supabase: SupabaseClient,
    userId: string,
    config: Partial<SyncConfig> = {}
  ) {
    this.localDb = localDb;
    this.supabase = supabase;
    this.userId = userId;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Load persisted timestamp from localStorage (enables incremental sync after app restart)
    this.lastSyncTimestamp = localStorage.getItem(this.syncTimestampKey);
    if (this.lastSyncTimestamp) {
      log.info(
        `[SyncEngine] Loaded persisted lastSyncTimestamp for user ${userId}: ${this.lastSyncTimestamp}`
      );
    }
  }

  /**
   * Perform full bidirectional sync using Cloudflare Worker
   *
   * 1. Gather pending changes from sync_outbox
   * 2. Send to Worker (Push)
   * 3. Receive remote changes from Worker (Pull)
   * 4. Apply remote changes to local DB
   *
   * @returns Combined sync result
   */
  async sync(): Promise<SyncResult> {
    const startTime = new Date().toISOString();

    try {
      syncLog("[SyncEngine] Starting syncWithWorker...");
      return await this.syncWithWorker();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error("[SyncEngine] Sync failed:", errorMsg);

      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: 0,
        errors: [errorMsg],
        timestamp: startTime,
        affectedTables: [],
      };
    }
  }

  /**
   * Bidirectional sync with Cloudflare Worker
   */
  async syncWithWorker(options?: {
    allowDeletes?: boolean;
  }): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const errors: string[] = [];
    let synced = 0;
    let failed = 0;
    const affectedTablesSet = new Set<string>();

    const allowDeletes = options?.allowDeletes ?? true;

    try {
      // 1. Get Auth Token
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session");
      }
      const workerClient = new WorkerClient(session.access_token);

      // Safety: if triggers were suppressed during syncDown while the user wrote data,
      // those rows won't be in sync_push_queue and will never be pushed.
      // Backfill recent practice_record rows so they're uploaded.
      try {
        const since = new Date(
          Date.now() - 1000 * 60 * 60 * 24 * 30
        ).toISOString();
        const backfilled = await backfillPracticeRecordOutbox(
          this.localDb,
          since
        );
        if (backfilled > 0) {
          log.warn(
            `[SyncEngine] Backfilled ${backfilled} practice_record outbox entries (recent changes)`
          );
        }
      } catch (e) {
        // Never fail sync because of best-effort backfill.
        log.warn("[SyncEngine] practice_record outbox backfill failed", e);
      }

      // 2. Gather Pending Changes (Push)
      const pendingItems = await getPendingOutboxItems(
        this.localDb,
        this.config.batchSize
      );

      // Sort by dependency to ensure correct order (though worker handles transaction)
      const sortedItems = sortOutboxItemsByDependency(pendingItems);
      const changes: SyncChange[] = [];
      const outboxItemsToComplete: OutboxItem[] = [];

      for (const item of sortedItems) {
        const adapter = getAdapter(item.tableName as SyncableTableName);

        if (item.operation.toLowerCase() === "delete") {
          if (!allowDeletes) {
            // Safety mode: do not push DELETE operations.
            // Leave the outbox item pending so it can be reviewed and retried later.
            continue;
          }
          // For DELETE, parse rowId to get keys
          // rowId is snake_case JSON or string from trigger
          const parsedRowId = item.rowId.startsWith("{")
            ? JSON.parse(item.rowId)
            : {
                [Array.isArray(adapter.primaryKey)
                  ? adapter.primaryKey[0]
                  : adapter.primaryKey]: item.rowId,
              };

          // Convert snake_case keys to camelCase for Worker
          const camelKeys = adapter.toLocal(parsedRowId);

          changes.push({
            table: item.tableName as any,
            rowId: item.rowId,
            data: camelKeys,
            deleted: true,
            lastModifiedAt: item.changedAt, // Use changedAt from outbox
          });
          outboxItemsToComplete.push(item);
        } else {
          // INSERT/UPDATE
          const localRow = await fetchLocalRowByPrimaryKey(
            this.localDb,
            item.tableName as SyncableTableName,
            item.rowId
          );

          if (localRow) {
            // Send camelCase data directly
            changes.push({
              table: item.tableName as any,
              rowId: item.rowId,
              data: localRow,
              deleted: false,
              lastModifiedAt:
                (localRow as any).lastModifiedAt || item.changedAt,
            });
            outboxItemsToComplete.push(item);
          } else {
            log.warn(
              `[SyncEngine] Local row missing for ${item.tableName}:${item.rowId}`
            );
            // Mark as failed or skip? Skip for now.
            // Actually, if it's missing, we can't sync it.
            // Maybe mark as completed to clear the blockage?
            await markOutboxCompleted(this.localDb, item.id);
          }
        }
      }

      const applyRemoteChanges = async (remoteChanges: SyncChange[]) => {
        if (remoteChanges.length === 0) return;

        const sqliteInstance = await getSqliteInstance();
        if (!sqliteInstance) return;

        suppressSyncTriggers(sqliteInstance);
        try {
          // Sort changes by dependency to avoid FK violations
          const sortedChanges = [...remoteChanges].sort((a, b) => {
            const orderA = TABLE_SYNC_ORDER[a.table] ?? 100;
            const orderB = TABLE_SYNC_ORDER[b.table] ?? 100;
            return orderA - orderB;
          });

          for (const change of sortedChanges) {
            affectedTablesSet.add(change.table);
            const adapter = getAdapter(change.table as SyncableTableName);

            const schemaKey = TABLE_TO_SCHEMA_KEY[change.table] || change.table;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = (localSchema as any)[schemaKey];

            if (!table) {
              log.warn(
                `[SyncEngine] Table not found in local schema: ${change.table} (key: ${schemaKey})`
              );
              continue;
            }

            try {
              if (change.deleted) {
                // Delete local
                const pk = adapter.primaryKey;
                const localKeyData = adapter.toLocal(change.data);

                if (Array.isArray(pk)) {
                  const conditions = pk
                    .map((k) => {
                      const columnKey = toCamelCase(k);
                      const value = localKeyData[columnKey];
                      if (typeof value === "undefined") {
                        log.warn(
                          `[SyncEngine] Missing PK value for ${change.table}.${k} during delete`,
                          { rowId: change.rowId }
                        );
                        return null;
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      return eq((table as any)[columnKey], value);
                    })
                    .filter((c): c is ReturnType<typeof eq> => c !== null);

                  if (conditions.length !== pk.length) {
                    continue;
                  }
                  await this.localDb.delete(table).where(and(...conditions));
                } else {
                  const columnKey = toCamelCase(pk);
                  const value = localKeyData[columnKey];
                  if (typeof value === "undefined") {
                    log.warn(
                      `[SyncEngine] Missing PK value for ${change.table}.${pk} during delete`,
                      { rowId: change.rowId }
                    );
                    continue;
                  }
                  await this.localDb
                    .delete(table)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .where(eq((table as any)[columnKey], value));
                }
              } else {
                // Upsert local
                const sanitizedData = sanitizeData(change.data);

                if (change.table === "practice_record") {
                  // practice_record has two distinct uniqueness constraints:
                  // - PK: id
                  // - Unique: (tune_ref, playlist_ref, practiced)
                  // During initial sync with a retained IndexedDB, either may collide.
                  // Strategy:
                  // 1) Upsert by id (handles retained rows with same id)
                  // 2) If that fails due to the composite unique constraint, upsert by the composite key
                  try {
                    await this.localDb
                      .insert(table)
                      .values(sanitizedData)
                      .onConflictDoUpdate({
                        target: (table as any).id,
                        set: sanitizedData,
                      });
                  } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    const isCompositeUniqueViolation =
                      errorMsg.includes(
                        "practice_record.tune_ref, practice_record.playlist_ref, practice_record.practiced"
                      ) ||
                      errorMsg.includes(
                        "practice_record_tune_ref_playlist_ref_practiced_unique"
                      );

                    if (!isCompositeUniqueViolation) {
                      throw e;
                    }

                    const { id: _ignoredId, ...sanitizedDataWithoutId } =
                      sanitizedData as Record<string, unknown>;

                    await this.localDb
                      .insert(table)
                      .values(sanitizedData)
                      .onConflictDoUpdate({
                        target: [
                          (table as any).tuneRef,
                          (table as any).playlistRef,
                          (table as any).practiced,
                        ],
                        set: sanitizedDataWithoutId,
                      });
                  }
                } else {
                  const conflictTarget = Array.isArray(adapter.primaryKey)
                    ? adapter.primaryKey.map(
                        (k) => (table as any)[toCamelCase(k)]
                      )
                    : (table as any)[toCamelCase(adapter.primaryKey as string)];

                  // Some tables have a natural composite unique key (adapter.conflictKeys)
                  // in addition to a synthetic PK (id). If we only upsert by id, an insert
                  // can fail on the composite unique constraint when the same logical row
                  // exists locally with a different id (e.g. retained IndexedDB + initial sync).
                  // Strategy:
                  // 1) Upsert by primary key (current behavior)
                  // 2) If that fails due to the composite unique constraint, upsert by the
                  //    composite key without ever updating `id`.
                  const compositeKeys = adapter.conflictKeys;
                  const isSingleIdPk =
                    !Array.isArray(adapter.primaryKey) &&
                    adapter.primaryKey === "id";

                  if (isSingleIdPk && compositeKeys) {
                    try {
                      await this.localDb
                        .insert(table)
                        .values(sanitizedData)
                        .onConflictDoUpdate({
                          target: conflictTarget,
                          set: sanitizedData,
                        });
                    } catch (e) {
                      const errorMsg =
                        e instanceof Error ? e.message : String(e);
                      const isCompositeUniqueViolation =
                        errorMsg.includes("UNIQUE constraint failed:") &&
                        compositeKeys.every((k) =>
                          errorMsg.includes(`${change.table}.${k}`)
                        );

                      if (!isCompositeUniqueViolation) {
                        throw e;
                      }

                      const { id: _ignoredId, ...sanitizedDataWithoutId } =
                        sanitizedData as Record<string, unknown>;

                      await this.localDb
                        .insert(table)
                        .values(sanitizedData)
                        .onConflictDoUpdate({
                          target: compositeKeys.map(
                            (k) => (table as any)[toCamelCase(k)]
                          ),
                          set: sanitizedDataWithoutId,
                        });
                    }
                  } else {
                    await this.localDb
                      .insert(table)
                      .values(sanitizedData)
                      .onConflictDoUpdate({
                        target: conflictTarget,
                        set: sanitizedData,
                      });
                  }
                }
              }
              synced++;
            } catch (e) {
              failed++;
              const errorMsg = e instanceof Error ? e.message : "Unknown error";
              errors.push(`${change.table}:${change.rowId}: ${errorMsg}`);
              log.error(
                `[SyncEngine] Failed to apply change to ${change.table} rowId=${change.rowId}:`,
                e
              );
              // Continue applying other tables so core UI data isn't blocked
            }
          }
        } finally {
          enableSyncTriggers(sqliteInstance);
        }
      };

      const isInitialSync = !this.lastSyncTimestamp;
      let pullCursor: string | undefined;
      let syncStartedAt: string | undefined;

      // 3. Call Worker (Push + first Pull page)
      const firstResponse = await workerClient.sync(
        changes,
        this.lastSyncTimestamp || undefined,
        {
          pageSize: 200,
        }
      );

      if (SYNC_DEBUG && firstResponse.debug) {
        syncLog("Worker Debug Logs:", JSON.stringify(firstResponse.debug));
      }
      if (SYNC_DEBUG) {
        const tableCounts: Record<string, number> = {};
        for (const change of firstResponse.changes) {
          tableCounts[change.table] = (tableCounts[change.table] || 0) + 1;
        }
        syncLog("Received changes:", tableCounts);
        syncLog("Total change count:", firstResponse.changes.length);
      }

      pullCursor = firstResponse.nextCursor;
      syncStartedAt = firstResponse.syncStartedAt;

      // 4. Apply first page of remote changes
      await applyRemoteChanges(firstResponse.changes);

      // 5. Cleanup Outbox (only once, after push has been accepted)
      // IMPORTANT: Only clear items we actually pushed (or explicitly pruned).
      // If deletes are disallowed, leave those outbox entries pending.
      for (const item of outboxItemsToComplete) {
        await markOutboxCompleted(this.localDb, item.id);
      }

      // 6. If initial sync is paginated, pull remaining pages (no push)
      if (isInitialSync && pullCursor) {
        while (pullCursor) {
          const pageResponse = await workerClient.sync([], undefined, {
            pullCursor,
            syncStartedAt,
            pageSize: 200,
          });

          pullCursor = pageResponse.nextCursor;
          syncStartedAt = pageResponse.syncStartedAt ?? syncStartedAt;

          await applyRemoteChanges(pageResponse.changes);
        }
      }

      // 7. Update Timestamp (persists to localStorage for incremental sync after restart)
      // Only advance the watermark if we successfully applied all remote changes.
      if (failed === 0) {
        if (isInitialSync) {
          // Prefer the stable initial watermark provided by the worker.
          if (syncStartedAt) {
            this.setLastSyncTimestamp(syncStartedAt);
          } else if (firstResponse.syncedAt) {
            this.setLastSyncTimestamp(firstResponse.syncedAt);
          }
        } else if (firstResponse.syncedAt) {
          this.setLastSyncTimestamp(firstResponse.syncedAt);
        }
      }

      return {
        success: failed === 0,
        itemsSynced: synced,
        itemsFailed: failed,
        conflicts: 0,
        errors,
        timestamp: startTime,
        affectedTables: Array.from(affectedTablesSet),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Only log as error if it's not a network connectivity issue (expected when offline)
      const isNetworkError =
        errorMsg.includes("Failed to fetch") ||
        errorMsg.includes("ERR_INTERNET_DISCONNECTED") ||
        errorMsg.includes("NetworkError");
      if (!isNetworkError) {
        log.error("[SyncEngine] syncWithWorker failed:", errorMsg);
      }
      errors.push(errorMsg);
      return {
        success: false,
        itemsSynced: synced,
        itemsFailed: failed,
        conflicts: 0,
        errors,
        timestamp: startTime,
        affectedTables: Array.from(affectedTablesSet),
      };
    }
  }

  /**
   * Alias for sync() - kept for API compatibility with SyncService.
   */
  async syncUpFromOutbox(options?: {
    allowDeletes?: boolean;
  }): Promise<SyncResult> {
    return this.syncWithWorker(options);
  }

  /**
   * Alias for sync() - kept for API compatibility with SyncService.
   */
  async syncDown(): Promise<SyncResult> {
    return this.syncWithWorker();
  }

  /**
   * Alias for sync() - partial table sync not supported, performs full sync.
   */
  async syncDownTables(_tables: string[]): Promise<SyncResult> {
    return this.syncWithWorker();
  }

  /**
   * Get outbox statistics (trigger-populated sync_outbox table)
   *
   * @returns Promise with pending, inProgress, failed, and total counts
   */
  async getOutboxStats(): Promise<{
    pending: number;
    inProgress: number;
    failed: number;
    total: number;
  }> {
    if (!this.localDb) {
      // Return empty stats if db not initialized
      return { pending: 0, inProgress: 0, failed: 0, total: 0 };
    }
    return await getOutboxStats(this.localDb);
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTimestamp(): string | null {
    return this.lastSyncTimestamp;
  }

  /**
   * Set last sync timestamp (used when resuming sync after restart)
   * Persists to localStorage for incremental sync after app restart.
   */
  setLastSyncTimestamp(timestamp: string): void {
    this.lastSyncTimestamp = timestamp;
    localStorage.setItem(this.syncTimestampKey, timestamp);
  }

  /**
   * Clear last sync timestamp to force next sync to run in full mode.
   * Also clears persisted value from localStorage.
   */
  clearLastSyncTimestamp(): void {
    this.lastSyncTimestamp = null;
    localStorage.removeItem(this.syncTimestampKey);
  }

  /**
   * Check if last sync was incremental (had a timestamp) or full (no timestamp).
   */
  wasLastSyncIncremental(): boolean {
    return this.lastSyncTimestamp !== null;
  }
}

/**
 * Create a sync engine instance
 *
 * @param localDb - Local SQLite database
 * @param supabase - Supabase client
 * @param userId - Current user ID
 * @param config - Optional sync configuration
 * @returns SyncEngine instance
 */
export function createSyncEngine(
  localDb: SqliteDatabase,
  supabase: SupabaseClient,
  userId: string,
  config?: Partial<SyncConfig>
): SyncEngine {
  return new SyncEngine(localDb, supabase, userId, config);
}
