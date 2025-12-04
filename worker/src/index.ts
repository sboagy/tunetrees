/**
 * Cloudflare Worker Sync Endpoint
 *
 * Architecture:
 * - PUSH: Client sends changes → Worker applies to Postgres
 * - PULL: Worker queries sync_change_log → returns changed rows to client
 *
 * @module worker/index
 */
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import { jwtVerify } from "jose";
import postgres from "postgres";
import { COL } from "../../shared/db-constants";
import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "../../shared/sync-types";
import {
  getBooleanColumns,
  getConflictTarget,
  getNormalizer,
  hasDeletedFlag,
  parseOutboxRowId,
  SYNCABLE_TABLES,
  type SyncableTableName,
  supportsIncremental,
  TABLE_REGISTRY,
} from "../../shared/table-meta";
import * as schema from "./schema-postgres";

// ============================================================================
// TYPES
// ============================================================================

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
}

/** Context passed through sync operations */
interface SyncContext {
  userId: string;
  userPlaylistIds: Set<string>;
  now: string;
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
 * Get column definitions for a table's primary/conflict key.
 */
function getPkColumns(
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
 * Build a WHERE clause to find a row by its primary key.
 */
function buildPkWhere(
  tableName: string,
  rowId: string,
  table: DrizzleTable
): unknown {
  const pkCols = getPkColumns(tableName, table);

  // Simple primary key (e.g., "abc-123")
  if (pkCols.length === 1) {
    return eq(pkCols[0].col, rowId);
  }

  // Composite key (e.g., '{"user_id":"x","tune_id":"y"}')
  const parsedKey = parseOutboxRowId(tableName, rowId);
  if (typeof parsedKey === "string") {
    return eq(pkCols[0].col, parsedKey);
  }

  const conditions = pkCols.map((pk) => {
    const snakeKey = pk.prop.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    const value = parsedKey[snakeKey] ?? parsedKey[pk.prop];
    return eq(pk.col, value);
  });

  return and(...conditions);
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
  const pkCols = getPkColumns(tableName, table);
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
// UTILITY: Access Control
// ============================================================================

/**
 * Check if user can access a row based on ownership rules.
 */
function canUserAccessRow(
  tableName: string,
  row: Record<string, unknown>,
  ctx: SyncContext
): boolean {
  // Direct user ownership
  if ("userId" in row) return row.userId === ctx.userId;
  if ("userRef" in row) return row.userRef === ctx.userId;

  // Public/private pattern
  if ("privateFor" in row) {
    return row.privateFor === null || row.privateFor === ctx.userId;
  }
  if ("privateToUser" in row) {
    return row.privateToUser === null || row.privateToUser === ctx.userId;
  }

  // Playlist-based ownership
  if ("playlistRef" in row) {
    return ctx.userPlaylistIds.has(row.playlistRef as string);
  }

  // Static reference tables - everyone can access
  if (!supportsIncremental(tableName)) {
    return true;
  }

  // Default: allow
  return true;
}

// ============================================================================
// UTILITY: Authentication
// ============================================================================

async function verifyJwt(
  request: Request,
  secret: string
): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return payload.sub ?? null;
  } catch (e) {
    console.error("JWT verification failed:", e);
    return null;
  }
}

// ============================================================================
// PUSH: Apply Client Changes to Postgres
// ============================================================================

/**
 * Apply a single change (insert/update/delete) to Postgres.
 */
async function applyChange(tx: Transaction, change: SyncChange): Promise<void> {
  // Skip sync infrastructure tables
  if (
    change.table === "sync_push_queue" ||
    change.table === "sync_change_log"
  ) {
    return;
  }

  const table = schema.tables[change.table as keyof typeof schema.tables];
  if (!table) return;

  const t = table as DrizzleTable;
  if (!t.lastModifiedAt) return;

  const pkCols = getPkColumns(change.table, t);
  const data = sqliteToPostgres(
    change.table,
    change.data as Record<string, unknown>
  );

  if (change.deleted) {
    await applyDelete(tx, change.table, table, pkCols, change);
  } else {
    await applyUpsert(tx, table, pkCols, data);
  }
}

async function applyDelete(
  tx: Transaction,
  tableName: string,
  table: DrizzleTable,
  pkCols: { col: unknown; prop: string }[],
  change: SyncChange
): Promise<void> {
  const whereConditions = pkCols.map((pk) =>
    eq(pk.col as any, (change.data as Record<string, unknown>)[pk.prop])
  );

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
  data: Record<string, unknown>
): Promise<void> {
  const targetCols = pkCols.map((pk) => pk.col);
  await tx
    .insert(table)
    .values(data)
    .onConflictDoUpdate({
      target: targetCols as any,
      set: data,
    });
}

/**
 * Process all PUSH changes from the client.
 */
async function processPushChanges(
  tx: Transaction,
  changes: SyncChange[]
): Promise<void> {
  for (const change of changes) {
    await applyChange(tx, change);
  }
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

/**
 * Create a delete marker for a row that no longer exists.
 */
function createDeleteMarker(
  tableName: string,
  rowId: string,
  table: DrizzleTable,
  now: string
): SyncChange {
  const pkCols = getPkColumns(tableName, table);

  let data: Record<string, unknown>;
  if (pkCols.length === 1) {
    data = { [pkCols[0].prop]: rowId };
  } else {
    const parsed = parseOutboxRowId(tableName, rowId);
    data = typeof parsed === "string" ? { [pkCols[0].prop]: parsed } : parsed;
  }

  return {
    table: tableName as SyncableTableName,
    rowId,
    data,
    deleted: true,
    lastModifiedAt: now,
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
  table: DrizzleTable,
  ctx: SyncContext
): unknown[] | null {
  const conditions: unknown[] = [];

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

/**
 * Fetch all rows from a single table for initial sync.
 */
async function fetchTableForInitialSync(
  tx: Transaction,
  tableName: SyncableTableName,
  ctx: SyncContext
): Promise<SyncChange[]> {
  const table = schema.tables[tableName];
  if (!table) return [];

  const t = table as DrizzleTable;
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) return [];

  // Build user filter
  const conditions = buildUserFilter(t, ctx);
  if (conditions === null) return []; // Skip table (e.g., no playlists)

  // Query
  let query = tx.select().from(table);
  if (conditions.length > 0) {
    // @ts-expect-error - dynamic where
    query = query.where(and(...conditions));
  }

  const rows = await query;

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
 * Initial sync: fetch all user-accessible rows from all tables.
 */
async function processInitialSync(
  tx: Transaction,
  ctx: SyncContext
): Promise<SyncChange[]> {
  const allChanges: SyncChange[] = [];

  for (const tableName of SYNCABLE_TABLES) {
    const tableChanges = await fetchTableForInitialSync(tx, tableName, ctx);
    allChanges.push(...tableChanges);
  }

  return allChanges;
}

// ============================================================================
// PULL: Incremental Sync (Change Log Driven)
// ============================================================================

/**
 * Fetch changes from sync_change_log since lastSyncAt.
 * Groups by table and dedupes row IDs.
 */
async function fetchChangeLogEntries(
  tx: Transaction,
  lastSyncAt: string
): Promise<Map<string, Set<string>>> {
  const entries = await tx
    .select()
    .from(schema.syncChangeLog)
    .where(gt(schema.syncChangeLog.changedAt, lastSyncAt));

  // Group by table, dedupe row IDs
  const changesByTable = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!changesByTable.has(entry.tableName)) {
      changesByTable.set(entry.tableName, new Set());
    }
    changesByTable.get(entry.tableName)!.add(entry.rowId);
  }

  return changesByTable;
}

/**
 * Fetch a single row by its primary key.
 * Returns null if the row doesn't exist (was hard-deleted).
 */
async function fetchRowByPk(
  tx: Transaction,
  tableName: string,
  rowId: string,
  table: DrizzleTable
): Promise<Record<string, unknown> | null> {
  const whereClause = buildPkWhere(tableName, rowId, table);

  const rows = await tx
    .select()
    .from(table)
    // @ts-expect-error - dynamic where
    .where(whereClause);

  return rows.length > 0 ? (rows[0] as Record<string, unknown>) : null;
}

/**
 * Process all changed rows for a single table.
 */
async function processTableChanges(
  tx: Transaction,
  tableName: string,
  rowIds: Set<string>,
  ctx: SyncContext
): Promise<SyncChange[]> {
  const table = schema.tables[tableName as keyof typeof schema.tables];
  if (!table) return [];

  const t = table as DrizzleTable;
  const changes: SyncChange[] = [];

  for (const rowId of rowIds) {
    const row = await fetchRowByPk(tx, tableName, rowId, t);

    if (row === null) {
      // Row was hard-deleted
      changes.push(createDeleteMarker(tableName, rowId, t, ctx.now));
      continue;
    }

    // Check access
    if (!canUserAccessRow(tableName, row, ctx)) {
      continue;
    }

    changes.push(rowToSyncChange(tableName, rowId, row));
  }

  return changes;
}

/**
 * Incremental sync: fetch only rows that changed since lastSyncAt.
 */
async function processIncrementalSync(
  tx: Transaction,
  lastSyncAt: string,
  ctx: SyncContext
): Promise<SyncChange[]> {
  const changesByTable = await fetchChangeLogEntries(tx, lastSyncAt);

  const allChanges: SyncChange[] = [];
  for (const [tableName, rowIds] of changesByTable) {
    const tableChanges = await processTableChanges(tx, tableName, rowIds, ctx);
    allChanges.push(...tableChanges);
  }

  return allChanges;
}

// ============================================================================
// MAIN SYNC HANDLER
// ============================================================================

async function handleSync(
  db: ReturnType<typeof drizzle>,
  payload: SyncRequest,
  userId: string
): Promise<SyncResponse> {
  const now = new Date().toISOString();
  let responseChanges: SyncChange[] = [];

  await db.transaction(async (tx) => {
    // Get user's playlist IDs for ownership filtering
    const userPlaylists = await tx
      .select({ id: schema.playlist.playlistId })
      .from(schema.playlist)
      .where(eq(schema.playlist.userRef, userId));

    const ctx: SyncContext = {
      userId,
      userPlaylistIds: new Set(userPlaylists.map((p) => p.id)),
      now,
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
      responseChanges = await processInitialSync(tx, ctx);
    }
  });

  return {
    changes: responseChanges,
    syncedAt: now,
  };
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("OK", { status: 200, headers: CORS_HEADERS });
    }

    // Sync endpoint
    if (request.method === "POST" && url.pathname === "/api/sync") {
      // Authenticate
      const userId = await verifyJwt(request, env.SUPABASE_JWT_SECRET);
      if (!userId) {
        return errorResponse("Unauthorized", 401);
      }

      // Connect to database
      const connectionString =
        env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
      if (!connectionString) {
        return errorResponse("Database configuration error", 500);
      }

      try {
        const client = postgres(connectionString);
        const db = drizzle(client, { schema });
        const payload = (await request.json()) as SyncRequest;

        const response = await handleSync(db, payload, userId);
        return jsonResponse(response);
      } catch (error) {
        console.error("Sync error:", error);
        return errorResponse(String(error), 500);
      }
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
