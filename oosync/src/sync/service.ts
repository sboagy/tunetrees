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

import type { SyncRequestOverrides } from "@oosync/shared/protocol";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "solid-sonner";
import { SyncEngine } from "./engine";
import type { SyncableTable } from "./queue";
import { type RealtimeConfig, RealtimeManager } from "./realtime";
import { getSyncRuntime, type SqliteDatabase } from "./runtime-context";

/**
 * Error thrown when sync is already in progress
 * Used to distinguish expected "busy" state from actual sync failures
 */
export class SyncInProgressError extends Error {
  constructor() {
    super("Sync already in progress");
    this.name = "SyncInProgressError";
  }
}

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
  affectedTables: string[];
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
  /** When true, never push local changes; pull-only sync. */
  pullOnly?: boolean;
  /** Optional per-sync overrides for pull behavior. */
  requestOverridesProvider?: () => Promise<SyncRequestOverrides | null>;
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
  private consecutiveSyncUpFailures = 0;

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
        pullOnly: config.pullOnly,
        requestOverridesProvider: config.requestOverridesProvider,
      }
    );

    // Initialize Realtime if enabled
    if (config.realtimeEnabled && config.userId) {
      this.initializeRealtime();
    }
  }

  /**
   * Get last successful syncDown timestamp from underlying SyncEngine.
   * Returns null if no syncDown has completed yet.
   */
  public getLastSyncDownTimestamp(): string | null {
    // Access private syncEngine via indexed cast; method is public on engine.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.syncEngine as any).getLastSyncTimestamp?.() ?? null;
  }

  /** Return 'incremental' or 'full' based on last syncDown run */
  public getLastSyncMode(): "incremental" | "full" | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine: any = this.syncEngine as any;
    if (!engine.getLastSyncTimestamp?.()) return null; // no sync yet
    const inc = engine.wasLastSyncIncremental?.();
    return inc ? "incremental" : "full";
  }

  /**
   * Force a full syncDown by clearing incremental watermark first.
   * Useful for manual refresh from UI (e.g. DB menu command).
   */
  public async forceFullSyncDown(): Promise<SyncResult> {
    // Clear incremental timestamp so syncDown treats this as cold start.
    // Access SyncEngine via private field method.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.syncEngine as any).clearLastSyncTimestamp?.();
    return await this.syncDown();
  }

  /**
   * Initialize Supabase Realtime subscriptions
   */
  private initializeRealtime(): void {
    const tables = getSyncRuntime().schema.syncableTables as SyncableTable[];

    const realtimeConfig: RealtimeConfig = {
      enabled: true,
      tables,
      userId: this.config.userId,
      supabase: this.config.supabase,
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
   * Create a standard error result for failed sync operations
   *
   * Helper to ensure consistent error result format across all sync methods.
   * When sync fails, we still call onSyncComplete with this error result to ensure
   * the UI can react (e.g., set initialSyncComplete flag, show error messages).
   */
  private createErrorResult(error: unknown): SyncResult {
    return {
      success: false,
      itemsSynced: 0,
      itemsFailed: 0,
      conflicts: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      timestamp: new Date().toISOString(),
      affectedTables: [],
    };
  }

  /**
   * Perform full sync (push then pull)
   *
   * @returns Sync result statistics
   */
  public async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new SyncInProgressError();
    }

    if (this.config.pullOnly) {
      return await this.syncDown();
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
      // Call onSyncComplete even on errors so UI can react
      const errorResult = this.createErrorResult(error);
      this.config.onSyncComplete?.(errorResult);
      throw error; // Re-throw to maintain error propagation
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to Supabase only (using trigger-based outbox)
   */
  public async syncUp(options?: {
    allowDeletes?: boolean;
  }): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new SyncInProgressError();
    }

    if (this.config.pullOnly) {
      const errorResult = this.createErrorResult(
        new Error("Sync uploads are disabled in pull-only mode")
      );
      this.config.onSyncComplete?.(errorResult);
      return errorResult;
    }

    this.isSyncing = true;

    try {
      const result = await this.syncEngine.syncUpFromOutbox(options);

      // Notify callback (same as sync() method)
      this.config.onSyncComplete?.(result);

      return result;
    } catch (error) {
      // CRITICAL: Persist DB on sync failure to prevent data loss on refresh
      // When sync fails (e.g., constraint violation), the data is still in local
      // SQLite + outbox. If user refreshes before auto-persist fires, it's lost.
      try {
        await getSyncRuntime().persistDb?.();
        console.log(
          "[SyncService] ✅ Persisted DB after sync failure to protect user data"
        );
      } catch (persistError) {
        console.warn(
          "[SyncService] ⚠️ Failed to persist DB after sync error:",
          persistError
        );
      }

      // Call onSyncComplete even on errors so UI can react
      const errorResult = this.createErrorResult(error);
      this.config.onSyncComplete?.(errorResult);
      throw error; // Re-throw to maintain error propagation
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
      throw new SyncInProgressError();
    }

    this.isSyncing = true;

    try {
      const pullOnly = this.config.pullOnly === true;
      // CRITICAL: Upload pending changes BEFORE downloading remote changes
      // This prevents race conditions where:
      // 1. User deletes a row locally
      // 2. DELETE is queued but not yet sent to Supabase
      // 3. syncDown runs and re-downloads the "deleted" row from Supabase
      // 4. Row reappears in local DB (zombie record)
      if (!pullOnly) {
        const stats = await this.syncEngine.getOutboxStats();
        if (stats.pending > 0 || stats.inProgress > 0) {
          console.log(
            `[SyncService] ⚠️  BLOCKING syncDown: ${stats.pending} pending changes must upload first`
          );
          try {
            await this.syncEngine.syncUpFromOutbox();
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
      }

      const result = await this.syncEngine.syncDown();

      // Ensure remote changes survive a quick refresh.
      // Relying solely on `beforeunload`/interval persistence is unreliable because
      // async work may be aborted during navigation.
      try {
        await getSyncRuntime().persistDb?.();
      } catch (error) {
        console.warn(
          "[SyncService] Failed to persist DB after syncDown:",
          error
        );
      }

      // Notify callback (same as sync() method)
      this.config.onSyncComplete?.(result);

      return result;
    } catch (error) {
      // Call onSyncComplete even on errors so UI can react
      const errorResult = this.createErrorResult(error);
      this.config.onSyncComplete?.(errorResult);
      throw error; // Re-throw to maintain error propagation
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Scoped syncDown: pull remote changes only for specified tables.
   * Still uploads pending local changes first to avoid zombie resurrect.
   */
  public async syncDownTables(tables: SyncableTable[]): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new SyncInProgressError();
    }

    this.isSyncing = true;
    try {
      if (!this.config.pullOnly) {
        const stats = await this.syncEngine.getOutboxStats();
        if (stats.pending > 0 || stats.inProgress > 0) {
          console.log(
            `[SyncService] ⚠️  BLOCKING scoped syncDown: ${stats.pending} pending changes must upload first`
          );
          try {
            await this.syncEngine.syncUpFromOutbox();
            console.log(
              "[SyncService] ✅ Pending changes uploaded - scoped syncDown safe"
            );
          } catch (error) {
            console.error(
              "[SyncService] ❌ Failed to upload pending changes before scoped syncDown:",
              error
            );
            throw new Error(
              "Cannot run scoped syncDown while pending changes exist - upload failed."
            );
          }
        }
      }

      // Access SyncEngine private method via index cast (method is public we added).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine: any = this.syncEngine as any;
      const result: SyncResult = await engine.syncDownTables(tables);

      try {
        await getSyncRuntime().persistDb?.();
      } catch (error) {
        console.warn(
          "[SyncService] Failed to persist DB after scoped syncDown:",
          error
        );
      }

      this.config.onSyncComplete?.(result);
      return result;
    } catch (error) {
      // Call onSyncComplete even on errors so UI can react
      const errorResult = this.createErrorResult(error);
      this.config.onSyncComplete?.(errorResult);
      throw error; // Re-throw to maintain error propagation
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Start automatic background sync
   *
   * Strategy:
   * - syncDown: Once on startup, then every 2 minutes (pull remote changes - outbox-driven, cheap)
   * - syncUp: Every 30 seconds (push local changes - only if pending, so free when idle)
   *
   * Cost when idle: 1 Postgres query of sync_outbox every 2 minutes
   */
  public startAutoSync(): void {
    if (this.syncIntervalId) {
      console.warn("[SyncService] Auto sync already running");
      return;
    }

    // Sync intervals - cheap due to outbox-driven architecture:
    // - syncUp only makes network call if local outbox has pending items
    // - syncDown queries server sync_outbox (1 query) and only fetches changed rows
    const syncUpIntervalMs = this.config.syncIntervalMs ?? 30_000; // 30 seconds
    const syncDownIntervalMs = 2 * 60 * 1000; // 2 minutes

    // Initial syncDown on startup.
    // IMPORTANT: Never attempt startup sync while offline.
    // - In offline mode, syncDown() may try to syncUp first.
    // - syncUp can legitimately prune outbox entries when it can't find the local row.
    // Deferring avoids unexpected outbox mutation during offline reload flows.
    let initialSyncDownInFlight = false;
    let initialSyncDownCompleted = false;

    const runInitialSyncDown = () => {
      if (initialSyncDownInFlight || initialSyncDownCompleted) return;
      if (!navigator.onLine) return;

      initialSyncDownInFlight = true;
      void (async () => {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          if (!navigator.onLine) {
            console.log(
              "[SyncService] Went offline during initial syncDown; deferring until online"
            );
            window.addEventListener("online", runInitialSyncDown, {
              once: true,
            });
            return;
          }

          try {
            console.log(
              `[SyncService] Running initial syncDown (attempt ${attempt}/${maxAttempts})...`
            );
            await this.syncDown();
            initialSyncDownCompleted = true;
            return;
          } catch (error) {
            if (error instanceof SyncInProgressError) {
              // Expected when other sync activity is running; retry shortly without toasting.
              await new Promise((r) => setTimeout(r, 250));
              attempt -= 1;
              continue;
            }

            const delayMs = 500 * attempt;
            const isLastAttempt = attempt === maxAttempts;

            if (!isLastAttempt) {
              console.warn(
                `[SyncService] Initial syncDown failed (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms:`,
                error
              );
              await new Promise((r) => setTimeout(r, delayMs));
              continue;
            }

            console.error("[SyncService] Initial syncDown failed:", error);
            toast.error(
              "Failed to sync data from server on startup. You may be seeing outdated data.",
              {
                duration: 8000,
              }
            );
          }
        }
      })().finally(() => {
        initialSyncDownInFlight = false;
      });
    };

    if (navigator.onLine) {
      runInitialSyncDown();
    } else {
      console.log(
        "[SyncService] Offline on startup - deferring initial syncDown until online"
      );
      window.addEventListener("online", runInitialSyncDown, { once: true });
    }

    // Periodic syncUp (frequent - push local changes to server)
    // Only runs if there are pending changes to avoid unnecessary network calls
    if (!this.config.pullOnly) {
      this.syncIntervalId = window.setInterval(async () => {
        try {
          // Safety check: ensure database is initialized
          if (!this.db) {
            console.warn(
              "[SyncService] Database not initialized yet, skipping syncUp check"
            );
            return;
          }

          // Check if there are pending changes before syncing (using outbox)
          const stats = await this.syncEngine.getOutboxStats();
          const hasPendingChanges = stats.pending > 0 || stats.inProgress > 0;

          if (hasPendingChanges) {
            // Skip sync if offline (browser reports no connectivity)
            if (!navigator.onLine) {
              // Silently skip - this is expected behavior when offline
              return;
            }

            console.log(
              `[SyncService] Running periodic syncUp (${stats.pending} pending changes)...`
            );
            const result = await this.syncUp();
            // Only show error toast for non-network failures
            const hasNetworkError = result.errors.some(
              (e) =>
                e.includes("Failed to fetch") ||
                e.includes("ERR_INTERNET_DISCONNECTED") ||
                e.includes("NetworkError")
            );

            if (result.success) {
              this.consecutiveSyncUpFailures = 0;
            } else {
              this.consecutiveSyncUpFailures += 1;
            }

            // `itemsFailed` reflects local apply failures for pulled changes.
            // Push failures often surface only in `errors`, so toast on those too.
            if (!result.success && !hasNetworkError) {
              const shouldToast =
                this.consecutiveSyncUpFailures === 1 ||
                this.consecutiveSyncUpFailures === 5 ||
                this.consecutiveSyncUpFailures === 10;

              if (shouldToast) {
                const summary = result.errors[0] ?? "Unknown server error";
                toast.error(
                  `Sync upload failed (attempt ${this.consecutiveSyncUpFailures}). Your data is still saved locally. ${summary}`,
                  {
                    duration: 7000,
                  }
                );
              }
            }
          } else {
            // Silent - no need to log when there's nothing to sync
          }
        } catch (error) {
          // Silently skip if sync is already in progress (expected on slow connections)
          if (error instanceof SyncInProgressError) {
            console.debug(
              "[SyncService] Skipping periodic syncUp - sync already in progress"
            );
            return;
          }

          console.error("[SyncService] Error in periodic syncUp:", error);
          toast.error(
            "Background sync error. Your changes may not be uploaded.",
            {
              duration: 5000,
            }
          );
        }
      }, syncUpIntervalMs);
    }

    // Periodic syncDown (infrequent - pull remote changes from server)
    this.syncDownIntervalId = window.setInterval(() => {
      // Skip sync if offline (browser reports no connectivity)
      if (!navigator.onLine) {
        // Silently skip - this is expected behavior when offline
        return;
      }

      console.log("[SyncService] Running periodic syncDown...");
      void this.syncDown().catch((error) => {
        console.error("[SyncService] Periodic syncDown failed:", error);

        // Only show error toast for non-network failures
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isNetworkError =
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("ERR_INTERNET_DISCONNECTED") ||
          errorMsg.includes("NetworkError");

        if (!isNetworkError) {
          toast.error(
            "Failed to sync data from server. You may be seeing outdated data.",
            {
              duration: 5000,
            }
          );
        }
      });
    }, syncDownIntervalMs);

    if (this.config.pullOnly) {
      console.log(
        `[SyncService] Auto sync started (pull-only):`,
        `syncDown every ${syncDownIntervalMs / 1000 / 60} minutes`
      );
    } else {
      console.log(
        `[SyncService] Auto sync started:`,
        `syncUp every ${syncUpIntervalMs / 1000}s (only if changes pending),`,
        `syncDown every ${syncDownIntervalMs / 1000 / 60} minutes`
      );
    }
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
