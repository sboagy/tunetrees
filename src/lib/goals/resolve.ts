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

type GoalRow = typeof goal.$inferSelect;
export interface GoalReference {
  goalId: string | null;
  goal: string | null;
}

/** IDs on history are final attribution; active legacy edits can supersede a stale ID. */
export function resolveGoalReference(
  goals: readonly GoalRow[],
  userId: string,
  reference: GoalReference,
  historical = false
): GoalRow | null {
  const visible = goals.filter(
    (row) => row.privateFor === null || row.privateFor === userId
  );
  const byId = visible.find((row) => row.id === reference.goalId);
  if (historical && reference.goalId !== null) return byId ?? null;
  if (reference.goalId !== null && !byId) return null;
  const key = reference.goal?.trim() || "recall";
  if (byId && (!reference.goal?.trim() || byId.name === key))
    return byId.deleted ? null : byId;
  const candidates = visible.filter(
    (row) => row.name === key && (historical || !row.deleted)
  );
  const owned = candidates.filter((row) => row.privateFor === userId);
  const preferred = owned.length ? owned : candidates;
  if (preferred.length > 1) throw new Error("Ambiguous legacy goal identity");
  return preferred[0] ?? null;
}

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
