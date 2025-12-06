/**
 * Scheduling Data Query Helpers
 *
 * Utilities for querying scheduling-related data from browser's local database
 * during E2E tests. Uses the __ttTestApi exposed by the application.
 */

import type { Page } from "@playwright/test";
import log from "loglevel";

log.setLevel("info");

/**
 * Practice Record (from practice_record table)
 */
export interface PracticeRecord {
  id: string;
  tune_ref: string;
  playlist_ref: string;
  practiced: string; // ISO timestamp
  due: string; // ISO timestamp - next review date
  quality: number; // 1=Again, 2=Hard, 3=Good, 4=Easy
  interval: number; // Days until next review
  repetitions: number;
  stability: number; // FSRS stability metric
  difficulty: number; // FSRS difficulty metric
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  step: number | null;
  goal: string;
  technique: string;
  elapsed_days: number | null;
  lapses: number;
}

/**
 * Scheduled Date Info (from playlist_tune table)
 */
export interface ScheduledDateInfo {
  tune_ref: string;
  scheduled: string | null; // ISO timestamp or null if never scheduled
  learned: string | null;
  current: string | null; // Same as 'scheduled' - next review date
}

/**
 * Practice Queue Item (from daily_practice_queue table)
 */
export interface PracticeQueueItem {
  id: string;
  tune_ref: string;
  bucket: number; // 1=Due Today, 2=Lapsed, 3=New, 4=Old Lapsed
  order_index: number;
  window_start_utc: string; // ISO timestamp
  window_end_utc: string; // ISO timestamp
  completed_at: string | null; // ISO timestamp or null if not completed
  snapshot_coalesced_ts: string | null;
}

/**
 * Get practice records for specific tunes
 *
 * @param page - Playwright Page
 * @param tuneIds - Array of tune UUIDs to query
 * @returns Array of practice records
 */
export async function queryPracticeRecords(
  page: Page,
  tuneIds: string[]
): Promise<PracticeRecord[]> {
  log.debug(`📊 Querying practice records for ${tuneIds.length} tune(s)`);

  const records = await page.evaluate(async (ids) => {
    const api = (window as any).__ttTestApi;
    if (!api) {
      throw new Error("__ttTestApi not available on window");
    }

    return await api.getPracticeRecords(ids);
  }, tuneIds);

  log.debug(`✅ Found ${records.length} practice record(s)`);
  return records;
}

/**
 * Get tunes by their titles from the local database
 *
 * @param page - Playwright Page
 * @param titles - Array of tune titles to query
 * @returns Array of { id, title } objects
 */
export async function queryTunesByTitles(
  page: Page,
  titles: string[]
): Promise<Array<{ id: string; title: string }>> {
  log.debug(`📊 Querying tunes by ${titles.length} title(s)`);

  const tunes = await page.evaluate(async (titlesArg) => {
    const api = (window as any).__ttTestApi;
    if (!api) {
      throw new Error("__ttTestApi not available on window");
    }

    return await api.getTunesByTitles(titlesArg);
  }, titles);

  log.debug(`✅ Found ${tunes.length} tune(s) by title`);
  return tunes;
}

/**
 * Get the latest practice record for a single tune
 *
 * @param page - Playwright Page
 * @param tuneId - Tune UUID
 * @param playlistId - Playlist UUID
 * @returns Latest practice record or null if never practiced
 */
export async function queryLatestPracticeRecord(
  page: Page,
  tuneId: string,
  playlistId: string
): Promise<PracticeRecord | null> {
  log.debug(`📊 Querying latest practice record for tune ${tuneId}`);

  let record: PracticeRecord | null = null;
  try {
    record = await page.evaluate(
      async (args) => {
        try {
          const api = (window as any).__ttTestApi;
          if (!api) {
            throw new Error("__ttTestApi not available on window");
          }
          // Extra browser-side instrumentation
          // eslint-disable-next-line no-console
          console.debug(
            `[queryLatestPracticeRecord] Evaluating in browser tuneId=${args.tuneId} playlistId=${args.playlistId}`
          );
          const res = await api.getLatestPracticeRecord(
            args.tuneId,
            args.playlistId
          );
          // eslint-disable-next-line no-console
          console.debug(
            `[queryLatestPracticeRecord] Browser result null=${res == null}`
          );
          return res;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`[queryLatestPracticeRecord] Browser-side error:`, e);
          throw e;
        }
      },
      { tuneId, playlistId }
    );
  } catch (err) {
    log.error(
      `❌ queryLatestPracticeRecord evaluate failed: ${(err as Error).message}`
    );
    throw err; // Re-throw so tests still fail visibly
  }

  if (record) {
    log.debug(`✅ Found practice record: interval=${record.interval}d`);
  } else {
    log.debug(`ℹ️  No practice record found (tune never practiced)`);
  }

  return record;
}

/**
 * Get scheduled dates for tunes in a playlist
 *
 * @param page - Playwright Page
 * @param playlistId - Playlist UUID
 * @param tuneIds - Optional array of specific tune IDs to query
 * @returns Map of tune_ref → scheduled date info
 */
export async function queryScheduledDates(
  page: Page,
  playlistId: string,
  tuneIds?: string[]
): Promise<Map<string, ScheduledDateInfo>> {
  log.debug(
    `📊 Querying scheduled dates for playlist ${playlistId}${tuneIds ? ` (${tuneIds.length} tunes)` : ""}`
  );

  const result = await page.evaluate(
    async (args) => {
      const api = (window as any).__ttTestApi;
      if (!api) {
        throw new Error("__ttTestApi not available on window");
      }

      return await api.getScheduledDates(args.playlistId, args.tuneIds);
    },
    { playlistId, tuneIds }
  );

  const dateMap = new Map<string, ScheduledDateInfo>(Object.entries(result));
  log.debug(`✅ Found ${dateMap.size} scheduled date(s)`);

  return dateMap;
}

