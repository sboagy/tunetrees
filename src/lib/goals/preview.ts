import type { SqliteDatabase } from "../db/client-sqlite";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { calculateGoalPractice } from "./calculate";
import { canonicalJson, hashCanonicalJson } from "./config";
import { practiceEventContent } from "./practice-event-content";
import { readGoalPracticeContext } from "./resolve";

type Context = ReturnType<typeof readGoalPracticeContext>;
/** Scheduling inputs only: sync bookkeeping and compatibility projections cannot stale new JSON. */
function practiceContextInputs(context: Context, evaluationId: string) {
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
  const predecessor = previous
    ? {
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
      }
    : null;
  const configuration = {
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
    plugin: context.plugin,
  };
  return { predecessor, configuration };
}

/** Same inputs as the durable hashes, compared synchronously inside a write transaction. */
export function practiceContextKey(context: Context, evaluationId: string) {
  const { predecessor, configuration } = practiceContextInputs(
    context,
    evaluationId
  );
  return canonicalJson({ predecessor, configuration }, 2 * 1024 * 1024);
}

export async function practiceContextFingerprints(
  context: Context,
  evaluationId: string
) {
  const { predecessor, configuration } = practiceContextInputs(
    context,
    evaluationId
  );
  return {
    predecessorRecordId: context.predecessor?.id ?? null,
    predecessorFingerprint: predecessor
      ? await hashCanonicalJson(predecessor)
      : null,
    calculationConfigHash: await hashCanonicalJson(
      configuration,
      2 * 1024 * 1024
    ),
  };
}

/** Bind a checked plugin result to its inputs without requiring deterministic
 * replay at Submit. This is an integrity checksum, not an authentication token. */
export function pluginPreviewReceiptHash(
  inputs: Awaited<ReturnType<typeof practiceContextFingerprints>>,
  result: Parameters<typeof practiceEventContent>[0]
) {
  return hashCanonicalJson(
    { version: 1, inputs, event: practiceEventContent(result) },
    256 * 1024
  );
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
    plugin: context.plugin,
  });
  const fingerprints = await practiceContextFingerprints(
    context,
    input.evaluationId
  );
  const calculationConfigHash =
    context.config.scheduler.id === "plugin"
      ? await pluginPreviewReceiptHash(fingerprints, {
          ...result,
          goal: context.goalKey,
        })
      : fingerprints.calculationConfigHash;
  return {
    ...result,
    ...fingerprints,
    calculationConfigHash,
    contextKey: practiceContextKey(context, input.evaluationId),
    goalKey: context.goalKey,
    notices: context.notices,
  };
}
