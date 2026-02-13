/**
 * Casing Utilities for Sync Transformations
 *
 * Centralized snake_case ↔ camelCase conversion for sync operations.
 * Used by adapters to transform between local (Drizzle/camelCase) and
 * remote (Supabase/snake_case) formats.
 *
 * @module lib/sync/casing
 */

/**
 * Convert a snake_case string to camelCase
 *
 * @example
 * toCamelCase('user_ref') // 'userRef'
 * toCamelCase('last_modified_at') // 'lastModifiedAt'
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a camelCase string to snake_case
 *
 * @example
 * toSnakeCase('userRef') // 'user_ref'
 * toSnakeCase('lastModifiedAt') // 'last_modified_at'
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert all keys in an object from snake_case to camelCase
 *
 * @param obj - Object with snake_case keys (from Supabase)
 * @returns New object with camelCase keys (for Drizzle)
 *
 * @example
 * camelizeKeys({ user_ref: '123', last_modified_at: '2025-01-01' })
 * // { userRef: '123', lastModifiedAt: '2025-01-01' }
 */
export function camelizeKeys<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = value;
  }
  return result;
}

/**
 * Convert all keys in an object from camelCase to snake_case
 *
 * @param obj - Object with camelCase keys (from Drizzle)
 * @returns New object with snake_case keys (for Supabase)
 *
 * @example
 * snakifyKeys({ userRef: '123', lastModifiedAt: '2025-01-01' })
 * // { user_ref: '123', last_modified_at: '2025-01-01' }
 */
export function snakifyKeys<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Precomputed key maps for performance optimization on hot paths.
 * These avoid repeated regex operations for known table schemas.
 *
 * Maps: snake_case → camelCase
 */
export const COMMON_KEYS_SNAKE_TO_CAMEL: Record<string, string> = {
  // Common across many tables
  id: "id",
  user_ref: "userRef",
  user_id: "userId",
  tune_ref: "tuneRef",
  tune_id: "tuneId",
  playlist_ref: "playlistRef",
  playlist_id: "playlistId",
  last_modified_at: "lastModifiedAt",
  sync_version: "syncVersion",
  device_id: "deviceId",
  deleted: "deleted",
  created_at: "createdAt",
  updated_at: "updatedAt",

  // tune table
  private_for: "privateFor",
  title: "title",
  type: "type",
  structure: "structure",
  mode: "mode",
  incipit: "incipit",
  genre: "genre",
  composer: "composer",
  artist: "artist",
  id_foreign: "idForeign",
  release_year: "releaseYear",
  learned: "learned",
  practiced: "practiced",
  quality: "quality",
  ease_factor: "easeFactor",
  interval: "interval",
  repetitions: "repetitions",
  review_date: "reviewDate",
  backup_practiced: "backupPracticed",
  external_ref: "externalRef",
  note_private: "notePrivate",
  note_public: "notePublic",
  tags: "tags",
  recall_eval: "recallEval",

  // practice_record table
  // tune_ref, playlist_ref already covered
  // practiced already covered

  // daily_practice_queue table
  queue_date: "queueDate",
  window_start_utc: "windowStartUtc",
  window_end_utc: "windowEndUtc",
  bucket: "bucket",
  order_index: "orderIndex",
  snapshot_coalesced_ts: "snapshotCoalescedTs",
  scheduled_snapshot: "scheduledSnapshot",
  latest_due_snapshot: "latestDueSnapshot",
  acceptable_delinquency_window_snapshot: "acceptableDelinquencyWindowSnapshot",
  tz_offset_minutes_snapshot: "tzOffsetMinutesSnapshot",
  generated_at: "generatedAt",
  completed_at: "completedAt",
  exposures_required: "exposuresRequired",
  exposures_completed: "exposuresCompleted",
  outcome: "outcome",
  active: "active",

  // playlist table
  name: "name",
  instrument_ref: "instrumentRef",
  genre_default: "genreDefault",
  sr_alg_type: "srAlgType",

  // note table
  created_date: "createdDate",
  note_text: "noteText",
  public: "public",
  favorite: "favorite",
  display_order: "displayOrder",

  // reference table
  ref_type: "refType",
  url: "url",
  // display_order already covered

  // user_profile table
  email: "email",
  avatar_url: "avatarUrl",
  acceptable_delinquency_window: "acceptableDelinquencyWindow",

  // table_state / table_transient_data
  screen_size: "screenSize",
  purpose: "purpose",
  state_json: "stateJson",

  // prefs tables
  alg_type: "algType",
  // various pref fields...

  // genre / tune_type
  region: "region",
  description: "description",
  genre_id: "genreId",
  tune_type_id: "tuneTypeId",

  // instrument
  private_to_user: "privateToUser",
  instrument: "instrument",
};

/**
 * Precomputed key maps: camelCase → snake_case
 * (Inverse of COMMON_KEYS_SNAKE_TO_CAMEL)
 */
export const COMMON_KEYS_CAMEL_TO_SNAKE: Record<string, string> =
  Object.fromEntries(
    Object.entries(COMMON_KEYS_SNAKE_TO_CAMEL).map(([snake, camel]) => [
      camel,
      snake,
    ])
  );

/**
 * Fast camelize using precomputed map with fallback to regex
 */
export function camelizeKeysFast<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = COMMON_KEYS_SNAKE_TO_CAMEL[key] ?? toCamelCase(key);
    result[camelKey] = value;
  }
  return result;
}

/**
 * Fast snakify using precomputed map with fallback to regex
 */
export function snakifyKeysFast<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = COMMON_KEYS_CAMEL_TO_SNAKE[key] ?? toSnakeCase(key);
    result[snakeKey] = value;
  }
  return result;
}
