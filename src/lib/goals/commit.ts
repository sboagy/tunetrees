import { and, eq, sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import { readPracticeRecordsForTune } from "../db/queries/practice-records";
import {
  dailyPracticeQueue,
  practiceRecord,
  repertoireTune,
  tableTransientData,
} from "../db/schema";
import { parseGoalPluginState } from "../plugins/goal-scheduler";
import { shouldClearConsumedScheduledOverride } from "../services/scheduled-override";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { nonFsrsCompatibility } from "./calculate";
import { practiceEventContent as eventContent } from "./practice-event-content";
import {
  pluginPreviewReceiptHash,
  practiceContextFingerprints,
  practiceContextKey,
  prepareGoalPracticePreview,
} from "./preview";
import { readGoalPracticeContext, readGoalRepertoireSnapshot } from "./resolve";
import { practiceDraftWhere as draftWhere } from "./staging";
import { parseStateJson } from "./state";

type Draft = typeof tableTransientData.$inferSelect;
type Queue = typeof dailyPracticeQueue.$inferSelect;
type Preview = Awaited<ReturnType<typeof prepareGoalPracticePreview>>;
type CommitPreview = Pick<
  Preview,
  | "goalKey"
  | "goalId"
  | "evaluationId"
  | "evaluationSnapshot"
  | "schedulerId"
  | "schedulerVersion"
  | "schedulerState"
  | "practiced"
  | "due"
  | "intervalDays"
  | "compatibility"
>;

export interface GoalCommitItem {
  queueRowId: string;
  /** Retain the reviewed snapshot for exact retries after the local draft is removed. */
  draft: Draft;
}

/** Recoverable conflicts retain the original draft for explicit user action. */
export class GoalPracticeRecoveryError extends Error {
  readonly kind: "conflict" | "notes";
  readonly draft: Draft;
  constructor(message: string, kind: "conflict" | "notes", draft: Draft) {
    super(message);
    this.kind = kind;
    this.draft = draft;
  }
}

/** Capture the selected queue's reviewed drafts, not drafts from other dates or
 * hidden queues. Retain this receipt for persistence retries after Submit. */
export function readGoalCommitItems(
  db: SqliteDatabase,
  input: { userId: string; repertoireId: string; windowStart: string }
): GoalCommitItem[] {
  readGoalRepertoireSnapshot(db, input.userId, input.repertoireId);
  const windowStart = normalizePracticeTimestamp(input.windowStart);
  const rows = db
    .select({ queue: dailyPracticeQueue, draft: tableTransientData })
    .from(dailyPracticeQueue)
    .innerJoin(
      tableTransientData,
      and(
        eq(tableTransientData.userId, dailyPracticeQueue.userRef),
        eq(tableTransientData.repertoireId, dailyPracticeQueue.repertoireRef),
        eq(tableTransientData.tuneId, dailyPracticeQueue.tuneRef)
      )
    )
    .where(
      and(
        eq(dailyPracticeQueue.userRef, input.userId),
        eq(dailyPracticeQueue.repertoireRef, input.repertoireId),
        eq(dailyPracticeQueue.active, 1)
      )
    )
    .all();
  return rows
    .filter(
      ({ queue, draft }) =>
        normalizePracticeTimestamp(queue.windowStartUtc) === windowStart &&
        Boolean(draft.evaluationId || draft.recallEval || draft.practiced)
    )
    .sort(
      (a, b) =>
        a.queue.orderIndex - b.queue.orderIndex ||
        a.queue.id.localeCompare(b.queue.id)
    )
    .map(({ queue, draft }) => ({ queueRowId: queue.id, draft }));
}

const requiredDraftFields = [
  "practiceRecordId",
  "goal",
  "goalId",
  "evaluationId",
  "evaluationSnapshot",
  "schedulerId",
  "schedulerVersion",
  "schedulerState",
  "practiced",
  "due",
  "intervalDays",
] as const;

type CompleteDraft = Draft & {
  [K in (typeof requiredDraftFields)[number]]: NonNullable<Draft[K]>;
};

/** Legacy drafts may lack event fields. Validate before consuming them, and
 * expose that guarantee to TypeScript rather than using non-null assertions. */
function assertCompleteDraft(draft: Draft): asserts draft is CompleteDraft {
  for (const field of requiredDraftFields) {
    if (draft[field] === null || draft[field] === undefined)
      throw new Error(
        "Legacy or incomplete preview must be recalculated and reviewed"
      );
  }
}

function readQueue(db: SqliteDatabase, item: GoalCommitItem): Queue {
  const draft = item.draft;
  const queue = db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.id, item.queueRowId),
        eq(dailyPracticeQueue.userRef, draft.userId),
        eq(dailyPracticeQueue.repertoireRef, draft.repertoireId),
        eq(dailyPracticeQueue.tuneRef, draft.tuneId),
        eq(dailyPracticeQueue.active, 1)
      )
    )
    .get();
  if (!queue) throw new Error("Practice queue item is unavailable");
  return queue;
}

