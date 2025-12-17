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
  SYNCABLE_TABLES,
  type SyncableTableName,
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
async function applyChange(tx: Transaction, change: SyncChange): Promise<void> {
  // Skip sync infrastructure tables
  if (
    change.table === "sync_push_queue" ||
    change.table === "sync_change_log"
  ) {
    console.log(`[PUSH] Skipping sync infrastructure table: ${change.table}`);
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

  const pkCols = getPkColumns(change.table, t);
  const data = sqliteToPostgres(
    change.table,
    change.data as Record<string, unknown>
  );

  console.log(
    `[PUSH] Applying ${change.deleted ? "DELETE" : "UPSERT"} to ${change.table}, rowId: ${change.rowId}`
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
  console.log(`[PUSH] Processing ${changes.length} changes from client`);
  for (const change of changes) {
    await applyChange(tx, change);
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
  if (conditions === null) {
    console.log(`[PULL:INITIAL] Skipping ${tableName} (no playlists for user)`);
    return []; // Skip table (e.g., no playlists)
  }

  // Query
  let query = tx.select().from(table);
  if (conditions.length > 0) {
    // @ts-expect-error - dynamic where
    query = query.where(and(...conditions));
  }

  const rows = await query;
  console.log(`[PULL:INITIAL] ${tableName}: fetched ${rows.length} rows`);

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
  console.log(
    `[PULL:INITIAL] Starting initial sync for user ${ctx.userId}, playlists: [${Array.from(ctx.userPlaylistIds).join(", ")}]`
  );
  const allChanges: SyncChange[] = [];

  for (const tableName of SYNCABLE_TABLES) {
    const tableChanges = await fetchTableForInitialSync(tx, tableName, ctx);
    allChanges.push(...tableChanges);
  }

  console.log(
    `[PULL:INITIAL] Completed initial sync: ${allChanges.length} total changes across ${SYNCABLE_TABLES.length} tables`
  );
  return allChanges;
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
  const userConditions = buildUserFilter(t, ctx);
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
  userId: string
): Promise<SyncResponse> {
  const now = new Date().toISOString();
  let responseChanges: SyncChange[] = [];
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

    // NO GARBAGE COLLECTION NEEDED!
    // sync_change_log now has at most ~20 rows (one per table)
  });

  console.log(
    `[SYNC] === Completed ${syncType} sync: returning ${responseChanges.length} changes, syncedAt=${now} ===`
  );

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

    // TheSession.org CORS proxy endpoint
    // This endpoint proxies requests to TheSession.org API to bypass CORS restrictions
    if (request.method === "GET" && url.pathname === "/api/proxy/thesession") {
      console.log(`[HTTP] GET /api/proxy/thesession received`);

      try {
        // Get the target URL from query parameter
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          return errorResponse("Missing 'url' query parameter", 400);
        }

        // Validate that the URL is from thesession.org (exact hostname and protocol match)
        let targetUrlObj: URL;
        try {
          targetUrlObj = new URL(targetUrl);
        } catch (urlError) {
          return errorResponse(
            "Invalid URL format",
            400
          );
        }

        // Security checks: exact hostname and HTTPS protocol
        if (targetUrlObj.hostname !== "thesession.org") {
          return errorResponse(
            "Invalid URL - only thesession.org is allowed",
            400
          );
        }
        if (targetUrlObj.protocol !== "https:") {
          return errorResponse(
            "Invalid URL - only HTTPS protocol is allowed",
            400
          );
        }

        // Fetch from TheSession.org with timeout
        console.log(`[HTTP] Proxying request to: ${targetUrl}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const response = await fetch(targetUrl, {
            headers: {
              Accept: "application/json",
              "User-Agent": "TuneTrees-PWA/1.0",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.error(
              `[HTTP] TheSession.org returned error: ${response.status}`
            );
            return errorResponse(
              `TheSession.org API error: ${response.statusText}`,
              response.status
            );
          }

          // Parse JSON response with error handling
          let data: unknown;
          try {
            data = await response.json();
          } catch (jsonError) {
            console.error("[HTTP] Invalid JSON response from TheSession.org");
            return errorResponse(
              "Invalid JSON response from TheSession.org",
              502
            );
          }

          return jsonResponse(data);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            return errorResponse(
              "Request to TheSession.org timed out",
              504
            );
          }
          throw fetchError;
        }
      } catch (error) {
        console.error("[HTTP] Proxy error:", error);
        return errorResponse(
          `Proxy error: ${error instanceof Error ? error.message : String(error)}`,
          500
        );
      }
    }

    // Sync endpoint
    if (request.method === "POST" && url.pathname === "/api/sync") {
      console.log(`[HTTP] POST /api/sync received`);

      // Authenticate
      const userId = await verifyJwt(request, env.SUPABASE_JWT_SECRET);
      if (!userId) {
        console.log(`[HTTP] Unauthorized - JWT verification failed`);
        return errorResponse("Unauthorized", 401);
      }

      // Connect to database
      const connectionString =
        env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
      if (!connectionString) {
        console.error(
          `[HTTP] Database configuration error - no connection string`
        );
        return errorResponse("Database configuration error", 500);
      }

      try {
        const client = postgres(connectionString);
        const db = drizzle(client, { schema });
        const payload = (await request.json()) as SyncRequest;

        console.log(`[HTTP] Sync request parsed, calling handleSync`);
        const response = await handleSync(db, payload, userId);
        console.log(`[HTTP] Sync completed successfully`);
        return jsonResponse(response);
      } catch (error) {
        console.error("[HTTP] Sync error:", error);
        return errorResponse(String(error), 500);
      }
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
