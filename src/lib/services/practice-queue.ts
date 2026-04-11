/**
 * Practice Queue Generation Service
 *
 * Client-side daily practice queue generation and management.
 * Implements frozen snapshot behavior: queue is generated once per day
 * and remains stable until explicitly regenerated.
 *
 * Architecture:
 * - Queries practice_list_staged VIEW for candidate tunes
 * - Classifies tunes into buckets (Due Today/Lapsed/Backfill)
 * - Persists to daily_practice_queue table for stable ordering
 * - completed_at tracking for Submit workflow
 *
 * Ported from legacy/tunetrees/app/queries.py
 * - compute_scheduling_windows() (lines 45-72)
 * - _classify_queue_bucket() (lines 641-670)
 * - generate_or_get_practice_queue() (lines 911-975)
 *
 * @module lib/services/practice-queue
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { SqliteDatabase } from "../db/client-sqlite";
import { persistDb } from "../db/client-sqlite";
import type { PracticeListStagedRow } from "../db/queries/practice";
import { dailyPracticeQueue, prefsSchedulingOptions } from "../db/schema";
import {
  classifyQueueBucket,
  computeSchedulingWindows,
  type SchedulingWindows,
} from "../utils/scheduling-windows";
import { generateId } from "../utils/uuid";

export { classifyQueueBucket, computeSchedulingWindows };
export type { SchedulingWindows };

type QueueCandidateRow = Pick<
  PracticeListStagedRow,
  "id" | "scheduled" | "latest_due"
>;

const HARD_QUEUE_ROW_CAP = 5000;

// Type alias to support both sql.js (production) and better-sqlite3 (testing)
type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

function buildWindowStartUtcVariants(windowStart: string): string[] {
  const trimmed = windowStart.trim();
  const baseIso = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const baseSpace = baseIso.replace("T", " ");

  const variants = new Set<string>([baseIso, baseSpace]);
  for (const base of [baseIso, baseSpace]) {
    variants.add(`${base}Z`);
    variants.add(`${base}.000Z`);
    variants.add(`${base}+00:00`);
    variants.add(`${base}.000+00:00`);
  }

  return Array.from(variants);
}

/**
 * Scheduling Options Preferences (local interface for queue generation)
 *
 * Uses a subset of fields from IUserSchedulingOptions relevant to queue building.
 */
interface PrefsSchedulingOptions {
  acceptableDelinquencyWindow: number; // Days before today to include lapsed tunes
  minReviewsPerDay: number; // Minimum tunes to practice per day
  maxReviewsPerDay: number; // Maximum tunes to practice per day (0 = uncapped)
  autoScheduleNew: boolean;
}

/**
 * Default scheduling preferences fallback
 *
 * Used when user preferences are not found in the database.
 * Matches legacy DEFAULT_* constants.
 */
const DEFAULT_PREFS: PrefsSchedulingOptions = {
  acceptableDelinquencyWindow: 7,
  minReviewsPerDay: 3,
  maxReviewsPerDay: 10,
  autoScheduleNew: true,
};

/**
 * Get user scheduling options from database, falling back to defaults.
 *
 * @param db - Database instance (sql.js or better-sqlite3)
 * @param userId - User ID
 * @returns Scheduling preferences for queue generation
 */
async function getUserSchedulingPrefs(
  db: AnyDatabase,
  userId: string
): Promise<PrefsSchedulingOptions> {
  try {
    const rows = await db
      .select()
      .from(prefsSchedulingOptions)
      .where(eq(prefsSchedulingOptions.userId, userId))
      .limit(1);

    const testAutoScheduleNewOverride =
      typeof window !== "undefined"
        ? (window as any).__TUNETREES_TEST_AUTO_SCHEDULE_NEW__
        : undefined;
    const effectiveAutoScheduleNew = testAutoScheduleNewOverride ?? true; // just fall back to global default

    if (rows[0]) {
      const r = rows[0];
      return {
        acceptableDelinquencyWindow: r.acceptableDelinquencyWindow ?? 7,
        minReviewsPerDay: r.minReviewsPerDay ?? 3,
        maxReviewsPerDay: r.maxReviewsPerDay ?? 10,
        autoScheduleNew: effectiveAutoScheduleNew,
      };
    }
  } catch (e) {
    console.warn(
      "[PracticeQueue] Failed to load user scheduling prefs, using defaults:",
      e
    );
  }
  return DEFAULT_PREFS;
}

/**
 * Daily Practice Queue Row (before enrichment)
 *
 * Represents a queue entry as stored in daily_practice_queue table.
 */
