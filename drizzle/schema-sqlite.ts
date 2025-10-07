/**
 * TuneTrees SQLite WASM Schema (Local Offline Database)
 *
 * This schema mirrors the PostgreSQL schema but uses SQLite-specific types.
 * It provides offline-first storage with bidirectional sync to Supabase.
 *
 * Key differences from PostgreSQL schema:
 * - INTEGER for booleans (0/1 instead of true/false)
 * - INTEGER for primary keys with autoincrement
 * - TEXT for UUIDs (no native UUID type)
 * - TEXT for timestamps (ISO 8601 strings)
 * - REAL for floating-point numbers (same as PostgreSQL)
 */

import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { sqliteSyncColumns } from "./sync-columns";

// ============================================================================
// User Profile (replaces legacy "user" table)
// ============================================================================

/**
 * User Profile table
 *
 * Extends Supabase auth.users with app-specific fields.
 * The supabase_user_id is the source of truth (synced from Supabase).
 */
export const userProfile = sqliteTable("user_profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supabaseUserId: text("supabase_user_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  srAlgType: text("sr_alg_type"),
  phone: text("phone"),
  phoneVerified: text("phone_verified"), // ISO 8601 timestamp
  acceptableDelinquencyWindow: integer("acceptable_delinquency_window").default(
    21
  ),
  deleted: integer("deleted").default(0).notNull(), // 0 = false, 1 = true

  // Sync columns
  ...sqliteSyncColumns,
});

// ============================================================================
// Reference Data (no sync columns needed)
// ============================================================================

/**
 * Genre table
 * System reference data for music genres
 */
export const genre = sqliteTable("genre", {
  id: text("id").primaryKey(),
  name: text("name"),
  region: text("region"),
  description: text("description"),
});

/**
 * Tune Type table
 * System reference data for tune types
 */
export const tuneType = sqliteTable("tune_type", {
  id: text("id").primaryKey(),
  name: text("name"),
  rhythm: text("rhythm"),
  description: text("description"),
});

/**
 * Genre-Tune Type association table
 */
export const genreTuneType = sqliteTable(
  "genre_tune_type",
  {
    genreId: text("genre_id")
      .notNull()
      .references(() => genre.id),
    tuneTypeId: text("tune_type_id")
      .notNull()
      .references(() => tuneType.id),
  },
  (t) => [primaryKey({ columns: [t.genreId, t.tuneTypeId] })]
);

// ============================================================================
// Core Music Data (with sync columns)
// ============================================================================

/**
 * Tune table
 */
export const tune = sqliteTable("tune", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title"),
  type: text("type"),
  structure: text("structure"),
  mode: text("mode"),
  incipit: text("incipit"),
  genre: text("genre").references(() => genre.id),
  privateFor: integer("private_for").references(() => userProfile.id),
  deleted: integer("deleted").default(0).notNull(),

  // Sync columns
  ...sqliteSyncColumns,
});

/**
 * Tune Override table
 */
export const tuneOverride = sqliteTable("tune_override", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tuneRef: integer("tune_ref")
    .notNull()
    .references(() => tune.id),
  userRef: integer("user_ref")
    .notNull()
    .references(() => userProfile.id),
  title: text("title"),
  type: text("type"),
  structure: text("structure"),
  genre: text("genre").references(() => genre.id),
  mode: text("mode"),
  incipit: text("incipit"),
  deleted: integer("deleted").default(0).notNull(),

  // Sync columns
  ...sqliteSyncColumns,
});

/**
 * Instrument table
 */
export const instrument = sqliteTable(
  "instrument",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    privateToUser: integer("private_to_user").references(() => userProfile.id),
    instrument: text("instrument"),
    description: text("description"),
    genreDefault: text("genre_default"),
    deleted: integer("deleted").default(0).notNull(),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    unique().on(t.privateToUser, t.instrument),
    index("idx_instrument_instrument").on(t.instrument),
    index("idx_instrument_private_to_user").on(t.privateToUser),
  ]
);

// ============================================================================
// Playlist & Practice Data (with sync columns)
// ============================================================================

/**
 * Playlist table
 */
