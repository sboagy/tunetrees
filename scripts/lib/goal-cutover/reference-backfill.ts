import {
  AmbiguousGoalReferenceError,
  type GoalIdentity,
  type GoalReference,
  resolveGoalReference,
} from "../../../src/lib/goals/references";

import { customGoalKey } from "./legacy-goals";

export interface GoalReferenceSource extends GoalReference {
  kind: "assignment" | "history";
  key: string;
  ownerId: string;
  schedulerId: string | null;
  /** Full original row, including timestamps, for revalidation and preservation. */
  row: Record<string, unknown>;
}

// Cutover attribution must be conservative even when an interrupted/invalid write
// populated only part of the new event shape. Zero and empty strings still count.
const newEventFields = [
  "evaluation_id",
  "evaluation_snapshot",
  "scheduler_id",
  "scheduler_version",
  "scheduler_state",
  "interval_days",
];

function hasNewEventMetadata(source: GoalReferenceSource): boolean {
  return (
    source.schedulerId !== null ||
    newEventFields.some(
      (field) => source.row[field] !== null && source.row[field] !== undefined
    )
  );
}

/** Attribute only unambiguous legacy data; never rewrite attributed history. */
export function prepareGoalReferenceBackfill(
  goals: readonly GoalIdentity[],
  sources: readonly GoalReferenceSource[]
) {
  const updates: Array<{
    expected: GoalReferenceSource;
    goalId: string;
    goalKey: string | null;
  }> = [];
  const unresolved: Array<{
    kind: GoalReferenceSource["kind"];
    key: string;
    reason: string;
  }> = [];
  for (const source of sources) {
    const historical = source.kind === "history";
    if (historical && source.goalId !== null) continue;
    if (historical && hasNewEventMetadata(source)) {
      unresolved.push({
        kind: source.kind,
        key: source.key,
        reason: "New-format event has no goal identity",
      });
      continue;
    }
    try {
      const goal = resolveGoalReference(
        goals,
        source.ownerId,
        source,
        historical
      );
      if (goal) {
        // History keeps its recorded text. Active assignments must use the new
        // key atomically with the goal rename so runtime reconciliation stays valid.
        const goalKey =
          historical || goal.privateFor === null
            ? source.goal
            : customGoalKey(goal.id);
        if (goal.id !== source.goalId || goalKey !== source.goal) {
          updates.push({
            expected: structuredClone(source),
            goalId: goal.id,
            goalKey,
          });
        }
      } else {
        unresolved.push({
          kind: source.kind,
          key: source.key,
          reason: "Legacy goal is unavailable",
        });
      }
    } catch (error) {
      if (!(error instanceof AmbiguousGoalReferenceError)) throw error;
      unresolved.push({
        kind: source.kind,
        key: source.key,
        reason: error.message,
      });
    }
  }
  return { updates, unresolved };
}
