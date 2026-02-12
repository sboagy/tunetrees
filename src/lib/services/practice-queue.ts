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
import type { PracticeListStagedRow } from "../db/queries/practice";
import { dailyPracticeQueue, prefsSchedulingOptions } from "../db/schema";
import { generateId } from "../utils/uuid";

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
 * Computed UTC windows for a user's practice sit-down
 *
 * Mirrors legacy SchedulingWindows NamedTuple (lines 24-39).
 */
export interface SchedulingWindows {
  startOfDayUtc: Date;
  endOfDayUtc: Date;
  windowFloorUtc: Date;
  startTs: string; // ISO format: YYYY-MM-DD HH:MM:SS
  endTs: string;
  windowFloorTs: string;
  tzOffsetMinutes: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000; // $24\times60\times60\times1000$
const addDays = (d: Date, days: number): Date =>
  new Date(d.getTime() + days * MS_PER_DAY);

/**
 * Compute scheduling windows from a sit-down instant
 *
 * Derives canonical UTC scheduling windows based on:
 * - User's local timezone (if provided via offset)
 * - Acceptable delinquency window (how far back to look for lapsed tunes)
 *
 * Ported from legacy compute_scheduling_windows() (lines 45-72).
 *
 * @param reviewSitdownDate - Anchor timestamp for this session (UTC)
 * @param acceptableDelinquencyWindow - Days before today to include lapsed tunes
 * @param localTzOffsetMinutes - Client's local offset minutes from UTC (e.g., -300 for UTC-5)
 * @returns Scheduling windows with UTC boundaries and pre-formatted timestamps
 *
 * @example
 * ```typescript
 * const windows = computeSchedulingWindows(
 *   new Date('2025-10-16T14:30:00Z'),
 *   7,  // 7-day delinquency window
 *   -240  // UTC-4 (EDT)
 * );
 * // windows.startOfDayUtc = 2025-10-16T04:00:00Z (midnight in EDT)
 * // windows.windowFloorUtc = 2025-10-09T04:00:00Z (7 days before start)
 * ```
 */
export function computeSchedulingWindows(
  reviewSitdownDate: Date,
  acceptableDelinquencyWindow: number,
  localTzOffsetMinutes: number | null
): SchedulingWindows {
  const sitdownUtc = new Date(reviewSitdownDate.toISOString());

  let startOfDayUtc: Date;

  if (localTzOffsetMinutes !== null) {
    // Convert UTC to local time
    const offsetMs = localTzOffsetMinutes * 60 * 1000;
    const localDt = new Date(sitdownUtc.getTime() + offsetMs);

    // Get midnight in local time (using UTC methods to avoid system timezone)
    const localStart = new Date(
      Date.UTC(
        localDt.getUTCFullYear(),
        localDt.getUTCMonth(),
        localDt.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    // Convert back to UTC
    startOfDayUtc = new Date(localStart.getTime() - offsetMs);
  } else {
    startOfDayUtc = new Date(sitdownUtc);
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
  }

  const endOfDayUtc: Date = addDays(startOfDayUtc, 1);
  const windowFloorUtc: Date = addDays(
    startOfDayUtc,
    -acceptableDelinquencyWindow
  );

  // // Format as ISO 8601 UTC up to seconds: YYYY-MM-DDTHH:MM:SSZ
  // // We keep this "obviously UTC" form to avoid local/UTC ambiguity.
  // const formatTs = (dt: Date): string => {
  //   const iso = dt.toISOString();
  //   // iso is always in UTC, e.g. 2026-05-01T00:00:00.000Z
  //   return `${iso.substring(0, 19)}Z`;
  // };

  // Format as YYYY-MM-DD HH:MM:SS (legacy format for lexicographic comparison)
  const formatTs = (dt: Date): string => {
    return dt.toISOString().replace("T", " ").substring(0, 19);
  };

  return {
    startOfDayUtc,
    endOfDayUtc,
    windowFloorUtc,
    startTs: formatTs(startOfDayUtc),
    endTs: formatTs(endOfDayUtc),
    windowFloorTs: formatTs(windowFloorUtc),
    tzOffsetMinutes: localTzOffsetMinutes,
  };
}

/**
 * Classify timestamp vs window boundaries (robust parsing)
 *
 * Returns bucket classification:
 * - Bucket 1: Due Today (timestamp in [startOfDayUtc, endOfDayUtc))
 * - Bucket 2: Recently Lapsed (timestamp in [windowFloorUtc, startOfDayUtc))
 * - Bucket 3: New/Unscheduled (never scheduled, no practice history)
 * - Bucket 4: Old Lapsed (timestamp < windowFloorUtc)
 *
 * Handles various timestamp formats:
 * - ISO 8601 with T separator: "2025-10-16T14:30:00Z"
 * - Space separator: "2025-10-16 14:30:00"
 * - With/without timezone info
 *
 * Any parse failure returns bucket 1 (lenient default).
 *
 * Ported from legacy _classify_queue_bucket() (lines 641-670).
 *
 * @param coalescedRaw - Timestamp string (scheduled OR latest_due)
 * @param windows - Scheduling windows for comparison
 * @returns Bucket integer (1, 2, 3, or 4)
 *
 * @example
 * ```typescript
 * const windows = computeSchedulingWindows(new Date(), 7, null);
 * const bucket = classifyQueueBucket("2025-10-16 10:00:00", windows);
 * // Returns 1 if today, 2 if recent past, 3 if new, 4 if very old
 * ```
 */
export function classifyQueueBucket(
  coalescedRaw: string | null | undefined,
  windows: SchedulingWindows
): number {
  if (!coalescedRaw) {
    return 1; // Lenient default for null/undefined
  }

  const raw = coalescedRaw.trim();
  const norm = raw.replace("T", " ");
  const norm19 = norm.length >= 19 ? norm.substring(0, 19) : norm;

  let dt: Date | null = null;

  // Parse as YYYY-MM-DD HH:MM:SS (assume UTC) - try this FIRST
  try {
    const match = norm19.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      dt = new Date(
        Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hour, 10),
          parseInt(minute, 10),
          parseInt(second, 10)
        )
      );
    }
  } catch {
    dt = null;
  }

