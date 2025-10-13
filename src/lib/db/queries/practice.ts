/**
 * Practice Query Functions
 *
 * Client-side queries for practice records, queue, and FSRS scheduling.
 * All functions read from local SQLite WASM (no server calls).
 *
 * Replaces legacy server-side queries:
 * - legacy/tunetrees/app/queries.py#query_practice_list_scheduled
 * - legacy/tunetrees/app/schedule.py (various record fetching)
 *
 * @module lib/db/queries/practice
 */

import { and, desc, eq, sql } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import { playlist, playlistTune, practiceRecord, tune } from "../schema";
import type {
  DailyPracticeQueue,
  PracticeRecord,
  PracticeRecordWithTune,
  PrefsSpacedRepetition,
  Tune,
  TuneSchedulingInfo,
} from "../types";

/**
 * Simplified practice queue entry for getDueTunes()
 */
export interface DueTuneEntry {
  tuneRef: number;
  playlistRef: number;
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
 * Get due tunes for practice session
 *
 * Queries local SQLite to find tunes that need practice based on their
 * next review date. Uses COALESCE(playlist_tune.scheduled, latest_due)
 * to support migration from old to new scheduling system.
 *
 * Replaces: legacy/tunetrees/app/queries.py#query_practice_list_scheduled
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist to query
 * @param sitdownDate - Current practice session date
 * @param delinquencyWindowDays - How many days overdue to include (default 7)
 * @returns Array of due tune entries with tune details and scheduling info
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const dueTunes = await getDueTunes(db, 1, new Date(), 7);
 * // Returns tunes due today or within 7-day delinquency window
 * ```
 */
export async function getDueTunes(
  db: SqliteDatabase,
  playlistId: number,
  sitdownDate: Date,
  delinquencyWindowDays = 7
): Promise<DueTuneEntry[]> {
  // Calculate window boundaries
  const windowStart = new Date(sitdownDate);
  windowStart.setDate(windowStart.getDate() - delinquencyWindowDays);
  const windowEnd = sitdownDate;

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
      scheduled: playlistTune.current, // Next review date (new system)

      // Latest practice record info (from subquery)
      latest_practiced: sql<string | null>`(
        SELECT practiced 
        FROM ${practiceRecord} 
        WHERE ${practiceRecord.tuneRef} = ${tune.id} 
          AND ${practiceRecord.playlistRef} = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_due: sql<string | null>`(
        SELECT due 
        FROM ${practiceRecord} 
        WHERE ${practiceRecord.tuneRef} = ${tune.id} 
          AND ${practiceRecord.playlistRef} = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_stability: sql<number | null>`(
        SELECT stability 
        FROM ${practiceRecord} 
        WHERE ${practiceRecord.tuneRef} = ${tune.id} 
          AND ${practiceRecord.playlistRef} = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_difficulty: sql<number | null>`(
        SELECT difficulty 
        FROM ${practiceRecord} 
        WHERE ${practiceRecord.tuneRef} = ${tune.id} 
          AND ${practiceRecord.playlistRef} = ${playlistId}
        ORDER BY practiced DESC 
        LIMIT 1
      )`,
      latest_state: sql<number | null>`(
        SELECT state 
        FROM ${practiceRecord} 
        WHERE ${practiceRecord.tuneRef} = ${tune.id} 
          AND ${practiceRecord.playlistRef} = ${playlistId}
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
        eq(tune.deleted, 0)
      )
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
  _playlistId: number,
  _queueDate: Date = new Date()
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
  tuneId: number,
  playlistId: number
): Promise<PracticeRecord | null> {
  const results = await db
    .select()
    .from(practiceRecord)
    .where(
      and(
        eq(practiceRecord.tuneRef, tuneId),
        eq(practiceRecord.playlistRef, playlistId)
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
 * **Note:** Currently not functional - userId param expects user_profile.id (INTEGER)
 * but receives Supabase UUID (TEXT). Returns default preferences for now.
 *
 * @param db - SQLite database instance
 * @param userId - User UUID (Supabase)
 * @returns User preferences or null if not set
 */
export async function getUserPreferences(
  _db: SqliteDatabase,
  _userId: string
): Promise<PrefsSpacedRepetition | null> {
  // TODO: Get user_profile.id from Supabase UUID
  // For now, return default FSRS preferences
  return {
    userId: 1, // Placeholder
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
  tuneId: number,
  playlistId: number,
  limit?: number
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
        eq(practiceRecord.playlistRef, playlistId)
      )
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
  playlistId: number,
  limit = 100
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
