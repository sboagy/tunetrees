/**
 * Cloudflare Worker Sync Endpoint
 *
 * Architecture:
 * - PUSH: Client sends changes → Worker applies to Postgres
 * - PULL: Worker queries sync_change_log → returns changed rows to client
 *
 * @module worker/index
 */
import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  max,
  min,
  or,
} from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { jwtVerify } from "jose";
import postgres from "postgres";
import { COL } from "../../src/shared/protocol";
import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "../../src/shared/protocol";
import {
  getBooleanColumns,
  getConflictTarget,
  getNormalizer,
  getPrimaryKey,
  hasDeletedFlag,
  SYNCABLE_TABLES,
  type SyncableTableName,
  TABLE_REGISTRY,
} from "../../src/shared/table-meta";
import * as schema from "./schema-postgres";

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
  const db = drizzle(client, { schema });

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

type IncomingSyncTableName = SyncableTableName | "sync_push_queue" | "sync_change_log";
type IncomingSyncChange = Omit<SyncChange, "table"> & { table: IncomingSyncTableName };

function isClientSyncChange(change: IncomingSyncChange): change is SyncChange {
  return change.table !== "sync_push_queue" && change.table !== "sync_change_log";
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
  userId: string;
  userPlaylistIds: Set<string>;
  now: string;
  diagnosticsEnabled: boolean;
}

