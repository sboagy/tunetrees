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
import type { SqliteDatabase } from "../db/client-sqlite";
import type { SyncQueueItem } from "../db/types";
import { log } from "../logger";
import { getAdapter, type SyncableTableName } from "./adapters";
import {
  getPendingSyncItems,
  getSyncQueueStats,
  markSynced,
  type SyncableTable,
  updateSyncStatus,
} from "./queue";

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
  // Supabase Auth user id (UUID string)
  private userId: string;
  private config: SyncConfig;
  private lastSyncTimestamp: string | null = null;
  private lastSyncWasIncremental: boolean = false;

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
  }

  /**
   * Perform full bidirectional sync
   *
   * 1. Push local changes to Supabase (syncUp)
   * 2. Pull remote changes to local (syncDown)
   *
   * @returns Combined sync result
   */
  async sync(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const errors: string[] = [];
    let totalSynced = 0;
    let totalFailed = 0;
    let totalConflicts = 0;

    try {
      // Step 1: Push local changes to Supabase
      syncLog("[SyncEngine] Starting syncUp...");
      const upResult = await this.syncUp();
      totalSynced += upResult.itemsSynced;
      totalFailed += upResult.itemsFailed;
      errors.push(...upResult.errors);

      // Step 2: Pull remote changes to local
      syncLog("[SyncEngine] Starting syncDown...");
      const downResult = await this.syncDown();
      totalSynced += downResult.itemsSynced;
      totalConflicts += downResult.conflicts;
      errors.push(...downResult.errors);

      return {
        success: totalFailed === 0 && errors.length === 0,
        itemsSynced: totalSynced,
        itemsFailed: totalFailed,
        conflicts: totalConflicts,
        errors,
        timestamp: startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error("[SyncEngine] Sync failed:", errorMsg);
      errors.push(errorMsg);

      return {
        success: false,
        itemsSynced: totalSynced,
        itemsFailed: totalFailed,
        conflicts: totalConflicts,
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
   * Pull remote changes from Supabase (Download)
   *
   * Queries Supabase for records modified since last sync and merges into local DB.
   *
   * @returns Sync result
   */
  async syncDown(): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    // Capture previous successful sync timestamp for incremental filtering.
    // We only apply incremental filtering for tables supporting 'last_modified_at'
    // when we have a prior completed sync timestamp.
    const previousSyncTimestamp = this.lastSyncTimestamp;
    // Determine overall mode (full vs incremental) for this run
    this.lastSyncWasIncremental = !!previousSyncTimestamp; // If we had a previous timestamp, attempt incremental
    const errors: string[] = [];
    let synced = 0;
    const conflicts = 0; // TODO: Implement conflict detection

    // Offline pre-check: if browser reports offline, skip remote fetch attempts entirely.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.warn("[SyncEngine] Skipping syncDown: browser offline");
      return {
        success: true,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts,
        errors: ["offline"],
        timestamp: startTime,
      };
    }

    try {
      // Incremental sync optimization:
      // If we have a previous sync timestamp, fetch only rows with
      // last_modified_at >= previousSyncTimestamp for supported tables.
      // NOTE: Hard deletes cannot be detected without tombstones;
      // this optimization currently handles inserts/updates only.

      console.log(
        "🔽 [SyncEngine] Starting syncDown - pulling changes from Supabase..."
      );
      syncLog("[SyncEngine] Pulling changes from Supabase...");

      // Sync each table (in dependency order to avoid FK violations)
      const tablesToSync: SyncableTable[] = [
        // Reference data first (no dependencies, shared across users)
        "genre",
        "tune_type",
        "genre_tune_type",

        // User profiles (critical for FK relationships)
        "user_profile",

        // Instrument (depends on user_profile for privateToUser FK)
        "instrument",

        // User preferences
        "prefs_scheduling_options",
        "prefs_spaced_repetition",

        // User data (with dependencies)
        "playlist",

        // Table state (depends on playlist FK)
        "table_state",
        "tab_group_main_state",

        // Tune and related data
        "tune",
        "playlist_tune",
        "practice_record",
        "daily_practice_queue",
        "table_transient_data", // Staging data for practice evaluations (syncs across devices)
        "note",
        "reference",
        "tag",
        "tune_override",
      ];

      for (const tableName of tablesToSync) {
        try {
          const incrementalEligible =
            !!previousSyncTimestamp && supportsIncrementalTable(tableName);
          console.log(
            `   📥 Syncing table: ${tableName}...` +
              (incrementalEligible
                ? ` (incremental since ${previousSyncTimestamp})`
                : " (full)")
          );
          const tableSynced = await this.syncTableDown(
            tableName,
            previousSyncTimestamp,
            incrementalEligible
          );
          console.log(`   ✓ ${tableName}: ${tableSynced} records`);
          synced += tableSynced;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(`   ✗ ${tableName}: ${errorMsg}`);
          log.error(
            `[SyncEngine] Failed to sync table ${tableName}:`,
            errorMsg
          );
          errors.push(`Table ${tableName}: ${errorMsg}`);
          // If network-level fetch failure, abort remaining tables to reduce noise.
          if (isNetworkError(error)) {
            console.warn(
              "[SyncEngine] Network error detected - aborting remaining table syncs"
            );
            break;
          }
        }
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = startTime;
      // If previousSyncTimestamp was null, this run was a full sync (override boolean)
      if (!previousSyncTimestamp) {
        this.lastSyncWasIncremental = false;
      }

      console.log(
        `✅ [SyncEngine] SyncDown completed - synced ${synced} records from ${tablesToSync.length} tables`,
        {
          success: errors.length === 0,
          synced,
          errors: errors.length,
        }
      );

      return {
        success: errors.length === 0,
        itemsSynced: synced,
        itemsFailed: 0,
        conflicts,
        errors,
        timestamp: startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ [SyncEngine] syncDown failed:", errorMsg);
      log.error("[SyncEngine] syncDown failed:", errorMsg);
      errors.push(errorMsg);

      return {
        success: false,
        itemsSynced: synced,
        itemsFailed: 0,
        conflicts,
        errors,
        timestamp: startTime,
      };
    }
  }

  /**
   * Pull remote changes for a specific subset of tables.
   *
   * Optimization path used after focused local operations (e.g. practice submission)
   * to avoid looping through every table when we know which ones could have changed.
   *
   * Safety considerations:
   * - Still respects incremental filtering (last_modified_at) when available.
   * - Still updates the global lastSyncTimestamp so subsequent incremental syncs
   *   use this watermark (narrow scope acts as a partial incremental sync).
   * - Does NOT change lastSyncWasIncremental semantic: we mark incremental if a
   *   previous timestamp existed.
   */
  async syncDownTables(tables: SyncableTable[]): Promise<SyncResult> {
    const startTime = new Date().toISOString();
    const previousSyncTimestamp = this.lastSyncTimestamp;
    this.lastSyncWasIncremental = !!previousSyncTimestamp; // treat as incremental if watermark exists
    const errors: string[] = [];
    let synced = 0;
    const conflicts = 0;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      console.warn("[SyncEngine] Skipping scoped syncDown: browser offline");
      return {
        success: true,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts,
        errors: ["offline"],
        timestamp: startTime,
      };
    }

    try {
      console.log(
        `🔽 [SyncEngine] Scoped syncDown (${tables.length} tables)...` +
          (previousSyncTimestamp
            ? ` incremental since ${previousSyncTimestamp}`
            : " full (first watermark)")
      );

      for (const tableName of tables) {
        try {
          const incrementalEligible =
            !!previousSyncTimestamp && supportsIncrementalTable(tableName);
          console.log(
            `   📥 Scoped sync table: ${tableName}` +
              (incrementalEligible ? ` (incremental)` : " (full)")
          );
          const tableSynced = await this.syncTableDown(
            tableName,
            previousSyncTimestamp,
            incrementalEligible
          );
          synced += tableSynced;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(`   ✗ ${tableName}: ${errorMsg}`);
          errors.push(`Table ${tableName}: ${errorMsg}`);
          if (isNetworkError(error)) {
            console.warn(
              "[SyncEngine] Network error detected - aborting remaining scoped tables"
            );
            break;
          }
        }
      }

      this.lastSyncTimestamp = startTime;
      if (!previousSyncTimestamp) this.lastSyncWasIncremental = false;

      console.log(
        `✅ [SyncEngine] Scoped syncDown completed - synced ${synced} records from ${tables.length} tables`,
        { success: errors.length === 0, synced, errors: errors.length }
      );

      return {
        success: errors.length === 0,
        itemsSynced: synced,
        itemsFailed: 0,
        conflicts,
        errors,
        timestamp: startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("❌ [SyncEngine] scoped syncDown failed:", errorMsg);
      errors.push(errorMsg);
      return {
        success: false,
        itemsSynced: synced,
        itemsFailed: 0,
        conflicts,
        errors,
        timestamp: startTime,
      };
    }
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
  private async syncTableDown(
    tableName: SyncableTable,
    previousSyncTimestamp?: string | null,
    incrementalEligible?: boolean
  ): Promise<number> {
    syncLog(`[SyncEngine] Syncing table: ${tableName}`);

    const localTable = this.getLocalTable(tableName);
    if (!localTable) {
      throw new Error(`Local table not found: ${tableName}`);
    }

    // Define reference data tables (shared across all users, no user_id filter)
    const referenceDataTables: SyncableTable[] = [
      "genre",
      "tune_type",
      "genre_tune_type",
      "instrument",
    ];

    const isReferenceData = referenceDataTables.includes(tableName);

    // Build query based on table structure
    // NOTE: RLS policies should filter, but we add explicit filters for safety
    let query = this.supabase.from(tableName).select("*");

    const incremental = !!previousSyncTimestamp && !!incrementalEligible;
    if (incremental) {
      query = query.gte("last_modified_at", previousSyncTimestamp!);
      syncLog(
        `[SyncEngine] Incremental filter applied to ${tableName}: last_modified_at >= ${previousSyncTimestamp}`
      );
    }

    // Skip user filtering for reference data (shared across all users)
    if (!isReferenceData) {
      // Apply user filter based on table structure
      switch (tableName) {
        case "tune":
          // For catalog, sync ALL tunes (public + private to this user)
          // NULL = public (available to all), user_id = private to that user
          log.info(
            `[SyncEngine] Syncing ALL tunes (public + private for user ${this.userId})`
          );
          query = query.or(`private_for.is.null,private_for.eq.${this.userId}`);
          break;

        case "user_profile":
          // For user_profile, only sync the current user's profile
          // Note: this.userId is the integer ID, but we need to get the supabase_user_id
          // For now, let RLS handle this (user can only see their own profile)
          break;

        case "playlist_tune":
          // playlist_tune links via playlist_ref
          // We need to join with playlist table to filter by user
          // For now, fetch all via RLS and filter client-side
          // RLS policy should handle this via playlist ownership
          break;

        case "practice_record":
          // practice_record links via playlist_ref
          // RLS policy should handle this via playlist ownership
          break;

        // User preference tables use user_id as primary key
        case "prefs_scheduling_options":
        case "prefs_spaced_repetition":
        case "table_state":
        case "tab_group_main_state":
        case "table_transient_data":
          query = query.eq("user_id", this.userId);
          break;

        default:
          // Most tables use user_ref column directly
          query = query.eq("user_ref", this.userId);
          break;
      }
    }

    const { data: remoteRecords, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
    }

    if (!remoteRecords || remoteRecords.length === 0) {
      syncLog(`[SyncEngine] No records found for table ${tableName}`);
      return 0;
    }

    // Additional client-side filter for safety (in case RLS doesn't work as expected)
    let filteredRecords = remoteRecords;

    // Skip filtering for reference data (no user ownership)
    if (!isReferenceData) {
      // User preference tables use user_id
      const userPrefTables = [
        "prefs_scheduling_options",
        "prefs_spaced_repetition",
        "table_state",
        "tab_group_main_state",
        "table_transient_data",
      ];

      if (userPrefTables.includes(tableName)) {
        filteredRecords = remoteRecords.filter((record) => {
          if ("user_id" in record && record.user_id !== this.userId) {
            log.warn(
              `[SyncEngine] Filtered out record from ${tableName} (wrong user_id: ${record.user_id})`
            );
            return false;
          }
          return true;
        });
      }
      // For tables with user_ref, double-check ownership
      else if (
        tableName !== "tune" &&
        tableName !== "playlist_tune" &&
        tableName !== "practice_record"
      ) {
        filteredRecords = remoteRecords.filter((record) => {
          if ("user_ref" in record && record.user_ref !== this.userId) {
            log.warn(
              `[SyncEngine] Filtered out record ${record.id} from ${tableName} (wrong user_ref: ${record.user_ref})`
            );
            return false;
          }
          return true;
        });
      }
    }

    if (filteredRecords.length === 0) {
      log.debug(`[SyncEngine] All records filtered out for table ${tableName}`);
      return 0;
    }

    // Get adapter for this table - provides transform logic
    const adapter = getAdapter(tableName as SyncableTableName);

    // Upsert into local database
    // SQLite upsert: INSERT OR REPLACE
    for (const record of filteredRecords) {
      try {
        // Cast to any to maintain compatibility with existing code that uses loose typing
        const transformed: any = adapter.toLocal(record);

        // Debug: Log first record of each table to verify transformation
        if (filteredRecords.indexOf(record) === 0) {
          console.log(
            `🔍 [SyncEngine] First ${tableName} record from Supabase:`,
            record
          );
          console.log(`🔍 [SyncEngine] Transformed to SQLite:`, transformed);
        }

        // Special handling for daily_practice_queue to handle datetime format migration
        // This table can have conflicts on BOTH id (PK) and composite UNIQUE constraint
        // when old records use space format ('2025-11-06 00:00:00') vs ISO format ('2025-11-06T00:00:00')
        if (tableName === "daily_practice_queue") {
          // Check if a record with this ID already exists
          const existingById = await this.localDb
            .select()
            .from(localSchema.dailyPracticeQueue)
            .where(eq(localSchema.dailyPracticeQueue.id, transformed.id))
            .limit(1);

          // Check if datetime format mismatch exists (old space format vs new ISO format)
          let hasDatetimeFormatMismatch = false;
          if (existingById.length > 0) {
            const existingFormat = existingById[0].windowStartUtc;
            const incomingFormat = transformed.windowStartUtc;
            // Mismatch if one has 'T' and the other doesn't, but they represent same time
            hasDatetimeFormatMismatch =
              existingFormat.replace("T", " ") ===
                incomingFormat.replace("T", " ") &&
              existingFormat !== incomingFormat;
          }

          // If there's a datetime format mismatch, we need to delete-then-insert
          // to avoid dual constraint conflicts
          if (hasDatetimeFormatMismatch) {
            console.log(
              `🔍 [SyncEngine] daily_practice_queue datetime format migration - fixing record ${transformed.id}`
            );

            // Check for records with same composite key but different ID
            const allWithCompositeKey = await this.localDb
              .select()
              .from(localSchema.dailyPracticeQueue)
              .where(
                and(
                  eq(
                    localSchema.dailyPracticeQueue.userRef,
                    transformed.userRef
                  ),
                  eq(
                    localSchema.dailyPracticeQueue.playlistRef,
                    transformed.playlistRef
                  ),
                  eq(
                    localSchema.dailyPracticeQueue.tuneRef,
                    transformed.tuneRef
                  )
                )
              );

            const normalizedWindowStart = transformed.windowStartUtc.replace(
              "T",
              " "
            );
            const existingByCompositeKey = allWithCompositeKey.filter(
              (record) =>
                record.windowStartUtc.replace("T", " ") ===
                  normalizedWindowStart && record.id !== transformed.id
            );

            // Delete record with same ID
            await this.localDb
              .delete(localSchema.dailyPracticeQueue)
              .where(eq(localSchema.dailyPracticeQueue.id, transformed.id));

            // Delete records with same composite key but different ID
            for (const existing of existingByCompositeKey) {
              await this.localDb
                .delete(localSchema.dailyPracticeQueue)
                .where(eq(localSchema.dailyPracticeQueue.id, existing.id));
            }

            // Now insert the clean record
            await this.localDb
              .insert(localSchema.dailyPracticeQueue)
              .values(transformed);

            continue; // Skip the normal upsert logic
          }
          // Otherwise fall through to normal upsert logic
        }

        // Determine conflict target based on table structure
        let conflictTarget: any[];

        switch (tableName) {
          // Reference data tables
          case "genre":
          case "tune_type":
            // Use 'id' which is text primary key
            conflictTarget = [localTable.id];
            break;
          case "genre_tune_type":
            // Composite key: genreId + tuneTypeId
            conflictTarget = [localTable.genreId, localTable.tuneTypeId];
            break;
          case "instrument":
            // Use 'id' (text UUID primary key)
            conflictTarget = [localTable.id];
            break;

          // User profiles
          case "user_profile":
            // Use supabaseUserId (text UUID primary key)
            conflictTarget = [localTable.supabaseUserId];
            break;

          // User preferences (use userId as primary key)
          case "prefs_scheduling_options":
            conflictTarget = [localTable.userId];
            break;
          case "prefs_spaced_repetition":
            // Composite key: userId + algType
            conflictTarget = [localTable.userId, localTable.algType];
            break;
          case "table_state":
            // Composite key: userId + screenSize + purpose + playlistId
            conflictTarget = [
              localTable.userId,
              localTable.screenSize,
              localTable.purpose,
              localTable.playlistId,
            ];
            break;
          case "tab_group_main_state":
            // Uses id as PK (text UUID)
            conflictTarget = [localTable.id];
            break;
          case "table_transient_data":
            // Composite key: userId + tuneId + playlistId
            conflictTarget = [
              localTable.userId,
              localTable.tuneId,
              localTable.playlistId,
            ];
            break;

          // User data tables
          case "playlist":
            // Playlist PK is playlistId (text UUID)
            conflictTarget = [localTable.playlistId];
            break;
          case "playlist_tune":
            // Composite key: playlistRef + tuneRef
            conflictTarget = [localTable.playlistRef, localTable.tuneRef];
            break;
          case "daily_practice_queue":
            // Composite UNIQUE constraint is the natural business key
            // (user + playlist + time window + tune = unique queue entry)
            conflictTarget = [
              localTable.userRef,
              localTable.playlistRef,
              localTable.windowStartUtc,
              localTable.tuneRef,
            ];
            break;
          case "practice_record":
            // Use id as primary key (has composite UNIQUE index but id is PRIMARY KEY)
            conflictTarget = [localTable.id];
            break;
          default:
            // Most tables use 'id' as primary key
            conflictTarget = [localTable.id];
            break;
        }

        // Check if local record exists and compare timestamps
        // Skip timestamp check for reference data tables (no sync conflicts expected)
        const referenceDataTables = [
          "genre",
          "tune_type",
          "genre_tune_type",
          "instrument",
        ];
        const shouldCheckTimestamp =
          !referenceDataTables.includes(tableName) &&
          "lastModifiedAt" in transformed;

        if (shouldCheckTimestamp) {
          // Fetch existing local record to compare timestamps
          let existingLocal: any = null;

          // Query based on primary key structure
          if (conflictTarget.length === 1) {
            // Single primary key
            const pkField = conflictTarget[0];
            // pkField.name is snake_case (DB column), but transformed uses camelCase
            // Convert snake_case to camelCase to look up the value
            const pkKeyCamel = pkField.name.replace(
              /_([a-z])/g,
              (_: string, letter: string) => letter.toUpperCase()
            );
            const pkValue = (transformed as any)[pkKeyCamel];
            existingLocal = await this.localDb
              .select()
              .from(localTable)
              .where(eq(pkField, pkValue))
              .limit(1);
          } else {
            // Composite key - build AND condition
            const conditions = conflictTarget.map((field: any) => {
              // Convert snake_case to camelCase
              const keyCamel = field.name.replace(
                /_([a-z])/g,
                (_: string, letter: string) => letter.toUpperCase()
              );
              return eq(field, (transformed as any)[keyCamel]);
            });
            existingLocal = await this.localDb
              .select()
              .from(localTable)
              .where(and(...conditions))
              .limit(1);
          }

          if (existingLocal && existingLocal.length > 0) {
            const localTimestamp = existingLocal[0].lastModifiedAt;
            const remoteTimestamp = transformed.lastModifiedAt;

            // Compare timestamps - only update if remote is newer
            if (
              localTimestamp &&
              remoteTimestamp &&
              localTimestamp >= remoteTimestamp
            ) {
              syncLog(
                `[SyncEngine] Skipping ${tableName} record - local is newer or equal (local: ${localTimestamp}, remote: ${remoteTimestamp})`
              );
              continue; // Skip this record
            }
          }
        }

        // Build a schema-aware local row with only valid columns and safe defaults
        const sanitized = this.prepareLocalRow(tableName, transformed);

        const tableNameString = `${tableName}`;
        if (tableNameString === "user_profile") {
          console.log(`found problematic table: ${tableName}`);
        }

        await this.localDb
          .insert(localTable)
          .values(sanitized)
          .onConflictDoUpdate({
            target: conflictTarget,
            set: sanitized,
          });
      } catch (error) {
        log.error(
          `[SyncEngine] Failed to upsert record in ${tableName}:`,
          error
        );
        console.error("Error type:", typeof error);
        throw error;
      }
    }

    syncLog(
      `[SyncEngine] Synced ${filteredRecords.length} records from ${tableName}`
    );
    return remoteRecords.length;
  }

  /**
   * Get local table reference by name
   *
   * @param tableName - Table name
   * @returns Local schema table or null
   */
  private getLocalTable(tableName: SyncableTable): any {
    const tableMap: Record<SyncableTable, any> = {
      // Reference data
      genre: localSchema.genre,
      tune_type: localSchema.tuneType,
      genre_tune_type: localSchema.genreTuneType,
      instrument: localSchema.instrument,

      // User profiles
      user_profile: localSchema.userProfile,

      // User preferences
      prefs_scheduling_options: localSchema.prefsSchedulingOptions,
      prefs_spaced_repetition: localSchema.prefsSpacedRepetition,
      table_state: localSchema.tableState,
      tab_group_main_state: localSchema.tabGroupMainState,

      // User data
      tune: localSchema.tune,
      playlist: localSchema.playlist,
      playlist_tune: localSchema.playlistTune,
      note: localSchema.note,
      reference: localSchema.reference,
      tag: localSchema.tag,
      practice_record: localSchema.practiceRecord,
      daily_practice_queue: localSchema.dailyPracticeQueue,
      table_transient_data: localSchema.tableTransientData,
      tune_override: localSchema.tuneOverride,
    };

    return tableMap[tableName] || null;
  }

  /**
   * Return list of column keys for a Drizzle table object.
   * We detect columns by presence of a string `name` and an object `table`.
   */
  private getTableColumnKeys(localTable: any): string[] {
    return Object.keys(localTable).filter((k) => {
      const v: any = (localTable as any)[k];
      return (
        v &&
        typeof v === "object" &&
        typeof v.name === "string" &&
        // drizzle column objects expose table metadata
        "table" in v
      );
    });
  }

  /**
   * Prepare a row for local insertion/update:
   * - Keep only schema columns
   * - Fill required defaults per table
   * - Coerce undefined → null (sql.js binding safe)
   */
  private prepareLocalRow(
    tableName: string,
    transformed: Record<string, any>
  ): Record<string, any> {
    const localTable: any = this.getLocalTable(tableName as SyncableTable);
    if (!localTable) return {};

    const row: Record<string, any> = {};
    const colKeys = this.getTableColumnKeys(localTable);

    // Copy only known columns from transformed
    for (const key of colKeys) {
      row[key] = transformed[key];
    }

    // Apply table-agnostic defaults
    const needsLastModified = [
      "user_profile",
      "playlist",
      "playlist_tune",
      "note",
      "reference",
      "tag",
      "practice_record",
      "daily_practice_queue",
      "tune",
      "tune_override",
      "table_state",
      "table_transient_data",
      "prefs_scheduling_options",
      "prefs_spaced_repetition",
      "instrument",
    ];
    if (needsLastModified.includes(tableName)) {
      if (row.lastModifiedAt === undefined || row.lastModifiedAt === null) {
        row.lastModifiedAt = new Date().toISOString();
      }
    }

    const needsDeleted = [
      "user_profile",
      "playlist",
      "playlist_tune",
      "note",
      "reference",
      "tune",
      "tune_override",
      "practice_record",
      "instrument",
    ];
    if (needsDeleted.includes(tableName)) {
      if (row.deleted === undefined || row.deleted === null) {
        row.deleted = 0;
      }
    }
    if (row.syncVersion === undefined || row.syncVersion === null) {
      row.syncVersion = 1;
    }

    // Table-specific fixes
    if (tableName === "user_profile") {
      // Ensure acceptableDelinquencyWindow, avatarUrl exist
      if (row.acceptableDelinquencyWindow === undefined)
        row.acceptableDelinquencyWindow = 21;
      if (row.avatarUrl === undefined) row.avatarUrl = null;
      // SQLite requires user_profile.id NOT NULL; if absent, mirror supabaseUserId
      if (row.id === undefined || row.id === null) row.id = row.supabaseUserId;
    }
    if (tableName === "playlist") {
      if (row.name === undefined) row.name = null;
      if (row.instrumentRef === undefined) row.instrumentRef = null;
      if (row.genreDefault === undefined) row.genreDefault = null;
      if (row.srAlgType === undefined) row.srAlgType = null;
    }

    // Coerce any remaining undefined to null
    for (const key of colKeys) {
      if (row[key] === undefined) row[key] = null;
    }

    if (import.meta.env.VITE_SYNC_DEBUG === "true") {
      log.debug(`[SyncEngine] Prepared row (${tableName}) keys:`, colKeys);
      const sample = Object.fromEntries(
        colKeys.slice(0, 8).map((k) => [k, row[k]])
      );
      log.debug(`[SyncEngine] Prepared sample (${tableName}):`, sample);
    }

    return row;
  }

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

// Tables that include a writable last_modified_at column and are safe for incremental sync.
// Reference data & tables without modification timestamps are excluded.
const INCREMENTAL_TABLES: SyncableTable[] = [
  "playlist",
  "playlist_tune",
  "practice_record",
  "daily_practice_queue",
  "table_transient_data",
  "note",
  "reference",
  "tag",
  "tune_override",
  "tune",
  "table_state",
  "tab_group_main_state",
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  "user_profile", // user can update profile fields
  // instrument excluded only if considered global reference; include if per-user edits allowed
];

function supportsIncrementalTable(tableName: SyncableTable): boolean {
  return INCREMENTAL_TABLES.includes(tableName);
}

/** Determine if an error is a network-level fetch failure (e.g., offline, DNS, CORS). */
function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  // Supabase client surfaces network failures as TypeError('Failed to fetch')
  return error instanceof TypeError && /Failed to fetch/i.test(error.message);
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
