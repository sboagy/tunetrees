import {
  DefaultScheduler,
  type DefaultSchedulerCard,
  type Grade,
} from "ts-fsrs";
import type { GoalConfig, GoalScheduler } from "./config";
import { type Fsrs6State, parseFsrs6State } from "./state";

type FsrsConfig = Extract<GoalScheduler, { id: "builtin:fsrs6" }>;
export interface FsrsPredecessor {
  state: Fsrs6State;
  practiced: Date;
  due: Date;
}

export function effectiveFsrsMaximum(
  config: GoalConfig,
  goalTuneCount: number
): number {
  if (config.scheduler.id !== "builtin:fsrs6")
    throw new Error("Goal does not use FSRS-6");
  if (!Number.isSafeInteger(goalTuneCount) || goalTuneCount < 0)
    throw new Error("Invalid goal tune count");
  const explicit = config.scheduler.maximumIntervalDays;
  if (config.daily.maximum === 0) return explicit;
  const population = Math.min(400, Math.max(50, goalTuneCount));
  return Math.min(
    explicit,
    Math.max(1, Math.round((3 * population) / config.daily.maximum))
  );
}

/** Common timestamps are supplied by the event, never duplicated in JSON state. */
export function fsrsCard(
  previous: FsrsPredecessor
): DefaultSchedulerCard<"FSRS-6"> {
  const state = parseFsrs6State(previous.state);
  if (
    !Number.isFinite(previous.practiced.getTime()) ||
    !Number.isFinite(previous.due.getTime())
  )
    throw new Error("Invalid FSRS predecessor timestamps");
  return {
    dueAt: new Date(previous.due),
    lastReviewAt: new Date(previous.practiced),
    scheduleStatus: (["new", "learning", "review", "learning"] as const)[
      state.status
    ],
    // Stable identity keeps repeated previews deterministic, including optional fuzz.
    cardId: "goal-preview",
    stability: state.stability,
    difficulty: state.difficulty,
    scheduledDays: state.scheduledDays,
    learningStep: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.status,
  };
}

/** Explicit FSRS-6 model; the separate #924 migration controls a future model change. */
export async function calculateFsrs(input: {
  config: FsrsConfig;
  maximumInterval: number;
  rating: Grade;
  practiced: Date;
  predecessor: FsrsPredecessor | null;
}) {
  const config = input.config;
  const scheduler = await DefaultScheduler({
    version: "FSRS-6",
    weights: config.weights,
    desiredRetention: config.retention,
    maximumInterval: input.maximumInterval,
    enableFuzz: config.fuzz,
    enableShortTerm: true,
    learningSteps: config.learningStepsMinutes.map(
      (value): `${number}m` => `${value}m`
    ),
    relearningSteps: config.relearningStepsMinutes.map(
      (value): `${number}m` => `${value}m`
    ),
  });
  const card = input.predecessor
    ? fsrsCard(input.predecessor)
    : scheduler.newCard({ now: input.practiced, cardId: "goal-preview" });
  if (card.lastReviewAt && card.lastReviewAt > input.practiced)
    throw new Error("Practice time precedes the latest submitted event");
  const next = scheduler.review({
    card,
    now: input.practiced,
    grade: input.rating,
  }).card;
  // Preserve TuneTrees' existing lapse policy: Again increments only in Review.
  const lapses = card.lapses + (input.rating === 1 && card.state === 2 ? 1 : 0);
  const state = parseFsrs6State({
    version: 1,
    stability: next.stability,
    difficulty: next.difficulty,
    scheduledDays: next.scheduledDays,
    learningSteps: next.learningStep,
    reps: next.reps,
    lapses,
    status: next.state,
  });
  const utcDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const elapsedDays =
    card.state === 0 || !card.lastReviewAt
      ? 0
      : Math.floor(
          (utcDay(input.practiced) - utcDay(card.lastReviewAt)) / 86400000
        );
  return { due: next.dueAt, state, elapsedDays };
}
