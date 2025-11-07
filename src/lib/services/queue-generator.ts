/**
 * Daily Practice Queue Generator
 *
 * Client-side service for generating frozen daily practice queue snapshots.
 * Creates a stable queue for the day that doesn't change as the user practices.
 *
 * Core Responsibilities:
 * - Classify tunes into buckets (1=due today, 2=recently lapsed, 3=backfill)
 * - Build daily queue snapshot with ordering
 * - Persist queue to local SQLite
 * - Support queue refill/regeneration
 *
 * Bucket Classification:
 * - Bucket 1: Due within today's window (start_of_day to end_of_day)
 * - Bucket 2: Recently lapsed (window_floor to start_of_day)
 * - Bucket 3: Backfill/older material (before window_floor)
 *
 * Replaces legacy server-side queue generation:
 * - legacy/tunetrees/app/queries.py#generate_or_get_practice_queue
 * - legacy/tunetrees/app/queries.py#_build_queue_rows
 * - legacy/tunetrees/app/queries.py#_classify_queue_bucket
 *
 * @module lib/services/queue-generator
 */

import { and, eq, lt } from "drizzle-orm";
import type { SqliteDatabase } from "../db/client-sqlite";
import { getDueTunesLegacy } from "../db/queries/practice";
import { dailyPracticeQueue, playlistTune, userProfile } from "../db/schema";
import type { DailyPracticeQueue, NewDailyPracticeQueue } from "../db/types";
import { queueSync } from "../sync/queue";
import { generateId } from "../utils/uuid";

/**
 * Get user_profile.id from supabase_user_id (UUID)
 * Returns null if user not found
 */
async function getUserProfileId(
  db: SqliteDatabase,
  supabaseUserId: string
): Promise<string | null> {
  // Returns UUID string
  const result = await db
    .select({ id: userProfile.id })
    .from(userProfile)
    .where(eq(userProfile.supabaseUserId, supabaseUserId))
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0].id; // UUID string
}

/**
 * Scheduling windows for bucket classification
 */
export interface SchedulingWindows {
  /** Start of today (00:00:00 UTC) */
  startOfDayUtc: Date;
  /** End of today (23:59:59 UTC) */
  endOfDayUtc: Date;
  /** Floor of acceptable delinquency window (e.g., 7 days ago) */
  windowFloorUtc: Date;
  /** Window start timestamp (ISO string) */
  startTs: string;
  /** Window end timestamp (ISO string) */
  endTs: string;
}

/**
 * Queue generation options
 */
export interface QueueGenerationOptions {
  /** Enable backfill (bucket 3) - defaults to false */
  enableBackfill?: boolean;
  /** Force regeneration even if queue exists - defaults to false */
  forceRegen?: boolean;
  /** Acceptable delinquency window in days - defaults to 7 */
  delinquencyWindowDays?: number;
  /** Local timezone offset in minutes - defaults to 0 (UTC) */
  tzOffsetMinutes?: number;
}

/**
 * Compute scheduling windows for bucket classification
 *
 * Calculates the time boundaries used to classify tunes into buckets:
 * - Today's window (bucket 1)
 * - Lapsed window (bucket 2)
 * - Backfill window (bucket 3)
 *
 * @param sitdownDate - Practice session date (defaults to now)
 * @param delinquencyWindowDays - Days to look back for lapsed tunes (default: 7)
 * @param tzOffsetMinutes - Local timezone offset in minutes (default: 0 = UTC)
 * @returns Scheduling windows object
 *
 * @example
 * ```typescript
 * const windows = computeSchedulingWindows(new Date(), 7, -300); // EST = UTC-5
 * // Returns windows for today (bucket 1) and last 7 days (bucket 2)
 * ```
 */
