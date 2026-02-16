/**
 * Cloudflare Worker Sync Endpoint
 *
 * Architecture:
 * - PUSH: Client sends changes → Worker applies to Postgres
 * - PULL: Worker queries sync_change_log → returns changed rows to client
 *
 * @module worker/index
 */
import { and, eq, gt, lte } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import postgres from "postgres";
import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "../../src/shared/protocol";
import { debug, setDebugEnabled } from "./debug";
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
let getPullRule: (
  tableName: string
) => import("./sync-schema").PullTableRule | undefined = () =>
  notInitialized("getPullRule");

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
    schemaTables: artifacts.schemaTables,
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
  getPullRule = schema.getPullRule;

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

function perfLog(enabled: boolean, message: string): void {
  if (enabled) {
    console.log(`[PERF] ${message}`);
  }
}

function perfLogDuration(
  enabled: boolean,
  minDurationMs: number,
  durationMs: number,
  message: string
): void {
  if (!enabled || durationMs < minDurationMs) {
    return;
  }
  console.log(`[PERF] ${message} durationMs=${durationMs}`);
}

function parsePerfMinDurationMs(value: string | undefined): number {
  if (!value) {
    return 100;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 100;
  }
  return Math.floor(parsed);
}

function resolveConnectionString(env: Env): string {
  const bypassHyperdrive = env.BYPASS_HYPERDRIVE === "true";
  if (bypassHyperdrive) {
    if (!env.DATABASE_URL) {
      throw new Error(
        "Database configuration error: BYPASS_HYPERDRIVE=true requires DATABASE_URL"
      );
    }
    return env.DATABASE_URL;
  }

  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    const msg = env.HYPERDRIVE
      ? "HYPERDRIVE binding has no connectionString"
      : "DATABASE_URL not configured";
    throw new Error(`Database configuration error: ${msg}`);
  }

  return connectionString;
}

function createDb(env: Env): {
  client: PostgresClient;
  db: DrizzleDb;
  close: () => Promise<void>;
} {
  const connectionString = resolveConnectionString(env);

  // IMPORTANT (Cloudflare Workers): Do NOT cache/reuse database clients across requests.
  // Newer Workers runtimes enforce request-scoped I/O; reusing a client can trigger:
  // "Cannot perform I/O on behalf of a different request" (I/O type: Writable).
  // - max: 1 is appropriate here because this handler uses one request-scoped client and
  //   mostly sequential DB work inside one transaction.
  // - prepare: false is safer with pooled/proxied connections (Hyperdrive layer), and
  //   usually avoids prepared-statement churn on short-lived clients.
  const client = postgres(connectionString, { max: 1, prepare: false });
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
  /** When "true", ignores HYPERDRIVE and connects via DATABASE_URL directly. */
  BYPASS_HYPERDRIVE?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
  /** When "true", enables debug logging (console.log statements). */
  WORKER_DEBUG?: string;
  /** When "true", emits perf timing logs for sync phases. */
  WORKER_DEBUG_PERF?: string;
  /** Optional minimum duration threshold (ms) for WORKER_DEBUG_PERF logs. */
  WORKER_DEBUG_PERF_MIN_MS?: string;
  /** When "true", emits extra sync diagnostics logs (initial sync only). */
  SYNC_DIAGNOSTICS?: string;
  /** Optional: only emit diagnostics when JWT sub matches this value. */
  SYNC_DIAGNOSTICS_USER_ID?: string;
}

