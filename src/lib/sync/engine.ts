/**
 * Sync Engine - Bidirectional Sync Between Local SQLite and Supabase
 *
 * Implements offline-first sync architecture:
 * 1. Local changes → Sync Queue → Supabase (syncUp)
 * 2. Supabase changes → Local SQLite (syncDown)
 * 3. Conflict detection and resolution (last-write-wins)
 *
 * @module lib/sync/engine
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { toast } from "solid-sonner";
import * as localSchema from "../../../drizzle/schema-sqlite";
import type { SyncChange } from "../../../shared/sync-types";
import { getSqliteInstance, type SqliteDatabase } from "../db/client-sqlite";
import {
  enableSyncTriggers,
  suppressSyncTriggers,
} from "../db/install-triggers";
import type { SyncQueueItem } from "../db/types";
import { log } from "../logger";
import { getAdapter, type SyncableTableName } from "./adapters";
import {
  fetchLocalRowByPrimaryKey,
  getOutboxStats,
  getPendingOutboxItems,
  markOutboxCompleted,
  type OutboxItem,
} from "./outbox";
import {
  getPendingSyncItems,
  getSyncQueueStats,
  markSynced,
  type SyncableTable,
  updateSyncStatus,
} from "./queue";
import { WorkerClient } from "./worker-client";

// Debug flag for sync logging (set VITE_SYNC_DEBUG=true in .env to enable)
const SYNC_DEBUG = import.meta.env.VITE_SYNC_DEBUG === "true";
const syncLog = (...args: any[]) =>
  SYNC_DEBUG && log.debug("[SyncEngine]", ...args);

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
const TABLE_SYNC_ORDER: Record<string, number> = {
  // Reference data (no dependencies)
  genre: 1,
  tune_type: 2,
  genre_tune_type: 3,
  instrument: 4,

  // User data (base tables)
  user_profile: 10,
  prefs_scheduling_options: 11,
  prefs_spaced_repetition: 12,
  tab_group_main_state: 13,
  table_state: 14,

  // Core data
  tune: 20,
  playlist: 21,
  tag: 22,
  note: 23,
  reference: 24,
  user_annotation: 25,
  tune_override: 26,

  // Junction/dependent tables (must come after their referenced tables)
  playlist_tune: 30,
  repertoire: 31,
  table_transient_data: 32,

  // Practice data (depends on tune, playlist, playlist_tune)
  daily_practice_queue: 40,
  practice_record: 41,
};

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

/**
 * Sync Engine Class
 *
 * Manages bidirectional sync between local SQLite and Supabase PostgreSQL.
 *
 * @example
 * ```typescript
 * const engine = new SyncEngine(localDb, userId);
 *
 * // Push local changes to Supabase
 * const upResult = await engine.syncUp();
 *
 * // Pull remote changes to local
 * const downResult = await engine.syncDown();
 *
 * // Full bidirectional sync
 * const result = await engine.sync();
 * ```
 */
export class SyncEngine {
  private localDb: SqliteDatabase;
  private supabase: SupabaseClient;
  private config: SyncConfig;
  private lastSyncTimestamp: string | null = null;
  private lastSyncWasIncremental: boolean = false;

