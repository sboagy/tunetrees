/**
 * Table Metadata Registry
 *
 * Single source of truth for sync-related table metadata:
 * - Primary keys (standard and non-standard)
 * - Composite unique keys for UPSERT conflict resolution
 * - Timestamp columns for incremental sync
 * - Boolean columns for SQLite integer ↔ Postgres boolean conversion
 * - Per-table normalization functions
 *
 * @module lib/sync/table-meta
 */

/**
 * Category of change for UI signaling
 */
export type ChangeCategory =
  | "repertoire"
  | "practice"
  | "catalog"
  | "user"
  | null;

/**
 * Metadata for a syncable table
 */
export interface TableMeta {
  /** Primary key column(s) in snake_case */
  primaryKey: string | string[];
  /** Unique constraint columns for UPSERT (snake_case), null if none */
  uniqueKeys: string[] | null;
  /** Timestamp columns (snake_case) */
  timestamps: string[];
  /** Boolean columns that need SQLite integer ↔ Postgres boolean conversion */
  booleanColumns: string[];
  /** Whether this table supports incremental sync (has last_modified_at) */
  supportsIncremental: boolean;
  /** Whether this table has a deleted flag for soft deletes */
  hasDeletedFlag: boolean;
  /** Category of change for UI signaling */
  changeCategory: ChangeCategory;
  /** Optional per-table normalization (e.g., datetime format) */
  normalize?: (row: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Normalize datetime fields that may have space or T separator
 * Standardizes to ISO format with T separator
 */
function normalizeDatetimeFields(
  row: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  const normalized = { ...row };
  for (const field of fields) {
    const value = normalized[field];
    if (typeof value === "string") {
      // Replace single space between date and time with T, if present
      let result = value.includes(" ") ? value.replace(" ", "T") : value;

      // If there is already an explicit timezone (Z or offset), leave as-is
      if (/Z$/i.test(result) || /[+-]\d{2}:?\d{2}$/.test(result)) {
        normalized[field] = result;
        continue;
      }

      // Otherwise, treat as UTC and append Z
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result)) {
        result = `${result}Z`;
      }

      normalized[field] = result;
    }
  }
  return normalized;
}

/**
 * Normalize daily_practice_queue datetime formats
 */
function normalizeDailyPracticeQueue(
  row: Record<string, unknown>
): Record<string, unknown> {
  return normalizeDatetimeFields(row, [
    "window_start_utc",
    "window_end_utc",
    "generated_at",
    "completed_at",
    "snapshot_coalesced_ts",
  ]);
}

/**
 * Normalize practice_record datetime formats
 */
function normalizePracticeRecord(
  row: Record<string, unknown>
): Record<string, unknown> {
  return normalizeDatetimeFields(row, ["practiced", "backup_practiced", "due"]);
}

/**
 * Complete table metadata registry
 *
 * All syncable tables must be registered here.
 * Keys are snake_case table names (matching Supabase/PostgreSQL).
 */
