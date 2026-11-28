/** Scheduler-owned JSON contracts. Common event timestamps stay outside state. */
import { canonicalJson, SCHEDULER_STATE_BYTES } from "./config";

export interface Fsrs6State {
  version: 1;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  status: 0 | 1 | 2 | 3;
}
export interface LadderState {
  version: 1;
  ladderIndex: number;
  ladderHash: string;
}

function stateObject(
  value: unknown,
  fields: string[]
): Record<string, unknown> {
  canonicalJson(value, SCHEDULER_STATE_BYTES);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid scheduler state object");
  const result = value as Record<string, unknown>;
  if (result.version !== 1)
    throw new Error("Unsupported scheduler state version");
  if (Object.keys(result).some((key) => !fields.includes(key)))
    throw new Error("Unknown scheduler state property");
  return result;
}
function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function count(value: unknown): value is number {
  return nonnegative(value) && Number.isSafeInteger(value);
}

export function parseFsrs6State(value: unknown): Fsrs6State {
  const row = stateObject(value, [
    "version",
    "stability",
    "difficulty",
    "scheduledDays",
    "learningSteps",
    "reps",
    "lapses",
    "status",
  ]);
  if (
    !nonnegative(row.stability) ||
    !nonnegative(row.difficulty) ||
    row.difficulty > 10 ||
    !nonnegative(row.scheduledDays) ||
    !count(row.learningSteps) ||
    !count(row.reps) ||
    !count(row.lapses) ||
    row.lapses > row.reps ||
    !count(row.status) ||
    row.status > 3
  )
    throw new Error("Invalid FSRS-6 state");
  if (row.status !== 0 && (row.stability <= 0 || row.difficulty < 1))
    throw new Error("Invalid learned FSRS-6 state");
  // All properties validated above; copy to prevent callers mutating the input.
  return { ...row } as unknown as Fsrs6State;
}

export function parseLadderState(value: unknown): LadderState {
  const row = stateObject(value, ["version", "ladderIndex", "ladderHash"]);
  if (
    !count(row.ladderIndex) ||
    typeof row.ladderHash !== "string" ||
    !row.ladderHash
  )
    throw new Error("Invalid ladder state");
  return {
    version: 1,
    ladderIndex: row.ladderIndex,
    ladderHash: row.ladderHash,
  };
}

export function parseStateJson(text: string | null): unknown {
  if (text === null) throw new Error("Missing scheduler state");
  if (new TextEncoder().encode(text).length > SCHEDULER_STATE_BYTES)
    throw new Error("Scheduler state payload is too large");
  const value: unknown = JSON.parse(text);
  canonicalJson(value, SCHEDULER_STATE_BYTES);
  return value;
}
