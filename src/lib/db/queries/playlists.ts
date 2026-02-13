/**
 * Playlist CRUD Queries
 *
 * Database queries for playlist management operations.
 * All operations use local SQLite WASM with background sync to Supabase.
 *
 * Core Operations:
 * - getUserPlaylists: Get all playlists for a user
 * - getPlaylistById: Get playlist by ID
 * - createPlaylist: Create new playlist
 * - updatePlaylist: Update existing playlist
 * - deletePlaylist: Soft delete playlist
 * - addTuneToPlaylist: Add tune to playlist
 * - removeTuneFromPlaylist: Remove tune from playlist
 * - getPlaylistTunes: Get all tunes in a playlist
 *
 * @module lib/db/queries/playlists
 */

import { and, eq, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { persistDb } from "../client-sqlite";
import {
  instrument,
  repertoire as playlist,
  repertoireTune as playlistTune,
  tune,
  userProfile,
} from "../schema";
import type {
  NewPlaylist,
  NewPlaylistTune,
  Playlist,
  PlaylistTune,
  PlaylistWithSummary,
} from "../types";

const userRefCache = new Map<string, string>();

async function resolveUserRef(
  db: SqliteDatabase,
  userId: string,
  options?: { waitForMs?: number; pollEveryMs?: number }
): Promise<string | null> {
  const cached = userRefCache.get(userId);
  if (cached) return cached;

  const waitForMs = options?.waitForMs ?? 0;
  const pollEveryMs = options?.pollEveryMs ?? 100;
  const startedAt = Date.now();

  // On first login, the UI can query before initial syncDown has applied user_profile.
  // Poll briefly to avoid treating this transient state as “no playlists”.
  // After eliminating user_profile.id, we just verify the row exists and return userId.
  while (true) {
    const match = await db
      .select({
        id: userProfile.id,
      })
      .from(userProfile)
      .where(eq(userProfile.id, userId))
      .limit(1);

    if (match.length > 0) {
      // userId IS user_profile.id (PK)
      userRefCache.set(userId, userId);
      return userId;
    }

    if (Date.now() - startedAt >= waitForMs) {
      return null;
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), pollEveryMs);
    });
  }
}

/**
 * Get all playlists for a user
 *
 * Returns playlists ordered by creation date (newest first).
 * Includes tune count for each playlist.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @param includeDeleted - Whether to include soft-deleted playlists (default: false)
 * @returns Array of playlists with summary data
 *
 * @example
 * ```typescript
 * const playlists = await getUserPlaylists(db, 'user-uuid');
 * console.log(`User has ${playlists.length} playlists`);
 * ```
 */
export async function getUserPlaylists(
  db: SqliteDatabase,
  userId: string,
  includeDeleted = false
): Promise<PlaylistWithSummary[]> {
  const userRef = await resolveUserRef(db, userId, {
    waitForMs: 2_000,
    pollEveryMs: 100,
  });

  if (!userRef) {
    console.log(
      `⚠️ User profile not found yet for ${userId}, returning empty playlists`
    );
    return [];
  }

  // Build query conditions
  const conditions = [eq(playlist.userRef, userRef)];
  if (!includeDeleted) {
    conditions.push(eq(playlist.deleted, 0));
  }

  // Get playlists with tune count and instrument names
  // Uses logic similar to view_playlist_joined to resolve genre_default from instrument if needed
  const playlists = await db
    .select({
      playlistId: playlist.repertoireId,
      userRef: playlist.userRef,
      name: playlist.name,
      instrumentRef: playlist.instrumentRef,
      instrumentName: instrument.instrument,
      // Select both genre columns for post-query resolution
      playlistGenre: playlist.genreDefault,
      instrumentGenre: instrument.genreDefault,
      srAlgType: playlist.srAlgType,
      deleted: playlist.deleted,
      syncVersion: playlist.syncVersion,
      lastModifiedAt: playlist.lastModifiedAt,
      deviceId: playlist.deviceId,
      tuneCount: sql<number>`(
        SELECT COUNT(*)
        FROM repertoire_tune
        WHERE repertoire_ref = ${playlist.repertoireId}
          AND deleted = 0
      )`,
    })
    .from(playlist)
    .leftJoin(instrument, eq(playlist.instrumentRef, instrument.id))
    .where(and(...conditions))
    .orderBy(playlist.lastModifiedAt);

  // Debug logs removed for cleanliness

  return playlists.map((p) => ({
    ...p,
    // Resolve genre: use playlist's genreDefault if set, otherwise use instrument's genreDefault
    genreDefault: p.playlistGenre ?? p.instrumentGenre,
    tuneCount: Number(p.tuneCount) || 0,
    instrumentName: p.instrumentName || undefined, // Convert null to undefined
    // Remove the temporary fields from the result
    playlistGenre: undefined,
    instrumentGenre: undefined,
  }));
}

