/**
 * Practice Evaluation Staging Service
 *
 * Handles staging of practice evaluations with FSRS preview calculations.
 * When user selects an evaluation, this service:
 * 1. Runs FSRS calculation to compute preview metrics
 * 2. UPSERTs to table_transient_data
 * 3. practice_list_staged VIEW automatically COALESCEs preview with historical data
 * 4. Grid refreshes to show updated latest_* columns
 *
 * Replaces: legacy/tunetrees/app/schedule.py (staging logic)
 *
 * @module lib/services/practice-staging
 */

import { sql } from "drizzle-orm";
import { type Card, createEmptyCard, fsrs, Rating } from "ts-fsrs";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import { queueSync } from "../sync/queue";
import { ensureMinimumNextDay } from "../utils/practice-date";

/**
 * Preview metrics from FSRS calculation
 * These get inserted into table_transient_data for grid preview
 */
export interface FSRSPreviewMetrics {
  quality: number;
  easiness: number | null;
  difficulty: number | null;
  stability: number | null;
  interval: number;
  step: number | null;
  repetitions: number;
  practiced: string;
  due: string;
  state: number;
  goal: string;
  technique: string;
}

/**
 * Map recall evaluation text to FSRS Rating
 */
function mapEvaluationToRating(evaluation: string): Rating {
  const map: Record<string, Rating> = {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
    easy: Rating.Easy,
  };
  return map[evaluation.toLowerCase()] ?? Rating.Good;
}

/**
 * Get latest practice record for a tune
 */
async function getLatestPracticeRecord(
  db: SqliteDatabase,
  tuneId: string,
  playlistId: string
): Promise<Card | null> {
  const result = await db.all<{
    stability: number | null;
    difficulty: number | null;
    state: number | null;
    repetitions: number | null;
    lapses: number | null;
    due: string | null;
    elapsed_days: number | null;
    last_modified_at: string | null;
  }>(sql`
    SELECT 
      stability, 
      difficulty, 
      state, 
      repetitions, 
      lapses,
      due, 
      elapsed_days,
      last_modified_at
    FROM practice_record
    WHERE tune_ref = ${tuneId}
      AND playlist_ref = ${playlistId}
    ORDER BY id DESC
    LIMIT 1
  `);

  if (!result || result.length === 0) {
    return null;
  }

  const record = result[0];

  // Convert to FSRS Card format
  return {
    stability: record.stability ?? 0,
    difficulty: record.difficulty ?? 0,
    state: record.state ?? 0,
    reps: record.repetitions ?? 0,
    lapses: record.lapses ?? 0,
    due: record.due ? new Date(record.due) : new Date(),
    elapsed_days: record.elapsed_days ?? 0,
    scheduled_days: 0,
    learning_steps: 0, // Managed by FSRS
    last_review: record.last_modified_at
      ? new Date(record.last_modified_at)
      : new Date(),
  };
}

/**
 * Stage practice evaluation with FSRS preview
 *
 * Runs FSRS calculation and stores preview metrics in table_transient_data.
 * The practice_list_staged VIEW will automatically COALESCE these values
 * with historical practice_record data for grid display.
 *
 * @param db - SQLite database instance
 * @param userId - User ID
 * @param playlistId - Playlist ID
 * @param tuneId - Tune ID
 * @param evaluation - Recall evaluation ("again", "hard", "good", "easy")
 * @param goal - Practice goal (default: "recall")
 * @param technique - Practice technique (default: "")
 * @returns Preview metrics that will appear in grid
 *
 * @example
 * ```typescript
 * const preview = await stagePracticeEvaluation(db, 1, 5, 123, "good");
 * // Grid will now show preview.stability, preview.due, etc. in latest_* columns
 * ```
 */
