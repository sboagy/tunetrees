/**
 * Repertoire Service
 *
 * Business logic for repertoire management.
 * Handles default repertoire creation and repertoire-related operations.
 *
 * @module lib/services/repertoire-service
 */

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { SqliteDatabase } from "../db/client-sqlite";
import {
  addTunesToRepertoireBulk,
  createRepertoire,
  getUserRepertoires,
} from "../db/queries/repertoires";
import { getCatalogTuneIdsByFilter } from "../db/queries/tunes";
import type { StarterRepertoireTemplate } from "../db/starter-repertoire-templates";
import type { Repertoire } from "../db/types";

// Support both sql.js (production) and better-sqlite3 (testing)
type AnyDatabase = SqliteDatabase | BetterSQLite3Database;

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

/**
 * Create a starter/demo repertoire from a template.
 *
 * Creates the repertoire record with the template's name, genre, and
 * spaced-repetition algorithm. Does NOT populate tunes — call
 * {@link populateStarterRepertoireFromCatalog} after the catalog has synced
 * to add the matching tunes.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID
 * @param template - Starter template definition
 * @returns The newly created repertoire
 *
 * @example
 * ```typescript
 * import { ITRAD_STARTER_TEMPLATE } from "@/lib/db/starter-repertoire-templates";
 * const rep = await createStarterRepertoire(db, user.id, ITRAD_STARTER_TEMPLATE);
 * ```
 */
export async function createStarterRepertoire(
  db: AnyDatabase,
  userId: string,
  template: StarterRepertoireTemplate
): Promise<Repertoire> {
  const newRepertoire = await createRepertoire(db, userId, {
    name: template.name,
    genreDefault: template.genreDefault,
    instrumentRef: null,
    srAlgType: template.srAlgType,
  });

  console.log(
    `✅ Created starter repertoire "${newRepertoire.repertoireId}" from template "${template.id}" for user ${userId}`
  );

  return newRepertoire;
}

/**
 * Populate a starter repertoire with matching catalog tunes.
 *
 * Queries all non-deleted, public catalog tunes that match the template's
 * filter (genre or primary_origin) and adds them to the given repertoire via
 * a single bulk insert/upsert. Tunes already active in the repertoire are
 * skipped, while soft-deleted rows are undeleted.
 *
 * This should be called **after** the catalog has synced so that the
 * relevant tunes exist in the local SQLite database.
 *
 * @param db - SQLite database instance
 * @param userId - User's Supabase UUID (for ownership check)
 * @param repertoireId - ID of the repertoire to populate
 * @param template - Starter template that defines the tune filter
 * @returns Counts of added and skipped tunes
 *
 * @example
 * ```typescript
 * await triggerCatalogSync();
 * const result = await populateStarterRepertoireFromCatalog(
 *   db, user.id, rep.repertoireId, ITRAD_STARTER_TEMPLATE
 * );
 * console.log(`Added ${result.added} tunes`);
 * ```
 */
export async function populateStarterRepertoireFromCatalog(
  db: AnyDatabase,
  userId: string,
  repertoireId: string,
  template: StarterRepertoireTemplate
): Promise<{ added: number; skipped: number }> {
  const tuneIds = await getCatalogTuneIdsByFilter(
    db,
    template.tuneFilterType,
    template.tuneFilterValue
  );

  if (tuneIds.length === 0) {
    console.warn(
      `⚠️ No catalog tunes found for starter template "${template.id}" ` +
        `(filter: ${template.tuneFilterType}="${template.tuneFilterValue}"). ` +
        "The catalog may not have synced yet."
    );
    return { added: 0, skipped: 0 };
  }

  const result = await addTunesToRepertoireBulk(
    db,
    repertoireId,
    tuneIds,
    userId
  );

  console.log(
    `✅ Populated starter repertoire "${repertoireId}" with ${result.added} tunes ` +
      `(${result.skipped} skipped) from template "${template.id}"`
  );

  return { added: result.added, skipped: result.skipped };
}
