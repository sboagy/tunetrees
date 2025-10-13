/**
 * Practice Recording Service
 *
 * Client-side service for recording practice sessions with FSRS scheduling.
 * All operations write to local SQLite WASM, then queue for background sync.
 *
 * Core Responsibilities:
 * - Record practice ratings (Again/Hard/Good/Easy)
 * - Calculate next review dates using FSRS
 * - Update playlist_tune.current (next review date)
 * - Write to local SQLite
 * - Queue changes for sync to Supabase
 *
 * Replaces legacy server-side endpoints:
 * - legacy/tunetrees/api/endpoints/practice.py#update_practice_feedbacks
 * - legacy/tunetrees/app/schedule.py#_process_single_tune_feedback
 *
 * @module lib/services/practice-recording
 */

import { and, eq } from "drizzle-orm";
import type { SqliteDatabase } from "../db/client-sqlite";
import {
  getLatestPracticeRecord,
  getUserPreferences,
} from "../db/queries/practice";
import { playlistTune, practiceRecord } from "../db/schema";
import type {
  NewPracticeRecord,
  NextReviewSchedule,
  RecordPracticeInput,
} from "../db/types";
import { FSRS_QUALITY_MAP, FSRSService } from "../scheduling/fsrs-service";
import { queueSync } from "../sync/queue";

/**
 * Result of recording a practice rating
 */
export interface RecordPracticeResult {
  success: boolean;
  practiceRecord?: NewPracticeRecord;
  nextReview?: NextReviewSchedule;
  error?: string;
}

/**
 * Record a practice rating for a tune
 *
 * This is the main entry point for recording practice sessions.
 * It handles the complete workflow:
 * 1. Get user FSRS preferences
 * 2. Get tune's practice history
 * 3. Calculate next review date using FSRS
 * 4. Create practice record in local SQLite
 * 5. Update playlist_tune.current field
 * 6. Queue changes for background sync
 *
 * Replaces: legacy update_practice_feedbacks() endpoint
 *
 * @param db - SQLite database instance
 * @param userId - User UUID
 * @param input - Practice rating input (tune, quality, goal, etc.)
 * @returns Result with practice record and next review schedule
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const result = await recordPracticeRating(db, 'user-uuid', {
 *   tune_ref: 123,
 *   playlist_ref: 1,
 *   quality: 3, // Good
 *   goal: 'recall',
 *   practiced: new Date(),
 * });
 *
 * if (result.success) {
 *   console.log('Next review:', result.nextReview?.due);
 * }
 * ```
 */
