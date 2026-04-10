/**
 * Practice Query Functions
 *
 * Client-side queries for practice records, queue, and FSRS scheduling.
 * All functions read from local SQLite WASM (no server calls).
 *
 * Architecture:
 * - Queries `practice_list_staged` VIEW (complete enriched dataset)
 * - VIEW does ALL JOINs and COALESCE operations
 * - Filters by `daily_practice_queue` for frozen snapshot
 *
 * Replaces legacy server-side queries:
 * - legacy/tunetrees/app/queries.py#query_practice_list_scheduled
 * - legacy/tunetrees/app/schedule.py (various record fetching)
 *
 * @module lib/db/queries/practice
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { generateId } from "../../utils/uuid";
import { persistDb, type SqliteDatabase } from "../client-sqlite";
import {
  practiceRecord,
  prefsSchedulingOptions,
  prefsSpacedRepetition,
  repertoire,
  repertoireTune,
  tune,
} from "../schema";
import type {
  DailyPracticeQueue,
  IUserSchedulingOptions,
  PracticeRecord,
  PracticeRecordWithTune,
  PrefsSpacedRepetition,
} from "../types";
import type { ITuneOverview } from "../view-types";

/**
 * Practice List Staged Row
 *
 * Canonical shape for rows from the `practice_list_staged` VIEW.
 * This is shared with the UI grid layer via ITuneOverview to avoid drift.
 */
export type PracticeListStagedRow = ITuneOverview;

/**
 * Practice List Staged with Queue Info
 *
 * Extends PracticeListStagedRow with daily_practice_queue fields.
 * This is what the practice grid actually displays.
 */
export type PracticeListStagedWithQueue = PracticeListStagedRow & {
  // From daily_practice_queue
  bucket: number;
  order_index: number;
  completed_at: string | null;
};

type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

/**
 * Clear stale staged evaluations for a repertoire within the active queue window.
 *
 * This is a defensive cleanup pass that removes rows in `table_transient_data`
 * that no longer belong to the active queue window or predate the window
 * (e.g., abandoned staging due to failed submit, queue regeneration, or window
 * format mismatches). It is intentionally safe to call on every practice list
 * load; a no-op when no stale rows exist.
 *
 * @param db - SQLite database instance (sql.js in app or better-sqlite3 in tests)
 * @param userId - Supabase Auth UUID
 * @param repertoireId - Repertoire ID
 * @param windowStartIso19 - Window start timestamp normalized to ISO (YYYY-MM-DDTHH:MM:SS)
 * @returns Count of stale rows removed
 */
