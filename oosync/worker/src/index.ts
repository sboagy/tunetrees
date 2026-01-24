/**
 * Cloudflare Worker Sync Endpoint
 *
 * Architecture:
 * - PUSH: Client sends changes → Worker applies to Postgres
 * - PULL: Worker queries sync_change_log → returns changed rows to client
 *
 * @module worker/index
 */
import { and, count, eq, gt, inArray, lte, max, min } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { jwtVerify } from "jose";
import postgres from "postgres";
import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "../../src/shared/protocol";
import type { IPushTableRule, SyncSchemaDeps } from "./sync-schema";
import { createSyncSchema } from "./sync-schema";

const CORE_COL_DELETED = "deleted";
const CORE_COL_LAST_MODIFIED_AT = "last_modified_at";

type SyncableTableName = string;

export interface WorkerArtifacts extends SyncSchemaDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaTables: Record<string, any>;
}

function notInitialized(name: string): never {
  throw new Error(
    `oosync worker not initialized: missing ${name}. ` +
      "Call createWorker({ schemaTables, syncableTables, tableRegistryCore, workerSyncConfig }) in the consumer worker package."
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let schemaTables: Record<string, any> | null = null;
let SYNCABLE_TABLES: readonly string[] = [];
let TABLE_REGISTRY: Record<string, unknown> = {};

let getPrimaryKey: (tableName: string) => string | string[] = () =>
  notInitialized("getPrimaryKey");
let getConflictTarget: (tableName: string) => string[] = () =>
  notInitialized("getConflictTarget");
let getBooleanColumns: (tableName: string) => string[] = () =>
  notInitialized("getBooleanColumns");
let hasDeletedFlag: (tableName: string) => boolean = () =>
  notInitialized("hasDeletedFlag");
let buildUserFilter: (params: {
  tableName: string;
  table: any;
  userId: string;
  collections: Record<string, Set<string>>;
}) => unknown[] | null = () => notInitialized("buildUserFilter");
let loadUserCollections: (params: {
  tx: PgTransaction<any, any, any>;
  userId: string;
  tables: Record<string, any>;
}) => Promise<Record<string, Set<string>>> = async () =>
  notInitialized("loadUserCollections");
let minimalPayload: (
  data: Record<string, unknown>,
  keep: string[]
) => Record<string, unknown> = () => notInitialized("minimalPayload");
let normalizeRowForSync: (
  tableName: string,
  row: Record<string, unknown>
) => Record<string, unknown> = () => notInitialized("normalizeRowForSync");
let snakeToCamel: (snake: string) => string = () =>
  notInitialized("snakeToCamel");
let sanitizeForPush: (params: {
  tableName: string;
  changeLastModifiedAt: string;
  data: Record<string, unknown>;
}) => { data: Record<string, unknown>; changed: string[] } = () =>
  notInitialized("sanitizeForPush");
let getPushRule: (tableName: string) => IPushTableRule | undefined = () =>
  notInitialized("getPushRule");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaTables(): Record<string, any> {
  if (!schemaTables) {
    notInitialized("schemaTables");
  }
  return schemaTables;
}

export function createWorker(artifacts: WorkerArtifacts) {
  schemaTables = artifacts.schemaTables;

  const schema = createSyncSchema({
    syncableTables: artifacts.syncableTables,
    tableRegistryCore: artifacts.tableRegistryCore,
    workerSyncConfig: artifacts.workerSyncConfig,
  });

  SYNCABLE_TABLES = schema.SYNCABLE_TABLES;
  TABLE_REGISTRY = schema.TABLE_REGISTRY;
  getPrimaryKey = schema.getPrimaryKey;
  getConflictTarget = schema.getConflictTarget;
  getBooleanColumns = schema.getBooleanColumns;
  hasDeletedFlag = schema.hasDeletedFlag;
  buildUserFilter = schema.buildUserFilter;
  loadUserCollections = schema.loadUserCollections;
  minimalPayload = schema.minimalPayload;
  normalizeRowForSync = schema.normalizeRowForSync;
  snakeToCamel = schema.snakeToCamel;
  sanitizeForPush = schema.sanitizeForPush;
  getPushRule = schema.getPushRule;

  return { fetch };
}

export default createWorker;

// ============================================================================
// DB CONNECTION
// ============================================================================

type PostgresClient = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof drizzle>;

type PostgresJsErrorLike = {
  message?: unknown;
  code?: unknown;
  detail?: unknown;
  hint?: unknown;
  table_name?: unknown;
  column_name?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
};

function isPostgresJsErrorLike(error: unknown): error is PostgresJsErrorLike {
  return typeof error === "object" && error !== null;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getErrorCause(error: unknown): unknown {
  if (!isPostgresJsErrorLike(error)) return undefined;
  return error.cause;
}

function findPostgresErrorLike(
  error: unknown
): PostgresJsErrorLike | undefined {
  // Some libraries wrap the underlying Postgres error under `cause`.
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (isPostgresJsErrorLike(current)) {
      // Heuristic: if it has any of the Postgres-ish fields, treat it as one.
      if (
        typeof current.code !== "undefined" ||
        typeof current.detail !== "undefined" ||
        typeof current.constraint_name !== "undefined" ||
        typeof current.table_name !== "undefined" ||
        typeof current.column_name !== "undefined"
      ) {
        return current;
      }
    }
    const next = getErrorCause(current);
    if (typeof next === "undefined") break;
    current = next;
  }
  return undefined;
}

function formatDbError(error: unknown): string {
  const fallback = error instanceof Error ? error.message : String(error);
  const pgErr = findPostgresErrorLike(error);
  if (!pgErr) return fallback;

  const code = toOptionalString(pgErr.code);
  const detail = toOptionalString(pgErr.detail);
  const hint = toOptionalString(pgErr.hint);
  const table = toOptionalString(pgErr.table_name);
  const column = toOptionalString(pgErr.column_name);
  const constraint = toOptionalString(pgErr.constraint_name);

  // Prefer structured Postgres fields over verbose wrapped messages that may
  // include raw SQL/params.
  const parts = [
    code ? `code=${code}` : undefined,
    table ? `table=${table}` : undefined,
    column ? `column=${column}` : undefined,
    constraint ? `constraint=${constraint}` : undefined,
    detail ? `detail=${detail}` : undefined,
    hint ? `hint=${hint}` : undefined,
  ].filter((p): p is string => typeof p === "string");

  if (parts.length > 0) {
    return parts.join(" | ");
  }

  // Last resort: strip params from known wrapped format.
  if (fallback.includes("\nparams:")) {
    return fallback.split("\nparams:")[0];
  }
  return fallback;
}

function createDb(env: Env): {
  client: PostgresClient;
  db: DrizzleDb;
  close: () => Promise<void>;
} {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    const msg = env.HYPERDRIVE
      ? "HYPERDRIVE binding has no connectionString"
      : "DATABASE_URL not configured";
    throw new Error(`Database configuration error: ${msg}`);
  }

  // IMPORTANT (Cloudflare Workers): Do NOT cache/reuse database clients across requests.
  // Newer Workers runtimes enforce request-scoped I/O; reusing a client can trigger:
  // "Cannot perform I/O on behalf of a different request" (I/O type: Writable).
  const client = postgres(connectionString);
  const db = drizzle(client, { schema: getSchemaTables() });

  const close = async () => {
    try {
      await client.end({ timeout: 5 });
    } catch {
      // ignore
    }
  };

  return { client, db, close };
}

// ============================================================================
// TYPES
// ============================================================================

// Cloudflare Workers Hyperdrive binding type.
// We keep this local/minimal to avoid requiring global workers type packages
// for editor typechecking.
type Hyperdrive = {
  connectionString?: string;
};

type IncomingSyncTableName =
  | SyncableTableName
  | "sync_push_queue"
  | "sync_change_log";
type IncomingSyncChange = SyncChange<IncomingSyncTableName>;

function isClientSyncChange(change: IncomingSyncChange): boolean {
  return (
    change.table !== "sync_push_queue" && change.table !== "sync_change_log"
  );
}

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
  /** When "true", emits extra sync diagnostics logs (initial sync only). */
  SYNC_DIAGNOSTICS?: string;
  /** Optional: only emit diagnostics when JWT sub matches this value. */
  SYNC_DIAGNOSTICS_USER_ID?: string;
}

