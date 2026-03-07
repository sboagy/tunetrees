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
  type Resource,
} from "solid-js";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import {
  ensureDailyQueue,
  getLatestActiveQueueWindow,
} from "../../lib/services/practice-queue";
import {
  formatAsWindowStart,
  getPracticeDate,
} from "../../lib/utils/practice-date";

// localStorage keys — single source of truth for the queue date persistence contract.
export const QUEUE_DATE_STORAGE_KEY = "TT_PRACTICE_QUEUE_DATE";
export const QUEUE_DATE_MANUAL_FLAG_KEY = "TT_PRACTICE_QUEUE_DATE_MANUAL";

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
  clearManualAndSetToday: () => void;
}

// --- Module-private helpers ---

/**
 * Parse a queue date string from localStorage into a Date, or null if invalid.
 *
 * For values without an explicit timezone we do NOT force UTC — instead we
 * extract the YYYY-MM-DD portion and construct a Date at local noon, matching
 * getPracticeDate() convention and avoiding cross-timezone day shifts.
 */
function parseStoredDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Case 1: plain date "YYYY-MM-DD" → local noon.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const localNoon = new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
      12, 0, 0, 0
    );
    return Number.isNaN(localNoon.getTime()) ? null : localNoon;
  }

  // Case 2: unzoned datetime "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" —
  // only the date part is relevant; use local noon.
  const dateTimeNoZoneMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
  if (dateTimeNoZoneMatch) {
    const localNoon = new Date(
      Number(dateTimeNoZoneMatch[1]),
      Number(dateTimeNoZoneMatch[2]) - 1,
      Number(dateTimeNoZoneMatch[3]),
      12, 0, 0, 0
    );
    return Number.isNaN(localNoon.getTime()) ? null : localNoon;
  }

  // Case 3: explicit zone (e.g. toISOString() output) or other format —
  // let the Date constructor handle it.
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Returns "YYYY-MM-DD" using the LOCAL calendar date (not UTC). */
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  // Bootstrap signals from localStorage so the UI shows a stable initial date
  // before the async resource resolves. The resource will overwrite if stale.
  const storedInitial = parseStoredDate(
    localStorage.getItem(QUEUE_DATE_STORAGE_KEY)
  );
  const [queueDate, setQueueDate] = createSignal<Date>(
    storedInitial ?? getPracticeDate(),
    { equals: (a, b) => a.getTime() === b.getTime() }
  );
  const [isManual, setIsManual] = createSignal(
    localStorage.getItem(QUEUE_DATE_MANUAL_FLAG_KEY) === "true"
  );

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
  const [queueReady] = createResource(
    () => {
      const db = props.localDb();
      const uid = props.userId();
      const rid = props.currentRepertoireId();
      const syncReady = props.initialSyncComplete();
      const syncVersion = props.remoteSyncDownCompletionVersion();

      if (!syncReady) return null;

      // Wait for first remote sync before resolving, unless we already have a manual
      // stored date (matches the original hasManualStoredQueueDate fast-path).
      const isOnline =
        typeof navigator !== "undefined" ? navigator.onLine : true;
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
          const existingRows = await params.db.all<{ one: number }>(sql`
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
              storedDate
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

      let resolvedDate: Date;
      if (latestWindow.windowStartUtc) {
        // Use only the YYYY-MM-DD portion at local noon — do NOT pass through
        // parseStoredDate, which appends "Z" (UTC midnight) and shifts the date
        // back one day in timezones behind UTC (e.g. EST sees March 7 as March 6).
        const datePart = latestWindow.windowStartUtc.substring(0, 10); // "YYYY-MM-DD"
        const localNoon = new Date(`${datePart}T12:00:00`);
        resolvedDate = Number.isNaN(localNoon.getTime())
          ? getPracticeDate()
          : localNoon;
      } else {
        resolvedDate = getPracticeDate();
      }

      if (queueDate().getTime() !== resolvedDate.getTime())
        setQueueDate(resolvedDate);
      setIsManual(false);
      persistToStorage(resolvedDate, false);

      await ensureDailyQueue(
        params.db,
        params.userId,
        params.repertoireId,
        resolvedDate
      );

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
      await ensureDailyQueue(db, uid, rid, dateAtNoon);
    }
  };

  /**
   * Clear the manual flag and reset queueDate to today.
   *
   * Sync state update only. Does NOT call ensureDailyQueue — the caller
   * (handlePracticeDateRefresh) is responsible for creating today's queue.
   */
  const clearManualAndSetToday = (): void => {
    const today = getPracticeDate();
    setQueueDate(today);
    setIsManual(false);
    persistToStorage(today, false);
  };

  return {
    queueDate,
    isManual,
    queueReady,
    setManualDate,
    clearManualAndSetToday,
  };
}
