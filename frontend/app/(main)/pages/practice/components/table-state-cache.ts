"use client";

import type { TableState } from "@tanstack/react-table";
import deepEqual from "fast-deep-equal";
import { getTableStateTable, updateTableStateInDb } from "../settings";
import type { ScreenSize, TablePurpose } from "../types";

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
  // Cache entries keyed by userId|purpose|playlist
  private cache = new Map<string, ICachedTableState>();
  // One-shot flush timer, started when state becomes dirty; no polling loop
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushDelayMs = 2500; // align with original ~2.5s cadence
  private isFlushing = false;
  private debugMode = false;
  // Periodic refresh
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshIntervalMs = 30000; // 30s periodic server check
  // Deduplicate concurrent GETs for the same key
  private inflightFetches = new Map<
    string,
    Promise<{
      settings: Partial<TableState> | null;
      current_tune?: number | null;
    } | null>
  >();

  // Test-only cache busting: fetch an epoch from a Next.js API route and
  // clear local caches when it changes. This helps when Playwright reuses
  // the same browser/server between tests.
  private lastEpoch: number = 0;
  private lastEpochCheckedAt: number = 0;
  private epochCheckThrottleMs = 1000; // at most once per second

  private async checkAndMaybeClearForTestEpoch(): Promise<void> {
    try {
      // Only in browser and only when running with test envs
      if (typeof window === "undefined") return;
      const now = Date.now();
      if (now - this.lastEpochCheckedAt < this.epochCheckThrottleMs) return;
      this.lastEpochCheckedAt = now;
      const res = await fetch("/api/test-flags/cache-epoch", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { epoch?: number };
      const epoch = Number(data?.epoch ?? 0);
      if (Number.isFinite(epoch) && epoch > this.lastEpoch) {
        this.clear();
        this.inflightFetches.clear();
        this.lastEpoch = epoch;
        if (this.shouldLog()) {
          console.debug("[TableStateCache] Cleared by epoch", epoch);
        }
      }
    } catch {
      // ignore (endpoint may not exist outside tests)
    }
  }

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

  // Deep compare table state objects to detect nested changes reliably
  private shallowEqual(
    a?: Partial<TableState>,
    b?: Partial<TableState>,
  ): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return deepEqual(a, b);
  }

  /**
   * Retrieve and increment a per-table local version counter, stored on window
   * so it persists across component instances in the same tab.
   */
  private nextClientVersion(
    userId: number,
    tablePurpose: TablePurpose,
    playlistId: number,
  ): number {
    try {
      if (typeof window === "undefined") return 0;
      const key = this.getKey(userId, tablePurpose, playlistId);
      const w = window as unknown as {
        __TT_TABLE_VERSION__?: Record<string, number>;
      };
      w.__TT_TABLE_VERSION__ = w.__TT_TABLE_VERSION__ || {};
      const next = (w.__TT_TABLE_VERSION__[key] ?? 0) + 1;
      w.__TT_TABLE_VERSION__[key] = next;
      return next;
    } catch {
      return 0;
    }
  }

  // Start a one-shot flush timer if not already pending
  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushOnce();
    }, this.flushDelayMs);
  }

  // Start periodic server refresh. Safe to call multiple times.
  private startPeriodicRefresh(): void {
    if (typeof window === "undefined") return; // client-only
    if (this.refreshTimer) return;
    this.refreshTimer = setInterval(() => {
      void this.refreshOnce();
    }, this.refreshIntervalMs);
  }

  // Stop periodic refresh (mainly for tests/cleanup)
  public stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Perform one refresh pass: for non-dirty entries, fetch server and accept only newer versions
  private async refreshOnce(): Promise<void> {
    const entries = [...this.cache.entries()];
    for (const [key, entry] of entries) {
      if (entry.isDirty) continue; // don't stomp local unflushed edits
      try {
        const tableStateTable = await getTableStateTable(
          entry.userId,
          "full",
          entry.tablePurpose,
          entry.playlistId,
        );
        if (!tableStateTable) continue;
        const serverSettings =
          (tableStateTable.settings as Partial<TableState>) ?? {};
        // Determine versions
        const localVersion =
          (entry.tableState as unknown as { clientVersion?: number })
            .clientVersion ?? 0;
        const serverVersion =
          (serverSettings as unknown as { clientVersion?: number })
            .clientVersion ?? 0;
        if (serverVersion > localVersion) {
          this.cache.set(key, {
            ...entry,
            tableState: serverSettings,
            isDirty: false,
            lastUpdated: Date.now(),
          });
          if (this.shouldLog()) {
            console.debug(
              `[TableStateCache][refresh] Accepted newer server state for ${entry.tablePurpose} (playlistId=${entry.playlistId}) v${serverVersion} > v${localVersion}`,
            );
          }
        }
      } catch {
        // ignore transient server errors
      }
    }
  }

  // Perform a single flush pass over all dirty entries
  private async flushOnce(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;
    try {
      const dirtyEntries = [...this.cache.values()].filter((e) => e.isDirty);
      if (dirtyEntries.length === 0) return;
      for (const entry of dirtyEntries) {
        if (this.shouldLog()) {
          console.debug(
            `[TableStateCache][flush] keys=${Object.keys(
              (entry.tableState as TableState) || {},
            ).join(
              ",",
            )} playlistId=${entry.playlistId} purpose=${entry.tablePurpose}`,
          );
        }
        const payload: TableState & { [k: string]: unknown } = {
          ...(entry.tableState as TableState),
          clientVersion: this.nextClientVersion(
            entry.userId,
            entry.tablePurpose,
            entry.playlistId,
          ),
        };
        try {
          const status = await updateTableStateInDb(
            entry.userId,
            "full",
            entry.tablePurpose,
            entry.playlistId,
            payload,
          );
          if (status >= 200 && status < 300) {
            entry.isDirty = false;
            // Persist the clientVersion we just sent into the cached state so
            // future hydration/version checks can compare accurately.
            try {
              const sentVersion = (
                payload as unknown as {
                  clientVersion?: number;
                }
              ).clientVersion;
              entry.tableState = {
                ...(entry.tableState as TableState),
                clientVersion: sentVersion,
              } as Partial<TableState>;
            } catch {
              // ignore non-critical cache annotate errors
            }
            this.debugLog(
              `Updated state for ${entry.tablePurpose} (playlistId=${entry.playlistId})`,
            );
          } else {
            this.debugLog(
              `Failed to update state for ${entry.tablePurpose}, status=${status}`,
            );
          }
        } catch (error) {
          console.error(
            `[TableStateCache] Error updating state for ${entry.tablePurpose}:`,
            error,
          );
        }
      }
    } catch (error) {
      console.error("[TableStateCache] Error during flushOnce:", error);
    } finally {
      this.isFlushing = false;
    }
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
    if (!tableStateOverride) return;
    const existing = this.cache.get(key);
    if (existing) {
      const merged = { ...existing.tableState, ...tableStateOverride };
      const changed = !this.shallowEqual(existing.tableState, merged);
      existing.tableState = merged;
      if (changed) {
        existing.isDirty = true;
        existing.lastUpdated = Date.now();
        if (this.shouldLog()) {
          console.debug(
            `[TableStateCache][cacheUpdate:merge] key=${key} keys=${Object.keys(
              merged as TableState,
            ).join(",")}`,
          );
        }
      }
    } else {
      this.cache.set(key, {
        userId,
        tablePurpose,
        playlistId,
        tableState: tableStateOverride,
        isDirty: true,
        lastUpdated: Date.now(),
      });
      if (this.shouldLog()) {
        console.debug(
          `[TableStateCache][cacheUpdate:new] key=${key} keys=${Object.keys(
            tableStateOverride as TableState,
          ).join(",")}`,
        );
      }
    }

    // Schedule a background flush only if we dirtied an entry
    const e = this.cache.get(key);
    if (e?.isDirty) this.scheduleFlush();
    // Ensure refresh loop is active after first write
    this.startPeriodicRefresh();
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

    const existing = this.cache.get(key);
    if (tableStateOverride) {
      const merged = existing
        ? { ...existing.tableState, ...tableStateOverride }
        : tableStateOverride;
      if (existing) {
        const changed = !this.shallowEqual(existing.tableState, merged);
        existing.tableState = merged;
        if (!changed && !existing.isDirty) {
          return 200; // no-op
        }
        existing.isDirty = true;
        existing.lastUpdated = Date.now();
      } else {
        this.cache.set(key, {
          userId,
          tablePurpose,
          playlistId,
          tableState: merged,
          isDirty: true,
          lastUpdated: Date.now(),
        });
      }
      tableStateToFlush = merged;
    } else {
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
      // Attach a fresh clientVersion to the outgoing payload
      const payload: TableState & { [k: string]: unknown } = {
        ...(tableStateToFlush as TableState),
        clientVersion: this.nextClientVersion(userId, tablePurpose, playlistId),
      };

      const status = await updateTableStateInDb(
        userId,
        "full",
        tablePurpose,
        playlistId,
        payload,
      );

      if (status >= 200 && status < 300) {
        // Mark as clean after successful immediate flush
        const post = this.cache.get(key);
        if (post) {
          post.isDirty = false;
          // Stamp the clientVersion back into the cached tableState for consistency
          try {
            const sentVersion = (
              payload as unknown as {
                clientVersion?: number;
              }
            ).clientVersion;
            post.tableState = {
              ...(post.tableState as TableState),
              clientVersion: sentVersion,
            } as Partial<TableState>;
          } catch {
            // ignore
          }
        }
        // Start timer in case there are subsequent updates
        this.scheduleFlush();
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
    await this.flushOnce();
  }

  /**
   * Clear the cache (for testing or cleanup)
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  public getStats(): { totalEntries: number; dirtyEntries: number } {
    const dirtyCount = [...this.cache.values()].filter((e) => e.isDirty).length;
    return {
      totalEntries: this.cache.size,
      dirtyEntries: dirtyCount,
    };
  }

  /**
   * Return cached state if present, else undefined.
   */
  public getCached(
    userId: number,
    tablePurpose: TablePurpose,
    playlistId: number,
  ): Partial<TableState> | undefined {
    const key = this.getKey(userId, tablePurpose, playlistId);
    return this.cache.get(key)?.tableState;
  }

  /**
   * Read-through: return cached state if available; otherwise fetch, cache, and return it.
   */
  public async getOrFetch(
    userId: number,
    screenSize: ScreenSize,
    tablePurpose: TablePurpose,
    playlistId: number,
  ): Promise<Partial<TableState> | null> {
    const cached = this.getCached(userId, tablePurpose, playlistId);
    if (cached) return cached;
    try {
      const full = await this.getOrFetchFull(
        userId,
        screenSize,
        tablePurpose,
        playlistId,
      );
      return full?.settings ?? null;
    } catch (error) {
      console.error("[TableStateCache] getOrFetch error:", error);
      return null;
    }
  }

  /**
   * Read-through with dedupe: returns full table state table (settings + current_tune) and caches settings.
   */
  public async getOrFetchFull(
    userId: number,
    screenSize: ScreenSize,
    tablePurpose: TablePurpose,
    playlistId: number,
  ): Promise<{
    settings: Partial<TableState> | null;
    current_tune?: number | null;
  } | null> {
    // Test cache clear hook: non-blocking
    void this.checkAndMaybeClearForTestEpoch();
    const key = this.getKey(userId, tablePurpose, playlistId);
    const inflight = this.inflightFetches.get(key);
    if (inflight) return inflight;
    const p = (async () => {
      try {
        const tableStateTable = await getTableStateTable(
          userId,
          screenSize,
          tablePurpose,
          playlistId,
        );
        if (!tableStateTable) return null;
        const settings =
          (tableStateTable.settings as Partial<TableState>) ?? {};
        // Only seed/refresh cache if server isn't older than local cached version.
        try {
          const existing = this.cache.get(key);
          // Prefer the cached clientVersion; fall back to window epoch if present.
          let localVersion = 0;
          const cachedVersion = (
            existing?.tableState as unknown as {
              clientVersion?: number;
            }
          )?.clientVersion;
          if (typeof cachedVersion === "number") localVersion = cachedVersion;
          try {
            if (typeof window !== "undefined") {
              const w = window as unknown as {
                __TT_TABLE_VERSION__?: Record<string, number>;
              };
              const epoch =
                w.__TT_TABLE_VERSION__?.[
                  this.getKey(userId, tablePurpose, playlistId)
                ] ?? 0;
              localVersion = Math.max(localVersion, epoch);
            }
          } catch {
            /* ignore */
          }
          const serverVersion =
            (
              settings as unknown as {
                clientVersion?: number;
              }
            )?.clientVersion ?? 0;
          if (serverVersion >= localVersion || !existing) {
            // Server is at least as new, or no existing cache: accept and seed.
            this.cache.set(key, {
              userId,
              tablePurpose,
              playlistId,
              tableState: settings,
              isDirty: false,
              lastUpdated: Date.now(),
            });
          } else if (this.shouldLog()) {
            console.debug(
              `[TableStateCache][getOrFetchFull] Skipping cache overwrite: serverVersion=${serverVersion} < localVersion=${localVersion} (key=${key})`,
            );
          }
        } catch {
          // On any unexpected error, fall back to seeding cache to avoid null paths
          this.cache.set(key, {
            userId,
            tablePurpose,
            playlistId,
            tableState: settings,
            isDirty: false,
            lastUpdated: Date.now(),
          });
        }
        // Ensure refresh loop is active after first fetch
        this.startPeriodicRefresh();
        return {
          settings,
          current_tune:
            tableStateTable.current_tune !== undefined
              ? tableStateTable.current_tune
              : null,
        };
      } catch (error) {
        console.error("[TableStateCache] getOrFetchFull error:", error);
        return null;
      } finally {
        this.inflightFetches.delete(key);
      }
    })();
    this.inflightFetches.set(key, p);
    return p;
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
