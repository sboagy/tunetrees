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
  DefaultScheduler,
  type DefaultSchedulerCard,
  type Grade,
  Rating,
  State,
  // type RecordLog,
} from "ts-fsrs";
import { FSRS6_DEFAULT_WEIGHTS } from "ts-fsrs/models/fsrs-6";
import type { SqliteDatabase } from "../db/client-sqlite";
import type {
  IUserSchedulingOptions,
  NewPracticeRecord,
  NextReviewSchedule,
  PracticeRecord,
  PrefsSpacedRepetition,
  RecordPracticeInput,
} from "../db/types";
import { getBuiltInGoals } from "../goals/builtins";
import { generateId } from "../utils/uuid";
import type { SchedulingService } from "./scheduler-interface";

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
 * Goal-specific base intervals (in days) for non-recall goals.
 * User-defined goals may supply their own intervals via the `base_intervals` DB column;
 * this constant acts as a compile-time fallback for system goals.
 * Reference: legacy schedule.py _calculate_goal_specific_due
 */
export const GOAL_BASE_INTERVALS: Record<
  string,
  ReadonlyArray<number>
> = Object.fromEntries(
  getBuiltInGoals().map((goal) => [
    goal.name,
    goal.config.scheduler.id === "builtin:interval-ladder"
      ? goal.config.scheduler.intervalsDays
      : [],
  ])
);

/**
 * Technique-specific interval modifiers
 * Reference: legacy schedule.py _calculate_goal_specific_due
 */