async function logPlaylistTuneInitialSyncDiagnostics(
  tx: Transaction,
  ctx: SyncContext,
  syncStartedAt: string
): Promise<void> {
  const playlistIds = Array.from(ctx.userPlaylistIds);
  if (playlistIds.length === 0) return;

  const baseWhere = inArray(schema.playlistTune.playlistRef, playlistIds);
  const snapshotWhere = and(
    baseWhere,
    lte(schema.playlistTune.lastModifiedAt, syncStartedAt)
  );

  const [totalAll] = await tx
    .select({ n: count() })
    .from(schema.playlistTune)
    .where(baseWhere);
  const [totalSnapshot] = await tx
    .select({ n: count() })
    .from(schema.playlistTune)
    .where(snapshotWhere);

  const [snapshotDeleted0] = await tx
    .select({ n: count() })
    .from(schema.playlistTune)
    .where(and(snapshotWhere, eq(schema.playlistTune.deleted, 0)));
  const [snapshotDeleted1] = await tx
    .select({ n: count() })
    .from(schema.playlistTune)
    .where(and(snapshotWhere, eq(schema.playlistTune.deleted, 1)));

  const [minMax] = await tx
    .select({
      min: min(schema.playlistTune.lastModifiedAt),
      max: max(schema.playlistTune.lastModifiedAt),
    })
    .from(schema.playlistTune)
    .where(baseWhere);

  console.log("[SYNC_DIAG] playlist_tune initial-sync snapshot", {
    userId: ctx.userId,
    userPlaylistCount: playlistIds.length,
    syncStartedAt,
    totals: {
      all: Number(totalAll?.n ?? 0),
      snapshot: Number(totalSnapshot?.n ?? 0),
      snapshotDeleted0: Number(snapshotDeleted0?.n ?? 0),
      snapshotDeleted1: Number(snapshotDeleted1?.n ?? 0),
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
// UTILITY: Case Conversion
// ============================================================================

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

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

function coerceEmptyStringNumericFieldsToNull(
  tableName: string,
  data: Record<string, unknown>
): { data: Record<string, unknown>; coerced: string[] } {
  // Self-healing for older/local SQLite data that may contain empty strings
  // in numeric fields (e.g. "" for REAL/INTEGER). Postgres rejects these.
  // Keep this intentionally narrow to avoid changing meaning for text columns.
  const numericPropsByTable: Partial<Record<SyncableTableName, string[]>> = {
    practice_record: [
      "quality",
      "easiness",
      "difficulty",
      "stability",
      "interval",
      "step",
      "repetitions",
      "lapses",
      "elapsedDays",
      "state",
    ],
  };

  const props =
    numericPropsByTable[tableName as SyncableTableName] ?? ([] as string[]);
  if (props.length === 0) return { data, coerced: [] };

  const result = { ...data };
  const coerced: string[] = [];
  for (const prop of props) {
    const value = result[prop];
    if (typeof value === "string" && value.trim() === "") {
      result[prop] = null;
      coerced.push(prop);
    }
  }
  return { data: result, coerced };
}

function sanitizePracticeRecordForPostgres(
  change: SyncChange,
  data: Record<string, unknown>
): { data: Record<string, unknown>; changed: string[] } {
  if (change.table !== "practice_record") return { data, changed: [] };

  const changed: string[] = [];
  const result: Record<string, unknown> = { ...data };

  // Ensure required sync metadata is always present.
  if (
    typeof result.lastModifiedAt !== "string" ||
    result.lastModifiedAt === ""
  ) {
    result.lastModifiedAt = change.lastModifiedAt;
    changed.push("lastModifiedAt");
  }
  if (
    typeof result.syncVersion !== "number" &&
    !(
      typeof result.syncVersion === "string" && result.syncVersion.trim() !== ""
    )
  ) {
    result.syncVersion = 1;
    changed.push("syncVersion");
  }

  const numericFields: Array<{ prop: string; kind: "int" | "float" }> = [
    { prop: "quality", kind: "int" },
    { prop: "easiness", kind: "float" },
    { prop: "difficulty", kind: "float" },
    { prop: "stability", kind: "float" },
    { prop: "interval", kind: "int" },
    { prop: "step", kind: "int" },
    { prop: "repetitions", kind: "int" },
    { prop: "lapses", kind: "int" },
    { prop: "elapsedDays", kind: "int" },
    { prop: "state", kind: "int" },
  ];

  for (const field of numericFields) {
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

  // Timestamp columns in Postgres are nullable. Empty strings are not valid.
  const timestampProps = ["practiced", "due", "backupPracticed"] as const;
  for (const prop of timestampProps) {
    const value = result[prop];
    if (typeof value === "string" && value.trim() === "") {
      result[prop] = null;
      changed.push(prop);
    }
  }

  // deviceId may exist as empty string in older clients; prefer NULL.
  if (typeof result.deviceId === "string" && result.deviceId.trim() === "") {
    result.deviceId = null;
    changed.push("deviceId");
  }

  return { data: result, changed };
}

function minimalPracticeRecordPayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  // Keep the smallest useful subset. This is only used as a fallback retry
  // when the full upsert fails (to avoid stranding practice history).
  const keep = [
    "id",
    "playlistRef",
    "tuneRef",
    "practiced",
    "quality",
    "due",
    "backupPracticed",
    "goal",
    "technique",
    "syncVersion",
    "lastModifiedAt",
    "deviceId",
  ];

  const result: Record<string, unknown> = {};
  for (const k of keep) {
    if (k in data) result[k] = data[k];
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
  change: IncomingSyncChange
): Promise<void> {
  // Skip sync infrastructure tables
  if (!isClientSyncChange(change)) {
    console.log(`[PUSH] Skipping sync infrastructure table: ${change.table}`);
    return;
  }

  // Historical invariants: practice records are append-only.
  // Do not allow deletes from clients (even if they attempt one).
  if (change.table === "practice_record" && change.deleted) {
    console.warn(
      `[PUSH] Refusing DELETE for practice_record rowId=${change.rowId}`
    );
    return;
  }

  const table = schema.tables[change.table as keyof typeof schema.tables];
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
  const coerced = coerceEmptyStringNumericFieldsToNull(change.table, data);
  data = coerced.data;
  if (coerced.coerced.length > 0) {
    console.warn(
      `[PUSH] Coerced empty-string numeric fields to NULL for ${change.table} rowId=${change.rowId}: ${coerced.coerced.join(", ")}`
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
    if (change.table === "practice_record") {
      const sanitized = sanitizePracticeRecordForPostgres(change, data);
      if (sanitized.changed.length > 0) {
        console.warn(
          `[PUSH] Sanitized practice_record rowId=${change.rowId}: ${sanitized.changed.join(", ")}`
        );
      }

      // practice_record is keyed by a natural composite key in Postgres
      // (tune_ref, playlist_ref, practiced). When we UPSERT by that key,
      // we must NOT update the primary key `id`, otherwise we can create
      // PK collisions across devices / retries.
      const compositeUpsertOpts = { omitSetProps: ["id"] } as const;

      try {
        // IMPORTANT: A failed statement inside a Postgres transaction marks the
        // transaction as aborted, and all subsequent statements will fail with
        // code=25P02. Use a savepoint so we can retry with a sanitized/minimal
        // payload without poisoning the outer transaction.
        await tx.transaction(async (sp) => {
          await applyUpsert(
            sp,
            table,
            upsertKeyCols,
            sanitized.data,
            compositeUpsertOpts
          );
        });
      } catch (e) {
        // Retry once with a minimal payload. This trades some optional FSRS
        // fields for resilience, while still preserving the practice event.
        console.warn(
          `[PUSH] practice_record upsert retry (minimal payload) rowId=${change.rowId}: ${formatDbError(
            e
          )}`
        );
        const minimal = minimalPracticeRecordPayload(sanitized.data);

        try {
          // Use a savepoint so a failed minimal upsert doesn't abort the outer transaction.
          await tx.transaction(async (sp) => {
            await applyUpsert(
              sp,
              table,
              upsertKeyCols,
              minimal,
              compositeUpsertOpts
            );
          });
        } catch (e2) {
          const pgErr = findPostgresErrorLike(e2);
          const code = typeof pgErr?.code === "string" ? pgErr.code : undefined;
          const constraint =
            typeof pgErr?.constraint_name === "string"
              ? pgErr.constraint_name
              : undefined;

          // If the row already exists by primary key, we can safely upsert on id.
          // This can happen if the composite conflict target doesn't match
          // (e.g., practiced is NULL/changed), but the id is already present.
          if (code === "23505" && constraint === "practice_record_pkey") {
            console.warn(
              `[PUSH] practice_record minimal upsert hit PK conflict; retrying by id rowId=${change.rowId}: ${formatDbError(
                e2
              )}`
            );

            try {
              // Retry by primary key inside its own savepoint for the same reason.
              await tx.transaction(async (sp) => {
                await applyUpsert(sp, table, deleteKeyCols, minimal, {
                  omitSetProps: ["id"],
                });
              });
              return;
            } catch (e3) {
              const pgErr3 = findPostgresErrorLike(e3);
              const code3 =
                typeof pgErr3?.code === "string" ? pgErr3.code : undefined;
              const constraint3 =
                typeof pgErr3?.constraint_name === "string"
                  ? pgErr3.constraint_name
                  : undefined;

              // If updating by id would violate the composite unique key, we
              // treat this as a duplicate practice event already present.
              // Heal by updating the existing composite-key row (without touching id).
              if (
                code3 === "23505" &&
                constraint3 ===
                  "practice_record_tune_ref_playlist_ref_practiced_key"
              ) {
                console.warn(
                  `[PUSH] practice_record by-id retry hit composite unique; healing by composite upsert rowId=${change.rowId}: ${formatDbError(
                    e3
                  )}`
                );
                await tx.transaction(async (sp) => {
                  await applyUpsert(
                    sp,
                    table,
                    upsertKeyCols,
                    minimal,
                    compositeUpsertOpts
                  );
                });
                return;
              }

              throw e3;
            }
          }

          throw e2;
        }
      }
    } else {
      await applyUpsert(tx, table, upsertKeyCols, data);
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
        [COL.DELETED]: true,
        [COL.LAST_MODIFIED_AT]: change.lastModifiedAt,
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
  changes: SyncChange[]
): Promise<void> {
  console.log(`[PUSH] Processing ${changes.length} changes from client`);
  for (const change of changes) {
    try {
      await applyChange(tx, change);
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
  // Apply any table-specific normalization
  const normalizer = getNormalizer(tableName);
  let data = normalizer ? normalizer(row) : row;

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

/**
 * Build WHERE conditions for user-filtered table access.
 * Returns null if the table should be skipped entirely.
 */
function buildUserFilter(
  tableName: SyncableTableName,
  table: DrizzleTable,
  ctx: SyncContext
): unknown[] | null {
  const conditions: unknown[] = [];

  // `user_profile` must never sync other users' rows into the client.
  // The JWT subject is the Supabase Auth user ID, which matches `supabase_user_id`.
  if (tableName === "user_profile" && table.supabaseUserId) {
    conditions.push(eq(table.supabaseUserId, ctx.userId));
    return conditions;
  }

  // Special case: references are "system" when `user_ref` is NULL.
  // IMPORTANT: `reference.user_ref` FK's to `user_profile.id` (internal ID).
  // We *do not* sync other users' `user_profile` rows.
  // Therefore, syncing any reference row owned by another user would violate
  // the client's FK constraint and could abort initial sync.
  //
  // Visibility semantics (ignore `reference.public`):
  // - system/legacy references: user_ref IS NULL
  // - private references: user_ref = ctx.userId
  if (tableName === "reference" && table.userRef) {
    conditions.push(or(isNull(table.userRef), eq(table.userRef, ctx.userId)));
    return conditions;
  }

  if (table.userId) {
    conditions.push(eq(table.userId, ctx.userId));
  } else if (table.userRef) {
    conditions.push(eq(table.userRef, ctx.userId));
  } else if (table.privateFor) {
    conditions.push(
      or(isNull(table.privateFor), eq(table.privateFor, ctx.userId))
    );
  } else if (table.privateToUser) {
    conditions.push(
      or(isNull(table.privateToUser), eq(table.privateToUser, ctx.userId))
    );
  } else if (table.playlistRef) {
    const playlistIds = Array.from(ctx.userPlaylistIds);
    if (playlistIds.length === 0) {
      return null; // No playlists = skip this table
    }
    conditions.push(inArray(table.playlistRef, playlistIds));
  }
  // Static tables (genre, tune_type) have no conditions

  return conditions;
}

async function fetchTableForInitialSyncPage(
  tx: Transaction,
  tableName: SyncableTableName,
  ctx: SyncContext,
  syncStartedAt: string,
  offset: number,
  limit: number
): Promise<SyncChange[]> {
  const table = schema.tables[tableName];
  if (!table) return [];

  const t = table as DrizzleTable;
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) return [];

  const conditions = buildUserFilter(tableName, t, ctx);
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
  const entries = await tx
    .select({ tableName: schema.syncChangeLog.tableName })
    .from(schema.syncChangeLog)
    .where(gt(schema.syncChangeLog.changedAt, lastSyncAt));

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
  const table = schema.tables[tableName];
  if (!table) return [];

  const t = table as DrizzleTable;
  if (!t.lastModifiedAt) {
    console.log(`[PULL:INCR] ${tableName} has no lastModifiedAt, skipping`);
    return []; // Table doesn't support incremental sync
  }

  // Build conditions: last_modified_at > lastSyncAt AND user_filter
  const userConditions = buildUserFilter(tableName, t, ctx);
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
  let responseChanges: SyncChange[] = [];
  let nextCursor: string | undefined;
  let syncStartedAt: string | undefined;
  const syncType = payload.lastSyncAt ? "INCREMENTAL" : "INITIAL";

  console.log(`[SYNC] === Starting ${syncType} sync for user ${userId} ===`);
  console.log(
    `[SYNC] Request: lastSyncAt=${payload.lastSyncAt ?? "null"}, changes=${payload.changes.length}`
  );

  await db.transaction(async (tx) => {
    // Get user's playlist IDs for ownership filtering
    const userPlaylists = await tx
      .select({ id: schema.playlist.playlistId })
      .from(schema.playlist)
      .where(eq(schema.playlist.userRef, userId));

    console.log(`[SYNC] User has ${userPlaylists.length} playlists`);

    const ctx: SyncContext = {
      userId,
      userPlaylistIds: new Set(userPlaylists.map((p) => p.id)),
      now,
      diagnosticsEnabled,
    };

    // PUSH: Apply client changes
    await processPushChanges(tx, payload.changes);

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get CORS headers for this request (needed for all responses)
    const corsHeaders = getCorsHeaders(request);

    try {
      const url = new URL(request.url);

      // CORS preflight - handle immediately
      if (request.method === "OPTIONS") {
        return new Response(null, { 
          status: 204,
          headers: corsHeaders 
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
  },
};