/**
 * Get playlist by ID
 *
 * Returns null if playlist not found or belongs to different user.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Playlist or null
 *
 * @example
 * ```typescript
 * const playlist = await getPlaylistById(db, 'playlist-uuid', 'user-uuid');
 * if (!playlist) {
 *   console.log('Playlist not found or access denied');
 * }
 * ```
 */
export async function getPlaylistById(
  db: SqliteDatabase,
  playlistId: string,
  userId: string
): Promise<Playlist | null> {
  // userId is already user_profile.id (Supabase Auth UUID)
  const userRef = userId;

  const result = await db
    .select()
    .from(playlist)
    .where(
      and(eq(playlist.repertoireId, playlistId), eq(playlist.userRef, userRef))
    )
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Create new playlist
 *
 * Creates playlist and queues for background sync to Supabase.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @param data - Playlist data
 * @returns Created playlist
 *
 * @example
 * ```typescript
 * const newPlaylist = await createPlaylist(db, 'user-uuid', {
 *   name: 'My Irish Tunes',
 *   genreDefault: 'ITRAD',
 *   srAlgType: 'fsrs',
 * });
 * console.log(`Created playlist ${newPlaylist.playlistId}`);
 * ```
 */
export async function createPlaylist(
  db: SqliteDatabase,
  userId: string,
  data: Omit<
    NewPlaylist,
    "playlistId" | "userRef" | "syncVersion" | "lastModifiedAt" | "deviceId"
  >
): Promise<Playlist> {
  // userId is already user_profile.id (Supabase Auth UUID)
  const userRef = userId;
  const now = new Date().toISOString();

  const newPlaylist: NewPlaylist = {
    playlistId: generateId(),
    userRef,
    name: data.name ?? null,
    genreDefault: data.genreDefault ?? null,
    instrumentRef: data.instrumentRef ?? null,
    srAlgType: data.srAlgType ?? null,
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: "local", // TODO: Get actual device ID
  };

  const result = await db.insert(playlist).values(newPlaylist).returning();

  if (!result || result.length === 0) {
    throw new Error("Failed to create playlist");
  }

  const created = result[0];

  // Sync is handled automatically by SQL triggers populating sync_outbox

  // Persist to IndexedDB
  await persistDb();

  return created;
}

/**
 * Update existing playlist
 *
 * Updates playlist and queues for background sync.
 * Only updates fields that are provided in the data object.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @param data - Partial playlist data to update
 * @returns Updated playlist or null if not found
 *
 * @example
 * ```typescript
 * const updated = await updatePlaylist(db, 'playlist-uuid', 'user-uuid', {
 *   srAlgType: 'sm2',
 * });
 * ```
 */
export async function updatePlaylist(
  db: SqliteDatabase,
  playlistId: string,
  userId: string,
  data: Partial<Omit<NewPlaylist, "userRef" | "id">>
): Promise<Playlist | null> {
  // Verify ownership
  const existing = await getPlaylistById(db, playlistId, userId);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();

  const updateData = {
    ...data,
    syncVersion: (existing.syncVersion || 0) + 1,
    lastModifiedAt: now,
  };

  const result = await db
    .update(playlist)
    .set(updateData)
    .where(eq(playlist.repertoireId, playlistId))
    .returning();

  if (!result || result.length === 0) {
    return null;
  }

  const updated = result[0];

  // Sync is handled automatically by SQL triggers populating sync_outbox

  // Persist to IndexedDB
  await persistDb();

  return updated;
}

/**
 * Delete playlist (soft delete)
 *
 * Marks playlist as deleted. Also soft-deletes all playlist_tune associations.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns True if deleted, false if not found
 *
 * @example
 * ```typescript
 * const deleted = await deletePlaylist(db, 'playlist-uuid', 'user-uuid');
 * if (deleted) {
 *   console.log('Playlist deleted');
 * }
 * ```
 */
export async function deletePlaylist(
  db: SqliteDatabase,
  playlistId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const existing = await getPlaylistById(db, playlistId, userId);
  if (!existing) {
    return false;
  }

  const now = new Date().toISOString();

  // Soft delete the playlist
  await db
    .update(playlist)
    .set({
      deleted: 1,
      syncVersion: (existing.syncVersion || 0) + 1,
      lastModifiedAt: now,
    })
    .where(eq(playlist.repertoireId, playlistId));

  // Soft delete all playlist-tune associations
  await db
    .update(playlistTune)
    .set({
      deleted: 1,
      syncVersion: sql.raw(`${playlistTune.syncVersion.name} + 1`),
      lastModifiedAt: now,
    })
    .where(eq(playlistTune.repertoireRef, playlistId));

  // Sync is handled automatically by SQL triggers populating sync_outbox

  // Persist to IndexedDB
  await persistDb();

  return true;
}

/**
 * Add tune to playlist
 *
 * Creates playlist_tune association.
 * Initializes scheduling fields (current, learned, scheduled, goal).
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param tuneId - Tune ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Created playlist-tune association
 *
 * @example
 * ```typescript
 * const association = await addTuneToPlaylist(db, 'playlist-uuid', 'tune-uuid', 'user-uuid');
 * console.log(`Added tune ${tuneId} to playlist ${playlistId}`);
 * ```
 */
export async function addTuneToPlaylist(
  db: SqliteDatabase,
  playlistId: string,
  tuneId: string,
  userId: string
): Promise<PlaylistTune> {
  // Verify playlist ownership
  const playlistRecord = await getPlaylistById(db, playlistId, userId);
  if (!playlistRecord) {
    throw new Error("Playlist not found or access denied");
  }

  // Check if association already exists
  const existing = await db
    .select()
    .from(playlistTune)
    .where(
      and(
        eq(playlistTune.repertoireRef, playlistId),
        eq(playlistTune.tuneRef, tuneId)
      )
    )
    .limit(1);

  if (existing && existing.length > 0) {
    // If it was soft-deleted, undelete it
    if (existing[0].deleted === 1) {
      const now = new Date().toISOString();
      const result = await db
        .update(playlistTune)
        .set({
          deleted: 0,
          syncVersion: (existing[0].syncVersion || 0) + 1,
          lastModifiedAt: now,
        })
        .where(
          and(
            eq(playlistTune.repertoireRef, playlistId),
            eq(playlistTune.tuneRef, tuneId)
          )
        )
        .returning();

      return result[0];
    }

    // Already exists and not deleted
    return existing[0];
  }

  // Create new association
  const now = new Date().toISOString();
  const newAssociation: NewPlaylistTune = {
    repertoireRef: playlistId,
    tuneRef: tuneId,
    current: null,
    learned: null,
    scheduled: now, // Schedule for immediate practice
    goal: "recall",
    deleted: 0,
    syncVersion: 1,
    lastModifiedAt: now,
    deviceId: "local",
  };

  const result = await db
    .insert(playlistTune)
    .values(newAssociation)
    .returning();

  if (!result || result.length === 0) {
    throw new Error("Failed to add tune to playlist");
  }

  // Sync is handled automatically by SQL triggers populating sync_outbox

  return result[0];
}

/**
 * Remove tune from playlist (soft delete)
 *
 * Marks playlist_tune association as deleted.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param tuneId - Tune ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns True if removed, false if not found
 *
 * @example
 * ```typescript
 * const removed = await removeTuneFromPlaylist(db, 'playlist-uuid', 'tune-uuid', 'user-uuid');
 * if (removed) {
 *   console.log('Tune removed from playlist');
 * }
 * ```
 */
export async function removeTuneFromPlaylist(
  db: SqliteDatabase,
  playlistId: string,
  tuneId: string,
  userId: string
): Promise<boolean> {
  // Verify playlist ownership
  const playlistRecord = await getPlaylistById(db, playlistId, userId);
  if (!playlistRecord) {
    return false;
  }

  const now = new Date().toISOString();

  const result = await db
    .update(playlistTune)
    .set({
      deleted: 1,
      syncVersion: sql.raw(`${playlistTune.syncVersion.name} + 1`),
      lastModifiedAt: now,
    })
    .where(
      and(
        eq(playlistTune.repertoireRef, playlistId),
        eq(playlistTune.tuneRef, tuneId)
      )
    )
    .returning();

  if (!result || result.length === 0) {
    return false;
  }

  // Queue for sync
  // await queueSync(db, 'playlist_tune', `${playlistId}-${tuneId}`, 'update');

  return true;
}

/**
 * Get all tunes in a playlist
 *
 * Returns tunes with their full details, excluding soft-deleted tunes.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Array of tunes with playlist-specific data
 *
 * @example
 * ```typescript
 * const tunes = await getPlaylistTunes(db, 'playlist-uuid', 'user-uuid');
 * console.log(`Playlist has ${tunes.length} tunes`);
 * ```
 */
export async function getPlaylistTunes(
  db: SqliteDatabase,
  playlistId: string,
  userId: string
) {
  // Verify playlist ownership
  const playlistRecord = await getPlaylistById(db, playlistId, userId);
  if (!playlistRecord) {
    throw new Error("Playlist not found or access denied");
  }

  const result = await db
    .select({
      // PlaylistTune fields
      playlistRef: playlistTune.repertoireRef,
      tuneRef: playlistTune.tuneRef,
      current: playlistTune.current,
      learned: playlistTune.learned,
      scheduled: playlistTune.scheduled,
      goal: playlistTune.goal,

      // Tune fields
      tuneId: tune.id,
      title: tune.title,
      composer: tune.composer,
      artist: tune.artist,
      idForeign: tune.idForeign,
      releaseYear: tune.releaseYear,
      type: tune.type,
      mode: tune.mode,
      structure: tune.structure,
      incipit: tune.incipit,
      genre: tune.genre,
    })
    .from(playlistTune)
    .innerJoin(tune, eq(playlistTune.tuneRef, tune.id))
    .where(
      and(
        eq(playlistTune.repertoireRef, playlistId),
        eq(playlistTune.deleted, 0),
        eq(tune.deleted, 0)
      )
    )
    .orderBy(tune.title);

  return result.map((row) => ({
    playlistRef: row.playlistRef,
    tuneRef: row.tuneRef,
    current: row.current,
    learned: row.learned,
    scheduled: row.scheduled,
    goal: row.goal,
    tune: {
      id: row.tuneId,
      title: row.title,
      composer: row.composer,
      artist: row.artist,
      idForeign: row.idForeign,
      releaseYear: row.releaseYear,
      type: row.type,
      mode: row.mode,
      structure: row.structure,
      incipit: row.incipit,
      genre: row.genre,
    },
  }));
}

/**
 * Get tunes from practice_list_staged view for a playlist
 *
 * Returns comprehensive tune data including practice records and staging data.
 * This is the proper data source for the Repertoire tab.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Array of tune overview records from practice_list_staged view
 *
 * @example
 * ```typescript
 * const tunes = await getPlaylistTunesStaged(db, 'playlist-uuid', 'user-uuid');
 * console.log(`Repertoire has ${tunes.length} tunes`);
 * ```
 */
export async function getPlaylistTunesStaged(
  db: SqliteDatabase,
  playlistId: string,
  userId: string
) {
  // Verify playlist ownership
  const playlistRecord = await getPlaylistById(db, playlistId, userId);
  if (!playlistRecord) {
    throw new Error("Playlist not found or access denied");
  }

  // userId is already user_profile.id (Supabase Auth UUID)
  const userRef = userId;

  // Query the practice_list_staged view directly
  const result = await db.all<any>(sql`
    SELECT * FROM practice_list_staged
    WHERE repertoire_id = ${playlistId}
      AND user_ref = ${userRef}
      AND deleted = 0
      AND playlist_deleted = 0
    ORDER BY title
  `);
  console.log(
    `[getPlaylistTunesStaged] Found ${result.length} tunes for playlist ${playlistId}`
  );

  return result;
}

/**
 * Add multiple tunes to playlist
 *
 * Batch version of addTuneToPlaylist for adding multiple tunes at once.
 * Useful for "Add To Repertoire" button on Catalog tab.
 *
 * @param db - SQLite database instance
 * @param playlistId - Playlist ID
 * @param tuneIds - Array of tune IDs to add
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Object with counts of added and skipped tunes
 *
 * @example
 * ```typescript
 * const result = await addTunesToPlaylist(db, 'playlist-uuid', ['tune1', 'tune2', 'tune3'], 'user-uuid');
 * console.log(`Added ${result.added} tunes, skipped ${result.skipped} (already in playlist)`);
 * ```
 */
export async function addTunesToPlaylist(
  db: SqliteDatabase,
  playlistId: string,
  tuneIds: string[],
  userId: string
): Promise<{ added: number; skipped: number; tuneIds: string[] }> {
  // Verify playlist ownership
  const playlistRecord = await getPlaylistById(db, playlistId, userId);
  if (!playlistRecord) {
    throw new Error("Playlist not found or access denied");
  }

  let added = 0;
  let skipped = 0;
  const addedTuneIds: string[] = [];

  for (const tuneId of tuneIds) {
    try {
      // Check if already exists
      const existing = await db
        .select()
        .from(playlistTune)
        .where(
          and(
            eq(playlistTune.repertoireRef, playlistId),
            eq(playlistTune.tuneRef, tuneId)
          )
        )
        .limit(1);

      if (existing && existing.length > 0 && existing[0].deleted === 0) {
        // Already in playlist and not deleted
        skipped++;
        continue;
      }

      // Add the tune (or undelete if it was deleted)
      await addTuneToPlaylist(db, playlistId, tuneId, userId);
      added++;
      addedTuneIds.push(tuneId);
    } catch (error) {
      console.error(`Error adding tune ${tuneId} to playlist:`, error);
      skipped++;
    }
  }

  return { added, skipped, tuneIds: addedTuneIds };
}
