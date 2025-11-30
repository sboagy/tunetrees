/**
 * Per-Table Sync Adapters
 *
 * Adapters encapsulate the transform logic for syncing data between
 * local SQLite (camelCase) and remote Supabase (snake_case).
 *
 * Each adapter provides:
 * - toLocal(): Transform Supabase row → local Drizzle row
 * - toRemote(): Transform local Drizzle row → Supabase row
 * - Conflict key metadata for UPSERT operations
 * - Primary key metadata
 *
 * @module lib/sync/adapters
 */

import { camelizeKeys, snakifyKeys } from "./casing";
import {
  getBooleanColumns,
  getNormalizer,
  getPrimaryKey,
  getUniqueKeys,
  type SyncableTableName,
  TABLE_REGISTRY,
} from "./table-meta";

/**
 * Adapter interface for table-specific sync transformations.
 */
export interface TableAdapter {
  /** Table name (snake_case) */
  tableName: SyncableTableName;

  /**
   * Transform Supabase row (snake_case) → local Drizzle row (camelCase).
   * Also converts Postgres booleans to SQLite integers (0/1).
   */
  toLocal(remoteRow: Record<string, unknown>): Record<string, unknown>;

  /**
   * Transform local Drizzle row (camelCase) → Supabase row (snake_case).
   * Also applies table-specific normalization (e.g., datetime formats).
   */
  toRemote(localRow: Record<string, unknown>): Record<string, unknown>;

  /** Conflict keys for UPSERT operations (snake_case). Null if table uses PK for conflicts. */
  conflictKeys: string[] | null;

  /** Primary key column(s) (snake_case) */
  primaryKey: string | string[];

  /** Boolean columns that need integer ↔ boolean conversion */
  booleanColumns: string[];
}

/**
 * Convert a snake_case key to camelCase.
 */
function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Create an adapter for a specific table.
 *
 * The adapter uses:
 * - Casing utilities for key transformation
 * - Table metadata for boolean columns and normalization
 *
 * @param tableName - The table name (snake_case)
 * @returns TableAdapter for the specified table
 * @throws Error if table is not registered
 */
export function createAdapter(tableName: SyncableTableName): TableAdapter {
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) {
    throw new Error(`No metadata registered for table: ${tableName}`);
  }

  const booleanColumns = getBooleanColumns(tableName);
  const booleanColumnsCamel = booleanColumns.map(toCamelCase);
  const normalizer = getNormalizer(tableName);
  const primaryKey = getPrimaryKey(tableName);
  const conflictKeys = getUniqueKeys(tableName);

  return {
    tableName,

    toLocal(remoteRow: Record<string, unknown>): Record<string, unknown> {
      // First, convert keys from snake_case to camelCase
      const row = camelizeKeys(remoteRow);

      // Convert Postgres booleans to SQLite integers
      for (const col of booleanColumnsCamel) {
        if (col in row && typeof row[col] === "boolean") {
          row[col] = row[col] ? 1 : 0;
        }
      }

      return row;
    },

    toRemote(localRow: Record<string, unknown>): Record<string, unknown> {
      // First, convert keys from camelCase to snake_case
      let row = snakifyKeys(localRow);

      // Convert SQLite integers to Postgres booleans for boolean columns
      for (const col of booleanColumns) {
        if (col in row) {
          const value = row[col];
          if (typeof value === "number") {
            row[col] = value !== 0;
          }
        }
      }

      // Apply table-specific normalization (e.g., datetime formats)
      if (normalizer) {
        row = normalizer(row);
      }

      return row;
    },

    conflictKeys,
    primaryKey,
    booleanColumns,
  };
}

/**
 * Adapter cache to avoid recreating adapters on every call.
 */
const adapterCache = new Map<SyncableTableName, TableAdapter>();

/**
 * Get adapter for a table (cached).
 *
 * @param tableName - The table name (snake_case)
 * @returns TableAdapter for the specified table
 */
export function getAdapter(tableName: SyncableTableName): TableAdapter {
  let adapter = adapterCache.get(tableName);
  if (!adapter) {
    adapter = createAdapter(tableName);
    adapterCache.set(tableName, adapter);
  }
  return adapter;
}

/**
 * Clear the adapter cache (useful for testing).
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}

/**
 * Check if a table has an adapter (i.e., is registered).
 */
export function hasAdapter(tableName: string): tableName is SyncableTableName {
  return tableName in TABLE_REGISTRY;
}

/**
 * Get all registered table names.
 */
export function getRegisteredTables(): SyncableTableName[] {
  return Object.keys(TABLE_REGISTRY) as SyncableTableName[];
}

/**
 * Batch transform multiple rows from remote to local format.
 *
 * @param tableName - The table name
 * @param rows - Array of remote rows (snake_case)
 * @returns Array of local rows (camelCase)
 */
export function batchToLocal(
  tableName: SyncableTableName,
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const adapter = getAdapter(tableName);
  return rows.map((row) => adapter.toLocal(row));
}

/**
 * Batch transform multiple rows from local to remote format.
 *
 * @param tableName - The table name
 * @param rows - Array of local rows (camelCase)
 * @returns Array of remote rows (snake_case)
 */
export function batchToRemote(
  tableName: SyncableTableName,
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const adapter = getAdapter(tableName);
  return rows.map((row) => adapter.toRemote(row));
}
