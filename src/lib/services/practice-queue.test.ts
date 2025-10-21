/**
 * Practice Queue Generation Tests
 *
 * Test suite for the four-bucket queue algorithm:
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
import {
  addTunesToQueue,
  classifyQueueBucket,
  computeSchedulingWindows,
  generateOrGetPracticeQueue,
} from "./practice-queue";
import {
  applyMigrations,
  createPracticeListStagedView,
} from "./test-schema-loader";

// Test database setup
let db: BetterSQLite3Database;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite) as BetterSQLite3Database;

  // Load production schema from Drizzle migrations
  // This ensures test schema never drifts from production
  applyMigrations(db);
  createPracticeListStagedView(db);

  // Insert test data
  db.run(
    sql`INSERT INTO user_profile (id, supabase_user_id, email, name, last_modified_at) 
        VALUES (1, 'test-uid', 'test@example.com', 'Test User', datetime('now'))`
  );
  db.run(
    sql`INSERT INTO playlist (playlist_id, user_ref, last_modified_at) 
        VALUES (1, 1, datetime('now'))`
  );
});

// Helper to insert tune with scheduled date
function insertTune(
  id: number,
  title: string,
  scheduled: string | null,
  latestDue: string | null = null
) {
  // Insert tune with required fields from production schema
  db.run(sql`
    INSERT INTO tune (id, title, last_modified_at, sync_version, deleted) 
    VALUES (${id}, ${title}, datetime('now'), 1, 0)
  `);

  // Insert into playlist_tune (uses composite primary key: playlist_ref + tune_ref)
  db.run(sql`
    INSERT INTO playlist_tune (playlist_ref, tune_ref, current, last_modified_at, sync_version, deleted) 
    VALUES (1, ${id}, ${scheduled}, datetime('now'), 1, 0)
  `);

  // Insert practice record if latestDue provided
  if (latestDue) {
    db.run(sql`
      INSERT INTO practice_record (playlist_ref, tune_ref, practiced, last_modified_at, sync_version)
      VALUES (1, ${id}, ${latestDue}, datetime('now'), 1)
    `);
  }
}

// Helper to format date as YYYY-MM-DD HH:MM:SS
function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").substring(0, 19);
}

// Helper to create date relative to today (in UTC to avoid timezone issues)
function daysFromNow(days: number): Date {
  const d = new Date();
  // Use UTC methods to avoid timezone conversion issues
  const utcDate = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + days,
    12, // Noon UTC
    0,
    0,
    0
  );
  return new Date(utcDate);
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

describe("generateOrGetPracticeQueue - Empty Queue", () => {
  it("should return empty queue when no tunes exist", async () => {
    const queue = await generateOrGetPracticeQueue(db, 1, 1);
    expect(queue).toEqual([]);
  });

  it("should return empty queue when all tunes are deleted", async () => {
    insertTune(1, "Deleted Tune", formatTimestamp(daysFromNow(0)));
    db.run(sql`UPDATE tune SET deleted = 1 WHERE id = 1`);

    const queue = await generateOrGetPracticeQueue(db, 1, 1);
    expect(queue).toEqual([]);
  });
});

describe("generateOrGetPracticeQueue - Bucket 1 (Due Today)", () => {
  it("should include tunes scheduled for today", async () => {
    insertTune(1, "Tune Due Today", formatTimestamp(daysFromNow(0)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(1);
    expect(queue[0].tuneRef).toBe(1);
    expect(queue[0].bucket).toBe(1);
    expect(queue[0].orderIndex).toBe(0);
  });

  it("should include multiple tunes due today, ordered by scheduled time", async () => {
    const morning = daysFromNow(0);
    morning.setUTCHours(8, 0, 0, 0); // Use UTC to match query
    insertTune(1, "Morning Tune", formatTimestamp(morning));

    const afternoon = daysFromNow(0);
    afternoon.setUTCHours(14, 0, 0, 0);
    insertTune(2, "Afternoon Tune", formatTimestamp(afternoon));

    const evening = daysFromNow(0);
    evening.setUTCHours(20, 0, 0, 0);
    insertTune(3, "Evening Tune", formatTimestamp(evening));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(3);
    expect(queue[0].tuneRef).toBe(1); // Morning first
    expect(queue[1].tuneRef).toBe(2);
    expect(queue[2].tuneRef).toBe(3);
    expect(queue.every((r) => r.bucket === 1)).toBe(true);
  });

  it("should respect maxReviewsPerDay limit for Q1", async () => {
    // Insert 15 tunes due today (max is 10 by default)
    for (let i = 1; i <= 15; i++) {
      insertTune(i, `Tune ${i}`, formatTimestamp(daysFromNow(0)));
    }

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // Capped at default max
    expect(queue.every((r) => r.bucket === 1)).toBe(true);
  });
});

describe("generateOrGetPracticeQueue - Bucket 2 (Recently Lapsed)", () => {
  it("should include tunes scheduled 1-7 days ago when no Q1 tunes exist", async () => {
    insertTune(1, "3 Days Late", formatTimestamp(daysFromNow(-3)));
    insertTune(2, "6 Days Late", formatTimestamp(daysFromNow(-6)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(2);
    expect(queue.every((r) => r.bucket === 2)).toBe(true);
    // Q2 ordered by most recent first (DESC)
    expect(queue[0].tuneRef).toBe(1); // 3 days ago (more recent)
    expect(queue[1].tuneRef).toBe(2); // 6 days ago
  });

  it("should fill remaining capacity with Q2 after Q1", async () => {
    // 3 tunes due today (Q1)
    insertTune(1, "Today 1", formatTimestamp(daysFromNow(0)));
    insertTune(2, "Today 2", formatTimestamp(daysFromNow(0)));
    insertTune(3, "Today 3", formatTimestamp(daysFromNow(0)));

    // 10 tunes lapsed (Q2)
    for (let i = 4; i <= 13; i++) {
      insertTune(i, `Lapsed ${i}`, formatTimestamp(daysFromNow(-2)));
    }

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // 3 Q1 + 7 Q2
    const q1Count = queue.filter((r) => r.bucket === 1).length;
    const q2Count = queue.filter((r) => r.bucket === 2).length;
    expect(q1Count).toBe(3);
    expect(q2Count).toBe(7);
  });

  it("should not include Q2 if Q1 fills entire capacity", async () => {
    // Insert 12 tunes due today (exceeds max of 10)
    for (let i = 1; i <= 12; i++) {
      insertTune(i, `Today ${i}`, formatTimestamp(daysFromNow(0)));
    }

    // Insert lapsed tunes that should be ignored
    insertTune(13, "Lapsed", formatTimestamp(daysFromNow(-3)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // Only Q1, capped
    expect(queue.every((r) => r.bucket === 1)).toBe(true);
  });
});

describe("generateOrGetPracticeQueue - Bucket 3 (New/Unscheduled)", () => {
  it("should include unscheduled tunes (scheduled=NULL) in Q3", async () => {
    insertTune(1, "Never Scheduled", null); // No scheduled date

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(1);
    expect(queue[0].tuneRef).toBe(1);
    expect(queue[0].bucket).toBe(3);
  });

  it("should handle multiple unscheduled tunes with ordering by tune ID", async () => {
    // Q3 orders by scheduled ASC NULLS LAST, then by id ASC
    insertTune(5, "Unscheduled Z", null);
    insertTune(2, "Unscheduled A", null);
    insertTune(8, "Unscheduled M", null);

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(3);
    expect(queue.every((r) => r.bucket === 3)).toBe(true);

    // Should be ordered by ID since scheduled is NULL for all
    expect(queue[0].tuneRef).toBe(2);
    expect(queue[1].tuneRef).toBe(5);
    expect(queue[2].tuneRef).toBe(8);
  });

  it("should separate new unscheduled (Q3) from old scheduled (Q4)", async () => {
    // Q3: New/unscheduled
    insertTune(1, "Unscheduled A", null);
    insertTune(2, "Unscheduled B", null);

    // Q4: Old scheduled
    insertTune(3, "Scheduled 30 Days", formatTimestamp(daysFromNow(-30)));
    insertTune(4, "Scheduled 20 Days", formatTimestamp(daysFromNow(-20)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(4);

    // First 2 should be Q3 (new/unscheduled)
    expect(queue[0].bucket).toBe(3);
    expect(queue[1].bucket).toBe(3);
    expect([queue[0].tuneRef, queue[1].tuneRef].sort()).toEqual([1, 2]);

    // Last 2 should be Q4 (old scheduled)
    expect(queue[2].bucket).toBe(4);
    expect(queue[3].bucket).toBe(4);
    expect(queue[2].tuneRef).toBe(3); // 30 days (oldest first)
    expect(queue[3].tuneRef).toBe(4); // 20 days
  });

  it("should respect capacity limit when many unscheduled tunes exist", async () => {
    // Insert 15 unscheduled tunes (max queue is 10)
    for (let i = 1; i <= 15; i++) {
      insertTune(i, `Unscheduled ${i}`, null);
    }

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // Capped at max capacity
    expect(queue.every((r) => r.bucket === 3)).toBe(true);

    // Should get first 10 by ID order
    expect(queue.map((r) => r.tuneRef)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("should classify unscheduled tunes with recent practice as Q2, not Q3", async () => {
    // Unscheduled tune practiced 5 days ago
    // Q2 window is 0-7 days, so latest_due within range = Q2!
    insertTune(
      1,
      "Unscheduled But Recently Practiced",
      null,
      formatTimestamp(daysFromNow(-5))
    );

    // Unscheduled tune never practiced = Q3
    insertTune(2, "Unscheduled Never Practiced", null);

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(2);

    // Tune 1 should be Q2 (recent practice history)
    const tune1 = queue.find((r) => r.tuneRef === 1);
    expect(tune1?.bucket).toBe(2);

    // Tune 2 should be Q3 (no history)
    const tune2 = queue.find((r) => r.tuneRef === 2);
    expect(tune2?.bucket).toBe(3);
  });

  it("should include unscheduled tunes with old practice history in Q3", async () => {
    // Unscheduled tune practiced 30 days ago (beyond Q2 window)
    insertTune(
      1,
      "Unscheduled Long Ago",
      null,
      formatTimestamp(daysFromNow(-30))
    );

    // Unscheduled tune never practiced
    insertTune(2, "Unscheduled Never Practiced", null);

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(2);
    expect(queue.every((r) => r.bucket === 3)).toBe(true);

    // Both are Q3 (unscheduled), ordered by ID
    const tuneIds = queue.map((r) => r.tuneRef).sort();
    expect(tuneIds).toEqual([1, 2]);
  });
});

describe("generateOrGetPracticeQueue - Bucket 4 (Old Lapsed)", () => {
  it("should include very old scheduled tunes (>7 days) in Q4", async () => {
    insertTune(1, "10 Days Old", formatTimestamp(daysFromNow(-10)));
    insertTune(2, "30 Days Old", formatTimestamp(daysFromNow(-30)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(2);
    expect(queue.every((r) => r.bucket === 4)).toBe(true);
    // Q4 ordered by oldest first (ASC)
    expect(queue[0].tuneRef).toBe(2); // 30 days (oldest)
    expect(queue[1].tuneRef).toBe(1); // 10 days
  });

  it("should prioritize Q3 (new) over Q4 (old lapsed) when capacity limited", async () => {
    // 8 Q1 + Q2 (fills most capacity, leaving room for 2)
    for (let i = 1; i <= 8; i++) {
      insertTune(i, `Today/Recent ${i}`, formatTimestamp(daysFromNow(0)));
    }

    // 3 Q3 (new/unscheduled)
    insertTune(9, "New 1", null);
    insertTune(10, "New 2", null);
    insertTune(11, "New 3", null);

    // 3 Q4 (old lapsed)
    insertTune(12, "Old Lapsed 1", formatTimestamp(daysFromNow(-20)));
    insertTune(13, "Old Lapsed 2", formatTimestamp(daysFromNow(-30)));
    insertTune(14, "Old Lapsed 3", formatTimestamp(daysFromNow(-40)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // Max capacity
    const q3Count = queue.filter((r) => r.bucket === 3).length;
    const q4Count = queue.filter((r) => r.bucket === 4).length;

    // Should get Q3 tunes before Q4
    expect(q3Count).toBe(2); // 2 new tunes fit
    expect(q4Count).toBe(0); // No room for old lapsed
  });
});

describe("generateOrGetPracticeQueue - Multi-Bucket Integration", () => {
  it("should fill capacity with Q1 + Q2 + Q3 + Q4 in priority order", async () => {
    // 2 Q1 (due today)
    insertTune(1, "Today 1", formatTimestamp(daysFromNow(0)));
    insertTune(2, "Today 2", formatTimestamp(daysFromNow(0)));

    // 2 Q2 (lapsed 3 days)
    insertTune(3, "Lapsed 1", formatTimestamp(daysFromNow(-3)));
    insertTune(4, "Lapsed 2", formatTimestamp(daysFromNow(-3)));

    // 3 Q3 (unscheduled/new)
    insertTune(5, "Unscheduled 1", null);
    insertTune(6, "Unscheduled 2", null);
    insertTune(7, "Unscheduled 3", null);

    // 5 Q4 (very old scheduled)
    insertTune(8, "Old 1", formatTimestamp(daysFromNow(-10)));
    insertTune(9, "Old 2", formatTimestamp(daysFromNow(-15)));
    insertTune(10, "Old 3", formatTimestamp(daysFromNow(-20)));
    insertTune(11, "Old 4", formatTimestamp(daysFromNow(-25)));
    insertTune(12, "Old 5", formatTimestamp(daysFromNow(-30)));

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // 2 Q1 + 2 Q2 + 3 Q3 + 3 Q4
    const q1Count = queue.filter((r) => r.bucket === 1).length;
    const q2Count = queue.filter((r) => r.bucket === 2).length;
    const q3Count = queue.filter((r) => r.bucket === 3).length;
    const q4Count = queue.filter((r) => r.bucket === 4).length;

    expect(q1Count).toBe(2);
    expect(q2Count).toBe(2);
    expect(q3Count).toBe(3);
    expect(q4Count).toBe(3);
  });

  it("should not include Q3/Q4 if Q1+Q2 fill capacity", async () => {
    // 5 Q1
    for (let i = 1; i <= 5; i++) {
      insertTune(i, `Today ${i}`, formatTimestamp(daysFromNow(0)));
    }

    // 5 Q2
    for (let i = 6; i <= 10; i++) {
      insertTune(i, `Lapsed ${i}`, formatTimestamp(daysFromNow(-3)));
    }

    // 5 Q3 (should be ignored - capacity full)
    for (let i = 11; i <= 15; i++) {
      insertTune(i, `New ${i}`, null);
    }

    // 5 Q4 (should be ignored - capacity full)
    for (let i = 16; i <= 20; i++) {
      insertTune(i, `Old ${i}`, formatTimestamp(daysFromNow(-20)));
    }

    const queue = await generateOrGetPracticeQueue(db, 1, 1);

    expect(queue).toHaveLength(10); // 5 Q1 + 5 Q2
    expect(queue.every((r) => r.bucket === 1 || r.bucket === 2)).toBe(true);
  });
});

describe("generateOrGetPracticeQueue - Frozen Queue Behavior", () => {
  it("should return existing queue on second call (no regeneration)", async () => {
    insertTune(1, "Test Tune", formatTimestamp(daysFromNow(0)));

    const queue1 = await generateOrGetPracticeQueue(db, 1, 1);
    expect(queue1).toHaveLength(1);

    // Add more tunes after queue generated
    insertTune(2, "New Tune", formatTimestamp(daysFromNow(0)));

    const queue2 = await generateOrGetPracticeQueue(db, 1, 1);
    expect(queue2).toHaveLength(1); // Still frozen at 1 tune
    expect(queue2[0].id).toBe(queue1[0].id); // Same queue row
  });

  it("should regenerate queue when forceRegen=true", async () => {
    insertTune(1, "Original Tune", formatTimestamp(daysFromNow(0)));

    const queue1 = await generateOrGetPracticeQueue(db, 1, 1);
    expect(queue1).toHaveLength(1);

    // Add more tunes
    insertTune(2, "Added Tune", formatTimestamp(daysFromNow(0)));

    const queue2 = await generateOrGetPracticeQueue(
      db,
      1,
      1,
      new Date(),
      null,
      "per_day",
      true // Force regeneration
    );

    expect(queue2).toHaveLength(2); // Now includes new tune
  });
});

describe("addTunesToQueue - Refill Functionality", () => {
  it("should add backlog tunes to existing queue", async () => {
    // Create initial queue with 2 tunes due today
    insertTune(1, "Today 1", formatTimestamp(daysFromNow(0)));
    insertTune(2, "Today 2", formatTimestamp(daysFromNow(0)));

    // Add old lapsed tunes (>7 days old - will be Q4)
    insertTune(3, "Old Lapsed 1", formatTimestamp(daysFromNow(-10)));
    insertTune(4, "Old Lapsed 2", formatTimestamp(daysFromNow(-15)));
    insertTune(5, "Old Lapsed 3", formatTimestamp(daysFromNow(-20)));

    const initialQueue = await generateOrGetPracticeQueue(db, 1, 1);

    // With 4-bucket system: 2 Q1 + 3 Q4 = 5 tunes (within max of 10)
    expect(initialQueue).toHaveLength(5);
    const q1Count = initialQueue.filter((r) => r.bucket === 1).length;
    const q4Count = initialQueue.filter((r) => r.bucket === 4).length;
    expect(q1Count).toBe(2);
    expect(q4Count).toBe(3);

    // Add 2 MORE old lapsed tunes to queue (beyond what auto-filled)
    insertTune(6, "Old Lapsed 4", formatTimestamp(daysFromNow(-25)));
    insertTune(7, "Old Lapsed 5", formatTimestamp(daysFromNow(-30)));

    const added = await addTunesToQueue(db, 1, 1, 2);

    expect(added).toHaveLength(2);
    expect(added.every((r) => r.bucket === 2)).toBe(true); // Forced to bucket 2

    // Verify final queue
    const finalQueue = await generateOrGetPracticeQueue(db, 1, 1);
    expect(finalQueue).toHaveLength(7); // 5 original + 2 added
  });

  it("should not add tunes already in queue", async () => {
    insertTune(1, "In Queue", formatTimestamp(daysFromNow(0)));
    insertTune(2, "Old Lapsed", formatTimestamp(daysFromNow(-10)));

    const initialQueue = await generateOrGetPracticeQueue(db, 1, 1);

    // With 4-bucket system, both tunes are in queue (Q1 + Q4)
    expect(initialQueue).toHaveLength(2);

    // Try to add tunes that are already in queue
    const added = await addTunesToQueue(db, 1, 1, 5);

    expect(added).toHaveLength(0); // No new tunes to add
  });

  it("should return empty when count <= 0", async () => {
    insertTune(1, "Test", formatTimestamp(daysFromNow(0)));
    await generateOrGetPracticeQueue(db, 1, 1);

    const added = await addTunesToQueue(db, 1, 1, 0);
    expect(added).toEqual([]);
  });

  it("should return empty when no active queue exists", async () => {
    insertTune(1, "Test", formatTimestamp(daysFromNow(-10)));

    const added = await addTunesToQueue(db, 1, 1, 5);
    expect(added).toEqual([]);
  });
});
