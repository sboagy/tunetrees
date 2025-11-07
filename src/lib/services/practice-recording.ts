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
import { getPracticeDate } from "../utils/practice-date";
import { generateId } from "../utils/uuid";

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
      id: generateId(),
      lastModifiedAt: getPracticeDate().toISOString(),
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
        lastModifiedAt: getPracticeDate().toISOString(),
      })
      .where(
        and(
          eq(playlistTune.playlistRef, input.playlistRef),
          eq(playlistTune.tuneRef, input.tuneRef)
        )
      );

    // 8. Queue changes for background sync to Supabase
    // Use "update" operation so sync engine does UPSERT (handles duplicates gracefully)
    await queueSync(db, "practice_record", "update", insertedRecord);
    await queueSync(db, "playlist_tune", "update", {
      playlistRef: input.playlistRef,
      tuneRef: input.tuneRef,
    });

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
  tuneId: string,
  playlistId: string
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
 * Commit staged evaluations to practice records
 *
 * Converts all staged evaluations (from table_transient_data) that are part of
 * the current practice queue into permanent practice_record entries.
 *
 * Workflow:
 * 1. Fetch all staged evaluations from table_transient_data for current playlist
 * 2. Filter to only include tunes in daily_practice_queue (current session)
 * 3. For each staged evaluation:
 *    - Create practice_record with unique practiced timestamp
 *    - Update playlist_tune.current (next review date)
 *    - Delete from table_transient_data
 *    - Update daily_practice_queue.completed_at
 * 4. Queue all changes for Supabase sync
 * 5. Persist database to IndexedDB
 *
 * Replaces: legacy /practice/commit_staged/{playlist_id} endpoint
 *
 * @param db - SQLite database instance
 * @param userId - User ID
 * @param playlistId - Playlist ID
 * @param windowStartUtc - Optional: specific queue window to commit (defaults to most recent)
 * @returns Result with count of committed evaluations
 *
 * @example
 * ```typescript
 * const result = await commitStagedEvaluations(db, 1, 5, '2025-11-05 00:00:00');
 * if (result.success) {
 *   console.log(`Committed ${result.count} evaluations`);
 * }
 * ```
 */
