/**
 * Analysis Queries
 *
 * Database query functions for the Analysis tab charts.
 * Computes FSRS retention curves, staleness buckets, practice history,
 * and repertoire coverage from local SQLite.
 *
 * @module lib/db/queries/analysis
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  sql,
} from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import { latestPracticeRecordIdsForRepertoire } from "../practice-history-sql";
import { practiceRecord, repertoireTune, tune } from "../schema";

function latestPracticeFilter(repertoireId: string) {
  // Unlike a query-builder subquery, a raw SQL expression needs its own parentheses.
  const subquery = sql.join([
    sql.raw("("),
    latestPracticeRecordIdsForRepertoire(repertoireId),
    sql.raw(")"),
  ]);
  return inArray(practiceRecord.id, subquery);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One day's practice activity for the calendar heatmap. */
export type PracticeDay = {
  /** ISO date string: "YYYY-MM-DD" */
  day: string;
  /** Number of practice sessions on this day */
  count: number;
};

/** Staleness bucket for the overdue bar chart. */
export type StalenessBucket = {
  /** Human-readable label, e.g. "1-7 days" */
  label: string;
  /** Number of tunes in this bucket */
  count: number;
  /** Tune titles in this bucket (for popover detail) */
  tunes: string[];
};

/** Data point for the FSRS retention area chart. */
export type RetentionPoint = {
  /** Days from today */
  day: number;
  /** Average predicted retention (0–1) */
  retention: number;
};

/** Genre/type slice for the donut chart. */
export type CoverageSlice = {
  /** Tune type label (e.g. "Reel", "Jig") */
  type: string;
  count: number;
};

// ---------------------------------------------------------------------------
// FSRS formula
// ---------------------------------------------------------------------------

/**
 * FSRS-inspired forgetting curve: R(t, S) = 0.9^(t/S)
 * At t=S, R=90% (the FSRS design target).
 *
 * @param t  - days elapsed since last review
 * @param s  - stability (days until 90% retention)
 */
function fsrsRetention(t: number, s: number): number {
  return 0.9 ** (t / s);
}

// ---------------------------------------------------------------------------
// Practice History (calendar heatmap, 365 days)
// ---------------------------------------------------------------------------

/**
 * Return daily practice session counts for the last 365 days.
 *
 * @param db          - SQLite database instance
 * @param repertoireId - Repertoire UUID
 */
export async function getPracticeHistory(
  db: SqliteDatabase,
  repertoireId: string
): Promise<PracticeDay[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffIso = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // This is an expression, not a standalone SQL statement for the editor parser.
  const practiceDay = sql
    .join([sql.raw("date("), practiceRecord.practiced, sql.raw(")")])
    .mapWith(String);
  const rows = await db
    .select({
      day: practiceDay.as("day"),
      count: count().as("count"),
    })
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.repertoireRef, repertoireId),
        isNotNull(practiceRecord.practiced),
        gte(practiceDay, cutoffIso)
      )
    )
    .groupBy(practiceDay)
    .orderBy(practiceDay);

  return rows.map((r) => ({ day: r.day, count: r.count }));
}

// ---------------------------------------------------------------------------
// Staleness (overdue analysis)
// ---------------------------------------------------------------------------

/**
 * Get tunes that are overdue, bucketed by how many days past-due they are.
 * Uses the most recent practice_record per tune (by `practiced` date).
 *
 * @param db          - SQLite database instance
 * @param repertoireId - Repertoire UUID
 */
