/**
 * Database Schema Migration Version Tracking
 *
 * This module manages schema version tracking for the local SQLite database.
 * When the schema changes (e.g., integer IDs → UUIDs), we need to clear
 * local data and re-sync from Supabase.
 *
 * @module lib/db/migration-version
 */

const CURRENT_SCHEMA_VERSION = "2.0.4-view-column-meta"; // Bump this when schema changes

/**
 * Get the locally stored schema version from localStorage
 *
 * @returns The stored schema version string, or null if not set
 */
export function getLocalSchemaVersion(): string | null {
  if (typeof window === "undefined") {
    return null; // SSR safety
  }
  return localStorage.getItem("schema_version");
}

/**
 * Set the local schema version in localStorage
 *
 * @param version - The schema version to store
 */
export function setLocalSchemaVersion(version: string): void {
  if (typeof window === "undefined") {
    return; // SSR safety
  }
  localStorage.setItem("schema_version", version);
}

/**
 * Check if migration is needed based on:
 * 1. localStorage version mismatch
 * 2. URL parameter ?reset=true
 * 3. URL parameter ?migrate=uuid (explicit UUID migration)
 *
 * @returns true if migration is needed, false otherwise
 */
export function needsMigration(): boolean {
  if (typeof window === "undefined") {
    return false; // SSR safety
  }

  // Check URL parameters first (allows manual reset)
  const urlParams = new URLSearchParams(window.location.search);
  const resetParam = urlParams.get("reset");
  const migrateParam = urlParams.get("migrate");

  // Force migration via URL parameter
  if (resetParam === "true" || migrateParam === "uuid") {
    console.warn("🔄 Migration forced via URL parameter");
    return true;
  }

  // Check localStorage version
  const localVersion = getLocalSchemaVersion();
  // If we've never stored a schema version before, treat this as first-run,
  // not a migration. We'll stamp the version after DB init.
  if (localVersion === null) {
    return false;
  }

  const needsUpdate = localVersion !== CURRENT_SCHEMA_VERSION;

  if (needsUpdate) {
    console.warn(
      `⚠️ Schema version mismatch: local=${localVersion}, current=${CURRENT_SCHEMA_VERSION}`
    );
  }

  return needsUpdate;
}

/**
 * Check if this is a forced reset (user initiated via URL)
 *
 * @returns true if the reset was forced via URL parameter
 */
export function isForcedReset(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("reset") === "true";
}

/**
 * Clear local database tables for migration
 *
 * This is called when a schema migration is detected. It clears all
 * user data tables (preserving reference data like genres/tune types)
 * so the new schema can be populated from Supabase.
 *
 * @param db - The Drizzle database instance
 */
export async function clearLocalDatabaseForMigration(
  db: unknown
): Promise<void> {
  console.log("🔄 Schema migration detected - clearing local database...");

  const drizzleDb = db as {
    delete: <TTable>(table: TTable) => { run: () => unknown };
  };

  try {
    // Import schema tables
    const {
      dailyPracticeQueue,
      practiceRecord,
      repertoireTune: repertoireTune,
      note,
      reference,
      tag,
      tuneOverride,
      repertoire: repertoire,
      tune,
      tableTransientData,
      tabGroupMainState,
    } = await import("./schema");

    // Clear all user data tables (preserve reference data: genre, tuneType, instrument)
    const tablesToClear = [
      dailyPracticeQueue,
      practiceRecord,
      repertoireTune,
      note,
      reference,
      tag,
      tuneOverride,
      repertoire,
      tune, // Clear private tunes, will re-sync public catalog
      tableTransientData,
      tabGroupMainState,
    ];

    for (const table of tablesToClear) {
      try {
        await drizzleDb.delete(table).run();
      } catch (error) {
        console.warn(`Failed to clear table ${table.toString()}:`, error);
        // Continue clearing other tables even if one fails
      }
    }

    console.log("✅ Local database cleared for schema migration");
  } catch (error) {
    console.error("❌ Error clearing local database:", error);
    throw error;
  }
}

/**
 * Clear URL migration parameters after migration completes
 *
 * This removes ?reset=true and ?migrate=uuid from the URL without reloading the page.
 */
export function clearMigrationParams(): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  const hadParams =
    url.searchParams.has("reset") || url.searchParams.has("migrate");

  if (hadParams) {
    url.searchParams.delete("reset");
    url.searchParams.delete("migrate");

    // Replace URL without reload
    window.history.replaceState({}, "", url.toString());
    console.log("✅ Migration URL parameters cleared");
  }
}

/**
 * Get the current schema version constant
 *
 * @returns The current schema version string
 */
export function getCurrentSchemaVersion(): string {
  return CURRENT_SCHEMA_VERSION;
}