/**
 * Get current practice queue for a specific window
 *
 * @param page - Playwright Page
 * @param playlistId - Playlist UUID
 * @param windowStartUtc - Optional window start (defaults to today)
 * @returns Array of queue items
 */
export async function queryPracticeQueue(
  page: Page,
  playlistId: string,
  windowStartUtc?: string
): Promise<PracticeQueueItem[]> {
  log.debug(
    `📊 Querying practice queue for playlist ${playlistId}${windowStartUtc ? ` (window: ${windowStartUtc})` : ""}`
  );

  const queue = await page.evaluate(
    async (args) => {
      const api = (window as any).__ttTestApi;
      if (!api) {
        throw new Error("__ttTestApi not available on window");
      }

      return await api.getPracticeQueue(args.playlistId, args.windowStartUtc);
    },
    { playlistId, windowStartUtc }
  );

  log.debug(
    `✅ Found ${queue.length} item(s) in queue (buckets: ${[...new Set(queue.map((q: PracticeQueueItem) => q.bucket))].join(", ")})`
  );

  return queue;
}

/**
 * Get queue bucket distribution (count of tunes in each bucket)
 *
 * @param queue - Practice queue items
 * @returns Object with counts per bucket
 */
export function getQueueBucketDistribution(queue: PracticeQueueItem[]): {
  q1_due_today: number;
  q2_lapsed: number;
  q3_new: number;
  q4_old_lapsed: number;
  total: number;
} {
  const distribution = {
    q1_due_today: 0,
    q2_lapsed: 0,
    q3_new: 0,
    q4_old_lapsed: 0,
    total: queue.length,
  };

  for (const item of queue) {
    switch (item.bucket) {
      case 1:
        distribution.q1_due_today++;
        break;
      case 2:
        distribution.q2_lapsed++;
        break;
      case 3:
        distribution.q3_new++;
        break;
      case 4:
        distribution.q4_old_lapsed++;
        break;
    }
  }

  log.debug(
    `📊 Queue distribution: Q1=${distribution.q1_due_today}, Q2=${distribution.q2_lapsed}, ` +
      `Q3=${distribution.q3_new}, Q4=${distribution.q4_old_lapsed}`
  );

  return distribution;
}

/**
 * Verify that all practice records have scheduled dates in the future
 *
 * @param records - Practice records to validate
 * @param referenceDate - Date to compare against (defaults to now)
 * @throws Error if any scheduled date is in the past
 */
export function validateScheduledDatesInFuture(
  records: PracticeRecord[],
  referenceDate: Date = new Date()
): void {
  const invalidRecords: Array<{ id: string; due: string; diff: number }> = [];

  for (const record of records) {
    const dueDate = new Date(record.due);
    const diffMs = dueDate.getTime() - referenceDate.getTime();

    if (diffMs < 0) {
      invalidRecords.push({
        id: record.id,
        due: record.due,
        diff: Math.abs(diffMs / 1000 / 60 / 60 / 24), // Days in past
      });
    }
  }

  if (invalidRecords.length > 0) {
    const details = invalidRecords
      .map((r) => `ID ${r.id}: due=${r.due} (${r.diff.toFixed(1)}d ago)`)
      .join("\n  ");

    throw new Error(
      `❌ Found ${invalidRecords.length} record(s) with scheduled dates in the PAST:\n  ${details}`
    );
  }

  log.debug(
    `✅ All ${records.length} practice record(s) have future scheduled dates`
  );
}

/**
 * Verify that intervals are increasing (for successful reviews)
 *
 * @param intervals - Array of intervals in chronological order
 * @param minGrowthFactor - Minimum growth factor between intervals (default: 1.0 = non-decreasing)
 * @throws Error if intervals don't increase appropriately
 */
export function validateIncreasingIntervals(
  intervals: number[],
  minGrowthFactor = 1.0
): void {
  for (let i = 1; i < intervals.length; i++) {
    const ratio = intervals[i] / intervals[i - 1];

    if (ratio < minGrowthFactor) {
      throw new Error(
        `❌ Interval failed to increase: intervals[${i - 1}]=${intervals[i - 1]}d, ` +
          `intervals[${i}]=${intervals[i]}d (ratio: ${ratio.toFixed(2)}, ` +
          `expected ≥ ${minGrowthFactor})`
      );
    }
  }

  log.debug(
    `✅ Intervals increasing correctly: ${intervals.join("d → ")}d (growth ≥ ${minGrowthFactor}x)`
  );
}

/**
 * Calculate interval statistics
 *
 * @param intervals - Array of intervals
 * @returns Statistics object
 */
export function calculateIntervalStats(intervals: number[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  growthFactors: number[];
} {
  if (intervals.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, growthFactors: [] };
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const growthFactors: number[] = [];

  for (let i = 1; i < intervals.length; i++) {
    growthFactors.push(intervals[i] / intervals[i - 1]);
  }

  const stats = {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: intervals.reduce((sum, val) => sum + val, 0) / intervals.length,
    median:
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)],
    growthFactors,
  };

  log.debug(
    `📊 Interval stats: min=${stats.min}d, max=${stats.max}d, ` +
      `avg=${stats.avg.toFixed(1)}d, median=${stats.median}d`
  );

  return stats;
}
