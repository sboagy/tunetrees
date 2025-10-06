/**
 * Sync Service
 *
 * Handles background synchronization between local SQLite and Supabase.
 * Implements:
 * - Push: Upload local changes to Supabase
 * - Pull: Download remote changes from Supabase
 * - Conflict resolution: Last-write-wins with user override option
 *
 * @module lib/sync/service
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SqliteDatabase } from "../db/client-sqlite";
import {
  getPendingSyncItems,
  markSynced,
  type SyncableTable,
  updateSyncStatus,
} from "./queue";

/**
 * Sync result
 */
export interface SyncResult {
  pushed: number;
  pulled: number;
  failed: number;
  errors: string[];
}

/**
 * Sync Service
 *
 * Manages bidirectional sync between local SQLite and Supabase.
 */
export class SyncService {
  private db: SqliteDatabase;
  private supabase: SupabaseClient;
  private isSyncing = false;

  constructor(db: SqliteDatabase, supabase: SupabaseClient) {
    this.db = db;
    this.supabase = supabase;
  }

  /**
   * Check if sync is currently in progress
   */
  public get syncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Perform full sync (push then pull)
   *
   * @returns Sync result statistics
   */
  public async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;

    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Push local changes to Supabase
      const pushResult = await this.pushChanges();
      result.pushed = pushResult.success;
      result.failed += pushResult.failed;
      result.errors.push(...pushResult.errors);

      // Pull remote changes from Supabase
      // TODO: Implement pull logic in next iteration
      // const pullResult = await this.pullChanges();
      // result.pulled = pullResult.count;

      return result;
    } catch (error) {
      console.error("Sync error:", error);
      result.errors.push(
        error instanceof Error ? error.message : "Unknown sync error"
      );
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to Supabase
   *
   * @returns Number of successfully pushed items
   */
  private async pushChanges(): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    // Get pending sync items
    const items = await getPendingSyncItems(this.db);

    if (items.length === 0) {
      return result;
    }

    // Process each item
    for (const item of items) {
      try {
        // Mark as syncing
        await updateSyncStatus(this.db, item.id, "syncing");

        // Sync to Supabase based on operation
        switch (item.operation) {
          case "insert":
          case "update":
            await this.upsertToSupabase(
              item.tableName as SyncableTable,
              item.data ? JSON.parse(item.data) : {}
            );
            break;

          case "delete":
            await this.deleteFromSupabase(
              item.tableName as SyncableTable,
              item.recordId
            );
            break;

          default:
            throw new Error(`Unknown operation: ${item.operation}`);
        }

        // Mark as synced and remove from queue
        await markSynced(this.db, item.id);
        result.success++;
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Item ${item.id}: ${errorMsg}`);

        // Mark as failed (with retry logic)
        await updateSyncStatus(this.db, item.id, "failed", errorMsg);
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Upsert record to Supabase
   */
  private async upsertToSupabase(
    tableName: SyncableTable,
    data: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase.from(tableName).upsert(data);

    if (error) {
      throw new Error(`Supabase upsert error: ${error.message}`);
    }
  }

  /**
   * Delete record from Supabase (soft delete)
   */
  private async deleteFromSupabase(
    tableName: SyncableTable,
    recordId: string
  ): Promise<void> {
    // Soft delete: set deleted = true
    const { error } = await this.supabase
      .from(tableName)
      .update({ deleted: true })
      .eq("id", recordId);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  }

  /**
   * Pull changes from Supabase
   * TODO: Implement in next iteration
   *
   * Implementation plan:
   * 1. Get last sync timestamp for each table
   * 2. Query Supabase for changes since last sync
   * 3. Apply changes to local SQLite
   * 4. Handle conflicts (last-write-wins)
   */
  // Commented out until implementation is complete
  // private async pullChanges(): Promise<{ count: number }> {
  //   return { count: 0 };
  // }
}

/**
 * Start background sync worker
 *
 * @param db - SQLite database instance
 * @param supabase - Supabase client
 * @param intervalMs - Sync interval in milliseconds (default: 30 seconds)
 * @returns Function to stop the worker
 */
export function startSyncWorker(
  db: SqliteDatabase,
  supabase: SupabaseClient,
  intervalMs = 30000
): () => void {
  const syncService = new SyncService(db, supabase);

  // Initial sync
  void syncService.sync();

  // Periodic sync
  const intervalId = setInterval(() => {
    void syncService.sync();
  }, intervalMs);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
}