export function computeSchedulingWindows(
  sitdownDate: Date = new Date(),
  delinquencyWindowDays = 7,
  tzOffsetMinutes = 0
): SchedulingWindows {
  // Adjust for local timezone
  const localDate = new Date(
    sitdownDate.getTime() + tzOffsetMinutes * 60 * 1000
  );

  // Start of day (00:00:00)
  const startOfDayUtc = new Date(localDate);
  startOfDayUtc.setUTCHours(0, 0, 0, 0);

  // End of day (23:59:59)
  const endOfDayUtc = new Date(localDate);
  endOfDayUtc.setUTCHours(23, 59, 59, 999);

  // Window floor (N days ago at 00:00:00)
  const windowFloorUtc = new Date(startOfDayUtc);
  windowFloorUtc.setUTCDate(
    windowFloorUtc.getUTCDate() - delinquencyWindowDays
  );

  return {
    startOfDayUtc,
    endOfDayUtc,
    windowFloorUtc,
    startTs: startOfDayUtc.toISOString(),
    endTs: endOfDayUtc.toISOString(),
  };
}

/**
 * Classify a tune into a bucket based on its scheduled/due date
 *
 * Bucket classification:
 * - Bucket 1: Due today (within today's window)
 * - Bucket 2: Recently lapsed (within delinquency window but before today)
 * - Bucket 3: Backfill (older than delinquency window)
 *
 * Reference: legacy queries.py#_classify_queue_bucket
 *
 * @param coalescedDate - Scheduled date or latest due date
 * @param windows - Scheduling windows
 * @returns Bucket number (1, 2, or 3)
 */
export function classifyQueueBucket(
  coalescedDate: string | null | undefined,
  windows: SchedulingWindows
): number {
  if (!coalescedDate) {
    return 1; // Default to bucket 1 (due today)
  }

  try {
    const dt = new Date(coalescedDate);

    // Bucket 1: Due today
    if (dt >= windows.startOfDayUtc && dt < windows.endOfDayUtc) {
      return 1;
    }

    // Bucket 2: Recently lapsed
    if (dt >= windows.windowFloorUtc && dt < windows.startOfDayUtc) {
      return 2;
    }

    // Bucket 3: Backfill (older)
    return 3;
  } catch {
    // Parse error - default to bucket 1
    console.warn(
      "Failed to parse date for bucket classification:",
      coalescedDate
    );
    return 1;
  }
}

/**
 * Generate daily practice queue snapshot
 *
 * Creates a frozen snapshot of the practice queue for the day.
 * This queue remains stable throughout the day, even as users
 * practice and update their progress.
 *
 * Workflow:
 * 1. Check for existing active queue (unless forceRegen)
 * 2. Get due tunes from local database
 * 3. Classify tunes into buckets
 * 4. Build queue entries with order
 * 5. Persist to daily_practice_queue table
 * 6. Queue for background sync
 *
 * Replaces: legacy generate_or_get_practice_queue()
 *
 * @param db - SQLite database instance
 * @param userId - User UUID
 * @param playlistId - Playlist ID
 * @param sitdownDate - Practice session date (defaults to now)
 * @param options - Queue generation options
 * @returns Array of daily practice queue entries
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const queue = await generateDailyPracticeQueue(
 *   db,
 *   'user-uuid',
 *   1,
 *   new Date(),
 *   { enableBackfill: false, forceRegen: false }
 * );
 * console.log(`Generated queue with ${queue.length} tunes`);
 * ```
 */
