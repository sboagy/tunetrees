/**
 * Sync Service
 *
 * Handles background synchronization between local SQLite and Supabase.
 * Implements:
 * - Push: Upload local changes to Supabase (via SyncEngine)
 * - Pull: Download remote changes from Supabase (via SyncEngine)
 * - Realtime: Live sync via Supabase Realtime subscriptions
 * - Conflict resolution: Last-write-wins with user override option
 *
 * @module lib/sync/service
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SqliteDatabase } from "../db/client-sqlite";
import { SyncEngine } from "./engine";
import type { SyncableTable } from "./queue";
import { type RealtimeConfig, RealtimeManager } from "./realtime";

/**
 * Sync result (compatible with SyncEngine)
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
 * Sync Service Configuration
 */
export interface SyncServiceConfig {
  supabase: SupabaseClient;
  // Supabase Auth user id (UUID string)
  userId: string | null;
  realtimeEnabled?: boolean;
  syncIntervalMs?: number;
  onSyncComplete?: (result: SyncResult) => void;
  onRealtimeConnected?: () => void;
  onRealtimeDisconnected?: () => void;
  onRealtimeError?: (error: Error) => void;
}

/**
 * Sync Service
 *
 * Manages bidirectional sync between local SQLite and Supabase.
 * Uses SyncEngine for push/pull and RealtimeManager for live updates.
 */
export class SyncService {
  private db: SqliteDatabase;
  private syncEngine: SyncEngine;
  private realtimeManager: RealtimeManager | null = null;
  private config: SyncServiceConfig;
  private isSyncing = false;
  private syncIntervalId: number | null = null; // For syncUp interval
  private syncDownIntervalId: number | null = null; // For syncDown interval

  constructor(db: SqliteDatabase, config: SyncServiceConfig) {
    this.db = db;
    this.config = config;

    // Initialize sync engine
    this.syncEngine = new SyncEngine(
      this.db,
      config.supabase,
      config.userId ?? "",
      {
        batchSize: 100,
        maxRetries: 3,
        timeoutMs: 30000,
      }
    );

    // Initialize Realtime if enabled
    if (config.realtimeEnabled && config.userId) {
      this.initializeRealtime();
    }
  }

