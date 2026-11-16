import {
  canonicalJson,
  type GoalConfig,
  parseGoalConfig,
  SCHEDULER_STATE_BYTES,
  validateIntervals,
} from "./config";

export interface LadderState {
  version: 1;
  ladderIndex: number;
  ladderHash: string;
}
export interface LadderPredecessor {
  goalId: string;
  schedulerId: string;
  schedulerVersion: number;
  schedulerState: unknown;
}

async function hashIntervals(intervals: number[]): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(intervals))
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function readState(value: unknown): LadderState | null {
  // Absent legacy state is fresh; malformed new state must be corrected.
  if (value === null) return null;
  canonicalJson(value, SCHEDULER_STATE_BYTES);
  if (typeof value !== "object" || !value || Array.isArray(value))
    throw new Error("Invalid ladder state");
  if (!("version" in value) || value.version !== 1) return null;
  if (
    !("ladderIndex" in value) ||
    typeof value.ladderIndex !== "number" ||
    !Number.isSafeInteger(value.ladderIndex) ||
    value.ladderIndex < 0 ||
    !("ladderHash" in value) ||
    typeof value.ladderHash !== "string"
  )
    throw new Error("Invalid ladder state");
  return {
    version: 1,
    ladderIndex: value.ladderIndex,
    ladderHash: value.ladderHash,
  };
}

/** Pure calculation: caller supplies only the latest submitted predecessor. */
export async function calculateLadder(input: {
  goalId: string;
  config: GoalConfig;
  evaluationId: string;
  practiced: Date;
  predecessor: LadderPredecessor | null;
}) {
  const config = parseGoalConfig(input.config);
  if (config.scheduler.id !== "builtin:interval-ladder")
    throw new Error("Goal does not use a ladder");
  const choice = config.evaluations.find(
    (entry) => entry.id === input.evaluationId
  );
  if (!choice || choice.action.kind === "fsrs")
    throw new Error("Choose a valid ladder evaluation");
  const practicedMs = input.practiced.getTime();
  if (!Number.isFinite(practicedMs)) throw new Error("Invalid practiced time");
  // Existing event uniqueness is second-based. Quantize before computing due.
  const practiced = new Date(Math.floor(practicedMs / 1000) * 1000);
  const intervals = config.scheduler.intervalsDays;
  validateIntervals(intervals, practiced.getTime());
  const ladderHash = await hashIntervals(intervals);
  const previous = input.predecessor;
  let prior: LadderState | null = null;
  if (
    previous?.goalId === input.goalId &&
    previous.schedulerId === config.scheduler.id &&
    previous.schedulerVersion === config.scheduler.version
  ) {
    prior = readState(previous.schedulerState);
  }
  const compatible = prior?.ladderHash === ladderHash ? prior : null;
  const continued = compatible !== null;
  if (compatible && compatible.ladderIndex >= intervals.length)
    throw new Error("Ladder position is out of range");
  const current = compatible?.ladderIndex ?? 0;
  const actions = {
    reset: 0,
    back: Math.max(0, current - 1),
    stay: current,
    advance: Math.min(intervals.length - 1, current + 1),
  };
  const ladderIndex = actions[choice.action.kind];
  const due = new Date(
    practiced.getTime() + Math.round(intervals[ladderIndex] * 86400) * 1000
  );
  if (!Number.isFinite(due.getTime()) || due.getTime() <= practiced.getTime())
    throw new Error("Interval cannot be represented at second precision");
  const intervalDays = (due.getTime() - practiced.getTime()) / 86400000;
  let boundary: "shortest" | "longest" | null = null;
  if (choice.action.kind === "back" && current === 0) {
    boundary = "shortest";
  } else if (
    choice.action.kind === "advance" &&
    current === intervals.length - 1
  ) {
    boundary = "longest";
  }
  return {
    practiced,
    due,
    intervalDays,
    legacyInterval: Math.max(1, Math.ceil(intervalDays)),
    state: { version: 1, ladderIndex, ladderHash } satisfies LadderState,
    continued,
    evaluation: choice,
    boundary,
  };
}
