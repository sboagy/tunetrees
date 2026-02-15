import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { debug } from "./debug";

export function snakeToCamel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function normalizeDatetimeFields(
  row: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  const normalized = { ...row };
  for (const field of fields) {
    const value = normalized[field];
    if (typeof value !== "string") continue;
    let result = value.includes(" ") ? value.replace(" ", "T") : value;
    // Check if already has timezone: Z or +/-HH:MM or +/-HHMM or +/-HH
    if (/Z$/i.test(result) || /[+-]\d{2}(:?\d{2})?$/.test(result)) {
      normalized[field] = result;
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result)) {
      result = `${result}Z`;
    }
    normalized[field] = result;
  }
  return normalized;
}

export interface TableMetaCore {
  primaryKey: string | string[];
  uniqueKeys: string[] | null;
  timestamps: string[];
  booleanColumns: string[];
  supportsIncremental: boolean;
  hasDeletedFlag: boolean;
}

export interface SyncSchemaDeps {
  /** The list of syncable tables (Postgres snake_case names). */
  syncableTables: readonly string[];
  /** Table metadata (keys/booleans/timestamps) keyed by table name. */
  tableRegistryCore: Record<string, TableMetaCore>;
  /** Worker-only, app-specific rules/config blob. */
  workerSyncConfig: unknown;
  /** Drizzle schema tables (camelCase, worker runtime). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaTables?: Record<string, any>;
}

export type TableMeta = TableMetaCore;

// ==============================
// Worker config (opaque)
// ==============================

type NumericKind = "int" | "float";

export interface IWorkerCollectionConfig {
  table: string;
  idColumn: string;
  ownerColumn: string;
}

export type PullTableRule =
  | { kind: "eqUserId"; column: string }
  | { kind: "orNullEqUserId"; column: string }
  | { kind: "inCollection"; column: string; collection: string }
  | { kind: "rpc"; functionName: string; params: string[] }
  | { kind: "compound"; rules: PullTableRule[]; operator?: "and" | "or" }
  | { kind: "publicOnly"; column: string }
  | { kind: "orEqUserIdOrTrue"; column: string; orColumn: string };

export interface IPullConfig {
  tableRules?: Record<string, PullTableRule>;
}

export interface IPushSanitizeRule {
  ensureSyncProps?: boolean;
  coerceNumericProps?: Array<{ prop: string; kind: NumericKind }>;
  nullIfEmptyStringProps?: string[];
}

export interface IPushUpsertRule {
  omitSetProps?: string[];
  retryMinimalPayloadKeepProps?: string[];
}

export interface IPushTableRule {
  denyDelete?: boolean;
  upsert?: IPushUpsertRule;
  sanitize?: IPushSanitizeRule;
}

export interface IPushConfig {
  tableRules?: Record<string, IPushTableRule>;
}

export interface IWorkerSyncConfig {
  collections?: Record<string, IWorkerCollectionConfig>;
  pull?: IPullConfig;
  push?: IPushConfig;
}

type DbErrorLike = {
  message?: unknown;
  code?: unknown;
  detail?: unknown;
  hint?: unknown;
  table_name?: unknown;
  column_name?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
};

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function describeSyncSchemaError(error: unknown): string {
  const fallback = error instanceof Error ? error.message : String(error);

  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== "object") break;
    const candidate = current as DbErrorLike;

    const code = asNonEmptyString(candidate.code);
    const detail = asNonEmptyString(candidate.detail);
    const hint = asNonEmptyString(candidate.hint);
    const table = asNonEmptyString(candidate.table_name);
    const column = asNonEmptyString(candidate.column_name);
    const constraint = asNonEmptyString(candidate.constraint_name);
    const message = asNonEmptyString(candidate.message);

    const parts = [
      code ? `code=${code}` : undefined,
      table ? `table=${table}` : undefined,
      column ? `column=${column}` : undefined,
      constraint ? `constraint=${constraint}` : undefined,
      detail ? `detail=${detail}` : undefined,
      hint ? `hint=${hint}` : undefined,
      message,
    ].filter((part): part is string => typeof part === "string");

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    current = candidate.cause;
  }

  return fallback;
}

function collectRuleCollections(
  rule: PullTableRule,
  required: Set<string>
): void {
  if (rule.kind === "inCollection") {
    required.add(rule.collection);
    return;
  }

  if (rule.kind === "compound") {
    for (const nested of rule.rules) {
      collectRuleCollections(nested, required);
    }
  }
}

export function createSyncSchema(deps: SyncSchemaDeps) {
  const SYNCABLE_TABLES = deps.syncableTables;
  const TABLE_REGISTRY: Record<string, TableMeta> = deps.tableRegistryCore;

  function getPrimaryKey(tableName: string): string | string[] {
    const meta = TABLE_REGISTRY[tableName];
    if (!meta) throw new Error(`Unknown table: ${tableName}`);
    return meta.primaryKey;
  }

  function getConflictTarget(tableName: string): string[] {
    const meta = TABLE_REGISTRY[tableName];
    if (!meta) throw new Error(`Unknown table: ${tableName}`);
    if (tableName === "user_profile") return ["id"];
    if (meta.uniqueKeys) return meta.uniqueKeys;
    return Array.isArray(meta.primaryKey) ? meta.primaryKey : [meta.primaryKey];
  }

  function getBooleanColumns(tableName: string): string[] {
    const meta = TABLE_REGISTRY[tableName];
    return meta?.booleanColumns ?? [];
  }

  function hasDeletedFlag(tableName: string): boolean {
    const meta = TABLE_REGISTRY[tableName];
    return meta?.hasDeletedFlag ?? false;
  }

  function getTimestampColumns(tableName: string): string[] {
    const meta = TABLE_REGISTRY[tableName];
    return meta?.timestamps ?? [];
  }

  function getWorkerConfig(): IWorkerSyncConfig {
    return deps.workerSyncConfig as unknown as IWorkerSyncConfig;
  }

  function getPullRule(tableName: string): PullTableRule | undefined {
    return getWorkerConfig().pull?.tableRules?.[tableName];
  }

  function getPushRule(tableName: string): IPushTableRule | undefined {
    return getWorkerConfig().push?.tableRules?.[tableName];
  }

  async function loadUserCollections(params: {
    tx: PgTransaction<any, any, any>;
    userId: string;
    tables: Record<string, any>;
    pullTables?: Set<string>;
  }): Promise<Record<string, Set<string>>> {
    const collections = getWorkerConfig().collections ?? {};
    const result: Record<string, Set<string>> = {};

    // For pullTables-scoped sync requests, only load collections that are:
    // 1) directly tied to pulled tables, or
    // 2) required by inCollection pull rules for pulled tables.
    const requiredCollections = new Set<string>();
    if (params.pullTables) {
      for (const tableName of params.pullTables) {
        const rule = getPullRule(tableName);
        if (rule) {
          collectRuleCollections(rule, requiredCollections);
        }
      }
    }

    // Load user collections (repertoires, etc.)
    for (const [name, cfg] of Object.entries(collections)) {
      if (
        params.pullTables &&
        !params.pullTables.has(cfg.table) &&
        !requiredCollections.has(name)
      ) {
        result[name] = new Set();
        continue;
      }

      const table = params.tables[cfg.table];
      if (!table) {
        result[name] = new Set();
        continue;
      }

      const idProp = snakeToCamel(cfg.idColumn);
      const ownerProp = snakeToCamel(cfg.ownerColumn);
      const idCol = table[idProp];
      const ownerCol = table[ownerProp];
      if (!idCol || !ownerCol) {
        result[name] = new Set();
        continue;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const rows = await params.tx
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          .select({ id: idCol })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          .where(eq(ownerCol, params.userId));

        result[name] = new Set(rows.map((r: any) => String(r.id)));
      } catch (error) {
        console.warn(
          `[SYNC] Failed to load collection ${name} (${cfg.table}); continuing with empty set: ${describeSyncSchemaError(error)}`
        );
        result[name] = new Set();
      }
    }

    // Load user's selected genres for catalog filtering
    const userGenreSelectionTable = params.tables.userGenreSelection;
    if (userGenreSelectionTable) {
      try {
        const genreRows = await params.tx
          .select({ genreId: userGenreSelectionTable.genreId })
          .from(userGenreSelectionTable)
          .where(eq(userGenreSelectionTable.userId, params.userId));

        const selectedGenreIds = genreRows.map((r: any) => String(r.genreId));
        result.selectedGenres = new Set(selectedGenreIds);

        debug.log(
          `[SYNC] Loaded ${selectedGenreIds.length} selected genres for user ${params.userId}`
        );
      } catch (error) {
        console.warn(
          `[SYNC] Failed to load user genre selection: ${describeSyncSchemaError(error)}`
        );
        result.selectedGenres = new Set();
      }
    } else {
      result.selectedGenres = new Set();
    }

    return result;
  }

  function applyPullRule(
    rule: PullTableRule,
    params: {
      tableName: string;
      table: any;
      userId: string;
      collections: Record<string, Set<string>>;
    }
  ): unknown[] | null {
    // RPC rules handle all filtering server-side (no WHERE clause needed)
    if (rule.kind === "rpc") {
      return []; // Empty array = no additional filters (RPC handles everything)
    }

    // Compound rule: evaluate each nested rules and combine with OR or AND
    if (rule.kind === "compound") {
      const nestedConditions: any[] = [];

      for (const nestedRule of rule.rules) {
        const result = applyPullRule(nestedRule, params);
        if (result !== null && result.length > 0) {
          nestedConditions.push(...result);
        } else if (rule.operator === "and") {
          // For AND: if any nested rule returns null/empty, entire compound fails
          return null;
        }
      }

      if (nestedConditions.length === 0) return null;
      if (nestedConditions.length === 1) return nestedConditions;

      // Combine nested conditions with AND or OR (default: OR)
      const operator = rule.operator || "or";
      const combiner = operator === "and" ? and : or;
      return [combiner(...nestedConditions) as any];
    }

    // Simple rules: resolve column and apply filter
    const prop = snakeToCamel(rule.column);
    const col = params.table[prop];
    if (!col) return [];

    if (rule.kind === "eqUserId") {
      return [eq(col, params.userId)];
    }

    if (rule.kind === "orNullEqUserId") {
      return [or(isNull(col), eq(col, params.userId))];
    }

    if (rule.kind === "inCollection") {
      const ids = params.collections[rule.collection];
      const arr = ids ? Array.from(ids) : [];
      if (arr.length === 0) return null;
      return [inArray(col, arr)];
    }

    if (rule.kind === "orEqUserIdOrTrue") {
      const orProp = snakeToCamel(rule.orColumn);
      const orCol = params.table[orProp];
      if (!orCol) return [];
      return [or(eq(col, params.userId), eq(orCol, true))];
    }

    if (rule.kind === "publicOnly") {
      return [isNull(col)];
    }

    return [];
  }

  function buildUserFilter(params: {
    tableName: string;
    table: any;
    userId: string;
    collections: Record<string, Set<string>>;
  }): unknown[] | null {
    // Queue rows are repertoire-scoped in practice and this avoids hard dependency
    // on user_ref for environments where that column may drift/mismatch.
    if (params.tableName === "daily_practice_queue" && params.table.repertoireRef) {
      const repertoireIds = params.collections.repertoireIds
        ? Array.from(params.collections.repertoireIds)
        : [];
      if (repertoireIds.length === 0) return null;
      return [inArray(params.table.repertoireRef, repertoireIds)];
    }

    const rule = getPullRule(params.tableName);
    if (rule) {
      return applyPullRule(rule, params);
    }

    // Heuristic fallback (schema-agnostic conventions).
    const conditions: unknown[] = [];

    if (params.table.userId) {
      conditions.push(eq(params.table.userId, params.userId));
    } else if (params.table.userRef) {
      conditions.push(eq(params.table.userRef, params.userId));
    } else if (params.table.privateFor) {
      conditions.push(
        or(
          isNull(params.table.privateFor),
          eq(params.table.privateFor, params.userId)
        )
      );
    } else if (params.table.privateToUser) {
      conditions.push(
        or(
          isNull(params.table.privateToUser),
          eq(params.table.privateToUser, params.userId)
        )
      );
    }

    return conditions;
  }

  function normalizeRowForSync(
    tableName: string,
    row: Record<string, unknown>
  ): Record<string, unknown> {
    // Transform ALL column names from snake_case to camelCase (RPC returns Postgres snake_case)
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = snakeToCamel(key);
      normalized[camelKey] = value;
    }

    // Then normalize timestamp fields
    const timestampsSnake = getTimestampColumns(tableName);
    if (timestampsSnake.length === 0) return normalized;
    const props = timestampsSnake.map(snakeToCamel);
    return normalizeDatetimeFields(normalized, props);
  }

  function minimalPayload(
    data: Record<string, unknown>,
    keep: string[]
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const k of keep) {
      if (k in data) result[k] = data[k];
    }
    return result;
  }

  function sanitizeForPush(params: {
    tableName: string;
    changeLastModifiedAt: string;
    data: Record<string, unknown>;
  }): { data: Record<string, unknown>; changed: string[] } {
    const rule = getPushRule(params.tableName);
    const sanitize = rule?.sanitize;
    if (!sanitize) return { data: params.data, changed: [] };

    const changed: string[] = [];
    const result: Record<string, unknown> = { ...params.data };

    if (sanitize.ensureSyncProps) {
      if (
        typeof result.lastModifiedAt !== "string" ||
        result.lastModifiedAt === ""
      ) {
        result.lastModifiedAt = params.changeLastModifiedAt;
        changed.push("lastModifiedAt");
      }
      if (
        typeof result.syncVersion !== "number" &&
        !(
          typeof result.syncVersion === "string" &&
          result.syncVersion.trim() !== ""
        )
      ) {
        result.syncVersion = 1;
        changed.push("syncVersion");
      }
    }

    const numeric = sanitize.coerceNumericProps ?? [];
    for (const field of numeric) {
      const value = result[field.prop];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "") {
          result[field.prop] = null;
          changed.push(field.prop);
          continue;
        }
        const parsed =
          field.kind === "int" ? Number.parseInt(trimmed, 10) : Number(trimmed);
        if (!Number.isFinite(parsed)) {
          result[field.prop] = null;
          changed.push(field.prop);
          continue;
        }
        result[field.prop] = field.kind === "int" ? Math.trunc(parsed) : parsed;
        changed.push(field.prop);
      } else if (typeof value === "number" && !Number.isFinite(value)) {
        result[field.prop] = null;
        changed.push(field.prop);
      }
    }

    for (const prop of sanitize.nullIfEmptyStringProps ?? []) {
      const value = result[prop];
      if (typeof value === "string" && value.trim() === "") {
        result[prop] = null;
        changed.push(prop);
      }
    }

    return { data: result, changed };
  }

  return {
    SYNCABLE_TABLES,
    TABLE_REGISTRY,
    getPrimaryKey,
    getConflictTarget,
    getBooleanColumns,
    hasDeletedFlag,
    getTimestampColumns,
    getPullRule,
    getPushRule,
    loadUserCollections,
    buildUserFilter,
    normalizeDatetimeFields,
    normalizeRowForSync,
    snakeToCamel,
    minimalPayload,
    sanitizeForPush,
  };
}