  /**
   * Initialize Supabase Realtime subscriptions
   */
  private initializeRealtime(): void {
    const tables: SyncableTable[] = [
      "tune",
      "playlist",
      "playlist_tune",
      "note",
      "reference",
      "tag",
      "practice_record",
      "daily_practice_queue",
      "tune_override",
    ];

    const realtimeConfig: RealtimeConfig = {
      enabled: true,
      tables,
      userId: this.config.userId,
      onConnected: this.config.onRealtimeConnected,
      onDisconnected: this.config.onRealtimeDisconnected,
      onError: this.config.onRealtimeError,
      onSync: (tableName) => {
        console.log(`[SyncService] Realtime sync completed for ${tableName}`);
      },
    };

    // Pass 'this' (SyncService) instead of syncEngine so Realtime can use
    // the protected syncDown() that blocks when pending changes exist
    this.realtimeManager = new RealtimeManager(this, realtimeConfig);
    void this.realtimeManager.start();
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

    try {
      // Use SyncEngine's bidirectional sync
      const result = await this.syncEngine.sync();

      // Notify callback
      this.config.onSyncComplete?.(result);

      return result;
    } catch (error) {
      console.error("Sync error:", error);
      const errorResult: SyncResult = {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: 0,
        errors: [error instanceof Error ? error.message : "Unknown sync error"],
        timestamp: new Date().toISOString(),
      };
      return errorResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to Supabase only
   */
  public async syncUp(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;

    try {
      const result = await this.syncEngine.syncUp();

      // Notify callback (same as sync() method)
      this.config.onSyncComplete?.(result);

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull remote changes from Supabase only
   *
   * CRITICAL: Before pulling remote changes, we must upload any pending local changes
   * to avoid losing user data. If syncUp fails, we still proceed with syncDown to ensure
   * the user gets the latest remote data.
   */
  public async syncDown(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;

    try {
      // CRITICAL: Upload pending changes BEFORE downloading remote changes
      // This prevents race conditions where:
      // 1. User deletes a row locally
      // 2. DELETE is queued but not yet sent to Supabase
      // 3. syncDown runs and re-downloads the "deleted" row from Supabase
      // 4. Row reappears in local DB (zombie record)
      const stats = await this.syncEngine.getSyncQueueStats();
      if (stats.pending > 0) {
        console.log(
          `[SyncService] ⚠️  BLOCKING syncDown: ${stats.pending} pending changes must upload first`
        );
        try {
          await this.syncEngine.syncUp();
          console.log(
            "[SyncService] ✅ Pending changes uploaded - safe to syncDown"
          );
        } catch (error) {
          console.error(
            "[SyncService] ❌ Failed to upload pending changes:",
            error
          );
          // CRITICAL: DO NOT proceed with syncDown if upload failed
          // This would cause zombie records (deleted items reappearing)
          throw new Error(
            "Cannot syncDown while pending changes exist - upload failed. Local data preserved."
          );
        }
      }

      const result = await this.syncEngine.syncDown();

      // Notify callback (same as sync() method)
      this.config.onSyncComplete?.(result);

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start automatic background sync
   *
   * Strategy:
   * - syncDown: Once on startup, then every 20 minutes (pull remote changes - rare)
   * - syncUp: Every 5 minutes (push local changes - frequent, only if changes pending)
   */
  public startAutoSync(): void {
    if (this.syncIntervalId) {
      console.warn("[SyncService] Auto sync already running");
      return;
    }

    // Sync intervals
    const syncUpIntervalMs = this.config.syncIntervalMs ?? 300000; // 5 minutes (push local changes)
    const syncDownIntervalMs = 20 * 60 * 1000; // 20 minutes (pull remote changes)

    // Initial syncDown on startup (immediate)
    // This will automatically upload any pending changes first (see syncDown method)
    console.log("[SyncService] Running initial syncDown on startup...");
    void this.syncDown();

    // Periodic syncUp (frequent - push local changes to server)
    // Only runs if there are pending changes to avoid unnecessary network calls
    this.syncIntervalId = window.setInterval(async () => {
      try {
        // Safety check: ensure database is initialized
        if (!this.db) {
          console.warn(
            "[SyncService] Database not initialized yet, skipping syncUp check"
          );
          return;
        }

        // Check if there are pending changes before syncing
        const stats = await this.syncEngine.getSyncQueueStats();
        const hasPendingChanges = stats.pending > 0 || stats.syncing > 0;

        if (hasPendingChanges) {
          console.log(
            `[SyncService] Running periodic syncUp (${stats.pending} pending changes)...`
          );
          await this.syncUp();
        } else {
          // Silent - no need to log when there's nothing to sync
        }
      } catch (error) {
        console.error("[SyncService] Error checking sync queue:", error);
      }
    }, syncUpIntervalMs);

    // Periodic syncDown (infrequent - pull remote changes from server)
    this.syncDownIntervalId = window.setInterval(() => {
      console.log("[SyncService] Running periodic syncDown...");
      void this.syncDown();
    }, syncDownIntervalMs);

    console.log(
      `[SyncService] Auto sync started:`,
      `syncUp every ${syncUpIntervalMs / 1000}s (only if changes pending),`,
      `syncDown every ${syncDownIntervalMs / 1000 / 60} minutes`
    );
  }

  /**
   * Stop automatic background sync
   */
  public stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.syncDownIntervalId) {
      clearInterval(this.syncDownIntervalId);
      this.syncDownIntervalId = null;
    }
    console.log("[SyncService] Auto sync stopped (both syncUp and syncDown)");
  }

  /**
   * Start Realtime subscriptions
   */
  public async startRealtime(): Promise<void> {
    if (!this.realtimeManager) {
      this.initializeRealtime();
    }
    await this.realtimeManager?.start();
  }

  /**
   * Stop Realtime subscriptions
   */
  public async stopRealtime(): Promise<void> {
    await this.realtimeManager?.stop();
  }

  /**
   * Get Realtime status
   */
  public getRealtimeStatus(): string {
    return this.realtimeManager?.getStatus() ?? "disabled";
  }

  /**
   * Cleanup resources
   */
  public async destroy(): Promise<void> {
    this.stopAutoSync();
    await this.stopRealtime();
  }
}

/**
 * Start background sync worker (deprecated - use SyncService directly)
 *
 * @deprecated Use SyncService class with startAutoSync() instead
 * @param db - SQLite database instance
 * @param config - Sync service configuration
 * @returns SyncService instance with cleanup function
 */
export function startSyncWorker(
  db: SqliteDatabase,
  config: SyncServiceConfig
): { service: SyncService; stop: () => void } {
  const syncService = new SyncService(db, config);

  // Start auto sync
  syncService.startAutoSync();

  // Return service and cleanup function
  return {
    service: syncService,
    stop: () => {
      syncService.stopAutoSync();
    },
  };
}
