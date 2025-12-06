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
const VIEW_PLAYLIST_JOINED = /* sql */ `
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
const PRACTICE_LIST_JOINED = /* sql */ `
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
    AND (tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref)
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
`;

/**
 * View 3: Practice List with Staged Data
 *
 * Extended practice view including transient/staged data from table_transient_data.
 * Used for practice sessions with uncommitted changes (FSRS preview).
 *
 * The VIEW does ALL JOINs and COALESCE operations - this IS the complete dataset.
 * Grid queries this VIEW filtered by daily_practice_queue for frozen snapshot behavior.
 *
 * Note: Ported from PostgreSQL sql_scripts/view_practice_list_staged.sql
 */
const PRACTICE_LIST_STAGED = /* sql */ `
CREATE VIEW IF NOT EXISTS practice_list_staged AS
SELECT
  tune.id,
  COALESCE(tune_override.title, tune.title) AS title,
  COALESCE(tune_override.type, tune.type) AS type,
  COALESCE(tune_override.structure, tune.structure) AS structure,
  COALESCE(tune_override.mode, tune.mode) AS mode,
  COALESCE(tune_override.incipit, tune.incipit) AS incipit,
  COALESCE(tune_override.genre, tune.genre) AS genre,
  tune.private_for,
  tune.deleted,
  playlist_tune.learned,
  COALESCE(td.goal, COALESCE(pr.goal, 'recall')) AS goal,
  playlist_tune.scheduled,
  playlist.user_ref,
  playlist.playlist_id,
  instrument.instrument,
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
  td.purpose,
  td.note_private,
  td.note_public,
  td.recall_eval,
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
    AND (tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref)
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
WHERE tune_override.user_ref IS NULL OR tune_override.user_ref = playlist.user_ref
`;

/**
 * View 4: Daily Practice Queue with Human-Readable Names
 *
 * Joins daily_practice_queue with user, playlist, and tune information
 * to show readable names instead of UUIDs. Useful for debugging in SQLite browser.
 *
 * Columns:
 * - queue_id: Queue row UUID
 * - user_name: User email/name
 * - playlist_instrument: Instrument name
 * - tune_title: Tune title
 * - queue_date: Practice date (YYYY-MM-DD)
 * - window_start_utc: Queue window start timestamp
 * - bucket: Queue bucket (1=Due Today, 2=Lapsed, 3=New, 4=Old Lapsed)
 * - order_index: Order within queue
 * - completed_at: When submitted (NULL if not submitted)
 * - active: Whether queue row is active
 */
const VIEW_DAILY_PRACTICE_QUEUE_READABLE = /* sql */ `
CREATE VIEW IF NOT EXISTS view_daily_practice_queue_readable AS
SELECT
  dpq.id AS queue_id,
  COALESCE(up.name, up.email) AS user_name,
  i.instrument AS playlist_instrument,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  dpq.queue_date,
  dpq.window_start_utc,
  dpq.window_end_utc,
  dpq.bucket,
  dpq.order_index,
  dpq.completed_at,
  dpq.active,
  dpq.mode,
  dpq.snapshot_coalesced_ts,
  dpq.scheduled_snapshot,
  dpq.generated_at,
  dpq.user_ref,
  dpq.playlist_ref,
  dpq.tune_ref
FROM
  daily_practice_queue dpq
  LEFT JOIN user_profile up ON up.id = dpq.user_ref
  LEFT JOIN playlist p ON p.playlist_id = dpq.playlist_ref
  LEFT JOIN instrument i ON i.id = p.instrument_ref
  LEFT JOIN tune ON tune.id = dpq.tune_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = dpq.user_ref
ORDER BY
  dpq.queue_date DESC,
  dpq.bucket ASC,
  dpq.order_index ASC
`;

const VIEW_TRANSIENT_DATA_READABLE = /* sql */ `
CREATE VIEW IF NOT EXISTS view_transient_data_readable AS
SELECT
  COALESCE(up.name, up.email) AS user_name,
  ttd.user_id,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  ttd.tune_id,
  i.instrument AS playlist_instrument,
  ttd.playlist_id,
  ttd.purpose,
  ttd.note_private,
  ttd.note_public,
  ttd.recall_eval,
  ttd.practiced,
  ttd.quality,
  ttd.easiness,
  ttd.difficulty,
  ttd.interval,
  ttd.step,
  ttd.repetitions,
  ttd.due,
  ttd.backup_practiced,
  ttd.goal,
  ttd.technique,
  ttd.stability,
  ttd.state,
  ttd.sync_version,
  ttd.last_modified_at,
  ttd.device_id
FROM
  table_transient_data ttd
  LEFT JOIN user_profile up ON up.supabase_user_id = ttd.user_id
  LEFT JOIN tune ON tune.id = ttd.tune_id
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = ttd.user_id
  LEFT JOIN playlist p ON p.playlist_id = ttd.playlist_id
  LEFT JOIN instrument i ON i.id = p.instrument_ref
ORDER BY
  ttd.last_modified_at DESC
