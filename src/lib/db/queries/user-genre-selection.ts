/**
 * User Genre Selection Queries
 *
 * Database queries for managing which genres users have selected for download/sync.
 *
 * @module lib/db/queries/user-genre-selection
 */

import { eq } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import { genre, userGenreSelection } from "../schema";

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
