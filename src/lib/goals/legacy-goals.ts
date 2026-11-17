import { getBuiltInGoals, getCustomGoalConfig } from "./builtins";
import {
  canonicalJson,
  type GoalConfig,
  resolveGoalDefinition,
} from "./config";

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

/**
 * Prepare only missing custom configuration; preserve legacy keys and history.
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
    return null;
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
    displayName: definition.displayName,
    description: definition.description,
    defaultConfig: canonicalJson(definition.config),
  };
}
