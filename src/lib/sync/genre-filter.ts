import type {
  SyncRequestOverrides,
  SyncResponse,
} from "@oosync/shared/protocol";
import { applyRemoteChangesToLocalDb, WorkerClient } from "@oosync/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as SqlJsDatabase } from "sql.js";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import {
  areSyncTriggersSuppressed,
  enableSyncTriggers,
  suppressSyncTriggers,
} from "@/lib/db/install-triggers";
import {
  getRepertoireGenreDefaultsForUser,
  getRepertoireTuneGenreIdsForUser,
  getUserGenreSelection,
} from "@/lib/db/queries/user-genre-selection";

const DEFAULT_METADATA_TABLES = [
  "user_profile",
  "user_genre_selection",
  "repertoire",
  "instrument",
  "genre", // Required for repertoire.genre_default FK
];

function isNetworkSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Failed to fetch") ||
    message.includes("ERR_INTERNET_DISCONNECTED") ||
    message.includes("NetworkError") ||
    message.includes("Timed out while waiting for an open slot in the pool") ||
    message.includes("Sync failed: 503")
  );
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function quoteSqlString(value: string): string {
  return `'${escapeSqlString(value)}'`;
}

function readFirstColumn(sqliteDb: SqlJsDatabase, query: string): string[] {
  const result = sqliteDb.exec(query);
  return (result[0]?.values ?? [])
    .map((row) => row[0])
    .filter((value): value is string => typeof value === "string");
}

function readCount(sqliteDb: SqlJsDatabase, query: string): number {
  const result = sqliteDb.exec(query);
  const rawCount = result[0]?.values?.[0]?.[0];
  return typeof rawCount === "number" ? rawCount : Number(rawCount ?? 0);
}

function deleteRowsWithoutSyncArtifacts(
  sqliteDb: SqlJsDatabase,
  tableName: string,
  rowIds: string[]
): number {
  if (rowIds.length === 0) {
    return 0;
  }

  const quotedIds = rowIds.map(quoteSqlString).join(", ");
  sqliteDb.run(`
    DELETE FROM sync_push_queue
    WHERE table_name = ${quoteSqlString(tableName)}
      AND row_id IN (${quotedIds})
  `);
  sqliteDb.run(`DELETE FROM ${tableName} WHERE id IN (${quotedIds})`);
  return rowIds.length;
}

