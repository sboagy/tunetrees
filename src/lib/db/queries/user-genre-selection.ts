/**
 * User Genre Selection Queries
 *
 * Database queries for managing which genres users have selected for download/sync.
 *
 * @module lib/db/queries/user-genre-selection
 */

import { eq, inArray, sql } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import { getSqliteInstance } from "../client-sqlite";
import {
  areSyncTriggersSuppressed,
  enableSyncTriggers,
  suppressSyncTriggers,
} from "../install-triggers";
import {
  dailyPracticeQueue,
  genre,
  note,
  repertoireTune as playlistTune,
  practiceRecord,
  reference,
  tableTransientData,
  tag,
  tune,
  tuneOverride,
  userGenreSelection,
} from "../schema";

// ============================================================================
// Types
// ============================================================================

export interface UserGenreSelectionData {
  userId: string;
  genreId: string;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all selected genre IDs for a user
 * @returns Array of genre IDs, or empty array if no selection exists
 */
export async function getUserGenreSelection(
  db: SqliteDatabase,
  userId: string
): Promise<string[]> {
  const results = await db
    .select({ genreId: userGenreSelection.genreId })
    .from(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));

  return results.map((r) => r.genreId);
}

/**
 * Get all genres with selection status for a user
 * @returns Array of genre objects with selected flag
 */
export async function getGenresWithSelection(
  db: SqliteDatabase,
  userId: string
): Promise<
  Array<{
    id: string;
    name: string | null;
    region: string | null;
    description: string | null;
    selected: boolean;
  }>
> {
  const selectedGenreIds = new Set(await getUserGenreSelection(db, userId));

  const allGenres = await db.select().from(genre);

  return allGenres.map((g) => ({
    id: g.id,
    name: g.name,
    region: g.region,
    description: g.description,
    selected: selectedGenreIds.has(g.id),
  }));
}

/**
 * Upsert user genre selection (replace all selections for user with provided genreIds)
 * @param genreIds Array of genre IDs to select (empty array = clear all)
 */
export async function upsertUserGenreSelection(
  db: SqliteDatabase,
  userId: string,
  genreIds: string[]
): Promise<void> {
  const now = new Date().toISOString();

  // Clear existing selections for this user
  await db
    .delete(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));

  // Insert new selections if any provided
  if (genreIds.length > 0) {
    const rows = genreIds.map((genreId) => ({
      userId,
      genreId,
      createdAt: now,
      lastModifiedAt: now,
      syncVersion: 1,
      deviceId: null,
    }));

    // Insert in batches if needed
    for (const row of rows) {
      await db.insert(userGenreSelection).values(row);
    }
  }
}

/**
 * Clear all genre selections for a user (defaults to all genres)
 */
export async function clearUserGenreSelection(
  db: SqliteDatabase,
  userId: string
): Promise<void> {
  await db
    .delete(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));
}

/**
 * Check if user has any genre selection
 * @returns true if user has selected at least one genre, false otherwise
 */
export async function hasUserGenreSelection(
  db: SqliteDatabase,
  userId: string
): Promise<boolean> {
  const result = await db
    .select({ count: userGenreSelection.userId })
    .from(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId))
    .limit(1);

  return result.length > 0;
}

/**
 * Get genres required by the current repertoire (cannot be deselected).
 * Uses tune overrides when available.
 */
export async function getRequiredGenreIdsForUser(
  db: SqliteDatabase,
  userId: string
): Promise<string[]> {
  const [playlistDefaults, tuneGenres] = await Promise.all([
    getPlaylistGenreDefaultsForUser(db, userId),
    getRepertoireTuneGenreIdsForUser(db, userId),
  ]);

  return Array.from(new Set([...playlistDefaults, ...tuneGenres]));
}

/**
 * Get genre_default values from user playlists (repertoires).
 */
export async function getPlaylistGenreDefaultsForUser(
  db: SqliteDatabase,
  userId: string
): Promise<string[]> {
  console.log(
    `[getPlaylistGenreDefaultsForUser] Querying for userId=${userId}`
  );

  const rows = await db.all<{ genre: string | null }>(sql`
    SELECT DISTINCT v.genre_default AS genre
    FROM view_playlist_joined v
    WHERE v.playlist_deleted = 0
      AND v.user_ref = ${userId}
      AND v.genre_default IS NOT NULL
  `);

  console.log(
    `[getPlaylistGenreDefaultsForUser] Found ${rows.length} rows:`,
    rows
  );

  return rows
    .map((row) => row.genre)
    .filter((genreId): genreId is string => !!genreId);
}

