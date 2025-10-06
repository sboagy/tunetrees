/**
 * SQLite Database Views Initialization
 *
 * Creates essential database views in the local SQLite WASM database.
 * These views aggregate data from multiple tables for efficient querying.
 *
 * Views created:
 * 1. view_playlist_joined - Playlists with instrument info
 * 2. practice_list_joined - Tunes with practice records and metadata
 * 3. practice_list_staged - Extended practice view with transient data
 *
 * Note: SQLite syntax differs from PostgreSQL:
 * - No STRING_AGG() - use GROUP_CONCAT() instead
 * - No DISTINCT ON() - use subqueries with MAX/MIN
 * - Boolean as INTEGER (0/1)
 *
 * @module lib/db/init-views
 */

import type { SqliteDatabase } from "./client-sqlite";

/**
 * View 1: Playlist with Instrument Information
 *
 * Joins playlists with their instrument details.
 * Used for playlist selection and display.
 */
const VIEW_PLAYLIST_JOINED = `
CREATE VIEW IF NOT EXISTS view_playlist_joined AS
SELECT
  p.playlist_id,
  p.user_ref,
  p.deleted AS playlist_deleted,
  p.instrument_ref,
  i.private_to_user,
  i.instrument,
  i.description,
  i.genre_default,
  i.deleted AS instrument_deleted
FROM
  playlist p
  JOIN instrument i ON p.instrument_ref = i.id
`;

/**
 * View 2: Practice List with Latest Practice Record
 *
 * Aggregates tunes with their latest practice records, tags, notes, and references.
 * This is the main view for practice queue and tune grids.
 *
 * SQLite differences from PostgreSQL version:
 * - Uses GROUP_CONCAT(tag.tag_text, ' ') instead of STRING_AGG()
 * - Uses subquery with MAX(id) instead of DISTINCT ON()
 * - Boolean fields as INTEGER (0/1)
 */
const PRACTICE_LIST_JOINED = `
CREATE VIEW IF NOT EXISTS practice_list_joined AS
SELECT
  tune.id AS id,
  COALESCE(tune_override.title, tune.title) AS title,
  COALESCE(tune_override.type, tune.type) AS type,
  COALESCE(tune_override.structure, tune.structure) AS structure,
  COALESCE(tune_override.mode, tune.mode) AS mode,
  COALESCE(tune_override.incipit, tune.incipit) AS incipit,
  COALESCE(tune_override.genre_ref, tune.genre_ref) AS genre_ref,
  tune.deleted,
  tune.private_for,
  playlist_tune.learned AS learned,
  playlist_tune.goal,
  playlist_tune.current AS scheduled,
  practice_record.state AS latest_state,
  practice_record.practiced AS latest_practiced,
  practice_record.quality AS latest_quality,
  practice_record.easiness AS latest_easiness,
  practice_record.difficulty AS latest_difficulty,
  practice_record.interval AS latest_interval,
  practice_record.stability AS latest_stability,
  practice_record.step AS latest_step,
  practice_record.repetitions AS latest_repetitions,
  practice_record.due AS latest_due,
  practice_record.goal AS latest_goal,
  practice_record.technique AS latest_technique,
  (
    SELECT GROUP_CONCAT(tag.tag_text, ' ')
    FROM tag
    WHERE tag.tune_ref = tune.id
      AND tag.user_ref = playlist.user_ref
  ) AS tags,
  playlist_tune.playlist_ref,
  playlist.user_ref,
  playlist_tune.deleted AS playlist_deleted,
  (
    SELECT GROUP_CONCAT(note.note_text, ' ')
    FROM note
    WHERE note.tune_ref = tune.id
      AND note.user_ref = playlist.user_ref
  ) AS notes,
  (
    SELECT ref.url
    FROM reference ref
    WHERE ref.tune_ref = tune.id
      AND ref.user_ref = playlist.user_ref
      AND ref.favorite = 1
    LIMIT 1
  ) AS favorite_url,
  CASE
    WHEN tune_override.user_ref = playlist.user_ref THEN 1
    ELSE 0
  END AS has_override
FROM
  tune
  LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
  LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
  LEFT JOIN (
    SELECT pr.*
    FROM practice_record pr
    INNER JOIN (
      SELECT tune_ref, playlist_ref, MAX(id) as max_id
      FROM practice_record
      GROUP BY tune_ref, playlist_ref
    ) latest ON pr.tune_ref = latest.tune_ref
      AND pr.playlist_ref = latest.playlist_ref
      AND pr.id = latest.max_id
  ) practice_record ON practice_record.tune_ref = tune.id
    AND practice_record.playlist_ref = playlist_tune.playlist_ref
WHERE
  tune_override.user_ref IS NULL
  OR tune_override.user_ref = playlist.user_ref
`;

/**
 * View 3: Practice List with Staged Data
 *
 * Extended practice view including transient/staged data from table_transient_data.
 * Used for practice sessions with uncommitted changes.
 *
 * Note: table_transient_data table may not exist in PWA version.
 * This view is included for compatibility with legacy data migration.
 */
