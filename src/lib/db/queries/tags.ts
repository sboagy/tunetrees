/**
 * Tag Database Queries
 *
 * CRUD operations for the tag table.
 * Tags are stored in a join table (tag) with userRef, tuneRef, and tagText.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user_profile.id from supabase_user_id (UUID)
 * Returns null if user not found
 */
async function getUserProfileId(
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
}

// ============================================================================
// Types
// ============================================================================

export interface Tag {
  tagId: number;
  userRef: number;
  tuneRef: number;
  tagText: string;
  syncVersion: number;
  lastModifiedAt: string;
  deviceId: string | null;
}

export interface TagWithUsageCount {
  tagText: string;
  usageCount: number;
}

export interface TuneTag {
  tagId: number;
  tagText: string;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all unique tags for a user with usage counts
 * @param db - SQLite database instance
 * @param supabaseUserId - Supabase Auth UUID
 */
export async function getUserTags(
  db: SqliteDatabase,
  supabaseUserId: string
): Promise<TagWithUsageCount[]> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return [];
  }

  const results = await db
    .select({
      tagText: schema.tag.tagText,
      usageCount: sql<number>`COUNT(DISTINCT ${schema.tag.tuneRef})`,
    })
    .from(schema.tag)
    .where(eq(schema.tag.userRef, userRef))
    .groupBy(schema.tag.tagText)
    .orderBy(schema.tag.tagText)
    .all();

  return results;
}

/**
 * Get all tags for a specific tune
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param supabaseUserId - Supabase Auth UUID
 */
export async function getTuneTags(
  db: SqliteDatabase,
  tuneId: number,
  supabaseUserId: string
): Promise<TuneTag[]> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return [];
  }

  const results = await db
    .select({
      tagId: schema.tag.tagId,
      tagText: schema.tag.tagText,
    })
    .from(schema.tag)
    .where(and(eq(schema.tag.tuneRef, tuneId), eq(schema.tag.userRef, userRef)))
    .orderBy(schema.tag.tagText)
    .all();

  return results;
}

/**
 * Add a tag to a tune
 * If the tag already exists, does nothing (unique constraint)
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param supabaseUserId - Supabase Auth UUID
 * @param tagText - Tag text (will be normalized)
 * @param deviceId - Optional device ID for sync
 */
export async function addTagToTune(
  db: SqliteDatabase,
  tuneId: number,
  supabaseUserId: string,
  tagText: string,
  deviceId?: string
): Promise<Tag | null> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    console.error("User profile not found for", supabaseUserId);
    return null;
  }

  const now = new Date().toISOString();

  try {
    const result = await db
      .insert(schema.tag)
      .values({
        tuneRef: tuneId,
        userRef: userRef,
        tagText: tagText.trim().toLowerCase(), // Normalize tag text
        syncVersion: 1,
        lastModifiedAt: now,
        deviceId: deviceId ?? null,
      })
      .returning()
      .get();

    return result as Tag;
  } catch (error) {
    // Unique constraint violation means tag already exists
    // This is fine, just return null
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Remove a tag from a tune
 * @param db - SQLite database instance
 * @param tuneId - Tune ID
 * @param supabaseUserId - Supabase Auth UUID
 * @param tagText - Tag text
 */
export async function removeTagFromTune(
  db: SqliteDatabase,
  tuneId: number,
  supabaseUserId: string,
  tagText: string
): Promise<boolean> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return false;
  }

  const result = await db
    .delete(schema.tag)
    .where(
      and(
        eq(schema.tag.tuneRef, tuneId),
        eq(schema.tag.userRef, userRef),
        eq(schema.tag.tagText, tagText.trim().toLowerCase())
      )
    )
    .returning()
    .all();

  return result.length > 0;
}

/**
 * Remove a tag by ID
 */
export async function removeTagById(
  db: SqliteDatabase,
  tagId: number
): Promise<boolean> {
  const result = await db
    .delete(schema.tag)
    .where(eq(schema.tag.tagId, tagId))
    .returning()
    .all();

  return result.length > 0;
}

/**
 * Get usage count for a specific tag
 * @param db - SQLite database instance
 * @param supabaseUserId - Supabase Auth UUID
 * @param tagText - Tag text
 */
export async function getTagUsageCount(
  db: SqliteDatabase,
  supabaseUserId: string,
  tagText: string
): Promise<number> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return 0;
  }

  const result = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${schema.tag.tuneRef})`,
    })
    .from(schema.tag)
    .where(
      and(eq(schema.tag.userRef, userRef), eq(schema.tag.tagText, tagText))
    )
    .get();

  return result?.count ?? 0;
}

/**
 * Delete all instances of a tag for a user
 * (removes tag from all tunes)
 * @param db - SQLite database instance
 * @param supabaseUserId - Supabase Auth UUID
 * @param tagText - Tag text
 */
export async function deleteTagForUser(
  db: SqliteDatabase,
  supabaseUserId: string,
  tagText: string
): Promise<number> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return 0;
  }

  const result = await db
    .delete(schema.tag)
    .where(
      and(eq(schema.tag.userRef, userRef), eq(schema.tag.tagText, tagText))
    )
    .returning()
    .all();

  return result.length;
}

/**
 * Rename a tag for a user
 * (updates all instances of the old tag to the new tag text)
 * @param db - SQLite database instance
 * @param supabaseUserId - Supabase Auth UUID
 * @param oldTagText - Old tag text
 * @param newTagText - New tag text
 * @param deviceId - Optional device ID for sync
 */
export async function renameTagForUser(
  db: SqliteDatabase,
  supabaseUserId: string,
  oldTagText: string,
  newTagText: string,
  deviceId?: string
): Promise<number> {
  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return 0;
  }

  const now = new Date().toISOString();

  const result = await db
    .update(schema.tag)
    .set({
      tagText: newTagText.trim().toLowerCase(),
      syncVersion: sql`${schema.tag.syncVersion} + 1`,
      lastModifiedAt: now,
      deviceId: deviceId ?? null,
    })
    .where(
      and(eq(schema.tag.userRef, userRef), eq(schema.tag.tagText, oldTagText))
    )
    .returning()
    .all();

  return result.length;
}

/**
 * Get all tunes that have ANY of the specified tags
 * @param db - SQLite database instance
 * @param supabaseUserId - Supabase Auth UUID
 * @param tagTexts - Array of tag texts
 */
export async function getTuneIdsByTags(
  db: SqliteDatabase,
  supabaseUserId: string,
  tagTexts: string[]
): Promise<number[]> {
  if (tagTexts.length === 0) {
    return [];
  }

  const userRef = await getUserProfileId(db, supabaseUserId);
  if (!userRef) {
    return [];
  }

  const normalizedTags = tagTexts.map((t) => t.trim().toLowerCase());

  const results = await db
    .selectDistinct({
      tuneRef: schema.tag.tuneRef,
    })
    .from(schema.tag)
    .where(
      and(
        eq(schema.tag.userRef, userRef),
        inArray(schema.tag.tagText, normalizedTags)
      )
    )
    .all();

  return results.map((r) => r.tuneRef);
}

/**
 * Delete unused tags (cleanup function)
 * Returns count of deleted tags
 *
 * @deprecated Not needed - tags are automatically cleaned up when removed from tunes
 */
export async function deleteUnusedTags(): Promise<number> {
  // This is a placeholder - SQLite doesn't easily support
  // deleting from a subquery result. In practice, tags are
  // deleted when removed from tunes, so this isn't needed.
  return 0;
}
