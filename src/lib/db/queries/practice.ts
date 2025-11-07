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
import { computeSchedulingWindows } from "../../services/practice-queue";
import { queueSync } from "../../sync";
import { generateId } from "../../utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import {
  dailyPracticeQueue,
  playlist,
  playlistTune,
  practiceRecord,
  tune,
} from "../schema";
import type {
  DailyPracticeQueue,
  PracticeRecord,
  PracticeRecordWithTune,
  PrefsSpacedRepetition,
  Tune,
  TuneSchedulingInfo,
} from "../types";

/**
 * Practice List Staged Row
 *
 * Complete row from practice_list_staged VIEW.
 * This VIEW merges tune + playlist_tune + practice_record (latest) + table_transient_data.
 *
 * Used by practice grid - contains ALL data including staging/preview.
 */
export interface PracticeListStagedRow {
  // Core tune info
  id: string;
  title: string;
  type: string;
  mode: string;
  structure: string | null;
  incipit: string | null;
  genre: string | null;
  private_for: string | null;
  deleted: number;

  // Playlist info
  learned: number | null;
  goal: string;
  scheduled: string | null;
  user_ref: string;
  playlist_id: string;
  instrument: string | null;
  playlist_deleted: number;

  // Latest practice data (COALESCE between transient and historical)
  latest_state: number | null;
  latest_practiced: string | null;
  latest_quality: number | null;
  latest_easiness: number | null;
  latest_difficulty: number | null;
  latest_stability: number | null;
  latest_interval: number | null;
  latest_step: number | null;
  latest_repetitions: number | null;
  latest_due: string | null;
  latest_backup_practiced: string | null;
  latest_goal: string | null;
  latest_technique: string | null;

  // Aggregated data
  tags: string | null;
  notes: string | null;
  favorite_url: string | null;

  // Transient/staging fields
  purpose: string | null;
  note_private: string | null;
  note_public: string | null;
  recall_eval: string | null;

  // Flags
  has_override: number;
  has_staged: number;
}

/**
 * Practice List Staged with Queue Info
 *
 * Extends PracticeListStagedRow with daily_practice_queue fields.
 * This is what the practice grid actually displays.
 */
export interface PracticeListStagedWithQueue extends PracticeListStagedRow {
  // From daily_practice_queue
  bucket: number;
  order_index: number;
  completed_at: string | null;
}

/**
 * DEPRECATED: Old interface - remove after migration
 * @deprecated Use PracticeListStagedWithQueue instead
 */
export interface DueTuneEntry {
  tuneRef: string;
  playlistRef: string;
  title: string | null;
  type: string | null;
  mode: string | null;
  structure: string | null;
  scheduled: string | null;
  latest_practiced: string | null;
  tune: Tune;
  schedulingInfo?: TuneSchedulingInfo;
}

/**
 * Get practice list (with optional queue filtering)
 *
 * Queries practice_list_staged VIEW for complete enriched data.
 * The VIEW contains all COALESCE operations merging transient and historical data.
 *
 * Filters for:
 * - Scheduled tunes (playlist_tune.scheduled IS NOT NULL)
 * - Due for practice (scheduled <= today OR within delinquency window)
 *
 * TODO: Add daily_practice_queue filtering once queue infrastructure is created.
 *
 * Replaces: legacy/tunetrees/app/queries.py#query_practice_list_scheduled
 *
 * @param db - SQLite database instance
 * @param userId - User ID
 * @param playlistId - Playlist to query
 * @param delinquencyWindowDays - How many days overdue to include (default 7)
 * @returns Array of practice list rows for scheduled/due tunes
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const practices = await getPracticeList(db, 1, 5, 7);
 * // Returns scheduled tunes due today or within 7-day window
 * ```
 */
