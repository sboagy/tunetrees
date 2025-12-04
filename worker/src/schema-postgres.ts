/**
 * PostgreSQL Schema Definition for Cloudflare Worker
 *
 * This file defines the Drizzle ORM schema for the central Supabase PostgreSQL database.
 * It mirrors the client-side SQLite schema but uses PostgreSQL-specific types.
 *
 * Key Features:
 * - Uses `shared/db-constants.ts` to ensure table and column names match the client exactly.
 * - Defines all 21 tables required for the application.
 * - Includes `tables` export for dynamic iteration during sync operations.
 * - Maps composite primary keys and indexes appropriate for Postgres.
 */
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { COL, TBL } from "../../shared/db-constants";

export const dailyPracticeQueue = pgTable(
  TBL.DAILY_PRACTICE_QUEUE,
  {
    id: text(COL.ID).primaryKey().notNull(),
    userRef: text(COL.USER_REF).notNull(),
    playlistRef: text(COL.PLAYLIST_REF).notNull(),
    mode: text(COL.MODE),
    queueDate: text(COL.QUEUE_DATE),
    windowStartUtc: text(COL.WINDOW_START_UTC).notNull(),
    windowEndUtc: text(COL.WINDOW_END_UTC).notNull(),
    tuneRef: text(COL.TUNE_REF).notNull(),
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
    // NOTE: PostgreSQL column `active` is a boolean. The worker must
    // reflect that to avoid type mismatches and silent coercion that can
    // flip new windows to inactive. SQLite continues to use 0/1 ints,
    // with the sync engine converting booleans to integers on pull.
    active: boolean(COL.ACTIVE).default(true).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    uniqueQueue: uniqueIndex(
      "daily_practice_queue_user_ref_playlist_ref_window_start_utc_tune_ref_unique"
    ).on(table.userRef, table.playlistRef, table.windowStartUtc, table.tuneRef),
    idxGeneratedAt: index("idx_queue_generated_at").on(table.generatedAt),
    idxUserPlaylistBucket: index("idx_queue_user_playlist_bucket").on(
      table.userRef,
      table.playlistRef,
      table.bucket
    ),
    idxUserPlaylistActive: index("idx_queue_user_playlist_active").on(
      table.userRef,
      table.playlistRef,
      table.active
    ),
    idxUserPlaylistWindow: index("idx_queue_user_playlist_window").on(
      table.userRef,
      table.playlistRef,
      table.windowStartUtc
    ),
  })
);

export const genre = pgTable(TBL.GENRE, {
  id: text(COL.ID).primaryKey().notNull(),
  name: text(COL.NAME),
  region: text(COL.REGION),
  description: text(COL.DESCRIPTION),
});

export const genreTuneType = pgTable(
  TBL.GENRE_TUNE_TYPE,
  {
    genreId: text(COL.GENRE_ID)
      .notNull()
      .references(() => genre.id),
    tuneTypeId: text(COL.TUNE_TYPE_ID)
      .notNull()
      .references(() => tuneType.id),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.genreId, table.tuneTypeId],
      name: "genre_tune_type_genre_id_tune_type_id_pk",
    }),
  })
);

export const instrument = pgTable(
  TBL.INSTRUMENT,
  {
    id: text(COL.ID).primaryKey().notNull(),
    privateToUser: text(COL.PRIVATE_TO_USER).references(() => userProfile.id),
    instrument: text(COL.INSTRUMENT),
    description: text(COL.DESCRIPTION),
    genreDefault: text(COL.GENRE_DEFAULT),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    uniquePrivate: uniqueIndex(
      "instrument_private_to_user_instrument_unique"
    ).on(table.privateToUser, table.instrument),
    idxPrivateToUser: index("idx_instrument_private_to_user").on(
      table.privateToUser
    ),
    idxInstrument: index("idx_instrument_instrument").on(table.instrument),
  })
);