function readExisting(db: SqliteDatabase, draft: Draft) {
  if (!draft.practiceRecordId)
    throw new Error("Preview has no practice event ID");
  const existing = db
    .select()
    .from(practiceRecord)
    .where(eq(practiceRecord.id, draft.practiceRecordId))
    .get();
  if (
    existing &&
    (existing.repertoireRef !== draft.repertoireId ||
      existing.tuneRef !== draft.tuneId ||
      eventContent(existing) !== eventContent(draft))
  )
    throw new GoalPracticeRecoveryError(
      "Practice event ID conflicts with different content",
      "conflict",
      draft
    );
  return existing;
}

async function prepareItem(db: SqliteDatabase, item: GoalCommitItem) {
  const draft = item.draft;
  assertCompleteDraft(draft);
  const queue = readQueue(db, item);
  const stored = db
    .select()
    .from(tableTransientData)
    .where(draftWhere(draft))
    .get();
  eventContent(draft);
  const existing = readExisting(db, draft);
  if (existing) {
    assertRetryScope(db, draft);
    // A completed retry must not reapply an old due date or increment queue counters.
    if (queue.displayedPracticeRecordId !== existing.id || !queue.completedAt)
      throw new Error(
        "Existing practice event is not linked to this completed queue item"
      );
    return { item, queue, existing, contextKey: null, preview: null };
  }
  const context = readGoalPracticeContext(
    db,
    draft.userId,
    draft.repertoireId,
    draft.tuneId
  );
  assertNoTimeCollision(db, draft);
  if (JSON.stringify(stored) !== JSON.stringify(draft)) return null;
  // Transient note fields have no durable note-write path in this boundary yet.
  // Never delete user text merely because its practice evaluation was submitted.
  if (draft.notePrivate !== null || draft.notePublic !== null)
    throw new GoalPracticeRecoveryError(
      "Save or explicitly clear draft notes before submitting practice",
      "notes",
      draft
    );
  if (
    context.predecessor?.practiced &&
    normalizePracticeTimestamp(draft.practiced) <
      normalizePracticeTimestamp(context.predecessor.practiced)
  )
    throw new Error(
      "Practice time precedes the latest submitted event; review the time before submitting"
    );

  if (!draft.calculationConfigHash || !draft.evaluationId || !draft.practiced)
    throw new Error("Legacy preview must be recalculated and reviewed");
  const fingerprints = await practiceContextFingerprints(
    context,
    draft.evaluationId
  );
  const expectedHash =
    context.config.scheduler.id === "plugin"
      ? await pluginPreviewReceiptHash(fingerprints, draft)
      : fingerprints.calculationConfigHash;
  if (
    fingerprints.predecessorRecordId !== draft.predecessorRecordId ||
    fingerprints.predecessorFingerprint !== draft.predecessorFingerprint ||
    expectedHash !== draft.calculationConfigHash
  )
    return null;
  if (context.config.scheduler.id === "plugin") {
    return {
      item,
      queue,
      existing: undefined,
      contextKey: practiceContextKey(context, draft.evaluationId),
      preview: checkedPluginPreview(draft),
    };
  }
  const preview = await prepareGoalPracticePreview(db, {
    userId: draft.userId,
    repertoireId: draft.repertoireId,
    tuneId: draft.tuneId,
    evaluationId: draft.evaluationId,
    practiced: new Date(normalizePracticeTimestamp(draft.practiced)),
  });
  if (preview.contextKey !== practiceContextKey(context, draft.evaluationId))
    return null;
  if (
    eventContent({ ...preview, goal: preview.goalKey }) !== eventContent(draft)
  )
    throw new Error(
      "Stored preview differs from its scheduling calculation; review it again"
    );
  return {
    item,
    queue,
    existing: undefined,
    contextKey: preview.contextKey,
    preview,
  };
}

