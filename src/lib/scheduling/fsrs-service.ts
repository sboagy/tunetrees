/**
 * FSRS Scheduling Service
 *
 * Client-side wrapper for the ts-fsrs library, providing SolidJS-friendly
 * scheduling functionality for practice sessions.
 *
 * Core Responsibilities:
 * - Initialize FSRS scheduler with user preferences
 * - Process practice ratings (Again, Hard, Good, Easy)
 * - Calculate next review dates based on FSRS algorithm
 * - Handle first-time reviews and repeat reviews
 * - Support goal-based scheduling heuristics
 *
 * Reference: legacy/tunetrees/app/schedulers.py (FSRScheduler)
 *           legacy/tunetrees/app/schedule.py (_process_single_tune_feedback)
 */

import { sql } from "drizzle-orm";
import {
  type Card,
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  // type RecordLog,
} from "ts-fsrs";
import type { SqliteDatabase } from "../db/client-sqlite";
import type {
  IUserSchedulingOptions,
  NewPracticeRecord,
  NextReviewSchedule,
  PracticeRecord,
  PrefsSpacedRepetition,
  RecordPracticeInput,
} from "../db/types";
import { generateId } from "../utils/uuid";

/**
 * FSRS quality ratings mapped to ts-fsrs Grade enum
 * Matches the 4-value system used in FSRS (0=Again, 1=Hard, 2=Good, 3=Easy)
 */
export const FSRS_QUALITY_MAP = {
  AGAIN: 1, // Complete failure, restart learning
  HARD: 2, // Difficult, interval increased slightly
  GOOD: 3, // Correct response, standard interval
  EASY: 4, // Very easy, longer interval
} as const;

/**
 * Goal-specific base intervals (in days) for non-recall goals
 * Reference: legacy schedule.py _calculate_goal_specific_due
 */
const GOAL_BASE_INTERVALS = {
  initial_learn: [0.1, 0.5, 1, 2, 4], // Very frequent practice
  fluency: [1, 3, 7, 14, 21], // Building consistency
  session_ready: [0.5, 1, 2, 3, 5], // Intensive short-term
  performance_polish: [2, 5, 10, 15, 21], // Quality refinement
  recall: [], // Uses FSRS algorithm
} as const;

/**
 * Technique-specific interval modifiers
 * Reference: legacy schedule.py _calculate_goal_specific_due
 */
const TECHNIQUE_MODIFIERS = {
  daily_practice: (interval: number) => Math.min(interval, 1.0), // Cap at daily
  motor_skills: (interval: number) => interval * 0.7, // More frequent
  metronome: (interval: number) => interval * 0.8, // Slightly more frequent
  default: (interval: number) => interval, // No modification
} as const;

/**
 * FSRS Scheduler wrapper for SolidJS
 *
 * Provides a clean API for scheduling operations that integrates
 * with Solid signals and stores.
 */
export class FSRSService {
  private scheduler: ReturnType<typeof fsrs>;
  private playlistTuneCount: number | null = null; // populated asynchronously
  /** Accessor for tune count (may be null if not yet loaded) */
  getPlaylistTuneCountCached(): number | null {
    return this.playlistTuneCount;
  }

  constructor(
    prefs: PrefsSpacedRepetition,
    scheduling: IUserSchedulingOptions,
    db: SqliteDatabase,
    playlistRef: string
  ) {
    // Parse FSRS weights from JSON string (stored in database)
    const weights = prefs.fsrsWeights
      ? (JSON.parse(prefs.fsrsWeights) as number[])
      : generatorParameters().w;

    // Parse learning/relearning steps (stored as minutes array, convert to step format)
    const learningSteps = prefs.learningSteps
      ? (JSON.parse(prefs.learningSteps) as number[]).map((m) => `${m}m`)
      : ["1m", "10m"];
    const relearningSteps = prefs.relearningSteps
      ? (JSON.parse(prefs.relearningSteps) as number[]).map((m) => `${m}m`)
      : ["10m"];

    // Determine playlist size (async). Constructor cannot be async, so populate later.
    void getPlaylistTuneCount(db, playlistRef)
      .then((cnt) => {
        this.playlistTuneCount = cnt;
        console.log(
          `[FSRSService] Playlist ${playlistRef} tune count loaded: ${cnt}`
        );
      })
      .catch((e) => {
        console.warn(
          `[FSRSService] Failed to load playlist tune count for ${playlistRef}:`,
          e
        );
      });

    const maxReviewsPerDay =
      scheduling.maxReviewsPerDay && scheduling.maxReviewsPerDay > 0
        ? scheduling.maxReviewsPerDay
        : 10;
    const playlistTuneCount: number = this.playlistTuneCount ?? 400;
    const calculatedMaxInterval = Math.round(
      3 * (playlistTuneCount / maxReviewsPerDay)
    );

    // Initialize ts-fsrs scheduler with user preferences
    this.scheduler = fsrs({
      w: weights,
      // High retention (95%) as default because 'Performance' requires higher recall than 'Facts'
      request_retention: prefs.requestRetention ?? 0.95,
      maximum_interval: calculatedMaxInterval, // prefs.maximumInterval ?? calculatedMaxInterval,
      enable_fuzz: prefs.enableFuzzing ? Boolean(prefs.enableFuzzing) : true,
      enable_short_term: true, // Always enable for new cards
      learning_steps: learningSteps as `${number}${"m" | "h" | "d"}`[],
      relearning_steps: relearningSteps as `${number}${"m" | "h" | "d"}`[],
    });
  }

