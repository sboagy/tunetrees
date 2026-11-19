import { and, eq, isNull, or, sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import {
  goal,
  goalUserSettings,
  repertoire,
  repertoireTune,
  tableTransientData,
} from "../db/schema";
import {
  canonicalJson,
  type GoalConfig,
  type GoalOverrides,
  resolveGoalDefinition,
} from "./config";
import { resolveGoalReference } from "./references";
import { defaultGoalDefinition } from "./resolve";

export class GoalSettingsPersistenceError extends Error {
  constructor(cause: unknown) {
    super(
      "Goal changes are in memory but could not be saved to this device. Retry saving to device.",
      { cause }
    );
  }
}

/** Retry only persistence after a successful mutation, within the same auth/DB lifetime. */
export async function persistGoalSettings(): Promise<void> {
  try {
    await persistDb();
  } catch (cause) {
    throw new GoalSettingsPersistenceError(cause);
  }
}

/** Local settings operations share practice's validation and goal identity rules.
 * Callers supply the active auth owner. Writes are synchronous until persistence;
 * stale editor snapshots are rejected rather than overwriting another device's edits.
 */
export type EditableGoalDefinition = ReturnType<typeof resolveGoalDefinition>;
export interface GoalSettingsEntry {
  row: typeof goal.$inferSelect;
  defaults: EditableGoalDefinition;
  effective: EditableGoalDefinition;
  overridden: boolean;
  revision: string;
}

export interface UnavailableGoalSettings {
  row: typeof goal.$inferSelect;
  message: string;
}

/** An invalid/legacy definition remains visible without blocking unrelated edits. */
export function readGoalSettingsCatalog(db: SqliteDatabase, userId: string) {
  const rows = db
    .select()
    .from(goal)
    .where(
      and(
        eq(goal.deleted, 0),
        or(isNull(goal.privateFor), eq(goal.privateFor, userId))
      )
    )
    .all();
  const personal = db
    .select()
    .from(goalUserSettings)
    .where(eq(goalUserSettings.userId, userId))
    .all();
  const entries: GoalSettingsEntry[] = [];
  const unavailable: UnavailableGoalSettings[] = [];
  for (const row of rows) {
    try {
      const setting = personal.find((item) => item.goalId === row.id);
      const defaults = {
        displayName: row.displayName ?? row.name,
        description: row.description ?? "",
        config: defaultGoalDefinition(row),
      };
      const overrides: unknown =
        setting && !setting.deleted ? JSON.parse(setting.overrides) : {};
      entries.push({
        row,
        defaults,
        effective: resolveGoalDefinition(defaults, overrides),
        overridden: canonicalJson(overrides) !== "{}",
        revision: JSON.stringify({ row, setting: setting ?? null }),
      });
    } catch (cause) {
      unavailable.push({
        row,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }
  entries.sort(
    (a, b) =>
      Number(a.row.privateFor !== null) - Number(b.row.privateFor !== null) ||
      a.effective.displayName.localeCompare(b.effective.displayName)
  );
  return { entries, unavailable };
}

export function readGoalSettings(
  db: SqliteDatabase,
  userId: string
): GoalSettingsEntry[] {
  return readGoalSettingsCatalog(db, userId).entries;
}

/** Only differences are saved, so unchanged fields follow future default updates. */
export function goalOverrides(
  defaults: EditableGoalDefinition,
  edited: EditableGoalDefinition
): GoalOverrides {
  const valid = resolveGoalDefinition(edited);
  const result: GoalOverrides = {};
  if (valid.displayName !== defaults.displayName)
    result.displayName = valid.displayName;
  if (valid.description !== defaults.description)
    result.description = valid.description;
  const daily: Partial<GoalConfig["daily"]> = {};
  for (const key of ["minimum", "maximum", "delinquencyDays"] as const) {
    if (valid.config.daily[key] !== defaults.config.daily[key])
      daily[key] = valid.config.daily[key];
  }
  if (valid.config.daily.autoNew !== defaults.config.daily.autoNew)
    daily.autoNew = valid.config.daily.autoNew;
  if (Object.keys(daily).length) result.daily = daily;
  if (
    canonicalJson(valid.config.scheduler) !==
    canonicalJson(defaults.config.scheduler)
  )
    result.scheduler = valid.config.scheduler;
  if (
    canonicalJson(valid.config.evaluations) !==
    canonicalJson(defaults.config.evaluations)
  )
    result.evaluations = valid.config.evaluations;
  return result;
}

function currentEntry(
  db: SqliteDatabase,
  userId: string,
  expected: GoalSettingsEntry
) {
  const current = readGoalSettings(db, userId).find(
    (entry) => entry.row.id === expected.row.id
  );
  if (current?.revision !== expected.revision)
    throw new Error("Goal settings changed. Reload the goal before saving.");
  return current;
}

export async function saveGoalSettings(
  db: SqliteDatabase,
  userId: string,
  expected: GoalSettingsEntry,
  edited: EditableGoalDefinition
) {
  db.transaction((tx) => {
    const entry = currentEntry(tx, userId, expected);
    const overrides = canonicalJson(goalOverrides(entry.defaults, edited));
    const lastModifiedAt = new Date().toISOString();
    tx.insert(goalUserSettings)
      .values({ userId, goalId: entry.row.id, overrides, lastModifiedAt })
      .onConflictDoUpdate({
        target: [goalUserSettings.userId, goalUserSettings.goalId],
        set: {
          overrides,
          deleted: 0,
          lastModifiedAt,
          syncVersion: sql.raw(`${goalUserSettings.syncVersion.name} + 1`),
        },
      })
      .run();
  });
  await persistGoalSettings();
}

/** The caller keeps this ID across persistence retries; creation never duplicates a goal. */
export async function createConfiguredGoal(
  db: SqliteDatabase,
  userId: string,
  id: string,
  definition: EditableGoalDefinition
) {
  const valid = resolveGoalDefinition(definition);
  let defaultTechnique = "base_interval";
  if (valid.config.scheduler.id === "builtin:fsrs6") defaultTechnique = "fsrs";
  if (valid.config.scheduler.id === "plugin")
    defaultTechnique = `plugin:${valid.config.scheduler.pluginId}`;
  const values = {
    id,
    name: `custom:${id}`,
    privateFor: userId,
    displayName: valid.displayName,
    description: valid.description,
    defaultConfig: canonicalJson(valid.config),
    defaultTechnique,
    baseIntervals:
      valid.config.scheduler.id === "builtin:interval-ladder"
        ? canonicalJson(valid.config.scheduler.intervalsDays)
        : null,
  };
  db.transaction((tx) => {
    const existing = tx.select().from(goal).where(eq(goal.id, id)).get();
    if (existing) {
      if (
        existing.deleted ||
        Object.entries(values).some(
          ([key, value]) => existing[key as keyof typeof existing] !== value
        )
      )
        throw new Error("Goal identity already exists with different content");
      return;
    }
    tx.insert(goal)
      .values({ ...values, lastModifiedAt: new Date().toISOString() })
      .run();
  });
  await persistGoalSettings();
}

/** Replace active assignments atomically; history and frozen queue attribution stay intact.
 * Pending work must be submitted or explicitly cleared first, never silently discarded.
 */
export async function deleteConfiguredGoal(
  db: SqliteDatabase,
  userId: string,
  expected: GoalSettingsEntry,
  replacementId: string
) {
  db.transaction((tx) => {
    const entry = currentEntry(tx, userId, expected);
    if (entry.row.privateFor !== userId)
      throw new Error("Built-in goals cannot be deleted");
    const catalog = readGoalSettingsCatalog(tx, userId);
    const entries = catalog.entries;
    const replacement = entries.find(
      (item) => item.row.id === replacementId && item.row.id !== entry.row.id
    );
    if (!replacement) throw new Error("Choose an available replacement goal");
    const identities = [...entries, ...catalog.unavailable].map(
      (item) => item.row
    );
    const assignments = tx
      .select({ assignment: repertoireTune })
      .from(repertoireTune)
      .innerJoin(
        repertoire,
        eq(repertoire.repertoireId, repertoireTune.repertoireRef)
      )
      .where(eq(repertoire.userRef, userId))
      .all()
      .filter(
        ({ assignment }) =>
          resolveGoalReference(identities, userId, assignment)?.id ===
          entry.row.id
      );
    const drafts = tx
      .select()
      .from(tableTransientData)
      .where(eq(tableTransientData.userId, userId))
      .all();
    if (
      drafts.some(
        (draft) =>
          draft.goalId === entry.row.id ||
          resolveGoalReference(identities, userId, draft, true)?.id ===
            entry.row.id
      ) ||
      assignments.some(({ assignment }) =>
        drafts.some(
          (draft) =>
            draft.tuneId === assignment.tuneRef &&
            draft.repertoireId === assignment.repertoireRef
        )
      )
    )
      throw new Error(
        "Submit or explicitly clear pending practice and notes for this goal before deleting it."
      );
    const lastModifiedAt = new Date().toISOString();
    for (const { assignment } of assignments) {
      tx.update(repertoireTune)
        .set({
          goalId: replacement.row.id,
          goal: replacement.row.name,
          lastModifiedAt,
          syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
        })
        .where(
          and(
            eq(repertoireTune.repertoireRef, assignment.repertoireRef),
            eq(repertoireTune.tuneRef, assignment.tuneRef)
          )
        )
        .run();
    }
    tx.update(goal)
      .set({
        deleted: 1,
        lastModifiedAt,
        syncVersion: sql.raw(`${goal.syncVersion.name} + 1`),
      })
      .where(eq(goal.id, entry.row.id))
      .run();
  });
  await persistGoalSettings();
}
