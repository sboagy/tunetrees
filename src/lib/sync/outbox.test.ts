/**
 * Tests for Sync Outbox Operations
 *
 * @module lib/sync/outbox.test
 */

import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../services/test-schema-loader";
import {
  backfillOutboxForTable,
  clearOldOutboxItems,
  fetchLocalRowByPrimaryKey,
  getDrizzleTable,
  getOutboxStats,
  getPendingOutboxItems,
  markOutboxCompleted,
  markOutboxFailed,
  markOutboxInProgress,
  markOutboxPermanentlyFailed,
  parseRowId,
} from "./outbox";

// Test database setup
let db: BetterSQLite3Database;

// Setup fresh database before each test
beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;

  // Load production schema from Drizzle migrations
  applyMigrations(db);
});

// Helper to insert outbox items
function insertOutboxItem(
  id: string,
  tableName: string,
  rowId: string,
  operation: string,
  status = "pending",
  changedAt = new Date().toISOString(),
  attempts = 0,
  lastError: string | null = null
): void {
  db.run(sql`
    INSERT INTO sync_push_queue (id, table_name, row_id, operation, status, changed_at, attempts, last_error)
    VALUES (${id}, ${tableName}, ${rowId}, ${operation}, ${status}, ${changedAt}, ${attempts}, ${lastError})
  `);
}

// Helper to insert tune
function insertTune(
  id: string,
  title: string | null = null,
  type: string | null = null
): void {
  db.run(sql`
    INSERT INTO tune (id, title, type, deleted, sync_version, last_modified_at)
    VALUES (${id}, ${title}, ${type}, 0, 1, datetime('now'))
  `);
}

function insertUserProfile(supabaseUserId: string): void {
  db.run(sql`
    INSERT INTO user_profile (supabase_user_id, id, deleted, sync_version, last_modified_at)
    VALUES (${supabaseUserId}, ${supabaseUserId}, 0, 1, datetime('now'))
  `);
}

function insertPlaylist(playlistId: string, userRef: string): void {
  db.run(sql`
    INSERT INTO playlist (playlist_id, user_ref, deleted, sync_version, last_modified_at)
    VALUES (${playlistId}, ${userRef}, 0, 1, datetime('now'))
  `);
}

// Helper to insert genre_tune_type (composite key)
function insertGenreTuneType(genreId: string, tuneTypeId: string): void {
  // First ensure the referenced genres and tune_types exist
  // Using try/catch since INSERT OR IGNORE doesn't work well with sql template
  try {
    db.run(sql`INSERT INTO genre (id, name) VALUES (${genreId}, ${genreId})`);
  } catch {
    // Ignore duplicate key errors
  }
  try {
    db.run(
      sql`INSERT INTO tune_type (id, name) VALUES (${tuneTypeId}, ${tuneTypeId})`
    );
  } catch {
    // Ignore duplicate key errors
  }
  db.run(sql`
    INSERT INTO genre_tune_type (genre_id, tune_type_id)
    VALUES (${genreId}, ${tuneTypeId})
  `);
}