export function repairPendingMediaAssetSyncStateInSqlite(
  sqliteDb: SqlJsDatabase
): {
  requeuedReferenceCount: number;
  prunedMediaAssetCount: number;
  clearedMediaAssetOutboxCount: number;
} {
  const pendingRows = sqliteDb.exec(`
    SELECT DISTINCT
      q.row_id,
      CASE WHEN m.id IS NULL THEN 0 ELSE 1 END AS has_media_asset,
      COALESCE(m.reference_ref, '') AS reference_ref,
      CASE WHEN r.id IS NULL THEN 0 ELSE 1 END AS has_reference
    FROM sync_push_queue q
    LEFT JOIN media_asset m
      ON m.id = q.row_id
    LEFT JOIN reference r
      ON r.id = m.reference_ref
    WHERE q.table_name = 'media_asset'
      AND q.status IN ('pending', 'in_progress', 'failed')
  `);

  const rows = pendingRows[0]?.values ?? [];
  const mediaAssetRowIdsToClear = new Set<string>();
  const orphanedMediaAssetIds = new Set<string>();
  const parentReferenceIds = new Set<string>();

  for (const row of rows) {
    const rowId = typeof row[0] === "string" ? row[0] : "";
    const hasMediaAsset = Number(row[1] ?? 0) === 1;
    const referenceRef =
      typeof row[2] === "string" && row[2].length > 0 ? row[2] : null;
    const hasReference = Number(row[3] ?? 0) === 1;

    if (!rowId) {
      continue;
    }

    if (!hasMediaAsset) {
      mediaAssetRowIdsToClear.add(rowId);
      continue;
    }

    if (!referenceRef || !hasReference) {
      mediaAssetRowIdsToClear.add(rowId);
      orphanedMediaAssetIds.add(rowId);
      continue;
    }

    parentReferenceIds.add(referenceRef);
  }

  const queuedReferenceIds = new Set(
    parentReferenceIds.size === 0
      ? []
      : readFirstColumn(
          sqliteDb,
          `
            SELECT DISTINCT row_id
            FROM sync_push_queue
            WHERE table_name = 'reference'
              AND status IN ('pending', 'in_progress', 'failed')
              AND row_id IN (${Array.from(parentReferenceIds)
                .map(quoteSqlString)
                .join(", ")})
          `
        )
  );

  const nowIso = new Date().toISOString();
  const referenceIdsToQueue = Array.from(parentReferenceIds).filter(
    (referenceId) => !queuedReferenceIds.has(referenceId)
  );

  for (const referenceId of referenceIdsToQueue) {
    sqliteDb.run(`
      INSERT INTO sync_push_queue (
        id,
        table_name,
        row_id,
        operation,
        status,
        changed_at,
        attempts,
        last_error,
        synced_at
      ) VALUES (
        ${quoteSqlString(crypto.randomUUID())},
        'reference',
        ${quoteSqlString(referenceId)},
        'UPDATE',
        'pending',
        ${quoteSqlString(nowIso)},
        0,
        NULL,
        NULL
      )
    `);
  }

  const mediaAssetIdsToDelete = Array.from(orphanedMediaAssetIds);
  const mediaAssetQueueIdsToDelete = Array.from(mediaAssetRowIdsToClear);
  const clearedMediaAssetOutboxCount =
    mediaAssetQueueIdsToDelete.length === 0
      ? 0
      : readCount(
          sqliteDb,
          `
            SELECT COUNT(*)
            FROM sync_push_queue
            WHERE table_name = 'media_asset'
              AND row_id IN (${mediaAssetQueueIdsToDelete
                .map(quoteSqlString)
                .join(", ")})
          `
        );

  const wasSuppressed = areSyncTriggersSuppressed(sqliteDb);
  if (!wasSuppressed) {
    suppressSyncTriggers(sqliteDb);
  }

  try {
    if (mediaAssetQueueIdsToDelete.length > 0) {
      sqliteDb.run(`
        DELETE FROM sync_push_queue
        WHERE table_name = 'media_asset'
          AND row_id IN (${mediaAssetQueueIdsToDelete
            .map(quoteSqlString)
            .join(", ")})
      `);
    }

    if (mediaAssetIdsToDelete.length > 0) {
      sqliteDb.run(`
        DELETE FROM media_asset
        WHERE id IN (${mediaAssetIdsToDelete.map(quoteSqlString).join(", ")})
      `);
    }
  } finally {
    if (!wasSuppressed) {
      enableSyncTriggers(sqliteDb);
    }
  }

  return {
    requeuedReferenceCount: referenceIdsToQueue.length,
    prunedMediaAssetCount: mediaAssetIdsToDelete.length,
    clearedMediaAssetOutboxCount,
  };
}

export async function repairPendingMediaAssetSyncState(): Promise<{
  requeuedReferenceCount: number;
  prunedMediaAssetCount: number;
  clearedMediaAssetOutboxCount: number;
}> {
  const { getSqliteInstance, persistDb } = await import(
    "@/lib/db/client-sqlite"
  );
  const sqliteDb = await getSqliteInstance();
  if (!sqliteDb) {
    throw new Error("SQLite instance not available");
  }

  const result = repairPendingMediaAssetSyncStateInSqlite(sqliteDb);
  if (
    result.requeuedReferenceCount > 0 ||
    result.prunedMediaAssetCount > 0 ||
    result.clearedMediaAssetOutboxCount > 0
  ) {
    await persistDb();
  }

  return result;
}

