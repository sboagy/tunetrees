import {
  and,
  eq,
  inArray,
  isNull,
  or,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
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
  | { kind: "inCollection"; column: string; collection: string };

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

export function createSyncSchema(deps: SyncSchemaDeps) {
  const SYNCABLE_TABLES = deps.syncableTables;
  const TABLE_REGISTRY: Record<string, TableMeta> = deps.tableRegistryCore;
  const schemaTables = deps.schemaTables ?? {};

  function getPrimaryKey(tableName: string): string | string[] {
    const meta = TABLE_REGISTRY[tableName];
    if (!meta) throw new Error(`Unknown table: ${tableName}`);
    return meta.primaryKey;
  }

  function getConflictTarget(tableName: string): string[] {
    const meta = TABLE_REGISTRY[tableName];
    if (!meta) throw new Error(`Unknown table: ${tableName}`);
    if (tableName === "user_profile") return ["supabase_user_id"];
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
  }): Promise<Record<string, Set<string>>> {
    const collections = getWorkerConfig().collections ?? {};
    const result: Record<string, Set<string>> = {};

    // Load user collections (playlists, etc.)
    for (const [name, cfg] of Object.entries(collections)) {
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const rows = await params.tx
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .select({ id: idCol })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .from(table)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .where(eq(ownerCol, params.userId));

      result[name] = new Set(rows.map((r: any) => String(r.id)));
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
        console.warn("[SYNC] Failed to load user genre selection:", error);
        result.selectedGenres = new Set();
      }
    } else {
      result.selectedGenres = new Set();
    }

    return result;
  }

  const buildTuneRefFilterCondition = (params: {
    table: any;
    userId: string;
    genreIds: string[];
  }): unknown | null => {
    const tuneRef = params.table?.tuneRef;
    if (!tuneRef || params.genreIds.length === 0) return null;

    const tuneTable = (schemaTables as Record<string, any>).tune;
    if (!tuneTable) return null;

    // Design intent: Filter ALL tables with tune_ref (notes, practice_record, references)
    // by selected genres. This ensures:
    // 1. Anonymous users only sync data for their selected genres (performance + storage)
    // 2. Authenticated users see their full data but catalog is scoped to selected genres
    // 
    // Consequences:
    // - If a user deselects a genre, they won't see notes/practice for those tunes
    // - For authenticated users, the data still exists remotely (not deleted)
    // - For anonymous users, this prevents unnecessary data download
    // 
    // Alternative considered: Only filter catalog tables (tune, reference)
    // Rejected because: Notes/practice for deselected genres waste sync bandwidth

    const tuneConditions: SQLWrapper[] = [];

    if (tuneTable.genre) {
      const genreFilter = inArray(tuneTable.genre, params.genreIds);
      if (genreFilter) {
        const genreCondition = tuneTable.privateFor
          ? and(genreFilter, isNull(tuneTable.privateFor))
          : genreFilter;
        if (genreCondition) tuneConditions.push(genreCondition);
      }
    }

    if (tuneTable.privateFor) {
      tuneConditions.push(eq(tuneTable.privateFor, params.userId));
    }

    if (tuneConditions.length === 0) return null;

    const tuneFilter =
      tuneConditions.length === 1 ? tuneConditions[0] : or(...tuneConditions);
    const subquery = sql`(select id from tune where ${tuneFilter})`;
    return inArray(tuneRef, subquery);
  };

  function buildUserFilter(params: {
    tableName: string;
    table: any;
    userId: string;
    collections: Record<string, Set<string>>;
  }): unknown[] | null {
    const conditions: unknown[] = [];

    // Apply genre filtering for catalog tables
    const selectedGenres = params.collections.selectedGenres;
    const hasGenreFilter = !!selectedGenres && selectedGenres.size > 0;
    const genreIds = hasGenreFilter ? Array.from(selectedGenres) : [];

    if (params.tableName === "tune" || params.tableName === "genre") {
      debug.log(
        `[Worker] buildUserFilter(${params.tableName}): hasGenreFilter=${hasGenreFilter}, genreIds=${genreIds.length} [${genreIds.join(", ")}]`
      );
    }
    const tuneRefFilter = hasGenreFilter
      ? buildTuneRefFilterCondition({
          table: params.table,
          userId: params.userId,
          genreIds,
        })
      : null;
    const applyTuneRefFilter = (conds: unknown[]): unknown[] => {
      if (tuneRefFilter) conds.push(tuneRefFilter);
      return conds;
    };
    const isCatalogTable = [
      "genre",
      "tune",
      "tune_type",
      "genre_tune_type",
    ].includes(params.tableName);

    if (isCatalogTable && hasGenreFilter) {
      if (params.tableName === "genre") {
        debug.log(
          `[Worker] ✅ Returning full genre list (needed for settings UI)`
        );
        // Always return full genre list so settings can display all genres.
        return [];
      } else if (params.tableName === "tune") {
        // Filter tune table to only tunes with selected genres
        if (params.table.genre) {
          conditions.push(inArray(params.table.genre, genreIds));
          // Also include user's private tunes regardless of genre
          if (params.table.privateFor) {
            debug.log(
              `[Worker] ✅ Filtering tune table: public tunes in [${genreIds.join(", ")}] OR user's private tunes`
            );
            return [
              or(
                and(
                  inArray(params.table.genre, genreIds),
                  isNull(params.table.privateFor)
                ),
                eq(params.table.privateFor, params.userId)
              ),
            ];
          }
          return conditions;
        }
      } else if (params.tableName === "genre_tune_type") {
        // Filter junction table to only selected genres
        if (params.table.genreId) {
          conditions.push(inArray(params.table.genreId, genreIds));
          return conditions;
        }
      } else if (params.tableName === "tune_type") {
        // For tune_type, we need to filter based on genre_tune_type junction
        // This is more complex - for now, we'll allow all tune types
        // Future: could query genre_tune_type and filter tune_type accordingly
        return [];
      }
    }

    const rule = getPullRule(params.tableName);
    if (rule) {
      const prop = snakeToCamel(rule.column);
      const col = params.table[prop];
      if (!col) return [];

      if (rule.kind === "eqUserId") {
        conditions.push(eq(col, params.userId));
        return applyTuneRefFilter(conditions);
      }

      if (rule.kind === "orNullEqUserId") {
        conditions.push(or(isNull(col), eq(col, params.userId)));
        return applyTuneRefFilter(conditions);
      }

      if (rule.kind === "inCollection") {
        const ids = params.collections[rule.collection];
        const arr = ids ? Array.from(ids) : [];
        if (arr.length === 0) return null;
        conditions.push(inArray(col, arr));
        return applyTuneRefFilter(conditions);
      }
    }

    // Heuristic fallback (schema-agnostic conventions).
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

    return applyTuneRefFilter(conditions);
  }

  function normalizeRowForSync(
    tableName: string,
    row: Record<string, unknown>
  ): Record<string, unknown> {
    const timestampsSnake = getTimestampColumns(tableName);
    if (timestampsSnake.length === 0) return row;
    const props = timestampsSnake.map(snakeToCamel);
    return normalizeDatetimeFields(row, props);
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
