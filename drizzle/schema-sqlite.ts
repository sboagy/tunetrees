import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const dailyPracticeQueue = sqliteTable(
  "daily_practice_queue",
  {
    id: text().primaryKey().notNull(), // UUID
    userRef: text("user_ref").notNull(), // UUID FK
    playlistRef: text("playlist_ref").notNull(), // UUID FK
    mode: text(),
    queueDate: text("queue_date"),
    windowStartUtc: text("window_start_utc").notNull(),
    windowEndUtc: text("window_end_utc").notNull(),
    tuneRef: text("tune_ref").notNull(), // UUID FK
    bucket: integer().notNull(),
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
    outcome: text(),
    active: integer().default(1).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    uniqueIndex(
      "daily_practice_queue_user_ref_playlist_ref_window_start_utc_tune_ref_unique"
    ).on(table.userRef, table.playlistRef, table.windowStartUtc, table.tuneRef),
    index("idx_queue_generated_at").on(table.generatedAt),
    index("idx_queue_user_playlist_bucket").on(
      table.userRef,
      table.playlistRef,
      table.bucket
    ),
    index("idx_queue_user_playlist_active").on(
      table.userRef,
      table.playlistRef,
      table.active
    ),
    index("idx_queue_user_playlist_window").on(
      table.userRef,
      table.playlistRef,
      table.windowStartUtc
    ),
  ]
);

export const genre = sqliteTable("genre", {
  id: text().primaryKey().notNull(), // UUID (was TEXT semantic ID)
  name: text(),
  region: text(),
  description: text(),
});

export const genreTuneType = sqliteTable(
  "genre_tune_type",
  {
    genreId: text("genre_id")
      .notNull()
      .references(() => genre.id), // UUID FK
    tuneTypeId: text("tune_type_id")
      .notNull()
      .references(() => tuneType.id), // UUID FK
  },
  (table) => [
    primaryKey({
      columns: [table.genreId, table.tuneTypeId],
      name: "genre_tune_type_genre_id_tune_type_id_pk",
    }),
  ]
);

export const instrument = sqliteTable(
  "instrument",
  {
    id: text().primaryKey().notNull(), // UUID
    privateToUser: text("private_to_user").references(() => userProfile.id), // UUID FK to internal ID
    instrument: text(),
    description: text(),
    genreDefault: text("genre_default"), // UUID FK to genre
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    uniqueIndex("instrument_private_to_user_instrument_unique").on(
      table.privateToUser,
      table.instrument
    ),
    index("idx_instrument_private_to_user").on(table.privateToUser),
    index("idx_instrument_instrument").on(table.instrument),
  ]
);

export const note = sqliteTable(
  "note",
  {
    id: text().primaryKey().notNull(), // UUID
    userRef: text("user_ref").references(() => userProfile.id), // UUID FK to internal ID
    tuneRef: text("tune_ref")
      .notNull()
      .references(() => tune.id), // UUID FK
    playlistRef: text("playlist_ref").references(() => playlist.playlistId), // UUID FK
    createdDate: text("created_date"),
    noteText: text("note_text"),
    public: integer().default(0).notNull(),
    favorite: integer(),
    displayOrder: integer("display_order").default(0).notNull(), // For drag ordering
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_note_tune_user").on(table.tuneRef, table.userRef),
    index("idx_note_tune_playlist_user_public").on(
      table.tuneRef,
      table.playlistRef,
      table.userRef,
      table.public
    ),
    index("idx_note_tune_playlist").on(table.tuneRef, table.playlistRef),
  ]
);

export const playlist = sqliteTable(
  "playlist",
  {
    playlistId: text("playlist_id").primaryKey().notNull(), // UUID
    userRef: text("user_ref")
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    name: text(),
    instrumentRef: text("instrument_ref"), // UUID FK
    genreDefault: text("genre_default").references(() => genre.id), // UUID FK
    srAlgType: text("sr_alg_type"),
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  }
  // Note: Removed unique index on (user_ref, instrument_ref) to allow
  // multiple playlists per user per instrument (e.g., "Beginner Fiddle", "Advanced Fiddle")
);

