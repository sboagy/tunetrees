import { and, eq, inArray, sql } from "drizzle-orm";
import { persistDb, type SqliteDatabase } from "../db/client-sqlite";
import {
  assertValidPracticeHistory,
  latestPracticeRecordIdsForRepertoire,
  practiceTimestampSql,
} from "../db/practice-history-sql";
import {
  dailyPracticeQueue,
  practiceRecord,
  tableTransientData,
} from "../db/schema";
import { normalizePracticeTimestamp } from "../utils/practice-history";
import {
  computeSchedulingWindows,
  type SchedulingWindows,
} from "../utils/scheduling-windows";
import { generateId } from "../utils/uuid";
import {
  allocateGoalQueue,
  type ClassifiedGoalCandidate,
  classifyGoalCandidate,
  orderGoalCandidates,
  type QueueSelectionReason,
  queueBucketForReason,
} from "./queue-allocation";
import { readGoalRepertoireSnapshot } from "./resolve";

type QueueRow = typeof dailyPracticeQueue.$inferSelect;
export interface GoalQueueRequest {
  userId: string;
  repertoireId: string;
  practiceDate: Date;
  localTzOffsetMinutes?: number | null;
  /** Injectable clock for stable metadata/tests; never used as the practice-day anchor. */
  now?: Date;
}
export type GoalQueueAction =
  | { kind: "load" }
  | { kind: "refresh" }
  | { kind: "add-more"; count: number; windowStart?: string }
  | { kind: "manual"; tuneIds: readonly string[]; windowStart?: string };

const DEFAULT_QUEUE_ACTION = Object.freeze({ kind: "load" } as const);

export interface GoalQueueResult {
  rows: QueueRow[];
  addedTuneIds: string[];
  shortfalls: { goalId: string; missing: number }[];
  notices: { tuneId: string; message: string }[];
}

/** Retain the result so retrying a failed save never repeats an add-more action. */
export class GoalQueuePersistenceError extends Error {
  readonly result: GoalQueueResult;
  constructor(result: GoalQueueResult, cause: unknown) {
    super(
      "Queue changed in memory, but saving it failed. Retry the same queue action to save without allocating again.",
      { cause }
    );
    this.result = result;
  }
}

/** Retry only while the caller still owns the same user/database session. */
export async function persistGoalQueueResult(
  result: GoalQueueResult
): Promise<GoalQueueResult> {
  try {
    await persistDb();
  } catch (cause) {
    throw new GoalQueuePersistenceError(result, cause);
  }
  return result;
}

function readRows(db: SqliteDatabase, request: GoalQueueRequest) {
  return db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, request.userId),
        eq(dailyPracticeQueue.repertoireRef, request.repertoireId)
      )
    )
    .orderBy(dailyPracticeQueue.orderIndex, dailyPracticeQueue.id)
    .all();
}

function chooseWindows(
  request: GoalQueueRequest,
  action: GoalQueueAction,
  rows: readonly QueueRow[]
) {
  const windows = computeSchedulingWindows(
    request.practiceDate,
    0,
    request.localTzOffsetMinutes ?? null
  );
  if (action.kind === "load" || action.kind === "refresh") return windows;
  if (action.windowStart === undefined) return windows;
  const preferredWindow = normalizePracticeTimestamp(action.windowStart);
  // Today's queue can legitimately be empty. An explicitly selected older queue
  // must still exist; never silently redirect an action into a different session.
  if (preferredWindow === normalizePracticeTimestamp(windows.startTs))
    return windows;
  const window = rows.find(
    (row) =>
      row.active === 1 &&
      normalizePracticeTimestamp(row.windowStartUtc) === preferredWindow
  );
  if (!window)
    throw new Error(
      "Selected practice window is unavailable; reload the queue"
    );
  return {
    ...windows,
    startTs: window.windowStartUtc,
    endTs: window.windowEndUtc,
    startOfDayUtc: new Date(normalizePracticeTimestamp(window.windowStartUtc)),
    endOfDayUtc: new Date(normalizePracticeTimestamp(window.windowEndUtc)),
  };
}

function readCandidates(
  db: SqliteDatabase,
  request: GoalQueueRequest,
  windows: SchedulingWindows
) {
  const snapshot = readGoalRepertoireSnapshot(
    db,
    request.userId,
    request.repertoireId
  );
  assertValidPracticeHistory(db, request.repertoireId);
  const latest = db
    .select()
    .from(practiceRecord)
    .where(
      inArray(
        practiceRecord.id,
        sql.join([
          sql.raw("("),
          latestPracticeRecordIdsForRepertoire(request.repertoireId),
          sql.raw(")"),
        ])
      )
    )
    .all();
  const byTune = new Map(latest.map((row) => [row.tuneRef, row]));
  const candidates = snapshot.members.map(({ assignment }) => {
    const resolved = snapshot.resolveAssignment(assignment);
    return classifyGoalCandidate(
      {
        tuneId: assignment.tuneRef,
        goalId: resolved.goalId,
        daily: resolved.config.daily,
        scheduled: assignment.scheduled,
        latestDue: byTune.get(assignment.tuneRef)?.due ?? null,
        notices: resolved.notices,
      },
      windows
    );
  });
  return { candidates, snapshot };
}

