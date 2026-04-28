import {
  ensureColumnExists,
  type IBrowserSqliteHooks,
  type SqliteRawDatabase,
} from "oosync/runtime/browser-sqlite";
import { log } from "../logger";
import { initializeViewColumnMeta } from "./init-view-column-meta";
import { initializeViews, recreateViews } from "./init-views";
import { clearLocalDatabaseForMigration } from "./migration-version";

function ensureTuneTreesCompatibilityObjects(rawDb: SqliteRawDatabase): void {
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS sync_change_log (
      table_name TEXT PRIMARY KEY NOT NULL,
      changed_at TEXT NOT NULL
    )
  `);
  rawDb.run(
    "CREATE INDEX IF NOT EXISTS idx_sync_change_log_changed_at ON sync_change_log(changed_at)"
  );

  ensureColumnExists(
    rawDb,
    "user_profile",
    "avatar_url",
    "avatar_url text",
    log
  );

  ensureColumnExists(rawDb, "tune", "composer", "composer text", log);
  ensureColumnExists(rawDb, "tune", "artist", "artist text", log);
  ensureColumnExists(rawDb, "tune", "id_foreign", "id_foreign text", log);
  ensureColumnExists(
    rawDb,
    "tune",
    "release_year",
    "release_year integer",
    log
  );

  ensureColumnExists(rawDb, "tune_override", "composer", "composer text", log);
  ensureColumnExists(rawDb, "tune_override", "artist", "artist text", log);
  ensureColumnExists(
    rawDb,
    "tune_override",
    "id_foreign",
    "id_foreign text",
    log
  );
  ensureColumnExists(
    rawDb,
    "tune_override",
    "release_year",
    "release_year integer",
    log
  );

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS view_column_meta (
      view_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      description TEXT NOT NULL,
      PRIMARY KEY (view_name, column_name)
    )
  `);
  rawDb.run(
    "CREATE INDEX IF NOT EXISTS idx_view_column_meta_view ON view_column_meta(view_name)"
  );

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS media_draft_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      user_ref TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  rawDb.run(
    "CREATE INDEX IF NOT EXISTS idx_media_draft_outbox_user_created ON media_draft_outbox(user_ref, created_at)"
  );

  rawDb.run(`
    CREATE TABLE IF NOT EXISTS user_genre_selection (
      user_id TEXT NOT NULL REFERENCES user_profile(id) ON DELETE CASCADE,
      genre_id TEXT NOT NULL REFERENCES genre(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_modified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sync_version INTEGER NOT NULL DEFAULT 1,
      device_id TEXT,
      PRIMARY KEY (user_id, genre_id)
    )
  `);
  rawDb.run(
    "CREATE INDEX IF NOT EXISTS idx_user_genre_selection_user_id ON user_genre_selection(user_id)"
  );
  rawDb.run(
    "CREATE INDEX IF NOT EXISTS idx_user_genre_selection_genre_id ON user_genre_selection(genre_id)"
  );
  ensureColumnExists(
    rawDb,
    "user_genre_selection",
    "created_at",
    "created_at text not null default CURRENT_TIMESTAMP",
    log
  );
  ensureColumnExists(
    rawDb,
    "user_genre_selection",
    "last_modified_at",
    "last_modified_at text not null default CURRENT_TIMESTAMP",
    log
  );
  ensureColumnExists(
    rawDb,
    "user_genre_selection",
    "sync_version",
    "sync_version integer not null default 1",
    log
  );
  ensureColumnExists(
    rawDb,
    "user_genre_selection",
    "device_id",
    "device_id text",
    log
  );
}

export const browserSqliteHooks: IBrowserSqliteHooks = {
  logger: log,
  onExistingDatabaseLoaded: async (db) => {
    await recreateViews(db);
  },
  onDatabaseReady: async (db, context) => {
    if (context.phase === "created") {
      await initializeViews(db);
    }
    await initializeViewColumnMeta(db);
    ensureTuneTreesCompatibilityObjects(context.rawDb);
  },
  clearLocalDataForMigration: clearLocalDatabaseForMigration,
};