export const playlistTune = sqliteTable(
  "playlist_tune",
  {
    playlistRef: text("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    tuneRef: text("tune_ref")
      .notNull()
      .references(() => tune.id), // UUID FK
    current: text(),
    learned: text(),
    scheduled: text(),
    goal: text().default("recall"),
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    primaryKey({
      columns: [table.playlistRef, table.tuneRef],
      name: "playlist_tune_playlist_ref_tune_ref_pk",
    }),
  ]
);

export const practiceRecord = sqliteTable(
  "practice_record",
  {
    id: text().primaryKey().notNull(), // UUID
    playlistRef: text("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    tuneRef: text("tune_ref")
      .notNull()
      .references(() => tune.id), // UUID FK
    practiced: text(),
    quality: integer(),
    easiness: real(),
    difficulty: real(),
    stability: real(),
    interval: integer(),
    step: integer(),
    repetitions: integer(),
    lapses: integer(),
    elapsedDays: integer("elapsed_days"),
    state: integer(),
    due: text(),
    backupPracticed: text("backup_practiced"),
    goal: text().default("recall"),
    technique: text(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    uniqueIndex("practice_record_tune_ref_playlist_ref_practiced_unique").on(
      table.tuneRef,
      table.playlistRef,
      table.practiced
    ),
    index("idx_practice_record_practiced").on(table.practiced),
    index("idx_practice_record_tune_playlist_practiced").on(
      table.tuneRef,
      table.playlistRef,
      table.practiced
    ),
    index("idx_practice_record_id").on(table.id),
  ]
);

export const prefsSchedulingOptions = sqliteTable("prefs_scheduling_options", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => userProfile.id), // UUID FK to internal ID
  acceptableDelinquencyWindow: integer("acceptable_delinquency_window")
    .default(21)
    .notNull(),
  minReviewsPerDay: integer("min_reviews_per_day"),
  maxReviewsPerDay: integer("max_reviews_per_day"),
  daysPerWeek: integer("days_per_week"),
  weeklyRules: text("weekly_rules"),
  exceptions: text(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const prefsSpacedRepetition = sqliteTable(
  "prefs_spaced_repetition",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    algType: text("alg_type").notNull(),
    fsrsWeights: text("fsrs_weights"),
    requestRetention: real("request_retention"),
    maximumInterval: integer("maximum_interval"),
    learningSteps: text("learning_steps"),
    relearningSteps: text("relearning_steps"),
    enableFuzzing: integer("enable_fuzzing"),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.algType],
      name: "prefs_spaced_repetition_user_id_alg_type_pk",
    }),
  ]
);

export const reference = sqliteTable(
  "reference",
  {
    id: text().primaryKey().notNull(), // UUID
    url: text().notNull(),
    refType: text("ref_type"),
    tuneRef: text("tune_ref")
      .notNull()
      .references(() => tune.id), // UUID FK
    userRef: text("user_ref").references(() => userProfile.id), // UUID FK to internal ID
    comment: text(),
    title: text(),
    public: integer(),
    favorite: integer(),
    displayOrder: integer("display_order").default(0).notNull(), // For drag ordering
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    index("idx_reference_user_tune_public").on(
      table.userRef,
      table.tuneRef,
      table.public
    ),
    index("idx_reference_tune_user_ref").on(table.tuneRef, table.userRef),
    index("idx_reference_tune_public").on(table.tuneRef, table.public),
  ]
);

export const syncQueue = sqliteTable("sync_queue", {
  id: text().primaryKey().notNull(), // UUID
  tableName: text("table_name").notNull(),
  recordId: text("record_id"), // DEPRECATED - kept for backwards compatibility only. Use data field.
  operation: text().notNull(),
  data: text().notNull(), // JSON with all record data including id/composite keys
  status: text().default("pending").notNull(),
  createdAt: text("created_at").notNull(),
  syncedAt: text("synced_at"),
  attempts: integer().default(0).notNull(),
  lastError: text("last_error"),
});

