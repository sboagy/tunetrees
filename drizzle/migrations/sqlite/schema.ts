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
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    userRef: integer("user_ref").notNull(),
    playlistRef: integer("playlist_ref").notNull(),
    mode: text(),
    queueDate: text("queue_date"),
    windowStartUtc: text("window_start_utc").notNull(),
    windowEndUtc: text("window_end_utc").notNull(),
    tuneRef: integer("tune_ref").notNull(),
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
  id: text().primaryKey().notNull(),
  name: text(),
  region: text(),
  description: text(),
});

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
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    privateToUser: integer("private_to_user").references(() => userProfile.id),
    instrument: text(),
    description: text(),
    genreDefault: text("genre_default"),
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
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    userRef: integer("user_ref").references(() => userProfile.id),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    playlistRef: integer("playlist_ref").references(() => playlist.playlistId),
    createdDate: text("created_date"),
    noteText: text("note_text"),
    public: integer().default(0).notNull(),
    favorite: integer(),
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
    playlistId: integer("playlist_id")
      .primaryKey({ autoIncrement: true })
      .notNull(),
    userRef: integer("user_ref")
      .notNull()
      .references(() => userProfile.id),
    name: text(),
    instrumentRef: integer("instrument_ref"),
    genreDefault: text("genre_default").references(() => genre.id),
    srAlgType: text("sr_alg_type"),
    deleted: integer().default(0).notNull(),
    syncVersion: integer("sync_version").default(1).notNull(),
    lastModifiedAt: text("last_modified_at").notNull(),
    deviceId: text("device_id"),
  },
  (table) => [
    uniqueIndex("playlist_user_ref_instrument_ref_unique").on(
      table.userRef,
      table.instrumentRef
    ),
  ]
);

export const playlistTune = sqliteTable(
  "playlist_tune",
  {
    playlistRef: integer("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
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
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    playlistRef: integer("playlist_ref")
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
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
  userId: integer("user_id")
    .primaryKey()
    .notNull()
    .references(() => userProfile.id),
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
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id),
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
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    url: text().notNull(),
    refType: text("ref_type"),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
    userRef: integer("user_ref").references(() => userProfile.id),
    comment: text(),
    title: text(),
    public: integer(),
    favorite: integer(),
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
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  operation: text().notNull(),
  data: text(),
  status: text().default("pending").notNull(),
  createdAt: text("created_at").notNull(),
  syncedAt: text("synced_at"),
  attempts: integer().default(0).notNull(),
  lastError: text("last_error"),
});

export const tabGroupMainState = sqliteTable("tab_group_main_state", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => userProfile.id),
  whichTab: text("which_tab").default("practice"),
  playlistId: integer("playlist_id"),
  tabSpec: text("tab_spec"),
  practiceShowSubmitted: integer("practice_show_submitted").default(0),
  practiceModeFlashcard: integer("practice_mode_flashcard").default(0),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const tableState = sqliteTable(
  "table_state",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id),
    screenSize: text("screen_size").notNull(),
    purpose: text().notNull(),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlist.playlistId),
    settings: text(),
    currentTune: integer("current_tune"),
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
    userId: integer("user_id")
      .notNull()
      .references(() => userProfile.id),
    tuneId: integer("tune_id")
      .notNull()
      .references(() => tune.id),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlist.playlistId),
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
    tagId: integer("tag_id").primaryKey({ autoIncrement: true }).notNull(),
    userRef: integer("user_ref")
      .notNull()
      .references(() => userProfile.id),
    tuneRef: integer("tune_ref")
      .notNull()
      .references(() => tune.id),
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
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  title: text(),
  type: text(),
  structure: text(),
  mode: text(),
  incipit: text(),
  genre: text().references(() => genre.id),
  privateFor: integer("private_for").references(() => userProfile.id),
  // Hybrid genre support fields
  composer: text(),
  artist: text(),
  idForeign: text("id_foreign"),
  releaseYear: integer("release_year"),
  deleted: integer().default(0).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const tuneOverride = sqliteTable("tune_override", {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  tuneRef: integer("tune_ref")
    .notNull()
    .references(() => tune.id),
  userRef: integer("user_ref")
    .notNull()
    .references(() => userProfile.id),
  title: text(),
  type: text(),
  structure: text(),
  genre: text().references(() => genre.id),
  mode: text(),
  incipit: text(),
  // Hybrid genre support fields (match tune table)
  composer: text(),
  artist: text(),
  idForeign: text("id_foreign"),
  releaseYear: integer("release_year"),
  deleted: integer().default(0).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});

export const tuneType = sqliteTable("tune_type", {
  id: text().primaryKey().notNull(),
  name: text(),
  rhythm: text(),
  description: text(),
});

export const userProfile = sqliteTable(
  "user_profile",
  {
    id: text("id").primaryKey().notNull(),
    name: text(),
    email: text(),
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
  () => []
);
