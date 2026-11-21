import type { SqliteDatabase } from "../db/client-sqlite";
import { readSelectedSchedulingPlugin } from "../db/queries/plugins";
import { describeGoalPlugin } from "../plugins/goal-scheduler";
import { canonicalJson, type GoalConfig } from "./config";

// Settings inspect the exact selected script before offering its named actions.
// Recheck after asynchronous sandbox work and again in the save transaction.
export type GoalPluginSelection = Awaited<ReturnType<typeof inspectGoalPlugin>>;

export function assertGoalPluginSelection(
  db: SqliteDatabase,
  userId: string,
  selection: GoalPluginSelection
) {
  const current = readSelectedSchedulingPlugin(db, userId, selection.plugin.id);
  if (
    canonicalJson(current, 2 * 1024 * 1024) !==
    canonicalJson(selection.plugin, 2 * 1024 * 1024)
  )
    throw new Error(
      "The scheduling plugin changed. Reload its actions and review your choices before saving."
    );
}

export async function inspectGoalPlugin(
  db: SqliteDatabase,
  userId: string,
  pluginId: string
) {
  const plugin = readSelectedSchedulingPlugin(db, userId, pluginId);
  const manifest = await describeGoalPlugin(plugin);
  const selection = { plugin, manifest };
  assertGoalPluginSelection(db, userId, selection);
  return selection;
}

export function validateGoalPluginChoices(
  config: GoalConfig,
  selection: GoalPluginSelection
) {
  if (
    config.scheduler.id !== "plugin" ||
    config.scheduler.pluginId !== selection.plugin.id
  )
    throw new Error("Review the selected scheduling plugin before saving.");
  const actions = new Set(
    selection.manifest.actions.map((action) => action.id)
  );
  for (const choice of config.evaluations) {
    if (choice.action.kind !== "plugin" || !actions.has(choice.action.actionId))
      throw new Error(
        `Choose an available scheduling effect for “${choice.label}”.`
      );
  }
}

/** Validate current declarations at Save, even when the editor has an older receipt. */
export async function prepareGoalPluginSettings(
  db: SqliteDatabase,
  userId: string,
  config: GoalConfig,
  reviewed?: GoalPluginSelection
) {
  if (config.scheduler.id !== "plugin") return null;
  if (reviewed) {
    validateGoalPluginChoices(config, reviewed);
    assertGoalPluginSelection(db, userId, reviewed);
  }
  const selection = await inspectGoalPlugin(
    db,
    userId,
    config.scheduler.pluginId
  );
  if (
    reviewed &&
    canonicalJson(reviewed.manifest) !== canonicalJson(selection.manifest)
  )
    throw new Error(
      "The scheduling actions changed. Reload them and review your choices before saving."
    );
  validateGoalPluginChoices(config, selection);
  return selection;
}
