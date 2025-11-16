/**
 * Database queries for genres and tune types
 */

import { eq } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";

/**
 * Get all genres
 */
export async function getAllGenres(db: SqliteDatabase) {
  return await db.select().from(schema.genre).orderBy(schema.genre.name).all();
}

/**
 * Get all tune types
 */
export async function getAllTuneTypes(db: SqliteDatabase) {
  return await db
    .select()
    .from(schema.tuneType)
    .orderBy(schema.tuneType.name)
    .all();
}

/**
 * Get tune types for a specific genre
 */
export async function getTuneTypesForGenre(
  db: SqliteDatabase,
  genreId: string
) {
  // Join genre_tune_type with tune_type to get the types for this genre
  const results = await db
    .select({
      id: schema.tuneType.id,
      name: schema.tuneType.name,
      rhythm: schema.tuneType.rhythm,
      description: schema.tuneType.description,
    })
    .from(schema.genreTuneType)
    .innerJoin(
      schema.tuneType,
      eq(schema.genreTuneType.tuneTypeId, schema.tuneType.id)
    )
    .where(eq(schema.genreTuneType.genreId, genreId))
    .orderBy(schema.tuneType.name)
    .all();

  return results;
}