export async function recordPracticeRating(
  db: SqliteDatabase,
  userId: string,
  input: RecordPracticeInput
): Promise<RecordPracticeResult> {
  try {
    // 1. Get user FSRS preferences
    const prefs = await getUserPreferences(db, userId);
    if (!prefs) {
      return {
        success: false,
        error: "User FSRS preferences not found",
      };
    }

    // 2. Initialize FSRS service with user preferences
    const fsrsService = new FSRSService(prefs);

    // 3. Get latest practice record for this tune (for FSRS history)
    const latestRecord = await getLatestPracticeRecord(
      db,
      input.tuneRef,
      input.playlistRef
    );

    // 4. Calculate next review schedule using FSRS
    const schedule = latestRecord
      ? fsrsService.processReview(input, latestRecord)
      : fsrsService.processFirstReview(input);

    // 5. Create new practice record
    const practicedDateStr = input.practiced.toISOString();
    const dueStr = schedule.nextDue.toISOString();

    const newRecord: NewPracticeRecord = {
      lastModifiedAt: new Date().toISOString(),
      playlistRef: input.playlistRef,
      tuneRef: input.tuneRef,
      practiced: practicedDateStr,
      quality: input.quality,
      easiness: null, // Legacy SM2 field, not used in FSRS
      interval: schedule.interval,
      repetitions: schedule.reps,
      due: dueStr,
      backupPracticed: null, // For migration compatibility
      stability: schedule.stability,
      elapsedDays: schedule.elapsed_days,
      lapses: schedule.lapses,
      state: schedule.state,
      difficulty: schedule.difficulty,
      step: null,
      goal: input.goal || "recall",
      technique: input.technique || null,
    };

    // 6. Insert practice record into local SQLite
    const insertResult = await db
      .insert(practiceRecord)
      .values(newRecord)
      .returning();

    const insertedRecord = insertResult[0];

    if (!insertedRecord) {
      return {
        success: false,
        error: "Failed to insert practice record",
      };
    }

    // 7. Update playlist_tune.current field (next review date)
    await db
      .update(playlistTune)
      .set({
        current: dueStr,
        lastModifiedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(playlistTune.playlistRef, input.playlistRef),
          eq(playlistTune.tuneRef, input.tuneRef)
        )
      );

    // 8. Queue changes for background sync to Supabase
    await queueSync(db, "practice_record", insertedRecord.id!, "insert");
    await queueSync(
      db,
      "playlist_tune",
      `${input.playlistRef}-${input.tuneRef}`,
      "update"
    );

    return {
      success: true,
      practiceRecord: insertedRecord,
      nextReview: schedule,
    };
  } catch (error) {
    console.error("Error recording practice rating:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Batch record multiple practice ratings
 *
 * Used when recording a complete practice session with multiple tunes.
 * Processes each rating sequentially to maintain proper FSRS state.
 *
 * @param db - SQLite database instance
 * @param userId - User UUID
 * @param inputs - Array of practice rating inputs
 * @returns Array of results for each rating
 *
 * @example
 * ```typescript
 * const results = await batchRecordPracticeRatings(db, 'user-uuid', [
 *   { tune_ref: 123, playlist_ref: 1, quality: 3, goal: 'recall', practiced: new Date() },
 *   { tune_ref: 456, playlist_ref: 1, quality: 4, goal: 'recall', practiced: new Date() },
 * ]);
 *
 * const successCount = results.filter(r => r.success).length;
 * console.log(`Recorded ${successCount} of ${results.length} ratings`);
 * ```
 */
export async function batchRecordPracticeRatings(
  db: SqliteDatabase,
  userId: string,
  inputs: RecordPracticeInput[]
): Promise<RecordPracticeResult[]> {
  const results: RecordPracticeResult[] = [];

  // Process sequentially to maintain proper FSRS state
  // (each rating depends on previous practice history)
  for (const input of inputs) {
    const result = await recordPracticeRating(db, userId, input);
    results.push(result);

    // Stop processing on first error if desired
    // (commented out - currently processes all ratings)
    // if (!result.success) break;
  }

  return results;
}

/**
 * Get practice statistics for a tune
 *
 * Provides summary statistics useful for UI display:
 * - Total practice count
 * - Success rate (Good/Easy vs Again/Hard)
 * - Current streak
 * - Average interval
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param playlistId - Playlist ID
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = await getPracticeStatistics(db, 123, 1);
 * console.log(`Practiced ${stats.totalCount} times`);
 * console.log(`Success rate: ${stats.successRate}%`);
 * ```
 */
export async function getPracticeStatistics(
  db: SqliteDatabase,
  tuneId: number,
  playlistId: number
): Promise<{
  totalCount: number;
  successRate: number;
  currentStreak: number;
  averageInterval: number;
}> {
  const records = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.playlistRef, playlistId)
      )
    )
    .orderBy(practiceRecord.practiced);

  if (records.length === 0) {
    return {
      totalCount: 0,
      successRate: 0,
      currentStreak: 0,
      averageInterval: 0,
    };
  }

  // Calculate success rate (Good=3 or Easy=4)
  const successCount = records.filter(
    (r) =>
      r.quality === FSRS_QUALITY_MAP.GOOD || r.quality === FSRS_QUALITY_MAP.EASY
  ).length;
  const successRate = (successCount / records.length) * 100;

  // Calculate current streak (consecutive Good/Easy from end)
  let currentStreak = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    const quality = records[i].quality;
    if (
      quality === FSRS_QUALITY_MAP.GOOD ||
      quality === FSRS_QUALITY_MAP.EASY
    ) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate average interval
  const totalInterval = records.reduce((sum, r) => sum + (r.interval || 0), 0);
  const averageInterval = totalInterval / records.length;

  return {
    totalCount: records.length,
    successRate: Math.round(successRate),
    currentStreak,
    averageInterval: Math.round(averageInterval * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Undo last practice rating
 *
 * Removes the most recent practice record and reverts playlist_tune.current
 * to the previous scheduled date. Useful for correcting mistakes.
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param playlistId - Playlist ID
 * @returns True if undo successful, false otherwise
 *
 * @example
 * ```typescript
 * const undone = await undoLastPracticeRating(db, 123, 1);
 * if (undone) {
 *   console.log('Last rating undone successfully');
 * }
 * ```
 */
export async function undoLastPracticeRating(
  db: SqliteDatabase,
  tuneId: number,
  playlistId: number
): Promise<boolean> {
  try {
    // Get the last two practice records
    const records = await db
      .select()
      .from(practiceRecord)
      .where(
        and(
          eq(practiceRecord.tuneRef, tuneId),
          eq(practiceRecord.playlistRef, playlistId)
        )
      )
      .orderBy(practiceRecord.practiced)
      .limit(2);

    if (records.length === 0) {
      return false; // Nothing to undo
    }

    const lastRecord = records[records.length - 1];
    const previousRecord =
      records.length > 1 ? records[records.length - 2] : null;

    // Delete the last record
    await db
      .delete(practiceRecord)
      .where(eq(practiceRecord.id, lastRecord.id!));

    // Revert playlist_tune.current to previous due date (or null if no previous)
    const previousDue = previousRecord?.due || null;
    await db
      .update(playlistTune)
      .set({
        current: previousDue,
        lastModifiedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(playlistTune.playlistRef, playlistId),
          eq(playlistTune.tuneRef, tuneId)
        )
      );

    // Queue sync operations
    await queueSync(db, "practice_record", lastRecord.id!, "delete");
    await queueSync(db, "playlist_tune", `${playlistId}-${tuneId}`, "update");

    return true;
  } catch (error) {
    console.error("Error undoing practice rating:", error);
    return false;
  }
}