export async function clearStaleStagedEvaluations(
  db: AnyDatabase,
  userId: string,
  repertoireId: string,
  windowStartIso19: string
): Promise<number> {
  const result = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM table_transient_data
    WHERE table_transient_data.user_id = ${userId}
    AND table_transient_data.repertoire_id = ${repertoireId}
			AND (
				NOT EXISTS (
					SELECT 1
					FROM daily_practice_queue dpq
					WHERE dpq.tune_ref = table_transient_data.tune_id
						AND dpq.user_ref = ${userId}
            AND dpq.repertoire_ref = ${repertoireId}
						AND dpq.active = 1
						AND substr(replace(dpq.window_start_utc, ' ', 'T'), 1, 19) = ${windowStartIso19}
				)
				OR substr(replace(table_transient_data.last_modified_at, ' ', 'T'), 1, 19) < ${windowStartIso19}
			)
  `);
  const countValue = result?.count;
  const count =
    typeof countValue === "number"
      ? countValue
      : Number.parseInt(String(countValue ?? 0), 10);
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }

  await db.run(sql`
    DELETE FROM table_transient_data
    WHERE table_transient_data.user_id = ${userId}
    AND table_transient_data.repertoire_id = ${repertoireId}
			AND (
				NOT EXISTS (
					SELECT 1
					FROM daily_practice_queue dpq
					WHERE dpq.tune_ref = table_transient_data.tune_id
						AND dpq.user_ref = ${userId}
            AND dpq.repertoire_ref = ${repertoireId}
						AND dpq.active = 1
						AND substr(replace(dpq.window_start_utc, ' ', 'T'), 1, 19) = ${windowStartIso19}
				)
				OR substr(replace(table_transient_data.last_modified_at, ' ', 'T'), 1, 19) < ${windowStartIso19}
			)
  `);

  if (typeof indexedDB !== "undefined") {
    await persistDb();
  }

  console.log(
    `[clearStaleStagedEvaluations] Removed ${count} stale staged row(s) for user=${userId}, repertoire=${repertoireId}, window=${windowStartIso19}`
  );

  return count;
}

/**
 * Get practice list filtered by daily practice queue
 *
 * Queries practice_list_staged VIEW JOINed with daily_practice_queue.
 * The queue provides the frozen snapshot of which tunes to practice today,
 * including tunes already submitted (filtering for completed_at should be done
 * by caller).
 *
 * Returns tunes in queue order (bucket, order_index) with completed_at tracking.
 *
 * @param db - SQLite database instance
 * @param userId - Supabase Auth UUID
 * @param repertoireId - Repertoire to query
 * @param _delinquencyWindowDays - Unused (kept for API compatibility)
 * @returns Array of practice list rows with queue info (bucket, order_index, completed_at)
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const practices = await getPracticeList(db, 1, 5);
 * // Returns tunes from today's frozen queue snapshot
 * ```
 */
export async function getPracticeList(
  db: SqliteDatabase,
  userId: string,
  repertoireId: string,
  _delinquencyWindowDays: number = 7, // Kept for API compatibility
  windowStartUtc?: string
): Promise<PracticeListStagedWithQueue[]> {
  // Query practice_list_staged INNER JOIN daily_practice_queue
  // Queue determines which tunes to practice and their ordering

  // Determine which queue window to query.
  // Prefer the caller-provided window (matches UI-selected queue date),
  // falling back to "most recent active" for backward compatibility.
  //
  // NOTE: There are TWO window formats in the DB for the same date:
  // 'YYYY-MM-DDTHH:MM:SS' (ISO with T) and 'YYYY-MM-DD HH:MM:SS' (space format).
  // Match BOTH to avoid split-window mismatches.
  let isoFormat: string | undefined;

  const requestedWindow = windowStartUtc?.trim();
  if (requestedWindow) {
    isoFormat = requestedWindow.includes("T")
      ? requestedWindow
      : requestedWindow.replace(" ", "T");
  } else {
    const maxWindow = await db.get<{ max_window: string }>(sql`
      SELECT MAX(window_start_utc) as max_window
      FROM daily_practice_queue
      WHERE user_ref = ${userId}
        AND repertoire_ref = ${repertoireId}
        AND active = 1
    `);

    isoFormat = maxWindow?.max_window; // e.g., '2025-11-08T00:00:00'
  }

  // If no window exists, return empty array
  if (!isoFormat) {
    console.log(
      `[getPracticeList] No queue window found, returning empty list`
    );
    return [];
  }

  const windowStartIso19 = isoFormat.replace(" ", "T").substring(0, 19);
  // Defensive cleanup: remove stale staged rows that no longer match this
  // active queue window or that predate the window.
  await clearStaleStagedEvaluations(db, userId, repertoireId, windowStartIso19);

  // Select from the MOST RECENT active queue snapshot
  // Match BOTH '2025-11-08T00:00:00' AND '2025-11-08 00:00:00' formats
  // Use GROUP BY to eliminate duplicates (some tunes may exist in both windows)
  // Take the MIN bucket/order_index if duplicates exist
  // The result must include tunes with non-null completed_at values.
  const rows = await db.all<PracticeListStagedWithQueue>(sql`
    SELECT 
      pls.*,
      MIN(dpq.bucket) as bucket,
      MIN(dpq.order_index) as order_index,
      MIN(dpq.completed_at) as completed_at
    FROM practice_list_staged pls
    INNER JOIN daily_practice_queue dpq 
      ON dpq.tune_ref = pls.id
      AND dpq.user_ref = pls.user_ref
      AND dpq.repertoire_ref = pls.repertoire_id
    WHERE dpq.user_ref = ${userId}
      AND dpq.repertoire_ref = ${repertoireId}
      AND dpq.active = 1
      AND substr(replace(dpq.window_start_utc, ' ', 'T'), 1, 19) = ${windowStartIso19}
    GROUP BY pls.id
    ORDER BY MIN(dpq.bucket) ASC, MIN(dpq.order_index) ASC
  `);

  console.log(`[getPracticeList] JOIN returned ${rows.length} rows`);

  return rows;
}

/**
 * Get daily practice queue snapshot
 *
 * Retrieves the frozen daily practice queue for a specific date.
 * This is the pre-generated, stable queue that doesn't change
 * as the user practices during the day.
 *
 * @param db - SQLite database instance
 * @param userId - Supabase Auth UUID
 * @param repertoireId - Repertoire ID
 * @param queueDate - Date for the queue (defaults to today)
 * @returns Array of daily practice queue entries
 */
export async function getDailyPracticeQueue(
  _db: SqliteDatabase,
  _userId: string,
  _repertoireId: string,
  _queueDate: Date = new Date()
): Promise<DailyPracticeQueue[]> {
  // TODO: Implement this function (currently unused)
  console.warn("getDailyPracticeQueue: Not implemented");
  return [];
}

/**
 * Get latest practice record for a tune
 *
 * Used by FSRS service to retrieve practice history when calculating
 * next review dates.
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param repertoireId - Repertoire ID
 * @returns Latest practice record or null if never practiced
 *
 * @example
 * ```typescript
 * const latest = await getLatestPracticeRecord(db, 123, 1);
 * if (latest) {
 *   console.log('Last practiced:', latest.practiced);
 *   console.log('Stability:', latest.stability);
 * }
 * ```
 */
export async function getLatestPracticeRecord(
  db: SqliteDatabase,
  tuneId: string,
  repertoireId: string
): Promise<PracticeRecord | null> {
  const results = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.repertoireRef, repertoireId)
      )
    )
    .orderBy(desc(practiceRecord.practiced))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get user's FSRS preferences
 *
 * Retrieves spaced repetition settings for FSRS algorithm initialization.
 *
 * @param db - SQLite database instance
 * @param userId - Supabase Auth UUID
 * @returns User preferences or null if not set
 */
