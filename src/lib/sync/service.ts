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
  userId: number | null;
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
  private syncIntervalId: number | null = null;

  constructor(db: SqliteDatabase, config: SyncServiceConfig) {
    this.db = db;
    this.config = config;

    // Initialize sync engine
    this.syncEngine = new SyncEngine(this.db, config.userId ?? 0, {
      batchSize: 100,
      maxRetries: 3,
      timeoutMs: 30000,
    });

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

    this.realtimeManager = new RealtimeManager(this.syncEngine, realtimeConfig);
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
      return await this.syncEngine.syncUp();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull remote changes from Supabase only
   */
  public async syncDown(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;

    try {
      return await this.syncEngine.syncDown();
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start automatic background sync
   */
  public startAutoSync(): void {
    if (this.syncIntervalId) {
      console.warn("[SyncService] Auto sync already running");
      return;
    }

    const intervalMs = this.config.syncIntervalMs ?? 30000; // Default 30s

    // Initial sync
    void this.sync();

    // Periodic sync
    this.syncIntervalId = window.setInterval(() => {
      void this.sync();
    }, intervalMs);

    console.log(`[SyncService] Auto sync started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop automatic background sync
   */
  public stopAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log("[SyncService] Auto sync stopped");
    }
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