function practicedInWindow(
  db: SqliteDatabase,
  request: GoalQueueRequest,
  windows: SchedulingWindows
) {
  const normalized = sql.raw(practiceTimestampSql("pr.practiced"));
  return new Set(
    db
      .all<{ tune: string }>(sql`
    SELECT DISTINCT pr.tune_ref AS tune FROM practice_record pr
    WHERE pr.repertoire_ref = ${request.repertoireId}
      AND ${normalized} >= ${normalizePracticeTimestamp(windows.startTs)}
      AND ${normalized} < ${normalizePracticeTimestamp(windows.endTs)}
  `)
      .map((row) => row.tune)
  );
}

function freezeLegacyAllocations(
  db: SqliteDatabase,
  rows: QueueRow[],
  candidates: readonly ClassifiedGoalCandidate[],
  snapshot: ReturnType<typeof readGoalRepertoireSnapshot>,
  stamp: string
) {
  const byTune = new Map(candidates.map((row) => [row.tuneId, row]));
  for (const row of rows) {
    if (row.allocationGoalId !== null) continue;
    // Deleted/inaccessible assignments remain in frozen queues; they cannot lose
    // their accounting slot. This is transition-time attribution, not old intent.
    const allocationGoalId =
      byTune.get(row.tuneRef)?.goalId ??
      snapshot.resolveAssignment({ goalId: null, goal: null }).goalId;
    db.update(dailyPracticeQueue)
      .set({
        allocationGoalId,
        lastModifiedAt: stamp,
        syncVersion: row.syncVersion + 1,
      })
      .where(eq(dailyPracticeQueue.id, row.id))
      .run();
    row.allocationGoalId = allocationGoalId;
    row.lastModifiedAt = stamp;
    row.syncVersion += 1;
  }
}

function makeQueueRow(
  request: GoalQueueRequest,
  windows: SchedulingWindows,
  candidate: ClassifiedGoalCandidate,
  orderIndex: number,
  stamp: string,
  manual: boolean
): typeof dailyPracticeQueue.$inferInsert {
  const reason: QueueSelectionReason = manual ? "manual" : candidate.reason;
  return {
    id: generateId(),
    userRef: request.userId,
    repertoireRef: request.repertoireId,
    tuneRef: candidate.tuneId,
    mode: "per_day",
    queueDate: windows.startTs.slice(0, 10),
    windowStartUtc: windows.startTs,
    windowEndUtc: windows.endTs,
    bucket: queueBucketForReason(reason),
    orderIndex,
    snapshotCoalescedTs: candidate.due ?? windows.startTs,
    scheduledSnapshot: candidate.scheduled,
    latestDueSnapshot: candidate.latestDue,
    acceptableDelinquencyWindowSnapshot: candidate.daily.delinquencyDays,
    tzOffsetMinutesSnapshot: request.localTzOffsetMinutes ?? null,
    allocationGoalId: candidate.goalId,
    selectionReason: reason,
    generatedAt: stamp,
    lastModifiedAt: stamp,
    active: 1,
    syncVersion: 1,
    completedAt: null,
    displayedPracticeRecordId: null,
    exposuresCompleted: 0,
  };
}

function selectAdditions(
  action: GoalQueueAction,
  candidates: readonly ClassifiedGoalCandidate[],
  retained: readonly QueueRow[],
  excluded: Set<string>
) {
  const allocations = retained.map((row) => {
    if (!row.allocationGoalId)
      throw new Error("Queue allocation identity is missing");
    return { tuneId: row.tuneRef, goalId: row.allocationGoalId };
  });
  const automatic = allocateGoalQueue(candidates, allocations, excluded);
  if (action.kind === "manual") {
    const existing = new Set(retained.map((row) => row.tuneRef));
    const byTune = new Map(candidates.map((row) => [row.tuneId, row]));
    const selected = [...new Set(action.tuneIds)]
      .filter((id) => !existing.has(id))
      .map((id) => {
        const row = byTune.get(id);
        if (!row)
          throw new Error("Selected tune is not active in this repertoire");
        return row;
      });
    return { selected, shortfalls: [] };
  }
  if (action.kind === "add-more") {
    if (!Number.isSafeInteger(action.count) || action.count < 1)
      throw new Error("Add-more count must be a positive integer");
    const existing = new Set(retained.map((row) => row.tuneRef));
    // Explicit add-more is a deliberate budget exception. Use the same date and
    // goal classification; respect autoNew when choosing unspecified tunes.
    const selected = orderGoalCandidates(candidates)
      .filter(
        (row) =>
          !existing.has(row.tuneId) &&
          !excluded.has(row.tuneId) &&
          (row.reason !== "unscheduled_topup" || row.daily.autoNew)
      )
      .slice(0, action.count);
    return { selected, shortfalls: [] };
  }
  return automatic;
}