export async function generateDailyPracticeQueue(
  db: SqliteDatabase,
  userId: string,
  playlistId: string, // UUID
  sitdownDate: Date = new Date(),
  options: QueueGenerationOptions = {}
): Promise<DailyPracticeQueue[]> {
  const {
    enableBackfill = false,
    forceRegen = false,
    delinquencyWindowDays = 7,
    tzOffsetMinutes = 0,
  } = options;

  // Map UUID to integer user_profile.id
  const userRef = await getUserProfileId(db, userId);
  if (!userRef) {
    throw new Error(`User not found: ${userId}`);
  }

  // Compute scheduling windows
  const windows = computeSchedulingWindows(
    sitdownDate,
    delinquencyWindowDays,
    tzOffsetMinutes
  );

  // Check for existing active queue
  if (!forceRegen) {
    const existing = await db
      .select()
      .from(dailyPracticeQueue)
      .where(
        and(
          eq(dailyPracticeQueue.userRef, userRef),
          eq(dailyPracticeQueue.playlistRef, playlistId),
          eq(dailyPracticeQueue.windowStartUtc, windows.startTs),
          eq(dailyPracticeQueue.active, 1)
        )
      );

    if (existing.length > 0) {
      console.log("✅ Using existing daily practice queue");
      return existing;
    }
  }

  // Deactivate existing queue if regenerating
  if (forceRegen) {
    await db
      .update(dailyPracticeQueue)
      .set({ active: 0 })
      .where(
        and(
          eq(dailyPracticeQueue.userRef, userRef),
          eq(dailyPracticeQueue.playlistRef, playlistId),
          eq(dailyPracticeQueue.windowStartUtc, windows.startTs)
        )
      );
  }

  // Get due tunes
  const dueTunes = await getDueTunesLegacy(
    db,
    playlistId,
    sitdownDate,
    delinquencyWindowDays
  );

  // Build queue entries
  const queueEntries: NewDailyPracticeQueue[] = [];
  const now = new Date().toISOString();

  for (let orderIndex = 0; orderIndex < dueTunes.length; orderIndex++) {
    const tune = dueTunes[orderIndex];

    // Get coalesced timestamp (scheduled OR latest_due)
    const coalescedTs =
      tune.scheduled || tune.schedulingInfo?.due || windows.startTs;

    // Classify into bucket
    const bucket = classifyQueueBucket(coalescedTs, windows);

    // Skip bucket 3 (backfill) if not enabled
    if (bucket === 3 && !enableBackfill) {
      continue;
    }

    queueEntries.push({
      id: generateId(), // Generate UUID for queue entry
      lastModifiedAt: now,
      userRef: userRef,
      playlistRef: playlistId,
      mode: "per_day",
      queueDate: windows.startTs.substring(0, 10), // YYYY-MM-DD
      windowStartUtc: windows.startTs,
      windowEndUtc: windows.endTs,
      tuneRef: tune.tuneRef,
      bucket,
      orderIndex: orderIndex,
      snapshotCoalescedTs: coalescedTs,
      scheduledSnapshot: tune.scheduled,
      latestDueSnapshot: tune.schedulingInfo?.due || null,
      acceptableDelinquencyWindowSnapshot: delinquencyWindowDays,
      tzOffsetMinutesSnapshot: tzOffsetMinutes,
      generatedAt: now,
      exposuresRequired: null,
      exposuresCompleted: 0,
      outcome: null,
      active: 1,
    });
  }

  // Persist queue entries
  if (queueEntries.length === 0) {
    console.log("ℹ️  No tunes to add to daily practice queue");
    return [];
  }

  const inserted = await db
    .insert(dailyPracticeQueue)
    .values(queueEntries)
    .returning();

  console.log(
    `✅ Generated daily practice queue with ${inserted.length} tunes`
  );

  // Queue for background sync
  for (const entry of inserted) {
    await queueSync(db, "daily_practice_queue", "insert", entry);
  }

  return inserted;
}

/**
 * Refill practice queue with additional backfill tunes
 *
 * Appends older tunes (bucket 3) to an existing active queue.
 * This allows users to explicitly request more practice material
 * beyond the initial daily snapshot.
 *
 * Replaces: legacy refill_practice_queue()
 *
 * @param db - SQLite database instance
 * @param userId - User UUID
 * @param playlistId - Playlist ID
 * @param count - Number of backfill tunes to add
 * @param sitdownDate - Practice session date (defaults to now)
 * @returns Array of newly added queue entries
 *
 * @example
 * ```typescript
 * const additionalTunes = await refillPracticeQueue(db, 'user-uuid', 1, 5);
 * console.log(`Added ${additionalTunes.length} more tunes to practice`);
 * ```
 */