export interface DailyPracticeQueueRow {
  /** UUID primary key. */
  id?: string;
  /** Supabase Auth UUID of the owning user. */
  userRef: string;
  /** Repertoire this queue entry belongs to. */
  repertoireRef: string;
  /** UTC start of the scheduling window; defines which queue day this row belongs to. */
  windowStartUtc: string;
  /** UTC end of the scheduling window. */
  windowEndUtc: string;
  /** UUID of the tune to practice. */
  tuneRef: string;
  /** Queue bucket: 1=Due Today, 2=Recently Lapsed, 4=Old Lapsed. */
  bucket: number;
  /** Stable display order within the queue. */
  orderIndex: number;
  /** Snapshot of COALESCE(scheduled, latest_due) at queue generation time. */
  snapshotCoalescedTs: string;
  /** Queue generation mode, typically per_day. */
  mode: string | null;
  /** Date-only portion of the queue window for per-day mode. */
  queueDate: string | null;
  /** Snapshot of scheduled at generation time; diagnostic only. */
  scheduledSnapshot: string | null;
  /** Snapshot of latest_due at generation time; diagnostic only. */
  latestDueSnapshot: string | null;
  /** Delinquency window used to generate the queue; diagnostic only. */
  acceptableDelinquencyWindowSnapshot: number | null;
  /** Client timezone offset used for generation; diagnostic only. */
  tzOffsetMinutesSnapshot: number | null;
  /** ISO timestamp when the queue row was generated. */
  generatedAt: string;
  /** ISO timestamp when the row was marked complete; null means incomplete. */
  completedAt: string | null;
  /** Reserved for future multi-exposure behavior. */
  exposuresRequired: number | null;
  /** Reserved for future multi-exposure behavior. */
  exposuresCompleted: number | null;
  /** Reserved for future practice outcome capture. */
  outcome: string | null;
  /** Active flag; 1 means active, 0 means superseded/deactivated. */
  active: number;
  /** Sync version for offline-first replication. */
  syncVersion: number;
  /** Last local modification timestamp. */
  lastModifiedAt: string;
  /** Device id for sync attribution. */
  deviceId: string | null;
}

/**
 * Fetch existing active queue for a specific window
 *
 * Ported from legacy _fetch_existing_active_queue() (lines 674-693).
 *
 * @param db - SQLite database instance
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param windowStartKey - Window start timestamp (YYYY-MM-DD HH:MM:SS)
 * @returns Array of existing active queue rows
 */
async function fetchExistingActiveQueue(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  windowStartKey: string
): Promise<DailyPracticeQueueRow[]> {
  const variants = buildWindowStartUtcVariants(windowStartKey);
  const results = await db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.repertoireRef, repertoireRef),
        inArray(dailyPracticeQueue.windowStartUtc, variants),
        eq(dailyPracticeQueue.active, 1)
      )
    )
    .orderBy(dailyPracticeQueue.orderIndex) // ← ADD THIS
    .all();

  return results as DailyPracticeQueueRow[];
}

export interface LatestActiveQueueWindow {
  windowStartUtc: string | null;
  hasIncompleteRows: boolean;
  rowCount: number;
}

/**
 * Get the latest active queue window for a user/repertoire and whether it is complete.
 *
 * Always returns the chronologically latest queue window — never falls back to an
 * older window just because it has incomplete rows. This prevents the UI from
 * jumping to a stale queue when the current queue becomes fully completed.
 *
 * This is used to keep queue behavior stable across reloads/devices without relying
 * on localStorage as the source of truth.
 */
export async function getLatestActiveQueueWindow(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string
): Promise<LatestActiveQueueWindow> {
  // Step 1: Find the chronologically latest active queue window (any completion state).
  const rows = await db.all<{
    windowStartUtc: string;
    totalCount: number;
    incompleteCount: number;
  }>(sql`
    SELECT
      substr(replace(window_start_utc, 'T', ' '), 1, 19) as windowStartUtc,
      COUNT(*) as totalCount,
      SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) as incompleteCount
    FROM daily_practice_queue
    WHERE user_ref = ${userRef}
      AND repertoire_ref = ${repertoireRef}
      AND active = 1
    GROUP BY substr(replace(window_start_utc, 'T', ' '), 1, 19)
    ORDER BY windowStartUtc DESC
    LIMIT 1
  `);

  const latest = rows[0];
  if (!latest) {
    return {
      windowStartUtc: null,
      hasIncompleteRows: false,
      rowCount: 0,
    };
  }

  return {
    windowStartUtc: String(latest.windowStartUtc),
    hasIncompleteRows: Number(latest.incompleteCount) > 0,
    rowCount: Number(latest.totalCount ?? 0),
  };
}

/**
 * Build queue rows from practice list results
 *
 * Classifies each tune into buckets and creates queue row objects.
 * Does NOT persist to database - just creates the objects.
 *
 * Ported from legacy _build_queue_rows() (lines 829-869).
 *
 * @param rows - Tunes from practice_list_staged VIEW
 * @param windows - Scheduling windows
 * @param prefs - Scheduling preferences
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param mode - Queue mode ("per_day" or "rolling")
 * @param localTzOffsetMinutes - Timezone offset
 * @param forceBucket - Force all rows to specific bucket (optional, for Q3 override)
 * @returns Array of queue row objects ready for insertion
 */
