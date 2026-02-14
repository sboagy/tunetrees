/**
 * Playlist Service
 *
 * Business logic for playlist management.
 * Handles default playlist creation and playlist-related operations.
 *
 * @module lib/services/playlist-service
 */

import type { SqliteDatabase } from "../db/client-sqlite";
import { createPlaylist, getUserPlaylists } from "../db/queries/playlists";
import type { Playlist } from "../db/types";

/**
 * Ensure user has at least one playlist
 *
 * Creates a default "My Tunes" playlist if user has no playlists.
 * This should be called after user login/signup.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @returns Default playlist (newly created or existing first playlist)
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const defaultPlaylist = await ensureDefaultPlaylist(db, user.id);
 * console.log(`Default playlist: ${defaultPlaylist.playlistId}`);
 * ```
 */
export async function ensureDefaultPlaylist(
  db: SqliteDatabase,
  userId: string
): Promise<Playlist> {
  // Check if user already has playlists
  const existingPlaylists = await getUserPlaylists(db, userId);

  if (existingPlaylists.length > 0) {
    // Return the first playlist (sorted by creation date)
    return existingPlaylists[0];
  }

  // Create default playlist
  const defaultPlaylist = await createPlaylist(db, userId, {
    name: "My Tunes",
    genreDefault: null,
    instrumentRef: null, // No specific instrument
    srAlgType: "fsrs", // Default to FSRS algorithm
  });

  console.log(
    `✅ Created default playlist ${defaultPlaylist.repertoireId} for user ${userId}`
  );

  return defaultPlaylist;
}

/**
 * Get or create default playlist
 *
 * Similar to ensureDefaultPlaylist but doesn't throw if user not found.
 * Returns null if unable to create playlist.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @returns Default playlist or null
 */
export async function getOrCreateDefaultPlaylist(
  db: SqliteDatabase,
  userId: string
): Promise<Playlist | null> {
  try {
    return await ensureDefaultPlaylist(db, userId);
  } catch (error) {
    console.error("Error ensuring default playlist:", error);
    return null;
  }
}

/**
 * Get user's currently selected playlist ID from localStorage
 *
 * Falls back to default playlist if no selection stored.
 *
 * @param userId - User's Supabase UUID
 * @returns Playlist ID (UUID string) or null
 */
export function getSelectedPlaylistId(userId: string): string | null {
  if (typeof window === "undefined") return null;

  const key = `tunetrees:selectedPlaylist:${userId}`;
  const stored = localStorage.getItem(key);

  return stored || null;
}

/**
 * Set user's currently selected playlist ID in localStorage
 *
 * @param userId - User's Supabase UUID
 * @param playlistId - Playlist ID (UUID string) to select
 */
export function setSelectedPlaylistId(
  userId: string,
  playlistId: string
): void {
  if (typeof window === "undefined") return;

  const key = `tunetrees:selectedPlaylist:${userId}`;
  localStorage.setItem(key, playlistId);

  console.log(`✅ Selected playlist ${playlistId} for user ${userId}`);
}

/**
 * Clear user's selected playlist from localStorage
 *
 * @param userId - User's Supabase UUID
 */
export function clearSelectedPlaylistId(userId: string): void {
  if (typeof window === "undefined") return;

  const key = `tunetrees:selectedPlaylist:${userId}`;
  localStorage.removeItem(key);
}