/**
 * Get practice list filtered by daily practice queue
 *
 * Queries practice_list_staged VIEW JOINed with daily_practice_queue.
 * The queue provides the frozen snapshot of which tunes to practice today.
 *
 * Returns tunes in queue order (bucket, order_index) with completed_at tracking.
 *
 * @param db - SQLite database instance
 * @param userId - User ID (from user_profile.id)
 * @param playlistId - Playlist to query
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
  playlistId: string,
  _delinquencyWindowDays: number = 7, // Kept for API compatibility
): Promise<PracticeListStagedWithQueue[]> {
  // Query practice_list_staged INNER JOIN daily_practice_queue
  // Queue determines which tunes to practice and their ordering

  // Debug: Check queue rows
  const queueRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM daily_practice_queue dpq
    WHERE dpq.user_ref = ${userId}
      AND dpq.playlist_ref = ${playlistId}
      AND dpq.active = 1
  `);
  console.log(
    `[getPracticeList] Queue has ${
      queueRows[0]?.count || 0
    } active rows for user=${userId}, playlist=${playlistId}`,
  );

  // Debug: Check view rows
  const viewRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM practice_list_staged pls
    WHERE pls.user_ref = ${userId}
      AND pls.playlist_id = ${playlistId}
  `);
  console.log(
    `[getPracticeList] View has ${
      viewRows[0]?.count || 0
    } rows for user=${userId}, playlist=${playlistId}`,
  );

  // Select from the MOST RECENT active queue snapshot rather than relying on DATE('now')
  // This avoids timezone edge-cases and ensures we always show the latest generated queue
  const rows = await db.all<PracticeListStagedWithQueue>(sql`
    SELECT 
      pls.*,
      dpq.bucket,
      dpq.order_index,
      dpq.completed_at
    FROM practice_list_staged pls
    INNER JOIN daily_practice_queue dpq 
      ON dpq.tune_ref = pls.id
      AND dpq.user_ref = pls.user_ref
      AND dpq.playlist_ref = pls.playlist_id
    WHERE dpq.user_ref = ${userId}
      AND dpq.playlist_ref = ${playlistId}
      AND dpq.active = 1
      AND dpq.window_start_utc = (
        SELECT MAX(window_start_utc)
        FROM daily_practice_queue
        WHERE user_ref = ${userId}
          AND playlist_ref = ${playlistId}
          AND active = 1
      )
    ORDER BY dpq.bucket ASC, dpq.order_index ASC
  `);

  console.log(`[getPracticeList] JOIN returned ${rows.length} rows`);

  return rows;
}

/**
 * DEPRECATED: Use getPracticeList instead
 * Keeping for backward compatibility during migration
 */
export async function getDueTunes(
  db: SqliteDatabase,
  userId: string,
  playlistId: string,
  delinquencyWindowDays: number = 7,
): Promise<PracticeListStagedWithQueue[]> {
  return getPracticeList(db, userId, playlistId, delinquencyWindowDays);
}

/**
 * DEPRECATED: Old implementation with manual JOINs
 * Keeping signature for backward compatibility during migration
 * @deprecated
 */