function collectPendingSetlistDependencyRepairs(sqliteDb: SqlJsDatabase): {
  setlistRequiredAt: Map<string, string>;
  tuneSetRequiredAt: Map<string, string>;
  groupRequiredAt: Map<string, string>;
} {
  const setlistRequiredAt = new Map<string, string>();
  const tuneSetRequiredAt = new Map<string, string>();
  const groupRequiredAt = new Map<string, string>();

  const rememberEarliest = (
    target: Map<string, string>,
    rowId: string,
    changedAt: string
  ) => {
    const current = target.get(rowId);
    if (!current || changedAt < current) {
      target.set(rowId, changedAt);
    }
  };

  const pendingSetlists = sqliteDb.exec(`
    SELECT q.row_id, p.group_ref, MIN(q.changed_at) AS required_changed_at
    FROM sync_push_queue q
    INNER JOIN setlist p ON p.id = q.row_id
    INNER JOIN user_group ug ON ug.id = p.group_ref
    WHERE q.table_name = 'setlist'
      AND q.status IN ('pending', 'in_progress', 'failed')
      AND lower(q.operation) != 'delete'
      AND COALESCE(p.deleted, 0) = 0
      AND COALESCE(ug.deleted, 0) = 0
    GROUP BY q.row_id, p.group_ref
  `);

  for (const row of pendingSetlists[0]?.values ?? []) {
    const setlistId = typeof row[0] === "string" ? row[0] : "";
    const groupId = typeof row[1] === "string" ? row[1] : "";
    const requiredChangedAt = typeof row[2] === "string" ? row[2] : "";

    if (!setlistId || !groupId || !requiredChangedAt) {
      continue;
    }

    rememberEarliest(groupRequiredAt, groupId, requiredChangedAt);
  }

  const pendingSetlistItems = sqliteDb.exec(`
    SELECT
      pi.setlist_ref,
      p.group_ref,
      pi.tune_set_ref,
      ts.group_ref,
      MIN(q.changed_at) AS required_changed_at
    FROM sync_push_queue q
    INNER JOIN setlist_item pi ON pi.id = q.row_id
    INNER JOIN setlist p ON p.id = pi.setlist_ref
    INNER JOIN user_group ug ON ug.id = p.group_ref
    LEFT JOIN tune_set ts ON ts.id = pi.tune_set_ref
    WHERE q.table_name = 'setlist_item'
      AND q.status IN ('pending', 'in_progress', 'failed')
      AND lower(q.operation) != 'delete'
      AND COALESCE(pi.deleted, 0) = 0
      AND COALESCE(p.deleted, 0) = 0
      AND COALESCE(ug.deleted, 0) = 0
      AND (pi.tune_set_ref IS NULL OR COALESCE(ts.deleted, 0) = 0)
    GROUP BY pi.setlist_ref, p.group_ref, pi.tune_set_ref, ts.group_ref
  `);

  for (const row of pendingSetlistItems[0]?.values ?? []) {
    const setlistId = typeof row[0] === "string" ? row[0] : "";
    const groupId = typeof row[1] === "string" ? row[1] : "";
    const tuneSetId = typeof row[2] === "string" ? row[2] : "";
    const tuneSetGroupId = typeof row[3] === "string" ? row[3] : "";
    const requiredChangedAt = typeof row[4] === "string" ? row[4] : "";

    if (!setlistId || !groupId || !requiredChangedAt) {
      continue;
    }

    rememberEarliest(setlistRequiredAt, setlistId, requiredChangedAt);
    rememberEarliest(groupRequiredAt, groupId, requiredChangedAt);

    if (tuneSetId) {
      rememberEarliest(tuneSetRequiredAt, tuneSetId, requiredChangedAt);
    }
    if (tuneSetGroupId) {
      rememberEarliest(groupRequiredAt, tuneSetGroupId, requiredChangedAt);
    }
  }

  return { setlistRequiredAt, tuneSetRequiredAt, groupRequiredAt };
}