`;

/**
 * View: view_practice_record_readable
 *
 * Human-readable practice records with resolved foreign keys.
 * Shows user names, tune titles, and playlist instruments instead of UUIDs.
 * Useful for debugging and data inspection in SQLite WASM Browser.
 */
const VIEW_PRACTICE_RECORD_READABLE = /* sql */ `
CREATE VIEW IF NOT EXISTS view_practice_record_readable AS
SELECT
  COALESCE(up.name, up.email) AS user_name,
  COALESCE(tune_override.title, tune.title) AS tune_title,
  pr.tune_ref,
  i.instrument AS playlist_instrument,
  pr.playlist_ref,
  pr.practiced,
  pr.quality,
  CASE pr.quality
    WHEN 1 THEN 'Again'
    WHEN 2 THEN 'Hard'
    WHEN 3 THEN 'Good'
    WHEN 4 THEN 'Easy'
    ELSE 'Unknown'
  END AS quality_label,
  pr.easiness,
  pr.difficulty,
  pr.stability,
  pr.interval,
  pr.step,
  pr.repetitions,
  pr.lapses,
  pr.elapsed_days,
  pr.state,
  CASE pr.state
    WHEN 0 THEN 'New'
    WHEN 1 THEN 'Learning'
    WHEN 2 THEN 'Review'
    WHEN 3 THEN 'Relearning'
    ELSE 'Unknown'
  END AS state_label,
  pr.due,
  pr.backup_practiced,
  pr.goal,
  pr.technique,
  pr.sync_version,
  pr.last_modified_at,
  pr.device_id,
  pr.id
FROM
  practice_record pr
  LEFT JOIN playlist p ON p.playlist_id = pr.playlist_ref
  LEFT JOIN user_profile up ON up.supabase_user_id = p.user_ref
  LEFT JOIN tune ON tune.id = pr.tune_ref
  LEFT JOIN tune_override ON tune_override.tune_ref = tune.id
    AND tune_override.user_ref = p.user_ref
  LEFT JOIN instrument i ON i.id = p.instrument_ref
ORDER BY
  pr.practiced DESC
`;

/**
 * View: view_tune_override_readable
 *
 * Human-readable inspection view for per-user tune overrides.
 * Exposes both base tune values and override values side-by-side
 * with boolean flags indicating which fields are currently overridden.
 *
 * This supports debugging the field-level override indicator UI and
 * provides quick visibility in the /debug/db browser without having to
 * mentally diff COALESCE results.
 */
const VIEW_TUNE_OVERRIDE_READABLE = /* sql */ `
CREATE VIEW IF NOT EXISTS view_tune_override_readable AS
SELECT
  tovr.id AS override_id,
  COALESCE(up.name, up.email) AS user_name,
  tovr.user_ref,
  tovr.tune_ref,
  t.private_for AS tune_private_for,
  t.deleted AS tune_deleted,
  tovr.deleted AS override_deleted,
  t.last_modified_at AS tune_last_modified_at,
  tovr.last_modified_at AS override_last_modified_at,
  t.title AS base_title,
  tovr.title AS override_title,
  t.type AS base_type,
  tovr.type AS override_type,
  t.structure AS base_structure,
  tovr.structure AS override_structure,
  t.mode AS base_mode,
  tovr.mode AS override_mode,
  t.incipit AS base_incipit,
  tovr.incipit AS override_incipit,
  t.genre AS base_genre,
  tovr.genre AS override_genre,
  CASE WHEN tovr.title IS NOT NULL THEN 1 ELSE 0 END AS has_title_override,
  CASE WHEN tovr.type IS NOT NULL THEN 1 ELSE 0 END AS has_type_override,
  CASE WHEN tovr.structure IS NOT NULL THEN 1 ELSE 0 END AS has_structure_override,
  CASE WHEN tovr.mode IS NOT NULL THEN 1 ELSE 0 END AS has_mode_override,
  CASE WHEN tovr.incipit IS NOT NULL THEN 1 ELSE 0 END AS has_incipit_override,
  CASE WHEN tovr.genre IS NOT NULL THEN 1 ELSE 0 END AS has_genre_override
FROM
  tune_override tovr
  LEFT JOIN tune t ON t.id = tovr.tune_ref
  LEFT JOIN user_profile up ON up.id = tovr.user_ref
ORDER BY
  tovr.last_modified_at DESC
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

    // Create view_daily_practice_queue_readable
    await db.run(VIEW_DAILY_PRACTICE_QUEUE_READABLE);
    console.log("✅ Created view: view_daily_practice_queue_readable");

    // Create view_transient_data_readable
    await db.run(VIEW_TRANSIENT_DATA_READABLE);
    console.log("✅ Created view: view_transient_data_readable");

    // Create view_practice_record_readable
    await db.run(VIEW_PRACTICE_RECORD_READABLE);
    console.log("✅ Created view: view_practice_record_readable");

    // Create view_tune_override_readable
    await db.run(VIEW_TUNE_OVERRIDE_READABLE);
    console.log("✅ Created view: view_tune_override_readable");

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
    await db.run("DROP VIEW IF EXISTS view_practice_record_readable");
    await db.run("DROP VIEW IF EXISTS view_tune_override_readable");
    await db.run("DROP VIEW IF EXISTS view_transient_data_readable");
    await db.run("DROP VIEW IF EXISTS view_daily_practice_queue_readable");
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
