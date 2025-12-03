import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { COL, TBL } from "../shared/db-constants";

export const dailyPracticeQueue = sqliteTable(
  TBL.DAILY_PRACTICE_QUEUE,
  {
    id: text(COL.ID).primaryKey().notNull(), // UUID
    userRef: text(COL.USER_REF).notNull(), // UUID FK
    playlistRef: text(COL.PLAYLIST_REF).notNull(), // UUID FK
    mode: text(COL.MODE), // Note: MODE is in COL but was missing in previous schema? No, it was text() without name. Wait.
    // In original schema: mode: text(), which means column name is "mode".
    // In COL: MODE: "mode". So text(COL.MODE) is correct.
    queueDate: text(COL.QUEUE_DATE),
    windowStartUtc: text(COL.WINDOW_START_UTC).notNull(),
    windowEndUtc: text(COL.WINDOW_END_UTC).notNull(),
    tuneRef: text(COL.TUNE_REF).notNull(), // UUID FK
    bucket: integer(COL.BUCKET).notNull(),
    orderIndex: integer(COL.ORDER_INDEX).notNull(),
    snapshotCoalescedTs: text(COL.SNAPSHOT_COALESCED_TS).notNull(),
    scheduledSnapshot: text(COL.SCHEDULED_SNAPSHOT),
    latestDueSnapshot: text(COL.LATEST_DUE_SNAPSHOT),
    acceptableDelinquencyWindowSnapshot: integer(
      COL.ACCEPTABLE_DELINQUENCY_WINDOW_SNAPSHOT
    ),
    tzOffsetMinutesSnapshot: integer(COL.TZ_OFFSET_MINUTES_SNAPSHOT),
    generatedAt: text(COL.GENERATED_AT).notNull(),
    completedAt: text(COL.COMPLETED_AT),
    exposuresRequired: integer(COL.EXPOSURES_REQUIRED),
    exposuresCompleted: integer(COL.EXPOSURES_COMPLETED).default(0),
    outcome: text(COL.OUTCOME),
    // NOTE: Postgres uses a boolean type for `active`.
    // We keep SQLite as integer 0/1 but conceptually this is boolean;
    // downstream code and sync logic treat non-zero as true.
    active: integer(COL.ACTIVE).default(1).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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

export const genre = sqliteTable(TBL.GENRE, {
  id: text(COL.ID).primaryKey().notNull(), // UUID (was TEXT semantic ID)
  name: text(COL.NAME),
  region: text(COL.REGION),
  description: text(COL.DESCRIPTION),
});

export const genreTuneType = sqliteTable(
  TBL.GENRE_TUNE_TYPE,
  {
    genreId: text(COL.GENRE_ID)
      .notNull()
      .references(() => genre.id), // UUID FK
    tuneTypeId: text(COL.TUNE_TYPE_ID)
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
  TBL.INSTRUMENT,
  {
    id: text(COL.ID).primaryKey().notNull(), // UUID
    privateToUser: text(COL.PRIVATE_TO_USER).references(() => userProfile.id), // UUID FK to internal ID
    instrument: text(COL.INSTRUMENT),
    description: text(COL.DESCRIPTION),
    genreDefault: text(COL.GENRE_DEFAULT), // UUID FK to genre
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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
  TBL.NOTE,
  {
    id: text(COL.ID).primaryKey().notNull(), // UUID
    userRef: text(COL.USER_REF).references(() => userProfile.id), // UUID FK to internal ID
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id), // UUID FK
    playlistRef: text(COL.PLAYLIST_REF).references(() => playlist.playlistId), // UUID FK
    createdDate: text(COL.CREATED_DATE),
    noteText: text(COL.NOTE_TEXT),
    public: integer(COL.PUBLIC).default(0).notNull(),
    favorite: integer(COL.FAVORITE),
    displayOrder: integer(COL.DISPLAY_ORDER).default(0).notNull(), // For drag ordering
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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
  TBL.PLAYLIST,
  {
    playlistId: text(COL.PLAYLIST_ID).primaryKey().notNull(), // UUID
    userRef: text(COL.USER_REF)
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    name: text(COL.NAME),
    instrumentRef: text(COL.INSTRUMENT_REF), // UUID FK
    genreDefault: text(COL.GENRE_DEFAULT).references(() => genre.id), // UUID FK
    srAlgType: text(COL.SR_ALG_TYPE),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  }
  // Note: Removed unique index on (user_ref, instrument_ref) to allow
  // multiple playlists per user per instrument (e.g., "Beginner Fiddle", "Advanced Fiddle")
);

export const playlistTune = sqliteTable(
  TBL.PLAYLIST_TUNE,
  {
    playlistRef: text(COL.PLAYLIST_REF)
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id), // UUID FK
    current: text(COL.CURRENT),
    learned: text(COL.LEARNED),
    scheduled: text(COL.SCHEDULED),
    goal: text(COL.GOAL).default("recall"),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => [
    primaryKey({
      columns: [table.playlistRef, table.tuneRef],
      name: "playlist_tune_playlist_ref_tune_ref_pk",
    }),
  ]
);

export const practiceRecord = sqliteTable(
  TBL.PRACTICE_RECORD,
  {
    id: text(COL.ID).primaryKey().notNull(), // UUID
    playlistRef: text(COL.PLAYLIST_REF)
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id), // UUID FK
    practiced: text(COL.PRACTICED),
    quality: integer(COL.QUALITY),
    easiness: real(COL.EASINESS),
    difficulty: real(COL.DIFFICULTY),
    stability: real(COL.STABILITY),
    interval: integer(COL.INTERVAL),
    step: integer(COL.STEP),
    repetitions: integer(COL.REPETITIONS),
    lapses: integer(COL.LAPSES),
    elapsedDays: integer(COL.ELAPSED_DAYS),
    state: integer(COL.STATE),
    due: text(COL.DUE),
    backupPracticed: text(COL.BACKUP_PRACTICED),
    goal: text(COL.GOAL).default("recall"),
    technique: text(COL.TECHNIQUE),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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

export const prefsSchedulingOptions = sqliteTable(
  TBL.PREFS_SCHEDULING_OPTIONS,
  {
    userId: text(COL.USER_ID)
      .primaryKey()
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    acceptableDelinquencyWindow: integer(COL.ACCEPTABLE_DELINQUENCY_WINDOW)
      .default(21)
      .notNull(),
    minReviewsPerDay: integer(COL.MIN_REVIEWS_PER_DAY),
    maxReviewsPerDay: integer(COL.MAX_REVIEWS_PER_DAY),
    daysPerWeek: integer(COL.DAYS_PER_WEEK),
    weeklyRules: text(COL.WEEKLY_RULES),
    exceptions: text(COL.EXCEPTIONS),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  }
);

export const prefsSpacedRepetition = sqliteTable(
  TBL.PREFS_SPACED_REPETITION,
  {
    userId: text(COL.USER_ID)
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    algType: text(COL.ALG_TYPE).notNull(),
    fsrsWeights: text(COL.FSRS_WEIGHTS),
    requestRetention: real(COL.REQUEST_RETENTION),
    maximumInterval: integer(COL.MAXIMUM_INTERVAL),
    learningSteps: text(COL.LEARNING_STEPS),
    relearningSteps: text(COL.RELEARNING_STEPS),
    enableFuzzing: integer(COL.ENABLE_FUZZING),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.algType],
      name: "prefs_spaced_repetition_user_id_alg_type_pk",
    }),
  ]
);

export const reference = sqliteTable(
  TBL.REFERENCE,
  {
    id: text(COL.ID).primaryKey().notNull(), // UUID
    url: text(COL.URL).notNull(),
    refType: text(COL.REF_TYPE),
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id), // UUID FK
    userRef: text(COL.USER_REF).references(() => userProfile.id), // UUID FK to internal ID
    comment: text(COL.COMMENT),
    title: text(COL.TITLE),
    public: integer(COL.PUBLIC),
    favorite: integer(COL.FAVORITE),
    displayOrder: integer(COL.DISPLAY_ORDER).default(0).notNull(), // For drag ordering
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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

/**
 * Sync Outbox Table - Populated by SQL triggers
 *
 * This table is the new "Local Outbox Pattern" replacement for sync_queue.
 * SQL triggers automatically insert rows here on INSERT/UPDATE/DELETE,
 * and the sync worker processes them to push changes to Supabase.
 *
 * Key differences from sync_queue:
 * - Populated by triggers (not manual queueSync calls)
 * - rowId is a JSON string for composite PKs
 * - Uses changedAt for ordering (not UUID-based ordering)
 */
export const syncOutbox = sqliteTable(
  TBL.SYNC_OUTBOX,
  {
    // Random hex ID for outbox entry (triggers use: lower(hex(randomblob(16))))
    id: text(COL.ID).primaryKey().notNull(),
    // Table being synced (snake_case to match trigger column names)
    tableName: text(COL.TABLE_NAME).notNull(),
    // Row ID: simple string for single PK, JSON string for composite PK
    // e.g., "abc-123" or '{"user_id":"x","tune_id":"y"}'
    rowId: text(COL.ROW_ID).notNull(),
    // INSERT, UPDATE, or DELETE
    operation: text(COL.OPERATION).notNull(),
    // pending | in_progress | completed | failed
    status: text(COL.STATUS).default("pending").notNull(),
    // When the trigger fired (ISO 8601)
    changedAt: text(COL.CHANGED_AT).notNull(),
    // When sync worker processed (ISO 8601)
    syncedAt: text(COL.SYNCED_AT),
    // Retry tracking
    attempts: integer(COL.ATTEMPTS).default(0).notNull(),
    lastError: text(COL.LAST_ERROR),
  },
  (table) => [
    // Index for sync worker to fetch pending items in order
    index("idx_outbox_status_changed").on(table.status, table.changedAt),
    // Index for deduplication within same table/row
    index("idx_outbox_table_row").on(table.tableName, table.rowId),
  ]
);

export const tabGroupMainState = sqliteTable(TBL.TAB_GROUP_MAIN_STATE, {
  id: text(COL.ID).primaryKey().notNull(), // UUID
  userId: text(COL.USER_ID)
    .notNull()
    .references(() => userProfile.id), // UUID FK to internal ID
  whichTab: text(COL.WHICH_TAB).default("practice"),
  playlistId: text(COL.PLAYLIST_ID_FK), // UUID FK
  tabSpec: text(COL.TAB_SPEC),
  practiceShowSubmitted: integer(COL.PRACTICE_SHOW_SUBMITTED).default(0),
  practiceModeFlashcard: integer(COL.PRACTICE_MODE_FLASHCARD).default(0),
  sidebarDockPosition: text(COL.SIDEBAR_DOCK_POSITION).default("left"),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const tableState = sqliteTable(
  TBL.TABLE_STATE,
  {
    userId: text(COL.USER_ID)
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    screenSize: text(COL.SCREEN_SIZE).notNull(),
    purpose: text(COL.PURPOSE).notNull(),
    playlistId: text(COL.PLAYLIST_ID_FK)
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    settings: text(COL.SETTINGS),
    currentTune: text(COL.CURRENT_TUNE), // UUID
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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
  TBL.TABLE_TRANSIENT_DATA,
  {
    userId: text(COL.USER_ID)
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    tuneId: text(COL.TUNE_ID)
      .notNull()
      .references(() => tune.id), // UUID FK
    playlistId: text(COL.PLAYLIST_ID_FK)
      .notNull()
      .references(() => playlist.playlistId), // UUID FK
    purpose: text(COL.PURPOSE),
    notePrivate: text(COL.NOTE_PRIVATE),
    notePublic: text(COL.NOTE_PUBLIC),
    recallEval: text(COL.RECALL_EVAL),
    practiced: text(COL.PRACTICED),
    quality: integer(COL.QUALITY),
    easiness: real(COL.EASINESS),
    difficulty: real(COL.DIFFICULTY),
    interval: integer(COL.INTERVAL),
    step: integer(COL.STEP),
    repetitions: integer(COL.REPETITIONS),
    due: text(COL.DUE),
    backupPracticed: text(COL.BACKUP_PRACTICED),
    goal: text(COL.GOAL),
    technique: text(COL.TECHNIQUE),
    stability: real(COL.STABILITY),
    state: integer(COL.STATE).default(2),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.tuneId, table.playlistId],
      name: "table_transient_data_user_id_tune_id_playlist_id_pk",
    }),
  ]
);

export const tag = sqliteTable(
  TBL.TAG,
  {
    id: text(COL.ID).primaryKey().notNull(), // UUID (renamed from tagId)
    userRef: text(COL.USER_REF)
      .notNull()
      .references(() => userProfile.id), // UUID FK to internal ID
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id), // UUID FK
    tagText: text(COL.TAG_TEXT).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
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

export const tune = sqliteTable(TBL.TUNE, {
  id: text(COL.ID).primaryKey().notNull(), // UUID
  idForeign: integer(COL.ID_FOREIGN), // Legacy integer ID for provenance tracking (nullable, non-unique)
  primaryOrigin: text(COL.PRIMARY_ORIGIN).default("irishtune.info"), // Source: 'irishtune.info', 'user_created', etc.
  title: text(COL.TITLE),
  type: text(COL.TYPE),
  structure: text(COL.STRUCTURE),
  mode: text(COL.MODE),
  incipit: text(COL.INCIPIT),
  genre: text(COL.GENRE).references(() => genre.id), // UUID FK
  privateFor: text(COL.PRIVATE_FOR).references(() => userProfile.id), // UUID FK to internal ID
  deleted: integer(COL.DELETED).default(0).notNull(),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const tuneOverride = sqliteTable(TBL.TUNE_OVERRIDE, {
  id: text(COL.ID).primaryKey().notNull(), // UUID
  tuneRef: text(COL.TUNE_REF)
    .notNull()
    .references(() => tune.id), // UUID FK
  userRef: text(COL.USER_REF)
    .notNull()
    .references(() => userProfile.id), // UUID FK to internal ID
  title: text(COL.TITLE),
  type: text(COL.TYPE),
  structure: text(COL.STRUCTURE),
  genre: text(COL.GENRE).references(() => genre.id), // UUID FK
  mode: text(COL.MODE),
  incipit: text(COL.INCIPIT),
  deleted: integer(COL.DELETED).default(0).notNull(),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const tuneType = sqliteTable(TBL.TUNE_TYPE, {
  id: text(COL.ID).primaryKey().notNull(), // UUID (was TEXT semantic ID)
  name: text(COL.NAME),
  rhythm: text(COL.RHYTHM),
  description: text(COL.DESCRIPTION),
});

export const userProfile = sqliteTable(
  TBL.USER_PROFILE,
  {
    id: text(COL.ID).notNull(), // UUID (matches PostgreSQL, but not used as PK in SQLite)
    supabaseUserId: text(COL.SUPABASE_USER_ID).primaryKey().notNull(), // UUID PK
    name: text(COL.NAME),
    email: text(COL.EMAIL),
    avatarUrl: text(COL.AVATAR_URL), // User avatar image URL (predefined or custom upload)
    srAlgType: text(COL.SR_ALG_TYPE),
    phone: text(COL.PHONE),
    phoneVerified: text(COL.PHONE_VERIFIED),
    acceptableDelinquencyWindow: integer(
      COL.ACCEPTABLE_DELINQUENCY_WINDOW
    ).default(21),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => [
    uniqueIndex("user_profile_id_unique").on(table.id),
    uniqueIndex("user_profile_supabase_user_id_unique").on(
      table.supabaseUserId
    ),
  ]
);
