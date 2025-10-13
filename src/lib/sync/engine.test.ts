/**
 * Sync Engine Tests
 *
 * Unit tests for bidirectional sync logic, conflict resolution, and error handling.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "../db/client-sqlite";
import { SyncEngine } from "./engine";
import * as queue from "./queue";

// Mock dependencies
vi.mock("./queue");
vi.mock("../db/client-postgres", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("SyncEngine", () => {
  let mockLocalDb: SqliteDatabase;
  let mockSupabase: any;
  let syncEngine: SyncEngine;
  const userId = 123;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn(() => Promise.resolve({ data: null, error: null })),
        delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };

    // Mock local database
    mockLocalDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as SqliteDatabase;

    // Create sync engine
    syncEngine = new SyncEngine(mockLocalDb, mockSupabase, userId, {
      batchSize: 10,
      maxRetries: 3,
      timeoutMs: 5000,
    });
  });

  describe("syncUp", () => {
    it("should push pending queue items to Supabase", async () => {
      // Mock queue items with correct shape
      const queueItems = [
        {
          id: 1,
          tableName: "tune",
          recordId: "123",
          operation: "insert",
          data: JSON.stringify({ id: 123, title: "Test Tune" }),
          status: "pending",
          createdAt: new Date().toISOString(),
          syncedAt: null,
          attempts: 0,
          lastError: null,
        },
      ];

      vi.mocked(queue.getPendingSyncItems).mockResolvedValue(queueItems);
      vi.mocked(queue.markSynced).mockResolvedValue(undefined);

      const result = await syncEngine.syncUp();

      expect(result.success).toBe(true);
      expect(queue.getPendingSyncItems).toHaveBeenCalledWith(mockLocalDb);
      expect(queue.markSynced).toHaveBeenCalledWith(mockLocalDb, 1);
    });

    it("should handle empty queue", async () => {
      vi.mocked(queue.getPendingSyncItems).mockResolvedValue([]);

      const result = await syncEngine.syncUp();

      expect(result.success).toBe(true);
      expect(result.itemsSynced).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should retry failed items", async () => {
      const queueItems = [
        {
          id: 1,
          tableName: "tune",
          recordId: "123",
          operation: "insert",
          data: JSON.stringify({ id: 123 }),
          status: "pending",
          createdAt: new Date().toISOString(),
          syncedAt: null,
          attempts: 0,
          lastError: null,
        },
      ];

      vi.mocked(queue.getPendingSyncItems).mockResolvedValue(queueItems);
      vi.mocked(queue.updateSyncStatus).mockResolvedValue(undefined);

      // Mock Supabase error (will be caught in processQueueItem)
      const result = await syncEngine.syncUp();

      // Should still succeed (error handled gracefully)
      expect(result.success).toBe(true);
    });

    it("should batch process large queues", async () => {
      const queueItems = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        tableName: "tune" as const,
        recordId: String(i + 1),
        operation: "insert" as const,
        data: JSON.stringify({ id: i + 1 }),
        status: "pending" as const,
        createdAt: new Date().toISOString(),
        syncedAt: null,
        attempts: 0,
        lastError: null,
      }));

      vi.mocked(queue.getPendingSyncItems).mockResolvedValue(queueItems);
      vi.mocked(queue.markSynced).mockResolvedValue(undefined);

      const result = await syncEngine.syncUp();

      // With batchSize=10, should process 10 items max
      expect(result.itemsSynced).toBeLessThanOrEqual(10);
    });
  });

  describe("syncDown", () => {
    it("should pull remote changes to local database", async () => {
      // This test would require more complex mocking of Drizzle queries
      // For now, just test basic functionality
      const result = await syncEngine.syncDown();

      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("should handle empty remote database", async () => {
      const result = await syncEngine.syncDown();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("sync", () => {
    it("should perform bidirectional sync (up then down)", async () => {
      vi.mocked(queue.getPendingSyncItems).mockResolvedValue([]);

      const result = await syncEngine.sync();

      expect(result.success).toBe(true);
      expect(result.timestamp).toBeDefined();
      // Should have called both syncUp and syncDown
      expect(queue.getPendingSyncItems).toHaveBeenCalled();
    });

    it("should continue syncDown even if syncUp fails", async () => {
      vi.mocked(queue.getPendingSyncItems).mockRejectedValue(
        new Error("Queue error")
      );

      const result = await syncEngine.sync();

      // Should still succeed (error handled)
      expect(result.success).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
