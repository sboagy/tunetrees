/**
 * Reference Database Queries
 *
 * Complete CRUD operations for tune references (URLs to YouTube, sheet music, etc.)
 * Follows same UUID mapping pattern as tags system.
 *
 * @module lib/db/queries/references
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { generateId } from "@/lib/utils/uuid";
import type { SqliteDatabase } from "../client-sqlite";
import * as schema from "../schema";
import type { Reference } from "../types";

export type { Reference };

/**
 * Data for creating a new reference
 */
export interface CreateReferenceData {
  url: string;
  tuneRef: string; // UUID
  refType?: string;
  title?: string;
  comment?: string;
  public?: boolean;
  favorite?: boolean;
}

/**
 * Data for updating a reference
 */
export interface UpdateReferenceData {
  url?: string;
  refType?: string;
  title?: string;
  comment?: string;
  public?: boolean;
  favorite?: boolean;
  displayOrder?: number;
}

/**
 * Get all references for a specific tune
 * Returns only non-deleted references, ordered by display order
 *
 * @param db - Database instance
 * @param tuneId - Tune UUID
 * @param supabaseUserId - Supabase UUID (optional - filters to user's private references if provided)
 * @returns Array of references
 */
export async function getReferencesByTune(
  db: SqliteDatabase,
  tuneId: string, // UUID
  supabaseUserId?: string
): Promise<Reference[]> {
  const conditions = [
    eq(schema.reference.tuneRef, tuneId),
    eq(schema.reference.deleted, 0),
  ];

  // If user ID provided, filter to user's references
  if (supabaseUserId) {
    conditions.push(eq(schema.reference.userRef, supabaseUserId));
  }

  return await db
    .select()
    .from(schema.reference)
    .where(and(...conditions))
    .orderBy(asc(schema.reference.displayOrder), desc(schema.reference.id))
    .all();
}

/**
 * Get a single reference by ID
 *
 * @param db - Database instance
 * @param referenceId - Reference UUID
 * @returns Reference or undefined if not found
 */
export async function getReferenceById(
  db: SqliteDatabase,
  referenceId: string // UUID
): Promise<Reference | undefined> {
  const references = await db
    .select()
    .from(schema.reference)
    .where(
      and(eq(schema.reference.id, referenceId), eq(schema.reference.deleted, 0))
    )
    .all();

  return references[0];
}

/**
 * Create a new reference
 *
 * @param db - Database instance
 * @param data - Reference data
 * @param supabaseUserId - Supabase UUID for the user creating the reference
 * @returns Created reference with ID
 */
export async function createReference(
  db: SqliteDatabase,
  data: CreateReferenceData,
  supabaseUserId: string
): Promise<Reference> {
  const now = new Date().toISOString();

  const result = await db
    .insert(schema.reference)
    .values({
      id: generateId(),
      url: data.url,
      tuneRef: data.tuneRef,
      userRef: supabaseUserId,
      refType: data.refType || null,
      title: data.title || null,
      comment: data.comment || null,
      public: data.public ? 1 : 0,
      favorite: data.favorite ? 1 : 0,
      deleted: 0,
      lastModifiedAt: now,
      syncVersion: 1,
    })
    .returning()
    .get();

  return result as Reference;
}

/**
 * Update an existing reference
 *
 * @param db - Database instance
 * @param referenceId - Reference UUID to update
 * @param data - Updated reference data
 * @returns Updated reference or undefined if not found
 */
export async function updateReference(
  db: SqliteDatabase,
  referenceId: string, // UUID
  data: UpdateReferenceData
): Promise<Reference | undefined> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    lastModifiedAt: now,
  };

  if (data.url !== undefined) {
    updateData.url = data.url;
  }

  if (data.refType !== undefined) {
    updateData.refType = data.refType;
  }

  if (data.title !== undefined) {
    updateData.title = data.title;
  }

  if (data.comment !== undefined) {
    updateData.comment = data.comment;
  }

  if (data.public !== undefined) {
    updateData.public = data.public ? 1 : 0;
  }

  if (data.favorite !== undefined) {
    updateData.favorite = data.favorite ? 1 : 0;
  }

  if (data.displayOrder !== undefined) {
    updateData.displayOrder = data.displayOrder;
  }

  const result = await db
    .update(schema.reference)
    .set(updateData)
    .where(eq(schema.reference.id, referenceId))
    .returning()
    .get();

  return result as Reference | undefined;
}