  /**
   * Process first review of a tune (NEW or RESCHEDULED state)
   *
   * @param input - Practice session input
   * @returns Next review schedule and updated card state
   */
  processFirstReview(input: RecordPracticeInput): NextReviewSchedule {
    const card = createEmptyCard(input.practiced);
    const rating = this.qualityToRating(input.quality);

    // ts-fsrs v5.x uses repeat() for all reviews
    const recordLog = this.scheduler.repeat(card, input.practiced);

    // Get the specific schedule for this rating (cast to Rating.Again/Hard/Good/Easy to index RecordLog)
    const schedule =
      recordLog[
        rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy
      ];

    return {
      nextDue: schedule.card.due,
      state: schedule.card.state,
      stability: schedule.card.stability,
      difficulty: schedule.card.difficulty,
      elapsed_days: schedule.card.elapsed_days,
      scheduled_days: schedule.card.scheduled_days,
      reps: schedule.card.reps,
      lapses: schedule.card.lapses,
      last_review: schedule.card.last_review ?? input.practiced,
      interval: this.calculateInterval(input.practiced, schedule.card.due),
    };
  }

  /**
   * Process repeat review of a tune (existing practice history)
   *
   * @param input - Practice session input
   * @param latestRecord - Latest practice record for this tune
   * @returns Next review schedule and updated card state
   */
  processReview(
    input: RecordPracticeInput,
    latestRecord: PracticeRecord
  ): NextReviewSchedule {
    // Reconstruct FSRS card from latest practice record
    const card: Card = {
      due: new Date(latestRecord.due ?? new Date()),
      stability: latestRecord.stability ?? 0,
      difficulty: latestRecord.difficulty ?? 0,
      elapsed_days: latestRecord.elapsedDays ?? 0,
      scheduled_days: 0,
      learning_steps: 0, // Will be managed by FSRS
      reps: latestRecord.repetitions ?? 0,
      lapses: latestRecord.lapses ?? 0,
      state: latestRecord.state ?? 0,
      last_review: latestRecord.practiced
        ? new Date(latestRecord.practiced)
        : input.practiced,
    };

    const rating = this.qualityToRating(input.quality);

    // Process the review
    const recordLog = this.scheduler.repeat(card, input.practiced);
    const schedule =
      recordLog[
        rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy
      ];

    return {
      nextDue: schedule.card.due,
      state: schedule.card.state,
      stability: schedule.card.stability,
      difficulty: schedule.card.difficulty,
      elapsed_days: schedule.card.elapsed_days,
      scheduled_days: schedule.card.scheduled_days,
      reps: schedule.card.reps,
      lapses: schedule.card.lapses,
      last_review: schedule.card.last_review ?? input.practiced,
      interval: this.calculateInterval(input.practiced, schedule.card.due),
    };
  }

