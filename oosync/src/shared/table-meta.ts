// Schema-agnostic table metadata contract for `oosync`.
//
// `oosync` must not own any concrete application schema (TuneTrees or otherwise).
// Consumers (app/worker/tests) provide a table registry.

/**
 * Category of change for UI signaling (optional; consumers may ignore).
 *
 * Schema-agnostic by design: consumers can define any category labels.
 */
export type ChangeCategory = string | null;

/**
 * Minimal metadata `oosync` needs to reason about row identity.
 *
 * Consumers are free to extend this shape in their own layer.
 */
export interface ITableMeta {
  /** Primary key column(s) in snake_case */
  primaryKey: string | readonly string[];
  /** Unique constraint columns for UPSERT (snake_case), null if none */
  uniqueKeys: readonly string[] | null;
  /** Timestamp columns (snake_case) */
  timestamps: readonly string[];
  /** Boolean columns needing SQLite integer ↔ Postgres boolean conversion */
  booleanColumns: readonly string[];
  /** Whether this table supports incremental sync (has last_modified_at) */
  supportsIncremental: boolean;
  /** Whether this table has a deleted flag for soft deletes */
  hasDeletedFlag: boolean;
  /** Category of change for UI signaling */
  changeCategory?: ChangeCategory;
  /** Optional per-table normalization (e.g., datetime format) */
  normalize?: (
    row: Readonly<Record<string, unknown>>
  ) => Record<string, unknown>;
  /** Optional user-facing descriptions keyed by column name */
  columnDescriptions?: Readonly<Record<string, string>>;
}

export type TableRegistry = Readonly<Record<string, ITableMeta>>;

function isPrimaryKeyArray(
  pk: ITableMeta["primaryKey"]
): pk is readonly string[] {
  return Array.isArray(pk);
}

function getRequiredMeta(
  registry: TableRegistry,
  tableName: string
): ITableMeta {
  const meta = registry[tableName];
  if (!meta) {
    throw new Error(`Unknown table: ${tableName}`);
  }
  return meta;
}

export function getPrimaryKey(
  registry: TableRegistry,
  tableName: string
): string | readonly string[] {
  return getRequiredMeta(registry, tableName).primaryKey;
}

export function getUniqueKeys(
  registry: TableRegistry,
  tableName: string
): readonly string[] | null {
  return getRequiredMeta(registry, tableName).uniqueKeys;
}

export function getConflictTarget(
  registry: TableRegistry,
  tableName: string
): readonly string[] {
  const meta = getRequiredMeta(registry, tableName);
  if (meta.uniqueKeys) return meta.uniqueKeys;
  const pk = meta.primaryKey;
  return isPrimaryKeyArray(pk) ? pk : [pk];
}

export function supportsIncremental(
  registry: TableRegistry,
  tableName: string
): boolean {
  return registry[tableName]?.supportsIncremental ?? false;
}

export function hasDeletedFlag(
  registry: TableRegistry,
  tableName: string
): boolean {
  return registry[tableName]?.hasDeletedFlag ?? false;
}

export function getBooleanColumns(
  registry: TableRegistry,
  tableName: string
): readonly string[] {
  return registry[tableName]?.booleanColumns ?? [];
}

export function getNormalizer(
  registry: TableRegistry,
  tableName: string
):
  | ((row: Readonly<Record<string, unknown>>) => Record<string, unknown>)
  | undefined {
  return registry[tableName]?.normalize;
}

export function isRegisteredTable(
  registry: TableRegistry,
  tableName: string
): boolean {
  return tableName in registry;
}

export function hasCompositePK(
  registry: TableRegistry,
  tableName: string
): boolean {
  const meta = registry[tableName];
  return Array.isArray(meta?.primaryKey);
}

export function buildRowIdForOutbox(
  registry: TableRegistry,
  tableName: string,
  row: Readonly<Record<string, unknown>>
): string {
  const pk = getPrimaryKey(registry, tableName);
  if (isPrimaryKeyArray(pk)) {
    const keyObj: Record<string, unknown> = {};
    for (const col of pk) {
      keyObj[col] = row[col];
    }
    return JSON.stringify(keyObj);
  }
  return String(row[pk]);
}

export function parseOutboxRowId(
  registry: TableRegistry,
  tableName: string,
  rowId: string
): Record<string, unknown> | string {
  const pk = getPrimaryKey(registry, tableName);
  if (isPrimaryKeyArray(pk)) {
    try {
      return JSON.parse(rowId) as Record<string, unknown>;
    } catch {
      throw new Error(
        `Invalid JSON row_id for composite key table ${tableName}: ${rowId}`
      );
    }
  }
  return rowId;
}
