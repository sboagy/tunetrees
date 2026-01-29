import type { SyncRequestOverrides } from "@oosync/shared/protocol";
import {
  applyRemoteChangesToLocalDb,
  backfillOutboxSince,
  WorkerClient,
} from "@oosync/sync";
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
];

export async function preSyncMetadataViaWorker(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  tables?: string[];
  lastSyncAt?: string | null;
  userId: string;
}): Promise<void> {
  const {
    db,
    supabase,
    tables = DEFAULT_METADATA_TABLES,
    lastSyncAt,
    userId,
  } = params;
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

      await applyRemoteChangesToLocalDb({
        localDb: db,
        changes: response.changes,
        // Backfill any local writes that occurred during trigger suppression
        onTriggersRestored: async (triggersSuppressedAt) => {
          const backfilled = await backfillOutboxSince(
            db,
            triggersSuppressedAt,
            tablesToPull, // Only backfill the tables we just synced
            `preSyncMeta_${userId.substring(0, 8)}`
          );
          if (backfilled > 0) {
            console.log(
              `[GenreFilter] Backfilled ${backfilled} outbox entries during metadata pre-sync`
            );
          }
        },
      });

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
}): Promise<{ effective: string[]; playlistGenres: string[] }> {
  const { db, supabase, userId } = params;

  const [selectedGenres, playlistDefaultGenres] = await Promise.all([
    getUserGenreSelection(db, userId),
    getPlaylistGenreDefaultsForUser(db, userId),
  ]);

  console.log(
    `[GenreFilter] Initial sync: selectedGenres=${selectedGenres.length}, playlistDefaults=${playlistDefaultGenres.length}`
  );

  const { data, error } = await supabase.rpc(
    "get_playlist_tune_genres_for_user",
    {
      p_user_id: userId,
    }
  );

  if (error) {
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
    ...playlistDefaultGenres.map(String),
    ...playlistTuneGenres.map(String),
  ]);

  return {
    effective: Array.from(effective),
    playlistGenres: Array.from(new Set(playlistTuneGenres.map(String))),
  };
}

async function getEffectiveGenreFilterIncrementalSync(params: {
  db: SqliteDatabase;
  userId: string;
}): Promise<{ effective: string[]; playlistGenres: string[] }> {
  const { db, userId } = params;

  const [selectedGenres, playlistDefaultGenres, playlistTuneGenres] =
    await Promise.all([
      getUserGenreSelection(db, userId),
      getPlaylistGenreDefaultsForUser(db, userId),
      getRepertoireTuneGenreIdsForUser(db, userId),
    ]);

  const effective = new Set([
    ...selectedGenres.map(String),
    ...playlistDefaultGenres.map(String),
    ...playlistTuneGenres.map(String),
  ]);

  return {
    effective: Array.from(effective),
    playlistGenres: Array.from(new Set(playlistTuneGenres.map(String))),
  };
}

export async function buildGenreFilterOverrides(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  userId: string;
  isInitialSync: boolean;
}): Promise<SyncRequestOverrides | null> {
  const { db, supabase, userId, isInitialSync } = params;

  console.log(
    `[GenreFilter] buildGenreFilterOverrides called: isInitialSync=${isInitialSync}, userId=${userId}`
  );

  const { effective, playlistGenres } = isInitialSync
    ? await getEffectiveGenreFilterInitialSync({ db, supabase, userId })
    : await getEffectiveGenreFilterIncrementalSync({ db, userId });

  console.log(
    `[GenreFilter] Effective genres: ${effective.length} (${effective.join(", ")}), playlist genres: ${playlistGenres.length}`
  );

  if (effective.length === 0) {
    console.log(
      `[GenreFilter] ⚠️  No genres selected - returning null (catalog will sync ALL tunes or be skipped)`
    );
    return null;
  }

  console.log(
    `[GenreFilter] ✅ Genre filter active: ${effective.length} genres selected`
  );
  return {
    genreFilter: {
      selectedGenreIds: effective,
      playlistGenreIds: playlistGenres,
    },
  };
}
