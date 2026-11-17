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
import { resolveGoalReference } from "./references";

export { type GoalReference, resolveGoalReference } from "./references";

type GoalRow = typeof goal.$inferSelect;

function defaultDefinition(row: GoalRow) {
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
export function readGoalPracticeContext(
  db: SqliteDatabase,
  userId: string,
  repertoireId: string,
  tuneId: string
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
  const assignment = members.find(
    (row) => row.assignment.tuneRef === tuneId
  )?.assignment;
  if (!assignment) throw new Error("Tune is not active in this repertoire");
  const goals = db
    .select()
    .from(goal)
    .where(or(isNull(goal.privateFor), eq(goal.privateFor, userId)))
    .all();
  const assigned = resolveGoalReference(goals, userId, assignment);
  const recallId = getBuiltInGoals().find(
    (entry) => entry.name === "recall"
  )?.id;
  const effective =
    assigned ??
    goals.find(
      (row) => row.id === recallId && row.privateFor === null && !row.deleted
    );
  if (!effective)
    throw new Error(
      "Recall fallback is unavailable; synchronize goal definitions"
    );
  const settings = db
    .select()
    .from(goalUserSettings)
    .where(
      and(
        eq(goalUserSettings.userId, userId),
        eq(goalUserSettings.goalId, effective.id),
        eq(goalUserSettings.deleted, 0)
      )
    )
    .get();
  const definition = resolveGoalDefinition(
    {
      displayName: effective.displayName ?? effective.name,
      description: effective.description ?? "",
      config: defaultDefinition(effective),
    },
    settings ? JSON.parse(settings.overrides) : {}
  );
  const predecessor =
    readPracticeRecordsForTune(db, tuneId, repertoireId)[0] ?? null;
  const legacyGoalId =
    predecessor?.schedulerId === null
      ? (resolveGoalReference(goals, userId, predecessor, true)?.id ?? null)
      : null;
  const goalTuneCount = members.filter(
    ({ assignment: candidate }) =>
      (resolveGoalReference(goals, userId, candidate)?.id ?? recallId) ===
      effective.id
  ).length;
  return {
    userId,
    repertoireId,
    tuneId,
    goalId: effective.id,
    goalKey: effective.name,
    ...definition,
    predecessor,
    legacyGoalId,
    goalTuneCount,
    notices: assigned ? [] : ["Assigned goal is unavailable; using Recall"],
  };
}