export async function commitStagedEvaluations(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  windowStartUtc?: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log("=== commitStagedEvaluations START ===");
    console.log("Parameters:", {
      userId,
      playlistId,
      windowStartUtc,
      userIdType: typeof userId,
      playlistIdType: typeof playlistId,
    });

    const { sql } = await import("drizzle-orm");
    const { persistDb } = await import("../db/client-sqlite");

    // 2. Determine which queue window we're working with
    let activeWindowStart: string;
    if (windowStartUtc) {
      // Use explicitly provided window
      activeWindowStart = windowStartUtc;
      console.log(`Using provided queue window: ${activeWindowStart}`);
    } else {
      // Find the most recent queue window for this playlist
      const latestWindow = await db.get<{ window_start_utc: string }>(sql`
        SELECT window_start_utc
        FROM daily_practice_queue
        WHERE user_ref = ${userId}
          AND playlist_ref = ${playlistId}
        ORDER BY window_start_utc DESC
        LIMIT 1
      `);

      if (!latestWindow) {
        console.log("No queue window found, returning early");
        return { success: true, count: 0 };
      }

      activeWindowStart = latestWindow.window_start_utc;
      console.log(`Using most recent queue window: ${activeWindowStart}`);
    }

    // DEBUG: Check what's actually in table_transient_data
    const allTransientData = await db.all(sql`
      SELECT user_id, tune_id, playlist_id, practiced, recall_eval
      FROM table_transient_data
    `);
    console.log("ALL table_transient_data rows:", allTransientData);

    // DEBUG: Try the exact query we're about to run
    const debugQuery = await db.all(sql`
      SELECT user_id, tune_id, playlist_id, practiced
      FROM table_transient_data
      WHERE user_id = ${userId}
        AND playlist_id = ${playlistId}
        AND practiced IS NOT NULL
    `);
    console.log("DEBUG query result (should match main query):", debugQuery);

    // 1. Fetch all staged evaluations from table_transient_data for this playlist
    console.log("Querying table_transient_data...");
    const stagedEvaluations = await db.all<{
      tune_id: number;
      quality: number;
      difficulty: number;
      stability: number;
      interval: number;
      step: number | null;
      repetitions: number;
      practiced: string;
      due: string;
      state: number;
      goal: string;
      technique: string;
      recall_eval: string;
      elapsed_days: number | null;
      lapses: number | null;
    }>(sql`
      SELECT 
        tune_id,
        quality,
        difficulty,
        stability,
        interval,
        step,
        repetitions,
        practiced,
        due,
        state,
        goal,
        technique,
        recall_eval
      FROM table_transient_data
      WHERE user_id = ${userId}
        AND playlist_id = ${playlistId}
        AND practiced IS NOT NULL
    `);

    console.log("Staged evaluations found:", stagedEvaluations.length);
    if (stagedEvaluations.length > 0) {
      console.log("First staged evaluation:", stagedEvaluations[0]);
    }

    if (stagedEvaluations.length === 0) {
      console.log("No staged evaluations, returning early");
      return { success: true, count: 0 };
    }

    // 2. Get tune_ids that are in the active practice queue window
    console.log("Querying daily_practice_queue...");
    const queueTuneIds = await db.all<{ tune_ref: number }>(sql`
      SELECT DISTINCT tune_ref
      FROM daily_practice_queue
      WHERE user_ref = ${userId}
        AND playlist_ref = ${playlistId}
        AND window_start_utc = ${activeWindowStart}
    `);

    console.log("Queue tune IDs found:", queueTuneIds.length);
    if (queueTuneIds.length > 0) {
      console.log("First queue tune:", queueTuneIds[0]);
    }

    const queueTuneIdSet = new Set(queueTuneIds.map((row) => row.tune_ref));

    // 3. Filter staged evaluations to only include tunes in current queue
    const evaluationsToCommit = stagedEvaluations.filter((eval_) =>
      queueTuneIdSet.has(eval_.tune_id)
    );

    console.log(
      "Evaluations to commit (after filtering):",
      evaluationsToCommit.length
    );

    if (evaluationsToCommit.length === 0) {
      console.log("No evaluations to commit after filtering, returning");
      return { success: true, count: 0 };
    }

    // 4. For each staged evaluation, create practice_record and update related tables
    const committedTuneIds: number[] = [];
    const now = getPracticeDate().toISOString();

    console.log("Starting to commit evaluations...");
    for (const staged of evaluationsToCommit) {
      console.log(`Processing tune ${staged.tune_id}...`);

      // Ensure unique practiced timestamp (check if already exists)
      let practicedTimestamp = staged.practiced;
      let attempts = 0;
      const maxAttempts = 60; // Prevent infinite loop

      while (attempts < maxAttempts) {
        const existing = await db.all<{ id: number }>(sql`
          SELECT id FROM practice_record
          WHERE tune_ref = ${staged.tune_id}
            AND playlist_ref = ${playlistId}
            AND practiced = ${practicedTimestamp}
          LIMIT 1
        `);

        if (existing.length === 0) {
          break; // Timestamp is unique
        }

        // Increment by 1 second to make unique
        const dt = new Date(practicedTimestamp);
        dt.setSeconds(dt.getSeconds() + 1);
        practicedTimestamp = dt.toISOString();
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error(
          `Failed to find unique practiced timestamp for tune ${staged.tune_id} after ${maxAttempts} attempts`
        );
      }

      // Insert practice_record
      const recordId = generateId();
      await db.run(sql`
        INSERT INTO practice_record (
          id,
          playlist_ref,
          tune_ref,
          practiced,
          quality,
          easiness,
          interval,
          repetitions,
          due,
          backup_practiced,
          stability,
          elapsed_days,
          lapses,
          state,
          difficulty,
          step,
          goal,
          technique,
          last_modified_at
        ) VALUES (
          ${recordId},
          ${playlistId},
          ${staged.tune_id},
          ${practicedTimestamp},
          ${staged.quality},
          NULL,
          ${staged.interval},
          ${staged.repetitions},
          ${staged.due},
          NULL,
          ${staged.stability},
          ${staged.elapsed_days ?? null},
          ${staged.lapses ?? 0},
          ${staged.state},
          ${staged.difficulty},
          ${staged.step},
          ${staged.goal},
          ${staged.technique},
          ${now}
        )
      `);

      // Queue sync for the newly inserted record
      // Use "update" operation so sync engine does UPSERT (handles duplicates gracefully)
      await queueSync(db, "practice_record", "update", {
        id: recordId,
        playlistRef: playlistId,
        tuneRef: staged.tune_id,
        practiced: practicedTimestamp,
        quality: staged.quality,
        easiness: null,
        interval: staged.interval,
        repetitions: staged.repetitions,
        due: staged.due,
        backupPracticed: null,
        stability: staged.stability,
        elapsedDays: staged.elapsed_days ?? null,
        lapses: staged.lapses ?? 0,
        state: staged.state,
        difficulty: staged.difficulty,
        step: staged.step,
        goal: staged.goal,
        technique: staged.technique,
        lastModifiedAt: now,
      });

      // Update playlist_tune.current (next review date)
      await db.run(sql`
        UPDATE playlist_tune
        SET current = ${staged.due},
            last_modified_at = ${now}
        WHERE playlist_ref = ${playlistId}
          AND tune_ref = ${staged.tune_id}
      `);

      await queueSync(db, "playlist_tune", "update", {
        playlistRef: playlistId,
        tuneRef: staged.tune_id,
      });

      // Delete from table_transient_data
      console.log(`Deleting staged evaluation for tune ${staged.tune_id}...`);
      await db.run(sql`
        DELETE FROM table_transient_data
        WHERE user_id = ${userId}
          AND tune_id = ${staged.tune_id}
          AND playlist_id = ${playlistId}
      `);

      await queueSync(db, "table_transient_data", "delete", {
        userId,
        tuneId: staged.tune_id,
        playlistId,
      });

      // Mark queue item as completed
      console.log(
        `Marking queue item as completed for tune ${staged.tune_id}...`
      );

      // Get the complete queue item for sync (need id, window_start_utc, and window_end_utc)
      const queueItem = await db.get<{
        id: string;
        window_start_utc: string;
        window_end_utc: string;
      }>(sql`
        SELECT id, window_start_utc, window_end_utc
        FROM daily_practice_queue
        WHERE user_ref = ${userId}
          AND playlist_ref = ${playlistId}
          AND tune_ref = ${staged.tune_id}
          AND window_start_utc = ${activeWindowStart}
        LIMIT 1
      `);

      await db.run(sql`
        UPDATE daily_practice_queue
        SET completed_at = ${now}
        WHERE user_ref = ${userId}
          AND playlist_ref = ${playlistId}
          AND tune_ref = ${staged.tune_id}
          AND window_start_utc = ${activeWindowStart}
      `);

      if (queueItem) {
        await queueSync(db, "daily_practice_queue", "update", {
          id: queueItem.id,
          userRef: userId,
          playlistRef: playlistId,
          windowStartUtc: queueItem.window_start_utc,
          windowEndUtc: queueItem.window_end_utc,
          tuneRef: staged.tune_id,
          completedAt: now,
        });
      }

      committedTuneIds.push(staged.tune_id);
      console.log(`✓ Completed processing tune ${staged.tune_id}`);
    }

    // 5. Persist database to IndexedDB
    console.log("Persisting database...");
    await persistDb();

    console.log(
      `✅ Committed ${committedTuneIds.length} staged evaluations for playlist ${playlistId}`
    );
    console.log("=== commitStagedEvaluations END ===");

    return {
      success: true,
      count: committedTuneIds.length,
    };
  } catch (error) {
    console.error("=== commitStagedEvaluations ERROR ===", error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
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
  tuneId: string,
  playlistId: string
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
    await queueSync(db, "practice_record", "delete", { id: lastRecord.id! });
    await queueSync(db, "playlist_tune", "update", {
      playlistRef: playlistId,
      tuneRef: tuneId,
    });

    return true;
  } catch (error) {
    console.error("Error undoing practice rating:", error);
    return false;
  }
}
