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
import { Rating } from "ts-fsrs";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import type { RecordPracticeInput } from "../db/types";
import { ensureMinimumNextDay } from "../utils/practice-date";
import { evaluatePractice } from "./practice-recording";

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
// Removed custom latest record reconstruction; evaluatePractice handles this internally.

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
  const now = new Date();
  // Make practiced timestamps deterministic across devices by removing
  // millisecond precision. This reduces near-duplicate practice events
  // that differ only by fractional seconds.
  now.setMilliseconds(0);
  // Build RecordPracticeInput for evaluatePractice
  const input: RecordPracticeInput = {
    tuneRef: tuneId,
    playlistRef: playlistId,
    practiced: now,
    // Use FSRS Rating values (Again=1, Hard=2, Good=3, Easy=4) – Manual (0) not used here
    quality: mapEvaluationToRating(evaluation),
    goal,
    technique,
  };
  const { schedule } = await evaluatePractice(db, userId, input);

  // Enforce minimum next-day due date (business rule)
  const adjustedDue = ensureMinimumNextDay(schedule.nextDue, now);
  const intervalDays = Math.max(
    1,
    Math.round((adjustedDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  const preview: FSRSPreviewMetrics = {
    quality: input.quality,
    easiness: null,
    difficulty: schedule.difficulty,
    stability: schedule.stability,
    interval: intervalDays,
    step: schedule.state,
    repetitions: schedule.reps,
    practiced: now.toISOString(),
    due: adjustedDue.toISOString(),
    state: schedule.state,
    goal,
    technique,
  };

  // UPSERT to table_transient_data
  const lastModifiedAt = now.toISOString();
  await db.run(sql`
    INSERT INTO table_transient_data (
      user_id,
      tune_id,
      repertoire_id,
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
    ON CONFLICT(user_id, tune_id, repertoire_id) DO UPDATE SET
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

  // Sync is handled automatically by SQL triggers populating sync_outbox

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
      AND repertoire_id = ${playlistId}
  `);

  // Sync is handled automatically by SQL triggers populating sync_outbox

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
    WHERE repertoire_id = ${playlistId}
  `);

  console.log(`🗑️  Cleared all staged evaluations for playlist ${playlistId}`);
}
