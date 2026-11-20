import { and, eq, sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import { tableTransientData } from "../db/schema";
import { practiceContextKey, prepareGoalPracticePreview } from "./preview";
import { readGoalPracticeContext, readGoalRepertoireSnapshot } from "./resolve";

type StageInput = Parameters<typeof prepareGoalPracticePreview>[1];

export function practiceDraftWhere(
  input: Pick<StageInput, "userId" | "repertoireId" | "tuneId">
) {
  return and(
    eq(tableTransientData.userId, input.userId),
    eq(tableTransientData.repertoireId, input.repertoireId),
    eq(tableTransientData.tuneId, input.tuneId)
  );
}

/**
 * Goal-aware staging boundary used by the active practice evaluation UI.
 * isCurrent must cover the caller's auth/database lifetime and evaluation request.
 * All async calculations finish before the synchronous recheck/write transaction.
 */
export async function stageGoalPracticeEvaluation(
  db: SqliteDatabase,
  requested: StageInput,
  isCurrent: () => boolean
) {
  // Capture mutable caller inputs before any await (including the Date object).
  const input = { ...requested, practiced: new Date(requested.practiced) };
  if (!isCurrent()) return { status: "superseded" as const };
  const where = practiceDraftWhere(input);
  const initialDraft = db.select().from(tableTransientData).where(where).get();
  const initialDraftKey = JSON.stringify(initialDraft ?? null);
  const preview = await prepareGoalPracticePreview(db, input);

  const result = db.transaction((tx) => {
    if (!isCurrent()) return { status: "superseded" as const };
    const current = readGoalPracticeContext(
      db,
      input.userId,
      input.repertoireId,
      input.tuneId
    );
    if (practiceContextKey(current, input.evaluationId) !== preview.contextKey)
      return { status: "stale" as const };
    const draft = tx.select().from(tableTransientData).where(where).get();
    // A cancellation, note edit, or newer staged evaluation wins over this request.
    if (JSON.stringify(draft ?? null) !== initialDraftKey)
      return { status: "superseded" as const };
    const values = {
      goal: preview.goalKey,
      goalId: preview.goalId,
      evaluationId: preview.evaluationId,
      evaluationSnapshot: preview.evaluationSnapshot,
      schedulerId: preview.schedulerId,
      schedulerVersion: preview.schedulerVersion,
      schedulerState: preview.schedulerState,
      intervalDays: preview.intervalDays,
      practiced: preview.practiced,
      due: preview.due,
      predecessorRecordId: preview.predecessorRecordId,
      predecessorFingerprint: preview.predecessorFingerprint,
      calculationConfigHash: preview.calculationConfigHash,
      practiceRecordId: draft?.practiceRecordId ?? crypto.randomUUID(),
      // Clear incompatible typed projections rather than leaving an earlier FSRS preview.
      quality: preview.compatibility.quality,
      easiness: preview.compatibility.easiness,
      difficulty: preview.compatibility.difficulty,
      stability: preview.compatibility.stability,
      interval: preview.compatibility.interval,
      step: preview.compatibility.step,
      repetitions: preview.compatibility.repetitions,
      state: preview.compatibility.state,
      technique: preview.compatibility.technique,
      recallEval: preview.evaluationId,
      backupPracticed: null,
      lastModifiedAt: new Date().toISOString(),
    };
    const stored = tx
      .insert(tableTransientData)
      .values({
        userId: input.userId,
        tuneId: input.tuneId,
        repertoireId: input.repertoireId,
        ...values,
      })
      .onConflictDoUpdate({
        target: [
          tableTransientData.tuneId,
          tableTransientData.userId,
          tableTransientData.repertoireId,
        ],
        set: {
          ...values,
          syncVersion: sql.raw(`${tableTransientData.syncVersion.name} + 1`),
        },
      })
      .returning()
      .get();
    return { status: "staged" as const, draft: stored, preview };
  });
  if (result.status === "staged") await persistDb();
  return result;
}

/** Clear only the performance draft. Notes/purpose survive, and the completed
 * queue/event remain untouched so canceling Practice again restores their display.
 * The caller must invalidate its earlier staging request before calling clear,
 * including when no draft exists yet. isCurrent belongs to this clear request;
 * it must not reuse the invalidated staging request's token. */
export async function clearGoalPracticeEvaluation(
  db: SqliteDatabase,
  input: Pick<StageInput, "userId" | "repertoireId" | "tuneId">,
  isCurrent: () => boolean
) {
  if (!isCurrent()) return { status: "superseded" as const };
  const { members } = readGoalRepertoireSnapshot(
    db,
    input.userId,
    input.repertoireId
  );
  if (!members.some(({ assignment }) => assignment.tuneRef === input.tuneId))
    throw new Error("Tune is not active in this repertoire");
  const where = practiceDraftWhere(input);
  const draft = db.select().from(tableTransientData).where(where).get();
  if (draft) {
    if (
      draft.notePrivate === null &&
      draft.notePublic === null &&
      draft.purpose === null
    ) {
      db.delete(tableTransientData).where(where).run();
    } else {
      db.update(tableTransientData)
        .set({
          recallEval: null,
          practiced: null,
          quality: null,
          easiness: null,
          difficulty: null,
          interval: null,
          step: null,
          repetitions: null,
          due: null,
          backupPracticed: null,
          goal: null,
          technique: null,
          stability: null,
          state: null,
          goalId: null,
          evaluationId: null,
          evaluationSnapshot: null,
          schedulerId: null,
          schedulerVersion: null,
          schedulerState: null,
          intervalDays: null,
          predecessorRecordId: null,
          predecessorFingerprint: null,
          calculationConfigHash: null,
          practiceRecordId: null,
          lastModifiedAt: new Date().toISOString(),
          syncVersion: sql.raw(`${tableTransientData.syncVersion.name} + 1`),
        })
        .where(where)
        .run();
    }
  }
  // Also persist an empty retry after a previous in-memory clear failed to save.
  await persistDb();
  return { status: "cleared" as const };
}
