/**
 * Tune Query Helpers (Simplified)
 *
 * Basic query functions for tune operations.
 * More complex queries will be added as needed.
 *
 * @module lib/db/queries/tunes
 */

import { and, asc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
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
 * Merges tune_override data when showPublic is false (default)
 *
 * @param db - SQLite database instance
 * @param userId - Supabase Auth user UUID
 * @param showPublic - If true, returns public tune data without overrides. If false (default), returns merged tune + override data
 * @returns Array of tunes with overrides applied (unless showPublic is true)
 */
export async function getTunesForUser(
  db: SqliteDatabase,
  userId: string,
  showPublic: boolean = false
): Promise<Tune[]> {
  // Use raw SQL to COALESCE tune and tune_override fields
  const query = showPublic
    ? // When showPublic=true, return only tune table data (no overrides)
      sql`
      SELECT 
        t.id,
        t.id_foreign as idForeign,
        t.primary_origin as primaryOrigin,
        t.title,
        t.type,
        t.structure,
        t.mode,
        t.incipit,
        t.genre,
        t.composer,
        t.artist,
        t.release_year as releaseYear,
        t.private_for as privateFor,
        t.deleted,
        t.sync_version as syncVersion,
        t.last_modified_at as lastModifiedAt,
        t.device_id as deviceId
      FROM tune t
      WHERE t.deleted = 0
      ORDER BY t.title
    `
    : // When showPublic=false (default), merge tune + tune_override with COALESCE
      sql`
      SELECT 
        t.id,
        COALESCE(o.id_foreign, t.id_foreign) as idForeign,
        t.primary_origin as primaryOrigin,
        COALESCE(o.title, t.title) as title,
        COALESCE(o.type, t.type) as type,
        COALESCE(o.structure, t.structure) as structure,
        COALESCE(o.mode, t.mode) as mode,
        COALESCE(o.incipit, t.incipit) as incipit,
        COALESCE(o.genre, t.genre) as genre,
        COALESCE(o.composer, t.composer) as composer,
        COALESCE(o.artist, t.artist) as artist,
        COALESCE(o.release_year, t.release_year) as releaseYear,
        t.private_for as privateFor,
        t.deleted,
        t.sync_version as syncVersion,
        t.last_modified_at as lastModifiedAt,
        t.device_id as deviceId
      FROM tune t
      LEFT JOIN tune_override o 
        ON t.id = o.tune_ref 
        AND o.user_ref = ${userId}
        AND o.deleted = 0
      WHERE t.deleted = 0
      ORDER BY COALESCE(o.title, t.title)
    `;

  return await db.all<Tune>(query);
}

/**
 * Get a single tune for a user, merging override values by default
 */
export async function getTuneForUserById(
  db: SqliteDatabase,
  tuneId: string,
  userId: string,
  showPublic: boolean = false
): Promise<Tune | null> {
  const query = showPublic
    ? sql`
        SELECT
          t.id,
          t.id_foreign as idForeign,
          t.primary_origin as primaryOrigin,
          t.title,
          t.type,
          t.structure,
          t.mode,
          t.incipit,
          t.genre,
          t.composer,
          t.artist,
          t.release_year as releaseYear,
          t.private_for as privateFor,
          t.deleted,
          t.sync_version as syncVersion,
          t.last_modified_at as lastModifiedAt,
          t.device_id as deviceId
        FROM tune t
        WHERE t.deleted = 0 AND t.id = ${tuneId}
        LIMIT 1
      `
    : sql`
        SELECT 
          t.id,
          COALESCE(o.id_foreign, t.id_foreign) as idForeign,
          t.primary_origin as primaryOrigin,
          COALESCE(o.title, t.title) as title,
          COALESCE(o.type, t.type) as type,
          COALESCE(o.structure, t.structure) as structure,
          COALESCE(o.mode, t.mode) as mode,
          COALESCE(o.incipit, t.incipit) as incipit,
          COALESCE(o.genre, t.genre) as genre,
          COALESCE(o.composer, t.composer) as composer,
          COALESCE(o.artist, t.artist) as artist,
          COALESCE(o.release_year, t.release_year) as releaseYear,
          t.private_for as privateFor,
          t.deleted,
          t.sync_version as syncVersion,
          t.last_modified_at as lastModifiedAt,
          t.device_id as deviceId
        FROM tune t
        LEFT JOIN tune_override o
          ON t.id = o.tune_ref
          AND o.user_ref = ${userId}
          AND o.deleted = 0
        WHERE t.deleted = 0 AND t.id = ${tuneId}
        LIMIT 1
      `;

  const rows = await db.all<Tune>(query);
  return rows[0] || null;
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
      composer: input.composer || null,
      artist: input.artist || null,
      idForeign: input.idForeign || null,
      releaseYear: input.releaseYear || null,
      privateFor: input.privateFor || null,
      deleted: 0,
      syncVersion: 0,
      lastModifiedAt: now,
      deviceId: deviceId,
    })
    .returning();

  // Sync is handled automatically by SQL triggers populating sync_outbox

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
  if (input.composer !== undefined)
    updateData.composer = input.composer || null;
  if (input.artist !== undefined) updateData.artist = input.artist || null;
  if (input.idForeign !== undefined)
    updateData.idForeign = input.idForeign || null;
  if (input.releaseYear !== undefined)
    updateData.releaseYear = input.releaseYear || null;
  if (input.privateFor !== undefined)
    updateData.privateFor = input.privateFor || null;

  const [tune] = await db
    .update(schema.tune)
    .set(updateData)
    .where(eq(schema.tune.id, tuneId))
    .returning();

  // Sync is handled automatically by SQL triggers populating sync_outbox

  return tune;
}

/**
 * Update tune only if owned by the specified user.
 * Returns true if the base tune was updated, false if not allowed.
 * Never changes ownership (privateFor).
 */
export async function updateTuneIfOwned(
  db: SqliteDatabase,
  tuneId: string,
  ownerUserId: string,
  input: Partial<CreateTuneInput>
): Promise<boolean> {
  // Fetch current tune to verify ownership
  const current = await db
    .select()
    .from(schema.tune)
    .where(eq(schema.tune.id, tuneId))
    .limit(1);

  if (!current || current.length === 0) return false;

  const record = current[0] as Tune;
  const isOwned = !!record.privateFor && record.privateFor === ownerUserId;
  if (!isOwned) return false;

  // Prevent ownership changes at this layer
  const sanitized: Partial<CreateTuneInput> = { ...input };
  delete (sanitized as any).privateFor;

  await updateTune(db, tuneId, sanitized);
  return true;
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

  // Sync is handled automatically by SQL triggers populating sync_outbox
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
