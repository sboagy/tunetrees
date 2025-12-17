/**
 * TuneTrees PostgreSQL Schema (Supabase)
 *
 * This schema defines all tables for the Supabase cloud database.
 * It includes sync columns for multi-device synchronization.
 *
 * Key changes from legacy schema:
 * - user → user_profile (with supabase_user_id FK to auth.users)
 * - Added sync columns (sync_version, last_modified_at, device_id)
 * - Dropped NextAuth tables (account, session, verification_token)
 * - PostgreSQL-specific features (UUID, TIMESTAMP, SERIAL)
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { generateId } from "../src/lib/utils/uuid";
import { pgSyncColumns } from "./sync-columns";

// ============================================================================
// User Profile (replaces legacy "user" table)
// ============================================================================

/**
 * User Profile table
 *
 * Extends Supabase auth.users with app-specific fields.
 * The supabase_user_id is the source of truth (FK to auth.users).
 */
export const userProfile = pgTable("user_profile", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  supabaseUserId: uuid("supabase_user_id").notNull().unique(),
  name: text("name"),
  email: text("email"), // Denormalized from auth.users for queries
  avatarUrl: text("avatar_url"), // User avatar image URL (predefined or custom upload)
  srAlgType: text("sr_alg_type"), // 'SM2' | 'FSRS'
  phone: text("phone"),
  phoneVerified: timestamp("phone_verified"),
  acceptableDelinquencyWindow: integer("acceptable_delinquency_window").default(
    21
  ),
  deleted: boolean("deleted").default(false).notNull(),

  // Sync columns
  ...pgSyncColumns,
});

// ============================================================================
// Reference Data (no sync columns needed)
// ============================================================================

/**
 * Genre table
 * System reference data for music genres (Irish, Scottish, Old-Time, etc.)
 */
export const genre = pgTable("genre", {
  id: text("id").primaryKey(),
  name: text("name"),
  region: text("region"),
  description: text("description"),
});

/**
 * Tune Type table
 * System reference data for tune types (Jig, Reel, Waltz, etc.)
 */
export const tuneType = pgTable("tune_type", {
  id: text("id").primaryKey(),
  name: text("name"),
  rhythm: text("rhythm"),
  description: text("description"),
});

/**
 * Genre-Tune Type association table
 * Many-to-many relationship
 */
export const genreTuneType = pgTable(
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
 *
 * Stores tune metadata (title, type, structure, mode, etc.).
 * Most tunes are public (from TheSession.org, etc.) but users can create private tunes.
 * Private tunes need sync columns for multi-device support.
 */
export const tune = pgTable("tune", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  composer: text("composer"),
  artist: text("artist"),
  idForeign: text("id_foreign"),
  releaseYear: integer("release_year"),
  primaryOrigin: text("primary_origin").default("irishtune.info"), // Source: 'irishtune.info', 'user_created', etc.
  title: text("title"),
  type: text("type"),
  structure: text("structure"),
  mode: text("mode"),
  incipit: text("incipit"), // ABC notation snippet
  genre: text("genre").references(() => genre.id),
  privateFor: uuid("private_for").references(() => userProfile.id),
  deleted: boolean("deleted").default(false).notNull(),

  // Sync columns (needed for private tunes)
  ...pgSyncColumns,
});

/**
 * Tune Override table
 *
 * Allows users to customize tune metadata (title, type, etc.) without modifying the base tune.
 * User-specific overrides need sync columns.
 */
export const tuneOverride = pgTable("tune_override", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  tuneRef: uuid("tune_ref")
    .notNull()
    .references(() => tune.id),
  userRef: uuid("user_ref")
    .notNull()
    .references(() => userProfile.id),
  title: text("title"),
  type: text("type"),
  structure: text("structure"),
  genre: text("genre").references(() => genre.id),
  mode: text("mode"),
  incipit: text("incipit"),
  composer: text("composer"),
  artist: text("artist"),
  idForeign: text("id_foreign"),
  releaseYear: integer("release_year"),
  deleted: boolean("deleted").default(false).notNull(),

  // Sync columns
  ...pgSyncColumns,
});