/**
 * Update display order for multiple references
 * Takes an array of reference IDs in the desired order and updates their display_order
 */
export async function updateReferenceOrder(
  db: SqliteDatabase,
  referenceIds: string[] // UUIDs in desired order
): Promise<void> {
  const now = new Date().toISOString();

  // Update each reference's display_order based on its index in the array
  for (let i = 0; i < referenceIds.length; i++) {
    await db
      .update(schema.reference)
      .set({
        displayOrder: i,
        lastModifiedAt: now,
      })
      .where(eq(schema.reference.id, referenceIds[i]))
      .run();
  }
}

/**
 * Soft delete a reference
 * Sets deleted = 1 instead of removing from database
 *
 * @param db - Database instance
 * @param referenceId - Reference ID to delete
 * @returns True if deleted successfully
 */
export async function deleteReference(
  db: SqliteDatabase,
  referenceId: string // UUID
): Promise<boolean> {
  const now = new Date().toISOString();

  const result = await db
    .update(schema.reference)
    .set({
      deleted: 1,
      lastModifiedAt: now,
    })
    .where(eq(schema.reference.id, referenceId))
    .returning()
    .get();

  return result !== undefined;
}

/**
 * Get count of references for a specific tune
 *
 * @param db - Database instance
 * @param tuneId - Tune UUID
 * @returns Count of non-deleted references
 */
export async function getReferenceCount(
  db: SqliteDatabase,
  tuneId: string // UUID
): Promise<number> {
  const references = await getReferencesByTune(db, tuneId);
  return references.length;
}

/**
 * Validate URL format
 *
 * @param url - URL to validate
 * @returns True if valid URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect reference type from URL
 * Returns suggested type based on URL patterns
 *
 * @param url - URL to analyze
 * @returns Reference type (video, sheet-music, article, other)
 */
export function detectReferenceType(url: string): string {
  const urlLower = url.toLowerCase();

  // Video platforms
  if (
    urlLower.includes("youtube.com") ||
    urlLower.includes("youtu.be") ||
    urlLower.includes("vimeo.com")
  ) {
    return "video";
  }

  // Sheet music / PDF
  if (
    urlLower.includes("thesession.org") ||
    urlLower.includes(".pdf") ||
    urlLower.includes("musescore.com")
  ) {
    return "sheet-music";
  }

  // Social media
  if (
    urlLower.includes("facebook.com") ||
    urlLower.includes("instagram.com") ||
    urlLower.includes("twitter.com") ||
    urlLower.includes("x.com")
  ) {
    return "social";
  }

  return "other";
}

/**
 * Extract title from URL (basic implementation)
 * Returns the domain name or path as a fallback title
 *
 * @param url - URL to extract title from
 * @returns Suggested title
 */
export function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Special case for YouTube
    if (urlObj.hostname.includes("youtube.com")) {
      const videoId = urlObj.searchParams.get("v");
      if (videoId) {
        return `YouTube Video (${videoId})`;
      }
    }

    // Special case for youtu.be short links
    if (urlObj.hostname.includes("youtu.be")) {
      const videoId = urlObj.pathname.substring(1);
      if (videoId) {
        return `YouTube Video (${videoId})`;
      }
    }

    // Special case for The Session
    if (urlObj.hostname.includes("thesession.org")) {
      const parts = urlObj.pathname.split("/");
      const tuneName = parts[parts.length - 1];
      if (tuneName) {
        return `The Session: ${tuneName.replace(/-/g, " ")}`;
      }
    }

    // Default: use hostname
    return urlObj.hostname;
  } catch {
    return "Unknown";
  }
}
