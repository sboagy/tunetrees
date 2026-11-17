import type { SqliteDatabase } from "../db/client-sqlite";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { calculateGoalPractice } from "./calculate";
import { hashCanonicalJson } from "./config";
import { readGoalPracticeContext } from "./resolve";

type Context = ReturnType<typeof readGoalPracticeContext>;
/** Scheduling inputs only: sync bookkeeping and compatibility projections cannot stale new JSON. */
export async function practiceContextFingerprints(
  context: Context,
  evaluationId: string
) {
  const previous = context.predecessor;
  let state: unknown = null;
  if (previous) {
    state =
      previous.schedulerId === null
        ? {
            stability: previous.stability,
            difficulty: previous.difficulty,
            repetitions: previous.repetitions,
            lapses: previous.lapses,
            state: previous.state,
            technique: previous.technique,
            legacyGoalId: context.legacyGoalId,
            goal: previous.goal,
          }
        : {
            schedulerId: previous.schedulerId,
            schedulerVersion: previous.schedulerVersion,
            schedulerState:
              previous.schedulerState === null
                ? null
                : JSON.parse(previous.schedulerState),
          };
  }
  const predecessorFingerprint = previous
    ? await hashCanonicalJson({
        id: previous.id,
        goalId: previous.goalId,
        practiced:
          previous.practiced === null
            ? null
            : normalizePracticeTimestamp(previous.practiced),
        due:
          previous.due === null
            ? null
            : normalizePracticeTimestamp(previous.due),
        state,
      })
    : null;
  const calculationConfigHash = await hashCanonicalJson(
    {
      version: 1,
      evaluationId,
      userId: context.userId,
      repertoireId: context.repertoireId,
      tuneId: context.tuneId,
      goalId: context.goalId,
      goalKey: context.goalKey,
      displayName: context.displayName,
      config: context.config,
      goalTuneCount: context.goalTuneCount,
    },
    128 * 1024
  );
  return {
    predecessorRecordId: previous?.id ?? null,
    predecessorFingerprint,
    calculationConfigHash,
  };
}

/** Read/calculate only. Staging must recheck ownership after awaiting this result. */
export async function prepareGoalPracticePreview(
  db: SqliteDatabase,
  input: {
    userId: string;
    repertoireId: string;
    tuneId: string;
    evaluationId: string;
    practiced: Date;
  }
) {
  const context = readGoalPracticeContext(
    db,
    input.userId,
    input.repertoireId,
    input.tuneId
  );
  const result = await calculateGoalPractice({
    goalId: context.goalId,
    goalLabel: context.displayName,
    config: context.config,
    evaluationId: input.evaluationId,
    practiced: input.practiced,
    goalTuneCount: context.goalTuneCount,
    predecessor: context.predecessor,
    legacyGoalId: context.legacyGoalId,
  });
  return {
    ...result,
    ...(await practiceContextFingerprints(context, input.evaluationId)),
    notices: context.notices,
  };
}
