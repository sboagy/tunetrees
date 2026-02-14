/**
 * Repertoire CRUD Queries
 *
 * Database queries for repertoire management operations.
 * All operations use local SQLite WASM with background sync to Supabase.
 *
 * Core Operations:
 * - getUserRepertoires: Get all repertoires for a user
 * - getRepertoireById: Get repertoire by ID
 * - createRepertoire: Create new repertoire
 * - updateRepertoire: Update existing repertoire
 * - deleteRepertoire: Soft delete repertoire
 * - addTuneToRepertoire: Add tune to repertoire
 * - removeTuneFromRepertoire: Remove tune from repertoire
 * - getRepertoireTunes: Get all tunes in a repertoire
 *
 * @module lib/db/queries/repertoires
 */

import { and, eq, sql } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import { persistDb } from "../client-sqlite";
import {
  instrument,
  repertoire,
  repertoireTune,
  tune,
  userProfile,
} from "../schema";
import type {
  NewRepertoire,
  NewRepertoireTune,
  Repertoire,
  RepertoireTune,
  RepertoireWithSummary,
} from "../types";

export type {
  NewRepertoire,
  NewRepertoireTune,
  Repertoire,
  RepertoireTune,
  RepertoireWithSummary,
};

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
  // Poll briefly to avoid treating this transient state as “no repertoires”.
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
 * Get all repertoires for a user
 *
 * Returns repertoires ordered by creation date (newest first).
 * Includes tune count for each repertoire.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @param includeDeleted - Whether to include soft-deleted repertoires (default: false)
 * @returns Array of repertoires with summary data
 *
 * @example
 * ```typescript
 * const repertoires = await getUserRepertoires(db, 'user-uuid');
 * console.log(`User has ${repertoires.length} repertoires`);
 * ```
 */
export async function getUserRepertoires(
  db: SqliteDatabase,
  userId: string,
  includeDeleted = false
): Promise<RepertoireWithSummary[]> {
  const userRef = await resolveUserRef(db, userId, {
    waitForMs: 2_000,
    pollEveryMs: 100,
  });

  if (!userRef) {
    console.log(
      `⚠️ User profile not found yet for ${userId}, returning empty repertoires`
    );
    return [];
  }

  // Build query conditions
  const conditions = [eq(repertoire.userRef, userRef)];
  if (!includeDeleted) {
    conditions.push(eq(repertoire.deleted, 0));
  }

  // Get repertoires with tune count and instrument names
  // Uses logic similar to view_repertoire_joined to resolve genre_default from instrument if needed
  const repertoires = await db
    .select({
      repertoireId: repertoire.repertoireId,
      userRef: repertoire.userRef,
      name: repertoire.name,
      instrumentRef: repertoire.instrumentRef,
      instrumentName: instrument.instrument,
      // Select both genre columns for post-query resolution
      repertoireGenre: repertoire.genreDefault,
      instrumentGenre: instrument.genreDefault,
      srAlgType: repertoire.srAlgType,
      deleted: repertoire.deleted,
      syncVersion: repertoire.syncVersion,
      lastModifiedAt: repertoire.lastModifiedAt,
      deviceId: repertoire.deviceId,
      tuneCount: sql<number>`(
        SELECT COUNT(*)
        FROM repertoire_tune
        WHERE repertoire_ref = ${repertoire.repertoireId}
          AND deleted = 0
      )`,
    })
    .from(repertoire)
    .leftJoin(instrument, eq(repertoire.instrumentRef, instrument.id))
    .where(and(...conditions))
    .orderBy(repertoire.lastModifiedAt);

  // Debug logs removed for cleanliness

  return repertoires.map((p) => ({
    ...p,
    // Resolve genre: use repertoire's genreDefault if set, otherwise use instrument's genreDefault
    genreDefault: p.repertoireGenre ?? p.instrumentGenre,
    tuneCount: Number(p.tuneCount) || 0,
    instrumentName: p.instrumentName || undefined, // Convert null to undefined
    // Remove the temporary fields from the result
    repertoireGenre: undefined,
    instrumentGenre: undefined,
  }));
}

