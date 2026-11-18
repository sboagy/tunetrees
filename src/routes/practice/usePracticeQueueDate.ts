/**
 * usePracticeQueueDate
 *
 * Composable that owns ALL queue-date state for the practice page.
 *
 * WHY THIS EXISTS (issue #427):
 *   Previously, a stale `TT_PRACTICE_QUEUE_DATE_MANUAL=true` flag in localStorage
 *   could cause the app to bypass DB resolution entirely. If the user had visited the
 *   app on device A, picked a date, and then opened the app on device B (or after a
 *   sync), the stale localStorage flag would win and the queue would be wrong.
 *
 * RESOLUTION ALGORITHM (queueReady resource fetcher):
 *   1. If manual flag is set AND stored date ≠ today:
 *      → Check DB for active rows matching the stored date.
 *      → If rows exist: honor the manual date (the user navigated here this session).
 *      → If NO rows: the flag is stale — discard it and fall through to Step 2.
 *   2. Auto-resolve from DB (DB always wins):
 *      → getLatestActiveQueueWindow → use DB date (or "today" if no active queue).
 *      → Call ensureDailyQueue for the resolved date.
 *
 * PUBLIC CONTRACT:
 *   queueDate()              – current resolved queue date
 *   isManual()               – true when user locked the date manually
 *   queueReady               – Resource<true>: undefined while loading, true when done
 *   setManualDate(date)      – async; awaits ensureDailyQueue so caller can safely
 *                              call incrementPracticeListStagedChanged() after awaiting
 *   clearManualAndSetToday() – sync state update; caller must call ensureDailyQueue
 *
 * @module routes/practice/usePracticeQueueDate
 */

import { sql } from "drizzle-orm";
import {
  type Accessor,
  createResource,
  createSignal,
  onCleanup,
  type Resource,
} from "solid-js";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import { runGoalQueueCommand } from "../../lib/goals/queue-commands";
import {
  offerGoalQueueSaveRecovery,
  reportGoalQueueNotices,
} from "../../lib/goals/queue-feedback";
import {
  getLatestActiveQueueWindow,
  getRecentActiveQueueWindows,
} from "../../lib/services/practice-queue";
import {
  formatAsWindowStart,
  getPracticeDate,
} from "../../lib/utils/practice-date";
import {
  getEmptyQueueDate,
  parseStoredDate,
  QUEUE_DATE_MANUAL_FLAG_KEY,
  QUEUE_DATE_STORAGE_KEY,
  rememberEmptyQueueDate,
} from "../../lib/utils/queue-date-storage";

// localStorage keys — single source of truth for the queue date persistence contract.
export {
  QUEUE_DATE_MANUAL_FLAG_KEY,
  QUEUE_DATE_STORAGE_KEY,
} from "../../lib/utils/queue-date-storage";

export interface PracticeQueueDateProps {
  localDb: Accessor<SqliteDatabase | null>;
  userId: Accessor<string | null>;
  currentRepertoireId: Accessor<string | null>;
  initialSyncComplete: Accessor<boolean>;
  remoteSyncDownCompletionVersion: Accessor<number>;
}

export interface PracticeQueueDateState {
  /** Current resolved queue date (DB date, user-chosen, or today). */
  queueDate: Accessor<Date>;
  /** Latest non-preview queue date available from active queue rows. */
  latestQueueDate: Accessor<Date | null>;
  /** Recent non-preview queue dates shown in the selector dialog. */
  recentQueueDates: Accessor<Date[]>;
  /** True when more recent queue history can be fetched. */
  hasMoreRecentQueueDates: Accessor<boolean>;
  /** True when the user has explicitly chosen a non-today date this session. */
  isManual: Accessor<boolean>;
  /**
   * Becomes `true` after the first successful resolution + ensureDailyQueue.
   * practiceListData should gate on this to avoid fetching before queue exists.
   */
  queueReady: Resource<true>;
  /**
   * Set a manual queue date. Async — resolves after ensureDailyQueue completes
   * so the caller can safely trigger practiceListData re-fetch afterward.
   * Picking today automatically clears the manual flag.
   */
  setManualDate: (date: Date) => Promise<void>;
  /**
   * Clear the manual flag and reset queueDate to today.
   * Sync update only — does NOT call ensureDailyQueue.
   * The caller (handlePracticeDateRefresh) is responsible for that.
   */
  clearManualAndSetToday: (date?: Date, empty?: boolean) => void;
  /** Capture selection ownership before async refresh work; false after newer navigation. */
  captureQueueSelection: () => () => boolean;
  /** Return to the most recent queue instead of staying on a manual date. */
  selectLatestQueueDate: () => Promise<void>;
  /** Refresh latest/recent queue metadata after queue mutations. */
  refreshQueueWindowState: () => Promise<void>;
  /** Fetch the next page of recent queue history for the selector dialog. */
  loadMoreRecentQueueDates: () => Promise<void>;
}