function ensurePendingOutboxEntry(
  sqliteDb: SqlJsDatabase,
  tableName: "setlist" | "tune_set" | "user_group",
  rowId: string,
  requiredChangedAt: string
): boolean {
  const existingRows = sqliteDb.exec(`
    SELECT status, changed_at
    FROM sync_push_queue
    WHERE table_name = ${quoteSqlString(tableName)}
      AND row_id = ${quoteSqlString(rowId)}
  `);

  const rows = existingRows[0]?.values ?? [];
  const hasUsablePendingRow = rows.some(
    (row) =>
      row[0] === "pending" &&
      typeof row[1] === "string" &&
      row[1] <= requiredChangedAt
  );

  if (hasUsablePendingRow) {
    return false;
  }

  sqliteDb.run(`
    DELETE FROM sync_push_queue
    WHERE table_name = ${quoteSqlString(tableName)}
      AND row_id = ${quoteSqlString(rowId)}
  `);

  sqliteDb.run(`
    INSERT INTO sync_push_queue (
      id,
      table_name,
      row_id,
      operation,
      status,
      changed_at,
      attempts,
      last_error,
      synced_at
    ) VALUES (
      ${quoteSqlString(crypto.randomUUID())},
      ${quoteSqlString(tableName)},
      ${quoteSqlString(rowId)},
      'UPDATE',
      'pending',
      ${quoteSqlString(requiredChangedAt)},
      0,
      NULL,
      NULL
    )
  `);

  return true;
}

export function repairPendingSetlistSyncStateInSqlite(
  sqliteDb: SqlJsDatabase
): {
  requeuedSetlistCount: number;
  requeuedTuneSetCount: number;
  requeuedGroupCount: number;
} {
  const { setlistRequiredAt, tuneSetRequiredAt, groupRequiredAt } =
    collectPendingSetlistDependencyRepairs(sqliteDb);

  let requeuedSetlistCount = 0;
  let requeuedTuneSetCount = 0;
  let requeuedGroupCount = 0;

  for (const [setlistId, requiredChangedAt] of setlistRequiredAt.entries()) {
    if (
      ensurePendingOutboxEntry(
        sqliteDb,
        "setlist",
        setlistId,
        requiredChangedAt
      )
    ) {
      requeuedSetlistCount += 1;
    }
  }

  for (const [tuneSetId, requiredChangedAt] of tuneSetRequiredAt.entries()) {
    if (
      ensurePendingOutboxEntry(
        sqliteDb,
        "tune_set",
        tuneSetId,
        requiredChangedAt
      )
    ) {
      requeuedTuneSetCount += 1;
    }
  }

  for (const [groupId, requiredChangedAt] of groupRequiredAt.entries()) {
    if (
      ensurePendingOutboxEntry(
        sqliteDb,
        "user_group",
        groupId,
        requiredChangedAt
      )
    ) {
      requeuedGroupCount += 1;
    }
  }

  return {
    requeuedSetlistCount,
    requeuedTuneSetCount,
    requeuedGroupCount,
  };
}

export async function repairPendingSetlistSyncState(): Promise<{
  requeuedSetlistCount: number;
  requeuedTuneSetCount: number;
  requeuedGroupCount: number;
}> {
  const { getSqliteInstance, persistDb } = await import(
    "@/lib/db/client-sqlite"
  );
  const sqliteDb = await getSqliteInstance();
  if (!sqliteDb) {
    throw new Error("SQLite instance not available");
  }

  const result = repairPendingSetlistSyncStateInSqlite(sqliteDb);
  if (
    result.requeuedSetlistCount > 0 ||
    result.requeuedTuneSetCount > 0 ||
    result.requeuedGroupCount > 0
  ) {
    await persistDb();
  }

  return result;
}

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

  const pullTables = async (tablesToPull: string[]): Promise<boolean> => {
    if (tablesToPull.length === 0) return true;

    let pullCursor: string | undefined;
    let syncStartedAt: string | undefined;

    do {
      let response: SyncResponse;
      try {
        response = await workerClient.sync([], lastSyncAt ?? undefined, {
          pullCursor,
          syncStartedAt,
          pageSize: 200,
          overrides: {
            pullTables: tablesToPull,
          },
        });
      } catch (error) {
        if (isNetworkSyncError(error)) {
          console.warn(
            "[GenreFilter] Metadata pre-sync skipped due network error; continuing with best-effort local metadata"
          );
          return false;
        }
        throw error;
      }

      // FK constraints may require multiple passes (e.g., instrument must exist before repertoire can reference it)
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

    return true;
  };

  const uniqueTables = Array.from(new Set(tables));
  const hasUserProfile = uniqueTables.includes("user_profile");
  const remainingTables = uniqueTables.filter(
    (table) => table !== "user_profile"
  );

  if (hasUserProfile) {
    const userProfilePulled = await pullTables(["user_profile"]);
    if (!userProfilePulled) {
      return;
    }
  }

  await pullTables(remainingTables);
}

