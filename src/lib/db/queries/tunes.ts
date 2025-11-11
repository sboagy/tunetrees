/**
 * Tune Query Helpers (Simplified)
 *
 * Basic query functions for tune operations.
 * More complex queries will be added as needed.
 *
 * @module lib/db/queries/tunes
 */

import { and, asc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { queueSync } from "../../sync";
import { generateId } from "../../utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";
import type { CreateTuneInput, Tune } from "../types";

/**
 * Search and filter options for tunes
 */
export interface SearchTunesOptions {
  /** Search query (searches title, incipit, structure) */
  query?: string;
  /** Filter by tune types (multi-select) */
  types?: string[];
  /** Filter by modes (multi-select) */
  modes?: string[];
  /** Filter by genres (multi-select) */
  genres?: string[];
  /** Filter by tags (multi-select) - tuple IDs will be checked against tag table */
  tagIds?: string[];
  /** Include user's private tunes */
  userId?: string;
}

/**
 * Get user_profile.id from supabase_user_id (UUID)
 * Returns null if user not found
 *
 * NOTE: Currently unused but kept for potential future use
 */
/* async function getUserProfileId(
  db: SqliteDatabase,
  supabaseUserId: string
): Promise<number | null> {
  const result = await db
    .select({ id: schema.userProfile.id })
    .from(schema.userProfile)
    .where(eq(schema.userProfile.supabaseUserId, supabaseUserId))
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0].id;
} */

/**
 * Get a single tune by ID
 */
export async function getTuneById(
  db: SqliteDatabase,
  tuneId: string
): Promise<Tune | null> {
  const result = await db
    .select()
    .from(schema.tune)
    .where(and(eq(schema.tune.id, tuneId), eq(schema.tune.deleted, 0)))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all non-deleted tunes (public tunes)
 * For MVP - will add user filtering later with proper user ID mapping
 */
export async function getAllTunes(db: SqliteDatabase): Promise<Tune[]> {
  return await db
    .select()
    .from(schema.tune)
    .where(and(eq(schema.tune.deleted, 0), isNull(schema.tune.privateFor)))
    .orderBy(asc(schema.tune.title));
}

/**
 * Get all tunes for a user (includes public and user's private tunes)
 * @param userId - Supabase Auth user UUID (unused in catalog mode)
 */
export async function getTunesForUser(
  db: SqliteDatabase,
  _userId: string
): Promise<Tune[]> {
  // For catalog view, return ALL non-deleted tunes regardless of private_for
  // Catalog should show everything - filtering by user is for other views
  return await db
    .select()
    .from(schema.tune)
    .where(eq(schema.tune.deleted, 0))
    .orderBy(asc(schema.tune.title));
}
/**
 * Create a new tune
 */
export async function createTune(
  db: SqliteDatabase,
  input: CreateTuneInput
): Promise<Tune> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  const [tune] = await db
    .insert(schema.tune)
    .values({
      id: generateId(),
      title: input.title || null,
      type: input.type || null,
      mode: input.mode || null,
      structure: input.structure || null,
      incipit: input.incipit || null,
      genre: input.genre || null,
      privateFor: input.privateFor || null,
      deleted: 0,
      syncVersion: 0,
      lastModifiedAt: now,
      deviceId: deviceId,
    })
    .returning();

  // Queue for sync to Supabase
  await queueSync(db, "tune", "insert", tune);

  return tune;
}

/**
 * Update an existing tune
 */
export async function updateTune(
  db: SqliteDatabase,
  tuneId: string,
  input: Partial<CreateTuneInput>
): Promise<Tune> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  // Build update object with only provided fields
  const updateData: Partial<Tune> = {
    lastModifiedAt: now,
    deviceId: deviceId,
  };

  if (input.title !== undefined) updateData.title = input.title;
  if (input.type !== undefined) updateData.type = input.type || null;
  if (input.mode !== undefined) updateData.mode = input.mode || null;
  if (input.structure !== undefined)
    updateData.structure = input.structure || null;
  if (input.incipit !== undefined) updateData.incipit = input.incipit || null;
  if (input.genre !== undefined) updateData.genre = input.genre || null;
  if (input.privateFor !== undefined)
    updateData.privateFor = input.privateFor || null;

  const [tune] = await db
    .update(schema.tune)
    .set(updateData)
    .where(eq(schema.tune.id, tuneId))
    .returning();

  // Queue for sync to Supabase
  await queueSync(db, "tune", "update", tune);

  return tune;
}

/**
 * Delete a tune (soft delete)
 */
export async function deleteTune(
  db: SqliteDatabase,
  tuneId: string
): Promise<void> {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  await db
    .update(schema.tune)
    .set({
      deleted: 1,
      lastModifiedAt: now,
      deviceId: deviceId,
    })
    .where(eq(schema.tune.id, tuneId));

  // Queue for sync to Supabase
  await queueSync(db, "tune", "delete", { id: tuneId });
}

/**
 * Get device ID (browser fingerprint or generate one)
 */
function getDeviceId(): string {
  if (typeof window !== "undefined") {
    let deviceId = localStorage.getItem("tunetrees_device_id");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem("tunetrees_device_id", deviceId);
    }
    return deviceId;
  }
  return "server";
}

/**
 * Search tunes with advanced filtering
 *
 * Searches across: title, incipit, structure
 * Filters by: type, mode, genre
 * Case-insensitive, uses SQL LIKE for fuzzy matching
 *
 * @param db - Database instance
 * @param options - Search and filter options
 * @returns Array of matching tunes
 */
export async function searchTunes(
  db: SqliteDatabase,
  options: SearchTunesOptions = {}
): Promise<Tune[]> {
  const { query, types, modes, genres, userId } = options;

  // Build WHERE conditions
  const conditions: ReturnType<typeof or | typeof and | typeof eq>[] = [
    eq(schema.tune.deleted, 0), // SQLite uses 0/1 for boolean
  ];

  // User-specific filtering (public or user's private tunes)
  if (userId) {
    // Need to map UUID to integer user_profile.id
    // For now, we'll filter by privateFor being null (public) or matching user
    // This will need enhancement when we implement proper UUID mapping
    conditions.push(
      or(
        isNull(schema.tune.privateFor),
        eq(schema.tune.privateFor, userId as any) // FIXME: Need UUID to integer mapping
      ) as any
    );
  } else {
    // Only public tunes
    conditions.push(isNull(schema.tune.privateFor));
  }

  // Search query (searches title, incipit, structure)
  if (query?.trim()) {
    const searchPattern = `%${query.toLowerCase()}%`;
    conditions.push(
      or(
        like(schema.tune.title, searchPattern),
        like(schema.tune.incipit, searchPattern),
        like(schema.tune.structure, searchPattern)
      ) as any
    );
  }

  // Type filter (multi-select)
  if (types && types.length > 0) {
    conditions.push(inArray(schema.tune.type, types) as any);
  }

  // Mode filter (multi-select)
  if (modes && modes.length > 0) {
    conditions.push(inArray(schema.tune.mode, modes) as any);
  }

  // Genre filter (multi-select)
  if (genres && genres.length > 0) {
    conditions.push(inArray(schema.tune.genre, genres) as any);
  }

  // Execute query
  return await db
    .select()
    .from(schema.tune)
    .where(and(...conditions) as any)
    .orderBy(asc(schema.tune.title))
    .all();
}