export const note = pgTable(
  TBL.NOTE,
  {
    id: text(COL.ID).primaryKey().notNull(),
    userRef: text(COL.USER_REF).references(() => userProfile.id),
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id),
    playlistRef: text(COL.PLAYLIST_REF).references(() => playlist.playlistId),
    createdDate: text(COL.CREATED_DATE),
    noteText: text(COL.NOTE_TEXT),
    public: integer(COL.PUBLIC).default(0).notNull(),
    favorite: integer(COL.FAVORITE),
    displayOrder: integer(COL.DISPLAY_ORDER).default(0).notNull(),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    idxTuneUser: index("idx_note_tune_user").on(table.tuneRef, table.userRef),
    idxTunePlaylistUserPublic: index("idx_note_tune_playlist_user_public").on(
      table.tuneRef,
      table.playlistRef,
      table.userRef,
      table.public
    ),
    idxTunePlaylist: index("idx_note_tune_playlist").on(
      table.tuneRef,
      table.playlistRef
    ),
  })
);

export const playlist = pgTable(TBL.PLAYLIST, {
  playlistId: text(COL.PLAYLIST_ID).primaryKey().notNull(),
  userRef: text(COL.USER_REF)
    .notNull()
    .references(() => userProfile.id),
  name: text(COL.NAME),
  instrumentRef: text(COL.INSTRUMENT_REF),
  genreDefault: text(COL.GENRE_DEFAULT).references(() => genre.id),
  srAlgType: text(COL.SR_ALG_TYPE),
  deleted: integer(COL.DELETED).default(0).notNull(),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const playlistTune = pgTable(
  TBL.PLAYLIST_TUNE,
  {
    playlistRef: text(COL.PLAYLIST_REF)
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id),
    current: text(COL.CURRENT),
    learned: text(COL.LEARNED),
    scheduled: text(COL.SCHEDULED),
    goal: text(COL.GOAL).default("recall"),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.playlistRef, table.tuneRef],
      name: "playlist_tune_playlist_ref_tune_ref_pk",
    }),
  })
);

export const practiceRecord = pgTable(
  TBL.PRACTICE_RECORD,
  {
    id: text(COL.ID).primaryKey().notNull(),
    playlistRef: text(COL.PLAYLIST_REF)
      .notNull()
      .references(() => playlist.playlistId),
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id),
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
  (table) => ({
    uniquePracticed: uniqueIndex(
      "practice_record_tune_ref_playlist_ref_practiced_unique"
    ).on(table.tuneRef, table.playlistRef, table.practiced),
    idxPracticed: index("idx_practice_record_practiced").on(table.practiced),
    idxTunePlaylistPracticed: index(
      "idx_practice_record_tune_playlist_practiced"
    ).on(table.tuneRef, table.playlistRef, table.practiced),
    idxId: index("idx_practice_record_id").on(table.id),
  })
);

export const prefsSchedulingOptions = pgTable(TBL.PREFS_SCHEDULING_OPTIONS, {
  userId: text(COL.USER_ID)
    .primaryKey()
    .notNull()
    .references(() => userProfile.id),
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
});

export const prefsSpacedRepetition = pgTable(
  TBL.PREFS_SPACED_REPETITION,
  {
    userId: text(COL.USER_ID)
      .notNull()
      .references(() => userProfile.id),
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
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.algType],
      name: "prefs_spaced_repetition_user_id_alg_type_pk",
    }),
  })
);

export const reference = pgTable(
  TBL.REFERENCE,
  {
    id: text(COL.ID).primaryKey().notNull(),
    url: text(COL.URL).notNull(),
    refType: text(COL.REF_TYPE),
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id),
    userRef: text(COL.USER_REF).references(() => userProfile.id),
    comment: text(COL.COMMENT),
    title: text(COL.TITLE),
    public: integer(COL.PUBLIC),
    favorite: integer(COL.FAVORITE),
    displayOrder: integer(COL.DISPLAY_ORDER).default(0).notNull(),
    deleted: integer(COL.DELETED).default(0).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    idxUserTunePublic: index("idx_reference_user_tune_public").on(
      table.userRef,
      table.tuneRef,
      table.public
    ),
    idxTuneUser: index("idx_reference_tune_user_ref").on(
      table.tuneRef,
      table.userRef
    ),
    idxTunePublic: index("idx_reference_tune_public").on(
      table.tuneRef,
      table.public
    ),
  })
);

