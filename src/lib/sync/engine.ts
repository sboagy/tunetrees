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

import { eq } from "drizzle-orm";
import * as remoteSchema from "../../../drizzle/migrations/postgres/schema";
import * as localSchema from "../../../drizzle/schema-sqlite";
import { db as pgDb } from "../db/client-postgres";
import type { SqliteDatabase } from "../db/client-sqlite";
import type { SyncQueueItem } from "../db/types";
import {
  getPendingSyncItems,
  markSynced,
  type SyncableTable,
  updateSyncStatus,
} from "./queue";

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
  private userId: number;
  private config: SyncConfig;
  private lastSyncTimestamp: string | null = null;

  constructor(
    localDb: SqliteDatabase,
    userId: number,
    config: Partial<SyncConfig> = {}
  ) {
    this.localDb = localDb;
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
      console.log("[SyncEngine] Starting syncUp...");
      const upResult = await this.syncUp();
      totalSynced += upResult.itemsSynced;
      totalFailed += upResult.itemsFailed;
      errors.push(...upResult.errors);

      // Step 2: Pull remote changes to local
      console.log("[SyncEngine] Starting syncDown...");
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
      console.error("[SyncEngine] Sync failed:", errorMsg);
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
        console.log("[SyncEngine] No pending items to sync");
        return {
          success: true,
          itemsSynced: 0,
          itemsFailed: 0,
          conflicts: 0,
          errors: [],
          timestamp: startTime,
        };
      }

      console.log(
        `[SyncEngine] Processing ${pendingItems.length} pending items`
      );

      // Process each item
      for (const item of pendingItems) {
        try {
          await this.processQueueItem(item);
          await markSynced(this.localDb, item.id!);
          synced++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[SyncEngine] Failed to sync item ${item.id}:`,
            errorMsg
          );

          // Update item status based on retry count
          if (item.attempts >= this.config.maxRetries) {
            await updateSyncStatus(this.localDb, item.id!, "failed", errorMsg);
            failed++;
            errors.push(`Item ${item.id} (${item.tableName}): ${errorMsg}`);
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
      console.error("[SyncEngine] syncUp failed:", errorMsg);
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
    const errors: string[] = [];
    let synced = 0;
    const conflicts = 0; // TODO: Implement conflict detection

    try {
      // For now, we'll implement a simple full sync for user's data
      // TODO: Optimize with incremental sync using last_modified_at timestamps

      console.log("[SyncEngine] Pulling changes from Supabase...");

      // Sync each table (in dependency order to avoid FK violations)
      const tablesToSync: SyncableTable[] = [
        "playlist",
        "tune",
        "playlist_tune",
        "practice_record",
        "note",
        "reference",
        "tag",
        "daily_practice_queue",
        "tune_override",
      ];

      for (const tableName of tablesToSync) {
        try {
          const tableSynced = await this.syncTableDown(tableName);
          synced += tableSynced;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[SyncEngine] Failed to sync table ${tableName}:`,
            errorMsg
          );
          errors.push(`Table ${tableName}: ${errorMsg}`);
        }
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = startTime;

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
      console.error("[SyncEngine] syncDown failed:", errorMsg);
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
    const { tableName, recordId, operation, data } = item;

    console.log(
      `[SyncEngine] Processing ${operation} on ${tableName}:${recordId}`
    );

    // Get the remote table reference
    const remoteTable = this.getRemoteTable(tableName as SyncableTable);
    if (!remoteTable) {
      throw new Error(`Unknown table: ${tableName}`);
    }

    // Parse data if present
    const recordData = data ? JSON.parse(data) : null;

    switch (operation) {
      case "insert":
        if (!recordData) {
          throw new Error("INSERT operation requires data");
        }
        await pgDb.insert(remoteTable).values(recordData);
        break;

      case "update":
        if (!recordData) {
          throw new Error("UPDATE operation requires data");
        }
        // Update using primary key (id for most tables)
        await pgDb
          .update(remoteTable)
          .set(recordData)
          .where(eq(remoteTable.id, Number(recordId)));
        break;

      case "delete":
        // Soft delete: set deleted flag
        await pgDb
          .update(remoteTable)
          .set({ deleted: true })
          .where(eq(remoteTable.id, Number(recordId)));
        break;

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
  private async syncTableDown(tableName: SyncableTable): Promise<number> {
    console.log(`[SyncEngine] Syncing table: ${tableName}`);

    const remoteTable = this.getRemoteTable(tableName);
    const localTable = this.getLocalTable(tableName);

    if (!remoteTable || !localTable) {
      throw new Error(`Table not found: ${tableName}`);
    }

    // Query remote records for this user
    const remoteRecords = await pgDb
      .select()
      .from(remoteTable)
      .where(eq(remoteTable.userRef, this.userId));

    if (remoteRecords.length === 0) {
      console.log(`[SyncEngine] No records found for table ${tableName}`);
      return 0;
    }

    // Upsert into local database
    // SQLite upsert: INSERT OR REPLACE
    for (const record of remoteRecords) {
      try {
        await this.localDb
          .insert(localTable)
          .values(this.transformRemoteToLocal(record))
          .onConflictDoUpdate({
            target: [localTable.id],
            set: this.transformRemoteToLocal(record),
          });
      } catch (error) {
        console.error(
          `[SyncEngine] Failed to upsert record ${record.id} in ${tableName}:`,
          error
        );
        throw error;
      }
    }

    console.log(
      `[SyncEngine] Synced ${remoteRecords.length} records from ${tableName}`
    );
    return remoteRecords.length;
  }

  /**
   * Get remote table reference by name
   *
   * @param tableName - Table name
   * @returns Remote schema table or null
   */
  private getRemoteTable(tableName: SyncableTable): any {
    const tableMap: Record<SyncableTable, any> = {
      tune: remoteSchema.tune,
      playlist: remoteSchema.playlist,
      playlist_tune: remoteSchema.playlistTune,
      note: remoteSchema.note,
      reference: remoteSchema.reference,
      tag: remoteSchema.tag,
      practice_record: remoteSchema.practiceRecord,
      daily_practice_queue: remoteSchema.dailyPracticeQueue,
      tune_override: remoteSchema.tuneOverride,
      // user_annotation_set: removed - not in schema
    };

    return tableMap[tableName] || null;
  }

  /**
   * Get local table reference by name
   *
   * @param tableName - Table name
   * @returns Local schema table or null
   */
  private getLocalTable(tableName: SyncableTable): any {
    const tableMap: Record<SyncableTable, any> = {
      tune: localSchema.tune,
      playlist: localSchema.playlist,
      playlist_tune: localSchema.playlistTune,
      note: localSchema.note,
      reference: localSchema.reference,
      tag: localSchema.tag,
      practice_record: localSchema.practiceRecord,
      daily_practice_queue: localSchema.dailyPracticeQueue,
      tune_override: localSchema.tuneOverride,
    };

    return tableMap[tableName] || null;
  }

  /**
   * Transform remote (PostgreSQL) record to local (SQLite) format
   *
   * Handles type conversions:
   * - timestamp (PostgreSQL) → text (SQLite ISO 8601)
   * - boolean (PostgreSQL) → integer (SQLite 0/1)
   * - uuid (PostgreSQL) → text (SQLite)
   *
   * @param record - Remote record
   * @returns Transformed record for local DB
   */
  private transformRemoteToLocal(record: any): any {
    const transformed = { ...record };

    // Convert timestamps to ISO 8601 strings
    for (const key of Object.keys(transformed)) {
      const value = transformed[key];

      if (value instanceof Date) {
        transformed[key] = value.toISOString();
      } else if (typeof value === "boolean") {
        // Convert boolean to integer (0/1)
        transformed[key] = value ? 1 : 0;
      }
    }

    return transformed;
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
}

/**
 * Create a sync engine instance
 *
 * @param localDb - Local SQLite database
 * @param userId - Current user ID
 * @param config - Optional sync configuration
 * @returns SyncEngine instance
 */
export function createSyncEngine(
  localDb: SqliteDatabase,
  userId: number,
  config?: Partial<SyncConfig>
): SyncEngine {
  return new SyncEngine(localDb, userId, config);
}