function buildQueueRows(
  rows: QueueCandidateRow[],
  windows: SchedulingWindows,
  prefs: PrefsSchedulingOptions,
  userRef: string,
  repertoireRef: string,
  mode: string,
  localTzOffsetMinutes: number | null,
  forceBucket?: number
): Omit<DailyPracticeQueueRow, "id">[] {
  const results: Omit<DailyPracticeQueueRow, "id">[] = [];
  const now = new Date();
  const generatedAt = now.toISOString().replace("T", " ").substring(0, 19);

  const normalizeTimestamp = (
    value: string | number | null | undefined
  ): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value;

    // Heuristic: treat small numbers as epoch seconds, otherwise epoch ms
    const ms = value < 100_000_000_000 ? value * 1000 : value;
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  for (let orderIndex = 0; orderIndex < rows.length; orderIndex++) {
    const row = rows[orderIndex];
    const scheduledVal = normalizeTimestamp(row.scheduled);
    const latestVal = normalizeTimestamp(row.latest_due);
    const coalescedRaw = scheduledVal ?? latestVal ?? windows.startTs;
    const bucket = forceBucket ?? classifyQueueBucket(coalescedRaw, windows);

    results.push({
      userRef,
      repertoireRef: repertoireRef,
      mode,
      queueDate: mode === "per_day" ? windows.startTs.substring(0, 10) : null,
      windowStartUtc: windows.startTs,
      windowEndUtc: windows.endTs,
      tuneRef: row.id,
      bucket,
      orderIndex,
      snapshotCoalescedTs: coalescedRaw,
      scheduledSnapshot: scheduledVal,
      latestDueSnapshot: latestVal,
      acceptableDelinquencyWindowSnapshot: prefs.acceptableDelinquencyWindow,
      tzOffsetMinutesSnapshot: localTzOffsetMinutes,
      generatedAt,
      completedAt: null,
      exposuresRequired: null,
      exposuresCompleted: 0,
      outcome: null,
      active: 1,
      syncVersion: 1,
      lastModifiedAt: generatedAt,
      deviceId: null,
    });
  }

  return results;
}

/**
 * Persist queue rows to database
 *
 * Inserts rows into daily_practice_queue table.
 * On conflict (duplicate window + tune), returns existing rows instead.
 *
 * Ported from legacy _persist_queue_rows() (lines 872-906).
 *
 * @param db - SQLite database instance
 * @param rows - Queue rows to insert
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param windows - Scheduling windows
 * @returns Persisted queue rows (may be existing rows if conflict)
 */
async function persistQueueRows(
  db: AnyDatabase,
  rows: Omit<DailyPracticeQueueRow, "id">[],
  userRef: string,
  repertoireRef: string,
  windows: SchedulingWindows
): Promise<DailyPracticeQueueRow[]> {
  try {
    // Insert all rows - sync is handled automatically by SQL triggers
    for (const row of rows) {
      const id = generateId();
      const fullRow = { id, ...row };

      // Insert into local database
      // Sync is handled automatically by SQL triggers populating sync_outbox
      await db.insert(dailyPracticeQueue).values(fullRow).run();
    }

    // Fetch back the inserted rows
    return await fetchExistingActiveQueue(
      db,
      userRef,
      repertoireRef,
      windows.startTs
    );
  } catch (error) {
    // On conflict, return existing rows
    console.warn(
      "[PracticeQueue] Insert conflict, returning existing queue:",
      error
    );
    return await fetchExistingActiveQueue(
      db,
      userRef,
      repertoireRef,
      windows.startTs
    );
  }
}

/**
 * Ensure daily queue exists for the given practice date
 *
 * Checks if a queue exists for the specified date. If not, generates one.
 * This should be called on every page load to implement "create new queue every day" logic.
 *
 * @param db - SQLite database instance
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param practiceDate - The practice date (from getPracticeDate())
 * @param localTzOffsetMinutes - Client timezone offset (optional)
 * @returns True if queue was created, false if already existed
 *
 * @example
 * ```typescript
 * import { getPracticeDate } from '../utils/practice-date';
 *
 * const practiceDate = getPracticeDate();
 * const created = await ensureDailyQueue(db, userId, repertoireId, practiceDate);
 * if (created) {
 *   console.log('Created new daily queue');
 * }
 * ```
 */