/** Context passed through sync operations */
interface SyncContext {
  /** Internal TuneTrees user id (user_profile.id). */
  userId: string;
  /** Supabase auth uid (JWT sub). */
  authUserId: string;
  collections: Record<string, Set<string>>;
  pullTables?: Set<string>;
  now: string;
  diagnosticsEnabled: boolean;
}

async function logPlaylistTuneInitialSyncDiagnostics(
  tx: Transaction,
  ctx: SyncContext,
  syncStartedAt: string
): Promise<void> {
  const playlistIds = Array.from(ctx.collections.playlistIds ?? []);
  if (playlistIds.length === 0) return;

  const playlistTune = (getSchemaTables().playlist_tune as any) ?? null;
  if (!playlistTune?.playlistRef || !playlistTune?.lastModifiedAt) return;

  const baseWhere = inArray(playlistTune.playlistRef, playlistIds as any);
  const snapshotWhere = and(
    baseWhere,
    lte(playlistTune.lastModifiedAt, syncStartedAt)
  );

  const [totalAll] = await tx
    .select({ n: count() })
    .from(playlistTune)
    .where(baseWhere);
  const [totalSnapshot] = await tx
    .select({ n: count() })
    .from(playlistTune)
    .where(snapshotWhere);

  const [minMax] = await tx
    .select({
      min: min(playlistTune.lastModifiedAt),
      max: max(playlistTune.lastModifiedAt),
    })
    .from(playlistTune)
    .where(baseWhere);

  console.log("[SYNC_DIAG] playlist_tune initial-sync snapshot", {
    userId: ctx.userId,
    userPlaylistCount: playlistIds.length,
    syncStartedAt,
    totals: {
      all: Number(totalAll?.n ?? 0),
      snapshot: Number(totalSnapshot?.n ?? 0),
    },
    lastModifiedAt: {
      min: minMax?.min ?? null,
      max: minMax?.max ?? null,
    },
  });
}