/** Context passed through sync operations */
interface SyncContext {
  /** Supabase auth uid (user_profile.id, the PK). */
  userId: string;
  /** Supabase auth uid (JWT sub); same as userId after eliminating user_profile.id. */
  authUserId: string;
  collections: Record<string, Set<string>>;
  pullTables?: Set<string>;
  /** Genre filter from client (effective genre list). */
  genreFilter?: { selectedGenreIds: string[]; repertoireGenreIds: string[] };
  now: string;
  diagnosticsEnabled: boolean;
  perfDebugEnabled: boolean;
  perfMinDurationMs: number;
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
// UTILITY: RPC Fetch
// ============================================================================

/**
 * Fetch table data via Postgres RPC function.
 * Used for tables with complex filtering requirements (e.g., JOINs).
 */
async function fetchViaRPC(
  tx: Transaction,
  functionName: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  try {
    // Build: SELECT * FROM function_name($1::UUID, $2::TEXT[], ...)
    const paramKeys = Object.keys(params);
    const paramValues = Object.values(params).map((v) => {
      // postgres-js unsafe() requires all params to be strings or Buffer/ArrayBuffer
      if (typeof v === "number") return String(v);
      return v;
    });

    // Build SQL query string with placeholders and type casts
    // Determine types based on parameter names
    const placeholders: string[] = [];
    for (let i = 0; i < paramValues.length; i++) {
      const paramNum = i + 1;
      const paramName = paramKeys[i];

      if (paramName === "p_user_id") {
        placeholders.push(`$${paramNum}::UUID`);
      } else if (paramName === "p_genre_ids") {
        placeholders.push(`$${paramNum}::TEXT[]`);
      } else if (paramName === "p_after_timestamp") {
        placeholders.push(`$${paramNum}::TIMESTAMPTZ`);
      } else if (paramName === "p_limit" || paramName === "p_offset") {
        placeholders.push(`$${paramNum}::INTEGER`);
      } else {
        // Default: no cast
        placeholders.push(`$${paramNum}`);
      }
    }

    const queryString = `SELECT * FROM ${functionName}(${placeholders.join(", ")})`;

    // Execute using the underlying session (bypassing Drizzle's sql template to avoid array wrapping)
    // Access the postgres-js client through the transaction's internal session
    const session = (tx as any).session;
    if (!session?.client) {
      throw new Error(
        "Cannot access underlying postgres client from transaction"
      );
    }

    // Execute raw query with parameter binding
    const result = await session.client.unsafe(queryString, paramValues);

    return result as Record<string, unknown>[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`RPC ${functionName} failed: ${message}`);
  }
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
  _ctx: SyncContext
): Record<string, unknown> {
  // userId === authUserId (both are Supabase auth UUID).
  // No remapping needed - user FKs reference user_profile.id directly.
  return data;
}

function remapUserProfileForPush(
  tableName: string,
  data: Record<string, unknown>,
  ctx: SyncContext
): Record<string, unknown> {
  if (tableName !== "user_profile") return data;

  const result = { ...data };
  // user_profile.id is the canonical PK and should match authenticated user id.
  if (ctx.authUserId) {
    result.id = ctx.authUserId;
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

// Cached JWKS key set — lazily initialized per Supabase URL
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl: string | null = null;

function getJwks(supabaseUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    cachedJwksUrl = jwksUrl;
  }
  return cachedJwks;
}

async function verifyJwt(
  request: Request,
  secret: string,
  supabaseUrl: string
): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    debug.log("[AUTH] No Bearer token in Authorization header");
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    // Peek at the JWT header to choose verification strategy
    const [headerB64] = token.split(".");
    const headerJson = JSON.parse(
      atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"))
    );
    const algorithm = headerJson.alg;

    let payload: { sub?: string };

    if (algorithm === "ES256") {
      // ES256 (Supabase CLI >= 2.75): fetch public key from JWKS endpoint
      debug.log("[AUTH] Using ES256 verification via JWKS");
      const result = await jwtVerify(token, getJwks(supabaseUrl));
      payload = result.payload;
    } else {
      // HS256 (Supabase CLI < 2.75): symmetric secret
      debug.log("[AUTH] Using HS256 verification");
      const result = await jwtVerify(token, new TextEncoder().encode(secret));
      payload = result.payload;
    }

    debug.log("[AUTH] JWT verified successfully, user:", payload.sub);
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
    debug.log(`[PUSH] Skipping sync infrastructure table: ${change.table}`);
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
    debug.log(`[PUSH] Unknown table: ${change.table}`);
    return;
  }