  // Fallback: Try ISO format (with timezone)
  if (!dt) {
    try {
      dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) {
        dt = null;
      }
    } catch {
      dt = null;
    }
  }

  if (!dt || Number.isNaN(dt.getTime())) {
    return 1; // Invalid date - lenient default
  }

  // Convert to UTC if needed
  const dtUtc = new Date(dt.toISOString());

  // Classify into buckets
  if (dtUtc >= windows.startOfDayUtc && dtUtc < windows.endOfDayUtc) {
    return 1; // Due Today
  }

  if (dtUtc >= windows.windowFloorUtc && dtUtc < windows.startOfDayUtc) {
    return 2; // Recently Lapsed
  }

  return 4; // Old Lapsed (older than window floor)
}

/**
 * Daily Practice Queue Row (before enrichment)
 *
 * Represents a queue entry as stored in daily_practice_queue table.
 */
export interface DailyPracticeQueueRow {
  id?: string;
  userRef: string;
  playlistRef: string;
  windowStartUtc: string;
  windowEndUtc: string;
  tuneRef: string;
  bucket: number;
  orderIndex: number;
  snapshotCoalescedTs: string;
  mode: string | null;
  queueDate: string | null;
  scheduledSnapshot: string | null;
  latestDueSnapshot: string | null;
  acceptableDelinquencyWindowSnapshot: number | null;
  tzOffsetMinutesSnapshot: number | null;
  generatedAt: string;
  completedAt: string | null;
  exposuresRequired: number | null;
  exposuresCompleted: number | null;
  outcome: string | null;
  active: number;
  syncVersion: number;
  lastModifiedAt: string;
  deviceId: string | null;
}

/**
 * Fetch existing active queue for a specific window
 *
 * Ported from legacy _fetch_existing_active_queue() (lines 674-693).
 *
 * @param db - SQLite database instance
 * @param userRef - User ID (from user_profile.id)
 * @param repertoireRef - Repertoire ID
 * @param windowStartKey - Window start timestamp (YYYY-MM-DD HH:MM:SS)
 * @returns Array of existing active queue rows
 */
async function fetchExistingActiveQueue(
  db: AnyDatabase,
  userRef: string,
  playlistRef: string,
  windowStartKey: string
): Promise<DailyPracticeQueueRow[]> {
  const variants = buildWindowStartUtcVariants(windowStartKey);
  const results = await db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.playlistRef, playlistRef),
        inArray(dailyPracticeQueue.windowStartUtc, variants),
        eq(dailyPracticeQueue.active, 1)
      )
    )
    .orderBy(dailyPracticeQueue.orderIndex) // ← ADD THIS
    .all();

  return results as DailyPracticeQueueRow[];
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
 * @param userRef - User ID
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
  playlistRef: string,
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
      playlistRef,
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
 * @param userRef - User ID
 * @param repertoireRef - Repertoire ID
 * @param windows - Scheduling windows
 * @returns Persisted queue rows (may be existing rows if conflict)
 */