describe("Sync Outbox Operations", () => {
  describe("backfillOutboxForTable", () => {
    it("creates outbox rows for recent practice_record rows", async () => {
      insertUserProfile("sb-1");
      insertPlaylist("pl-1", "sb-1");
      insertTune("t-1", "Tune", "reel");

      db.run(sql`
        INSERT INTO practice_record (id, playlist_ref, tune_ref, practiced, sync_version, last_modified_at)
        VALUES ('pr-1', 'pl-1', 't-1', '2025-12-27T00:00:00.000Z', 1, '2025-12-27T00:00:00.000Z')
      `);
      db.run(sql`
        INSERT INTO practice_record (id, playlist_ref, tune_ref, practiced, sync_version, last_modified_at)
        VALUES ('pr-2', 'pl-1', 't-1', '2025-12-27T00:00:01.000Z', 1, '2025-12-27T00:00:01.000Z')
      `);

      const inserted = await backfillOutboxForTable(
        db as any,
        "practice_record",
        "2025-12-26T00:00:00.000Z"
      );
      expect(inserted).toBe(2);

      const outbox = await db.all(sql`
        SELECT table_name, row_id, status, operation
        FROM sync_push_queue
        WHERE table_name = 'practice_record'
        ORDER BY row_id
      `);
      expect(outbox).toEqual([
        {
          table_name: "practice_record",
          row_id: "pr-1",
          status: "pending",
          operation: "UPDATE",
        },
        {
          table_name: "practice_record",
          row_id: "pr-2",
          status: "pending",
          operation: "UPDATE",
        },
      ]);
    });

    it("is idempotent for already-queued rows", async () => {
      insertUserProfile("sb-1");
      insertPlaylist("pl-1", "sb-1");
      insertTune("t-1", "Tune", "reel");

      db.run(sql`
        INSERT INTO practice_record (id, playlist_ref, tune_ref, practiced, sync_version, last_modified_at)
        VALUES ('pr-3', 'pl-1', 't-1', '2025-12-27T00:00:02.000Z', 1, '2025-12-27T00:00:02.000Z')
      `);
      insertOutboxItem(
        "item-pr-3",
        "practice_record",
        "pr-3",
        "UPDATE",
        "pending",
        "2025-12-27T00:00:03.000Z"
      );

      const inserted = await backfillOutboxForTable(
        db as any,
        "practice_record",
        "2025-12-26T00:00:00.000Z"
      );
      expect(inserted).toBe(0);

      const count = (
        db.all(sql`
        SELECT COUNT(*) as n
        FROM sync_push_queue
        WHERE table_name = 'practice_record' AND row_id = 'pr-3'
      `) as Array<{ n: unknown }>
      ).at(0)?.n;
      expect(Number(count)).toBe(1);
    });

    it("creates JSON row_id for composite primary keys (playlist_tune)", async () => {
      insertUserProfile("sb-1");
      insertPlaylist("pl-1", "sb-1");
      insertTune("t-1", "Tune", "reel");

      db.run(sql`
        INSERT INTO playlist_tune (playlist_ref, tune_ref, deleted, sync_version, last_modified_at)
        VALUES ('pl-1', 't-1', 0, 1, '2025-12-27T00:00:00.000Z')
      `);

      const inserted = await backfillOutboxForTable(
        db as any,
        "playlist_tune",
        "2025-12-26T00:00:00.000Z"
      );
      expect(inserted).toBe(1);

      const outbox = await db.all(sql`
        SELECT table_name, row_id, status, operation
        FROM sync_push_queue
        WHERE table_name = 'playlist_tune'
      `);

      expect(outbox).toEqual([
        {
          table_name: "playlist_tune",
          row_id: JSON.stringify({ playlist_ref: "pl-1", tune_ref: "t-1" }),
          status: "pending",
          operation: "UPDATE",
        },
      ]);
    });
  });

  describe("getPendingOutboxItems", () => {
    it("returns empty array when no items", async () => {
      const items = await getPendingOutboxItems(db as any);
      expect(items).toEqual([]);
    });

    it("returns pending items ordered by changedAt", async () => {
      insertOutboxItem(
        "item-2",
        "tune",
        "tune-2",
        "INSERT",
        "pending",
        "2024-01-02T00:00:00.000Z"
      );
      insertOutboxItem(
        "item-1",
        "tune",
        "tune-1",
        "INSERT",
        "pending",
        "2024-01-01T00:00:00.000Z"
      );

      const items = await getPendingOutboxItems(db as any);
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe("item-1"); // Earlier item first
      expect(items[1].id).toBe("item-2");
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        insertOutboxItem(
          `item-${i}`,
          "tune",
          `tune-${i}`,
          "INSERT",
          "pending",
          `2024-01-0${i + 1}T00:00:00.000Z`
        );
      }

      const items = await getPendingOutboxItems(db as any, 2);
      expect(items).toHaveLength(2);
    });

    it("excludes non-pending items", async () => {
      insertOutboxItem("item-pending", "tune", "tune-1", "INSERT", "pending");
      insertOutboxItem(
        "item-in-progress",
        "tune",
        "tune-2",
        "INSERT",
        "in_progress"
      );
      insertOutboxItem("item-failed", "tune", "tune-3", "INSERT", "failed");

      const items = await getPendingOutboxItems(db as any);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe("item-pending");
    });
  });

  describe("markOutboxInProgress", () => {
    it("updates status to in_progress", async () => {
      insertOutboxItem("item-1", "tune", "tune-1", "INSERT", "pending");

      await markOutboxInProgress(db as any, "item-1");

      const items = await getPendingOutboxItems(db as any);
      expect(items).toHaveLength(0); // No longer pending
    });
  });

  describe("markOutboxCompleted", () => {
    it("deletes item from outbox", async () => {
      insertOutboxItem("item-1", "tune", "tune-1", "INSERT");

      await markOutboxCompleted(db as any, "item-1");

      const stats = await getOutboxStats(db as any);
      expect(stats.total).toBe(0);
    });
  });

  describe("markOutboxFailed", () => {
    it("sets status back to pending and increments attempts", async () => {
      insertOutboxItem(
        "item-1",
        "tune",
        "tune-1",
        "INSERT",
        "in_progress",
        new Date().toISOString(),
        1
      );

      await markOutboxFailed(db as any, "item-1", "Network error", 1);

      const items = await getPendingOutboxItems(db as any);
      expect(items).toHaveLength(1);
      expect(items[0].attempts).toBe(2);
      expect(items[0].lastError).toBe("Network error");
    });
  });

  describe("markOutboxPermanentlyFailed", () => {
    it("sets status to failed", async () => {
      insertOutboxItem("item-1", "tune", "tune-1", "INSERT");

      await markOutboxPermanentlyFailed(db as any, "item-1", "Fatal error");

      const stats = await getOutboxStats(db as any);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });
  });

  describe("getOutboxStats", () => {
    it("returns correct counts for each status", async () => {
      insertOutboxItem("p1", "tune", "t1", "INSERT", "pending");
      insertOutboxItem("p2", "tune", "t2", "INSERT", "pending");
      insertOutboxItem("i1", "tune", "t3", "UPDATE", "in_progress");
      insertOutboxItem("f1", "tune", "t4", "DELETE", "failed");
      insertOutboxItem("f2", "tune", "t5", "DELETE", "failed");
      insertOutboxItem("f3", "tune", "t6", "DELETE", "failed");

      const stats = await getOutboxStats(db as any);
      expect(stats.pending).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.failed).toBe(3);
      expect(stats.total).toBe(6);
    });
  });

  describe("parseRowId", () => {
    it("returns simple string as-is", () => {
      expect(parseRowId("tune-123")).toBe("tune-123");
    });

    it("parses JSON composite key", () => {
      const result = parseRowId('{"genre_id":"g1","tune_type_id":"tt1"}');
      expect(result).toEqual({ genre_id: "g1", tune_type_id: "tt1" });
    });

    it("returns invalid JSON as-is", () => {
      expect(parseRowId("{invalid")).toBe("{invalid");
    });
  });

  describe("getDrizzleTable", () => {
    it("returns table for known table name", () => {
      const table = getDrizzleTable("tune");
      expect(table).toBeDefined();
    });

    it("returns undefined for unknown table name", () => {
      const table = getDrizzleTable("nonexistent");
      expect(table).toBeUndefined();
    });
  });

  describe("fetchLocalRowByPrimaryKey", () => {
    it("fetches row by simple primary key", async () => {
      insertTune("tune-123", "The Kesh", "jig");

      const row = await fetchLocalRowByPrimaryKey(
        db as any,
        "tune",
        "tune-123"
      );

      expect(row).not.toBeNull();
      expect(row?.id).toBe("tune-123");
      expect(row?.title).toBe("The Kesh");
    });

    it("returns null for non-existent row", async () => {
      const row = await fetchLocalRowByPrimaryKey(
        db as any,
        "tune",
        "nonexistent"
      );
      expect(row).toBeNull();
    });

    it("fetches row by composite primary key (JSON rowId)", async () => {
      insertGenreTuneType("irish", "jig");

      const row = await fetchLocalRowByPrimaryKey(
        db as any,
        "genre_tune_type",
        '{"genre_id":"irish","tune_type_id":"jig"}'
      );

      expect(row).not.toBeNull();
      expect(row?.genreId).toBe("irish");
      expect(row?.tuneTypeId).toBe("jig");
    });

    it("throws for unknown table", async () => {
      await expect(
        fetchLocalRowByPrimaryKey(db as any, "nonexistent" as any, "id-123")
      ).rejects.toThrow("Unknown table: nonexistent");
    });

    it("throws for composite key with non-object rowId", async () => {
      await expect(
        fetchLocalRowByPrimaryKey(db as any, "genre_tune_type", "simple-string")
      ).rejects.toThrow("Expected composite key object");
    });
  });

  describe("clearOldOutboxItems", () => {
    it("removes failed items older than threshold", async () => {
      const oldDate = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000
      ).toISOString(); // 10 days ago
      const recentDate = new Date().toISOString();

      insertOutboxItem("old-failed", "tune", "t1", "INSERT", "failed", oldDate);
      insertOutboxItem(
        "recent-failed",
        "tune",
        "t2",
        "INSERT",
        "failed",
        recentDate
      );
      insertOutboxItem(
        "old-pending",
        "tune",
        "t3",
        "INSERT",
        "pending",
        oldDate
      );

      await clearOldOutboxItems(db as any, 7 * 24 * 60 * 60 * 1000); // 7 days

      const stats = await getOutboxStats(db as any);
      expect(stats.failed).toBe(1); // Only recent-failed remains
      expect(stats.pending).toBe(1); // old-pending not touched (not failed)
      expect(stats.total).toBe(2);
    });
  });
});
