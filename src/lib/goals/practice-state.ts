import type { PracticeRecord } from "../db/types";
import {
  type GoalPluginState,
  parseGoalPluginState,
} from "../plugins/goal-scheduler";
import { getBuiltInGoals } from "./builtins";
import {
  type Fsrs6State,
  type LadderState,
  parseFsrs6State,
  parseLadderState,
  parseStateJson,
} from "./state";

export type PracticeStateRecord = Pick<
  PracticeRecord,
  | "goalId"
  | "goal"
  | "technique"
  | "schedulerId"
  | "schedulerVersion"
  | "schedulerState"
  | "stability"
  | "difficulty"
  | "state"
  | "repetitions"
  | "lapses"
>;
export type DecodedPracticeState =
  | {
      kind: "fsrs6";
      goalId: string;
      state: Fsrs6State;
      source: "json" | "legacy";
      limitations: string[];
    }
  | { kind: "ladder"; goalId: string; state: LadderState; source: "json" }
  | { kind: "plugin"; goalId: string; state: GoalPluginState; source: "json" }
  | { kind: "unavailable"; goalId: string | null; reason: string };

const recallId = getBuiltInGoals().find((goal) => goal.name === "recall")?.id;

/**
 * Single state-reading boundary for scheduling and history. legacyGoalId must
 * come from owner-scoped goal resolution; do not infer identity from a label.
 * Malformed new state throws: typed compatibility columns are never a fallback.
 * History callers can retain the common row and display the error as unavailable.
 */
export function readPracticeState(
  row: PracticeStateRecord,
  legacyGoalId: string | null
): DecodedPracticeState {
  if (row.schedulerId !== null) {
    if (!row.goalId)
      throw new Error("New practice event is missing goal identity");
    if (row.schedulerVersion !== 1)
      return {
        kind: "unavailable",
        goalId: row.goalId,
        reason: "Unsupported scheduler contract version",
      };
    const value = parseStateJson(row.schedulerState);
    if (row.schedulerId.startsWith("plugin:")) {
      const state = parseGoalPluginState(value);
      if (row.schedulerId !== `plugin:${state.pluginId}`)
        throw new Error("Goal plugin state identity mismatch");
      return { kind: "plugin", goalId: row.goalId, state, source: "json" };
    }
    if (row.schedulerId === "builtin:fsrs6")
      return {
        kind: "fsrs6",
        goalId: row.goalId,
        state: parseFsrs6State(value),
        source: "json",
        limitations: [],
      };
    if (row.schedulerId === "builtin:interval-ladder")
      return {
        kind: "ladder",
        goalId: row.goalId,
        state: parseLadderState(value),
        source: "json",
      };
    return {
      kind: "unavailable",
      goalId: row.goalId,
      reason: "Unsupported scheduler",
    };
  }
  // Old ladders/plugins also filled FSRS-looking columns. Only the unambiguous
  // built-in Recall case may continue; unresolved/custom identities stay visible.
  const goalId = row.goalId ?? legacyGoalId;
  if (
    goalId !== recallId ||
    (row.goal && row.goal !== "recall") ||
    (row.technique && row.technique !== "fsrs")
  )
    return {
      kind: "unavailable",
      goalId,
      reason: "Legacy scheduler state cannot be inferred",
    };
  const state = parseFsrs6State({
    version: 1,
    stability: row.stability,
    difficulty: row.difficulty,
    status: row.state,
    reps: row.repetitions,
    lapses: row.lapses,
    // Matches the existing reader's recovery policy, not recovered history.
    // In particular, old `step` and `interval` are NOT these library fields.
    learningSteps: 0,
    scheduledDays: 0,
  });
  return {
    kind: "fsrs6",
    goalId,
    state,
    source: "legacy",
    limitations: [
      "Historical learning progress and scheduled-day state were not stored; initialized to zero",
    ],
  };
}