export async function getStalenessData(
  db: SqliteDatabase,
  repertoireId: string
): Promise<StalenessBucket[]> {
  const today = new Date().toISOString().slice(0, 10);

  // Select the latest event first, then keep eligible overdue records.
  const rows = await db
    .select({
      tuneRef: practiceRecord.tuneRef,
      title: tune.title,
      due: practiceRecord.due,
      practiced: practiceRecord.practiced,
    })
    .from(practiceRecord)
    .innerJoin(tune, eq(tune.id, practiceRecord.tuneRef))
    .where(
      and(
        eq(practiceRecord.repertoireRef, repertoireId),
        latestPracticeFilter(repertoireId),
        isNotNull(practiceRecord.stability),
        isNotNull(practiceRecord.due),
        lt(practiceRecord.due, today)
      )
    );

  // Build buckets
  const todayMs = Date.parse(today);
  const buckets: StalenessBucket[] = [
    { label: "1 day", count: 0, tunes: [] },
    { label: "2–7 days", count: 0, tunes: [] },
    { label: "8–30 days", count: 0, tunes: [] },
    { label: "31–90 days", count: 0, tunes: [] },
    { label: "> 90 days", count: 0, tunes: [] },
  ];

  for (const { title, due } of rows) {
    if (!due) continue;
    const dueMs = Date.parse(due.slice(0, 10));
    const daysOverdue = Math.floor((todayMs - dueMs) / 86_400_000);
    const label = title ?? "Unknown";

    let bucket: StalenessBucket;
    if (daysOverdue <= 1) {
      bucket = buckets[0];
    } else if (daysOverdue <= 7) {
      bucket = buckets[1];
    } else if (daysOverdue <= 30) {
      bucket = buckets[2];
    } else if (daysOverdue <= 90) {
      bucket = buckets[3];
    } else {
      bucket = buckets[4];
    }
    bucket.count++;
    bucket.tunes.push(label);
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// FSRS Retention Curve (forward-looking, 60 days)
// ---------------------------------------------------------------------------

/**
 * Compute a 60-day forward-looking average retention curve using the FSRS
 * R(t,S) = 0.9^(t/S) formula.
 *
 * Uses each tune’s most recent event only when that event has valid stability.
 *
 * @param db          - SQLite database instance
 * @param repertoireId - Repertoire UUID
 */
export async function getFsrsRetentionCurve(
  db: SqliteDatabase,
  repertoireId: string
): Promise<RetentionPoint[]> {
  // Select the latest event first; a newer non-FSRS event must not revive old stability.
  const rows = await db
    .select({
      tuneRef: practiceRecord.tuneRef,
      stability: practiceRecord.stability,
      practiced: practiceRecord.practiced,
    })
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.repertoireRef, repertoireId),
        latestPracticeFilter(repertoireId),
        isNotNull(practiceRecord.stability)
      )
    );

  // SQL has already selected one latest event per tune, before stability filtering.
  const stabilities = rows.flatMap((row) =>
    row.stability !== null && row.stability > 0 ? [row.stability] : []
  );

  if (stabilities.length === 0) {
    // No data: return empty curve so the UI can render its empty state.
    return [];
  }

  // For each day 0–60, compute average predicted retention across all tunes
  const points: RetentionPoint[] = [];
  for (let day = 0; day <= 60; day++) {
    const avg =
      stabilities.reduce((sum, s) => sum + fsrsRetention(day, s), 0) /
      stabilities.length;
    points.push({ day, retention: Math.max(0, Math.min(1, avg)) });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Repertoire Coverage (genre/type donut)
// ---------------------------------------------------------------------------

/**
 * Count tunes in the user's repertoire by tune type (Reel, Jig, etc.).
 *
 * @param db          - SQLite database instance
 * @param repertoireId - Repertoire UUID
 */
export async function getRepertoireCoverage(
  db: SqliteDatabase,
  repertoireId: string
): Promise<CoverageSlice[]> {
  const rows = await db
    .select({
      type: tune.type,
      count: count().as("count"),
    })
    .from(repertoireTune)
    .innerJoin(tune, eq(tune.id, repertoireTune.tuneRef))
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.deleted, 0)
      )
    )
    .groupBy(tune.type)
    .orderBy(desc(count()));

  return rows.map((r) => ({
    type: r.type ?? "Unknown",
    count: r.count,
  }));
}
