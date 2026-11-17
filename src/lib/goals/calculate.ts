/** Pure selected-scheduler preview. No DB writes, plugins, or queue mutations. */
import {
  canonicalJson,
  type GoalConfig,
  parseGoalConfig,
  SCHEDULER_STATE_BYTES,
  serializeEvaluationSnapshot,
} from "./config";
import { calculateFsrs, effectiveFsrsMaximum } from "./fsrs";
import { calculateLadder } from "./ladder";
import { type PracticeStateRecord, readPracticeState } from "./practice-state";

export interface GoalPracticeInput {
  goalId: string;
  goalLabel: string;
  config: GoalConfig;
  evaluationId: string;
  practiced: Date;
  goalTuneCount: number;
  // The caller must supply the latest event overall, never an older matching goal.
  predecessor:
    | (PracticeStateRecord & { practiced: string | null; due: string | null })
    | null;
  legacyGoalId: string | null;
}

function eventDate(text: string | null): Date {
  if (!text) throw new Error("Missing predecessor timestamp");
  // SQLite legacy timestamps without a suffix are UTC, not device-local time.
  const normalized = text
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`
  );
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid predecessor timestamp");
  return date;
}

function predecessorForGoal(input: GoalPracticeInput) {
  const row = input.predecessor;
  if (!row) return null;
  const goalId = row.goalId ?? input.legacyGoalId;
  if (goalId !== input.goalId) return null;
  const previous = readPracticeState(row, input.legacyGoalId);
  if (previous.kind === "unavailable" && row.schedulerId !== null)
    throw new Error(previous.reason);
  return previous;
}

export async function calculateGoalPractice(input: GoalPracticeInput) {
  const config = parseGoalConfig(input.config);
  if (!input.goalId.trim() || !input.goalLabel.trim())
    throw new Error("Missing goal identity or label");
  const practiced = new Date(
    Math.floor(input.practiced.getTime() / 1000) * 1000
  );
  if (!Number.isFinite(practiced.getTime()))
    throw new Error("Invalid practiced time");
  const evaluation = config.evaluations.find(
    (choice) => choice.id === input.evaluationId
  );
  if (!evaluation) throw new Error("Choose a valid goal evaluation");
  const previous = predecessorForGoal(input);
  const evaluationSnapshot = serializeEvaluationSnapshot(
    input.goalLabel,
    evaluation
  );
  const limitations: string[] = [];
  if (previous?.kind === "unavailable") limitations.push(previous.reason);
  if (previous?.kind === "fsrs6") limitations.push(...previous.limitations);
  const common = {
    goalId: input.goalId,
    evaluationId: evaluation.id,
    evaluationSnapshot,
    schedulerVersion: config.scheduler.version,
    practiced: practiced.toISOString(),
  };
  if (config.scheduler.id === "builtin:interval-ladder") {
    const result = await calculateLadder({
      goalId: input.goalId,
      config,
      evaluationId: evaluation.id,
      practiced,
      predecessor:
        previous?.kind === "ladder"
          ? {
              goalId: previous.goalId,
              schedulerId: config.scheduler.id,
              schedulerVersion: 1,
              schedulerState: previous.state,
            }
          : null,
    });
    return {
      ...common,
      schedulerId: config.scheduler.id,
      due: result.due.toISOString(),
      intervalDays: result.intervalDays,
      schedulerState: canonicalJson(result.state, SCHEDULER_STATE_BYTES),
      continued: result.continued,
      limitations: previous?.kind === "unavailable" ? [previous.reason] : [],
      compatibility: {
        interval: result.legacyInterval,
        technique: "base_interval",
        quality: null,
        stability: null,
        difficulty: null,
        repetitions: null,
        lapses: null,
        state: null,
        elapsedDays: null,
        step: null,
        easiness: null,
      },
    };
  }
  if (evaluation.action.kind !== "fsrs")
    throw new Error("FSRS evaluation requires a rating");
  const continued = previous?.kind === "fsrs6";
  const result = await calculateFsrs({
    config: config.scheduler,
    maximumInterval: effectiveFsrsMaximum(config, input.goalTuneCount),
    rating: evaluation.action.rating,
    practiced,
    predecessor:
      continued && input.predecessor
        ? {
            state: previous.state,
            practiced: eventDate(input.predecessor.practiced),
            due: eventDate(input.predecessor.due),
          }
        : null,
  });
  // Quantize once before preview/serialization; never clamp to tomorrow.
  const due = new Date(Math.floor(result.due.getTime() / 1000) * 1000);
  const intervalDays = (due.getTime() - practiced.getTime()) / 86400000;
  if (!Number.isFinite(intervalDays) || intervalDays < 0)
    throw new Error("Invalid scheduled interval");
  return {
    ...common,
    schedulerId: config.scheduler.id,
    due: due.toISOString(),
    intervalDays,
    schedulerState: canonicalJson(result.state, SCHEDULER_STATE_BYTES),
    continued,
    limitations,
    compatibility: {
      interval: intervalDays === 0 ? 0 : Math.max(1, Math.ceil(intervalDays)),
      technique: "fsrs",
      quality: evaluation.action.rating,
      stability: result.state.stability,
      difficulty: result.state.difficulty,
      repetitions: result.state.reps,
      lapses: result.state.lapses,
      state: result.state.status,
      elapsedDays: result.elapsedDays,
      step: null,
      easiness: null,
    },
  };
}
