/**
 * Sync Columns for Multi-Device Synchronization
 *
 * These columns are added to all user-modifiable tables to enable
 * conflict resolution and track changes across devices.
 *
 * Applied to:
 * - user_profile, playlist, playlist_tune, practice_record
 * - daily_practice_queue, note, reference, tag, tune_override
 * - tune, instrument, prefs_*, table_state, tab_group_main_state
 * - table_transient_data
 *
 * NOT applied to:
 * - genre, tune_type, genre_tune_type (system reference data)
 */

import { integer, text, timestamp } from "drizzle-orm/pg-core";
import {
  integer as sqliteInteger,
  text as sqliteText,
} from "drizzle-orm/sqlite-core";

/**
 * PostgreSQL Sync Columns
 *
 * Use these for Supabase PostgreSQL schema
 */
export const pgSyncColumns = {
  /**
   * Optimistic locking version number
   * Incremented on every update
   * Used for conflict detection (last-write-wins with user override)
   */
  syncVersion: integer("sync_version").default(1).notNull(),

  /**
   * Last modification timestamp
   * Updated on every write
   * Used for conflict resolution and sorting
   */
  lastModifiedAt: timestamp("last_modified_at").defaultNow().notNull(),

  /**
   * Device identifier (UUID or client-generated ID)
   * Useful for debugging multi-device sync conflicts
   * Enables analytics (which device is most active)
   * Allows user-facing device labels ("iPhone", "MacBook Pro")
   */
  deviceId: text("device_id"),
};

/**
 * SQLite Sync Columns
 *
 * Use these for SQLite WASM schema (local offline database)
 * Note: Timestamps are TEXT (ISO 8601 strings) in SQLite
 */
export const sqliteSyncColumns = {
  /**
   * Optimistic locking version number
   * Incremented on every update
   * Used for conflict detection (last-write-wins with user override)
   */
  syncVersion: sqliteInteger("sync_version").default(1).notNull(),

  /**
   * Last modification timestamp (ISO 8601 string)
   * Updated on every write
   * Used for conflict resolution and sorting
   */
  lastModifiedAt: sqliteText("last_modified_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),

  /**
   * Device identifier (UUID or client-generated ID)
   * Useful for debugging multi-device sync conflicts
   * Enables analytics (which device is most active)
   * Allows user-facing device labels ("iPhone", "MacBook Pro")
   */
  deviceId: sqliteText("device_id"),
};

/**
 * Type definitions for sync columns
 */
export interface SyncColumns {
  syncVersion: number;
  lastModifiedAt: Date | string;
  deviceId: string | null;
}

/**
 * Sync column names (for queries)
 */
export const SYNC_COLUMN_NAMES = [
  "sync_version",
  "last_modified_at",
  "device_id",
] as const;

/**
 * Helper to check if a table has sync columns
 */
export function hasSyncColumns(tableName: string): boolean {
  const tablesWithSync = [
    "user_profile",
    "playlist",
    "playlist_tune",
    "practice_record",
    "daily_practice_queue",
    "note",
    "reference",
    "tag",
    "tune_override",
    "tune",
    "instrument",
    "prefs_scheduling_options",
    "prefs_spaced_repetition",
    "tab_group_main_state",
    "table_state",
    "table_transient_data",
  ];

  return tablesWithSync.includes(tableName);
}
