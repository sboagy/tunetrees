/**
 * Scheduling plugin helpers
 */

import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { getPluginsByCapability } from "@/lib/db/queries/plugins";
import type {
  IUserSchedulingOptions,
  NextReviewSchedule,
  Plugin,
  PracticeRecord,
  PrefsSpacedRepetition,
  RecordPracticeInput,
} from "@/lib/db/types";
import { runPluginFunction } from "@/lib/plugins/runtime";

export async function getSchedulingPlugin(
  db: SqliteDatabase,
  userId: string
): Promise<Plugin | null> {
  const plugins = await getPluginsByCapability(db, userId, "scheduleGoal", {
    includePublic: true,
    includeDisabled: false,
  });
  return plugins[0] ?? null;
}

export interface SchedulingPluginPayload {
  input: Omit<RecordPracticeInput, "practiced"> & { practiced: string };
  prior: PracticeRecord | null;
  preferences: PrefsSpacedRepetition | null;
  scheduling: IUserSchedulingOptions | null;
  fallback: SerializedSchedule;
}

export interface SerializedSchedule {
  nextDue: string;
  lastReview: string;
  state: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  interval: number;
}

export function serializeSchedule(
  schedule: NextReviewSchedule
): SerializedSchedule {
  return {
    nextDue: schedule.nextDue.toISOString(),
    lastReview: schedule.last_review.toISOString(),
    state: schedule.state,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsedDays: schedule.elapsed_days,
    scheduledDays: schedule.scheduled_days,
    reps: schedule.reps,
    lapses: schedule.lapses,
    interval: schedule.interval,
  };
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeScheduleOutput(
  output: unknown,
  fallback: NextReviewSchedule
): NextReviewSchedule | null {
  if (!output || typeof output !== "object") return null;
  const data = output as Record<string, unknown>;

  const nextDueRaw =
    data.nextDue ?? data.next_due ?? data.due ?? data.next_due_date;
  const lastReviewRaw =
    data.lastReview ?? data.last_review ?? data.lastReviewDate;

  return {
    nextDue: toDate(nextDueRaw, fallback.nextDue),
    last_review: toDate(lastReviewRaw, fallback.last_review),
    state: toNumber(data.state, fallback.state),
    stability: toNumber(data.stability, fallback.stability),
    difficulty: toNumber(data.difficulty, fallback.difficulty),
    elapsed_days: toNumber(
      data.elapsedDays ?? data.elapsed_days,
      fallback.elapsed_days
    ),
    scheduled_days: toNumber(
      data.scheduledDays ?? data.scheduled_days,
      fallback.scheduled_days
    ),
    reps: toNumber(data.reps ?? data.repetitions, fallback.reps),
    lapses: toNumber(data.lapses, fallback.lapses),
    interval: toNumber(data.interval, fallback.interval),
  };
}

export async function applySchedulingPlugin(params: {
  plugin: Plugin;
  input: RecordPracticeInput;
  prior: PracticeRecord | null;
  preferences: PrefsSpacedRepetition | null;
  scheduling: IUserSchedulingOptions | null;
  fallback: NextReviewSchedule;
}): Promise<NextReviewSchedule | null> {
  const payload: SchedulingPluginPayload = {
    input: {
      playlistRef: params.input.playlistRef,
      tuneRef: params.input.tuneRef,
      quality: params.input.quality,
      practiced: params.input.practiced.toISOString(),
      goal: params.input.goal,
      technique: params.input.technique,
    },
    prior: params.prior,
    preferences: params.preferences,
    scheduling: params.scheduling,
    fallback: serializeSchedule(params.fallback),
  };

  try {
    const result = await runPluginFunction({
      script: params.plugin.script,
      functionName: "scheduleGoal",
      payload,
      meta: {
        pluginId: params.plugin.id,
        pluginName: params.plugin.name,
      },
      timeoutMs: 8000,
    });

    return normalizeScheduleOutput(result, params.fallback);
  } catch (error) {
    console.warn("Scheduling plugin failed, falling back to FSRS", error);
    return null;
  }
}
