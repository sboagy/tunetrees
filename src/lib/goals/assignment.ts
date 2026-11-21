import { and, eq, sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import { repertoireTune, tableTransientData } from "../db/schema";
import { readGoalRepertoireSnapshot, resolveGoalReference } from "./resolve";
import { clearPracticeEvaluationDraft, practiceDraftWhere } from "./staging";

/** Change current assignments, not submitted history or queue membership.
 * All targets are validated before one synchronous transaction; notes survive
 * invalidation of an evaluation staged under the previous goal. */
export async function changePracticeGoals(
  db: SqliteDatabase,
  input: {
    userId: string;
    repertoireId: string;
    tuneIds: readonly string[];
    goal: string | null;
  },
  isCurrent: () => boolean
) {
  if (!isCurrent()) return { status: "superseded" as const };
  const snapshot = readGoalRepertoireSnapshot(
    db,
    input.userId,
    input.repertoireId
  );
  const requested = resolveGoalReference(snapshot.goals, input.userId, {
    goalId: null,
    goal: input.goal,
  });
  if (!requested)
    throw new Error("Selected goal is unavailable. Choose another goal.");
  const definition = snapshot.resolveAssignment({
    goalId: requested.id,
    goal: requested.name,
  });
  const targets = [...new Set(input.tuneIds)].map((tuneId) => {
    const member = snapshot.members.find(
      ({ assignment }) => assignment.tuneRef === tuneId
    );
    if (!member) throw new Error("Tune is not active in this repertoire");
    return member.assignment;
  });
  const result = db.transaction((tx) => {
    let clearedEvaluations = 0;
    for (const assignment of targets) {
      // Only identity is needed for the old goal. Invalid old scheduler options
      // must not prevent the user from switching to a valid goal.
      const previousGoalId =
        resolveGoalReference(snapshot.goals, input.userId, assignment)?.id ??
        snapshot.recallId;
      const draft = tx
        .select()
        .from(tableTransientData)
        .where(
          practiceDraftWhere({
            userId: input.userId,
            repertoireId: input.repertoireId,
            tuneId: assignment.tuneRef,
          })
        )
        .get();
      // An unavailable assignment can already resolve to Recall while its draft
      // still belongs to the unavailable goal.
      const incompatibleDraft =
        Boolean(draft?.evaluationId || draft?.recallEval) &&
        draft?.goalId !== definition.goalId;
      if (previousGoalId !== definition.goalId || incompatibleDraft) {
        if (
          clearPracticeEvaluationDraft(tx, {
            userId: input.userId,
            repertoireId: input.repertoireId,
            tuneId: assignment.tuneRef,
          })
        )
          clearedEvaluations++;
      }
      tx.update(repertoireTune)
        .set({
          goal: definition.goalKey,
          goalId: definition.goalId,
          lastModifiedAt: new Date().toISOString(),
          syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
        })
        .where(
          and(
            eq(repertoireTune.repertoireRef, input.repertoireId),
            eq(repertoireTune.tuneRef, assignment.tuneRef)
          )
        )
        .run();
    }
    return { status: "changed" as const, clearedEvaluations };
  });
  // Persistence failure leaves the local operation intact for an explicit retry.
  await persistDb();
  return result;
}
