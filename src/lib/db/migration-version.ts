/**
 * Database Schema Migration Version Tracking
 *
 * This module manages schema version tracking for the local SQLite database.
 * When the schema changes (e.g., integer IDs → UUIDs), we need to clear
 * local data and re-sync from Supabase.
 *
 * @module lib/db/migration-version
 */

const CURRENT_SCHEMA_VERSION = "2.0.15-refresh-public-rhythm-patterns"; // Bump this when stale public rhythm catalog rows must be re-pulled without dropping user-owned data

const TARGETED_PUBLIC_RHYTHM_PATTERN_REFRESH_VERSIONS = new Set([
  "2.0.13-fix-sync-change-log-coverage",
  "2.0.14-reset-stale-rhythm-catalog",
]);

function shouldRefreshPublicRhythmPatternsOnly(
  localVersion: string | null
): boolean {
  return TARGETED_PUBLIC_RHYTHM_PATTERN_REFRESH_VERSIONS.has(
    localVersion ?? ""
  );
}

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
  db: unknown,
  context?: {
    rawDb?: {
      run: (sql: string) => unknown;
    };
  }
): Promise<void> {
  console.log("🔄 Schema migration detected - clearing local database...");

  const localVersion = getLocalSchemaVersion();

  if (shouldRefreshPublicRhythmPatternsOnly(localVersion) && context?.rawDb) {
    console.log(
      "🔄 Refreshing public rhythm_patterns rows while preserving user-owned local rows..."
    );

    context.rawDb.run(`
      DELETE FROM rhythm_patterns
      WHERE user_id IS NULL OR TRIM(user_id) = ''
    `);

    console.log("✅ Public rhythm_patterns rows cleared for targeted refresh");
    return;
  }

  const drizzleDb = db as {
    delete: <TTable>(table: TTable) => { run: () => unknown };
  };

  try {
    const tableNames = [
      "daily_practice_queue",
      "genre_tune_type",
      "group_member",
      "media_asset",
      "practice_record",
      "repertoire_tune",
      "note",
      "reference",
      "rhythm_patterns",
      "setlist_item",
      "setlist",
      "tune_set_item",
      "tune_set",
      "tag",
      "tune_override",
      "repertoire",
      "tune",
      "user_genre_selection",
      "tune_type",
      "genre",
      "table_transient_data",
      "tab_group_main_state",
      "user_group",
    ];

    if (context?.rawDb) {
      context.rawDb.run("PRAGMA foreign_keys = OFF");
      try {
        for (const tableName of tableNames) {
          try {
            context.rawDb.run(`DELETE FROM ${tableName}`);
          } catch (error) {
            console.warn(`Failed to clear table ${tableName}:`, error);
          }
        }
      } finally {
        context.rawDb.run("PRAGMA foreign_keys = ON");
      }
    } else {
      // Fallback path when raw SQLite access is unavailable.
      const {
        dailyPracticeQueue,
        genre,
        genreTuneType,
        groupMember,
        mediaAsset,
        practiceRecord,
        repertoireTune,
        note,
        reference,
        rhythmPatterns,
        setlist,
        setlistItem,
        tuneSet,
        tuneSetItem,
        tag,
        tuneOverride,
        repertoire,
        tune,
        tuneType,
        userGenreSelection,
        tableTransientData,
        tabGroupMainState,
        userGroup,
      } = await import("./schema");

      const tablesToClear = [
        dailyPracticeQueue,
        genreTuneType,
        groupMember,
        mediaAsset,
        practiceRecord,
        repertoireTune,
        note,
        reference,
        rhythmPatterns,
        setlistItem,
        setlist,
        tuneSetItem,
        tuneSet,
        tag,
        tuneOverride,
        repertoire,
        tune,
        userGenreSelection,
        tuneType,
        genre,
        tableTransientData,
        tabGroupMainState,
        userGroup,
      ];

      for (const table of tablesToClear) {
        try {
          await drizzleDb.delete(table).run();
        } catch (error) {
          console.warn(`Failed to clear table ${table.toString()}:`, error);
        }
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
