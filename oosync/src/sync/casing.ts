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
 * Optional key maps for performance optimization on hot paths.
 *
 * Kept intentionally empty in core `oosync` to remain schema-agnostic.
 * Consumer apps may populate equivalent maps in their own layer if needed.
 */
export const COMMON_KEYS_SNAKE_TO_CAMEL: Record<string, string> = {};

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
 * Fast camelize using optional precomputed map with fallback to regex
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
 * Fast snakify using optional precomputed map with fallback to regex
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