async function getEffectiveGenreFilterInitialSync(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  userId: string;
}): Promise<{ effective: string[] }> {
  const { db, supabase, userId } = params;

  // Query LOCAL db for user genre selection and repertoire defaults
  // Note: preSyncMetadataViaWorker already synced user_genre_selection, repertoire, and instrument
  const [selectedGenres, repertoireDefaultGenres] = await Promise.all([
    getUserGenreSelection(db, userId),
    getRepertoireGenreDefaultsForUser(db, userId),
  ]);

  const { data, error } = await supabase.rpc(
    "get_repertoire_tune_genres_for_user",
    {
      p_user_id: userId,
    }
  );

  if (error) {
    console.error(`[GenreFilter] RPC error:`, error);
    throw new Error(
      `[GenreFilter] Failed to query repertoire_tune genres: ${error.message}`
    );
  }

  const repertoireTuneGenres = Array.isArray(data)
    ? data
        .map((genre) => (genre == null ? null : String(genre)))
        .filter((genre): genre is string => typeof genre === "string")
    : [];

  const effective = new Set([
    ...selectedGenres.map(String),
    ...repertoireDefaultGenres.map(String),
    ...repertoireTuneGenres.map(String),
  ]);

  return {
    effective: Array.from(effective),
  };
}

async function getEffectiveGenreFilterIncrementalSync(params: {
  db: SqliteDatabase;
  userId: string;
}): Promise<{ effective: string[] }> {
  const { db, userId } = params;

  const [selectedGenres, repertoireDefaultGenres, repertoireTuneGenres] =
    await Promise.all([
      getUserGenreSelection(db, userId),
      getRepertoireGenreDefaultsForUser(db, userId),
      getRepertoireTuneGenreIdsForUser(db, userId),
    ]);

  const effective = new Set([
    ...selectedGenres.map(String),
    ...repertoireDefaultGenres.map(String),
    ...repertoireTuneGenres.map(String),
  ]);

  return {
    effective: Array.from(effective),
  };
}

export async function buildGenreFilterOverrides(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  userId: string;
  isInitialSync: boolean;
}): Promise<SyncRequestOverrides | null> {
  const { db, supabase, userId, isInitialSync } = params;

  const { effective } = isInitialSync
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
    collectionsOverride: {
      selectedGenres: effective,
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
  const wasSuppressed = areSyncTriggersSuppressed(sqliteDb);
  if (!wasSuppressed) {
    suppressSyncTriggers(sqliteDb);
  }

  try {
    for (const tableName of tables) {
      const orphanIds = readFirstColumn(
        sqliteDb,
        `
          SELECT id
          FROM ${tableName}
          WHERE tune_ref NOT IN (
            SELECT id FROM tune WHERE deleted = 0
          )
        `
      );

      deletedCounts[tableName] = deleteRowsWithoutSyncArtifacts(
        sqliteDb,
        tableName,
        orphanIds
      );

      if (deletedCounts[tableName] > 0) {
        console.log(
          `[GenreFilter] Purged ${deletedCounts[tableName]} orphaned ${tableName} records`
        );
      }
    }

    const orphanedMediaAssetIds = readFirstColumn(
      sqliteDb,
      `
        SELECT id
        FROM media_asset
        WHERE reference_ref NOT IN (
          SELECT id FROM reference WHERE deleted = 0
        )
      `
    );

    deletedCounts.media_asset = deleteRowsWithoutSyncArtifacts(
      sqliteDb,
      "media_asset",
      orphanedMediaAssetIds
    );

    if (deletedCounts.media_asset > 0) {
      console.log(
        `[GenreFilter] Purged ${deletedCounts.media_asset} orphaned media_asset records`
      );
    }
  } finally {
    if (!wasSuppressed) {
      enableSyncTriggers(sqliteDb);
    }
  }

  return { deletedCounts };
}