const TECHNIQUE_MODIFIERS = {
  daily_practice: (interval: number) => Math.min(interval, 1), // Cap at daily
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
export class FSRSService implements SchedulingService {
  private readonly scheduler: ReturnType<typeof DefaultScheduler<"FSRS-6">>;
  private readonly repertoireTuneCount: number | null = null; // populated asynchronously
  /** Accessor for tune count (may be null if not yet loaded) */
  getRepertoireTuneCountCached(): number | null {
    return this.repertoireTuneCount;
  }

  constructor(
    prefs: PrefsSpacedRepetition,
    scheduling: IUserSchedulingOptions,
    options?: { repertoireTuneCount?: number | null }
  ) {
    // Parse FSRS weights from JSON string (stored in database)
    const weights = prefs.fsrsWeights
      ? (JSON.parse(prefs.fsrsWeights) as number[])
      : [...FSRS6_DEFAULT_WEIGHTS];

    // Parse learning/relearning steps (stored as minutes array, convert to step format)
    const learningSteps = prefs.learningSteps
      ? (JSON.parse(prefs.learningSteps) as number[]).map((m) => `${m}m`)
      : ["1m", "10m"];
    const relearningSteps = prefs.relearningSteps
      ? (JSON.parse(prefs.relearningSteps) as number[]).map((m) => `${m}m`)
      : ["10m"];

    this.repertoireTuneCount = options?.repertoireTuneCount ?? null;

    const maxReviewsPerDay =
      scheduling.maxReviewsPerDay && scheduling.maxReviewsPerDay > 0
        ? scheduling.maxReviewsPerDay
        : 10;

    // Allow test override via window property
    const tuneCountOverride =
      globalThis.window === undefined
        ? undefined
        : (globalThis.window as any).__TUNETREES_TEST_REPERTOIRE_SIZE__;

    /**
     * Calculate effective repertoire size with bounds for maximum interval calculation.
     *
     * RATIONALE:
     * The maximum interval is calculated to ensure ongoing rotation of the user's
     * repertoire based on how many tunes they can practice per day. This prevents
     * intervals from growing so large that tunes fall out of regular rotation.
     *
     * UPPER BOUND (400 tunes):
     * Even if the user's repertoire exceeds 400 tunes, we cap the effective size
     * to prevent intervals from becoming excessively long. This acknowledges that
     * maintaining perfect spaced repetition for very large repertoires may not be
     * realistic, and users benefit from shorter intervals to keep tunes in rotation.
     *
     * LOWER BOUND (50 tunes):
     * For small repertoires, we set a minimum of 50 tunes to ensure the FSRS
     * algorithm has sufficient headroom to differentiate between rating qualities
     * (Easy vs Good vs Hard). Without this floor, tiny repertoires would result in
     * maximum intervals of only 1-2 days, eliminating the value of spaced repetition
     * and preventing interval growth for "Easy" ratings. Below ~50 tunes, rotation-
     * based capping isn't necessary since the user can practice all tunes frequently.
     *
     * FORMULA: max_interval = 3 * (effective_tunes / reviews_per_day)
     * This gives roughly 3 full rotations of the repertoire before hitting the cap.
     */
    const rawRepertoireTuneCount =
      tuneCountOverride ?? this.repertoireTuneCount ?? 400;
    const effectiveRepertoireTuneCount: number = Math.min(
      Math.max(rawRepertoireTuneCount, 50),
      400
    );

    const testMaxReviewsOverride =
      globalThis.window === undefined
        ? undefined
        : (globalThis.window as any).__TUNETREES_TEST_MAX_REVIEWS_PER_DAY__;
    const effectiveMaxReviews = testMaxReviewsOverride ?? maxReviewsPerDay;

    const calculatedMaxInterval = Math.round(
      3 * (effectiveRepertoireTuneCount / effectiveMaxReviews)
    );

    const testRequestRetentionOverride =
      globalThis.window === undefined
        ? undefined
        : (globalThis.window as any).__TUNETREES_TEST_REQUEST_RETENTION__;

    const testEnableFuzzOverride =
      globalThis.window === undefined
        ? undefined
        : (globalThis.window as any).__TUNETREES_TEST_ENABLE_FUZZ__;

    const hasWindow = globalThis.window !== undefined;
    if (hasWindow) {
      console.log("[FSRSService] Initializing with overrides:", {
        effectiveRepertoireTuneCount,
        effectiveMaxReviews,
        calculatedMaxInterval,
        testRequestRetentionOverride,
        testEnableFuzzOverride,
      });
    }

    // Explicitly retain FSRS-6 and existing stored weights.
    // DefaultScheduler defaults to FSRS-7, which requires a separate history migration.
    this.scheduler = DefaultScheduler({
      version: "FSRS-6",
      weights,
      // High retention (95%) as default because 'Performance' requires higher recall than 'Facts'
      desiredRetention:
        testRequestRetentionOverride ?? prefs.requestRetention ?? 0.95,
      maximumInterval: calculatedMaxInterval,
      enableFuzz:
        testEnableFuzzOverride ??
        (prefs.enableFuzzing ? Boolean(prefs.enableFuzzing) : true),
      enableShortTerm: true, // Always enable for new cards
      learningSteps: learningSteps as `${number}${"m" | "h" | "d"}`[],
      relearningSteps: relearningSteps as `${number}${"m" | "h" | "d"}`[],
    });
  }

  /**
   * Process first review of a tune (NEW or RESCHEDULED state)
   *
   * @param input - Practice session input
   * @returns Next review schedule and updated card state
   */
  async processFirstReview(
    input: RecordPracticeInput
  ): Promise<NextReviewSchedule> {
    const scheduler = await this.scheduler;
    const card = scheduler.newCard({
      now: input.practiced,
      cardId: input.tuneRef,
    });
    const rating = this.qualityToRating(input.quality);

    const schedule = scheduler.review({
      card,
      now: input.practiced,
      grade: rating,
    });

    return {
      nextDue: schedule.card.dueAt,
      state: schedule.card.state,
      stability: schedule.card.stability,
      difficulty: schedule.card.difficulty,
      elapsed_days: 0,
      scheduled_days: schedule.card.scheduledDays,
      reps: schedule.card.reps,
      // Preserve the existing policy: only Again from Review increments lapses.
      lapses:
        card.lapses +
        (rating === Rating.Again && card.state === State.Review ? 1 : 0),
      last_review: schedule.card.lastReviewAt ?? input.practiced,
      interval: this.calculateInterval(input.practiced, schedule.card.dueAt),
    };
  }

  /**
   * Process repeat review of a tune (existing practice history)
   *
   * @param input - Practice session input
   * @param latestRecord - Latest practice record for this tune
   * @returns Next review schedule and updated card state
   */
  async processReview(
    input: RecordPracticeInput,
    latestRecord: PracticeRecord
  ): Promise<NextReviewSchedule> {
    const state = latestRecord.state ?? State.New;
    if (
      state !== State.New &&
      state !== State.Learning &&
      state !== State.Review &&
      state !== State.Relearning
    ) {
      throw new Error(`Invalid persisted FSRS state: ${state}`);
    }

    // Reconstruct FSRS card from latest practice record
    const card: DefaultSchedulerCard<"FSRS-6"> = {
      cardId: input.tuneRef,
      scheduleStatus: (["new", "learning", "review", "learning"] as const)[
        state
      ],
      dueAt: new Date(latestRecord.due ?? new Date()),
      stability: latestRecord.stability ?? 0,
      difficulty: latestRecord.difficulty ?? 0,
      scheduledDays: 0,
      learningStep: 0, // Will be managed by FSRS
      reps: latestRecord.repetitions ?? 0,
      lapses: latestRecord.lapses ?? 0,
      state,
      lastReviewAt: latestRecord.practiced
        ? new Date(latestRecord.practiced)
        : input.practiced,
    };

    const rating = this.qualityToRating(input.quality);

    // Process the review
    const scheduler = await this.scheduler;
    const schedule = scheduler.review({
      card,
      now: input.practiced,
      grade: rating,
    });

    return {
      nextDue: schedule.card.dueAt,
      state: schedule.card.state,
      stability: schedule.card.stability,
      difficulty: schedule.card.difficulty,
      elapsed_days: this.getElapsedDays(card, input.practiced),
      scheduled_days: schedule.card.scheduledDays,
      reps: schedule.card.reps,
      // Preserve the existing policy: only Again from Review increments lapses.
      lapses:
        card.lapses +
        (rating === Rating.Again && card.state === State.Review ? 1 : 0),
      last_review: schedule.card.lastReviewAt ?? input.practiced,
      interval: this.calculateInterval(input.practiced, schedule.card.dueAt),
    };
  }

  private getElapsedDays(
    card: DefaultSchedulerCard<"FSRS-6">,
    practiced: Date
  ): number {
    // v6 removed Card.elapsed_days. Keep our persisted history/plugin field,
    // using the same UTC calendar-day boundaries as v5, not the scheduled due date.
    if (card.state === State.New || !card.lastReviewAt) return 0;
    const utcDay = (date: Date) =>
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor(
      (utcDay(practiced) - utcDay(card.lastReviewAt)) / 86_400_000
    );
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
    latestRecord?: PracticeRecord,
    customBaseIntervals?: ReadonlyArray<number>
  ): Date {
    const goal = input.goal ?? "recall";
    const technique = input.technique;

    // Custom intervals (from user-defined goal DB row) take precedence over compile-time fallback
    const baseIntervals: ReadonlyArray<number> =
      customBaseIntervals && customBaseIntervals.length > 0
        ? customBaseIntervals
        : (GOAL_BASE_INTERVALS[goal] ?? [1, 3, 7, 14, 30]);

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
   * @param repertoireRef - Repertoire reference ID
   * @returns New practice record ready for database insertion
   */
  createPracticeRecord(
    input: RecordPracticeInput,
    schedule: NextReviewSchedule,
    repertoireRef: string
  ): NewPracticeRecord {
    return {
      id: generateId(),
      lastModifiedAt: new Date().toISOString(),
      tuneRef: input.tuneRef,
      repertoireRef: repertoireRef,
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
      step: 0, // Legacy field (not used for FSRS learning-step persistence)
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
  private qualityToRating(quality: number): Grade {
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
  options?: { repertoireTuneCount?: number | null }
): FSRSService {
  return new FSRSService(prefs, scheduling, options);
}

/**
 * Get the total number of tunes in a repertoire.
 * Counts repertoire_tune rows for the provided repertoire.
 * Excludes deleted repertoire_tune rows.
 *
 * @param db Local SQLite database instance
 * @param repertoireRef Repertoire UUID
 * @returns Number of tunes in the user's repertoire
 */
export async function getRepertoireTuneCount(
  db: SqliteDatabase,
  repertoireRef: string
): Promise<number> {
  const rows = db.all<{ cnt: number }>(sql`
    SELECT COUNT(*) AS cnt
    FROM repertoire_tune pt
    WHERE pt.repertoire_ref = ${repertoireRef}
      AND (pt.deleted IS NULL OR pt.deleted = 0)
  `);
  return rows[0]?.cnt ?? 0;
}

// Example usage:
// const tuneCount = await getRepertoireTuneCount(localDb(), currentRepertoireId()!);

/**
 * Construct a goal-heuristic override schedule.
 *
 * Keeps all FSRS-derived state fields (stability, difficulty, state, reps, lapses,
 * elapsed_days, scheduled_days, last_review) but replaces `nextDue` and `interval`
 * with values derived from the goal's base-interval ladder.
 *
 * Exported separately for unit testability.
 *
 * @param fsrsSchedule - The full FSRS schedule used as the base.
 * @param goalSpecificDue - The next-due date from the goal's base-interval ladder.
 * @param practicedAt - The date/time the practice session occurred.
 * @returns Overridden NextReviewSchedule.
 */
export function buildGoalHeuristicOverride(
  fsrsSchedule: NextReviewSchedule,
  goalSpecificDue: Date,
  practicedAt: Date
): NextReviewSchedule {
  const intervalMs = goalSpecificDue.getTime() - practicedAt.getTime();
  const intervalDays = intervalMs / (24 * 60 * 60 * 1000);
  return {
    ...fsrsSchedule,
    nextDue: goalSpecificDue,
    interval: Math.max(0, intervalDays),
  };
}
