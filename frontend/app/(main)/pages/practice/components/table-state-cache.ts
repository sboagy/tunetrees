"use client";

import type { TableState } from "@tanstack/react-table";
import { updateTableStateInDb } from "../settings";
import type { TablePurpose } from "../types";

/**
 * Cache entry for a specific table state
 */
interface ICachedTableState {
  userId: number;
  tablePurpose: TablePurpose;
  playlistId: number;
  tableState: Partial<TableState>;
  isDirty: boolean;
  lastUpdated: number;
}

/**
 * Service that caches table state changes locally and batches updates to the backend
 */
class TableStateCacheService {
  private cache = new Map<string, ICachedTableState>();
  private pollIntervalMs = 2500; // Check for changes every 2.5 seconds
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private debugMode = false;

  /**
   * Helper to determine whether we should emit debug/warn logs.
   * Controlled by explicit setDebugMode or the TABLE_STATE_DEBUG env var.
   */
  private shouldLog(): boolean {
    if (this.debugMode) return true;
    try {
      // Check env var (works in Node/test environments). Use string checks for flexibility.
      const v =
        typeof process !== "undefined"
          ? process.env?.TABLE_STATE_DEBUG
          : undefined;
      return v === "1" || v === "true";
    } catch {
      return false;
    }
  }

  /**
   * Enable debug logging for testing
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  private debugLog(message: string, ...args: unknown[]): void {
    if (this.shouldLog()) {
      console.log(`[TableStateCache] ${message}`, ...args);
    }
  }

  /**
   * Generate a unique key for a table state entry
   */
  private getKey(
    userId: number,
    tablePurpose: TablePurpose,
    playlistId: number,
  ): string {
    return `${userId}|${tablePurpose}|${playlistId}`;
  }

  /**
   * Start the background polling process
   */
  private startPolling(): void {
    if (this.isPolling || typeof window === "undefined") {
      return;
    }

    this.isPolling = true;
    this.pollTimer = setInterval(() => {
      void this.processDirtyEntries();
    }, this.pollIntervalMs);
  }

  /**
   * Stop the background polling process
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
  }

  /**
   * Process all dirty entries and update the backend
   */
  private async processDirtyEntries(): Promise<void> {
    const dirtyEntries = [...this.cache.values()].filter(
      (entry) => entry.isDirty,
    );

    if (dirtyEntries.length === 0) {
      return;
    }

    this.debugLog(`Processing ${dirtyEntries.length} dirty entries`);
    if (this.shouldLog()) {
      console.debug(
        `[TableStateCache] Processing ${dirtyEntries.length} dirty entries`,
      );
    }

    // Process each dirty entry
    const updatePromises = dirtyEntries.map(async (entry) => {
      try {
        const status = await updateTableStateInDb(
          entry.userId,
          "full",
          entry.tablePurpose,
          entry.playlistId,
          entry.tableState as TableState,
        );

        if (status >= 200 && status < 300) {
          // Mark as clean on successful update
          entry.isDirty = false;
          this.debugLog(
            `Successfully updated state for ${entry.tablePurpose}, playlistId=${entry.playlistId}`,
          );
          if (this.shouldLog()) {
            console.debug(
              `[TableStateCache] Successfully updated state for ${entry.tablePurpose}, playlistId=${entry.playlistId}`,
            );
          }
        } else {
          this.debugLog(
            `Failed to update state for ${entry.tablePurpose}, status=${status}`,
          );
          if (this.shouldLog()) {
            console.warn(
              `[TableStateCache] Failed to update state for ${entry.tablePurpose}, status=${status}`,
            );
          }
        }
      } catch (error) {
        console.error(
          `[TableStateCache] Error updating state for ${entry.tablePurpose}:`,
          error,
        );
      }
    });

    await Promise.allSettled(updatePromises);
  }

  /**
   * Cache a table state change (non-blocking)
   */
  public cacheUpdate(
    userId: number,
    tablePurpose: TablePurpose,
    playlistId: number,
    tableStateOverride?: Partial<TableState>,
  ): void {
    if (playlistId <= 0 || !userId) {
      if (this.shouldLog()) {
        console.warn(
          "[TableStateCache] Skipping cache update - invalid parameters",
        );
      }
      return;
    }

    const key = this.getKey(userId, tablePurpose, playlistId);
    const existing = this.cache.get(key);

    if (existing && tableStateOverride) {
      // Merge the override with existing state
      existing.tableState = { ...existing.tableState, ...tableStateOverride };
      existing.isDirty = true;
      existing.lastUpdated = Date.now();
    } else if (tableStateOverride) {
      // Create new cache entry
      this.cache.set(key, {
        userId,
        tablePurpose,
        playlistId,
        tableState: tableStateOverride,
        isDirty: true,
        lastUpdated: Date.now(),
      });
    }

    // Start polling if not already running
    this.startPolling();
  }

  /**
   * Immediately flush a specific entry to the backend (for critical events)
   */
  public async flushImmediate(
    userId: number,
    tablePurpose: TablePurpose,
    playlistId: number,
    tableStateOverride?: Partial<TableState>,
  ): Promise<number> {
    if (this.shouldLog()) {
      console.debug(
        `[TableStateCache] Immediate flush for ${tablePurpose}, playlistId=${playlistId}`,
      );
    }

    const key = this.getKey(userId, tablePurpose, playlistId);
    let tableStateToFlush: Partial<TableState>;

    if (tableStateOverride) {
      // If an override is provided, use it and merge with cached state
      const existing = this.cache.get(key);
      tableStateToFlush = existing
        ? { ...existing.tableState, ...tableStateOverride }
        : tableStateOverride;
    } else {
      // Use cached state only
      const existing = this.cache.get(key);
      if (!existing || !existing.isDirty) {
        if (this.shouldLog()) {
          console.debug(
            `[TableStateCache] No dirty state to flush for ${tablePurpose}`,
          );
        }
        return 200; // Nothing to flush
      }
      tableStateToFlush = existing.tableState;
    }

    try {
      const status = await updateTableStateInDb(
        userId,
        "full",
        tablePurpose,
        playlistId,
        tableStateToFlush as TableState,
      );

      if (status >= 200 && status < 300) {
        // Mark as clean after successful immediate flush
        const existing = this.cache.get(key);
        if (existing) {
          existing.isDirty = false;
        }
      }

      return status;
    } catch (error) {
      console.error("[TableStateCache] Error during immediate flush:", error);
      return 500;
    }
  }

  /**
   * Flush all dirty entries immediately (for shutdown/cleanup)
   */
  public async flushAll(): Promise<void> {
    this.stopPolling();
    await this.processDirtyEntries();
  }

  /**
   * Clear the cache (for testing or cleanup)
   */
  public clear(): void {
    this.stopPolling();
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  public getStats(): { totalEntries: number; dirtyEntries: number } {
    const dirtyCount = [...this.cache.values()].filter(
      (entry) => entry.isDirty,
    ).length;
    return {
      totalEntries: this.cache.size,
      dirtyEntries: dirtyCount,
    };
  }
}

// Singleton instance
const tableStateCacheService = new TableStateCacheService();

// Global cleanup on page unload to ensure all cached state is flushed
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    // Note: This is synchronous but we can't await in beforeunload
    // The polling should have handled most updates already
    void tableStateCacheService.flushAll();
  });
}

export { tableStateCacheService, type ICachedTableState };
