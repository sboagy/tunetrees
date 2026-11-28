import { sql } from "drizzle-orm";
import type { BrowserSqliteDatabase as SqliteDatabase } from "oosync/runtime/browser-sqlite";

/** SQL counterparts of utils/practice-history.ts for local SQLite consumers.
 * Keep selection/limits in SQLite without losing Postgres microsecond precision.
 * Inputs are trusted column identifiers, never user values.
 */
export function practiceTimestampSql(column: string): string {
  if (!/^[a-z_]+\.[a-z_]+$/i.test(column))
    throw new Error("Expected a qualified timestamp column");
  // Strip the fraction before SQLite parses the instant: its date functions round
  // to milliseconds (including carrying .999999 into the next second). Append the
  // original six-digit fraction only after converting the whole second to UTC.
  const general = `(WITH timestamp_input AS (
    SELECT trim(${column}) AS value
  ), timestamp_parts AS (
    SELECT substr(value, 1, 19) AS whole, substr(value, 20, 1) AS fraction_marker,
      CASE WHEN substr(value, 20, 1) = '.' THEN
        substr(substr(value, 21), 1,
          length(substr(value, 21)) - length(ltrim(substr(value, 21), '0123456789')))
        ELSE '' END AS fraction,
      CASE WHEN substr(value, 20, 1) = '.' THEN
        ltrim(substr(value, 21), '0123456789') ELSE substr(value, 20) END AS zone
    FROM timestamp_input
  ) SELECT CASE WHEN length(whole) = 19 AND length(fraction) <= 6
      AND (fraction_marker <> '.' OR length(fraction) > 0) THEN
    strftime('%Y-%m-%dT%H:%M:%S', replace(whole, 't', 'T') || CASE
      WHEN zone = '' THEN 'Z'
      WHEN length(zone) = 3 THEN zone || ':00'
      WHEN length(zone) = 5 THEN substr(zone, 1, 3) || ':' || substr(zone, 4)
      ELSE upper(zone) END) || '.' || substr(fraction || '000000', 1, 6) || 'Z'
    ELSE NULL END FROM timestamp_parts)`;
  // Normal writes use UTC with millisecond/microsecond fractions. Avoid the CTE
  // parser for that common shape, while still validating/converting the date.
  return `(CASE WHEN length(${column}) BETWEEN 22 AND 27
    AND ${column} GLOB '????-??-??T??:??:??.[0-9]*Z'
    AND substr(${column}, 21, length(${column}) - 21) NOT GLOB '*[^0-9]*'
    THEN strftime('%Y-%m-%dT%H:%M:%S', substr(${column}, 1, 19)) || '.' ||
      substr(substr(${column}, 21, length(${column}) - 21) || '000000', 1, 6) || 'Z'
    ELSE ${general} END)`;
}

/** DESC puts NULL (and unparseable display timestamps) last in SQLite. */
export function practiceHistoryOrderSql(alias = "pr"): string {
  const practiced = practiceTimestampSql(`${alias}.practiced`);
  const modified = practiceTimestampSql(`${alias}.last_modified_at`);
  return `${practiced} DESC, ${modified} DESC, ${alias}.id DESC`;
}

const rankedPracticeRecordsSql = `
  SELECT pr.*, ROW_NUMBER() OVER (
    PARTITION BY pr.tune_ref, pr.repertoire_ref
    ORDER BY ${practiceHistoryOrderSql()}
  ) AS row_num FROM practice_record pr
`;

/** Rank before filtering scheduler state or due dates: older events cannot reappear. */
export const latestPracticeRecordsSql = `
  SELECT * FROM (${rankedPracticeRecordsSql}) latest_pr WHERE latest_pr.row_num = 1
`;

/** Scope before ranking so analysis never scans other repertoires' history. */
export function latestPracticeRecordIdsForRepertoire(repertoireId: string) {
  // Compose SQL fragments explicitly: the editor's statement parser treats a
  // tagged-template fragment as a parameter rather than an embedded SELECT.
  return sql.join([
    sql.raw(
      `SELECT id FROM (${rankedPracticeRecordsSql} WHERE pr.repertoire_ref = `
    ),
    sql.param(repertoireId),
    sql.raw(") latest_pr WHERE latest_pr.row_num = 1"),
  ]);
}

/** Scheduling cannot silently substitute older history for damaged timestamps. */
export function assertValidPracticeHistory(
  db: SqliteDatabase,
  repertoireId: string
): void {
  const invalid = db.all<{ id: string }>(sql`
    SELECT pr.id FROM practice_record pr
    WHERE pr.repertoire_ref = ${repertoireId} AND (
      (pr.practiced IS NOT NULL AND ${sql.raw(practiceTimestampSql("pr.practiced"))} IS NULL)
      OR (pr.last_modified_at IS NOT NULL AND ${sql.raw(practiceTimestampSql("pr.last_modified_at"))} IS NULL)
    ) LIMIT 1
  `)[0];
  if (invalid)
    throw new Error(
      `Invalid practice timestamp in event ${invalid.id}; correct history before scheduling`
    );
}