export async function getUserPreferences(
  db: SqliteDatabase,
  userId: string
): Promise<PrefsSpacedRepetition | null> {
  try {
    const results = await db
      .select()
      .from(prefsSpacedRepetition)
      .where(eq(prefsSpacedRepetition.userId, userId))
      .limit(1);
    if (results[0]) return results[0];
  } catch (e) {
    console.warn("getUserPreferences query failed, using fallback", e);
  }
  // Fallback defaults (legacy-like) if no row found or query fails
  return {
    userId,
    algType: "FSRS",
    fsrsWeights: null,
    requestRetention: 0.9,
    maximumInterval: 36500,
    learningSteps: null,
    relearningSteps: null,
    enableFuzzing: 1,
    syncVersion: 0,
    lastModifiedAt: new Date().toISOString(),
    deviceId: null,
  };
}

/**
 * Get user's scheduling options preferences.
 * Falls back to sensible defaults when not found.
 */
export async function getUserSchedulingOptions(
  db: SqliteDatabase,
  userId: string
): Promise<IUserSchedulingOptions> {
  try {
    const rows = await db
      .select()
      .from(prefsSchedulingOptions)
      .where(eq(prefsSchedulingOptions.userId, userId))
      .limit(1);
    if (rows[0]) {
      const r = rows[0];
      return {
        userId,
        acceptableDelinquencyWindow: r.acceptableDelinquencyWindow ?? 7,
        minReviewsPerDay: r.minReviewsPerDay ?? 3,
        maxReviewsPerDay: r.maxReviewsPerDay ?? 10,
        daysPerWeek: r.daysPerWeek ?? null,
        weeklyRules: r.weeklyRules ?? null,
        exceptions: r.exceptions ?? null,
        autoScheduleNew: Boolean(r.autoScheduleNew),
      };
    }
  } catch (e) {
    console.warn("getUserSchedulingOptions query failed, using fallback", e);
  }
  // Fallback defaults mirroring practice-queue service defaults
  return {
    userId,
    acceptableDelinquencyWindow: 7,
    minReviewsPerDay: 3,
    maxReviewsPerDay: 10,
    daysPerWeek: null,
    weeklyRules: null,
    exceptions: null,
    autoScheduleNew: true,
  };
}

/**
 * Get practice history for a tune
 *
 * Retrieves all practice records for a tune, ordered by most recent first.
 * Used for practice history view.
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param repertoireId - Repertoire ID
 * @param limit - Maximum number of records to return (default: all)
 * @returns Array of practice records with tune information
 *
 * @example
 * ```typescript
 * const history = await getPracticeHistory(db, 123, 1, 50);
 * // Returns last 50 practice sessions for this tune
 * ```
 */