  /**
   * Calculate next review date for non-recall goals
   *
   * Uses goal-specific heuristics instead of FSRS algorithm.
   * Reference: legacy schedule.py _calculate_goal_specific_due
   *
   * @param input - Practice session input
   * @param latestRecord - Latest practice record (optional)
   * @returns Next review date
   */
  calculateGoalSpecificDue(
    input: RecordPracticeInput,
    latestRecord?: PracticeRecord
  ): Date {
    const goal = input.goal ?? "recall";
    const technique = input.technique;

    // Get base intervals for this goal
    const baseIntervals = GOAL_BASE_INTERVALS[
      goal as keyof typeof GOAL_BASE_INTERVALS
    ] ?? [1, 3, 7, 14, 30];

    // Determine current step based on previous repetitions and quality
    let currentStep = 0;
    if (latestRecord?.repetitions) {
      currentStep = Math.min(
        latestRecord.repetitions,
        baseIntervals.length - 1
      );
    }

    // Adjust step based on quality
    if (input.quality >= 3) {
      // Good/Easy
      currentStep = Math.min(currentStep + 1, baseIntervals.length - 1);
    } else if (input.quality <= 1) {
      // Again/Hard
      currentStep = Math.max(0, currentStep - 1);
    }

    // Get interval and apply technique modifier
    const baseInterval = baseIntervals[currentStep];
    const modifier =
      TECHNIQUE_MODIFIERS[technique as keyof typeof TECHNIQUE_MODIFIERS] ??
      TECHNIQUE_MODIFIERS.default;
    const intervalDays = modifier(baseInterval);

    // Calculate next due date
    const nextDue = new Date(input.practiced);
    nextDue.setTime(nextDue.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    return nextDue;
  }

  /**
   * Create a new practice record from scheduling results
   *
   * @param input - Practice session input
   * @param schedule - Next review schedule from FSRS
   * @param playlistRef - Playlist reference ID
   * @returns New practice record ready for database insertion
   */
  createPracticeRecord(
    input: RecordPracticeInput,
    schedule: NextReviewSchedule,
    playlistRef: string
  ): NewPracticeRecord {
    return {
      id: generateId(),
      lastModifiedAt: new Date().toISOString(),
      tuneRef: input.tuneRef,
      playlistRef: playlistRef,
      practiced: input.practiced.toISOString(),
      quality: input.quality,
      easiness: 2.5, // Legacy field (not used in FSRS but kept for compatibility)
      interval: schedule.interval,
      repetitions: schedule.reps,
      due: schedule.nextDue.toISOString(),
      backupPracticed: input.practiced.toISOString(),
      stability: schedule.stability,
      elapsedDays: schedule.elapsed_days,
      lapses: schedule.lapses,
      state: schedule.state,
      difficulty: schedule.difficulty,
      step: 0, // Legacy field (not used in FSRS v5)
      goal: input.goal ?? "recall",
      technique: input.technique,
    };
  }

  /**
   * Convert quality integer (0-5) to FSRS Rating (1-4)
   *
   * Maps TuneTrees quality scale to FSRS 4-value system.
   * Reference: legacy schedule.py quality_to_fsrs_rating
   *
   * @param quality - Quality value (0-5 scale)
   * @returns FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy)
   */
  private qualityToRating(quality: number): Rating {
    const map: Rating[] = [
      Rating.Manual, // is really an error
      Rating.Again,
      Rating.Hard,
      Rating.Good,
      Rating.Easy,
    ];
    const rating = map[quality];
    if (rating === undefined) throw new Error("Quality must be 1–4");
    if (rating === Rating.Manual) throw new Error("Quality can not be Manual");
    return rating;
  }

  /**
   * Calculate interval in days between two dates
   *
   * @param from - Start date
   * @param to - End date
   * @returns Number of days between dates
   */
  private calculateInterval(from: Date, to: Date): number {
    const diffMs = to.getTime() - from.getTime();
    return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }

  // DO NOT REMOVE THIS CODE (Saved for possible later use.)
  // /**
  //  * Get all possible next review schedules for a card
  //  *
  //  * Useful for showing users preview of what each rating will do.
  //  *
  //  * @param card - Current FSRS card state (or null for new card)
  //  * @param now - Current date/time
  //  * @returns Record log with schedules for all 4 ratings
  //  */
  // getPreviewSchedules(card: Card | null, now: Date): RecordLog {
  //   const currentCard: Card = card ?? createEmptyCard(now);
  //   return this.scheduler.repeat(currentCard, now);
  // }
}

/**
 * Factory function to create FSRS service instance
 *
 * @param prefs - User's spaced repetition preferences
 * @returns Configured FSRS service
 */
export function createFSRSService(
  prefs: PrefsSpacedRepetition,
  scheduling: IUserSchedulingOptions,
  db: SqliteDatabase,
  playlistRef: string
): FSRSService {
  return new FSRSService(prefs, scheduling, db, playlistRef);
}

/**
 * Get the total number of tunes in all of a user's playlists (repertoire size).
 * Counts distinct playlist_tune rows for playlists owned by the user.
 * Excludes deleted playlist or playlist_tune rows.
 *
 * @param db Local SQLite database instance
 * @param userInternalId Internal user_profile.id (NOT supabase_user_id)
 * @returns Number of tunes in the user's repertoire
 */
export async function getPlaylistTuneCount(
  db: SqliteDatabase,
  playlistRef: string
): Promise<number> {
  const rows = await db.all<{ cnt: number }>(sql`
    SELECT COUNT(*) AS cnt
    FROM playlist_tune pt
    WHERE pt.playlist_ref = ${playlistRef}
      AND (pt.deleted IS NULL OR pt.deleted = 0)
  `);
  return rows[0]?.cnt ?? 0;
}

// Example usage:
// const tuneCount = await getPlaylistTuneCount(localDb(), currentPlaylistId()!);
