import type { SqliteDatabase } from "../db/client-sqlite";
import { rememberEmptyQueueDate } from "../utils/queue-date-storage";
import { canonicalJson } from "./config";
import {
  type GoalQueueAction,
  GoalQueuePersistenceError,
  type GoalQueueRequest,
  type GoalQueueResult,
  persistGoalQueueResult,
  updateGoalPracticeQueue,
} from "./queue";

interface PendingSave {
  userId: string;
  repertoireId: string;
  refreshDate?: Date;
  key: string;
  result: GoalQueueResult;
}
interface QueueCommands {
  tail: Promise<unknown>;
  inFlight: Map<
    string,
    { work: Promise<GoalQueueResult>; owners: Set<() => boolean> }
  >;
  lastKey?: string;
  pending?: PendingSave;
}
// Share receipts across queue callers in the same DB session. Navigating away
// must not turn a failed Add more save into another allocation on retry.
const sessions = new WeakMap<SqliteDatabase, QueueCommands>();

/** Serialize commands and retry durability before permitting another allocation. */
export async function runGoalQueueCommand(
  db: SqliteDatabase,
  request: GoalQueueRequest,
  action: GoalQueueAction,
  isCurrent: () => boolean
): Promise<GoalQueueResult> {
  const captured = { ...request, practiceDate: new Date(request.practiceDate) };
  const command = structuredClone(action);
  const key = canonicalJson(
    {
      userId: captured.userId,
      repertoireId: captured.repertoireId,
      practiceDate: captured.practiceDate.toISOString(),
      localTzOffsetMinutes: captured.localTzOffsetMinutes ?? null,
      action: command,
    },
    Number.MAX_SAFE_INTEGER
  );
  let session = sessions.get(db);
  if (!session) {
    session = { tail: Promise.resolve(), inFlight: new Map() };
    sessions.set(db, session);
  }
  const state = session;
  const running = state.lastKey === key ? state.inFlight.get(key) : undefined;
  if (running) {
    running.owners.add(isCurrent);
    return running.work;
  }
  const owners = new Set([isCurrent]);
  const ownsCommand = () => [...owners].some((owns) => owns());
  const work = state.tail
    .catch(() => undefined)
    .then(async () => {
      if (!ownsCommand()) throw new Error("Practice queue selection changed");
      if (state.pending) {
        const pending = state.pending;
        if (pending.userId !== captured.userId)
          throw new Error("Unsaved queue belongs to a different user session");
        if (pending.key !== key)
          throw new Error(
            "Queue changes are not saved. Retry the previous queue action before continuing."
          );
        await persistGoalQueueResult(pending.result);
        if (pending.refreshDate)
          rememberEmptyQueueDate(
            pending.userId,
            pending.repertoireId,
            pending.result.rows.length === 0 ? pending.refreshDate : null
          );
        state.pending = undefined;
        if (!ownsCommand()) throw new Error("Practice queue selection changed");
        // Repeating the failed command saves its receipt; it never adds twice.
        return pending.result;
      }
      try {
        const result = await updateGoalPracticeQueue(db, captured, command);
        if (command.kind === "refresh")
          rememberEmptyQueueDate(
            captured.userId,
            captured.repertoireId,
            result.rows.length === 0 ? captured.practiceDate : null
          );
        return result;
      } catch (error) {
        if (error instanceof GoalQueuePersistenceError) {
          state.pending = {
            userId: captured.userId,
            repertoireId: captured.repertoireId,
            refreshDate:
              command.kind === "refresh" ? captured.practiceDate : undefined,
            key,
            result: error.result,
          };
        }
        throw error;
      }
    });
  state.tail = work;
  state.lastKey = key;
  state.inFlight.set(key, { work, owners });
  try {
    return await work;
  } finally {
    if (state.inFlight.get(key)?.work === work) state.inFlight.delete(key);
  }
}

/** Recovery is independent of the current date/action; it never allocates rows. */
export async function retryGoalQueueSave(
  db: SqliteDatabase,
  userId: string,
  isCurrent: () => boolean
) {
  const state = sessions.get(db);
  if (!state) return;
  const work = state.tail
    .catch(() => undefined)
    .then(async () => {
      if (!isCurrent()) throw new Error("Practice session changed");
      if (!state.pending) return;
      if (state.pending.userId !== userId)
        throw new Error("Unsaved queue belongs to a different user session");
      const pending = state.pending;
      await persistGoalQueueResult(pending.result);
      if (pending.refreshDate)
        rememberEmptyQueueDate(
          pending.userId,
          pending.repertoireId,
          pending.result.rows.length === 0 ? pending.refreshDate : null
        );
      state.pending = undefined;
      return pending;
    });
  state.tail = work;
  return await work;
}

export function hasPendingGoalQueueSave(db: SqliteDatabase, userId: string) {
  return sessions.get(db)?.pending?.userId === userId;
}