export const playlist = sqliteTable(
  "playlist",
  {
    playlistId: integer("playlist_id").primaryKey({ autoIncrement: true }),
    userRef: integer("user_ref")
      .notNull()
      .references(() => userProfile.id),
    name: text("name"), // Playlist name (e.g., "My Irish Tunes")
    instrumentRef: integer("instrument_ref"),
    genreDefault: text("genre_default").references(() => genre.id), // Default genre for this playlist
    srAlgType: text("sr_alg_type"),
    deleted: integer("deleted").default(0).notNull(),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [unique().on(t.userRef, t.instrumentRef)]
);

/**
 * Playlist-Tune association table
 */
export const playlistTune = sqliteTable(
  "playlist_tune",
  {
    playlistRef: integer("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    current: text("current"), // ISO 8601 timestamp
    learned: text("learned"), // ISO 8601 timestamp
    scheduled: text("scheduled"), // ISO 8601 timestamp
    goal: text("goal").default("recall"),
    deleted: integer("deleted").default(0).notNull(),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [primaryKey({ columns: [t.playlistRef, t.tuneRef] })]
);

/**
 * Practice Record table
 */
export const practiceRecord = sqliteTable(
  "practice_record",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistRef: integer("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    practiced: text("practiced"), // ISO 8601 timestamp
    quality: integer("quality"),
    easiness: real("easiness"),
    difficulty: real("difficulty"),
    stability: real("stability"),
    interval: integer("interval"),
    step: integer("step"),
    repetitions: integer("repetitions"),
    lapses: integer("lapses"),
    elapsedDays: integer("elapsed_days"),
    state: integer("state"),
    due: text("due"), // ISO 8601 timestamp
    backupPracticed: text("backup_practiced"), // ISO 8601 timestamp
    goal: text("goal").default("recall"),
    technique: text("technique"),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    unique().on(t.tuneRef, t.playlistRef, t.practiced),
    index("idx_practice_record_id").on(t.id),
    index("idx_practice_record_tune_playlist_practiced").on(
      t.tuneRef,
      t.playlistRef,
      t.practiced
    ),
    index("idx_practice_record_practiced").on(t.practiced),
  ]
);

/**
 * Daily Practice Queue table
 */
export const dailyPracticeQueue = sqliteTable(
  "daily_practice_queue",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userRef: integer("user_ref").notNull(),
    playlistRef: integer("playlist_ref").notNull(),
    mode: text("mode"),
    queueDate: text("queue_date"), // ISO 8601 timestamp
    windowStartUtc: text("window_start_utc").notNull(),
    windowEndUtc: text("window_end_utc").notNull(),
    tuneRef: integer("tune_ref").notNull(),
    bucket: integer("bucket").notNull(),
    orderIndex: integer("order_index").notNull(),
    snapshotCoalescedTs: text("snapshot_coalesced_ts").notNull(),
    scheduledSnapshot: text("scheduled_snapshot"),
    latestDueSnapshot: text("latest_due_snapshot"),
    acceptableDelinquencyWindowSnapshot: integer(
      "acceptable_delinquency_window_snapshot"
    ),
    tzOffsetMinutesSnapshot: integer("tz_offset_minutes_snapshot"),
    generatedAt: text("generated_at").notNull(),
    completedAt: text("completed_at"),
    exposuresRequired: integer("exposures_required"),
    exposuresCompleted: integer("exposures_completed").default(0),
    outcome: text("outcome"),
    active: integer("active").default(1).notNull(), // 0 = false, 1 = true

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    unique().on(t.userRef, t.playlistRef, t.windowStartUtc, t.tuneRef),
    index("idx_queue_user_playlist_window").on(
      t.userRef,
      t.playlistRef,
      t.windowStartUtc
    ),
    index("idx_queue_user_playlist_active").on(
      t.userRef,
      t.playlistRef,
      t.active
    ),
    index("idx_queue_user_playlist_bucket").on(
      t.userRef,
      t.playlistRef,
      t.bucket
    ),
    index("idx_queue_generated_at").on(t.generatedAt),
  ]
);

// ============================================================================
// User Content (Notes, References, Tags) - with sync columns
// ============================================================================

/**
 * Note table
 */
export const note = sqliteTable(
  "note",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userRef: integer("user_ref").references(() => userProfile.id),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    playlistRef: integer("playlist_ref").references(() => playlist.playlistId),
    createdDate: text("created_date"), // ISO 8601 timestamp
    noteText: text("note_text"),
    public: integer("public").default(0).notNull(), // 0 = false, 1 = true
    favorite: integer("favorite"),
    deleted: integer("deleted").default(0).notNull(),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    index("idx_note_tune_playlist").on(t.tuneRef, t.playlistRef),
    index("idx_note_tune_playlist_user_public").on(
      t.tuneRef,
      t.playlistRef,
      t.userRef,
      t.public
    ),
    index("idx_note_tune_user").on(t.tuneRef, t.userRef),
  ]
);

/**
 * Reference table
 */
export const reference = sqliteTable(
  "reference",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").notNull(),
    refType: text("ref_type"),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    userRef: integer("user_ref").references(() => userProfile.id),
    comment: text("comment"),
    title: text("title"),
    public: integer("public"),
    favorite: integer("favorite"),
    deleted: integer("deleted").default(0).notNull(),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    index("idx_reference_tune_public").on(t.tuneRef, t.public),
    index("idx_reference_tune_user_ref").on(t.tuneRef, t.userRef),
    index("idx_reference_user_tune_public").on(t.userRef, t.tuneRef, t.public),
  ]
);

