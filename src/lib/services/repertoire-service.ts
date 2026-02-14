/**
 * Repertoire Service
 *
 * Business logic for repertoire management.
 * Handles default repertoire creation and repertoire-related operations.
 *
 * @module lib/services/repertoire-service
 */

import type { SqliteDatabase } from "../db/client-sqlite";
import {
  createRepertoire,
  getUserRepertoires,
} from "../db/queries/repertoires";
import type { Repertoire } from "../db/types";

const SELECTED_REPERTOIRE_KEY_PREFIX = "tunetrees:selectedRepertoire";
const SELECTED_REPERTOIRE_LEGACY_KEY_PREFIX = "tunetrees:selectedRepertoire";

const getSelectedRepertoireKey = (userId: string) =>
  `${SELECTED_REPERTOIRE_KEY_PREFIX}:${userId}`;

const getLegacySelectedRepertoireKey = (userId: string) =>
  `${SELECTED_REPERTOIRE_LEGACY_KEY_PREFIX}:${userId}`;

/**
 * Ensure user has at least one repertoire
 *
 * Creates a default "My Tunes" repertoire if user has no repertoires.
 * This should be called after user login/signup.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @returns Default repertoire (newly created or existing first repertoire)
 *
 * @example
 * ```typescript
 * const db = getDb();
 * const defaultRepertoire = await ensureDefaultRepertoire(db, user.id);
 * console.log(`Default repertoire: ${defaultRepertoire.repertoireId}`);
 * ```
 */
export async function ensureDefaultRepertoire(
  db: SqliteDatabase,
  userId: string
): Promise<Repertoire> {
  // Check if user already has repertoires
  const existingRepertoires = await getUserRepertoires(db, userId);

  if (existingRepertoires.length > 0) {
    // Return the first repertoire (sorted by creation date)
    return existingRepertoires[0];
  }

  // Create default repertoire
  const defaultRepertoire = await createRepertoire(db, userId, {
    name: "My Tunes",
    genreDefault: null,
    instrumentRef: null, // No specific instrument
    srAlgType: "fsrs", // Default to FSRS algorithm
  });

  console.log(
    `✅ Created default repertoire ${defaultRepertoire.repertoireId} for user ${userId}`
  );

  return defaultRepertoire;
}

/**
 * Get or create default repertoire
 *
 * Similar to ensureDefaultRepertoire but doesn't throw if user not found.
 * Returns null if unable to create repertoire.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @returns Default repertoire or null
 */
export async function getOrCreateDefaultRepertoire(
  db: SqliteDatabase,
  userId: string
): Promise<Repertoire | null> {
  try {
    return await ensureDefaultRepertoire(db, userId);
  } catch (error) {
    console.error("Error ensuring default repertoire:", error);
    return null;
  }
}

/**
 * Get user's currently selected repertoire ID from localStorage
 *
 * Falls back to default repertoire if no selection stored.
 *
 * @param userId - User's Supabase UUID
 * @returns Repertoire ID (UUID string) or null
 */
export function getSelectedRepertoireId(userId: string): string | null {
  if (typeof window === "undefined") return null;

  const repertoireKey = getSelectedRepertoireKey(userId);
  const legacyRepertoireKey = getLegacySelectedRepertoireKey(userId);

  const stored = localStorage.getItem(repertoireKey);
  if (stored) return stored;

  const legacyStored = localStorage.getItem(legacyRepertoireKey);
  if (legacyStored) {
    localStorage.setItem(repertoireKey, legacyStored);
    return legacyStored;
  }

  return null;
}

/**
 * Set user's currently selected repertoire ID in localStorage
 *
 * @param userId - User's Supabase UUID
 * @param repertoireId - Repertoire ID (UUID string) to select
 */
export function setSelectedRepertoireId(
  userId: string,
  repertoireId: string
): void {
  if (typeof window === "undefined") return;

  const repertoireKey = getSelectedRepertoireKey(userId);
  const legacyRepertoireKey = getLegacySelectedRepertoireKey(userId);
  localStorage.setItem(repertoireKey, repertoireId);
  localStorage.setItem(legacyRepertoireKey, repertoireId);

  console.log(`✅ Selected repertoire ${repertoireId} for user ${userId}`);
}

/**
 * Clear user's selected repertoire from localStorage
 *
 * @param userId - User's Supabase UUID
 */
export function clearSelectedRepertoireId(userId: string): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(getSelectedRepertoireKey(userId));
  localStorage.removeItem(getLegacySelectedRepertoireKey(userId));
}