export const TABLE_REGISTRY: Record<string, TableMeta> = {
  // ===== Reference Data Tables =====

  genre: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: [],
    booleanColumns: [],
    supportsIncremental: false,
    hasDeletedFlag: false,
    changeCategory: "catalog",
  },

  tune_type: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: [],
    booleanColumns: [],
    supportsIncremental: false,
    hasDeletedFlag: false,
    changeCategory: "catalog",
  },

  genre_tune_type: {
    primaryKey: ["genre_id", "tune_type_id"],
    uniqueKeys: ["genre_id", "tune_type_id"],
    timestamps: [],
    booleanColumns: [],
    supportsIncremental: false,
    hasDeletedFlag: false,
    changeCategory: "catalog",
  },

  // ===== User Profile =====

  user_profile: {
    primaryKey: "supabase_user_id", // Non-standard PK
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: ["deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "user",
  },

  // ===== Instrument =====

  instrument: {
    primaryKey: "id",
    uniqueKeys: ["private_to_user", "instrument"],
    timestamps: ["last_modified_at"],
    booleanColumns: ["deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "catalog",
  },

  // ===== User Preferences =====

  prefs_scheduling_options: {
    primaryKey: "user_id",
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: [],
    supportsIncremental: true,
    hasDeletedFlag: false,
    changeCategory: "user",
  },

  prefs_spaced_repetition: {
    primaryKey: ["user_id", "alg_type"],
    uniqueKeys: ["user_id", "alg_type"],
    timestamps: ["last_modified_at"],
    booleanColumns: ["enable_fuzzing"],
    supportsIncremental: true,
    hasDeletedFlag: false,
    changeCategory: "user",
  },

  // ===== Playlist =====

  playlist: {
    primaryKey: "playlist_id", // Non-standard PK name
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: ["deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "repertoire",
  },

  // ===== Table State =====

  table_state: {
    primaryKey: ["user_id", "screen_size", "purpose", "playlist_id"],
    uniqueKeys: ["user_id", "screen_size", "purpose", "playlist_id"],
    timestamps: ["last_modified_at"],
    booleanColumns: [],
    supportsIncremental: true,
    hasDeletedFlag: false,
    changeCategory: null,
  },

  tab_group_main_state: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: ["practice_show_submitted", "practice_mode_flashcard"],
    supportsIncremental: true,
    hasDeletedFlag: false,
    changeCategory: null,
  },

  // ===== Tune =====

  tune: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: ["deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "catalog",
  },

  // ===== Playlist-Tune Association =====

  playlist_tune: {
    primaryKey: ["playlist_ref", "tune_ref"],
    uniqueKeys: ["playlist_ref", "tune_ref"],
    timestamps: ["last_modified_at"],
    booleanColumns: ["deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "repertoire",
  },

  // ===== Practice Record =====

  practice_record: {
    primaryKey: "id",
    uniqueKeys: ["tune_ref", "playlist_ref", "practiced"],
    timestamps: ["practiced", "last_modified_at"],
    booleanColumns: [],
    supportsIncremental: true,
    hasDeletedFlag: false,
    normalize: normalizePracticeRecord,
    changeCategory: "practice",
  },

  // ===== Daily Practice Queue =====

  daily_practice_queue: {
    primaryKey: "id",
    uniqueKeys: ["user_ref", "playlist_ref", "window_start_utc", "tune_ref"],
    timestamps: [
      "window_start_utc",
      "window_end_utc",
      "generated_at",
      "completed_at",
      "snapshot_coalesced_ts",
      "last_modified_at",
    ],
    booleanColumns: ["active"],
    supportsIncremental: true,
    hasDeletedFlag: false,
    normalize: normalizeDailyPracticeQueue,
    changeCategory: "practice",
  },

  // ===== Table Transient Data (Practice Staging) =====

  table_transient_data: {
    primaryKey: ["user_id", "tune_id", "playlist_id"],
    uniqueKeys: ["user_id", "tune_id", "playlist_id"],
    timestamps: ["last_modified_at"],
    booleanColumns: [],
    supportsIncremental: true,
    hasDeletedFlag: false,
    changeCategory: "practice",
  },

  // ===== Note =====

  note: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: ["created_date", "last_modified_at"],
    booleanColumns: ["public", "favorite", "deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "repertoire",
  },

  // ===== Reference =====

  reference: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: ["public", "favorite", "deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "repertoire",
  },

  // ===== Tag =====

  tag: {
    primaryKey: "id",
    uniqueKeys: ["user_ref", "tune_ref", "tag_text"],
    timestamps: ["last_modified_at"],
    booleanColumns: [],
    supportsIncremental: true,
    hasDeletedFlag: false,
    changeCategory: "repertoire",
  },

  // ===== Tune Override =====

  tune_override: {
    primaryKey: "id",
    uniqueKeys: null,
    timestamps: ["last_modified_at"],
    booleanColumns: ["deleted"],
    supportsIncremental: true,
    hasDeletedFlag: true,
    changeCategory: "repertoire",
  },
};

/**
 * All syncable table names (in sync dependency order)
 */
export const SYNCABLE_TABLES = [
  // Reference data first (no dependencies)
  "genre",
  "tune_type",
  "genre_tune_type",
  // User profile (needed for FKs)
  "user_profile",
  // Instrument (depends on user_profile)
  "instrument",
  // User preferences
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  // Playlist (depends on user_profile)
  "playlist",
  // Table state (depends on playlist)
  "table_state",
  "tab_group_main_state",
  // Tune (depends on genre, user_profile)
  "tune",
  // Associations and user data
  "playlist_tune",
  "practice_record",
  "daily_practice_queue",
  "table_transient_data",
  "note",
  "reference",
  "tag",
  "tune_override",
] as const;

export type SyncableTableName = (typeof SYNCABLE_TABLES)[number];

/**
 * Tables with composite primary keys
 */
export const COMPOSITE_PK_TABLES: SyncableTableName[] = [
  "genre_tune_type",
  "prefs_spaced_repetition",
  "table_state",
  "playlist_tune",
  "table_transient_data",
];

/**
 * Tables with non-standard primary key column names (not 'id')
 */
export const NON_STANDARD_PK_TABLES: Record<string, string> = {
  playlist: "playlist_id",
  user_profile: "supabase_user_id",
  prefs_scheduling_options: "user_id",
};

// ===== Helper Functions =====

/**
 * Get the primary key column(s) for a table (snake_case)
 */
export function getPrimaryKey(tableName: string): string | string[] {
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return meta.primaryKey;
}

/**
 * Get unique constraint columns for UPSERT (snake_case)
 * Returns null for tables without unique constraints
 */
export function getUniqueKeys(tableName: string): string[] | null {
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return meta.uniqueKeys;
}

/**
 * Get the conflict target columns for UPSERT operations
 * Uses uniqueKeys if available, otherwise falls back to primaryKey
 */
export function getConflictTarget(tableName: string): string[] {
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) {
    throw new Error(`Unknown table: ${tableName}`);
  }

  if (meta.uniqueKeys) {
    return meta.uniqueKeys;
  }

  // Fall back to primary key
  return Array.isArray(meta.primaryKey) ? meta.primaryKey : [meta.primaryKey];
}

/**
 * Check if a table supports incremental sync (has last_modified_at)
 */
export function supportsIncremental(tableName: string): boolean {
  const meta = TABLE_REGISTRY[tableName];
  return meta?.supportsIncremental ?? false;
}

/**
 * Check if a table has soft delete support (deleted flag)
 */
export function hasDeletedFlag(tableName: string): boolean {
  const meta = TABLE_REGISTRY[tableName];
  return meta?.hasDeletedFlag ?? false;
}

/**
 * Get boolean columns that need conversion for a table
 */
export function getBooleanColumns(tableName: string): string[] {
  const meta = TABLE_REGISTRY[tableName];
  return meta?.booleanColumns ?? [];
}

/**
 * Get the normalization function for a table (if any)
 */
export function getNormalizer(
  tableName: string
): ((row: Record<string, unknown>) => Record<string, unknown>) | undefined {
  const meta = TABLE_REGISTRY[tableName];
  return meta?.normalize;
}

/**
 * Check if a table is registered
 */
export function isRegisteredTable(tableName: string): boolean {
  return tableName in TABLE_REGISTRY;
}

/**
 * Check if a table has a composite primary key
 */
export function hasCompositePK(tableName: string): boolean {
  const meta = TABLE_REGISTRY[tableName];
  return Array.isArray(meta?.primaryKey);
}

/**
 * Build a JSON string for composite key storage in sync_outbox
 * Returns the simple ID string for single-column PKs
 */
export function buildRowIdForOutbox(
  tableName: string,
  row: Record<string, unknown>
): string {
  const pk = getPrimaryKey(tableName);

  if (Array.isArray(pk)) {
    // Composite key - store as JSON
    const keyObj: Record<string, unknown> = {};
    for (const col of pk) {
      keyObj[col] = row[col];
    }
    return JSON.stringify(keyObj);
  }

  // Simple key - store directly
  return String(row[pk]);
}

/**
 * Parse a row_id from sync_outbox back to key values
 */
export function parseOutboxRowId(
  tableName: string,
  rowId: string
): Record<string, unknown> | string {
  const pk = getPrimaryKey(tableName);

  if (Array.isArray(pk)) {
    // Composite key - parse JSON
    try {
      return JSON.parse(rowId) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Invalid JSON row_id for composite key table ${tableName}: ${rowId}`
      );
    }
  }

  // Simple key - return as-is
  return rowId;
}

/**
 * Sync order for tables to respect foreign key dependencies
 */
export const TABLE_SYNC_ORDER: Record<string, number> = {
  // Reference data (no dependencies)
  genre: 1,
  tune_type: 2,
  genre_tune_type: 3,

  // User data (base tables)
  user_profile: 10,
  instrument: 11, // depends on user_profile via private_to_user
  prefs_scheduling_options: 12,
  prefs_spaced_repetition: 13,
  tab_group_main_state: 14,

  // Core data
  tune: 20,
  playlist: 21,
  tag: 22,
  note: 23,
  reference: 24,
  user_annotation: 25,
  tune_override: 26,

  // UI state (depends on user_profile + playlist)
  table_state: 27,

  // Junction/dependent tables (must come after their referenced tables)
  playlist_tune: 30,
  repertoire: 31,
  table_transient_data: 32,

  // Practice data (depends on tune, playlist, playlist_tune)
  daily_practice_queue: 40,
  practice_record: 41,
};

/**
 * Mapping from table name to schema key (camelCase)
 */
export const TABLE_TO_SCHEMA_KEY: Record<string, string> = {
  daily_practice_queue: "dailyPracticeQueue",
  genre: "genre",
  genre_tune_type: "genreTuneType",
  instrument: "instrument",
  note: "note",
  playlist: "playlist",
  playlist_tune: "playlistTune",
  practice_record: "practiceRecord",
  prefs_scheduling_options: "prefsSchedulingOptions",
  prefs_spaced_repetition: "prefsSpacedRepetition",
  reference: "reference",
  sync_outbox: "syncOutbox",
  tab_group_main_state: "tabGroupMainState",
  table_state: "tableState",
  tune: "tune",
  tune_attribute: "tuneAttribute",
  tune_type: "tuneType",
  user_profile: "userProfile",
  tag: "tag",
  repertoire: "repertoire",
  table_transient_data: "tableTransientData",
  user_annotation: "userAnnotation",
  tune_override: "tuneOverride",
};