  constructor(
    localDb: SqliteDatabase,
    supabase: SupabaseClient,
    _userId: string,
    config: Partial<SyncConfig> = {}
  ) {
    this.localDb = localDb;
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
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
      };
    }
  }

  /**
   * Bidirectional sync with Cloudflare Worker
   */
  async syncWithWorker(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const errors: string[] = [];
    let synced = 0;

    try {
      // 1. Get Auth Token
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session");
      }
      const workerClient = new WorkerClient(session.access_token);

      // 2. Gather Pending Changes (Push)
      const pendingItems = await getPendingOutboxItems(
        this.localDb,
        this.config.batchSize
      );

      // Sort by dependency to ensure correct order (though worker handles transaction)
      const sortedItems = sortOutboxItemsByDependency(pendingItems);
      const changes: SyncChange[] = [];

      for (const item of sortedItems) {
        const adapter = getAdapter(item.tableName as SyncableTableName);

        if (item.operation.toLowerCase() === "delete") {
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

      // 3. Call Worker
      const response = await workerClient.sync(
        changes,
        this.lastSyncTimestamp || undefined
      );

      // 4. Apply Remote Changes (Pull)
      if (response.changes.length > 0) {
        const sqliteInstance = await getSqliteInstance();
        if (sqliteInstance) {
          suppressSyncTriggers(sqliteInstance);

          for (const change of response.changes) {
            const adapter = getAdapter(change.table as SyncableTableName);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const table = (localSchema as any)[change.table];

            if (change.deleted) {
              // Delete local
              const pk = adapter.primaryKey;

              if (Array.isArray(pk)) {
                const conditions = pk.map((k) =>
                  eq((table as any)[k], change.data[k])
                );
                await this.localDb.delete(table).where(and(...conditions));
              } else {
                await this.localDb
                  .delete(table)
                  .where(eq((table as any)[pk], change.data[pk]));
              }
            } else {
              // Upsert local
              await this.localDb
                .insert(table)
                .values(change.data)
                .onConflictDoUpdate({
                  target: Array.isArray(adapter.primaryKey)
                    ? adapter.primaryKey.map((k) => (table as any)[k])
                    : (table as any)[adapter.primaryKey],
                  set: change.data,
                });
            }
            synced++;
          }

          enableSyncTriggers(sqliteInstance);
        }
      }

      // 5. Cleanup Outbox
      for (const item of sortedItems) {
        await markOutboxCompleted(this.localDb, item.id);
      }

      // 6. Update Timestamp
      if (response.syncedAt) {
        this.lastSyncTimestamp = response.syncedAt;
      }

      return {
        success: true,
        itemsSynced: synced,
        itemsFailed: 0,
        conflicts: 0,
        errors,
        timestamp: startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error("[SyncEngine] syncWithWorker failed:", errorMsg);
      errors.push(errorMsg);
      return {
        success: false,
        itemsSynced: synced,
        itemsFailed: 0,
        conflicts: 0,
        errors,
        timestamp: startTime,
      };
    }
  }

  /**
   * Push local changes to Supabase (Upload)
   *
   * Processes sync queue and uploads pending changes to remote database.
   *
   * @returns Sync result
   */
  async syncUp(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const errors: string[] = [];
    let synced = 0;
    let failed = 0;

    try {
      // Get pending sync items in batches
      const pendingItems = await getPendingSyncItems(
        this.localDb,
        this.config.batchSize
      );

      if (pendingItems.length === 0) {
        syncLog("[SyncEngine] No pending items to sync");
        return {
          success: true,
          itemsSynced: 0,
          itemsFailed: 0,
          conflicts: 0,
          errors: [],
          timestamp: startTime,
        };
      }

      log.info(`[SyncEngine] Processing ${pendingItems.length} pending items`);

      // Process each item
      for (const item of pendingItems) {
        try {
          await this.processQueueItem(item);
          await markSynced(this.localDb, item.id!);
          synced++;
        } catch (error) {
          // Properly extract error message from Supabase errors
          let errorMsg: string;
          if (error instanceof Error) {
            errorMsg = error.message;
          } else if (error && typeof error === "object" && "message" in error) {
            errorMsg = String(error.message);
          } else {
            errorMsg = JSON.stringify(error);
          }

          log.error(
            `[SyncEngine] Failed to sync item ${item.id} (${item.tableName} ${item.operation}):`,
            errorMsg,
            "\nItem data:",
            item.data
          );

          // Update item status based on retry count
          if (item.attempts >= this.config.maxRetries) {
            await updateSyncStatus(this.localDb, item.id!, "failed", errorMsg);
            failed++;
            errors.push(`Item ${item.id} (${item.tableName}): ${errorMsg}`);

            // Show persistent toast for permanently failed items
            toast.error(
              `Sync failed permanently: ${item.tableName} (${item.operation})\n${errorMsg}`,
              {
                duration: Number.POSITIVE_INFINITY,
              }
            );
          } else {
            // Mark for retry
            await updateSyncStatus(this.localDb, item.id!, "pending", errorMsg);
          }
        }
      }

      return {
        success: failed === 0,
        itemsSynced: synced,
        itemsFailed: failed,
        conflicts: 0,
        errors,
        timestamp: startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error("[SyncEngine] syncUp failed:", errorMsg);
      errors.push(errorMsg);

      return {
        success: false,
        itemsSynced: synced,
        itemsFailed: failed,
        conflicts: 0,
        errors,
        timestamp: startTime,
      };
    }
  }

  /**
   * Push local changes to Supabase (Upload)
   *
   * DEPRECATED: Use sync() instead.
   * This method now delegates to syncWithWorker() which performs a full bidirectional sync.
   */
  async syncUpFromOutbox(): Promise<SyncResult> {
    return this.syncWithWorker();
  }

  /**
   * Pull remote changes from Supabase (Download)
   *
   * DEPRECATED: Use sync() instead.
   * This method now delegates to syncWithWorker() which performs a full bidirectional sync.
   */
  async syncDown(): Promise<SyncResult> {
    return this.syncWithWorker();
  }

  /**
   * Pull remote changes for a specific subset of tables.
   *
   * DEPRECATED: Use sync() instead.
   * The worker endpoint does not support partial syncs yet.
   * This method now delegates to syncWithWorker() which performs a full bidirectional sync.
   */
  async syncDownTables(_tables: SyncableTable[]): Promise<SyncResult> {
    console.warn(
      "[SyncEngine] syncDownTables is deprecated. Performing full sync."
    );
    return this.syncWithWorker();
  }

  /**
   * Process a single queue item (INSERT, UPDATE, or DELETE)
   *
   * @param item - Sync queue item to process
   */
  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    const { tableName, operation, data } = item;

    log.info(`[SyncEngine] Processing ${operation} on ${tableName}`);

    // Parse data (required for all operations now)
    if (!data) {
      throw new Error(`${operation} operation requires data field`);
    }
    const recordData = JSON.parse(data);

    // Get adapter for this table - provides transform and conflict key info
    const adapter = getAdapter(tableName as SyncableTableName);
    const compositeKeys = adapter.conflictKeys;
    const pkColumn = Array.isArray(adapter.primaryKey)
      ? adapter.primaryKey[0] // For composite PKs, use first key for error messages
      : adapter.primaryKey;

    switch (operation) {
      case "insert": {
        if (!recordData) {
          throw new Error("INSERT operation requires data");
        }
        // Transform camelCase (local) → snake_case (Supabase)
        const remoteData = adapter.toRemote(recordData);

        if (compositeKeys) {
          // Table has unique constraints - use UPSERT to avoid duplicate key errors
          const { error } = await this.supabase
            .from(tableName)
            .upsert(remoteData, {
              onConflict: compositeKeys.join(","),
            });
          if (error) throw error;
        } else {
          // Standard insert for tables without unique constraints
          const { error } = await this.supabase
            .from(tableName)
            .insert(remoteData);
          if (error) throw error;
        }
        break;
      }

      case "update": {
        // Transform camelCase (local) → snake_case (Supabase)
        const remoteData = adapter.toRemote(recordData);

        if (compositeKeys) {
          // ALWAYS use UPSERT for composite key tables.
          // Reason: We frequently queue 'update' after local insert. A pure UPDATE would be a no-op remotely if row doesn't exist yet.
          // Using UPSERT guarantees creation (insert) or update without duplicate errors.
          const { error } = await this.supabase
            .from(tableName)
            .upsert(remoteData, {
              onConflict: compositeKeys.join(","),
            });
          if (error) throw error;
        } else {
          // Standard single PK update path
          if (!remoteData[pkColumn]) {
            throw new Error(
              `UPDATE operation requires ${pkColumn} in data for table ${tableName}`
            );
          }
          const { error } = await this.supabase
            .from(tableName)
            .upsert(remoteData, {
              onConflict: pkColumn,
            });
          if (error) throw error;
        }
        break;
      }

      case "delete": {
        const remoteData = adapter.toRemote(recordData);

        if (compositeKeys) {
          // If composite key fields are present, delete by composite key.
          // If only an id is provided (legacy queue), fallback to deleting by id.
          const hasAllComposite = compositeKeys.every(
            (k) => remoteData[k] !== undefined && remoteData[k] !== null
          );
          if (hasAllComposite) {
            let query = this.supabase.from(tableName).delete();
            for (const keyField of compositeKeys) {
              query = query.eq(keyField, remoteData[keyField]);
            }
            const { error } = await query;
            if (error) throw error;
          } else if (remoteData[pkColumn]) {
            const { error } = await this.supabase
              .from(tableName)
              .delete()
              .eq(pkColumn, remoteData[pkColumn]);
            if (error) throw error;
          } else {
            throw new Error(
              `DELETE operation requires either composite keys (${compositeKeys.join(",")}) or ${pkColumn} for table ${tableName}`
            );
          }
        } else {
          // Soft delete path replaced with hard delete for simplicity until server implements deleted flag semantics
          if (!remoteData[pkColumn]) {
            throw new Error(
              `DELETE operation requires ${pkColumn} in data for table ${tableName}`
            );
          }
          const { error } = await this.supabase
            .from(tableName)
            .delete()
            .eq(pkColumn, String(remoteData[pkColumn]));
          if (error) throw error;
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Sync a single table from Supabase to local
   *
   * @param tableName - Name of table to sync
   * @returns Number of records synced
   */
  /**
   * Get sync queue statistics
   *
   * @returns Promise with pending, syncing, failed, and total counts
   */
  async getSyncQueueStats(): Promise<{
    pending: number;
    syncing: number;
    failed: number;
    total: number;
  }> {
    if (!this.localDb) {
      // Return empty stats if db not initialized
      return { pending: 0, syncing: 0, failed: 0, total: 0 };
    }
    return await getSyncQueueStats(this.localDb);
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
   */
  setLastSyncTimestamp(timestamp: string): void {
    this.lastSyncTimestamp = timestamp;
  }

  /**
   * Clear last sync timestamp to force next syncDown to run in full mode.
   */
  clearLastSyncTimestamp(): void {
    this.lastSyncTimestamp = null;
  }

  /** Was the most recent syncDown run incremental (true) or full (false)? */
  wasLastSyncIncremental(): boolean {
    return this.lastSyncWasIncremental;
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