/**
 * Get genre IDs referenced by tunes in the user's repertoire.
 */
export async function getRepertoireTuneGenreIdsForUser(
  db: SqliteDatabase,
  userId: string
): Promise<string[]> {
  const rows = await db.all<{ genre: string | null }>(sql`
    SELECT DISTINCT COALESCE(o.genre, t.genre) AS genre
    FROM repertoire_tune pt
    JOIN repertoire p
      ON p.repertoire_id = pt.repertoire_ref AND p.deleted = 0
    JOIN tune t
      ON t.id = pt.tune_ref AND t.deleted = 0
    LEFT JOIN tune_override o
      ON o.tune_ref = t.id
      AND o.user_ref = ${userId}
      AND o.deleted = 0
    WHERE pt.deleted = 0
      AND p.user_ref = ${userId}
  `);

  return rows
    .map((row) => row.genre)
    .filter((genreId): genreId is string => !!genreId);
}

/**
 * Get counts for user playlists and playlist_tune rows.
 */
export async function getUserRepertoireStats(
  db: SqliteDatabase,
  userId: string
): Promise<{ playlistCount: number; playlistTuneCount: number }> {
  const playlistRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM repertoire p
    WHERE p.deleted = 0
      AND p.user_ref = ${userId}
  `);
  const playlistCount = Number(playlistRows?.[0]?.count ?? 0);

  const tuneRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM repertoire_tune pt
    JOIN repertoire p
      ON p.repertoire_id = pt.repertoire_ref AND p.deleted = 0
    WHERE pt.deleted = 0
      AND p.user_ref = ${userId}
  `);
  const playlistTuneCount = Number(tuneRows?.[0]?.count ?? 0);

  return { playlistCount, playlistTuneCount };
}

/**
 * Purge local tunes for deselected genres that are not in the current repertoire.
 * Deletions are local-only (sync triggers suppressed).
 */
export async function purgeLocalCatalogForGenres(
  db: SqliteDatabase,
  userId: string,
  genreIds: string[]
): Promise<{ tuneIds: string[] }> {
  if (genreIds.length === 0) return { tuneIds: [] };

  const escaped = genreIds.map((id) => `'${id.replace(/'/g, "''")}'`);
  const genreList = escaped.join(", ");

  const rows = await db.all<{ id: string }>(sql`
    SELECT DISTINCT t.id AS id
    FROM tune t
    LEFT JOIN tune_override o
      ON o.tune_ref = t.id
      AND o.user_ref = ${userId}
      AND o.deleted = 0
    WHERE t.deleted = 0
      AND COALESCE(o.genre, t.genre) IN (${sql.raw(genreList)})
      AND NOT EXISTS (
        SELECT 1
        FROM repertoire_tune pt
        JOIN repertoire p
          ON p.repertoire_id = pt.repertoire_ref AND p.deleted = 0
        WHERE pt.tune_ref = t.id
          AND pt.deleted = 0
          AND p.user_ref = ${userId}
      )
  `);

  const tuneIds = rows.map((row) => row.id).filter(Boolean);
  if (tuneIds.length === 0) return { tuneIds };

  const sqliteDb = await getSqliteInstance();
  const wasSuppressed = sqliteDb ? areSyncTriggersSuppressed(sqliteDb) : false;
  if (sqliteDb) suppressSyncTriggers(sqliteDb);

  try {
    await db.delete(note).where(inArray(note.tuneRef, tuneIds));
    await db.delete(reference).where(inArray(reference.tuneRef, tuneIds));
    await db.delete(tag).where(inArray(tag.tuneRef, tuneIds));
    await db
      .delete(practiceRecord)
      .where(inArray(practiceRecord.tuneRef, tuneIds));
    await db
      .delete(dailyPracticeQueue)
      .where(inArray(dailyPracticeQueue.tuneRef, tuneIds));
    await db
      .delete(tableTransientData)
      .where(inArray(tableTransientData.tuneId, tuneIds));
    await db.delete(playlistTune).where(inArray(playlistTune.tuneRef, tuneIds));
    await db.delete(tuneOverride).where(inArray(tuneOverride.tuneRef, tuneIds));
    await db.delete(tune).where(inArray(tune.id, tuneIds));
  } finally {
    if (sqliteDb && !wasSuppressed) enableSyncTriggers(sqliteDb);
  }

  return { tuneIds };
}