export async function stagePracticeEvaluation(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  tuneId: string,
  evaluation: string,
  goal: string = "recall",
  technique: string = ""
): Promise<FSRSPreviewMetrics> {
  // Get latest practice state
  const latestCard = await getLatestPracticeRecord(db, tuneId, playlistId);

  // Initialize FSRS scheduler
  const f = fsrs();

  // Convert evaluation to FSRS rating
  const rating = mapEvaluationToRating(evaluation);

  // Calculate next review
  const now = new Date();
  const card: Card = latestCard ?? createEmptyCard(now);
  const schedulingCards = f.repeat(card, now);

  // Access the specific rating result
  const ratingKey = rating as
    | Rating.Again
    | Rating.Hard
    | Rating.Good
    | Rating.Easy;
  const nextCard = schedulingCards[ratingKey].card;

  // CRITICAL: Ensure tunes are never scheduled for the same day
  // FSRS can schedule very soon (same day) for "Again" ratings, but for
  // tune practice, we enforce a minimum of next day.
  const adjustedDue = ensureMinimumNextDay(nextCard.due, now);

  // Recalculate interval based on adjusted due date
  const adjustedInterval = Math.max(
    1,
    Math.round((adjustedDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Extract preview metrics
  const preview: FSRSPreviewMetrics = {
    quality: rating,
    easiness: null, // FSRS doesn't use easiness (SM2 concept)
    difficulty: nextCard.difficulty,
    stability: nextCard.stability,
    interval: adjustedInterval, // Use adjusted interval (minimum 1 day)
    step: nextCard.state,
    repetitions: nextCard.reps,
    practiced: now.toISOString(),
    due: adjustedDue.toISOString(), // Use adjusted due date (minimum next day)
    state: nextCard.state,
    goal,
    technique,
  };

  // UPSERT to table_transient_data
  const lastModifiedAt = now.toISOString();
  await db.run(sql`
    INSERT INTO table_transient_data (
      user_id,
      tune_id,
      playlist_id,
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
      recall_eval,
      sync_version,
      last_modified_at
    ) VALUES (
      ${userId},
      ${tuneId},
      ${playlistId},
      ${preview.quality},
      ${preview.difficulty},
      ${preview.stability},
      ${preview.interval},
      ${preview.step},
      ${preview.repetitions},
      ${preview.practiced},
      ${preview.due},
      ${preview.state},
      ${preview.goal},
      ${preview.technique},
      ${evaluation},
      1,
      ${lastModifiedAt}
    )
    ON CONFLICT(user_id, tune_id, playlist_id) DO UPDATE SET
      quality = excluded.quality,
      difficulty = excluded.difficulty,
      stability = excluded.stability,
      interval = excluded.interval,
      step = excluded.step,
      repetitions = excluded.repetitions,
      practiced = excluded.practiced,
      due = excluded.due,
      state = excluded.state,
      goal = excluded.goal,
      technique = excluded.technique,
      recall_eval = excluded.recall_eval,
      sync_version = excluded.sync_version,
      last_modified_at = excluded.last_modified_at
  `);

  // Queue for sync to Supabase (so staging appears on other devices)
  await queueSync(
    db,
    "table_transient_data",
    "update", // Always update (UPSERT behavior)
    {
      userId,
      tuneId,
      playlistId,
      ...preview,
      recallEval: evaluation,
      syncVersion: 1,
      lastModifiedAt,
    }
  );

  // Persist database to IndexedDB immediately so page refresh shows staged data
  await persistDb();

  console.log(
    `✅ Staged evaluation for tune ${tuneId}: ${evaluation} (stability: ${preview.stability?.toFixed(
      2
    )}, due: ${preview.due})`
  );

  return preview;
}

/**
 * Clear staged evaluation for a single tune
 *
 * Removes preview data from table_transient_data.
 * Grid will revert to showing historical practice_record data.
 *
 * @param db - SQLite database instance
 * @param userId - User ID
 * @param tuneId - Tune ID
 * @param playlistId - Playlist ID
 */
export async function clearStagedEvaluation(
  db: SqliteDatabase,
  userId: string,
  tuneId: string,
  playlistId: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM table_transient_data
    WHERE user_id = ${userId}
      AND tune_id = ${tuneId}
      AND playlist_id = ${playlistId}
  `);

  // Queue deletion for sync to Supabase
  await queueSync(db, "table_transient_data", "delete", {
    userId,
    tuneId,
    playlistId,
  });

  // Persist database to IndexedDB immediately
  await persistDb();

  console.log(`🗑️  Cleared staged evaluation for tune ${tuneId}`);
}

/**
 * Clear all staged evaluations for a playlist
 *
 * Called after submitting evaluations to clean up transient data.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 */
export async function clearAllStagedForPlaylist(
  db: SqliteDatabase,
  playlistId: string
): Promise<void> {
  await db.run(sql`
    DELETE FROM table_transient_data
    WHERE playlist_id = ${playlistId}
  `);

  console.log(`🗑️  Cleared all staged evaluations for playlist ${playlistId}`);
}