export const tabGroupMainState = sqliteTable("tab_group_main_state", {
  id: text().primaryKey().notNull(), // UUID
  userId: text("user_id")
    .notNull()
    .references(() => userProfile.id), // UUID FK to internal ID
  whichTab: text("which_tab").default("practice"),
  playlistId: text("playlist_id"), // UUID FK
  tabSpec: text("tab_spec"),
  practiceShowSubmitted: integer("practice_show_submitted").default(0),
  practiceModeFlashcard: integer("practice_mode_flashcard").default(0),
  sidebarDockPosition: text("sidebar_dock_position").default("left"),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const tableState = sqliteTable(
  "table_state",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    screenSize: text("screen_size").notNull(),
    purpose: text().notNull(),
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    settings: text(),
    currentTune: text("current_tune"), // UUID
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    primaryKey({
      columns: [
        table.userId,
        table.screenSize,
        table.purpose,
        table.playlistId,
      ],
      name: "table_state_user_id_screen_size_purpose_playlist_id_pk",
    }),
  ]
);

export const tableTransientData = sqliteTable(
  "table_transient_data",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    tuneId: text("tune_id")
      .notNull()
      .references(() => tune.id), // UUID FK
    playlistId: text("playlist_id")
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    purpose: text(),
    notePrivate: text("note_private"),
    notePublic: text("note_public"),
    recallEval: text("recall_eval"),
    practiced: text(),
    quality: integer(),
    easiness: real(),
    difficulty: real(),
    interval: integer(),
    step: integer(),
    repetitions: integer(),
    due: text(),
    backupPracticed: text("backup_practiced"),
    goal: text(),
    technique: text(),
    stability: real(),
    state: integer().default(2),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.tuneId, table.playlistId],
      name: "table_transient_data_user_id_tune_id_playlist_id_pk",
    }),
  ]
);

export const tag = sqliteTable(
  "tag",
  {
    id: text().primaryKey().notNull(), // UUID (renamed from tagId)
    userRef: text("user_ref")
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    tuneRef: text("tune_ref")
      .notNull()
      .references(() => tune.id), // UUID FK
    tagText: text("tag_text").notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    uniqueIndex("tag_user_ref_tune_ref_tag_text_unique").on(
      table.userRef,
      table.tuneRef,
      table.tagText
    ),
    index("idx_tag_user_ref_tune_ref").on(table.userRef, table.tuneRef),
    index("idx_tag_user_ref_tag_text").on(table.userRef, table.tagText),
  ]
);

export const tune = sqliteTable("tune", {
  id: text().primaryKey().notNull(), // UUID
  idForeign: integer("id_foreign"), // Legacy integer ID for provenance tracking (nullable, non-unique)
  primaryOrigin: text("primary_origin").default("irishtune.info"), // Source: 'irishtune.info', 'user_created', etc.
  title: text(),
  type: text(),
  structure: text(),
  mode: text(),
  incipit: text(),
  genre: text().references(() => genre.id), // UUID FK
  privateFor: text("private_for").references(() => userProfile.id), // UUID FK to internal ID
  deleted: integer().default(0).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const tuneOverride = sqliteTable("tune_override", {
  id: text().primaryKey().notNull(), // UUID
  tuneRef: text("tune_ref")
    .notNull()
    .references(() => tune.id), // UUID FK
  userRef: text("user_ref")
    .notNull()
    .references(() => userProfile.id), // UUID FK to internal ID
  title: text(),
  type: text(),
  structure: text(),
  genre: text().references(() => genre.id), // UUID FK
  mode: text(),
  incipit: text(),
  deleted: integer().default(0).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const tuneType = sqliteTable("tune_type", {
  id: text().primaryKey().notNull(), // UUID (was TEXT semantic ID)
  name: text(),
  rhythm: text(),
  description: text(),
});

export const userProfile = sqliteTable(
  "user_profile",
  {
    id: text().notNull(), // UUID (matches PostgreSQL, but not used as PK in SQLite)
    supabaseUserId: text("supabase_user_id").primaryKey().notNull(), // UUID PK
    name: text(),
    email: text(),
    avatarUrl: text("avatar_url"), // User avatar image URL (predefined or custom upload)
    srAlgType: text("sr_alg_type"),
    phone: text(),
    phoneVerified: text("phone_verified"),
    acceptableDelinquencyWindow: integer(
      "acceptable_delinquency_window"
    ).default(21),
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    uniqueIndex("user_profile_id_unique").on(table.id),
    uniqueIndex("user_profile_supabase_user_id_unique").on(
      table.supabaseUserId
    ),
  ]
);