export async function getDueTunesLegacy(
  db: SqliteDatabase,
  playlistId: string,
  sitdownDate: Date,
  delinquencyWindowDays = 7,
): Promise<DueTuneEntry[]> {
  // Calculate window boundaries
  const windowStart = new Date(sitdownDate);
  windowStart.setDate(windowStart.getDate() - delinquencyWindowDays);
  const windowEnd = new Date(sitdownDate);
  // Add 1 minute buffer to windowEnd to account for timing issues when tunes are added "now"
  windowEnd.setMinutes(windowEnd.getMinutes() + 1);

  // Query practice_list_joined view or build joined query
  // This gets all tunes in the playlist with their latest practice info
  const results = await db
    .select({
      // Tune info
      tuneRef: tune.id,
      title: tune.title,
      type: tune.type,
      mode: tune.mode,
      structure: tune.structure,
      genre: tune.genre,
      incipit: tune.incipit,
      deleted: tune.deleted,
      privateFor: tune.privateFor,
      syncVersion: tune.syncVersion,
      lastModifiedAt: tune.lastModifiedAt,
      deviceId: tune.deviceId,

      // Playlist tune info
      playlistRef: playlistTune.playlistRef,
      scheduled: playlistTune.scheduled, // Next review date for "Add To Review"

      // Latest practice record info (from subquery)
      latest_practiced: sql<string | null>`(
        SELECT practiced 
        FROM practice_record
        WHERE tune_ref = ${tune.id} 
          AND playlist_ref = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_due: sql<string | null>`(
        SELECT due 
        FROM practice_record
        WHERE tune_ref = ${tune.id} 
          AND playlist_ref = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_stability: sql<number | null>`(
        SELECT stability 
        FROM practice_record
        WHERE tune_ref = ${tune.id} 
          AND playlist_ref = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_difficulty: sql<number | null>`(
        SELECT difficulty 
        FROM practice_record
        WHERE tune_ref = ${tune.id} 
          AND playlist_ref = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_state: sql<number | null>`(
        SELECT state 
        FROM practice_record
        WHERE tune_ref = ${tune.id} 
          AND playlist_ref = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
    })
    .from(tune)
    .innerJoin(playlistTune, eq(playlistTune.tuneRef, tune.id))
    .where(
      and(
        eq(playlistTune.playlistRef, playlistId),
        eq(playlistTune.deleted, 0),
        eq(tune.deleted, 0),
      ),
    );

  // Filter for due tunes and enrich with scheduling info
  const dueTunes: DueTuneEntry[] = [];

  for (const row of results) {
    // Use scheduled if available, otherwise fall back to latest_due
    const nextReview = row.scheduled || row.latest_due;

    if (!nextReview) {
      // New tune never practiced - include it
      dueTunes.push({
        tuneRef: row.tuneRef,
        playlistRef: row.playlistRef,
        title: row.title,
        type: row.type,
        mode: row.mode,
        structure: row.structure,
        scheduled: null,
        latest_practiced: row.latest_practiced,
        tune: {
          id: row.tuneRef,
          idForeign: null, // Not available in practice_list_staged view
          primaryOrigin: null, // Not available in practice_list_staged view
          title: row.title,
          type: row.type,
          mode: row.mode,
          structure: row.structure,
          genre: row.genre,
          incipit: row.incipit,
          deleted: row.deleted,
          privateFor: row.privateFor,
          syncVersion: row.syncVersion,
          lastModifiedAt: row.lastModifiedAt,
          deviceId: row.deviceId,
        },
        schedulingInfo: {
          stability: row.latest_stability,
          difficulty: row.latest_difficulty,
          elapsed_days: null,
          state: row.latest_state ?? 0, // 0 = New
          due: null,
          repetitions: null,
          lapses: null,
        },
      });
      continue;
    }

    // Check if due within window
    const nextReviewDate = new Date(nextReview);
    if (nextReviewDate <= windowEnd && nextReviewDate >= windowStart) {
      dueTunes.push({
        tuneRef: row.tuneRef,
        playlistRef: row.playlistRef,
        title: row.title,
        type: row.type,
        mode: row.mode,
        structure: row.structure,
        scheduled: nextReview,
        latest_practiced: row.latest_practiced,
        tune: {
          id: row.tuneRef,
          idForeign: null, // Not available in practice_list_staged view
          primaryOrigin: null, // Not available in practice_list_staged view
          title: row.title,
          type: row.type,
          mode: row.mode,
          structure: row.structure,
          genre: row.genre,
          incipit: row.incipit,
          deleted: row.deleted,
          privateFor: row.privateFor,
          syncVersion: row.syncVersion,
          lastModifiedAt: row.lastModifiedAt,
          deviceId: row.deviceId,
        },
        schedulingInfo: {
          stability: row.latest_stability,
          difficulty: row.latest_difficulty,
          elapsed_days: null,
          state: row.latest_state ?? 2, // 2 = Review
          due: nextReview,
          repetitions: null,
          lapses: null,
        },
      });
    }
  }

  // Sort by next review date (oldest first)
  dueTunes.sort((a, b) => {
    const aDate = a.schedulingInfo?.due
      ? new Date(a.schedulingInfo.due).getTime()
      : 0;
    const bDate = b.schedulingInfo?.due
      ? new Date(b.schedulingInfo.due).getTime()
      : 0;
    return aDate - bDate;
  });

  return dueTunes;
}

/**
 * Get daily practice queue snapshot
 *
 * Retrieves the frozen daily practice queue for a specific date.
 * This is the pre-generated, stable queue that doesn't change
 * as the user practices during the day.
 *
 * **Note:** Currently not functional - userId param expects user_profile.id (INTEGER)
 * but receives Supabase UUID (TEXT). Need to add user_profile lookup first.
 *
 * @param db - SQLite database instance
 * @param userId - User UUID (Supabase)
 * @param playlistId - Playlist ID
 * @param queueDate - Date for the queue (defaults to today)
 * @returns Array of daily practice queue entries
 */
export async function getDailyPracticeQueue(
  _db: SqliteDatabase,
  _userId: string,
  _playlistId: string,
  _queueDate: Date = new Date(),
): Promise<DailyPracticeQueue[]> {
  // TODO: Get user_profile.id from Supabase UUID
  // For now, return empty array
  console.warn("getDailyPracticeQueue: User ID lookup not implemented");
  return [];

  /* Original implementation - requires user_profile.id lookup
  const windowStart = new Date(queueDate);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(queueDate);
  windowEnd.setHours(23, 59, 59, 999);

  const results = await db
    .select()
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userId),
        eq(dailyPracticeQueue.playlistRef, playlistId),
        eq(dailyPracticeQueue.active, 1),
        gte(dailyPracticeQueue.windowStartUtc, windowStart.toISOString()),
        lte(dailyPracticeQueue.windowEndUtc, windowEnd.toISOString())
      )
    )
    .orderBy(dailyPracticeQueue.bucket, dailyPracticeQueue.orderIndex);

  return results;
  */
}

/**
 * Get latest practice record for a tune
 *
 * Used by FSRS service to retrieve practice history when calculating
 * next review dates.
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param playlistId - Playlist ID
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
  playlistId: string,
): Promise<PracticeRecord | null> {
  const results = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.playlistRef, playlistId),
      ),
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
 * **Note:** Currently not functional - userId param expects user_profile.id (INTEGER)
 * but receives Supabase UUID (TEXT). Returns default preferences for now.
 *
 * @param db - SQLite database instance
 * @param userId - User UUID (Supabase)
 * @returns User preferences or null if not set
 */
export async function getUserPreferences(
  _db: SqliteDatabase,
  _userId: string,
): Promise<PrefsSpacedRepetition | null> {
  // TODO: Get user_profile.id from Supabase UUID
  // For now, return default FSRS preferences
  return {
    userId: _userId, // Use the UUID directly
    algType: "FSRS",
    fsrsWeights: null,
    requestRetention: 0.9,
    maximumInterval: 36500,
    learningSteps: null,
    relearningSteps: null,
    enableFuzzing: 1, // SQLite stores as INTEGER
    syncVersion: 0,
    lastModifiedAt: new Date().toISOString(),
    deviceId: null,
  };

  /* Original implementation - requires user_profile.id lookup
  const results = await db
    .select()
    .from(prefsSpacedRepetition)
    .where(eq(prefsSpacedRepetition.userId, userId))
    .limit(1);

  return results[0] ?? null;
  */
}

/**
 * Get practice history for a tune
 *
 * Retrieves all practice records for a tune, ordered by most recent first.
 * Used for practice history view.
 *
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param playlistId - Playlist ID
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
  playlistId: string,
  limit?: number,
): Promise<PracticeRecordWithTune[]> {
  let query = db
    .select({
      // Practice record fields
      id: practiceRecord.id,
      playlistRef: practiceRecord.playlistRef,
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
        deleted: tune.deleted,
        privateFor: tune.privateFor,
        syncVersion: tune.syncVersion,
        lastModifiedAt: tune.lastModifiedAt,
        deviceId: tune.deviceId,
      },

      // Playlist name
      playlistName: playlist.instrumentRef,
    })
    .from(practiceRecord)
    .innerJoin(tune, eq(tune.id, practiceRecord.tuneRef))
    .innerJoin(playlist, eq(playlist.playlistId, practiceRecord.playlistRef))
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.playlistRef, playlistId),
      ),
    )
    .orderBy(desc(practiceRecord.practiced));

  if (limit) {
    query = query.limit(limit) as typeof query;
  }

  const results = await query;

  // Convert null to undefined for playlistName to match interface
  return results.map((r) => ({
    ...r,
    elapsedDays: r.elapsed_days,
    backupPracticed: r.backup_practiced,
    playlistName: r.playlistName ? String(r.playlistName) : undefined,
  }));
}

/**
 * Add tunes to practice queue ("Add To Review" from Repertoire)
 *
 * For selected repertoire tunes, this function:
 * 1. Sets the scheduled date to now (makes them immediately available for practice)
 * 2. Creates initial practice records if they don't exist
 *
 * This is the client-side equivalent of the legacy Python function:
 * `add_tunes_to_practice_queue` in tunetrees/app/queries.py
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
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
  playlistId: string,
  tuneIds: string[],
): Promise<{ added: number; skipped: number; tuneIds: string[] }> {
  const now = new Date().toISOString();
  let added = 0;
  let skipped = 0;
  const addedTuneIds: string[] = [];

  for (const tuneId of tuneIds) {
    try {
      // Update playlist_tune.scheduled to make tune immediately available
      const result = await db
        .update(playlistTune)
        .set({
          scheduled: now,
          syncVersion: sql.raw(`sync_version + 1`),
          lastModifiedAt: now,
        })
        .where(
          and(
            eq(playlistTune.playlistRef, playlistId),
            eq(playlistTune.tuneRef, tuneId),
            eq(playlistTune.deleted, 0),
          ),
        )
        .returning();

      if (result && result.length > 0) {
        added++;
        addedTuneIds.push(tuneId);

        // Queue playlist_tune update for sync
        await queueSync(db, "playlist_tune", "update", result[0]);

        // Check if practice record exists
        const existing = await db
          .select()
          .from(practiceRecord)
          .where(
            and(
              eq(practiceRecord.playlistRef, playlistId),
              eq(practiceRecord.tuneRef, tuneId),
            ),
          )
          .limit(1);

        // If no practice record exists, create an initial one (state=0, New)
        if (!existing || existing.length === 0) {
          const newRecord = await db
            .insert(practiceRecord)
            .values({
              id: generateId(),
              playlistRef: playlistId,
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
            })
            .returning();

          // Queue practice_record insert for sync
          if (newRecord && newRecord.length > 0) {
            await queueSync(db, "practice_record", "insert", newRecord[0]);
          }
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error adding tune ${tuneId} to practice queue:`, error);
      skipped++;
    }
  }

  // Force regenerate the practice queue to pick up newly scheduled tunes
  // CRITICAL: The practice grid uses forceRegen=false, so we must clear the existing queue
  // to ensure new tunes appear immediately in the practice tab when incrementSyncVersion() is called
  if (added > 0) {
    try {
      // Get userRef from playlist
      const playlistData = await db
        .select({ userRef: playlist.userRef })
        .from(playlist)
        .where(eq(playlist.playlistId, playlistId))
        .limit(1);

      if (playlistData && playlistData.length > 0) {
        const userRef = playlistData[0].userRef;
        const windows = computeSchedulingWindows(new Date(), 7, null);
        const queueDate = windows.startTs.split("T")[0]; // YYYY-MM-DD

        // Delete today's existing queue to force regeneration
        await db
          .delete(dailyPracticeQueue)
          .where(
            and(
              eq(dailyPracticeQueue.userRef, userRef),
              eq(dailyPracticeQueue.playlistRef, playlistId),
              eq(dailyPracticeQueue.queueDate, queueDate),
            ),
          );

        console.log(
          `[addTunesToPracticeQueue] Cleared existing queue for ${queueDate} to force regeneration of ${added} new tunes`,
        );
      }
    } catch (error) {
      console.error("[addTunesToPracticeQueue] Failed to clear queue:", error);
      // Don't fail the entire operation if queue clearing fails
    }
  }

  return { added, skipped, tuneIds: addedTuneIds };
}

/**
 * Get all practice records for a playlist
 *
 * Retrieves practice history for all tunes in a playlist.
 * Useful for analytics and progress tracking.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param limit - Maximum number of records to return
 * @returns Array of practice records with tune information
 *
 * @example
 * ```typescript
 * const recent = await getPracticeRecords(db, 1, 100);
 * // Returns last 100 practice sessions for playlist
 * ```
 */
export async function getPracticeRecords(
  db: SqliteDatabase,
  playlistId: string,
  limit = 100,
): Promise<PracticeRecordWithTune[]> {
  const results = await db
    .select({
      // Practice record fields
      id: practiceRecord.id,
      playlistRef: practiceRecord.playlistRef,
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
        deleted: tune.deleted,
        privateFor: tune.privateFor,
        syncVersion: tune.syncVersion,
        lastModifiedAt: tune.lastModifiedAt,
        deviceId: tune.deviceId,
      },

      // Playlist name
      playlistName: playlist.instrumentRef,
    })
    .from(practiceRecord)
    .innerJoin(tune, eq(tune.id, practiceRecord.tuneRef))
    .innerJoin(playlist, eq(playlist.playlistId, practiceRecord.playlistRef))
    .where(eq(practiceRecord.playlistRef, playlistId))
    .orderBy(desc(practiceRecord.practiced))
    .limit(limit);

  // Convert null to undefined for playlistName to match interface
  return results.map((r) => ({
    ...r,
    elapsedDays: r.elapsed_days,
    backupPracticed: r.backup_practiced,
    playlistName: r.playlistName ? String(r.playlistName) : undefined,
  }));
}
