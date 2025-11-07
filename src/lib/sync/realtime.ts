/**
 * Supabase Realtime Integration
 *
 * Subscribes to PostgreSQL changes (INSERT, UPDATE, DELETE) and triggers local sync.
 * Filters by user_ref to only pull user's own data.
 *
 * Architecture:
 * - Listens to Supabase Realtime channels (one per table)
 * - On remote change → triggers syncDown() for affected table
 * - Handles connection state (connected, disconnected, error)
 * - Automatically reconnects on network recovery
 */

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { SyncEngine } from "./engine";
import type { SyncableTable } from "./queue";

// Debug flag for realtime logging
const REALTIME_DEBUG = import.meta.env.VITE_SYNC_DEBUG === "true";
const realtimeLog = (...args: any[]) => REALTIME_DEBUG && console.log(...args);

export interface RealtimeConfig {
  enabled: boolean;
  tables: SyncableTable[];
  // Supabase Auth user id (UUID string)
  userId: string | null;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onSync?: (tableName: string) => void;
}

export type RealtimeStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "connecting";

export interface RealtimeState {
  status: RealtimeStatus;
  channels: Map<string, RealtimeChannel>;
  lastSync: Map<string, Date>;
  errors: Error[];
}

/**
 * Manages Supabase Realtime subscriptions for live sync
 */
export class RealtimeManager {
  private syncEngine: SyncEngine;
  private config: RealtimeConfig;
  private state: RealtimeState;

  constructor(syncEngine: SyncEngine, config: RealtimeConfig) {
    this.syncEngine = syncEngine;
    this.config = config;
    this.state = {
      status: "disconnected",
      channels: new Map(),
      lastSync: new Map(),
      errors: [],
    };
  }

  /**
   * Start listening to Realtime changes
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.warn("[Realtime] Realtime sync disabled in config");
      return;
    }

    if (!this.config.userId) {
      console.warn("[Realtime] Cannot start - no userId provided");
      return;
    }

    console.log(
      `[Realtime] Starting Realtime subscriptions for user ${this.config.userId}`,
    );
    this.state.status = "connecting";

    try {
      // Subscribe to each table
      for (const tableName of this.config.tables) {
        await this.subscribeToTable(tableName);
      }

      this.state.status = "connected";
      this.config.onConnected?.();
      realtimeLog("[Realtime All subscriptions active");
    } catch (error) {
      this.state.status = "error";
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.errors.push(err);
      this.config.onError?.(err);
      console.error("[Realtime] Failed to start:", error);
    }
  }

  /**
   * Stop all Realtime subscriptions
   */
  async stop(): Promise<void> {
    realtimeLog("[Realtime Stopping all subscriptions");

    for (const [tableName, channel] of this.state.channels.entries()) {
      await supabase.removeChannel(channel);
      console.log(`[Realtime] Unsubscribed from ${tableName}`);
    }

    this.state.channels.clear();
    this.state.status = "disconnected";
    this.config.onDisconnected?.();
  }

  /**
   * Subscribe to a single table's changes
   */
  private async subscribeToTable(tableName: SyncableTable): Promise<void> {
    // Create channel name (unique per table)
    const channelName = `realtime:${tableName}:${this.config.userId}`;

    console.log(
      `[Realtime] Subscribing to ${tableName} (channel: ${channelName})`,
    );

    // Create channel
    const channel = supabase.channel(channelName);

    // Subscribe to PostgreSQL changes with user_ref filter
    channel
      .on<Record<string, unknown>>(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: tableName,
          filter: `user_ref=eq.${this.config.userId}`, // Only this user's data
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          this.handleChange(tableName, payload);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] ✓ Subscribed to ${tableName}`);
        } else if (status === "CHANNEL_ERROR") {
          console.error(`[Realtime] ✗ Channel error for ${tableName}`);
          this.state.status = "error";
        } else if (status === "TIMED_OUT") {
          console.error(`[Realtime] ✗ Subscription timeout for ${tableName}`);
          this.state.status = "error";
        } else if (status === "CLOSED") {
          console.log(`[Realtime] Channel closed for ${tableName}`);
        }
      });

    // Store channel reference
    this.state.channels.set(tableName, channel);
  }

  /**
   * Handle a single Realtime change event
   */
  private handleChange(
    tableName: string,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    console.log(`[Realtime] ${eventType} on ${tableName}:`, {
      new: newRecord,
      old: oldRecord,
    });

    // Debounce: Skip if we just synced this table recently (< 1 second ago)
    const lastSync = this.state.lastSync.get(tableName);
    if (lastSync && Date.now() - lastSync.getTime() < 1000) {
      console.log(`[Realtime] Skipping ${tableName} - recently synced`);
      return;
    }

    // Trigger sync for this table
    this.syncTableDown(tableName);
  }

  /**
   * Sync a specific table from remote to local
   */
  private async syncTableDown(tableName: string): Promise<void> {
    try {
      console.log(`[Realtime] Syncing ${tableName} down from Supabase...`);

      // Call sync engine's syncDown for this specific table
      // TODO: Add syncTableDown method to SyncEngine class
      // await this.syncEngine.syncTableDown(tableName);

      // For now, do a full syncDown
      await this.syncEngine.syncDown();

      // Update last sync timestamp
      this.state.lastSync.set(tableName, new Date());

      // Notify callback
      this.config.onSync?.(tableName);

      console.log(`[Realtime] ✓ ${tableName} synced successfully`);
    } catch (error) {
      console.error(`[Realtime] Failed to sync ${tableName}:`, error);
      const err = error instanceof Error ? error : new Error(String(error));
      this.state.errors.push(err);
      this.config.onError?.(err);
    }
  }

  /**
   * Get current Realtime status
   */
  getStatus(): RealtimeStatus {
    return this.state.status;
  }

  /**
   * Check if Realtime is active
   */
  isActive(): boolean {
    return this.state.status === "connected";
  }

  /**
   * Get active channels
   */
  getChannels(): string[] {
    return Array.from(this.state.channels.keys());
  }

  /**
   * Get last sync time for a table
   */
  getLastSync(tableName: string): Date | undefined {
    return this.state.lastSync.get(tableName);
  }

  /**
   * Get all errors
   */
  getErrors(): Error[] {
    return [...this.state.errors];
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.state.errors = [];
  }

  /**
   * Manually reconnect (useful after network recovery)
   */
  async reconnect(): Promise<void> {
    realtimeLog("[Realtime Reconnecting...");
    await this.stop();
    await this.start();
  }

  /**
   * Update config (e.g., when user changes)
   */
  updateConfig(newConfig: Partial<RealtimeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Create and configure Realtime manager
 */
export function createRealtimeManager(
  syncEngine: SyncEngine,
  config: RealtimeConfig,
): RealtimeManager {
  return new RealtimeManager(syncEngine, config);
}