/** Complete goal-aware queue boundary. UI activation is coordinated with goal settings/Submit.
 * Snapshot reads and writes never yield; persistence happens after the atomic batch.
 * A failed disk save is retryable: load/manual retries always persist again.
 */
export async function updateGoalPracticeQueue(
  db: SqliteDatabase,
  request: GoalQueueRequest,
  action: GoalQueueAction = DEFAULT_QUEUE_ACTION
) {
  const result: GoalQueueResult = db.transaction(() => {
    const allRows = readRows(db, request);
    const windows = chooseWindows(request, action, allRows);
    const { candidates, snapshot } = readCandidates(db, request, windows);
    const start = normalizePracticeTimestamp(windows.startTs);
    const windowRows = allRows.filter(
      (row) => normalizePracticeTimestamp(row.windowStartUtc) === start
    );
    if (
      new Set(windowRows.map((row) => row.tuneRef)).size !== windowRows.length
    )
      throw new Error(
        "Duplicate queue items for the same practice window; resolve before changing the queue"
      );
    const active = windowRows.filter((row) => row.active === 1);
    const stamp = (request.now ?? new Date()).toISOString();
    freezeLegacyAllocations(db, active, candidates, snapshot, stamp);
    const drafts = new Set(
      db
        .select({ tuneId: tableTransientData.tuneId })
        .from(tableTransientData)
        .where(
          and(
            eq(tableTransientData.userId, request.userId),
            eq(tableTransientData.repertoireId, request.repertoireId)
          )
        )
        .all()
        .map((row) => row.tuneId)
    );
    const retained =
      action.kind === "refresh"
        ? active.filter(
            (row) => row.completedAt !== null || drafts.has(row.tuneRef)
          )
        : active;
    const excluded = practicedInWindow(db, request, windows);
    for (const row of windowRows)
      if (row.completedAt !== null) excluded.add(row.tuneRef);
    for (const tuneId of drafts) excluded.add(tuneId);
    const selection =
      action.kind === "load" && active.length > 0
        ? { selected: [], shortfalls: [] }
        : selectAdditions(action, candidates, retained, excluded);
    const selectedIds = new Set(selection.selected.map((row) => row.tuneId));
    const retainedIds = new Set(retained.map((row) => row.id));
    for (const row of active) {
      if (!retainedIds.has(row.id) && !selectedIds.has(row.tuneRef))
        db.update(dailyPracticeQueue)
          .set({
            active: 0,
            lastModifiedAt: stamp,
            syncVersion: row.syncVersion + 1,
          })
          .where(eq(dailyPracticeQueue.id, row.id))
          .run();
    }
    let order =
      retained.reduce((max, row) => Math.max(max, row.orderIndex), -1) + 1;
    const added: string[] = [];
    const byTune = new Map(windowRows.map((row) => [row.tuneRef, row]));
    for (const candidate of selection.selected) {
      const previous = byTune.get(candidate.tuneId);
      if (previous?.completedAt)
        throw new Error("Use Practice again to repeat a completed queue item");
      const row = makeQueueRow(
        request,
        windows,
        candidate,
        order++,
        stamp,
        action.kind === "manual" || action.kind === "add-more"
      );
      if (previous) {
        // Reuse the natural-key row instead of relying on unsynchronized deletes.
        db.update(dailyPracticeQueue)
          .set({
            ...row,
            id: previous.id,
            windowStartUtc: previous.windowStartUtc,
            syncVersion: previous.syncVersion + 1,
          })
          .where(eq(dailyPracticeQueue.id, previous.id))
          .run();
      } else db.insert(dailyPracticeQueue).values(row).run();
      added.push(candidate.tuneId);
    }
    const rows = readRows(db, request).filter(
      (row) =>
        row.active === 1 &&
        normalizePracticeTimestamp(row.windowStartUtc) === start
    );
    return {
      rows,
      addedTuneIds: added,
      shortfalls: selection.shortfalls,
      notices: candidates.flatMap((row) =>
        row.notices.map((message) => ({ tuneId: row.tuneId, message }))
      ),
    };
  });
  return persistGoalQueueResult(result);
}