export async function ensureDailyQueue(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  practiceDate: Date,
  localTzOffsetMinutes: number | null = null
): Promise<boolean> {
  const { formatAsWindowStart } = await import("../utils/practice-date");
  const windowStartUtc = formatAsWindowStart(practiceDate);
  const windowStartUtcIso19 = windowStartUtc.replace(" ", "T").substring(0, 19);

  console.log(`[PracticeQueue] Ensuring queue exists for ${windowStartUtc}...`);

  // Check if queue exists for this date
  // NOTE: We now use ISO format (YYYY-MM-DDTHH:MM:SS) consistently
  // For backward compatibility, also check space-separated format during transition
  // Use an existence check instead of COUNT(*) to reduce memory/CPU for SQL.js,
  // especially during long e2e runs with many user sessions.
  const existing = await db.all<{ one: number }>(sql`
    SELECT 1 as one
    FROM daily_practice_queue
    WHERE user_ref = ${userRef}
      AND repertoire_ref = ${repertoireRef}
      AND substr(replace(window_start_utc, ' ', 'T'), 1, 19) = ${windowStartUtcIso19}
    LIMIT 1
  `);

  const queueExists = existing.length > 0;

  if (queueExists) {
    console.log(`[PracticeQueue] ✓ Queue already exists for ${windowStartUtc}`);
    return false;
  }

  // Generate new queue for this date
  console.log(
    `[PracticeQueue] 📅 Generating new queue for ${windowStartUtc}...`
  );

  await generateOrGetPracticeQueue(
    db,
    userRef,
    repertoireRef,
    practiceDate,
    localTzOffsetMinutes,
    "per_day",
    false // Don't force regen, we already checked it doesn't exist
  );

  console.log(`[PracticeQueue] ✅ Created new queue for ${windowStartUtc}`);
  return true;
}

/**
 * Generate (or fetch existing) daily practice queue snapshot
 *
 * Main entry point for queue generation. Behavior:
 * 1. Check for existing active queue for this window
 * 2. If exists (and not force_regen): return it
 * 3. Else: query practice_list_staged, classify into buckets, persist
 *
 * Queue is frozen for the day - does not change as user practices.
 * Call with force_regen=true to regenerate (deactivates old queue).
 *
 * Ported from legacy generate_or_get_practice_queue() (lines 911-975).
 *
 * @param db - SQLite database instance
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param reviewSitdownDate - Anchor timestamp (defaults to now UTC)
 * @param localTzOffsetMinutes - Client timezone offset (optional)
 * @param mode - Queue mode ("per_day" or "rolling")
 * @param forceRegen - Force regeneration even if queue exists
 * @returns Array of queue rows (frozen snapshot)
 *
 * @example
 * ```typescript
 * const queue = await generateOrGetPracticeQueue(
 *   db,
 *   1,  // userId
 *   5,  // repertoireId
 *   new Date(),
 *   -240,  // EDT timezone
 *   "per_day",
 *   false
 * );
 * // Returns stable queue for the day
 * ```
 */
