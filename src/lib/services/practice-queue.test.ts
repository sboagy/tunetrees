import {
  classifyQueueBucket,
  computeSchedulingWindows,
} from "../utils/scheduling-windows";
/**
 * Queue window navigation and shared scheduling-window tests
 *
 * Shared classification cases:
 * - Q1: Due Today
 * - Q2: Recently Lapsed (0-7 days overdue)
 * - Q3: New/Unscheduled (never scheduled)
 * - Q4: Old Lapsed (>7 days overdue)
 *
 * Uses in-memory SQLite database for isolated testing.
 * Schema is loaded from Drizzle migrations to prevent drift.
 */

import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import {
  type BetterSQLite3Database,
  drizzle,
} from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG_TUNE_ID_MAP } from "../db/catalog-tune-ids";
import {
  getLatestActiveQueueWindow,
  getRecentActiveQueueWindows,
} from "./practice-queue";
import {
  applyMigrations,
  createPracticeListStagedView,
} from "./test-schema-loader";

// Test database setup
let db: BetterSQLite3Database;

// Test UUIDs (consistent format for testing)
const TEST_USER_UUID = "00000000-0000-0000-0000-000000000001";
const TEST_REPERTOIRE_UUID = "00000000-0000-0000-0000-000000000002";

// Helper to get catalog tune UUID by index (1-based)
// Uses actual catalog tune IDs from CATALOG_TUNE_ID_MAP
const CATALOG_TUNE_IDS = Object.entries(CATALOG_TUNE_ID_MAP)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([, uuid]) => uuid);