// Stateless sync_change_log - tracks what changed and when on the server.
// Each client maintains its own lastSyncAt; no per-client status stored here.
// Different from client's sync_push_queue which has status/operation/attempts.
export const syncChangeLog = pgTable(
  TBL.SYNC_CHANGE_LOG,
  {
    id: text(COL.ID).primaryKey().notNull(),
    tableName: text(COL.TABLE_NAME).notNull(),
    rowId: text(COL.ROW_ID).notNull(),
    changedAt: text(COL.CHANGED_AT).notNull(),
  },
  (table) => ({
    idxChangedAt: index("idx_outbox_changed_at").on(table.changedAt),
    idxTableRow: index("idx_outbox_table_row").on(table.tableName, table.rowId),
  })
);

export const tabGroupMainState = pgTable(TBL.TAB_GROUP_MAIN_STATE, {
  id: text(COL.ID).primaryKey().notNull(),
  userId: text(COL.USER_ID)
    .notNull()
    .references(() => userProfile.id),
  whichTab: text(COL.WHICH_TAB).default("practice"),
  playlistId: text(COL.PLAYLIST_ID_FK),
  tabSpec: text(COL.TAB_SPEC),
  practiceShowSubmitted: integer(COL.PRACTICE_SHOW_SUBMITTED).default(0),
  practiceModeFlashcard: integer(COL.PRACTICE_MODE_FLASHCARD).default(0),
  sidebarDockPosition: text(COL.SIDEBAR_DOCK_POSITION).default("left"),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const tableState = pgTable(
  TBL.TABLE_STATE,
  {
    userId: text(COL.USER_ID)
      .notNull()
      .references(() => userProfile.id),
    screenSize: text(COL.SCREEN_SIZE).notNull(),
    purpose: text(COL.PURPOSE).notNull(),
    playlistId: text(COL.PLAYLIST_ID_FK)
      .notNull()
      .references(() => playlist.playlistId),
    settings: text(COL.SETTINGS),
    currentTune: text(COL.CURRENT_TUNE),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    pk: primaryKey({
      columns: [
        table.userId,
        table.screenSize,
        table.purpose,
        table.playlistId,
      ],
      name: "table_state_user_id_screen_size_purpose_playlist_id_pk",
    }),
  })
);

export const tableTransientData = pgTable(
  TBL.TABLE_TRANSIENT_DATA,
  {
    userId: text(COL.USER_ID)
      .notNull()
      .references(() => userProfile.id),
    tuneId: text(COL.TUNE_ID)
      .notNull()
      .references(() => tune.id),
    playlistId: text(COL.PLAYLIST_ID_FK)
      .notNull()
      .references(() => playlist.playlistId),
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
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.tuneId, table.playlistId],
      name: "table_transient_data_user_id_tune_id_playlist_id_pk",
    }),
  })
);

export const tag = pgTable(
  TBL.TAG,
  {
    id: text("tag_id").primaryKey().notNull(),
    userRef: text(COL.USER_REF)
      .notNull()
      .references(() => userProfile.id),
    tuneRef: text(COL.TUNE_REF)
      .notNull()
      .references(() => tune.id),
    tagText: text(COL.TAG_TEXT).notNull(),
    syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
    lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
    deviceId: text(COL.DEVICE_ID),
  },
  (table) => ({
    uniqueTag: uniqueIndex("tag_user_ref_tune_ref_tag_text_unique").on(
      table.userRef,
      table.tuneRef,
      table.tagText
    ),
    idxUserTune: index("idx_tag_user_ref_tune_ref").on(
      table.userRef,
      table.tuneRef
    ),
    idxUserTag: index("idx_tag_user_ref_tag_text").on(
      table.userRef,
      table.tagText
    ),
  })
);