interface InitialSyncCursorV1 {
  v: 1;
  tableIndex: number;
  offset: number;
  syncStartedAt: string;
}

function encodeCursor(cursor: InitialSyncCursorV1): string {
  return btoa(JSON.stringify(cursor));
}

function decodeCursor(raw: string): InitialSyncCursorV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(raw));
  } catch {
    throw new Error("Invalid pullCursor");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid pullCursor");
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1) throw new Error("Unsupported pullCursor version");
  const tableIndex = Number(obj.tableIndex);
  const offset = Number(obj.offset);
  const syncStartedAt = String(obj.syncStartedAt);

  if (!Number.isFinite(tableIndex) || tableIndex < 0) {
    throw new Error("Invalid pullCursor.tableIndex");
  }
  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error("Invalid pullCursor.offset");
  }
  if (!syncStartedAt || Number.isNaN(Date.parse(syncStartedAt))) {
    throw new Error("Invalid pullCursor.syncStartedAt");
  }

  return { v: 1, tableIndex, offset, syncStartedAt };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleTable = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleColumn = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transaction = PgTransaction<any, any, any>;

// ============================================================================
// UTILITY: Primary Key Helpers
// ============================================================================

/**
 * Get column definitions for a table's conflict target.
 *
 * This is used for UPSERT operations (onConflict target).
 */
function getConflictKeyColumns(
  tableName: string,
  table: DrizzleTable
): { col: DrizzleColumn; prop: string }[] {
  const snakeKeys = getConflictTarget(tableName);
  return snakeKeys.map((snakeKey) => {
    const camelKey = snakeToCamel(snakeKey);
    const col = table[camelKey];
    if (!col) {
      throw new Error(`Column '${camelKey}' not found in '${tableName}'`);
    }
    return { col, prop: camelKey };
  });
}

/**
 * Get column definitions for a table's primary key.
 *
 * This is preferred for DELETE operations because the client may only send PK
 * values (e.g., daily_practice_queue sends only `id`).
 */
function getPrimaryKeyColumns(
  tableName: string,
  table: DrizzleTable
): { col: DrizzleColumn; prop: string }[] {
  const primaryKey = getPrimaryKey(tableName);
  const snakeKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  return snakeKeys.map((snakeKey) => {
    const camelKey = snakeToCamel(snakeKey);
    const col = table[camelKey];
    if (!col) {
      throw new Error(`Column '${camelKey}' not found in '${tableName}'`);
    }
    return { col, prop: camelKey };
  });
}

/**
 * Extract rowId string from a row object.
 */
function extractRowId(
  tableName: string,
  row: Record<string, unknown>,
  table: DrizzleTable
): string {
  // Most tables have 'id' as primary key
  if (row.id != null) {
    return String(row.id);
  }

  // Composite key - serialize to JSON
  const pkCols = getConflictKeyColumns(tableName, table);
  const pkValues: Record<string, unknown> = {};
  for (const pk of pkCols) {
    pkValues[pk.prop] = row[pk.prop];
  }
  return JSON.stringify(pkValues);
}

// ============================================================================
// UTILITY: Boolean Conversion (SQLite ↔ Postgres)
// ============================================================================

/**
 * Convert SQLite integers (0/1) to Postgres booleans.
 */
function sqliteToPostgres(
  tableName: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const boolCols = getBooleanColumns(tableName);
  if (boolCols.length === 0) return data;

  const result = { ...data };
  for (const snakeCol of boolCols) {
    const camelCol = snakeToCamel(snakeCol);
    if (camelCol in result && typeof result[camelCol] === "number") {
      result[camelCol] = result[camelCol] !== 0;
    }
  }
  return result;
}

function remapUserRefsForPush(
  data: Record<string, unknown>,
  ctx: SyncContext
): Record<string, unknown> {
  const result = { ...data };
  const replaceIfAuth = (prop: string) => {
    if (!(prop in result)) return;
    const value = result[prop];
    if (value === null || typeof value === "undefined") return;
    if (String(value) === ctx.authUserId) {
      result[prop] = ctx.userId;
    }
  };

  replaceIfAuth("userRef");
  replaceIfAuth("userId");
  replaceIfAuth("privateFor");
  replaceIfAuth("privateToUser");

  return result;
}

