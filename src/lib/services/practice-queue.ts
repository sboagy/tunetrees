/** Read-only queue-window summaries for date navigation. Queue mutations live in goals/queue.ts. */
import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { SqliteDatabase } from "../db/client-sqlite";

type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

export interface LatestActiveQueueWindow {
  windowStartUtc: string | null;
  hasIncompleteRows: boolean;
  rowCount: number;
}

export interface ActiveQueueWindowSummary {
  queueDate: string;
  windowStartUtc: string;
  hasIncompleteRows: boolean;
  rowCount: number;
}

async function fetchActiveQueueWindowSummaries(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  limit: number,
  offset = 0,
  maxQueueDateInclusive?: string
): Promise<ActiveQueueWindowSummary[]> {
  const normalizedLimit = Math.max(1, Math.trunc(limit));
  const normalizedOffset = Math.max(0, Math.trunc(offset));
  const rows = maxQueueDateInclusive
    ? db.all<{
        queueDate: string;
        windowStartUtc: string;
        totalCount: number;
        incompleteCount: number;
      }>(sql`
        SELECT
          substr(replace(COALESCE(queue_date, window_start_utc), 'T', ' '), 1, 10) as queueDate,
          MAX(substr(replace(window_start_utc, 'T', ' '), 1, 19)) as windowStartUtc,
          COUNT(*) as totalCount,
          SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) as incompleteCount
        FROM daily_practice_queue
        WHERE user_ref = ${userRef}
          AND repertoire_ref = ${repertoireRef}
          AND active = 1
          AND substr(replace(COALESCE(queue_date, window_start_utc), 'T', ' '), 1, 10) <= ${maxQueueDateInclusive}
        GROUP BY substr(replace(COALESCE(queue_date, window_start_utc), 'T', ' '), 1, 10)
        ORDER BY queueDate DESC
        LIMIT ${normalizedLimit}
        OFFSET ${normalizedOffset}
      `)
    : db.all<{
        queueDate: string;
        windowStartUtc: string;
        totalCount: number;
        incompleteCount: number;
      }>(sql`
        SELECT
          substr(replace(COALESCE(queue_date, window_start_utc), 'T', ' '), 1, 10) as queueDate,
          MAX(substr(replace(window_start_utc, 'T', ' '), 1, 19)) as windowStartUtc,
          COUNT(*) as totalCount,
          SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) as incompleteCount
        FROM daily_practice_queue
        WHERE user_ref = ${userRef}
          AND repertoire_ref = ${repertoireRef}
          AND active = 1
        GROUP BY substr(replace(COALESCE(queue_date, window_start_utc), 'T', ' '), 1, 10)
        ORDER BY queueDate DESC
        LIMIT ${normalizedLimit}
        OFFSET ${normalizedOffset}
      `);

  return rows.map((row) => ({
    queueDate: String(row.queueDate),
    windowStartUtc: String(row.windowStartUtc),
    hasIncompleteRows: Number(row.incompleteCount) > 0,
    rowCount: Number(row.totalCount ?? 0),
  }));
}

/**
 * Get the latest active queue window for a user/repertoire and whether it is complete.
 *
 * Always returns the chronologically latest queue window — never falls back to an
 * older window just because it has incomplete rows. This prevents the UI from
 * jumping to a stale queue when the current queue becomes fully completed.
 *
 * This is used to keep queue behavior stable across reloads/devices without relying
 * on localStorage as the source of truth.
 */
export async function getLatestActiveQueueWindow(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string
): Promise<LatestActiveQueueWindow> {
  const [latest] = await fetchActiveQueueWindowSummaries(
    db,
    userRef,
    repertoireRef,
    1
  );
  if (!latest) {
    return {
      windowStartUtc: null,
      hasIncompleteRows: false,
      rowCount: 0,
    };
  }

  return {
    windowStartUtc: latest.windowStartUtc,
    hasIncompleteRows: latest.hasIncompleteRows,
    rowCount: latest.rowCount,
  };
}

/**
 * Get the most recent active queue windows for a user/repertoire.
 *
 * This powers queue-history UI where the user needs to jump back to the latest
 * active queue after manually previewing an older or future date.
 */
export async function getRecentActiveQueueWindows(
  db: AnyDatabase,
  userRef: string,
  repertoireRef: string,
  limit = 5,
  offset = 0,
  maxQueueDateInclusive?: string
): Promise<ActiveQueueWindowSummary[]> {
  return fetchActiveQueueWindowSummaries(
    db,
    userRef,
    repertoireRef,
    limit,
    offset,
    maxQueueDateInclusive
  );
}