const PRACTICE_LIST_STAGED = `
CREATE VIEW IF NOT EXISTS practice_list_staged AS
SELECT
  tune.id AS id,
  COALESCE(tune_override.title, tune.title) AS title,
  COALESCE(tune_override.type, tune.type) AS type,
  COALESCE(tune_override.structure, tune.structure) AS structure,
  COALESCE(tune_override.mode, tune.mode) AS mode,
  COALESCE(tune_override.incipit, tune.incipit) AS incipit,
  COALESCE(tune_override.genre_ref, tune.genre_ref) AS genre_ref,
  tune.private_for,
  tune.deleted,
  playlist_tune.learned,
  COALESCE(td.goal, COALESCE(pr.goal, 'recall')) AS goal,
  playlist_tune.current AS scheduled,
  playlist.user_ref AS user_ref,
  playlist.playlist_id AS playlist_id,
  instrument.instrument AS instrument,
  playlist_tune.deleted AS playlist_deleted,
  COALESCE(td.state, pr.state) AS latest_state,
  COALESCE(td.practiced, pr.practiced) AS latest_practiced,
  COALESCE(td.quality, pr.quality) AS latest_quality,
  COALESCE(td.easiness, pr.easiness) AS latest_easiness,
  COALESCE(td.difficulty, pr.difficulty) AS latest_difficulty,
  COALESCE(td.stability, pr.stability) AS latest_stability,
  COALESCE(td.interval, pr.interval) AS latest_interval,
  COALESCE(td.step, pr.step) AS latest_step,
  COALESCE(td.repetitions, pr.repetitions) AS latest_repetitions,
  COALESCE(td.due, pr.due) AS latest_due,
  COALESCE(td.backup_practiced, pr.backup_practiced) AS latest_backup_practiced,
  COALESCE(td.goal, pr.goal) AS latest_goal,
  COALESCE(td.technique, pr.technique) AS latest_technique,
  (
    SELECT GROUP_CONCAT(tag.tag_text, ' ')
    FROM tag
    WHERE tag.tune_ref = tune.id
      AND tag.user_ref = playlist.user_ref
  ) AS tags,
  td.purpose AS purpose,
  td.note_private AS note_private,
  td.note_public AS note_public,
  td.recall_eval AS recall_eval,
  (
    SELECT GROUP_CONCAT(note.note_text, ' ')
    FROM note
    WHERE note.tune_ref = tune.id
      AND note.user_ref = playlist.user_ref
  ) AS notes,
  (
    SELECT ref.url
    FROM reference ref
    WHERE ref.tune_ref = tune.id
      AND ref.user_ref = playlist.user_ref
      AND ref.favorite = 1
    LIMIT 1
  ) AS favorite_url,
  CASE
    WHEN tune_override.user_ref = playlist.user_ref THEN 1
    ELSE 0
  END AS has_override,
  CASE
    WHEN td.practiced IS NOT NULL
      OR td.quality IS NOT NULL
      OR td.easiness IS NOT NULL
      OR td.difficulty IS NOT NULL
      OR td.interval IS NOT NULL
      OR td.step IS NOT NULL
      OR td.repetitions IS NOT NULL
      OR td.due IS NOT NULL
      OR td.backup_practiced IS NOT NULL
      OR td.goal IS NOT NULL
      OR td.technique IS NOT NULL
      OR td.stability IS NOT NULL THEN 1
    ELSE 0
  END AS has_staged
FROM
  tune
  LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
  LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
  LEFT JOIN instrument ON instrument.id = playlist.instrument_ref
  LEFT JOIN (
    SELECT pr.*
    FROM practice_record pr
    INNER JOIN (
      SELECT tune_ref, playlist_ref, MAX(id) as max_id
      FROM practice_record
      GROUP BY tune_ref, playlist_ref
    ) latest ON pr.tune_ref = latest.tune_ref
      AND pr.playlist_ref = latest.playlist_ref
      AND pr.id = latest.max_id
  ) pr ON pr.tune_ref = tune.id
    AND pr.playlist_ref = playlist_tune.playlist_ref
  LEFT JOIN table_transient_data td ON td.tune_id = tune.id
    AND td.playlist_id = playlist_tune.playlist_ref
WHERE
  tune_override.user_ref IS NULL
  OR tune_override.user_ref = playlist.user_ref
`;

/**
 * Initialize database views in SQLite WASM
 *
 * Creates all essential views for the TuneTrees application.
 * This function should be called after database initialization
 * and after any schema migrations.
 *
 * @param db - SQLite database instance
 * @returns Promise that resolves when all views are created
 *
 * @example
 * ```typescript
 * const db = await initDatabase();
 * await initializeViews(db);
 * console.log('Views ready for querying');
 * ```
 */
export async function initializeViews(db: SqliteDatabase): Promise<void> {
  console.log("📊 Initializing SQLite database views...");

  try {
    // Create view_playlist_joined
    await db.run(VIEW_PLAYLIST_JOINED);
    console.log("✅ Created view: view_playlist_joined");

    // Create practice_list_joined
    await db.run(PRACTICE_LIST_JOINED);
    console.log("✅ Created view: practice_list_joined");

    // Create practice_list_staged
    await db.run(PRACTICE_LIST_STAGED);
    console.log("✅ Created view: practice_list_staged");

    console.log("✅ All database views initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing database views:", error);
    throw error;
  }
}

/**
 * Drop all views (useful for testing or re-initialization)
 *
 * @param db - SQLite database instance
 */
export async function dropViews(db: SqliteDatabase): Promise<void> {
  console.log("🗑️  Dropping SQLite database views...");

  try {
    await db.run("DROP VIEW IF EXISTS practice_list_staged");
    await db.run("DROP VIEW IF EXISTS practice_list_joined");
    await db.run("DROP VIEW IF EXISTS view_playlist_joined");

    console.log("✅ All views dropped");
  } catch (error) {
    console.error("❌ Error dropping views:", error);
    throw error;
  }
}

/**
 * Recreate all views (drop and create)
 *
 * @param db - SQLite database instance
 */
export async function recreateViews(db: SqliteDatabase): Promise<void> {
  await dropViews(db);
  await initializeViews(db);
}