export async function generateOrGetPracticeQueue(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  reviewSitdownDate: Date = new Date(),
  localTzOffsetMinutes: number | null = null,
  mode: string = "per_day",
  forceRegen: boolean = false
): Promise<DailyPracticeQueueRow[]> {
  // Get user's scheduling preferences from database
  const prefs = await getUserSchedulingPrefs(db, userRef);
  console.log(
    `[PracticeQueue] Using user scheduling prefs: delinquency=${prefs.acceptableDelinquencyWindow}, min=${prefs.minReviewsPerDay}, max=${prefs.maxReviewsPerDay}`
  );

  // Compute scheduling windows
  const windows = computeSchedulingWindows(
    reviewSitdownDate,
    prefs.acceptableDelinquencyWindow,
    localTzOffsetMinutes
  );

  const windowStartKey = windows.startTs;

  // ⚠️ GUARD: Check if database has been populated yet
  // On fresh login, queue may try to generate before initial sync completes
  // If practice_list_staged is empty, return empty queue and let sync trigger reload
  const stagedExists = await db.all<{ one: number }>(sql`
    SELECT 1 as one
    FROM practice_list_staged
    WHERE user_ref = ${userRef} AND repertoire_id = ${repertoireRef}
    LIMIT 1
  `);
  const hasData = stagedExists.length > 0;

  if (!hasData && !forceRegen) {
    console.log(
      "[PracticeQueue] ⏳ Database not yet populated (waiting for sync), returning empty queue"
    );
    return [];
  }

  // Check for existing active queue
  const existing = await fetchExistingActiveQueue(
    db,
    userRef,
    repertoireRef,
    windowStartKey
  );

  if (existing.length > 0 && !forceRegen) {
    console.log(
      `[PracticeQueue] Using existing queue: ${existing.length} rows`
    );
    return existing;
  }

  // Force regeneration: DELETE old queue (can't just deactivate due to UNIQUE constraint)
  if (forceRegen && existing.length > 0) {
    const variants = buildWindowStartUtcVariants(windowStartKey);
    console.log("[PracticeQueue] Force regen: deleting old queue");
    await db
      .delete(dailyPracticeQueue)
      .where(
        and(
          eq(dailyPracticeQueue.userRef, userRef),
          eq(dailyPracticeQueue.repertoireRef, repertoireRef),
          inArray(dailyPracticeQueue.windowStartUtc, variants)
        )
      )
      .run();
  }

  // Query practice_list_staged using four-bucket logic with capacity limits
  // Q1 (Due Today) + Q2 (Recently Lapsed) + Q3 (New/Unscheduled) + Q4 (Old Lapsed)
  // Implements max_reviews capacity constraint across all buckets

  const maxReviews = prefs.maxReviewsPerDay || 0; // 0 = uncapped
  const effectiveMaxReviews = maxReviews > 0 ? maxReviews : HARD_QUEUE_ROW_CAP;
  const seenTuneIds = new Set<string>();
  const candidateRows: QueueCandidateRow[] = [];

  // Q1: Due Today (scheduled or latest_due within [startTs, endTs))
  let q1Rows: QueueCandidateRow[];
  const q1Limit = maxReviews > 0 ? maxReviews : effectiveMaxReviews;
  q1Rows = await db.all<QueueCandidateRow>(sql`
    SELECT id, scheduled, latest_due
    FROM (
      SELECT
        id,
        scheduled,
        latest_due,
        ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY COALESCE(scheduled, latest_due) ASC, id ASC
        ) as rn
      FROM practice_list_staged
      WHERE user_ref = ${userRef}
        AND repertoire_id = ${repertoireRef}
        AND deleted = 0
        AND repertoire_deleted = 0
        AND (
          (scheduled IS NOT NULL AND scheduled >= ${windows.startTs} AND scheduled < ${windows.endTs})
          OR (scheduled IS NULL AND latest_due >= ${windows.startTs} AND latest_due < ${windows.endTs})
        )
    ) dedup
    WHERE rn = 1
    ORDER BY COALESCE(scheduled, latest_due) ASC, id ASC
    LIMIT ${q1Limit}
  `);

  for (const row of q1Rows) {
    candidateRows.push(row);
    seenTuneIds.add(row.id);
  }

  console.log(`[PracticeQueue] Q1 (due today): ${q1Rows.length} tunes`);

  // Q2: Recently Lapsed (if capacity remains)
  let q2Rows: QueueCandidateRow[] = [];
  if (maxReviews === 0 || candidateRows.length < maxReviews) {
    const remainingCapacity =
      maxReviews === 0
        ? Math.max(0, effectiveMaxReviews - candidateRows.length)
        : maxReviews - candidateRows.length;
    q2Rows = await db.all<QueueCandidateRow>(sql`
      SELECT id, scheduled, latest_due
      FROM (
        SELECT
          id,
          scheduled,
          latest_due,
          ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY COALESCE(scheduled, latest_due) DESC, id ASC
          ) as rn
        FROM practice_list_staged
        WHERE user_ref = ${userRef}
          AND repertoire_id = ${repertoireRef}
          AND deleted = 0
          AND repertoire_deleted = 0
          AND (
            (scheduled IS NOT NULL AND scheduled >= ${windows.windowFloorTs} AND scheduled < ${windows.startTs})
            OR (scheduled IS NULL AND latest_due >= ${windows.windowFloorTs} AND latest_due < ${windows.startTs})
          )
      ) dedup
      WHERE rn = 1
      ORDER BY COALESCE(scheduled, latest_due) DESC, id ASC
      LIMIT ${remainingCapacity}
    `);

    for (const row of q2Rows) {
      if (!seenTuneIds.has(row.id)) {
        candidateRows.push(row);
        seenTuneIds.add(row.id);
      }
    }

    console.log(`[PracticeQueue] Q2 (recently lapsed): ${q2Rows.length} tunes`);
  }

  // Q3: New/Unscheduled tunes (if capacity still remains)
  // Never-scheduled tunes (scheduled IS NULL AND latest_due IS NULL)
  // OR practiced long ago but never scheduled (scheduled IS NULL AND latest_due < windowFloorTs)
  let q3Rows: QueueCandidateRow[] = [];
  if (maxReviews === 0 || candidateRows.length < maxReviews) {
    const remainingCapacity =
      maxReviews === 0
        ? Math.max(0, effectiveMaxReviews - candidateRows.length)
        : maxReviews - candidateRows.length;
    if (prefs.autoScheduleNew) {
      q3Rows = await db.all<QueueCandidateRow>(sql`
        SELECT id, scheduled, latest_due
        FROM (
          SELECT
            id,
            scheduled,
            latest_due,
            ROW_NUMBER() OVER (
              PARTITION BY id
              ORDER BY id ASC
            ) as rn
          FROM practice_list_staged
          WHERE user_ref = ${userRef}
            AND repertoire_id = ${repertoireRef}
            AND deleted = 0
            AND repertoire_deleted = 0
            AND scheduled IS NULL
            AND (latest_due IS NULL OR latest_due < ${windows.windowFloorTs})
        ) dedup
        WHERE rn = 1
        ORDER BY id ASC
        LIMIT ${remainingCapacity}
      `);
    } else {
      q3Rows = await db.all<QueueCandidateRow>(sql`
        SELECT id, scheduled, latest_due
        FROM (
          SELECT
            id,
            scheduled,
            latest_due,
            ROW_NUMBER() OVER (
              PARTITION BY id
              ORDER BY id ASC
            ) as rn
          FROM practice_list_staged
          WHERE user_ref = ${userRef}
            AND repertoire_id = ${repertoireRef}
            AND deleted = 0
            AND repertoire_deleted = 0
            AND (latest_due IS NOT NULL AND latest_due < ${windows.windowFloorTs})
        ) dedup
        WHERE rn = 1
        ORDER BY id ASC
        LIMIT ${remainingCapacity}
      `);
    }

    for (const row of q3Rows) {
      if (!seenTuneIds.has(row.id)) {
        candidateRows.push(row);
        seenTuneIds.add(row.id);
      }
    }

    console.log(`[PracticeQueue] Q3 (new/unscheduled): ${q3Rows.length} tunes`);
  }

  // Q4: Old Lapsed tunes (if capacity still remains)
  // Very old scheduled tunes (scheduled before windowFloorTs)
  let q4Rows: QueueCandidateRow[] = [];
  if (maxReviews === 0 || candidateRows.length < maxReviews) {
    const remainingCapacity =
      maxReviews === 0
        ? Math.max(0, effectiveMaxReviews - candidateRows.length)
        : maxReviews - candidateRows.length;
    q4Rows = await db.all<QueueCandidateRow>(sql`
      SELECT id, scheduled, latest_due
      FROM (
        SELECT
          id,
          scheduled,
          latest_due,
          ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY scheduled ASC, id ASC
          ) as rn
        FROM practice_list_staged
        WHERE user_ref = ${userRef}
          AND repertoire_id = ${repertoireRef}
          AND deleted = 0
          AND repertoire_deleted = 0
          AND scheduled IS NOT NULL
          AND scheduled < ${windows.windowFloorTs}
      ) dedup
      WHERE rn = 1
      ORDER BY scheduled ASC, id ASC
      LIMIT ${remainingCapacity}
    `);

    for (const row of q4Rows) {
      if (!seenTuneIds.has(row.id)) {
        candidateRows.push(row);
        seenTuneIds.add(row.id);
      }
    }

    console.log(`[PracticeQueue] Q4 (old lapsed): ${q4Rows.length} tunes`);
  }

  // Fallback: if nothing is currently due, include due-later-today tunes so the
  // queue still advances to the new window and remains actionable.
  if (candidateRows.length === 0) {
    const fallbackLimit = maxReviews > 0 ? maxReviews : effectiveMaxReviews;

    q1Rows = await db.all<QueueCandidateRow>(sql`
      SELECT id, scheduled, latest_due
      FROM (
        SELECT
          id,
          scheduled,
          latest_due,
          ROW_NUMBER() OVER (
            PARTITION BY id
            ORDER BY COALESCE(scheduled, latest_due) ASC, id ASC
          ) as rn
        FROM practice_list_staged
        WHERE user_ref = ${userRef}
          AND repertoire_id = ${repertoireRef}
          AND deleted = 0
          AND repertoire_deleted = 0
          AND (
            (scheduled IS NOT NULL AND scheduled >= ${windows.startTs} AND scheduled < ${windows.endTs})
            OR (scheduled IS NULL AND latest_due >= ${windows.startTs} AND latest_due < ${windows.endTs})
          )
      ) dedup
      WHERE rn = 1
      ORDER BY COALESCE(scheduled, latest_due) ASC, id ASC
      LIMIT ${fallbackLimit}
    `);

    for (const row of q1Rows) {
      if (!seenTuneIds.has(row.id)) {
        candidateRows.push(row);
        seenTuneIds.add(row.id);
      }
    }

    console.log(
      `[PracticeQueue] Q1 fallback (due later today): ${q1Rows.length} tunes`
    );
  }

  console.log(
    `[PracticeQueue] Generating new queue: ${candidateRows.length} candidate tunes (max: ${maxReviews || "uncapped"})`
  );

  // Build queue rows - mark each with its actual bucket
  // Q1 tunes get bucket 1, Q2 get bucket 2, Q3 get bucket 3, Q4 get bucket 4
  const q1Built = buildQueueRows(
    q1Rows,
    windows,
    prefs,
    userRef,
    repertoireRef,
    mode,
    localTzOffsetMinutes,
    1 // Force bucket 1 (Due Today)
  );

  const q2Built = buildQueueRows(
    q2Rows,
    windows,
    prefs,
    userRef,
    repertoireRef,
    mode,
    localTzOffsetMinutes,
    2 // Force bucket 2 (Recently Lapsed)
  );

  const q3Built = buildQueueRows(
    q3Rows,
    windows,
    prefs,
    userRef,
    repertoireRef,
    mode,
    localTzOffsetMinutes,
    3 // Force bucket 3 (New/Unscheduled)
  );

  const q4Built = buildQueueRows(
    q4Rows,
    windows,
    prefs,
    userRef,
    repertoireRef,
    mode,
    localTzOffsetMinutes,
    4 // Force bucket 4 (Old Lapsed)
  );

  // Combine and renumber order indices
  const built: Omit<DailyPracticeQueueRow, "id">[] = [];
  let orderIndex = 0;

  for (const row of [...q1Built, ...q2Built, ...q3Built, ...q4Built]) {
    built.push({ ...row, orderIndex: orderIndex++ });
  }

  // Persist to database
  const persisted = await persistQueueRows(
    db,
    built,
    userRef,
    repertoireRef,
    windows
  );
  if (forceRegen || built.length > 0) {
    // Queue rows are visible immediately from the in-memory sql.js DB. Flush now so
    // Refresh Now replacements, empty forced regenerations, and first-time queue
    // creation all survive a hard browser reload.
    if (typeof indexedDB !== "undefined") {
      await persistDb();
    }
  }

  console.log(
    `[PracticeQueue] Generated queue: ${persisted.length} rows persisted`
  );

  return persisted;
}

