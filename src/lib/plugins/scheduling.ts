/**
 * Scheduling plugin helpers
 */

import { sql } from "drizzle-orm";
import { toast } from "solid-sonner";
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
import { FSRSService } from "@/lib/scheduling/fsrs-service";
import type { SchedulingService } from "@/lib/scheduling/scheduler-interface";

export async function getSchedulingPlugin(
  db: SqliteDatabase,
  userId: string,
  goal?: string
): Promise<Plugin | null> {
  const plugins = await getPluginsByCapability(db, userId, "scheduleGoal", {
    includePublic: true,
    includeDisabled: false,
    goal,
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

const QUERY_LIMIT = 500;
const ALLOWED_TABLES = new Set([
  "practice_record",
  "repertoire_tune",
  "daily_practice_queue",
  "user_profile",
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
]);
const DISALLOWED_COLUMNS: string[] = []; // TODO: add column disallow-list as needed.

function extractTableNames(query: string): string[] {
  const names: string[] = [];
  const regex = /\b(from|join)\s+([a-zA-Z0-9_."]+)/gi;
  let match = regex.exec(query);
  while (match) {
    const raw = match[2] ?? "";
    const cleaned = raw
      .replace(/^["']|["']$/g, "")
      .split(".")
      .pop();
    if (cleaned) names.push(cleaned);
    match = regex.exec(query);
  }
  return names;
}

function ensureQueryAllowed(rawQuery: string): string {
  const query = rawQuery.trim();
  if (!/^select\s/i.test(query)) {
    throw new Error("Only SELECT queries are allowed");
  }
  if (/[;]|--|\/\*/.test(query)) {
    throw new Error("Query contains unsupported tokens");
  }

  const tableNames = extractTableNames(query);
  if (tableNames.length === 0) {
    throw new Error("Query must reference an allowed table");
  }
  for (const table of tableNames) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Query references disallowed table: ${table}`);
    }
  }

  if (DISALLOWED_COLUMNS.length > 0) {
    const pattern = new RegExp(`\\b(${DISALLOWED_COLUMNS.join("|")})\\b`, "i");
    if (pattern.test(query)) {
      throw new Error("Query references disallowed column");
    }
  }

  const limitMatch = query.match(/\blimit\s+(\d+)/i);
  if (limitMatch) {
    const limitValue = Number(limitMatch[1]);
    if (Number.isFinite(limitValue) && limitValue > QUERY_LIMIT) {
      throw new Error(`Query limit exceeds ${QUERY_LIMIT}`);
    }
    return query;
  }

  return `${query} LIMIT ${QUERY_LIMIT}`;
}

async function queryDbGatekeeper(
  db: SqliteDatabase,
  rawQuery: string
): Promise<unknown> {
  const query = ensureQueryAllowed(rawQuery);
  return db.all(sql.raw(query));
}

function parsePracticeInput(raw: Record<string, unknown>): RecordPracticeInput {
  const practicedRaw = raw.practiced;
  const practiced = toDate(practicedRaw, new Date());
  if (Number.isNaN(practiced.getTime())) {
    throw new Error("Invalid practiced date");
  }

  const repertoireRef = String(raw.repertoireRef ?? "");
  const tuneRef = String(raw.tuneRef ?? "");
  const quality = Number(raw.quality ?? 0);
  if (!repertoireRef || !tuneRef || !Number.isFinite(quality)) {
    throw new Error("Missing required practice input fields");
  }

  return {
    repertoireRef,
    tuneRef,
    quality,
    practiced,
    goal: typeof raw.goal === "string" ? raw.goal : undefined,
    technique: typeof raw.technique === "string" ? raw.technique : undefined,
  };
}

function normalizeFsrsPayload(payload: unknown): {
  input: RecordPracticeInput;
  prior: PracticeRecord | null;
} {
  if (!payload || typeof payload !== "object") {
    throw new Error("fsrsScheduler expects a payload object");
  }
  const data = payload as Record<string, unknown>;
  const inputRaw =
    data.input && typeof data.input === "object"
      ? (data.input as Record<string, unknown>)
      : data;
  const prior =
    data.prior && typeof data.prior === "object"
      ? (data.prior as PracticeRecord)
      : null;

  return {
    input: parsePracticeInput(inputRaw),
    prior,
  };
}

export class PluginSchedulingService implements SchedulingService {
  private readonly fallbackScheduler: FSRSService;
  private readonly params: {
    plugin: Plugin;
    db: SqliteDatabase;
    preferences: PrefsSpacedRepetition;
    scheduling: IUserSchedulingOptions;
    repertoireTuneCount?: number | null;
  };

  constructor(params: {
    plugin: Plugin;
    db: SqliteDatabase;
    preferences: PrefsSpacedRepetition;
    scheduling: IUserSchedulingOptions;
    repertoireTuneCount?: number | null;
  }) {
    this.params = params;
    this.fallbackScheduler = new FSRSService(
      params.preferences,
      params.scheduling,
      { repertoireTuneCount: params.repertoireTuneCount ?? null }
    );
  }

  async processFirstReview(
    input: RecordPracticeInput
  ): Promise<NextReviewSchedule> {
    const fallback = await this.fallbackScheduler.processFirstReview(input);
    const override = await applySchedulingPlugin({
      plugin: this.params.plugin,
      input,
      prior: null,
      preferences: this.params.preferences,
      scheduling: this.params.scheduling,
      fallback,
      db: this.params.db,
      repertoireTuneCount: this.params.repertoireTuneCount,
    });
    return override ?? fallback;
  }

  async processReview(
    input: RecordPracticeInput,
    latestRecord: PracticeRecord
  ): Promise<NextReviewSchedule> {
    const fallback = await this.fallbackScheduler.processReview(
      input,
      latestRecord
    );
    const override = await applySchedulingPlugin({
      plugin: this.params.plugin,
      input,
      prior: latestRecord,
      preferences: this.params.preferences,
      scheduling: this.params.scheduling,
      fallback,
      db: this.params.db,
      repertoireTuneCount: this.params.repertoireTuneCount,
    });
    return override ?? fallback;
  }
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
  db: SqliteDatabase;
  repertoireTuneCount?: number | null;
}): Promise<NextReviewSchedule | null> {
  if (!params.preferences || !params.scheduling) {
    return null;
  }

  const fsrsService = new FSRSService(params.preferences, params.scheduling, {
    repertoireTuneCount: params.repertoireTuneCount ?? null,
  });
  const fsrsSchedulerBridge = {
    processFirstReview: async (payload: unknown) => {
      const { input } = normalizeFsrsPayload(payload);
      const schedule = await fsrsService.processFirstReview(input);
      return serializeSchedule(schedule);
    },
    processReview: async (payload: unknown) => {
      const { input, prior } = normalizeFsrsPayload(payload);
      if (!prior) {
        throw new Error("fsrsScheduler.processReview requires prior record");
      }
      const schedule = await fsrsService.processReview(input, prior);
      return serializeSchedule(schedule);
    },
  };

  const payload: SchedulingPluginPayload = {
    input: {
      repertoireRef: params.input.repertoireRef,
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

  const methodName = params.prior ? "processReview" : "processFirstReview";

  try {
    const result = await runPluginFunction({
      script: params.plugin.script,
      functionName: "createScheduler",
      methodName,
      payload,
      meta: {
        pluginId: params.plugin.id,
        pluginName: params.plugin.name,
      },
      timeoutMs: 30000, // 30 seconds, really long for CI, may want to reduce later
      bridge: {
        queryDb: (sqlText) => queryDbGatekeeper(params.db, sqlText),
        fsrsScheduler: fsrsSchedulerBridge,
      },
    });

    return normalizeScheduleOutput(result, params.fallback);
  } catch (error) {
    console.warn("Scheduling plugin failed, falling back to FSRS", error);
    const message =
      error instanceof Error ? error.message : "Plugin execution failed";
    const pluginLabel = params.plugin.name || "Unknown plugin";
    const pluginId = params.plugin.id ? ` (${params.plugin.id})` : "";
    toast.error("Scheduling plugin failed", {
      description: `Plugin: ${pluginLabel}${pluginId}. Method: ${methodName}. ${message}`,
      duration: Infinity,
    });
    return null;
  }
}
