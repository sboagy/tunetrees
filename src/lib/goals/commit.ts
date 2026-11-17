import { and, eq, sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import { readPracticeRecordsForTune } from "../db/queries/practice-records";
import {
  dailyPracticeQueue,
  practiceRecord,
  repertoireTune,
  tableTransientData,
} from "../db/schema";
import { shouldClearConsumedScheduledOverride } from "../services/practice-recording";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import { canonicalJson } from "./config";
import {
  practiceContextFingerprints,
  practiceContextKey,
  prepareGoalPracticePreview,
} from "./preview";
import { readGoalPracticeContext } from "./resolve";
import { practiceDraftWhere as draftWhere } from "./staging";

type Draft = typeof tableTransientData.$inferSelect;
type Event = typeof practiceRecord.$inferSelect;
type Queue = typeof dailyPracticeQueue.$inferSelect;
type Preview = Awaited<ReturnType<typeof prepareGoalPracticePreview>>;

export interface GoalCommitItem {
  queueRowId: string;
  /** Retain the reviewed snapshot for exact retries after the local draft is removed. */
  draft: Draft;
}

/** Compare authoritative event meaning; transport metadata and typed projections are not state. */
function eventContent(
  row: Pick<
    Event,
    | "goalId"
    | "goal"
    | "evaluationId"
    | "evaluationSnapshot"
    | "schedulerId"
    | "schedulerVersion"
    | "schedulerState"
    | "practiced"
    | "due"
    | "intervalDays"
  >
) {
  if (
    !row.goalId ||
    !row.evaluationId ||
    !row.evaluationSnapshot ||
    !row.schedulerId ||
    !row.schedulerVersion ||
    !row.schedulerState ||
    !row.practiced ||
    !row.due ||
    row.intervalDays === null
  )
    throw new Error(
      "Legacy or incomplete preview must be recalculated and reviewed"
    );
  return canonicalJson(
    {
      goalId: row.goalId,
      goal: row.goal,
      evaluationId: row.evaluationId,
      evaluationSnapshot: JSON.parse(row.evaluationSnapshot),
      schedulerId: row.schedulerId,
      schedulerVersion: row.schedulerVersion,
      schedulerState: JSON.parse(row.schedulerState),
      practiced: normalizePracticeTimestamp(row.practiced),
      due: normalizePracticeTimestamp(row.due),
      intervalDays: row.intervalDays,
    },
    128 * 1024
  );
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
    throw new Error("Practice event ID conflicts with different content");
  return existing;
}

async function prepareItem(db: SqliteDatabase, item: GoalCommitItem) {
  const draft = item.draft;
  const context = readGoalPracticeContext(
    db,
    draft.userId,
    draft.repertoireId,
    draft.tuneId
  );
  const queue = readQueue(db, item);
  const stored = db
    .select()
    .from(tableTransientData)
    .where(draftWhere(draft))
    .get();
  eventContent(draft);
  const existing = readExisting(db, draft);
  if (existing) {
    // A completed retry must not reapply an old due date or increment queue counters.
    if (queue.displayedPracticeRecordId !== existing.id || !queue.completedAt)
      throw new Error(
        "Existing practice event is not linked to this completed queue item"
      );
    return { item, queue, existing, contextKey: null, preview: null };
  }
  assertNoTimeCollision(db, draft);
  if (JSON.stringify(stored) !== JSON.stringify(draft)) return null;
  // Transient note fields have no durable note-write path in this boundary yet.
  // Never delete user text merely because its practice evaluation was submitted.
  if (draft.notePrivate !== null || draft.notePublic !== null)
    throw new Error(
      "Save or explicitly clear draft notes before submitting practice"
    );
  if (
    context.predecessor?.practiced &&
    normalizePracticeTimestamp(draft.practiced!) <
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
  if (
    fingerprints.predecessorRecordId !== draft.predecessorRecordId ||
    fingerprints.predecessorFingerprint !== draft.predecessorFingerprint ||
    fingerprints.calculationConfigHash !== draft.calculationConfigHash
  )
    return null;
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

function assertNoTimeCollision(db: SqliteDatabase, draft: Draft) {
  const practiced = normalizePracticeTimestamp(draft.practiced!);
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
    throw new Error("Another practice event already uses this practiced time");
}

function writeItem(
  db: SqliteDatabase,
  item: GoalCommitItem,
  queue: Queue,
  preview: Preview,
  now: string
) {
  const draft = item.draft;
  db.insert(practiceRecord)
    .values({
      id: draft.practiceRecordId!,
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
      const context = readGoalPracticeContext(
        db,
        userId,
        repertoireId,
        draft.tuneId
      );
      if (JSON.stringify(readQueue(db, item)) !== JSON.stringify(entry.queue))
        return { status: "stale" as const };
      const existing = readExisting(db, draft);
      if (entry.existing) {
        if (!existing) return { status: "stale" as const };
        continue;
      }
      if (
        existing ||
        practiceContextKey(context, draft.evaluationId!) !== entry.contextKey ||
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
      eventIds: items.map(({ draft }) => draft.practiceRecordId!),
    };
  });
  // Also flush identical retries: a previous local transaction may have failed to persist.
  if (result.status === "committed") await persistDb();
  return result;
}