/**
 * Tag table
 */
export const tag = sqliteTable(
  "tag",
  {
    tagId: integer("tag_id").primaryKey({ autoIncrement: true }),
    userRef: integer("user_ref")
      .notNull()
      .references(() => userProfile.id),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    tagText: text("tag_text").notNull(),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    unique().on(t.userRef, t.tuneRef, t.tagText),
    index("idx_tag_user_ref_tag_text").on(t.userRef, t.tagText),
    index("idx_tag_user_ref_tune_ref").on(t.userRef, t.tuneRef),
  ]
);

// ============================================================================
// Preferences (with sync columns)
// ============================================================================

/**
 * Spaced Repetition Preferences table
 */
export const prefsSpacedRepetition = sqliteTable(
  "prefs_spaced_repetition",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id),
    algType: text("alg_type").notNull(),
    fsrsWeights: text("fsrs_weights"),
    requestRetention: real("request_retention"),
    maximumInterval: integer("maximum_interval"),
    learningSteps: text("learning_steps"),
    relearningSteps: text("relearning_steps"),
    enableFuzzing: integer("enable_fuzzing"), // 0 = false, 1 = true

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [primaryKey({ columns: [t.userId, t.algType] })]
);

/**
 * Scheduling Preferences table
 */
export const prefsSchedulingOptions = sqliteTable("prefs_scheduling_options", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => userProfile.id),
  acceptableDelinquencyWindow: integer("acceptable_delinquency_window")
    .default(21)
    .notNull(),
  minReviewsPerDay: integer("min_reviews_per_day"),
  maxReviewsPerDay: integer("max_reviews_per_day"),
  daysPerWeek: integer("days_per_week"),
  weeklyRules: text("weekly_rules"),
  exceptions: text("exceptions"),

  // Sync columns
  ...sqliteSyncColumns,
});

// ============================================================================
// UI State (with sync columns)
// ============================================================================

/**
 * Tab Group Main State table
 */
export const tabGroupMainState = sqliteTable("tab_group_main_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id),
  whichTab: text("which_tab").default("practice"),
  playlistId: integer("playlist_id"),
  tabSpec: text("tab_spec"),
  practiceShowSubmitted: integer("practice_show_submitted").default(0),
  practiceModeFlashcard: integer("practice_mode_flashcard").default(0),

  // Sync columns
  ...sqliteSyncColumns,
});

/**
 * Table State table
 */
export const tableState = sqliteTable(
  "table_state",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id),
    screenSize: text("screen_size").notNull(),
    purpose: text("purpose").notNull(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlist.playlistId),
    settings: text("settings"),
    currentTune: integer("current_tune"),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.screenSize, t.purpose, t.playlistId],
    }),
  ]
);

/**
 * Table Transient Data table
 */
export const tableTransientData = sqliteTable(
  "table_transient_data",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id),
    tuneId: integer("tune_id")
      .notNull()
      .references(() => tune.id),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlist.playlistId),
    purpose: text("purpose"),
    notePrivate: text("note_private"),
    notePublic: text("note_public"),
    recallEval: text("recall_eval"),
    practiced: text("practiced"), // ISO 8601 timestamp
    quality: integer("quality"),
    easiness: real("easiness"),
    difficulty: real("difficulty"),
    interval: integer("interval"),
    step: integer("step"),
    repetitions: integer("repetitions"),
    due: text("due"), // ISO 8601 timestamp
    backupPracticed: text("backup_practiced"), // ISO 8601 timestamp
    goal: text("goal"),
    technique: text("technique"),
    stability: real("stability"),
    state: integer("state").default(2),

    // Sync columns
    ...sqliteSyncColumns,
  },
  (t) => [primaryKey({ columns: [t.tuneId, t.userId, t.playlistId] })]
);

/**
 * Sync Queue table
 * Tracks local changes awaiting sync to Supabase
 */
export const syncQueue = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  operation: text("operation").notNull(), // "insert" | "update" | "delete"
  data: text("data"), // JSON stringified record data
  status: text("status").default("pending").notNull(), // "pending" | "syncing" | "synced" | "failed"
  createdAt: text("created_at").notNull(),
  syncedAt: text("synced_at"),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
});

// ============================================================================
// Schema Exports
// ============================================================================

/**
 * Export all tables for use in Drizzle ORM queries
 */
export const schema = {
  userProfile,
  genre,
  tuneType,
  genreTuneType,
  tune,
  tuneOverride,
  instrument,
  playlist,
  playlistTune,
  practiceRecord,
  dailyPracticeQueue,
  note,
  reference,
  tag,
  prefsSpacedRepetition,
  prefsSchedulingOptions,
  tabGroupMainState,
  tableState,
  tableTransientData,
  syncQueue,
};