/** Only used after the stored draft, current inputs and result checksum match.
 * Commit the exact checked result, regenerating non-authoritative projections. */
function checkedPluginPreview(draft: Draft): CommitPreview {
  assertCompleteDraft(draft);
  const state = parseGoalPluginState(parseStateJson(draft.schedulerState));
  if (
    draft.schedulerVersion !== 1 ||
    draft.schedulerId !== `plugin:${state.pluginId}`
  )
    throw new Error("Expected a checked plugin result");
  const practiced = normalizePracticeTimestamp(draft.practiced);
  const due = normalizePracticeTimestamp(draft.due);
  const intervalDays =
    (new Date(due).getTime() - new Date(practiced).getTime()) / 86400000;
  if (
    !Number.isFinite(intervalDays) ||
    intervalDays < 0 ||
    intervalDays !== draft.intervalDays
  )
    throw new Error("Invalid plugin result interval");
  return {
    goalKey: draft.goal,
    goalId: draft.goalId,
    evaluationId: draft.evaluationId,
    evaluationSnapshot: draft.evaluationSnapshot,
    schedulerId: draft.schedulerId,
    schedulerVersion: draft.schedulerVersion,
    schedulerState: draft.schedulerState,
    practiced: draft.practiced,
    due: draft.due,
    intervalDays,
    compatibility: nonFsrsCompatibility(intervalDays, draft.schedulerId),
  };
}

/** Persistence-only retry needs ownership, not the continued availability of
 * the scheduler that produced an already committed, exactly matching event. */
function assertRetryScope(db: SqliteDatabase, draft: Draft) {
  const { members } = readGoalRepertoireSnapshot(
    db,
    draft.userId,
    draft.repertoireId
  );
  if (!members.some(({ assignment }) => assignment.tuneRef === draft.tuneId))
    throw new Error("Tune is not active in this repertoire");
}

function assertNoTimeCollision(db: SqliteDatabase, draft: Draft) {
  assertCompleteDraft(draft);
  const practiced = normalizePracticeTimestamp(draft.practiced);
  const collision = readPracticeRecordsForTune(
    db,
    draft.tuneId,
    draft.repertoireId
  ).some(
    (row) =>
      row.id !== draft.practiceRecordId &&
      row.practiced !== null &&
      normalizePracticeTimestamp(row.practiced) === practiced
  );
  if (collision)
    throw new GoalPracticeRecoveryError(
      "Another practice event already uses this practiced time",
      "conflict",
      draft
    );
}

function writeItem(
  db: SqliteDatabase,
  item: GoalCommitItem,
  queue: Queue,
  preview: CommitPreview,
  now: string
) {
  const draft = item.draft;
  assertCompleteDraft(draft);
  db.insert(practiceRecord)
    .values({
      id: draft.practiceRecordId,
      repertoireRef: draft.repertoireId,
      tuneRef: draft.tuneId,
      goal: preview.goalKey,
      goalId: preview.goalId,
      evaluationId: preview.evaluationId,
      evaluationSnapshot: preview.evaluationSnapshot,
      schedulerId: preview.schedulerId,
      schedulerVersion: preview.schedulerVersion,
      schedulerState: preview.schedulerState,
      practiced: preview.practiced,
      due: preview.due,
      intervalDays: preview.intervalDays,
      ...preview.compatibility,
      lastModifiedAt: now,
    })
    .run();
  const whereTune = and(
    eq(repertoireTune.repertoireRef, draft.repertoireId),
    eq(repertoireTune.tuneRef, draft.tuneId)
  );
  const tune = db.select().from(repertoireTune).where(whereTune).get();
  if (!tune) throw new Error("Practice tune disappeared");
  const clearOverride = shouldClearConsumedScheduledOverride({
    queueScheduledSnapshot: queue.scheduledSnapshot,
    currentScheduled: tune.scheduled,
    queueGeneratedAt: queue.generatedAt,
    repertoireTuneLastModifiedAt: tune.lastModifiedAt,
  });
  db.update(repertoireTune)
    .set({
      current: preview.due,
      scheduled: clearOverride ? null : tune.scheduled,
      lastModifiedAt: now,
      syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
    })
    .where(whereTune)
    .run();
  db.update(dailyPracticeQueue)
    .set({
      completedAt: now,
      displayedPracticeRecordId: draft.practiceRecordId,
      exposuresCompleted: (queue.exposuresCompleted ?? 0) + 1,
      lastModifiedAt: now,
      syncVersion: sql.raw(`${dailyPracticeQueue.syncVersion.name} + 1`),
    })
    .where(eq(dailyPracticeQueue.id, queue.id))
    .run();
  db.delete(tableTransientData).where(draftWhere(draft)).run();
}