/**
 * Add specific tunes to existing practice queue (Add To Review)
 *
 * Appends the given tune IDs directly to the active queue for today.
 * Used by the "Add To Review" flow in the Repertoire tab to add selected
 * tunes to the current practice session without regenerating the whole queue.
 *
 * Key behavior:
 * - If a queue exists for today, the tunes are inserted as new queue entries.
 * - If no queue exists for today, returns empty (tunes will appear in the next
 *   generated queue when the user next opens the Practice tab).
 * - Tunes already present in the queue are skipped.
 *
 * @param db - SQLite database instance
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param tuneIds - Array of tune IDs to add to the existing queue
 * @param reviewSitdownDate - Anchor timestamp (defaults to now UTC)
 * @param localTzOffsetMinutes - Client timezone offset (optional)
 * @returns Array of newly inserted queue rows (empty if no queue or no new tunes)
 *
 * @example
 * ```typescript
 * const added = await addSpecificTunesToExistingQueue(db, userId, repertoireId, [tuneId1, tuneId2]);
 * // Adds the two specified tunes to today's queue if one exists
 * ```
 */
export async function addSpecificTunesToExistingQueue(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  tuneIds: string[],
  reviewSitdownDate: Date = new Date(),
  localTzOffsetMinutes: number | null = null
): Promise<DailyPracticeQueueRow[]> {
  if (tuneIds.length === 0) {
    console.warn("[AddSpecificTunes] No tune IDs provided, returning empty");
    return [];
  }

  // Get user's scheduling preferences from database
  const prefs = await getUserSchedulingPrefs(db, userRef);

  // Compute scheduling windows
  const windows = computeSchedulingWindows(
    reviewSitdownDate,
    prefs.acceptableDelinquencyWindow,
    localTzOffsetMinutes
  );

  const windowStartKey = windows.startTs;

  // Get existing active queue for today
  const existing = await fetchExistingActiveQueue(
    db,
    userRef,
    repertoireRef,
    windowStartKey
  );

  if (existing.length === 0) {
    console.log(
      "[AddSpecificTunes] No active queue found for today; " +
        "scheduled tunes will appear in next generated queue"
    );
    return [];
  }

  // Filter out tunes already in queue
  const existingTuneIds = new Set(existing.map((r) => r.tuneRef));
  const newTuneIds = tuneIds.filter((id) => !existingTuneIds.has(id));

  if (newTuneIds.length === 0) {
    console.log("[AddSpecificTunes] All specified tunes already in queue");
    return [];
  }

  console.log(
    `[AddSpecificTunes] Adding ${newTuneIds.length} specific tunes to existing queue`
  );

  // Find max order_index from existing queue to append after
  const maxOrderIndex = Math.max(...existing.map((r) => r.orderIndex), -1);

  // Insert the new tunes directly into the queue
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const addedIds: string[] = [];

  for (let i = 0; i < newTuneIds.length; i++) {
    const tuneRef = newTuneIds[i];
    await db
      .insert(dailyPracticeQueue)
      .values({
        id: generateId(),
        userRef,
        repertoireRef,
        mode: "per_day",
        queueDate: windows.startTs.substring(0, 10),
        windowStartUtc: windows.startTs,
        windowEndUtc: windows.endTs,
        tuneRef,
        bucket: 1, // Bucket 1: Due Today (just scheduled for immediate review)
        orderIndex: maxOrderIndex + 1 + i,
        snapshotCoalescedTs: now,
        scheduledSnapshot: now,
        latestDueSnapshot: null,
        acceptableDelinquencyWindowSnapshot: prefs.acceptableDelinquencyWindow,
        tzOffsetMinutesSnapshot: localTzOffsetMinutes,
        generatedAt: now,
        completedAt: null,
        exposuresRequired: null,
        exposuresCompleted: 0,
        outcome: null,
        active: 1,
        syncVersion: 1,
        lastModifiedAt: now,
        deviceId: null,
      })
      .run();
    addedIds.push(tuneRef);
  }

  // Fetch back the inserted rows
  const variants = buildWindowStartUtcVariants(windowStartKey);
  const added = await db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.repertoireRef, repertoireRef),
        inArray(dailyPracticeQueue.windowStartUtc, variants),
        eq(dailyPracticeQueue.active, 1),
        inArray(dailyPracticeQueue.tuneRef, addedIds)
      )
    )
    .all();

  console.log(
    `[AddSpecificTunes] Successfully added ${added.length} tunes to existing queue`
  );
  return added as DailyPracticeQueueRow[];
}