/**
 * Instrument table
 *
 * Stores instrument information (name, description, genre default).
 * Users can create custom instruments (privateToUser IS NOT NULL).
 */
export const instrument = pgTable(
  "instrument",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    privateToUser: uuid("private_to_user").references(() => userProfile.id),
    instrument: text("instrument"),
    description: text("description"),
    genreDefault: text("genre_default"),
    deleted: boolean("deleted").default(false).notNull(),

    // Sync columns
    ...pgSyncColumns,
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
 *
 * A playlist is a user's collection of tunes for a specific instrument.
 * Each user can have one playlist per instrument.
 */
export const playlist = pgTable(
  "playlist",
  {
    playlistId: uuid("playlist_id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    userRef: uuid("user_ref")
      .notNull()
      .references(() => userProfile.id),
    name: text("name"), // Playlist name (e.g., "My Irish Tunes")
    instrumentRef: uuid("instrument_ref"),
    genreDefault: text("genre_default").references(() => genre.id), // Default genre for this playlist
    srAlgType: text("sr_alg_type"), // 'SM2' | 'FSRS'
    deleted: boolean("deleted").default(false).notNull(),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [unique().on(t.userRef, t.instrumentRef)]
);

/**
 * Playlist-Tune association table
 *
 * Many-to-many relationship between playlists and tunes.
 * Tracks when a tune was added (current), learned, and scheduled.
 */
export const playlistTune = pgTable(
  "playlist_tune",
  {
    playlistRef: uuid("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: uuid("tune_ref")
      .notNull()
      .references(() => tune.id),
    current: timestamp("current"),
    learned: timestamp("learned"),
    scheduled: timestamp("scheduled"),
    goal: text("goal").default("recall"), // 'recall' | 'memorize' | etc.
    deleted: boolean("deleted").default(false).notNull(),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [primaryKey({ columns: [t.playlistRef, t.tuneRef] })]
);

/**
 * Practice Record table
 *
 * Stores spaced repetition data for each tune in a playlist.
 * One record per practice session (identified by practiced timestamp).
 */
export const practiceRecord = pgTable(
  "practice_record",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    playlistRef: uuid("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: uuid("tune_ref")
      .notNull()
      .references(() => tune.id),
    practiced: timestamp("practiced"),
    quality: integer("quality"), // SM2/FSRS quality rating (0-5)
    easiness: real("easiness"), // SM2 easiness factor
    difficulty: real("difficulty"), // FSRS difficulty
    stability: real("stability"), // FSRS stability
    interval: integer("interval"), // Days until next review
    step: integer("step"), // FSRS step
    repetitions: integer("repetitions"),
    lapses: integer("lapses"),
    elapsedDays: integer("elapsed_days"),
    state: integer("state"), // FSRS state (0=new, 1=learning, 2=review, 3=relearning)
    due: timestamp("due"),
    backupPracticed: timestamp("backup_practiced"),
    goal: text("goal").default("recall"),
    technique: text("technique"),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [
    unique().on(t.tuneRef, t.playlistRef, t.practiced),
    index("idx_practice_record_id").on(t.id.desc()),
    index("idx_practice_record_tune_playlist_practiced").on(
      t.tuneRef,
      t.playlistRef,
      t.practiced.desc()
    ),
    index("idx_practice_record_practiced").on(t.practiced.desc()),
  ]
);

/**
 * Daily Practice Queue table
 *
 * Stores the generated practice queue for each user/playlist/date.
 * Each queue item represents one tune to practice in a specific time window.
 */
export const dailyPracticeQueue = pgTable(
  "daily_practice_queue",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    userRef: uuid("user_ref").notNull(),
    playlistRef: uuid("playlist_ref").notNull(),
    mode: text("mode"),
    queueDate: timestamp("queue_date"),
    windowStartUtc: timestamp("window_start_utc").notNull(),
    windowEndUtc: timestamp("window_end_utc").notNull(),
    tuneRef: uuid("tune_ref").notNull(),
    bucket: integer("bucket").notNull(), // 0=new, 1=learning, 2=review
    orderIndex: integer("order_index").notNull(),
    snapshotCoalescedTs: timestamp("snapshot_coalesced_ts").notNull(),
    scheduledSnapshot: text("scheduled_snapshot"),
    latestDueSnapshot: text("latest_due_snapshot"),
    acceptableDelinquencyWindowSnapshot: integer(
      "acceptable_delinquency_window_snapshot"
    ),
    tzOffsetMinutesSnapshot: integer("tz_offset_minutes_snapshot"),
    generatedAt: timestamp("generated_at").notNull(),
    completedAt: timestamp("completed_at"),
    exposuresRequired: integer("exposures_required"),
    exposuresCompleted: integer("exposures_completed").default(0),
    outcome: text("outcome"),
    active: boolean("active").default(true).notNull(),

    // Sync columns
    ...pgSyncColumns,
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
 *
 * User-created notes for tunes (can be public or private).
 */
export const note = pgTable(
  "note",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    userRef: uuid("user_ref").references(() => userProfile.id),
    tuneRef: uuid("tune_ref")
      .notNull()
      .references(() => tune.id),
    playlistRef: uuid("playlist_ref").references(() => playlist.playlistId),
    createdDate: timestamp("created_date"),
    noteText: text("note_text"),
    public: boolean("public").default(false).notNull(),
    favorite: boolean("favorite"),
    displayOrder: integer("display_order").default(0).notNull(), // For drag ordering
    deleted: boolean("deleted").default(false).notNull(),

    // Sync columns
    ...pgSyncColumns,
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
    check("chk_public_bool", sql.raw(`"public" IN (true, false)`)),
    check("chk_favorite_bool", sql.raw(`"favorite" IN (true, false)`)),
  ]
);

/**
 * Reference table
 *
 * External links (websites, audio, video) for tunes.
 */
export const reference = pgTable(
  "reference",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    url: text("url").notNull(),
    refType: text("ref_type"), // 'website' | 'audio' | 'video'
    tuneRef: uuid("tune_ref")
      .notNull()
      .references(() => tune.id),
    userRef: uuid("user_ref").references(() => userProfile.id),
    comment: text("comment"),
    title: text("title"),
    public: boolean("public"),
    favorite: boolean("favorite"),
    displayOrder: integer("display_order").default(0).notNull(), // For drag ordering
    deleted: boolean("deleted").default(false).notNull(),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [
    index("idx_reference_tune_public").on(t.tuneRef, t.public),
    index("idx_reference_tune_user_ref").on(t.tuneRef, t.userRef),
    index("idx_reference_user_tune_public").on(t.userRef, t.tuneRef, t.public),
    check(
      "check_ref_type",
      sql.raw(`ref_type IN ('website', 'audio', 'video')`)
    ),
    check("check_public", sql.raw(`"public" IN (true, false)`)),
    check("check_favorite", sql.raw(`"favorite" IN (true, false)`)),
  ]
);

/**
 * Tag table
 *
 * User-created tags for tunes.
 */
export const tag = pgTable(
  "tag",
  {
    tagId: uuid("tag_id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    userRef: uuid("user_ref")
      .notNull()
      .references(() => userProfile.id),
    tuneRef: uuid("tune_ref")
      .notNull()
      .references(() => tune.id),
    tagText: text("tag_text").notNull(),

    // Sync columns
    ...pgSyncColumns,
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
 *
 * Per-user, per-algorithm preferences for spaced repetition.
 */
export const prefsSpacedRepetition = pgTable(
  "prefs_spaced_repetition",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfile.id),
    algType: text("alg_type").notNull(), // 'SM2' | 'FSRS'
    fsrsWeights: text("fsrs_weights"),
    requestRetention: real("request_retention"),
    maximumInterval: integer("maximum_interval"),
    learningSteps: text("learning_steps"),
    relearningSteps: text("relearning_steps"),
    enableFuzzing: boolean("enable_fuzzing"),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.algType] }),
    check("check_name", sql.raw(`alg_type IN ('SM2', 'FSRS')`)),
  ]
);

/**
 * Scheduling Preferences table
 *
 * Per-user scheduling preferences (acceptable delinquency, min/max reviews, etc.).
 */
export const prefsSchedulingOptions = pgTable("prefs_scheduling_options", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => userProfile.id),
  acceptableDelinquencyWindow: integer("acceptable_delinquency_window")
    .default(21)
    .notNull(),
  minReviewsPerDay: integer("min_reviews_per_day"),
  maxReviewsPerDay: integer("max_reviews_per_day"),
  daysPerWeek: integer("days_per_week"),
  weeklyRules: text("weekly_rules"), // JSON string
  exceptions: text("exceptions"), // JSON string

  // Sync columns
  ...pgSyncColumns,
});

// ============================================================================
// UI State (with sync columns)
// ============================================================================

/**
 * Tab Group Main State table
 *
 * Stores the active tab for each user (practice, repertoire, catalog, analysis).
 */
export const tabGroupMainState = pgTable(
  "tab_group_main_state",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfile.id),
    whichTab: text("which_tab").default("practice"),
    playlistId: uuid("playlist_id"),
    tabSpec: text("tab_spec"),
    practiceShowSubmitted: integer("practice_show_submitted").default(0),
    practiceModeFlashcard: integer("practice_mode_flashcard").default(0),
    sidebarDockPosition: text("sidebar_dock_position").default("left"),

    // Sync columns
    ...pgSyncColumns,
  },
  () => [
    check(
      "check_name",
      sql.raw(`which_tab IN ('scheduled', 'repertoire', 'catalog', 'analysis')`)
    ),
  ]
);

