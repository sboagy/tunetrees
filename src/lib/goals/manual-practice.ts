import { and, eq } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import { readSelectedSchedulingPlugin } from "../db/queries/plugins";
import { readPracticeRecordsForTune } from "../db/queries/practice-records";
import { practiceRecord, repertoireTune } from "../db/schema";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { generateId } from "../utils/uuid";
import { calculateGoalPractice } from "./calculate";
import { canonicalJson, type GoalConfig } from "./config";
import { practiceEventContent } from "./practice-event-content";
import { resolveGoalReference } from "./references";
import { readGoalRepertoireSnapshot } from "./resolve";

/** Manual history insertion shares goal resolution/calculation with practice but
 * never completes queue rows, consumes drafts, or replays subsequent history. */
export interface ManualPracticeInput {
  userId: string;
  repertoireId: string;
  tuneId: string;
  goalId: string;
  evaluationId: string;
  practiced: Date;
  expectedConfiguration?: string;
}

export function manualGoalConfigurationKey(definition: {
  displayName: string;
  config: GoalConfig;
}) {
  return canonicalJson(
    { displayName: definition.displayName, config: definition.config },
    2 * 1024 * 1024
  );
}

function readContext(db: SqliteDatabase, input: ManualPracticeInput) {
  const snapshot = readGoalRepertoireSnapshot(
    db,
    input.userId,
    input.repertoireId
  );
  const member = snapshot.members.find(
    ({ assignment }) => assignment.tuneRef === input.tuneId
  );
  if (!member) throw new Error("Tune is not active in this repertoire");
  const selected = snapshot.goals.find(
    (goal) => goal.id === input.goalId && !goal.deleted
  );
  if (!selected) throw new Error("Choose an available goal");
  const definition = snapshot.resolveAssignment({
    goalId: selected.id,
    goal: selected.name,
  });
  if (
    input.expectedConfiguration &&
    input.expectedConfiguration !== manualGoalConfigurationKey(definition)
  )
    throw new Error(
      "Goal settings changed. Cancel and reopen the form before saving."
    );
  const practiced = normalizePracticeTimestamp(input.practiced.toISOString());
  const history = readPracticeRecordsForTune(
    db,
    input.tuneId,
    input.repertoireId
  );
  // Canonical ordering puts undated legacy events last. They cannot establish
  // a dated predecessor; malformed non-null timestamps still block scheduling.
  const dated = history.flatMap((record) =>
    record.practiced === null
      ? []
      : [
          {
            record,
            time: normalizePracticeTimestamp(record.practiced),
          },
        ]
  );
  if (dated.some(({ time }) => time === practiced))
    throw new Error("Another practice entry already uses this date and time");
  const predecessor =
    dated.find(({ time }) => time < practiced)?.record ?? null;
  const plugin =
    definition.config.scheduler.id === "plugin"
      ? readSelectedSchedulingPlugin(
          db,
          input.userId,
          definition.config.scheduler.pluginId
        )
      : null;
  return {
    ...definition,
    plugin,
    goalTuneCount: snapshot.members.filter(
      ({ assignment }) =>
        (resolveGoalReference(snapshot.goals, input.userId, assignment)?.id ??
          snapshot.recallId) === selected.id
    ).length,
    predecessor,
    legacyGoalId:
      predecessor?.schedulerId === null
        ? (resolveGoalReference(snapshot.goals, input.userId, predecessor, true)
            ?.id ?? null)
        : null,
    hasLater: dated.some(({ time }) => time > practiced),
    assignment: member.assignment,
  };
}

export async function prepareManualPractice(
  db: SqliteDatabase,
  input: ManualPracticeInput
) {
  const time = input.practiced.getTime();
  if (!Number.isFinite(time))
    throw new Error("Enter a valid practice date and time");
  if (time > Date.now())
    throw new Error("Practice date cannot be in the future");
  const captured = {
    ...input,
    practiced: new Date(Math.floor(time / 1000) * 1000),
  };
  const context = readContext(db, captured);
  const result = await calculateGoalPractice({
    goalId: context.goalId,
    goalLabel: context.displayName,
    config: context.config,
    evaluationId: captured.evaluationId,
    practiced: captured.practiced,
    goalTuneCount: context.goalTuneCount,
    predecessor: context.predecessor,
    legacyGoalId: context.legacyGoalId,
    plugin: context.plugin,
  });
  return {
    input: captured,
    committed: false,
    contextKey: canonicalJson(context, 2 * 1024 * 1024),
    record: {
      id: generateId(),
      repertoireRef: captured.repertoireId,
      tuneRef: captured.tuneId,
      goal: context.goalKey,
      goalId: result.goalId,
      evaluationId: result.evaluationId,
      evaluationSnapshot: result.evaluationSnapshot,
      schedulerId: result.schedulerId,
      schedulerVersion: result.schedulerVersion,
      schedulerState: result.schedulerState,
      practiced: result.practiced,
      due: result.due,
      intervalDays: result.intervalDays,
      ...result.compatibility,
      lastModifiedAt: new Date().toISOString(),
    },
  };
}

export class ManualPracticeRemovedError extends Error {
  constructor() {
    super(
      "This practice entry was removed after its local save. It has not been added again."
    );
  }
}

export class ManualPracticePersistenceError extends Error {
  constructor(cause: unknown) {
    super(
      "Entry recorded in memory, but saving to this device failed. Retry Save without adding another entry.",
      { cause }
    );
  }
}

export type ManualPracticeReceipt = Awaited<
  ReturnType<typeof prepareManualPractice>
>;

/** Retain the receipt if persistence fails. Retrying flushes the identical event;
 * it does not calculate again or reapply its schedule over subsequent practice. */
export async function saveManualPractice(
  db: SqliteDatabase,
  receipt: ManualPracticeReceipt,
  isCurrent: () => boolean
) {
  const captured = structuredClone(receipt);
  if (!isCurrent())
    throw new Error("Practice history context changed; reopen the form");
  db.transaction(() => {
    const { input, record } = captured;
    readGoalRepertoireSnapshot(db, input.userId, input.repertoireId);
    const existing = db
      .select()
      .from(practiceRecord)
      .where(eq(practiceRecord.id, record.id))
      .get();
    if (existing) {
      if (
        existing.repertoireRef !== input.repertoireId ||
        existing.tuneRef !== input.tuneId ||
        practiceEventContent(existing) !== practiceEventContent(record)
      )
        throw new Error(
          "Practice event identity conflicts with different content"
        );
      return;
    }
    if (captured.committed) throw new ManualPracticeRemovedError();
    const context = readContext(db, input);
    if (canonicalJson(context, 2 * 1024 * 1024) !== captured.contextKey)
      throw new Error(
        "History or goal settings changed. Cancel and reopen the form before saving."
      );
    db.insert(practiceRecord).values(record).run();
    if (!context.hasLater) {
      db.update(repertoireTune)
        .set({ current: record.due, lastModifiedAt: record.lastModifiedAt })
        .where(
          and(
            eq(repertoireTune.repertoireRef, input.repertoireId),
            eq(repertoireTune.tuneRef, input.tuneId)
          )
        )
        .run();
    }
  });
  // A completed SQLite transaction must never become a first insert on retry.
  receipt.committed = true;
  try {
    await persistDb();
  } catch (cause) {
    throw new ManualPracticePersistenceError(cause);
  }
}