/** New-format batch Submit. No caller should activate this before cutover/UI integration. */
/** The transaction committed, but its IndexedDB save must be retried. */
export class GoalPracticePersistenceError extends Error {
  constructor(cause: unknown) {
    super(
      "Practice was recorded locally, but could not be saved. Retry Submit to save it without recording it twice.",
      { cause }
    );
    this.name = "GoalPracticePersistenceError";
  }
}

export async function commitGoalPracticeEvaluations(
  db: SqliteDatabase,
  input: {
    userId: string;
    repertoireId: string;
    items: readonly GoalCommitItem[];
  },
  isCurrent: () => boolean
) {
  // Freeze the reviewed receipts before any asynchronous calculation or digest.
  const items = structuredClone([...input.items]);
  const userId = input.userId;
  const repertoireId = input.repertoireId;
  const tunes = new Set<string>();
  for (const { draft } of items) {
    if (
      draft.userId !== userId ||
      draft.repertoireId !== repertoireId ||
      tunes.has(draft.tuneId)
    )
      throw new Error("Invalid or duplicate practice submission scope");
    tunes.add(draft.tuneId);
  }
  if (!isCurrent()) return { status: "superseded" as const };
  const prepared: NonNullable<Awaited<ReturnType<typeof prepareItem>>>[] = [];
  for (const item of items) {
    const result = await prepareItem(db, item);
    if (!result) return { status: "stale" as const };
    prepared.push(result);
  }
  const result = db.transaction(() => {
    if (!isCurrent()) return { status: "superseded" as const };
    // Recheck the whole batch before any writes; there are no awaits in this transaction.
    for (const entry of prepared) {
      const { item } = entry;
      const draft = item.draft;
      assertCompleteDraft(draft);
      if (JSON.stringify(readQueue(db, item)) !== JSON.stringify(entry.queue))
        return { status: "stale" as const };
      const existing = readExisting(db, draft);
      if (entry.existing) {
        assertRetryScope(db, draft);
        if (!existing) return { status: "stale" as const };
        continue;
      }
      const context = readGoalPracticeContext(
        db,
        userId,
        repertoireId,
        draft.tuneId
      );
      if (
        existing ||
        practiceContextKey(context, draft.evaluationId) !== entry.contextKey ||
        JSON.stringify(
          db.select().from(tableTransientData).where(draftWhere(draft)).get()
        ) !== JSON.stringify(draft)
      )
        return { status: "stale" as const };
      assertNoTimeCollision(db, draft);
    }
    const now = new Date().toISOString();
    for (const entry of prepared) {
      if (entry.preview)
        writeItem(db, entry.item, entry.queue, entry.preview, now);
    }
    return {
      status: "committed" as const,
      eventIds: items.map(({ draft }) => {
        assertCompleteDraft(draft);
        return draft.practiceRecordId;
      }),
    };
  });
  // Also flush identical retries: a previous local transaction may have failed to persist.
  if (result.status === "committed") {
    try {
      await persistDb();
    } catch (error) {
      throw new GoalPracticePersistenceError(error);
    }
  }
  return result;
}
