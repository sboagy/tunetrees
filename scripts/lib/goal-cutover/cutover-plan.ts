import { getBuiltInGoals } from "../../../src/lib/goals/builtins";
import { canonicalJson } from "../../../src/lib/goals/config";
import {
  type LegacyGoalDefinition,
  prepareLegacyGoalDefinition,
} from "./legacy-goals";
import {
  type LegacyRecallPreferences,
  prepareLegacyRecallSettings,
} from "./legacy-preferences";
import {
  type GoalReferenceSource,
  prepareGoalReferenceBackfill,
} from "./reference-backfill";

/** An inspectable data plan, not executable SQL or permission to apply a cutover. */
export function prepareGoalCutoverPlan(
  goals: readonly LegacyGoalDefinition[],
  users: readonly { id: string; preferences: LegacyRecallPreferences }[],
  references: readonly GoalReferenceSource[] = []
) {
  const recall = getBuiltInGoals().find((goal) => goal.name === "recall");
  if (!recall) throw new Error("Recall defaults are unavailable");
  if (
    !goals.some(
      (goal) =>
        goal.id === recall.id && goal.privateFor === null && !goal.deleted
    )
  ) {
    throw new Error("Shared Recall goal is missing from the server snapshot");
  }
  const goalUpdates = goals.flatMap((goal) => {
    const values = prepareLegacyGoalDefinition(goal);
    return values ? [{ id: goal.id, expected: goal, values }] : [];
  });
  const recallSettingsInserts = users.flatMap((user) => {
    const overrides = prepareLegacyRecallSettings(user.preferences);
    return overrides
      ? [
          {
            userId: user.id,
            goalId: recall.id,
            expected: user.preferences,
            overrides: canonicalJson(overrides),
          },
        ]
      : [];
  });
  // Clone so subsequent mutation of the input snapshot cannot change the plan.
  return structuredClone({
    version: 2,
    scope: "definitions-settings-and-references",
    goalUpdates,
    recallSettingsInserts,
    references: prepareGoalReferenceBackfill(goals, references),
  });
}