/**
 * Get repertoire by ID
 *
 * Returns null if repertoire not found or belongs to different user.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Repertoire or null
 *
 * @example
 * ```typescript
 * const repertoire = await getRepertoireById(db, 'repertoire-uuid', 'user-uuid');
 * if (!repertoire) {
 *   console.log('Repertoire not found or access denied');
 * }
 * ```
 */
export async function getRepertoireById(
  db: SqliteDatabase,
  repertoireId: string,
  userId: string
): Promise<Repertoire | null> {
  // userId is already user_profile.id (Supabase Auth UUID)
  const userRef = userId;

  const result = await db
    .select()
    .from(repertoire)
    .where(
      and(
        eq(repertoire.repertoireId, repertoireId),
        eq(repertoire.userRef, userRef)
      )
    )
    .limit(1);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * Create new repertoire
 *
 * Creates repertoire and queues for background sync to Supabase.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @param data - Repertoire data
 * @returns Created repertoire
 *
 * @example
 * ```typescript
 * const newRepertoire = await createRepertoire(db, 'user-uuid', {
 *   name: 'My Irish Tunes',
 *   genreDefault: 'ITRAD',
 *   srAlgType: 'fsrs',
 * });
 * console.log(`Created repertoire ${newRepertoire.repertoireId}`);
 * ```
 */
export async function createRepertoire(
  db: SqliteDatabase,
  userId: string,
  data: Omit<
    NewRepertoire,
    "repertoireId" | "userRef" | "syncVersion" | "lastModifiedAt" | "deviceId"
  >
): Promise<Repertoire> {
  // userId is already user_profile.id (Supabase Auth UUID)
  const userRef = userId;
  const now = new Date().toISOString();

  const newRepertoire: NewRepertoire = {
    repertoireId: generateId(),
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

  const result = await db.insert(repertoire).values(newRepertoire).returning();

  if (!result || result.length === 0) {
    throw new Error("Failed to create repertoire");
  }

  const created = result[0];

  // Sync is handled automatically by SQL triggers populating sync_outbox

  // Persist to IndexedDB
  await persistDb();

  return created;
}

/**
 * Update existing repertoire
 *
 * Updates repertoire and queues for background sync.
 * Only updates fields that are provided in the data object.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @param data - Partial repertoire data to update
 * @returns Updated repertoire or null if not found
 *
 * @example
 * ```typescript
 * const updated = await updateRepertoire(db, 'repertoire-uuid', 'user-uuid', {
 *   srAlgType: 'sm2',
 * });
 * ```
 */
export async function updateRepertoire(
  db: SqliteDatabase,
  repertoireId: string,
  userId: string,
  data: Partial<Omit<NewRepertoire, "userRef" | "id">>
): Promise<Repertoire | null> {
  // Verify ownership
  const existing = await getRepertoireById(db, repertoireId, userId);
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
    .update(repertoire)
    .set(updateData)
    .where(eq(repertoire.repertoireId, repertoireId))
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
 * Delete repertoire (soft delete)
 *
 * Marks repertoire as deleted. Also soft-deletes all repertoire_tune associations.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns True if deleted, false if not found
 *
 * @example
 * ```typescript
 * const deleted = await deleteRepertoire(db, 'repertoire-uuid', 'user-uuid');
 * if (deleted) {
 *   console.log('Repertoire deleted');
 * }
 * ```
 */
export async function deleteRepertoire(
  db: SqliteDatabase,
  repertoireId: string,
  userId: string
): Promise<boolean> {
  // Verify ownership
  const existing = await getRepertoireById(db, repertoireId, userId);
  if (!existing) {
    return false;
  }

  const now = new Date().toISOString();

  // Soft delete the repertoire
  await db
    .update(repertoire)
    .set({
      deleted: 1,
      syncVersion: (existing.syncVersion || 0) + 1,
      lastModifiedAt: now,
    })
    .where(eq(repertoire.repertoireId, repertoireId));

  // Soft delete all repertoire-tune associations
  await db
    .update(repertoireTune)
    .set({
      deleted: 1,
      syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
      lastModifiedAt: now,
    })
    .where(eq(repertoireTune.repertoireRef, repertoireId));

  // Sync is handled automatically by SQL triggers populating sync_outbox

  // Persist to IndexedDB
  await persistDb();

  return true;
}

/**
 * Add tune to repertoire
 *
 * Creates repertoire_tune association.
 * Initializes scheduling fields (current, learned, scheduled, goal).
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param tuneId - Tune ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Created repertoire-tune association
 *
 * @example
 * ```typescript
 * const association = await addTuneToRepertoire(db, 'repertoire-uuid', 'tune-uuid', 'user-uuid');
 * console.log(`Added tune ${tuneId} to repertoire ${repertoireId}`);
 * ```
 */
export async function addTuneToRepertoire(
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string,
  userId: string
): Promise<RepertoireTune> {
  // Verify repertoire ownership
  const repertoireRecord = await getRepertoireById(db, repertoireId, userId);
  if (!repertoireRecord) {
    throw new Error("Repertoire not found or access denied");
  }

  // Check if association already exists
  const existing = await db
    .select()
    .from(repertoireTune)
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.tuneRef, tuneId)
      )
    )
    .limit(1);

  if (existing && existing.length > 0) {
    // If it was soft-deleted, undelete it
    if (existing[0].deleted === 1) {
      const now = new Date().toISOString();
      const result = await db
        .update(repertoireTune)
        .set({
          deleted: 0,
          syncVersion: (existing[0].syncVersion || 0) + 1,
          lastModifiedAt: now,
        })
        .where(
          and(
            eq(repertoireTune.repertoireRef, repertoireId),
            eq(repertoireTune.tuneRef, tuneId)
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
  const newAssociation: NewRepertoireTune = {
    repertoireRef: repertoireId,
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
    .insert(repertoireTune)
    .values(newAssociation)
    .returning();

  if (!result || result.length === 0) {
    throw new Error("Failed to add tune to repertoire");
  }

  // Sync is handled automatically by SQL triggers populating sync_outbox

  return result[0];
}

/**
 * Remove tune from repertoire (soft delete)
 *
 * Marks repertoire_tune association as deleted.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param tuneId - Tune ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns True if removed, false if not found
 *
 * @example
 * ```typescript
 * const removed = await removeTuneFromRepertoire(db, 'repertoire-uuid', 'tune-uuid', 'user-uuid');
 * if (removed) {
 *   console.log('Tune removed from repertoire');
 * }
 * ```
 */
export async function removeTuneFromRepertoire(
  db: SqliteDatabase,
  repertoireId: string,
  tuneId: string,
  userId: string
): Promise<boolean> {
  // Verify repertoire ownership
  const repertoireRecord = await getRepertoireById(db, repertoireId, userId);
  if (!repertoireRecord) {
    return false;
  }

  const now = new Date().toISOString();

  const result = await db
    .update(repertoireTune)
    .set({
      deleted: 1,
      syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
      lastModifiedAt: now,
    })
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.tuneRef, tuneId)
      )
    )
    .returning();

  if (!result || result.length === 0) {
    return false;
  }

  // Queue for sync
  // await queueSync(db, 'repertoire_tune', `${repertoireId}-${tuneId}`, 'update');

  return true;
}

/**
 * Get all tunes in a repertoire
 *
 * Returns tunes with their full details, excluding soft-deleted tunes.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Array of tunes with repertoire-specific data
 *
 * @example
 * ```typescript
 * const tunes = await getRepertoireTunes(db, 'repertoire-uuid', 'user-uuid');
 * console.log(`Repertoire has ${tunes.length} tunes`);
 * ```
 */
export async function getRepertoireTunes(
  db: SqliteDatabase,
  repertoireId: string,
  userId: string
) {
  // Verify repertoire ownership
  const repertoireRecord = await getRepertoireById(db, repertoireId, userId);
  if (!repertoireRecord) {
    throw new Error("Repertoire not found or access denied");
  }

  const result = await db
    .select({
      // RepertoireTune fields
      repertoireRef: repertoireTune.repertoireRef,
      tuneRef: repertoireTune.tuneRef,
      current: repertoireTune.current,
      learned: repertoireTune.learned,
      scheduled: repertoireTune.scheduled,
      goal: repertoireTune.goal,

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
    .from(repertoireTune)
    .innerJoin(tune, eq(repertoireTune.tuneRef, tune.id))
    .where(
      and(
        eq(repertoireTune.repertoireRef, repertoireId),
        eq(repertoireTune.deleted, 0),
        eq(tune.deleted, 0)
      )
    )
    .orderBy(tune.title);

  return result.map((row) => ({
    repertoireRef: row.repertoireRef,
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
 * Get tunes from practice_list_staged view for a repertoire
 *
 * Returns comprehensive tune data including practice records and staging data.
 * This is the proper data source for the Repertoire tab.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Array of tune overview records from practice_list_staged view
 *
 * @example
 * ```typescript
 * const tunes = await getRepertoireTunesStaged(db, 'repertoire-uuid', 'user-uuid');
 * console.log(`Repertoire has ${tunes.length} tunes`);
 * ```
 */
export async function getRepertoireTunesStaged(
  db: SqliteDatabase,
  repertoireId: string,
  userId: string
) {
  // Verify repertoire ownership
  const repertoireRecord = await getRepertoireById(db, repertoireId, userId);
  if (!repertoireRecord) {
    throw new Error("Repertoire not found or access denied");
  }

  // userId is already user_profile.id (Supabase Auth UUID)
  const userRef = userId;

  // Query the practice_list_staged view directly
  const result = await db.all<any>(sql`
    SELECT * FROM practice_list_staged
    WHERE repertoire_id = ${repertoireId}
      AND user_ref = ${userRef}
      AND deleted = 0
      AND repertoire_deleted = 0
    ORDER BY title
  `);
  console.log(
    `[getRepertoireTunesStaged] Found ${result.length} tunes for repertoire ${repertoireId}`
  );

  return result;
}

/**
 * Add multiple tunes to repertoire
 *
 * Batch version of addTuneToRepertoire for adding multiple tunes at once.
 * Useful for "Add To Repertoire" button on Catalog tab.
 *
 * @param db - SQLite database instance
 * @param repertoireId - Repertoire ID
 * @param tuneIds - Array of tune IDs to add
 * @param userId - User's Supabase UUID (for ownership check)
 * @returns Object with counts of added and skipped tunes
 *
 * @example
 * ```typescript
 * const result = await addTunesToRepertoire(db, 'repertoire-uuid', ['tune1', 'tune2', 'tune3'], 'user-uuid');
 * console.log(`Added ${result.added} tunes, skipped ${result.skipped} (already in repertoire)`);
 * ```
 */
export async function addTunesToRepertoire(
  db: SqliteDatabase,
  repertoireId: string,
  tuneIds: string[],
  userId: string
): Promise<{ added: number; skipped: number; tuneIds: string[] }> {
  // Verify repertoire ownership
  const repertoireRecord = await getRepertoireById(db, repertoireId, userId);
  if (!repertoireRecord) {
    throw new Error("Repertoire not found or access denied");
  }

  let added = 0;
  let skipped = 0;
  const addedTuneIds: string[] = [];

  for (const tuneId of tuneIds) {
    try {
      // Check if already exists
      const existing = await db
        .select()
        .from(repertoireTune)
        .where(
          and(
            eq(repertoireTune.repertoireRef, repertoireId),
            eq(repertoireTune.tuneRef, tuneId)
          )
        )
        .limit(1);

      if (existing && existing.length > 0 && existing[0].deleted === 0) {
        // Already in repertoire and not deleted
        skipped++;
        continue;
      }

      // Add the tune (or undelete if it was deleted)
      await addTuneToRepertoire(db, repertoireId, tuneId, userId);
      added++;
      addedTuneIds.push(tuneId);
    } catch (error) {
      console.error(`Error adding tune ${tuneId} to repertoire:`, error);
      skipped++;
    }
  }

  return { added, skipped, tuneIds: addedTuneIds };
}