export async function getPracticeHistory(
  db: SqliteDatabase,
  tuneId: string,
  repertoireId: string,
  limit?: number
): Promise<PracticeRecordWithTune[]> {
  let query = db
    .select({
      // Practice record fields
      id: practiceRecord.id,
      repertoireRef: practiceRecord.repertoireRef,
      tuneRef: practiceRecord.tuneRef,
      practiced: practiceRecord.practiced,
      quality: practiceRecord.quality,
      easiness: practiceRecord.easiness,
      interval: practiceRecord.interval,
      repetitions: practiceRecord.repetitions,
      due: practiceRecord.due,
      backup_practiced: practiceRecord.backupPracticed,
      stability: practiceRecord.stability,
      elapsed_days: practiceRecord.elapsedDays,
      lapses: practiceRecord.lapses,
      state: practiceRecord.state,
      difficulty: practiceRecord.difficulty,
      step: practiceRecord.step,
      goal: practiceRecord.goal,
      technique: practiceRecord.technique,
      syncVersion: practiceRecord.syncVersion,
      lastModifiedAt: practiceRecord.lastModifiedAt,
      deviceId: practiceRecord.deviceId,

      // Tune fields
      tune: {
        id: tune.id,
        idForeign: tune.idForeign,
        primaryOrigin: tune.primaryOrigin,
        title: tune.title,
        type: tune.type,
        mode: tune.mode,
        structure: tune.structure,
        incipit: tune.incipit,
        genre: tune.genre,
        composer: tune.composer,
        artist: tune.artist,
        releaseYear: tune.releaseYear,
        deleted: tune.deleted,
        privateFor: tune.privateFor,
        syncVersion: tune.syncVersion,
        lastModifiedAt: tune.lastModifiedAt,
        deviceId: tune.deviceId,
      },

      // Repertoire name
      repertoireName: repertoire.instrumentRef,
    })
    .from(practiceRecord)
    .innerJoin(tune, eq(tune.id, practiceRecord.tuneRef))
    .innerJoin(
      repertoire,
      eq(repertoire.repertoireId, practiceRecord.repertoireRef)
    )
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.repertoireRef, repertoireId)
      )
    )
    .orderBy(desc(practiceRecord.practiced));

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  const results = await query;

  // Convert null to undefined for repertoireName to match interface
  return results.map((r) => ({
    ...r,
    elapsedDays: r.elapsed_days,
    backupPracticed: r.backup_practiced,
    repertoireName: r.repertoireName ? String(r.repertoireName) : undefined,
  }));
}

/**
 * Add tunes to practice queue ("Add To Review" from Repertoire)
 *
 * For selected repertoire tunes, this function:
 * 1. Bumps lastModifiedAt for sync tracking
 * 2. Creates initial practice records if they don't exist
 *
 * NOTE: This function intentionally does NOT set `scheduled = now`. The
 * `scheduled` field on repertoire_tune is reserved for explicit user-set
 * schedule overrides (via the ScheduledOverridePicker). Making tunes
 * immediately available for practice is handled by addSpecificTunesToExistingQueue
 * which writes directly to daily_practice_queue.
 *
 * This is the client-side equivalent of the legacy Python function:
 * `add_tunes_to_practice_queue` in tunetrees/app/queries.py
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param tuneIds - Array of tune IDs to add to practice queue
 * @returns Object with counts of added and skipped tunes
 *
 * @example
 * ```typescript
 * const result = await addTunesToPracticeQueue(db, 1, [123, 456]);
 * console.log(`Added ${result.added} tunes to practice queue`);
 * ```
 */