/**
 * Add tunes to existing practice queue (refill from backlog)
 *
 * Appends additional older/lapsed tunes to the active queue for today.
 * Only tunes older than the delinquency window (backlog) that aren't
 * already in the queue are eligible.
 *
 * Ported from legacy refill_practice_queue() (lines 1007-1112).
 *
 * @param db - SQLite database instance
 * @param userRef - Supabase Auth UUID
 * @param repertoireRef - Repertoire ID
 * @param count - Number of tunes to add (must be >= 1)
 * @param reviewSitdownDate - Anchor timestamp (defaults to now UTC)
 * @param localTzOffsetMinutes - Client timezone offset (optional)
 * @returns Array of newly added queue rows
 *
 * @example
 * ```typescript
 * const added = await addTunesToQueue(db, 1, 5, 5);
 * // Adds 5 oldest backlog tunes to today's queue
 * ```
 */
export async function addTunesToQueue(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  count: number,
  reviewSitdownDate: Date = new Date(),
  localTzOffsetMinutes: number | null = null
): Promise<DailyPracticeQueueRow[]> {
  if (count <= 0) {
    console.warn("[AddTunes] Count must be >= 1, returning empty");
    return [];
  }

  // Get user's scheduling preferences from database
  const prefs = await getUserSchedulingPrefs(db, userRef);

  // Compute scheduling windows
  const windows = computeSchedulingWindows(
    reviewSitdownDate,
    prefs.acceptableDelinquencyWindow,
    localTzOffsetMinutes
  );

  const windowStartKey = windows.startTs;

  // Get existing active queue for today
  const existing = await fetchExistingActiveQueue(
    db,
    userRef,
    repertoireRef,
    windowStartKey
  );

  if (existing.length === 0) {
    console.warn("[AddTunes] No active queue found for today, returning empty");
    return [];
  }

  // Get set of tune IDs already in queue
  const existingTuneIds = new Set(existing.map((r) => r.tuneRef));

  console.log(
    `[AddTunes] Existing queue has ${existing.length} tunes, adding ${count} more`
  );

  // Query backlog tunes (older than delinquency window)
  // These are tunes scheduled before windowFloorTs that aren't in the queue yet
  const backlogLimit = Math.min(
    HARD_QUEUE_ROW_CAP,
    Math.max(count * 50, count + existing.length + 25)
  );

  const backlogRows = await db.all<QueueCandidateRow>(sql`
    SELECT id, scheduled, latest_due
    FROM (
      SELECT
        id,
        scheduled,
        latest_due,
        ROW_NUMBER() OVER (
          PARTITION BY id
          ORDER BY COALESCE(scheduled, latest_due) DESC, id ASC
        ) as rn
      FROM practice_list_staged
      WHERE user_ref = ${userRef}
        AND repertoire_id = ${repertoireRef}
        AND deleted = 0
        AND repertoire_deleted = 0
        AND (
          (scheduled IS NOT NULL AND scheduled < ${windows.windowFloorTs})
          OR (scheduled IS NULL AND latest_due < ${windows.windowFloorTs})
        )
    ) dedup
    WHERE rn = 1
    ORDER BY COALESCE(scheduled, latest_due) DESC, id ASC
    LIMIT ${backlogLimit}
  `);

  console.log(`[AddTunes] Found ${backlogRows.length} backlog tunes`);

  // Filter out tunes already in queue
  const newRows: QueueCandidateRow[] = [];
  for (const row of backlogRows) {
    if (!existingTuneIds.has(row.id)) {
      newRows.push(row);
      if (newRows.length >= count) {
        break;
      }
    }
  }

  if (newRows.length === 0) {
    console.log("[AddTunes] No eligible backlog tunes found");
    return [];
  }

  console.log(`[AddTunes] Adding ${newRows.length} new tunes to queue`);

  // Find max order_index from existing queue
  const maxOrderIndex = Math.max(...existing.map((r) => r.orderIndex), -1);

  // Build queue rows for new tunes
  const built = buildQueueRows(
    newRows,
    windows,
    prefs,
    userRef,
    repertoireRef,
    "per_day",
    localTzOffsetMinutes
  );

  // Adjust order indices to append sequentially after existing queue
  built.forEach((row, index) => {
    row.orderIndex = maxOrderIndex + 1 + index;
    row.bucket = 2; // Force bucket 2 (Lapsed) for added tunes
  });

  // Persist new rows to database
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  for (const row of built) {
    await db
      .insert(dailyPracticeQueue)
      .values({
        id: generateId(),
        ...row,
        lastModifiedAt: now,
      })
      .run();
  }

  // Fetch back the inserted rows
  const addedTuneIds = built.map((r) => r.tuneRef);
  const variants = buildWindowStartUtcVariants(windowStartKey);
  const added = await db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.repertoireRef, repertoireRef),
        inArray(dailyPracticeQueue.windowStartUtc, variants),
        eq(dailyPracticeQueue.active, 1),
        inArray(dailyPracticeQueue.tuneRef, addedTuneIds)
      )
    )
    .all();

  console.log(`[AddTunes] Successfully added ${added.length} tunes to queue`);

  return added as DailyPracticeQueueRow[];
}
