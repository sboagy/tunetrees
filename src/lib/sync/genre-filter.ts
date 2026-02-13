import type { SyncRequestOverrides } from "@oosync/shared/protocol";
import { applyRemoteChangesToLocalDb, WorkerClient } from "@oosync/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  getPlaylistGenreDefaultsForUser,
  getRepertoireTuneGenreIdsForUser,
  getUserGenreSelection,
} from "@/lib/db/queries/user-genre-selection";

const DEFAULT_METADATA_TABLES = [
  "user_profile",
  "user_genre_selection",
  "playlist",
  "instrument",
  "genre", // Required for playlist.genre_default FK
];

export async function preSyncMetadataViaWorker(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  tables?: string[];
  lastSyncAt?: string | null;
  userId?: string; // For debug logging only
}): Promise<void> {
  const { db, supabase, tables = DEFAULT_METADATA_TABLES, lastSyncAt } = params;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("No active session for metadata pre-sync");
  }

  const workerClient = new WorkerClient(session.access_token);

  const pullTables = async (tablesToPull: string[]): Promise<void> => {
    if (tablesToPull.length === 0) return;

    let pullCursor: string | undefined;
    let syncStartedAt: string | undefined;

    do {
      const response = await workerClient.sync([], lastSyncAt ?? undefined, {
        pullCursor,
        syncStartedAt,
        pageSize: 200,
        overrides: {
          pullTables: tablesToPull,
        },
      });

      // FK constraints may require multiple passes (e.g., instrument must exist before playlist can reference it)
      const deferredChanges: typeof response.changes = [];

      const applyResult = await applyRemoteChangesToLocalDb({
        localDb: db,
        changes: response.changes,
        deferForeignKeyFailuresTo: deferredChanges,
      });

      // Check for non-FK failures
      if (applyResult.failed > 0) {
        console.error(
          `[GenreFilter] Failed to apply ${applyResult.failed} metadata changes (non-FK errors)`
        );
      }

      // Retry deferred changes (FK dependencies should now be resolved)
      if (deferredChanges.length > 0) {
        const retryResult = await applyRemoteChangesToLocalDb({
          localDb: db,
          changes: deferredChanges,
        });

        if (retryResult.failed > 0) {
          console.error(
            `[GenreFilter] Failed to apply ${retryResult.failed} deferred metadata changes after retry`
          );
        }
      }

      pullCursor = response.nextCursor;
      syncStartedAt = response.syncStartedAt ?? syncStartedAt;
    } while (pullCursor);
  };

  const uniqueTables = Array.from(new Set(tables));
  const hasUserProfile = uniqueTables.includes("user_profile");
  const remainingTables = uniqueTables.filter(
    (table) => table !== "user_profile"
  );

  if (hasUserProfile) {
    await pullTables(["user_profile"]);
  }

  await pullTables(remainingTables);
}

async function getEffectiveGenreFilterInitialSync(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ effective: string[]; repertoireGenres: string[] }> {
  const { db, supabase, userId } = params;

  // Query LOCAL db for user genre selection and repertoire defaults
  // Note: preSyncMetadataViaWorker already synced user_genre_selection, repertoire, and instrument
  const [selectedGenres, repertoireDefaultGenres] = await Promise.all([
    getUserGenreSelection(db, userId),
    getPlaylistGenreDefaultsForUser(db, userId),
  ]);

  const { data, error } = await supabase.rpc(
    "get_playlist_tune_genres_for_user",
    {
      p_user_id: userId,
    }
  );

  if (error) {
    console.error(`[GenreFilter] RPC error:`, error);
    throw new Error(
      `[GenreFilter] Failed to query playlist_tune genres: ${error.message}`
    );
  }

  const playlistTuneGenres = Array.isArray(data)
    ? data
        .map((genre) => (genre == null ? null : String(genre)))
        .filter((genre): genre is string => typeof genre === "string")
    : [];

  const effective = new Set([
    ...selectedGenres.map(String),
    ...repertoireDefaultGenres.map(String),
    ...playlistTuneGenres.map(String),
  ]);

  return {
    effective: Array.from(effective),
    repertoireGenres: Array.from(new Set(playlistTuneGenres.map(String))),
  };
}

async function getEffectiveGenreFilterIncrementalSync(params: {
  db: SqliteDatabase;
  userId: string;
}): Promise<{ effective: string[]; repertoireGenres: string[] }> {
  const { db, userId } = params;

  const [selectedGenres, repertoireDefaultGenres, repertoireTuneGenres] =
    await Promise.all([
      getUserGenreSelection(db, userId),
      getPlaylistGenreDefaultsForUser(db, userId),
      getRepertoireTuneGenreIdsForUser(db, userId),
    ]);

  const effective = new Set([
    ...selectedGenres.map(String),
    ...repertoireDefaultGenres.map(String),
    ...repertoireTuneGenres.map(String),
  ]);

  return {
    effective: Array.from(effective),
    repertoireGenres: Array.from(new Set(repertoireTuneGenres.map(String))),
  };
}

export async function buildGenreFilterOverrides(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  userId: string;
  isInitialSync: boolean;
}): Promise<SyncRequestOverrides | null> {
  const { db, supabase, userId, isInitialSync } = params;

  const { effective, repertoireGenres } = isInitialSync
    ? await getEffectiveGenreFilterInitialSync({ db, supabase, userId })
    : await getEffectiveGenreFilterIncrementalSync({ db, userId });

  if (effective.length === 0) {
    console.warn(
      `[GenreFilter] ⚠️  No genres selected - for INITIAL sync, returning null means pull ALL public catalog data`
    );
    // For initial sync with no genres: return null to let worker pull all public data
    // This handles the case where user hasn't selected genres yet or cleared their repertoire
    return null;
  }

  return {
    genreFilter: {
      selectedGenreIds: effective,
      repertoireGenreIds: repertoireGenres,
    },
  };
}

/**
 * Purges orphaned annotations (notes, references) from local SQLite.
 *
 * ONLY call when user removes genres via Settings → Catalog & Sync tab.
 * Called AFTER sync completes to clean up orphaned records.
 *
 * Orphaned records are those with tune_ref pointing to tunes that no longer
 * exist in the local database (filtered out by genre selection).
 */
export async function purgeOrphanedAnnotations(
  _db: SqliteDatabase
): Promise<{ deletedCounts: Record<string, number> }> {
  const { getSqliteInstance } = await import("@/lib/db/client-sqlite");
  const sqliteDb = await getSqliteInstance();
  if (!sqliteDb) {
    throw new Error("SQLite instance not available");
  }

  const tables = ["note", "reference"] as const; // NOT practice_record - filtered by repertoire
  const deletedCounts: Record<string, number> = {};

  for (const tableName of tables) {
    // Count orphaned rows before deletion
    const countResult = sqliteDb.exec(`
      SELECT COUNT(*) as count
      FROM ${tableName}
      WHERE tune_ref NOT IN (
        SELECT id FROM tune WHERE deleted = 0
      )
    `);

    const orphanCount = (countResult[0]?.values[0]?.[0] as number) ?? 0;

    // Delete rows where tune_ref is NOT in the tune table (orphaned)
    if (orphanCount > 0) {
      sqliteDb.run(`
        DELETE FROM ${tableName}
        WHERE tune_ref NOT IN (
          SELECT id FROM tune WHERE deleted = 0
        )
      `);
    }

    deletedCounts[tableName] = orphanCount;

    if (deletedCounts[tableName] > 0) {
      console.log(
        `[GenreFilter] Purged ${deletedCounts[tableName]} orphaned ${tableName} records`
      );
    }
  }

  return { deletedCounts };
}