/**
 * Table State table
 *
 * Stores table settings (sort, filter, column visibility) per user/screen size/purpose.
 */
export const tableState = pgTable(
  "table_state",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfile.id),
    screenSize: text("screen_size").notNull(),
    purpose: text("purpose").notNull(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlist.playlistId),
    settings: text("settings"),
    currentTune: uuid("current_tune"),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.screenSize, t.purpose, t.playlistId],
    }),
    check(
      "purpose_check",
      sql.raw(`purpose IN ('practice', 'repertoire', 'catalog', 'analysis')`)
    ),
    check("screen_size_check", sql.raw(`screen_size IN ('small', 'full')`)),
  ]
);

/**
 * Table Transient Data table
 *
 * Temporary data for the practice workflow (staged practice records).
 */
export const tableTransientData = pgTable(
  "table_transient_data",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfile.id),
    tuneId: uuid("tune_id")
      .notNull()
      .references(() => tune.id),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlist.playlistId),
    purpose: text("purpose"),
    notePrivate: text("note_private"),
    notePublic: text("note_public"),
    recallEval: text("recall_eval"),
    practiced: timestamp("practiced"),
    quality: integer("quality"),
    easiness: real("easiness"),
    difficulty: real("difficulty"),
    interval: integer("interval"),
    step: integer("step"),
    repetitions: integer("repetitions"),
    due: timestamp("due"),
    backupPracticed: timestamp("backup_practiced"),
    goal: text("goal"),
    technique: text("technique"),
    stability: real("stability"),
    state: integer("state").default(2),

    // Sync columns
    ...pgSyncColumns,
  },
  (t) => [primaryKey({ columns: [t.tuneId, t.userId, t.playlistId] })]
);

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
};
