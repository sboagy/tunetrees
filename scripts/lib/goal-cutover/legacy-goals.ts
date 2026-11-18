import {
  getBuiltInGoals,
  getCustomGoalConfig,
} from "../../../src/lib/goals/builtins";
import {
  canonicalJson,
  type GoalConfig,
  resolveGoalDefinition,
} from "../../../src/lib/goals/config";

export interface LegacyGoalDefinition {
  id: string;
  name: string;
  privateFor: string | null;
  deleted: boolean;
  defaultTechnique: string;
  baseIntervals: string | null;
  defaultConfig: string | null;
  displayName: string | null;
  description: string | null;
}

export const customGoalKey = (id: string): string => `custom:${id}`;

/** Refuse occupied target keys, even if the occupying row is deleted. */
export function validateCustomGoalKeys(goals: readonly LegacyGoalDefinition[]) {
  for (const goal of goals) {
    if (goal.privateFor === null) continue;
    if (
      goals.some(
        (other) => other.id !== goal.id && other.name === customGoalKey(goal.id)
      )
    ) {
      throw new Error(
        "Custom goal target key is occupied; resolve its identity first"
      );
    }
  }
}

/**
 * Prepare custom stable keys and missing configuration; preserve historical text.
 * The eventual cutover writer must recheck its snapshot and preserve timestamps.
 * Unknown/plugin techniques and system-name collisions require explicit handling.
 */
export function prepareLegacyGoalDefinition(
  row: LegacyGoalDefinition,
  createChoiceId?: () => string
) {
  const builtins = getBuiltInGoals();
  if (
    row.privateFor !== null &&
    builtins.some((builtin) => builtin.name === row.name)
  ) {
    throw new Error(
      "Custom goal uses a system name; resolve its identity first"
    );
  }
  if (row.defaultConfig !== null) {
    resolveGoalDefinition({
      displayName: row.displayName ?? row.name,
      description: row.description ?? "",
      config: JSON.parse(row.defaultConfig),
    });
    if (row.privateFor === null || row.name === customGoalKey(row.id))
      return null;
    return {
      name: customGoalKey(row.id),
      displayName: row.displayName ?? row.name,
      description: row.description,
      defaultConfig: row.defaultConfig,
    };
  }
  if (row.privateFor === null) {
    if (builtins.some((builtin) => builtin.id === row.id)) return null;
    throw new Error("Unknown shared goal needs an explicit definition");
  }
  const recall = builtins.find((builtin) => builtin.name === "recall");
  if (!recall) throw new Error("Recall defaults are unavailable");
  let config: GoalConfig;
  if (row.defaultTechnique === "fsrs") {
    config = getCustomGoalConfig(recall.config.scheduler, createChoiceId);
  } else if (row.defaultTechnique === "base_interval") {
    if (row.baseIntervals === null) {
      throw new Error("Legacy ladder has no intervals");
    }
    config = getCustomGoalConfig(
      {
        id: "builtin:interval-ladder",
        version: 1,
        intervalsDays: JSON.parse(row.baseIntervals),
      },
      createChoiceId
    );
  } else {
    throw new Error("Legacy scheduler needs an explicit conversion contract");
  }
  const definition = resolveGoalDefinition({
    displayName: row.displayName ?? row.name,
    description: row.description ?? "",
    config,
  });
  return {
    name: customGoalKey(row.id),
    displayName: definition.displayName,
    description: definition.description,
    defaultConfig: canonicalJson(definition.config),
  };
}
