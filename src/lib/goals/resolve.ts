import { and, eq, isNull, or } from "drizzle-orm";
import type { SqliteDatabase } from "../db/client-sqlite";
import { readPracticeRecordsForTune } from "../db/queries/practice-records";
import {
  goal,
  goalUserSettings,
  repertoire,
  repertoireTune,
  tune,
} from "../db/schema";
import { getBuiltInGoals } from "./builtins";
import { parseGoalConfig, resolveGoalDefinition } from "./config";
import { type GoalReference, resolveGoalReference } from "./references";

/**
 * Resolves repertoire tune assignments into effective practice goals for the
 * supplied user: goal identity, validated defaults plus personal overrides,
 * and explicit Recall fallback notices when an assigned goal is unavailable.
 * Reads local SQLite synchronously, checks repertoire ownership and active tune
 * membership, and shares a goal snapshot between queue allocation and practice
 * previews. Per-tune context also includes the canonical latest practice record,
 * its legacy goal identity, and the number of tunes assigned to the effective goal.
 * This module only reads and resolves context; it does not calculate schedules,
 * allocate queue slots, or persist changes. Callers supply the active auth user ID.
 */

export { type GoalReference, resolveGoalReference } from "./references";

type GoalRow = typeof goal.$inferSelect;

export function defaultGoalDefinition(row: GoalRow) {
  if (row.defaultConfig !== null)
    return parseGoalConfig(JSON.parse(row.defaultConfig));
  const builtin = getBuiltInGoals().find(
    (entry) => entry.id === row.id && row.privateFor === null
  );
  if (!builtin)
    throw new Error(
      "Legacy custom goal needs an explicit configuration before practice"
    );
  // Transitional built-in decoding only. Custom/plugin meanings must not be guessed.
  return builtin.config;
}

/** Synchronous reads form one local snapshot; caller must supply the active auth owner. */
export function readGoalRepertoireSnapshot(
  db: SqliteDatabase,
  userId: string,
  repertoireId: string
) {
  const owner = db
    .select()
    .from(repertoire)
    .where(
      and(
        eq(repertoire.repertoireId, repertoireId),
        eq(repertoire.userRef, userId),
        eq(repertoire.deleted, 0)
      )
    )
    .get();
  if (!owner)
    throw new Error("Practice repertoire is unavailable for this user");
  const members = db
    .select({ assignment: repertoireTune })
    .from(repertoireTune)
    .innerJoin(tune, eq(tune.id, repertoireTune.tuneRef))
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.deleted, 0),
        eq(tune.deleted, 0),
        or(isNull(tune.privateFor), eq(tune.privateFor, userId))
      )
    )
    .all();
  const goals = db
    .select()
    .from(goal)
    .where(or(isNull(goal.privateFor), eq(goal.privateFor, userId)))
    .all();
  const recallId = getBuiltInGoals().find(
    (entry) => entry.name === "recall"
  )?.id;
  const settings = db
    .select()
    .from(goalUserSettings)
    .where(
      and(eq(goalUserSettings.userId, userId), eq(goalUserSettings.deleted, 0))
    )
    .all();
  const definitions = new Map<
    string,
    ReturnType<typeof resolveGoalDefinition>
  >();
  function resolveAssignment(reference: GoalReference) {
    const assigned = resolveGoalReference(goals, userId, reference);
    const effective =
      assigned ??
      goals.find(
        (row) => row.id === recallId && row.privateFor === null && !row.deleted
      );
    if (!effective)
      throw new Error(
        "Recall fallback is unavailable; synchronize goal definitions"
      );
    let definition = definitions.get(effective.id);
    if (!definition) {
      const personal = settings.find((row) => row.goalId === effective.id);
      definition = resolveGoalDefinition(
        {
          displayName: effective.displayName ?? effective.name,
          description: effective.description ?? "",
          config: defaultGoalDefinition(effective),
        },
        personal ? JSON.parse(personal.overrides) : {}
      );
      definitions.set(effective.id, definition);
    }
    return {
      goalId: effective.id,
      goalKey: effective.name,
      ...definition,
      notices: assigned ? [] : ["Assigned goal is unavailable; using Recall"],
    };
  }
  return { members, goals, recallId, resolveAssignment };
}

/** One owner-scoped snapshot, shared with queue allocation without per-tune queries. */
export function readGoalPracticeContext(
  db: SqliteDatabase,
  userId: string,
  repertoireId: string,
  tuneId: string
) {
  const { members, goals, recallId, resolveAssignment } =
    readGoalRepertoireSnapshot(db, userId, repertoireId);
  const assignment = members.find(
    (row) => row.assignment.tuneRef === tuneId
  )?.assignment;
  if (!assignment) throw new Error("Tune is not active in this repertoire");
  const definition = resolveAssignment(assignment);
  const predecessor =
    readPracticeRecordsForTune(db, tuneId, repertoireId)[0] ?? null;
  const legacyGoalId =
    predecessor?.schedulerId === null
      ? (resolveGoalReference(goals, userId, predecessor, true)?.id ?? null)
      : null;
  const goalTuneCount = members.filter(
    ({ assignment: candidate }) =>
      (resolveGoalReference(goals, userId, candidate)?.id ?? recallId) ===
      definition.goalId
  ).length;
  return {
    userId,
    repertoireId,
    tuneId,
    ...definition,
    predecessor,
    legacyGoalId,
    goalTuneCount,
  };
}