async function persistQueueRows(
  db: AnyDatabase,
  rows: Omit<DailyPracticeQueueRow, "id">[],
  userRef: string,
  playlistRef: string,
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
      playlistRef,
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
      playlistRef,
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
 * @param userRef - User ID
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
  playlistRef: string,
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
      AND repertoire_ref = ${playlistRef}
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
    playlistRef,
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
 * @param userRef - User ID (from user_profile.id)
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
  playlistRef: string,
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
    WHERE user_ref = ${userRef} AND repertoire_id = ${playlistRef}
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
    playlistRef,
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
          eq(dailyPracticeQueue.playlistRef, playlistRef),
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
  if (maxReviews > 0) {
    q1Rows = await db.all<QueueCandidateRow>(sql`
      SELECT id, scheduled, latest_due
      FROM practice_list_staged
      WHERE user_ref = ${userRef}
        AND repertoire_id = ${playlistRef}
        AND deleted = 0
        AND playlist_deleted = 0
        AND (
          (scheduled IS NOT NULL AND scheduled >= ${windows.startTs} AND scheduled < ${windows.endTs})
          OR (scheduled IS NULL AND latest_due >= ${windows.startTs} AND latest_due < ${windows.endTs})
        )
      ORDER BY COALESCE(scheduled, latest_due) ASC
      LIMIT ${maxReviews}
    `);
  } else {
    q1Rows = await db.all<QueueCandidateRow>(sql`
        SELECT id, scheduled, latest_due
      FROM practice_list_staged
      WHERE user_ref = ${userRef}
        AND repertoire_id = ${playlistRef}
        AND deleted = 0
        AND playlist_deleted = 0
        AND (
          (scheduled IS NOT NULL AND scheduled >= ${windows.startTs} AND scheduled < ${windows.endTs})
          OR (scheduled IS NULL AND latest_due >= ${windows.startTs} AND latest_due < ${windows.endTs})
        )
      ORDER BY COALESCE(scheduled, latest_due) ASC
        LIMIT ${effectiveMaxReviews}
    `);
  }

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
      FROM practice_list_staged
      WHERE user_ref = ${userRef}
        AND repertoire_id = ${playlistRef}
        AND deleted = 0
        AND playlist_deleted = 0
        AND (
          (scheduled IS NOT NULL AND scheduled >= ${windows.windowFloorTs} AND scheduled < ${windows.startTs})
          OR (scheduled IS NULL AND latest_due >= ${windows.windowFloorTs} AND latest_due < ${windows.startTs})
        )
      ORDER BY COALESCE(scheduled, latest_due) DESC
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
        FROM practice_list_staged
        WHERE user_ref = ${userRef}
          AND repertoire_id = ${playlistRef}
          AND deleted = 0
          AND playlist_deleted = 0
          AND scheduled IS NULL
          AND (latest_due IS NULL OR latest_due < ${windows.windowFloorTs})
        ORDER BY id ASC
        LIMIT ${remainingCapacity}
      `);
    } else {
      q3Rows = await db.all<QueueCandidateRow>(sql`
        SELECT id, scheduled, latest_due
        FROM practice_list_staged
        WHERE user_ref = ${userRef}
          AND repertoire_id = ${playlistRef}
          AND deleted = 0
          AND playlist_deleted = 0
          AND (latest_due IS NOT NULL AND latest_due < ${windows.windowFloorTs})
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
      FROM practice_list_staged
      WHERE user_ref = ${userRef}
        AND repertoire_id = ${playlistRef}
        AND deleted = 0
        AND playlist_deleted = 0
        AND scheduled IS NOT NULL
        AND scheduled < ${windows.windowFloorTs}
      ORDER BY scheduled ASC
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
    playlistRef,
    mode,
    localTzOffsetMinutes,
    1 // Force bucket 1 (Due Today)
  );

  const q2Built = buildQueueRows(
    q2Rows,
    windows,
    prefs,
    userRef,
    playlistRef,
    mode,
    localTzOffsetMinutes,
    2 // Force bucket 2 (Recently Lapsed)
  );

  const q3Built = buildQueueRows(
    q3Rows,
    windows,
    prefs,
    userRef,
    playlistRef,
    mode,
    localTzOffsetMinutes,
    3 // Force bucket 3 (New/Unscheduled)
  );

  const q4Built = buildQueueRows(
    q4Rows,
    windows,
    prefs,
    userRef,
    playlistRef,
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
    playlistRef,
    windows
  );

  console.log(
    `[PracticeQueue] Generated queue: ${persisted.length} rows persisted`
  );

  return persisted;
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
 * @param userRef - User ID (from user_profile.id)
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
  playlistRef: string,
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
    playlistRef,
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
    FROM practice_list_staged
    WHERE user_ref = ${userRef}
      AND repertoire_id = ${playlistRef}
      AND deleted = 0
      AND playlist_deleted = 0
      AND (
        (scheduled IS NOT NULL AND scheduled < ${windows.windowFloorTs})
        OR (scheduled IS NULL AND latest_due < ${windows.windowFloorTs})
      )
    ORDER BY COALESCE(scheduled, latest_due) DESC
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
    playlistRef,
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
        eq(dailyPracticeQueue.playlistRef, playlistRef),
        inArray(dailyPracticeQueue.windowStartUtc, variants),
        eq(dailyPracticeQueue.active, 1),
        inArray(dailyPracticeQueue.tuneRef, addedTuneIds)
      )
    )
    .all();

  console.log(`[AddTunes] Successfully added ${added.length} tunes to queue`);

  return added as DailyPracticeQueueRow[];
}