// --- Module-private helpers ---

/** Returns "YYYY-MM-DD" using the LOCAL calendar date (not UTC). */
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function queueWindowToDate(
  windowStartUtc: string | null | undefined
): Date | null {
  if (!windowStartUtc) return null;
  const datePart = windowStartUtc.substring(0, 10);
  const localNoon = new Date(`${datePart}T12:00:00`);
  return Number.isNaN(localNoon.getTime()) ? null : localNoon;
}

/** Write queue date + manual flag to localStorage. */
function persistToStorage(date: Date, manual: boolean): void {
  localStorage.setItem(QUEUE_DATE_STORAGE_KEY, date.toISOString());
  localStorage.setItem(QUEUE_DATE_MANUAL_FLAG_KEY, manual ? "true" : "false");
}

// ---

export function usePracticeQueueDate(
  props: PracticeQueueDateProps
): PracticeQueueDateState {
  let selectionVersion = 0;
  let disposed = false;
  let manualLoad = { work: Promise.resolve(), isCurrent: () => false };
  onCleanup(() => {
    disposed = true;
  });
  const captureQueueSelection = () => {
    const version = selectionVersion;
    const db = props.localDb();
    const userId = props.userId();
    const repertoireId = props.currentRepertoireId();
    return () =>
      !disposed &&
      version === selectionVersion &&
      db === props.localDb() &&
      userId === props.userId() &&
      repertoireId === props.currentRepertoireId();
  };

  const ensureDailyQueue = async (
    db: SqliteDatabase,
    uid: string,
    rid: string,
    date: Date,
    ownsSelection = captureQueueSelection()
  ) => {
    const isCurrent = () =>
      ownsSelection() &&
      db === props.localDb() &&
      uid === props.userId() &&
      rid === props.currentRepertoireId();
    try {
      const result = await runGoalQueueCommand(
        db,
        { userId: uid, repertoireId: rid, practiceDate: date },
        { kind: "load" },
        isCurrent
      );
      if (!isCurrent()) return;
      reportGoalQueueNotices(result);
    } catch (error) {
      offerGoalQueueSaveRecovery(
        db,
        uid,
        () => db === props.localDb() && uid === props.userId(),
        async () => {
          await refetchQueue();
        }
      );
      if (isCurrent()) throw error;
    }
  };

  // Bootstrap signals from localStorage so the UI shows a stable initial date
  // before the async resource resolves. The resource will overwrite if stale.
  const storedInitial = parseStoredDate(
    localStorage.getItem(QUEUE_DATE_STORAGE_KEY)
  );
  const [queueDate, setQueueDate] = createSignal<Date>(
    storedInitial ?? getPracticeDate(),
    { equals: (a, b) => a.getTime() === b.getTime() }
  );
  const [latestQueueDate, setLatestQueueDate] = createSignal<Date | null>(
    null,
    {
      equals: (a, b) => a?.getTime() === b?.getTime(),
    }
  );
  const [recentQueueDates, setRecentQueueDates] = createSignal<Date[]>([]);
  const [recentQueueLimit, setRecentQueueLimit] = createSignal(10);
  const [hasMoreRecentQueueDates, setHasMoreRecentQueueDates] =
    createSignal(false);
  const [isManual, setIsManual] = createSignal(
    localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true"
  );

  const syncQueueWindowState = async (
    db: SqliteDatabase,
    userId: string,
    repertoireId: string,
    limit = recentQueueLimit()
  ): Promise<Date | null> => {
    const ownsSelection = captureQueueSelection();
    const summaries = await getRecentActiveQueueWindows(
      db,
      userId,
      repertoireId,
      limit + 1,
      0,
      toLocalDateString(getPracticeDate())
    );
    if (
      !ownsSelection() ||
      db !== props.localDb() ||
      userId !== props.userId() ||
      repertoireId !== props.currentRepertoireId()
    )
      return null;
    const visibleSummaries = summaries.slice(0, limit);
    const visibleDates = visibleSummaries
      .map((row) => parseStoredDate(row.queueDate))
      .filter((date): date is Date => date !== null);

    const emptyDate = getEmptyQueueDate(userId, repertoireId);
    if (
      emptyDate &&
      (!visibleDates[0] ||
        toLocalDateString(emptyDate) > toLocalDateString(visibleDates[0]))
    )
      visibleDates.unshift(emptyDate);
    setRecentQueueLimit(limit);
    setHasMoreRecentQueueDates(summaries.length > limit);
    setRecentQueueDates(visibleDates);
    setLatestQueueDate(visibleDates[0] ?? null);

    return visibleDates[0] ?? null;
  };

  const refreshQueueWindowState = async (): Promise<void> => {
    const db = props.localDb();
    const uid = props.userId();
    const rid = props.currentRepertoireId();

    if (!db || !uid || !rid) {
      setRecentQueueDates([]);
      setLatestQueueDate(null);
      setHasMoreRecentQueueDates(false);
      return;
    }

    await syncQueueWindowState(db, uid, rid, recentQueueLimit());
  };

  const loadMoreRecentQueueDates = async (): Promise<void> => {
    const db = props.localDb();
    const uid = props.userId();
    const rid = props.currentRepertoireId();

    if (!db || !uid || !rid) return;

    await syncQueueWindowState(db, uid, rid, recentQueueLimit() + 10);
  };

  /**
   * Resource source: infrastructure changes ONLY.
   *
   * Deliberately does NOT include queueDate() — including it would cause a
   * circular loop: setManualDate → queueDate changes → resource runs → finds
   * no rows yet for the new date → auto-resolves back to today → overrides manual.
   *
   * Instead, setManualDate awaits ensureDailyQueue itself before returning, so
   * by the time any caller increments practiceListStagedChanged the queue exists.
   */
  const [queueReady, { refetch: refetchQueue }] = createResource(
    () => {
      const db = props.localDb();
      const uid = props.userId();
      const rid = props.currentRepertoireId();
      const syncReady = props.initialSyncComplete();
      const syncVersion = props.remoteSyncDownCompletionVersion();

      if (!syncReady) return null;

      // Wait for first remote sync before resolving, unless we already have a manual
      // stored date (matches the original hasManualStoredQueueDate fast-path).
      const isOnline = typeof navigator !== "undefined" && navigator.onLine;
      const syncDisabled = import.meta.env.VITE_DISABLE_SYNC === "true";
      const remoteSyncReady = syncVersion > 0 || !isOnline || syncDisabled;
      if (!remoteSyncReady) {
        const hasManual =
          localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true" &&
          !!localStorage.getItem(QUEUE_DATE_STORAGE_KEY);
        if (!hasManual) {
          console.log(
            "[usePracticeQueueDate] Waiting for first remote sync before resolving queue date..."
          );
          return null;
        }
      }

      return db && uid && rid
        ? { db, userId: uid, repertoireId: rid, syncVersion }
        : null;
    },
    async (params): Promise<true> => {
      const ownsSelection = captureQueueSelection();
      const isCurrent = () =>
        ownsSelection() &&
        params.db === props.localDb() &&
        params.userId === props.userId() &&
        params.repertoireId === props.currentRepertoireId();
      if (!isCurrent()) return true;
      const storedDateValue = localStorage.getItem(QUEUE_DATE_STORAGE_KEY);
      const storedManualFlag =
        localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true";
      const storedDate = parseStoredDate(storedDateValue);

      // --- Step 1: Honor manual flag only when DB has rows for it (fix for #427) ---
      if (storedManualFlag && storedDate) {
        const today = getPracticeDate();
        const storedStr = toLocalDateString(storedDate);
        const todayStr = toLocalDateString(today);

        if (storedStr !== todayStr) {
          // Validate: check if the DB actually has active rows for the stored date.
          // If no rows exist, the manual flag is stale (set on a different device /
          // in a previous session before sync) — discard it and auto-resolve.
          const windowStartIso19 = formatAsWindowStart(storedDate);
          const existingRows = params.db.all<{ one: number }>(sql`
            SELECT 1 as one
            FROM daily_practice_queue
            WHERE user_ref = ${params.userId}
              AND repertoire_ref = ${params.repertoireId}
              AND substr(replace(window_start_utc, ' ', 'T'), 1, 19) = ${windowStartIso19}
              AND active = 1
            LIMIT 1
          `);

          if (existingRows.length > 0) {
            // DB confirms rows for stored date → valid in-session navigation, honor it.
            if (queueDate().getTime() !== storedDate.getTime())
              setQueueDate(storedDate);
            if (!isManual()) setIsManual(true);
            // ensureDailyQueue is effectively a no-op here (rows already exist).
            await ensureDailyQueue(
              params.db,
              params.userId,
              params.repertoireId,
              storedDate,
              isCurrent
            );
            if (manualLoad.isCurrent()) await manualLoad.work;
            await syncQueueWindowState(
              params.db,
              params.userId,
              params.repertoireId
            );
            return true;
          }

          // No rows for stored date → stale manual flag.
          console.log(
            `[usePracticeQueueDate] Stale manual flag for ${storedStr} (no active rows) — auto-resolving`
          );
        }

        // Stored date equals today (manual lock to today is pointless), or flag is stale.
        // Clear the manual state before falling through.
        setIsManual(false);
        persistToStorage(storedDate, false);
      }

      // --- Step 2: Auto-resolve from DB (DB always wins) ---
      const latestWindow = await getLatestActiveQueueWindow(
        params.db,
        params.userId,
        params.repertoireId
      );

      if (!isCurrent()) return true;
      let resolvedDate: Date;
      if (latestWindow.windowStartUtc) {
        resolvedDate =
          queueWindowToDate(latestWindow.windowStartUtc) ?? getPracticeDate();
      } else {
        resolvedDate = getPracticeDate();
      }

      const emptyDate = getEmptyQueueDate(params.userId, params.repertoireId);
      const keepEmptyDay =
        emptyDate !== null &&
        toLocalDateString(emptyDate) <= toLocalDateString(getPracticeDate()) &&
        (!latestWindow.windowStartUtc ||
          toLocalDateString(emptyDate) >= toLocalDateString(resolvedDate));
      if (keepEmptyDay) resolvedDate = emptyDate;

      if (queueDate().getTime() !== resolvedDate.getTime())
        setQueueDate(resolvedDate);
      setIsManual(false);
      persistToStorage(resolvedDate, false);

      if (!keepEmptyDay)
        await ensureDailyQueue(
          params.db,
          params.userId,
          params.repertoireId,
          resolvedDate,
          isCurrent
        );
      if (manualLoad.isCurrent()) await manualLoad.work;
      await syncQueueWindowState(params.db, params.userId, params.repertoireId);

      console.log(
        `[usePracticeQueueDate] Resolved queue date to ${resolvedDate.toLocaleDateString()} (auto)`
      );
      return true;
    }
  );

  /**
   * Set a manual queue date (user picked a date from the calendar).
   *
   * Async: awaits ensureDailyQueue so the caller can call
   * incrementPracticeListStagedChanged() immediately after and know the queue exists.
   *
   * Picking today is treated as clearing the manual flag.
   */
  const setManualDate = async (date: Date): Promise<void> => {
    // Count intent, including selecting the same date again while a refresh waits.
    selectionVersion += 1;
    const dateAtNoon = new Date(date);
    dateAtNoon.setHours(12, 0, 0, 0);

    if (
      toLocalDateString(dateAtNoon) === toLocalDateString(getPracticeDate())
    ) {
      // Rule: picking today clears the manual flag — there's no point locking to today.
      clearManualAndSetToday();
      return;
    }

    setQueueDate(dateAtNoon);
    setIsManual(true);
    persistToStorage(dateAtNoon, true);

    const db = props.localDb();
    const uid = props.userId();
    const rid = props.currentRepertoireId();
    if (db && uid && rid) {
      manualLoad = {
        work: ensureDailyQueue(db, uid, rid, dateAtNoon),
        isCurrent: captureQueueSelection(),
      };
      if (manualLoad.isCurrent()) await manualLoad.work;
      await syncQueueWindowState(db, uid, rid);
    }
  };

  /**
   * Clear the manual flag and reset queueDate to today.
   *
   * Sync state update only. Does NOT call ensureDailyQueue — the caller
   * (handlePracticeDateRefresh) is responsible for creating today's queue.
   */
  const clearManualAndSetToday = (
    date = getPracticeDate(),
    empty = false
  ): void => {
    selectionVersion += 1;
    const today = new Date(date);
    const uid = props.userId();
    const rid = props.currentRepertoireId();
    if (uid && rid) rememberEmptyQueueDate(uid, rid, empty ? today : null);
    setQueueDate(today);
    setIsManual(false);
    persistToStorage(today, false);
  };

  const selectLatestQueueDate = async (): Promise<void> => {
    selectionVersion += 1;
    const targetDate = latestQueueDate() ?? getPracticeDate();

    setQueueDate(targetDate);
    setIsManual(false);
    persistToStorage(targetDate, false);

    const db = props.localDb();
    const uid = props.userId();
    const rid = props.currentRepertoireId();
    if (db && uid && rid) {
      manualLoad = {
        work: ensureDailyQueue(db, uid, rid, targetDate),
        isCurrent: captureQueueSelection(),
      };
      if (manualLoad.isCurrent()) await manualLoad.work;
      await syncQueueWindowState(db, uid, rid);
    }
  };

  return {
    queueDate,
    latestQueueDate,
    recentQueueDates,
    hasMoreRecentQueueDates,
    isManual,
    queueReady,
    setManualDate,
    clearManualAndSetToday,
    captureQueueSelection,
    selectLatestQueueDate,
    refreshQueueWindowState,
    loadMoreRecentQueueDates,
  };
}