  const t = table as DrizzleTable;
  if (!t.lastModifiedAt) {
    debug.log(
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

  // Normalize timestamps for Postgres (add 'Z' suffix if missing, etc.)
  data = normalizeRowForSync(change.table, data);

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

  debug.log(
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
  debug.log(`[PUSH] Processing ${changes.length} changes from client`);
  for (const change of changes) {
    try {
      await applyChange(tx, change, ctx);
    } catch (e) {
      throw new Error(
        `[PUSH] Failed applying ${change.table} rowId=${change.rowId}: ${formatDbError(e)}`
      );
    }
  }
  debug.log(`[PUSH] Completed processing ${changes.length} changes`);
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

  // Check if table uses RPC for filtering
  const rule = getPullRule(tableName);
  if (rule?.kind === "rpc") {
    // Use RPC to fetch data (handles all filtering server-side)
    const rpcParams: Record<string, unknown> = {
      p_user_id: ctx.authUserId,
    };

    // Map params: "userId" already in p_user_id, add others as needed
    if (rule.params.includes("genreIds")) {
      const genreSet = ctx.collections.selectedGenres;
      rpcParams.p_genre_ids = genreSet ? Array.from(genreSet) : [];
    }

    // For initial sync, timestamp is NULL (fetch all rows)
    rpcParams.p_after_timestamp = null;

    // Pass pagination params to RPC
    rpcParams.p_limit = limit;
    rpcParams.p_offset = offset;

    const rows = await fetchViaRPC(tx, rule.functionName, rpcParams);

    debug.log(
      `[PULL:INITIAL] ${tableName} (RPC): fetched ${rows.length} rows via ${rule.functionName}`
    );

    const changes: SyncChange[] = [];
    for (const row of rows) {
      // Apply adapter transformation: Postgres (snake_case) -> Client (camelCase)
      const transformed = normalizeRowForSync(tableName, row);
      const rowId = extractRowId(tableName, transformed, t);
      changes.push(rowToSyncChange(tableName, rowId, transformed));
    }
    return changes;
  }

  // Standard SQL-based fetch (non-RPC tables)
  const conditions = buildUserFilter({
    tableName,
    table: t,
    userId: ctx.userId, // userId === authUserId after eliminating user_profile.id
    collections: ctx.collections,
  });
  if (conditions === null) {
    debug.log(`[PULL:INITIAL] Skipping ${tableName} (no repertoires for user)`);
    return [];
  }

  const whereConditions: unknown[] = [...conditions];

  // Make a best-effort snapshot for multi-page initial sync.
  // If the table has lastModifiedAt, only include rows up to syncStartedAt.
  if (t.lastModifiedAt) {
    whereConditions.push(lte(t.lastModifiedAt, syncStartedAt));
  }

  let query = tx.select().from(table);
  if (whereConditions.length > 0) {
    // @ts-expect-error - dynamic where
    query = query.where(and(...whereConditions));
  }

  const rows = await query.limit(limit).offset(offset);

  debug.log(
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
    const pageStartedAt = Date.now();
    const changes = await fetchTableForInitialSyncPage(
      tx,
      tableName,
      ctx,
      syncStartedAt,
      offset,
      pageSize
    );
    perfLogDuration(
      ctx.perfDebugEnabled,
      ctx.perfMinDurationMs,
      Date.now() - pageStartedAt,
      `initial.page table=${tableName} offset=${offset} limit=${pageSize} rows=${changes.length}`
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
  debug.log(
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
    debug.log(`[PULL:INCR] ${tableName} has no lastModifiedAt, skipping`);
    return []; // Table doesn't support incremental sync
  }

  // Check if table uses RPC for filtering
  const rule = getPullRule(tableName);
  if (rule?.kind === "rpc") {
    // Use RPC to fetch changed rows (handles all filtering server-side)
    const rpcParams: Record<string, unknown> = {
      p_user_id: ctx.authUserId,
    };

    // Map params - IMPORTANT: maintain order matching function signature
    if (rule.params.includes("genreIds")) {
      // Use effective genre filter from payload if available, otherwise fall back to ctx.collections
      const effectiveGenres =
        ctx.genreFilter?.selectedGenreIds ??
        (ctx.collections.selectedGenres
          ? Array.from(ctx.collections.selectedGenres)
          : []);
      rpcParams.p_genre_ids = effectiveGenres;
      debug.log(
        `[RPC] ${rule.functionName}: ${effectiveGenres.length} genres from ${ctx.genreFilter ? "payload" : "collections"}`
      );
    }

    // Add timestamp param AFTER genreIds to match function signature
    rpcParams.p_after_timestamp = lastSyncAt; // RPC will filter by last_modified_at > lastSyncAt

    // For incremental sync, use default limit (1000) - should be small
    rpcParams.p_limit = 1000;
    rpcParams.p_offset = 0;

    const rows = await fetchViaRPC(tx, rule.functionName, rpcParams);

    debug.log(
      `[PULL:INCR] ${tableName} (RPC): fetched ${rows.length} changed rows via ${rule.functionName} since ${lastSyncAt}`
    );

    const changes: SyncChange[] = [];
    for (const row of rows) {
      // Apply adapter transformation: Postgres (snake_case) -> Client (camelCase)
      const transformed = normalizeRowForSync(tableName, row);
      const rowId = extractRowId(tableName, transformed, t);
      changes.push(rowToSyncChange(tableName, rowId, transformed));
    }
    return changes;
  }

  // Standard SQL-based incremental sync (non-RPC tables)
  // Build conditions: last_modified_at > lastSyncAt AND user_filter
  const userConditions = buildUserFilter({
    tableName,
    table: t,
    userId: ctx.userId, // userId === authUserId after eliminating user_profile.id
    collections: ctx.collections,
  });
  if (userConditions === null) {
    debug.log(`[PULL:INCR] Skipping ${tableName} (no repertoires for user)`);
    return []; // Skip table (e.g., no repertoires)
  }

  const timeCondition = gt(t.lastModifiedAt, lastSyncAt);
  const allConditions =
    userConditions.length > 0
      ? // @ts-expect-error - dynamic where conditions with unknown types
        and(timeCondition, ...(userConditions as unknown[]))
      : timeCondition;

  const rows = await tx.select().from(table).where(allConditions);
  debug.log(
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
  debug.log(
    `[PULL:INCR] Starting incremental sync for user ${ctx.userId} since ${lastSyncAt}`
  );
  const changedTables = await getChangedTables(tx, lastSyncAt);

  if (changedTables.length === 0) {
    debug.log(`[PULL:INCR] No tables changed since ${lastSyncAt}`);
    return [];
  }

  const allChanges: SyncChange[] = [];
  for (const tableName of changedTables) {
    // Only process tables we know about
    if (!SYNCABLE_TABLES.includes(tableName as SyncableTableName)) {
      debug.log(`[PULL:INCR] Skipping unknown table: ${tableName}`);
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

  debug.log(
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
  diagnosticsEnabled: boolean,
  perfDebugEnabled: boolean,
  perfMinDurationMs: number
): Promise<SyncResponse> {
  const now = new Date().toISOString();
  const diag: string[] = [];
  let responseChanges: SyncChange[] = [];
  let nextCursor: string | undefined;
  let syncStartedAt: string | undefined;
  const syncType = payload.lastSyncAt ? "INCREMENTAL" : "INITIAL";
  const syncStartedAtMs = Date.now();

  perfLog(
    perfDebugEnabled,
    `sync.start type=${syncType} changesIn=${payload.changes.length} lastSyncAt=${payload.lastSyncAt ?? "null"} pageSize=${payload.pageSize ?? "null"} hasCursor=${payload.pullCursor ? "yes" : "no"}`
  );

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

  debug.log(`[SYNC] === Starting ${syncType} sync for user ${userId} ===`);
  debug.log(
    `[SYNC] Request: lastSyncAt=${payload.lastSyncAt ?? "null"}, changes=${payload.changes.length}`
  );

  await db.transaction(async (tx) => {
    const txStartedAt = Date.now();

    // After eliminating user_profile.id, authUserId IS the user identifier.
    // No resolution needed - user_profile.id is the PK.
    const authUserId = userId;

    const collectionsStartedAt = Date.now();
    const collections = await loadUserCollections({
      tx,
      userId: authUserId,
      tables: getSchemaTables(),
    });
    perfLogDuration(
      perfDebugEnabled,
      perfMinDurationMs,
      Date.now() - collectionsStartedAt,
      "sync.collections"
    );

    if (
      payload.collectionsOverride &&
      "selectedGenres" in payload.collectionsOverride
    ) {
      const selected = payload.collectionsOverride.selectedGenres ?? [];
      collections.selectedGenres = new Set(selected.map((g) => String(g)));
    }

    if (payload.genreFilter) {
      const selected = payload.genreFilter.selectedGenreIds ?? [];
      const repertoire = payload.genreFilter.repertoireGenreIds ?? [];
      const effective = [...selected, ...repertoire].map((g) => String(g));
      collections.selectedGenres = new Set(effective);
    }

    const pullTables = payload.pullTables
      ? new Set(payload.pullTables.map((t) => String(t)))
      : undefined;

    if (pullTables) {
      debug.log(
        `[Worker] 🚨 pullTables override received: ${Array.from(pullTables).join(", ")}`
      );
    } else {
      debug.log("[Worker] 🚨 No pullTables override - syncing all tables");
    }

    const ctx: SyncContext = {
      userId: authUserId,
      authUserId,
      collections,
      pullTables,
      genreFilter: payload.genreFilter,
      now,
      diagnosticsEnabled,
      perfDebugEnabled,
      perfMinDurationMs,
    };

    // Genre filter is passed to RPC functions when filtering note/reference tables

    // PUSH: Apply client changes
    const pushStartedAt = Date.now();
    await processPushChanges(tx, ctx, payload.changes as IncomingSyncChange[]);
    perfLogDuration(
      perfDebugEnabled,
      perfMinDurationMs,
      Date.now() - pushStartedAt,
      `sync.push changes=${payload.changes.length}`
    );

    // PULL: Gather changes for client
    const pullStartedAt = Date.now();
    if (payload.lastSyncAt) {
      responseChanges = await processIncrementalSync(
        tx,
        payload.lastSyncAt,
        ctx
      );
      perfLogDuration(
        perfDebugEnabled,
        perfMinDurationMs,
        Date.now() - pullStartedAt,
        `sync.pull.incremental changesOut=${responseChanges.length}`
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
      perfLogDuration(
        perfDebugEnabled,
        perfMinDurationMs,
        Date.now() - pullStartedAt,
        `sync.pull.initial pageChanges=${responseChanges.length} nextCursor=${nextCursor ? "yes" : "no"}`
      );
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

    perfLogDuration(
      perfDebugEnabled,
      perfMinDurationMs,
      Date.now() - txStartedAt,
      `sync.transaction type=${syncType}`
    );
  });

  debug.log(
    `[SYNC] === Completed ${syncType} sync: returning ${responseChanges.length} changes, syncedAt=${now} ===`
  );

  perfLogDuration(
    perfDebugEnabled,
    perfMinDurationMs,
    Date.now() - syncStartedAtMs,
    `sync.complete type=${syncType} changesOut=${responseChanges.length} total`
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
  // Initialize debug logging based on environment variable
  setDebugEnabled(env);
  const perfDebugEnabled = env.WORKER_DEBUG_PERF === "true";
  const perfMinDurationMs = parsePerfMinDurationMs(
    env.WORKER_DEBUG_PERF_MIN_MS
  );
  const requestStartedAt = Date.now();

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
      debug.log(`[HTTP] POST /api/sync received`);
      perfLog(perfDebugEnabled, "http.sync.request.received");

      // Validate environment configuration
      if (!env.SUPABASE_JWT_SECRET) {
        console.error("[HTTP] SUPABASE_JWT_SECRET not configured");
        return errorResponse("Server configuration error", 500, corsHeaders);
      }

      // Authenticate
      const authStartedAt = Date.now();
      const userId = await verifyJwt(
        request,
        env.SUPABASE_JWT_SECRET,
        env.SUPABASE_URL
      );
      perfLogDuration(
        perfDebugEnabled,
        perfMinDurationMs,
        Date.now() - authStartedAt,
        `http.sync.auth authorized=${userId ? "yes" : "no"}`
      );
      if (!userId) {
        debug.log(`[HTTP] Unauthorized - JWT verification failed`);
        return errorResponse("Unauthorized", 401, corsHeaders);
      }

      const diagnosticsEnabled =
        env.SYNC_DIAGNOSTICS === "true" &&
        (!env.SYNC_DIAGNOSTICS_USER_ID ||
          env.SYNC_DIAGNOSTICS_USER_ID === userId);

      const payloadStartedAt = Date.now();
      const payload = (await request.json()) as SyncRequest;
      perfLogDuration(
        perfDebugEnabled,
        perfMinDurationMs,
        Date.now() - payloadStartedAt,
        `http.sync.payload.parse changesIn=${payload.changes.length}`
      );

      // Connect to database
      try {
        debug.log(`[HTTP] Sync request parsed, calling handleSync`);
        const createDbStartedAt = Date.now();
        const { db, close } = createDb(env);
        perfLogDuration(
          perfDebugEnabled,
          perfMinDurationMs,
          Date.now() - createDbStartedAt,
          "http.sync.db.create"
        );

        const handleSyncStartedAt = Date.now();
        const response = await (async () => {
          try {
            return await handleSync(
              db,
              payload,
              userId,
              diagnosticsEnabled,
              perfDebugEnabled,
              perfMinDurationMs
            );
          } finally {
            const closeStartedAt = Date.now();
            await close();
            perfLogDuration(
              perfDebugEnabled,
              perfMinDurationMs,
              Date.now() - closeStartedAt,
              "http.sync.db.close"
            );
          }
        })();
        perfLogDuration(
          perfDebugEnabled,
          perfMinDurationMs,
          Date.now() - handleSyncStartedAt,
          "http.sync.handle"
        );
        perfLogDuration(
          perfDebugEnabled,
          perfMinDurationMs,
          Date.now() - requestStartedAt,
          "http.sync.request.total"
        );
        debug.log(`[HTTP] Sync completed successfully`);
        return jsonResponse(response, 200, corsHeaders);
      } catch (error) {
        perfLogDuration(
          perfDebugEnabled,
          perfMinDurationMs,
          Date.now() - requestStartedAt,
          "http.sync.request.failed"
        );
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
