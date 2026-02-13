/**
 * Database Constants
 *
 * Single Source of Truth for Table and Column names.
 * Shared between Client (SQLite) and Worker (Postgres).
 */

export const TBL = {
  DAILY_PRACTICE_QUEUE: "daily_practice_queue",
  GENRE: "genre",
  GENRE_TUNE_TYPE: "genre_tune_type",
  INSTRUMENT: "instrument",
  NOTE: "note",
  PLAYLIST: "playlist",
  PLAYLIST_TUNE: "playlist_tune",
  PRACTICE_RECORD: "practice_record",
  PREFS_SCHEDULING_OPTIONS: "prefs_scheduling_options",
  PREFS_SPACED_REPETITION: "prefs_spaced_repetition",
  REFERENCE: "reference",
  // Client SQLite: queue of changes to push to server (has status, operation, attempts)
  SYNC_PUSH_QUEUE: "sync_push_queue",
  // Server Postgres: log of changes for clients to pull (stateless: just table/row/timestamp)
  SYNC_CHANGE_LOG: "sync_change_log",
  TAB_GROUP_MAIN_STATE: "tab_group_main_state",
  TABLE_STATE: "table_state",
  TABLE_TRANSIENT_DATA: "table_transient_data",
  TAG: "tag",
  TUNE: "tune",
  TUNE_OVERRIDE: "tune_override",
  TUNE_TYPE: "tune_type",
  USER_PROFILE: "user_profile",
} as const;

export const COL = {
  // Common
  ID: "id",
  SYNC_VERSION: "sync_version",
  LAST_MODIFIED_AT: "last_modified_at",
  DEVICE_ID: "device_id",
  DELETED: "deleted",
  USER_REF: "user_ref",
  TUNE_REF: "tune_ref",
  PLAYLIST_REF: "playlist_ref",
  GENRE_ID: "genre_id",
  TUNE_TYPE_ID: "tune_type_id",
  NAME: "name",
  DESCRIPTION: "description",
  SETTINGS: "settings",

  // daily_practice_queue
  QUEUE_DATE: "queue_date",
  WINDOW_START_UTC: "window_start_utc",
  WINDOW_END_UTC: "window_end_utc",
  BUCKET: "bucket",
  ORDER_INDEX: "order_index",
  SNAPSHOT_COALESCED_TS: "snapshot_coalesced_ts",
  SCHEDULED_SNAPSHOT: "scheduled_snapshot",
  LATEST_DUE_SNAPSHOT: "latest_due_snapshot",
  ACCEPTABLE_DELINQUENCY_WINDOW_SNAPSHOT:
    "acceptable_delinquency_window_snapshot",
  TZ_OFFSET_MINUTES_SNAPSHOT: "tz_offset_minutes_snapshot",
  GENERATED_AT: "generated_at",
  COMPLETED_AT: "completed_at",
  EXPOSURES_REQUIRED: "exposures_required",
  EXPOSURES_COMPLETED: "exposures_completed",
  OUTCOME: "outcome",
  ACTIVE: "active",

  // genre
  REGION: "region",

  // instrument
  PRIVATE_TO_USER: "private_to_user",
  INSTRUMENT: "instrument",
  GENRE_DEFAULT: "genre_default",

  // note
  CREATED_DATE: "created_date",
  NOTE_TEXT: "note_text",
  PUBLIC: "public",
  FAVORITE: "favorite",
  DISPLAY_ORDER: "display_order",

  // playlist
  PLAYLIST_ID: "playlist_id",
  INSTRUMENT_REF: "instrument_ref",
  SR_ALG_TYPE: "sr_alg_type",

  // playlist_tune
  CURRENT: "current",
  LEARNED: "learned",
  SCHEDULED: "scheduled",
  GOAL: "goal",

  // practice_record
  PRACTICED: "practiced",
  QUALITY: "quality",
  EASINESS: "easiness",
  DIFFICULTY: "difficulty",
  STABILITY: "stability",
  INTERVAL: "interval",
  STEP: "step",
  REPETITIONS: "repetitions",
  LAPSES: "lapses",
  ELAPSED_DAYS: "elapsed_days",
  STATE: "state",
  DUE: "due",
  BACKUP_PRACTICED: "backup_practiced",
  TECHNIQUE: "technique",

  // prefs_scheduling_options
  USER_ID: "user_id",
  ACCEPTABLE_DELINQUENCY_WINDOW: "acceptable_delinquency_window",
  MIN_REVIEWS_PER_DAY: "min_reviews_per_day",
  MAX_REVIEWS_PER_DAY: "max_reviews_per_day",
  DAYS_PER_WEEK: "days_per_week",
  WEEKLY_RULES: "weekly_rules",
  EXCEPTIONS: "exceptions",
  AUTO_SCHEDULE_NEW: "auto_schedule_new",

  // prefs_spaced_repetition
  ALG_TYPE: "alg_type",
  FSRS_WEIGHTS: "fsrs_weights",
  REQUEST_RETENTION: "request_retention",
  MAXIMUM_INTERVAL: "maximum_interval",
  LEARNING_STEPS: "learning_steps",
  RELEARNING_STEPS: "relearning_steps",
  ENABLE_FUZZING: "enable_fuzzing",

  // reference
  URL: "url",
  REF_TYPE: "ref_type",
  COMMENT: "comment",
  TITLE: "title",

  // sync_push_queue (SQLite client) and sync_change_log (Postgres server)
  TABLE_NAME: "table_name",
  RECORD_ID: "record_id",
  OPERATION: "operation", // SQLite only
  DATA: "data",
  STATUS: "status", // SQLite only
  CREATED_AT: "created_at",
  SYNCED_AT: "synced_at", // SQLite only
  ATTEMPTS: "attempts", // SQLite only
  LAST_ERROR: "last_error", // SQLite only
  ROW_ID: "row_id",
  CHANGED_AT: "changed_at",

  // tab_group_main_state
  WHICH_TAB: "which_tab",
  PLAYLIST_ID_FK: "playlist_id", // Note: playlist_id is used as PK in playlist table, but as FK here
  TAB_SPEC: "tab_spec",
  PRACTICE_SHOW_SUBMITTED: "practice_show_submitted",
  PRACTICE_MODE_FLASHCARD: "practice_mode_flashcard",
  SIDEBAR_DOCK_POSITION: "sidebar_dock_position",

  // table_state
  SCREEN_SIZE: "screen_size",
  PURPOSE: "purpose",
  CURRENT_TUNE: "current_tune",

  // table_transient_data
  TUNE_ID: "tune_id",
  NOTE_PRIVATE: "note_private",
  NOTE_PUBLIC: "note_public",
  RECALL_EVAL: "recall_eval",

  // tag
  TAG_TEXT: "tag_text",

  // tune
  ID_FOREIGN: "id_foreign",
  COMPOSER: "composer",
  ARTIST: "artist",
  RELEASE_YEAR: "release_year",
  PRIMARY_ORIGIN: "primary_origin",
  TYPE: "type",
  STRUCTURE: "structure",
  MODE: "mode",
  INCIPIT: "incipit",
  GENRE: "genre",
  PRIVATE_FOR: "private_for",

  // tune_type
  RHYTHM: "rhythm",

  // user_profile
  EMAIL: "email",
  AVATAR_URL: "avatar_url",
  PHONE: "phone",
  PHONE_VERIFIED: "phone_verified",
} as const;