function remapUserProfileForPush(
  tableName: string,
  data: Record<string, unknown>,
  ctx: SyncContext
): Record<string, unknown> {
  if (tableName !== "user_profile") return data;

  const result = { ...data };
  if (ctx.userId) {
    result.id = ctx.userId;
  }
  if (ctx.authUserId) {
    result.supabaseUserId = ctx.authUserId;
  }
  return result;
}

/**
 * Convert Postgres booleans to SQLite integers (0/1).
 */
function postgresToSqlite(
  tableName: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const boolCols = getBooleanColumns(tableName);
  if (boolCols.length === 0) return data;

  const result = { ...data };
  for (const snakeCol of boolCols) {
    const camelCol = snakeToCamel(snakeCol);
    if (camelCol in result && typeof result[camelCol] === "boolean") {
      result[camelCol] = result[camelCol] ? 1 : 0;
    }
  }
  return result;
}

// ============================================================================
// UTILITY: Authentication
// ============================================================================

async function verifyJwt(
  request: Request,
  secret: string
): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[AUTH] No Bearer token in Authorization header");
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    console.log("[AUTH] JWT verified successfully, user:", payload.sub);
    return payload.sub ?? null;
  } catch (e) {
    console.error("[AUTH] JWT verification failed:", e);
    return null;
  }
}

// ============================================================================
// PUSH: Apply Client Changes to Postgres
// ============================================================================

/**
 * Apply a single change (insert/update/delete) to Postgres.
 */
async function applyChange(
  tx: Transaction,
  change: IncomingSyncChange,
  ctx: SyncContext
): Promise<void> {
  // Skip sync infrastructure tables
  if (!isClientSyncChange(change)) {
    console.log(`[PUSH] Skipping sync infrastructure table: ${change.table}`);
    return;
  }

  const pushRule = getPushRule(change.table);
  if (pushRule?.denyDelete && change.deleted) {
    console.warn(
      `[PUSH] Refusing DELETE for ${change.table} rowId=${change.rowId}`
    );
    return;
  }

  const table = getSchemaTables()[change.table];
  if (!table) {
    console.log(`[PUSH] Unknown table: ${change.table}`);
    return;
  }

  const t = table as DrizzleTable;
  if (!t.lastModifiedAt) {
    console.log(
      `[PUSH] Table ${change.table} has no lastModifiedAt column, skipping`
    );
    return;
  }

  const upsertKeyCols = getConflictKeyColumns(change.table, t);
  const deleteKeyCols = getPrimaryKeyColumns(change.table, t);
  let data = sqliteToPostgres(
    change.table,
    change.data as Record<string, unknown>
  );
  data = remapUserRefsForPush(data, ctx);
  data = remapUserProfileForPush(change.table, data, ctx);

  const sanitized = sanitizeForPush({
    tableName: change.table,
    changeLastModifiedAt: change.lastModifiedAt,
    data,
  });
  data = sanitized.data;
  if (sanitized.changed.length > 0) {
    console.warn(
      `[PUSH] Sanitized ${change.table} rowId=${change.rowId}: ${sanitized.changed.join(", ")}`
    );
  }

  console.log(
    `[PUSH] Applying ${change.deleted ? "DELETE" : "UPSERT"} to ${change.table}, rowId: ${change.rowId}`
  );

  if (change.deleted) {
    await applyDelete(
      tx,
      change.table,
      table,
      deleteKeyCols,
      upsertKeyCols,
      change
    );
  } else {
    const omitSetProps = pushRule?.upsert?.omitSetProps;
    const keepProps = pushRule?.upsert?.retryMinimalPayloadKeepProps;
    const resolvedOmitSetProps =
      change.table === "user_profile"
        ? Array.from(new Set([...(omitSetProps ?? []), "id"]))
        : omitSetProps;
    const upsertOpts = resolvedOmitSetProps
      ? ({ omitSetProps: resolvedOmitSetProps } as const)
      : undefined;

    try {
      // Use a savepoint so a failed statement doesn't abort the outer transaction.
      await tx.transaction(async (sp) => {
        await applyUpsert(sp, table, upsertKeyCols, data, upsertOpts);
      });
    } catch (e) {
      if (!keepProps || keepProps.length === 0) throw e;

      console.warn(
        `[PUSH] ${change.table} upsert retry (minimal payload) rowId=${change.rowId}: ${formatDbError(
          e
        )}`
      );
      const minimal = minimalPayload(data, keepProps);
      await tx.transaction(async (sp) => {
        await applyUpsert(sp, table, upsertKeyCols, minimal, upsertOpts);
      });
    }
  }
}