export async function refillPracticeQueue(
  db: SqliteDatabase,
  userId: string,
  playlistId: string, // UUID
  count = 5,
  sitdownDate: Date = new Date()
): Promise<DailyPracticeQueue[]> {
  // Map user UUID to integer ID
  const userRef = await getUserProfileId(db, userId);
  if (!userRef) {
    throw new Error(`User profile not found for user: ${userId}`);
  }

  if (count <= 0) {
    return [];
  }

  const windows = computeSchedulingWindows(sitdownDate, 7, 0);

  // Get existing active queue
  const existing = await db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.playlistRef, playlistId),
        eq(dailyPracticeQueue.windowStartUtc, windows.startTs),
        eq(dailyPracticeQueue.active, 1)
      )
    );

  if (existing.length === 0) {
    console.log("ℹ️  No active queue to refill");
    return [];
  }

  // Get tune IDs already in queue
  const existingTuneIds = existing.map((e) => e.tuneRef);

  // Query for backfill candidates (tunes not in queue, scheduled before window floor)
  const backfillCandidates = await db
    .select({
      tuneRef: playlistTune.tuneRef,
      scheduled: playlistTune.current,
    })
    .from(playlistTune)
    .where(
      and(
        eq(playlistTune.playlistRef, playlistId),
        eq(playlistTune.deleted, 0),
        lt(playlistTune.current, windows.windowFloorUtc.toISOString())
      )
    )
    .limit(count + existingTuneIds.length); // Over-fetch to account for filtering

  // Filter out tunes already in queue
  const newBackfill = backfillCandidates
    .filter((c) => !existingTuneIds.includes(c.tuneRef))
    .slice(0, count);

  if (newBackfill.length === 0) {
    console.log("ℹ️  No backfill tunes available");
    return [];
  }

  // Build new queue entries
  const nextOrderIndex = Math.max(...existing.map((e) => e.orderIndex)) + 1;
  const now = new Date().toISOString();
  const newEntries: NewDailyPracticeQueue[] = newBackfill.map((tune, idx) => ({
    id: generateId(), // Generate UUID for queue entry
    lastModifiedAt: now,
    userRef: userRef,
    playlistRef: playlistId,
    mode: "per_day",
    queueDate: windows.startTs.substring(0, 10),
    windowStartUtc: windows.startTs,
    windowEndUtc: windows.endTs,
    tuneRef: tune.tuneRef,
    bucket: 3, // Backfill bucket
    orderIndex: nextOrderIndex + idx,
    snapshotCoalescedTs: tune.scheduled || windows.startTs,
    scheduledSnapshot: tune.scheduled,
    latestDueSnapshot: null,
    acceptableDelinquencyWindowSnapshot: 7,
    tzOffsetMinutesSnapshot: 0,
    generatedAt: now,
    exposuresRequired: null,
    exposuresCompleted: 0,
    outcome: null,
    active: 1,
  }));

  // Insert and sync
  const inserted = await db
    .insert(dailyPracticeQueue)
    .values(newEntries)
    .returning();

  for (const entry of inserted) {
    await queueSync(db, "daily_practice_queue", "insert", entry);
  }

  console.log(`✅ Refilled queue with ${inserted.length} backfill tunes`);
  return inserted;
}

/**
 * Get bucket counts for active queue
 *
 * Returns count of tunes in each bucket for diagnostic/UI purposes.
 *
 * @param db - SQLite database instance
 * @param userId - User UUID
 * @param playlistId - Playlist ID
 * @param windowStartUtc - Window start timestamp
 * @returns Object with bucket counts { 1: count, 2: count, 3: count }
 */
export async function getQueueBucketCounts(
  db: SqliteDatabase,
  userId: string,
  playlistId: string, // UUID
  windowStartUtc: string
): Promise<Record<number, number>> {
  // Map user UUID to integer ID
  const userRef = await getUserProfileId(db, userId);
  if (!userRef) {
    throw new Error(`User profile not found for user: ${userId}`);
  }

  const queue = await db
    .select({ bucket: dailyPracticeQueue.bucket })
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.playlistRef, playlistId),
        eq(dailyPracticeQueue.windowStartUtc, windowStartUtc),
        eq(dailyPracticeQueue.active, 1)
      )
    );

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const entry of queue) {
    counts[entry.bucket] = (counts[entry.bucket] || 0) + 1;
  }

  return counts;
}