export async function addTunesToPracticeQueue(
  db: SqliteDatabase,
  repertoireId: string,
  tuneIds: string[]
): Promise<{ added: number; skipped: number; tuneIds: string[] }> {
  const now = new Date().toISOString();
  let added = 0;
  let skipped = 0;
  const addedTuneIds: string[] = [];

  for (const tuneId of tuneIds) {
    try {
      // Touch lastModifiedAt for sync tracking (do NOT set scheduled — that
      // field is reserved for explicit user-set overrides via ScheduledOverridePicker)
      const result = await db
        .update(repertoireTune)
        .set({
          syncVersion: sql.raw(`sync_version + 1`),
          lastModifiedAt: now,
        })
        .where(
          and(
            eq(repertoireTune.repertoireRef, repertoireId),
            eq(repertoireTune.tuneRef, tuneId),
            eq(repertoireTune.deleted, 0)
          )
        )
        .returning();

      if (result && result.length > 0) {
        added++;
        addedTuneIds.push(tuneId);

        // Sync is handled automatically by SQL triggers populating sync_outbox

        // Check if practice record exists
        const existing = await db
          .select()
          .from(practiceRecord)
          .where(
            and(
              eq(practiceRecord.repertoireRef, repertoireId),
              eq(practiceRecord.tuneRef, tuneId)
            )
          )
          .limit(1);

        // If no practice record exists, create an initial one (state=0, New)
        if (!existing || existing.length === 0) {
          await db.insert(practiceRecord).values({
            id: generateId(),
            repertoireRef: repertoireId,
            tuneRef: tuneId,
            practiced: null,
            quality: null,
            easiness: null,
            difficulty: 0,
            stability: null,
            interval: null,
            step: null,
            repetitions: 0,
            lapses: 0,
            elapsedDays: 0,
            state: 0, // State 0 = New
            due: null,
            backupPracticed: null,
            goal: "recall",
            technique: null,
            syncVersion: 1,
            lastModifiedAt: now,
            deviceId: "local",
          });

          // Sync is handled automatically by SQL triggers populating sync_outbox
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error adding tune ${tuneId} to practice queue:`, error);
      skipped++;
    }
  }

  return { added, skipped, tuneIds: addedTuneIds };
}

/**
 * Get all practice records for a repertoire
 *
 * Retrieves practice history for all tunes in a repertoire.
 * Useful for analytics and progress tracking.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param limit - Maximum number of records to return
 * @returns Array of practice records with tune information
 *
 * @example
 * ```typescript
 * const recent = await getPracticeRecords(db, 1, 100);
 * // Returns last 100 practice sessions for repertoire
 * ```
 */
export async function getPracticeRecords(
  db: SqliteDatabase,
  repertoireId: string,
  limit = 100
): Promise<PracticeRecordWithTune[]> {
  const results = await db
    .select({
      // Practice record fields
      id: practiceRecord.id,
      repertoireRef: practiceRecord.repertoireRef,
      tuneRef: practiceRecord.tuneRef,
      practiced: practiceRecord.practiced,
      quality: practiceRecord.quality,
      easiness: practiceRecord.easiness,
      interval: practiceRecord.interval,
      repetitions: practiceRecord.repetitions,
      due: practiceRecord.due,
      backup_practiced: practiceRecord.backupPracticed,
      stability: practiceRecord.stability,
      elapsed_days: practiceRecord.elapsedDays,
      lapses: practiceRecord.lapses,
      state: practiceRecord.state,
      difficulty: practiceRecord.difficulty,
      step: practiceRecord.step,
      goal: practiceRecord.goal,
      technique: practiceRecord.technique,
      syncVersion: practiceRecord.syncVersion,
      lastModifiedAt: practiceRecord.lastModifiedAt,
      deviceId: practiceRecord.deviceId,

      // Tune fields
      tune: {
        id: tune.id,
        idForeign: tune.idForeign,
        primaryOrigin: tune.primaryOrigin,
        title: tune.title,
        type: tune.type,
        mode: tune.mode,
        structure: tune.structure,
        incipit: tune.incipit,
        genre: tune.genre,
        composer: tune.composer,
        artist: tune.artist,
        releaseYear: tune.releaseYear,
        deleted: tune.deleted,
        privateFor: tune.privateFor,
        syncVersion: tune.syncVersion,
        lastModifiedAt: tune.lastModifiedAt,
        deviceId: tune.deviceId,
      },

      // Repertoire name
      repertoireName: repertoire.instrumentRef,
    })
    .from(practiceRecord)
    .innerJoin(tune, eq(tune.id, practiceRecord.tuneRef))
    .innerJoin(
      repertoire,
      eq(repertoire.repertoireId, practiceRecord.repertoireRef)
    )
    .where(eq(practiceRecord.repertoireRef, repertoireId))
    .orderBy(desc(practiceRecord.practiced))
    .limit(limit);

  // Convert null to undefined for repertoireName to match interface
  return results.map((r) => ({
    ...r,
    elapsedDays: r.elapsed_days,
    backupPracticed: r.backup_practiced,
    repertoireName: r.repertoireName ? String(r.repertoireName) : undefined,
  }));
}