export const tune = pgTable(TBL.TUNE, {
  id: text(COL.ID).primaryKey().notNull(),
  idForeign: integer(COL.ID_FOREIGN),
  primaryOrigin: text(COL.PRIMARY_ORIGIN).default("irishtune.info"),
  title: text(COL.TITLE),
  type: text(COL.TYPE),
  structure: text(COL.STRUCTURE),
  mode: text(COL.MODE),
  incipit: text(COL.INCIPIT),
  genre: text(COL.GENRE).references(() => genre.id),
  privateFor: text(COL.PRIVATE_FOR).references(() => userProfile.id),
  deleted: integer(COL.DELETED).default(0).notNull(),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const tuneOverride = pgTable(TBL.TUNE_OVERRIDE, {
  id: text(COL.ID).primaryKey().notNull(),
  tuneRef: text(COL.TUNE_REF)
    .notNull()
    .references(() => tune.id),
  userRef: text(COL.USER_REF)
    .notNull()
    .references(() => userProfile.id),
  title: text(COL.TITLE),
  type: text(COL.TYPE),
  structure: text(COL.STRUCTURE),
  genre: text(COL.GENRE).references(() => genre.id),
  mode: text(COL.MODE),
  incipit: text(COL.INCIPIT),
  deleted: integer(COL.DELETED).default(0).notNull(),
  syncVersion: integer(COL.SYNC_VERSION).default(1).notNull(),
  lastModifiedAt: text(COL.LAST_MODIFIED_AT).notNull(),
  deviceId: text(COL.DEVICE_ID),
});

export const tuneType = pgTable(TBL.TUNE_TYPE, {
  id: text(COL.ID).primaryKey().notNull(),
  name: text(COL.NAME),
  rhythm: text(COL.RHYTHM),
  description: text(COL.DESCRIPTION),
});

export const userProfile = pgTable(
  TBL.USER_PROFILE,
  {
    id: text(COL.ID).notNull(),
    supabaseUserId: text(COL.SUPABASE_USER_ID).primaryKey().notNull(),
    name: text(COL.NAME),
    email: text(COL.EMAIL),
    avatarUrl: text(COL.AVATAR_URL),
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
  (table) => ({
    uniqueId: uniqueIndex("user_profile_id_unique").on(table.id),
    uniqueSupabaseId: uniqueIndex("user_profile_supabase_user_id_unique").on(
      table.supabaseUserId
    ),
  })
);

export const tables = {
  [TBL.DAILY_PRACTICE_QUEUE]: dailyPracticeQueue,
  [TBL.GENRE]: genre,
  [TBL.GENRE_TUNE_TYPE]: genreTuneType,
  [TBL.INSTRUMENT]: instrument,
  [TBL.NOTE]: note,
  [TBL.PLAYLIST]: playlist,
  [TBL.PLAYLIST_TUNE]: playlistTune,
  [TBL.PRACTICE_RECORD]: practiceRecord,
  [TBL.PREFS_SCHEDULING_OPTIONS]: prefsSchedulingOptions,
  [TBL.PREFS_SPACED_REPETITION]: prefsSpacedRepetition,
  [TBL.REFERENCE]: reference,
  [TBL.SYNC_CHANGE_LOG]: syncChangeLog,
  [TBL.TAB_GROUP_MAIN_STATE]: tabGroupMainState,
  [TBL.TABLE_STATE]: tableState,
  [TBL.TABLE_TRANSIENT_DATA]: tableTransientData,
  [TBL.TAG]: tag,
  [TBL.TUNE]: tune,
  [TBL.TUNE_OVERRIDE]: tuneOverride,
  [TBL.TUNE_TYPE]: tuneType,
  [TBL.USER_PROFILE]: userProfile,
};