async function applyDelete(
  tx: Transaction,
  tableName: string,
  table: DrizzleTable,
  primaryKeyCols: { col: unknown; prop: string }[],
  conflictKeyCols: { col: unknown; prop: string }[],
  change: SyncChange
): Promise<void> {
  const changeData = change.data as Record<string, unknown>;

  const buildWhere = (cols: { col: unknown; prop: string }[]) => {
    const missing: string[] = [];
    const whereConditions = cols.map((pk) => {
      const value = changeData[pk.prop];
      if (typeof value === "undefined" || value === null) {
        missing.push(pk.prop);
      }
      return eq(pk.col as any, value as any);
    });
    return { whereConditions, missing };
  };

  // Prefer primary key columns for deletes; fall back to conflict key columns.
  let { whereConditions, missing } = buildWhere(primaryKeyCols);
  if (missing.length > 0) {
    const fallback = buildWhere(conflictKeyCols);
    if (fallback.missing.length === 0) {
      whereConditions = fallback.whereConditions;
      missing = [];
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing delete key(s) for ${tableName}: ${missing.join(", ")} (rowId=${change.rowId})`
    );
  }

  if (hasDeletedFlag(tableName)) {
    // Soft delete: set deleted = true
    await tx
      .update(table)
      .set({
        [CORE_COL_DELETED]: true,
        [CORE_COL_LAST_MODIFIED_AT]: change.lastModifiedAt,
      })
      .where(and(...whereConditions));
  } else {
    // Hard delete
    await tx.delete(table).where(and(...whereConditions));
  }
}

async function applyUpsert(
  tx: Transaction,
  table: DrizzleTable,
  pkCols: { col: unknown; prop: string }[],
  data: Record<string, unknown>,
  opts?: {
    /**
     * Properties to omit from the UPDATE set (still inserted on first write).
     * This is critical when upserting on a non-PK unique key.
     */
    omitSetProps?: readonly string[];
  }
): Promise<void> {
  const targetCols = pkCols.map((pk) => pk.col);

  let setData: Record<string, unknown> = data;
  const omit = opts?.omitSetProps ?? [];
  if (omit.length > 0) {
    setData = { ...data };
    for (const prop of omit) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete setData[prop];
    }
  }

  await tx
    .insert(table)
    .values(data)
    .onConflictDoUpdate({
      target: targetCols as any,
      set: setData,
    });
}

/**
 * Process all PUSH changes from the client.
 */
async function processPushChanges(
  tx: Transaction,
  ctx: SyncContext,
  changes: IncomingSyncChange[]
): Promise<void> {
  console.log(`[PUSH] Processing ${changes.length} changes from client`);
  for (const change of changes) {
    try {
      await applyChange(tx, change, ctx);
    } catch (e) {
      throw new Error(
        `[PUSH] Failed applying ${change.table} rowId=${change.rowId}: ${formatDbError(e)}`
      );
    }
  }
  console.log(`[PUSH] Completed processing ${changes.length} changes`);
}

// ============================================================================
// PULL: Gather Changes for Client
// ============================================================================

/**
 * Convert a Postgres row to a SyncChange for the client.
 */
function rowToSyncChange(
  tableName: string,
  rowId: string,
  row: Record<string, unknown>
): SyncChange {
  // Normalize timestamps generically (schema-driven).
  let data = normalizeRowForSync(tableName, row);

  // Convert booleans for SQLite
  data = postgresToSqlite(tableName, data);

  return {
    table: tableName as SyncableTableName,
    rowId,
    data,
    deleted: !!data.deleted,
    lastModifiedAt:
      (data.lastModifiedAt as string) || new Date(0).toISOString(),
  };
}

// ============================================================================
// PULL: Initial Sync (Full Table Scan)
// ============================================================================

async function fetchTableForInitialSyncPage(
  tx: Transaction,
  tableName: SyncableTableName,
  ctx: SyncContext,
  syncStartedAt: string,
  offset: number,
  limit: number
): Promise<SyncChange[]> {
  const table = getSchemaTables()[tableName];
  if (!table) return [];

  const t = table as DrizzleTable;
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) return [];

  const conditions = buildUserFilter({
    tableName,
    table: t,
    userId: tableName === "user_profile" ? ctx.authUserId : ctx.userId,
    collections: ctx.collections,
  });
  if (conditions === null) {
    console.log(`[PULL:INITIAL] Skipping ${tableName} (no playlists for user)`);
    return [];
  }

  const whereConditions: unknown[] = [...conditions];

  // Make a best-effort snapshot for multi-page initial sync.
  // If the table has lastModifiedAt, only include rows up to syncStartedAt.
  if (t.lastModifiedAt) {
    whereConditions.push(lte(t.lastModifiedAt, syncStartedAt));
  }

  if (ctx.diagnosticsEnabled && tableName === "playlist_tune" && offset === 0) {
    await logPlaylistTuneInitialSyncDiagnostics(tx, ctx, syncStartedAt);
  }

  let query = tx.select().from(table);
  if (whereConditions.length > 0) {
    // @ts-expect-error - dynamic where
    query = query.where(and(...whereConditions));
  }

  const rows = await query.limit(limit).offset(offset);

  console.log(
    `[PULL:INITIAL] ${tableName}: fetched page rows=${rows.length} offset=${offset} limit=${limit}`
  );

  const changes: SyncChange[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const rowId = extractRowId(tableName, r, t);
    changes.push(rowToSyncChange(tableName, rowId, r));
  }
  return changes;
}

async function processInitialSyncPaged(
  tx: Transaction,
  ctx: SyncContext,
  cursorRaw: string | undefined,
  syncStartedAtHint: string | undefined,
  pageSizeHint: number | undefined
): Promise<{
  changes: SyncChange[];
  nextCursor?: string;
  syncStartedAt: string;
}> {
  const MAX_PAGE_SIZE = 500;
  const DEFAULT_PAGE_SIZE = 200;
  const requested =
    typeof pageSizeHint === "number" && Number.isFinite(pageSizeHint)
      ? Math.max(1, Math.floor(pageSizeHint))
      : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requested, MAX_PAGE_SIZE);

  let tableIndex = 0;
  let offset = 0;
  let syncStartedAt = syncStartedAtHint;

  if (cursorRaw) {
    const cursor = decodeCursor(cursorRaw);
    tableIndex = cursor.tableIndex;
    offset = cursor.offset;
    syncStartedAt = cursor.syncStartedAt;
  }

  if (!syncStartedAt) {
    syncStartedAt = ctx.now;
  }

  // Advance until we find a table with rows to return, or we finish.
  while (tableIndex < SYNCABLE_TABLES.length) {
    const tableName = SYNCABLE_TABLES[tableIndex] as SyncableTableName;
    if (ctx.pullTables && !ctx.pullTables.has(tableName)) {
      tableIndex += 1;
      offset = 0;
      continue;
    }
    const changes = await fetchTableForInitialSyncPage(
      tx,
      tableName,
      ctx,
      syncStartedAt,
      offset,
      pageSize
    );

    if (changes.length === 0) {
      // Either table is empty / skipped OR we've paged past the end.
      // Move to next table.
      tableIndex += 1;
      offset = 0;
      continue;
    }

    const nextOffset = offset + changes.length;
    const isLastPageForTable = changes.length < pageSize;

    if (isLastPageForTable) {
      const nextTableIndex = tableIndex + 1;
      if (nextTableIndex >= SYNCABLE_TABLES.length) {
        return { changes, syncStartedAt };
      }
      return {
        changes,
        syncStartedAt,
        nextCursor: encodeCursor({
          v: 1,
          tableIndex: nextTableIndex,
          offset: 0,
          syncStartedAt,
        }),
      };
    }

    return {
      changes,
      syncStartedAt,
      nextCursor: encodeCursor({
        v: 1,
        tableIndex,
        offset: nextOffset,
        syncStartedAt,
      }),
    };
  }

  return { changes: [], syncStartedAt };
}

// ============================================================================
// PULL: Incremental Sync (Table-Level Change Log)
// ============================================================================

/**
 * Get list of tables that have changed since lastSyncAt.
 * sync_change_log now has ONE ROW PER TABLE (table_name is the primary key).
 */
async function getChangedTables(
  tx: Transaction,
  lastSyncAt: string
): Promise<string[]> {
  const syncChangeLog = getSchemaTables().sync_change_log as any;
  const entries = await tx
    .select({
      tableName: syncChangeLog.tableName,
    })
    .from(syncChangeLog)
    .where(gt(syncChangeLog.changedAt, lastSyncAt));

  const tables = entries.map((e) => e.tableName);
  console.log(
    `[PULL:INCR] Tables changed since ${lastSyncAt}: [${tables.join(", ")}]`
  );
  return tables;
}

/**
 * Fetch all rows from a table that have changed since lastSyncAt.
 * Uses the table's last_modified_at column.
 */
async function fetchChangedRowsFromTable(
  tx: Transaction,
  tableName: SyncableTableName,
  lastSyncAt: string,
  ctx: SyncContext
): Promise<SyncChange[]> {
  const table = getSchemaTables()[tableName];
  if (!table) return [];

  const t = table as DrizzleTable;
  if (!t.lastModifiedAt) {
    console.log(`[PULL:INCR] ${tableName} has no lastModifiedAt, skipping`);
    return []; // Table doesn't support incremental sync
  }

  // Build conditions: last_modified_at > lastSyncAt AND user_filter
  const userConditions = buildUserFilter({
    tableName,
    table: t,
    userId: tableName === "user_profile" ? ctx.authUserId : ctx.userId,
    collections: ctx.collections,
  });
  if (userConditions === null) {
    console.log(`[PULL:INCR] Skipping ${tableName} (no playlists for user)`);
    return []; // Skip table (e.g., no playlists)
  }

  const timeCondition = gt(t.lastModifiedAt, lastSyncAt);
  const allConditions =
    userConditions.length > 0
      ? // @ts-expect-error - dynamic where conditions with unknown types
        and(timeCondition, ...(userConditions as unknown[]))
      : timeCondition;

  const rows = await tx.select().from(table).where(allConditions);
  console.log(
    `[PULL:INCR] ${tableName}: fetched ${rows.length} changed rows since ${lastSyncAt}`
  );

  // Convert rows to SyncChanges
  const changes: SyncChange[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const rowId = extractRowId(tableName, r, t);
    changes.push(rowToSyncChange(tableName, rowId, r));
  }

  return changes;
}

/**
 * Incremental sync: fetch only rows that changed since lastSyncAt.
 * 1. Query sync_change_log for tables with changed_at > lastSyncAt
 * 2. For each changed table, query rows with last_modified_at > lastSyncAt
 */
async function processIncrementalSync(
  tx: Transaction,
  lastSyncAt: string,
  ctx: SyncContext
): Promise<SyncChange[]> {
  console.log(
    `[PULL:INCR] Starting incremental sync for user ${ctx.userId} since ${lastSyncAt}`
  );
  const changedTables = await getChangedTables(tx, lastSyncAt);

  if (changedTables.length === 0) {
    console.log(`[PULL:INCR] No tables changed since ${lastSyncAt}`);
    return [];
  }

  const allChanges: SyncChange[] = [];
  for (const tableName of changedTables) {
    // Only process tables we know about
    if (!SYNCABLE_TABLES.includes(tableName as SyncableTableName)) {
      console.log(`[PULL:INCR] Skipping unknown table: ${tableName}`);
      continue;
    }
    if (ctx.pullTables && !ctx.pullTables.has(tableName)) {
      continue;
    }
    const tableChanges = await fetchChangedRowsFromTable(
      tx,
      tableName as SyncableTableName,
      lastSyncAt,
      ctx
    );
    allChanges.push(...tableChanges);
  }

  console.log(
    `[PULL:INCR] Completed incremental sync: ${allChanges.length} total changes`
  );
  return allChanges;
}

// ============================================================================
// MAIN SYNC HANDLER
// ============================================================================

async function handleSync(
  db: ReturnType<typeof drizzle>,
  payload: SyncRequest,
  userId: string,
  diagnosticsEnabled: boolean
): Promise<SyncResponse> {
  const now = new Date().toISOString();
  const diag: string[] = [];
  let responseChanges: SyncChange[] = [];
  let nextCursor: string | undefined;
  let syncStartedAt: string | undefined;
  const syncType = payload.lastSyncAt ? "INCREMENTAL" : "INITIAL";

  if (diagnosticsEnabled) {
    const cursorSummary = payload.pullCursor
      ? (() => {
          try {
            const c = decodeCursor(payload.pullCursor);
            return `tableIndex=${c.tableIndex} offset=${c.offset}`;
          } catch {
            return "cursor=invalid";
          }
        })()
      : "cursor=none";
    diag.push(
      `[WorkerSyncDiag] type=${syncType} changesIn=${payload.changes.length} lastSyncAt=${payload.lastSyncAt ?? "null"} pageSize=${payload.pageSize ?? "null"} ${cursorSummary}`
    );
  }

  console.log(`[SYNC] === Starting ${syncType} sync for user ${userId} ===`);
  console.log(
    `[SYNC] Request: lastSyncAt=${payload.lastSyncAt ?? "null"}, changes=${payload.changes.length}`
  );

  await db.transaction(async (tx) => {
    const authUserId = userId;

    // Map Supabase auth uid -> internal user_profile.id.
    // Most user-owned tables reference user_profile.id (e.g. user_ref/user_id), not auth uid.
    let internalUserId = authUserId;
    try {
      const userProfile = getSchemaTables().user_profile as any;
      if (userProfile?.id && userProfile?.supabaseUserId) {
        let rows = await tx
          .select({ id: userProfile.id })
          .from(userProfile)
          .where(eq(userProfile.supabaseUserId, authUserId))
          .limit(1);

        if (rows.length === 0) {
          try {
            await tx.insert(userProfile).values({ supabaseUserId: authUserId });
          } catch (insertError) {
            console.warn(
              `[SYNC] Failed to ensure user_profile row for auth uid ${authUserId}`,
              insertError
            );
          }

          rows = await tx
            .select({ id: userProfile.id })
            .from(userProfile)
            .where(eq(userProfile.supabaseUserId, authUserId))
            .limit(1);
        }

        if (rows.length > 0 && rows[0]?.id) {
          internalUserId = String(rows[0].id);
        } else {
          console.warn(
            `[SYNC] No user_profile row found for auth uid ${authUserId}; using auth uid for scoping (may yield empty user-owned pulls).`
          );
        }
      }
    } catch (err) {
      console.warn(
        `[SYNC] Failed to resolve internal user id for auth uid ${authUserId}; using auth uid for scoping`,
        err
      );
    }

    const collections = await loadUserCollections({
      tx,
      userId: internalUserId,
      tables: getSchemaTables(),
    });

    if (
      payload.collectionsOverride &&
      "selectedGenres" in payload.collectionsOverride
    ) {
      const selected = payload.collectionsOverride.selectedGenres ?? [];
      collections.selectedGenres = new Set(selected.map((g) => String(g)));
    }

    const pullTables = payload.pullTables
      ? new Set(payload.pullTables.map((t) => String(t)))
      : undefined;

    const ctx: SyncContext = {
      userId: internalUserId,
      authUserId,
      collections,
      pullTables,
      now,
      diagnosticsEnabled,
    };

    // PUSH: Apply client changes
    await processPushChanges(tx, ctx, payload.changes as IncomingSyncChange[]);

    // PULL: Gather changes for client
    if (payload.lastSyncAt) {
      responseChanges = await processIncrementalSync(
        tx,
        payload.lastSyncAt,
        ctx
      );
    } else {
      // Paginate initial sync to avoid oversized payloads / timeouts.
      const page = await processInitialSyncPaged(
        tx,
        ctx,
        payload.pullCursor,
        payload.syncStartedAt,
        payload.pageSize
      );
      responseChanges = page.changes;
      nextCursor = page.nextCursor;
      syncStartedAt = page.syncStartedAt;
    }

    if (diagnosticsEnabled) {
      const tableCounts: Record<string, number> = {};
      for (const change of responseChanges) {
        tableCounts[change.table] = (tableCounts[change.table] ?? 0) + 1;
      }
      const top = Object.entries(tableCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([t, n]) => `${t}:${n}`)
        .join(",");
      diag.push(
        `[WorkerSyncDiag] changesOut=${responseChanges.length} nextCursor=${nextCursor ? "yes" : "no"} syncStartedAt=${syncStartedAt ?? "null"} topTables=${top || "(none)"}`
      );
    }

    // NO GARBAGE COLLECTION NEEDED!
    // sync_change_log now has at most ~20 rows (one per table)
  });

  console.log(
    `[SYNC] === Completed ${syncType} sync: returning ${responseChanges.length} changes, syncedAt=${now} ===`
  );

  return {
    changes: responseChanges,
    syncedAt: now,
    nextCursor,
    syncStartedAt,
    debug: diagnosticsEnabled ? diag : undefined,
  };
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

/**
 * Get appropriate CORS headers for the request origin.
 * Allows all origins for backward compatibility and ease of deployment.
 */
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  message: string,
  status = 500,
  corsHeaders: Record<string, string>
): Response {
  return jsonResponse({ error: message }, status, corsHeaders);
}

async function fetch(request: Request, env: Env): Promise<Response> {
  // Get CORS headers for this request (needed for all responses)
  const corsHeaders = getCorsHeaders(request);

  try {
    const url = new URL(request.url);

    // CORS preflight - handle immediately
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Sync endpoint
    if (request.method === "POST" && url.pathname === "/api/sync") {
      console.log(`[HTTP] POST /api/sync received`);

      // Validate environment configuration
      if (!env.SUPABASE_JWT_SECRET) {
        console.error("[HTTP] SUPABASE_JWT_SECRET not configured");
        return errorResponse("Server configuration error", 500, corsHeaders);
      }

      // Authenticate
      const userId = await verifyJwt(request, env.SUPABASE_JWT_SECRET);
      if (!userId) {
        console.log(`[HTTP] Unauthorized - JWT verification failed`);
        return errorResponse("Unauthorized", 401, corsHeaders);
      }

      const diagnosticsEnabled =
        env.SYNC_DIAGNOSTICS === "true" &&
        (!env.SYNC_DIAGNOSTICS_USER_ID ||
          env.SYNC_DIAGNOSTICS_USER_ID === userId);

      // Connect to database
      try {
        const { db, close } = createDb(env);
        const payload = (await request.json()) as SyncRequest;

        try {
          console.log(`[HTTP] Sync request parsed, calling handleSync`);
          const response = await handleSync(
            db,
            payload,
            userId,
            diagnosticsEnabled
          );
          console.log(`[HTTP] Sync completed successfully`);
          return jsonResponse(response, 200, corsHeaders);
        } finally {
          await close();
        }
      } catch (error) {
        console.error("[HTTP] Sync error:", error);
        return errorResponse(formatDbError(error), 500, corsHeaders);
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error("[HTTP] Unhandled error:", error);
    return errorResponse("Internal Server Error", 500, corsHeaders);
  }
}