function tuneId(n: number): string {
  // Use catalog tune UUIDs for realistic testing
  if (n >= 1 && n <= CATALOG_TUNE_IDS.length) {
    return CATALOG_TUNE_IDS[n - 1];
  }
  // Fallback to test UUID pattern if out of range
  return `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;

  // Load production schema from Drizzle migrations
  // This ensures test schema never drifts from production
  applyMigrations(db);
  createPracticeListStagedView(db);

  // Insert test data
  db.run(
    sql`INSERT INTO user_profile (id, email, name, last_modified_at) 
      VALUES (${TEST_USER_UUID}, 'test@example.com', 'Test User', datetime('now'))`
  );
  db.run(
    sql`INSERT INTO repertoire (repertoire_id, user_ref, last_modified_at) 
        VALUES (${TEST_REPERTOIRE_UUID}, ${TEST_USER_UUID}, datetime('now'))`
  );
});

// Helper to insert a queue row directly for testing (shared across describe blocks)
function insertQueueRow(
  id: string,
  tuneRef: string,
  windowStartUtc: string,
  completedAt: string | null = null,
  active = 1
) {
  db.run(sql`
    INSERT INTO daily_practice_queue (
      id, user_ref, repertoire_ref, tune_ref, bucket, order_index,
      window_start_utc, window_end_utc, active, completed_at,
      snapshot_coalesced_ts, generated_at, last_modified_at, sync_version
    ) VALUES (
      ${id}, ${TEST_USER_UUID}, ${TEST_REPERTOIRE_UUID}, ${tuneRef},
      1, 0, ${windowStartUtc}, ${windowStartUtc}, ${active}, ${completedAt},
      datetime('now'), datetime('now'), datetime('now'), 1
    )
  `);
}

describe("computeSchedulingWindows", () => {
  it("should compute correct UTC windows without timezone offset", () => {
    const sitdown = new Date("2025-10-16T14:30:00Z");
    const windows = computeSchedulingWindows(sitdown, 7, null);

    expect(windows.startOfDayUtc).toEqual(new Date("2025-10-16T00:00:00Z"));
    expect(windows.endOfDayUtc).toEqual(new Date("2025-10-17T00:00:00Z"));
    expect(windows.windowFloorUtc).toEqual(new Date("2025-10-09T00:00:00Z"));
    expect(windows.tzOffsetMinutes).toBeNull();
  });

  it("should compute correct UTC windows with EDT timezone (-240 minutes)", () => {
    const sitdown = new Date("2025-10-16T14:30:00Z"); // 10:30 AM EDT
    const windows = computeSchedulingWindows(sitdown, 7, -240);

    // Midnight EDT = 4 AM UTC
    expect(windows.startOfDayUtc).toEqual(new Date("2025-10-16T04:00:00Z"));
    expect(windows.endOfDayUtc).toEqual(new Date("2025-10-17T04:00:00Z"));
    expect(windows.windowFloorUtc).toEqual(new Date("2025-10-09T04:00:00Z"));
    expect(windows.tzOffsetMinutes).toBe(-240);
  });

  it("should format timestamps correctly", () => {
    const sitdown = new Date("2025-10-16T14:30:00Z");
    const windows = computeSchedulingWindows(sitdown, 7, null);

    expect(windows.startTs).toBe("2025-10-16 00:00:00");
    expect(windows.endTs).toBe("2025-10-17 00:00:00");
    expect(windows.windowFloorTs).toBe("2025-10-09 00:00:00");
  });
});

describe("classifyQueueBucket", () => {
  const sitdown = new Date("2025-10-16T12:00:00Z");
  const windows = computeSchedulingWindows(sitdown, 7, null);

  it("should classify today's timestamp as bucket 1", () => {
    expect(classifyQueueBucket("2025-10-16 08:00:00", windows)).toBe(1);
    expect(classifyQueueBucket("2025-10-16 23:59:59", windows)).toBe(1);
  });

  it("should classify recently lapsed (within 7 days) as bucket 2", () => {
    expect(classifyQueueBucket("2025-10-15 12:00:00", windows)).toBe(2); // Yesterday
    expect(classifyQueueBucket("2025-10-10 12:00:00", windows)).toBe(2); // 6 days ago
    expect(classifyQueueBucket("2025-10-09 12:00:00", windows)).toBe(2); // 7 days ago (boundary)
  });

  it("should classify very old timestamps as bucket 4", () => {
    expect(classifyQueueBucket("2025-10-08 12:00:00", windows)).toBe(4); // 8 days ago
    expect(classifyQueueBucket("2025-09-01 12:00:00", windows)).toBe(4); // Very old
    expect(classifyQueueBucket("2020-01-01 00:00:00", windows)).toBe(4); // Ancient
  });

  it("should handle null/undefined timestamps (lenient default)", () => {
    expect(classifyQueueBucket(null, windows)).toBe(1);
    expect(classifyQueueBucket(undefined, windows)).toBe(1);
    expect(classifyQueueBucket("", windows)).toBe(1);
  });

  it("should handle ISO 8601 format with T separator", () => {
    expect(classifyQueueBucket("2025-10-16T12:00:00Z", windows)).toBe(1);
    expect(classifyQueueBucket("2025-10-15T12:00:00Z", windows)).toBe(2);
  });
});

describe("getLatestActiveQueueWindow", () => {
  it("should return the chronologically latest window even when fully complete", async () => {
    // Old queue (2/25) with an incomplete row
    insertQueueRow("q1", tuneId(1), "2026-02-25 00:00:00", null);
    insertQueueRow(
      "q2",
      tuneId(2),
      "2026-02-25 00:00:00",
      "2026-02-25 10:00:00"
    );

    // Latest queue (3/7) fully complete
    insertQueueRow(
      "q3",
      tuneId(3),
      "2026-03-07 00:00:00",
      "2026-03-07 10:00:00"
    );
    insertQueueRow(
      "q4",
      tuneId(4),
      "2026-03-07 00:00:00",
      "2026-03-07 11:00:00"
    );

    const result = await getLatestActiveQueueWindow(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID
    );

    // Must return 3/7 (latest by date), NOT 2/25 (latest with incomplete rows)
    expect(result.windowStartUtc).toBe("2026-03-07 00:00:00");
    expect(result.hasIncompleteRows).toBe(false);
    expect(result.rowCount).toBe(2);
  });

  it("should return the latest window with incomplete rows flagged correctly", async () => {
    // Old complete queue
    insertQueueRow(
      "q1",
      tuneId(1),
      "2026-02-25 00:00:00",
      "2026-02-25 10:00:00"
    );

    // Latest queue with incomplete rows
    insertQueueRow(
      "q2",
      tuneId(2),
      "2026-03-07 00:00:00",
      "2026-03-07 10:00:00"
    );
    insertQueueRow("q3", tuneId(3), "2026-03-07 00:00:00", null);

    const result = await getLatestActiveQueueWindow(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID
    );

    expect(result.windowStartUtc).toBe("2026-03-07 00:00:00");
    expect(result.hasIncompleteRows).toBe(true);
    expect(result.rowCount).toBe(2);
  });

  it("should return null windowStartUtc when no active queues exist", async () => {
    const result = await getLatestActiveQueueWindow(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID
    );

    expect(result.windowStartUtc).toBeNull();
    expect(result.hasIncompleteRows).toBe(false);
    expect(result.rowCount).toBe(0);
  });

  it("should ignore inactive queue rows", async () => {
    // Inactive (deleted) queue for a newer date
    insertQueueRow("q1", tuneId(1), "2026-03-10 00:00:00", null, 0);

    // Active queue for an older date
    insertQueueRow(
      "q2",
      tuneId(2),
      "2026-03-07 00:00:00",
      "2026-03-07 10:00:00"
    );

    const result = await getLatestActiveQueueWindow(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID
    );

    expect(result.windowStartUtc).toBe("2026-03-07 00:00:00");
    expect(result.hasIncompleteRows).toBe(false);
    expect(result.rowCount).toBe(1);
  });

  it("should handle T-separator window_start_utc format", async () => {
    insertQueueRow(
      "q1",
      tuneId(1),
      "2026-03-07T00:00:00",
      "2026-03-07 10:00:00"
    );
    insertQueueRow("q2", tuneId(2), "2026-03-07T00:00:00", null);

    const result = await getLatestActiveQueueWindow(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID
    );

    expect(result.windowStartUtc).toContain("2026-03-07");
    expect(result.hasIncompleteRows).toBe(true);
    expect(result.rowCount).toBe(2);
  });
});

describe("getRecentActiveQueueWindows", () => {
  it("should return newest distinct active queue windows first", async () => {
    insertQueueRow("q1", tuneId(1), "2026-03-01 00:00:00", null);
    insertQueueRow("q2", tuneId(2), "2026-03-07 00:00:00", null);
    insertQueueRow(
      "q3",
      tuneId(3),
      "2026-03-05 00:00:00",
      "2026-03-05 10:00:00"
    );

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      5
    );

    expect(result.map((row) => row.windowStartUtc)).toEqual([
      "2026-03-07 00:00:00",
      "2026-03-05 00:00:00",
      "2026-03-01 00:00:00",
    ]);
  });

  it("should include row counts and incomplete state for each returned window", async () => {
    insertQueueRow(
      "q1",
      tuneId(1),
      "2026-03-07 00:00:00",
      "2026-03-07 10:00:00"
    );
    insertQueueRow("q2", tuneId(2), "2026-03-07 00:00:00", null);
    insertQueueRow(
      "q3",
      tuneId(3),
      "2026-03-05 00:00:00",
      "2026-03-05 11:00:00"
    );

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      5
    );

    expect(result).toEqual([
      {
        queueDate: "2026-03-07",
        windowStartUtc: "2026-03-07 00:00:00",
        hasIncompleteRows: true,
        rowCount: 2,
      },
      {
        queueDate: "2026-03-05",
        windowStartUtc: "2026-03-05 00:00:00",
        hasIncompleteRows: false,
        rowCount: 1,
      },
    ]);
  });

  it("should ignore inactive windows and honor the limit", async () => {
    insertQueueRow("q1", tuneId(1), "2026-03-09 00:00:00", null, 0);
    insertQueueRow("q2", tuneId(2), "2026-03-08 00:00:00", null);
    insertQueueRow("q3", tuneId(3), "2026-03-07 00:00:00", null);
    insertQueueRow("q4", tuneId(4), "2026-03-06 00:00:00", null);

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      2
    );

    expect(result.map((row) => row.windowStartUtc)).toEqual([
      "2026-03-08 00:00:00",
      "2026-03-07 00:00:00",
    ]);
  });

  it("should normalize T-separator queue windows", async () => {
    insertQueueRow("q1", tuneId(1), "2026-03-07T00:00:00", null);

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      5
    );

    expect(result).toEqual([
      {
        queueDate: "2026-03-07",
        windowStartUtc: "2026-03-07 00:00:00",
        hasIncompleteRows: true,
        rowCount: 1,
      },
    ]);
  });

  it("should page results by queue_date and honor offset", async () => {
    insertQueueRow("q1", tuneId(1), "2026-03-09 00:00:00", null);
    insertQueueRow("q2", tuneId(2), "2026-03-08 00:00:00", null);
    insertQueueRow("q3", tuneId(3), "2026-03-07 00:00:00", null);

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      2,
      1
    );

    expect(result.map((row) => row.queueDate)).toEqual([
      "2026-03-08",
      "2026-03-07",
    ]);
  });

  it("should prefer explicit queue_date values for recent history ordering", async () => {
    db.run(sql`
      INSERT INTO daily_practice_queue (
        id, user_ref, repertoire_ref, tune_ref, bucket, order_index,
        queue_date, window_start_utc, window_end_utc, active, completed_at,
        snapshot_coalesced_ts, generated_at, last_modified_at, sync_version
      ) VALUES (
        ${"q-explicit"}, ${TEST_USER_UUID}, ${TEST_REPERTOIRE_UUID}, ${tuneId(1)},
        1, 0, ${"2026-03-01"}, ${"2026-03-07 00:00:00"}, ${"2026-03-07 00:00:00"}, 1, null,
        datetime('now'), datetime('now'), datetime('now'), 1
      )
    `);

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      5
    );

    expect(result[0]?.queueDate).toBe("2026-03-01");
    expect(result[0]?.windowStartUtc).toBe("2026-03-07 00:00:00");
  });

  it("should collapse duplicate queue dates stored in different string formats", async () => {
    db.run(sql`
      INSERT INTO daily_practice_queue (
        id, user_ref, repertoire_ref, tune_ref, bucket, order_index,
        queue_date, window_start_utc, window_end_utc, active, completed_at,
        snapshot_coalesced_ts, generated_at, last_modified_at, sync_version
      ) VALUES (
        ${"q-date-only"}, ${TEST_USER_UUID}, ${TEST_REPERTOIRE_UUID}, ${tuneId(1)},
        1, 0, ${"2026-03-07"}, ${"2026-03-07 00:00:00"}, ${"2026-03-07 00:00:00"}, 1, null,
        datetime('now'), datetime('now'), datetime('now'), 1
      )
    `);
    db.run(sql`
      INSERT INTO daily_practice_queue (
        id, user_ref, repertoire_ref, tune_ref, bucket, order_index,
        queue_date, window_start_utc, window_end_utc, active, completed_at,
        snapshot_coalesced_ts, generated_at, last_modified_at, sync_version
      ) VALUES (
        ${"q-datetime"}, ${TEST_USER_UUID}, ${TEST_REPERTOIRE_UUID}, ${tuneId(2)},
        1, 1, ${"2026-03-07 00:00:00"}, ${"2026-03-07 12:00:00"}, ${"2026-03-07 12:00:00"}, 1, null,
        datetime('now'), datetime('now'), datetime('now'), 1
      )
    `);

    const result = await getRecentActiveQueueWindows(
      db,
      TEST_USER_UUID,
      TEST_REPERTOIRE_UUID,
      5
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      queueDate: "2026-03-07",
      rowCount: 2,
      hasIncompleteRows: true,
    });
  });
});
