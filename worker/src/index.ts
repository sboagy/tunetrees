/**
 * Cloudflare Worker Sync Endpoint - Outbox-Driven Implementation
 *
 * Architecture:
 * - PUSH: Apply client changes to Postgres (triggers populate sync_outbox)
 * - PULL: Query sync_outbox for changes since lastSyncAt, fetch only affected rows
 *
 * Data-driven using TABLE_REGISTRY from table-meta.ts:
 * - No hardcoded table names or switch statements
 * - Boolean conversion between SQLite (0/1) and Postgres (true/false)
 * - Composite key handling via getConflictTarget()
 */
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
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

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
}

// ============================================================================
// UTILITY FUNCTIONS - All data-driven from TABLE_REGISTRY
// ============================================================================

/** Convert snake_case to camelCase */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Get Drizzle column references for conflict target.
 * Uses getConflictTarget() from TABLE_REGISTRY.
 */
function getConflictColumns(
  tableName: string,
  table: Record<string, unknown>
): { col: unknown; prop: string }[] {
  const snakeKeys = getConflictTarget(tableName);
  return snakeKeys.map((snakeKey) => {
    const camelKey = snakeToCamel(snakeKey);
    const col = table[camelKey];
    if (!col) {
      throw new Error(
        `Column '${camelKey}' not found in '${tableName}' (from '${snakeKey}')`
      );
    }
    return { col, prop: camelKey };
  });
}

/**
 * Convert SQLite integers (0/1) to Postgres booleans.
 * Uses getBooleanColumns() from TABLE_REGISTRY.
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
 * Uses getBooleanColumns() from TABLE_REGISTRY.
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

/**
 * Build WHERE condition for fetching a specific row by its primary key.
 * Handles both simple (id) and composite keys.
 */
function buildPkCondition(
  tableName: string,
  rowId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any
): unknown {
  const pkDefs = getConflictColumns(tableName, table);

  if (pkDefs.length === 1) {
    // Simple primary key
    return eq(pkDefs[0].col as any, rowId);
  }

  // Composite key - rowId is JSON
  const parsedKey = parseOutboxRowId(tableName, rowId);
  if (typeof parsedKey === "string") {
    // Shouldn't happen for composite keys, but handle gracefully
    return eq(pkDefs[0].col as any, parsedKey);
  }

  // Build AND condition for each key column
  const conditions = pkDefs.map((pk) => {
    const camelKey = pk.prop;
    const snakeKey = camelKey.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    const value = parsedKey[snakeKey] ?? parsedKey[camelKey];
    return eq(pk.col as any, value);
  });

  return and(...conditions);
}

/**
 * Check if user has access to a row based on table ownership rules.
 */
function userCanAccessRow(
  tableName: string,
  row: Record<string, unknown>,
  userId: string,
  userPlaylistIds: Set<string>
): boolean {
  // Tables with direct user ownership
  if ("userId" in row) return row.userId === userId;
  if ("userRef" in row) return row.userRef === userId;

  // Tables with public/private pattern
  if ("privateFor" in row) {
    return row.privateFor === null || row.privateFor === userId;
  }
  if ("privateToUser" in row) {
    return row.privateToUser === null || row.privateToUser === userId;
  }

  // Junction tables that reference playlist
  if ("playlistRef" in row) {
    return userPlaylistIds.has(row.playlistRef as string);
  }

  // Static reference tables (genre, tune_type) - everyone can access
  const meta = TABLE_REGISTRY[tableName];
  if (meta && !supportsIncremental(tableName)) {
    return true; // Static reference data
  }

  // Default: allow (for tables without ownership)
  return true;
}

/** JWT verification */
async function verifyAuth(
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
    console.error("JWT Verification failed:", e);
    return null;
  }
}

// ============================================================================
// MAIN WORKER
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    if (request.method === "POST" && url.pathname === "/api/sync") {
      const userId = await verifyAuth(request, env.SUPABASE_JWT_SECRET);
      if (!userId) {
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const connectionString =
          env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
        if (!connectionString) {
          return new Response("Database configuration error", {
            status: 500,
            headers: corsHeaders,
          });
        }

        const client = postgres(connectionString);
        const db = drizzle(client, { schema });
        const payload = (await request.json()) as SyncRequest;
        const responseChanges: SyncChange[] = [];
        const now = new Date().toISOString();

        await db.transaction(async (tx) => {
          // ==============================================================
          // PUSH: Apply client changes to Postgres
          // Postgres triggers will populate sync_outbox automatically
          // ==============================================================
          for (const change of payload.changes) {
            const table = schema.tables[change.table];
            if (!table) continue;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const t = table as any;
            if (!t.lastModifiedAt) continue;

            // Get conflict target from TABLE_REGISTRY
            const pkDefs = getConflictColumns(change.table, t);

            // Convert SQLite booleans to Postgres
            const dataForDb = sqliteToPostgres(
              change.table,
              change.data as Record<string, unknown>
            );

            if (change.deleted) {
              // Build WHERE from primary key
              const whereConditions = pkDefs.map((pk) =>
                eq(
                  pk.col as any,
                  (change.data as Record<string, unknown>)[pk.prop]
                )
              );

              if (hasDeletedFlag(change.table)) {
                // Soft delete
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
            } else {
              // Upsert
              const targetCols = pkDefs.map((pk) => pk.col);
              await tx
                .insert(table)
                .values(dataForDb)
                .onConflictDoUpdate({
                  target: targetCols as any,
                  set: dataForDb,
                });
            }
          }

          // ==============================================================
          // PULL: Outbox-driven - query sync_outbox for changed rows
          // ==============================================================

          // Get user's playlist IDs for ownership filtering
          const userPlaylists = await tx
            .select({ id: schema.playlist.playlistId })
            .from(schema.playlist)
            .where(eq(schema.playlist.userRef, userId));
          const userPlaylistIds = new Set(userPlaylists.map((p) => p.id));

          // Determine if this is initial sync or incremental
          const isInitialSync = !payload.lastSyncAt;

          if (isInitialSync) {
            // ==============================================================
            // INITIAL SYNC: Full table scan (no outbox yet)
            // ==============================================================
            for (const tableName of SYNCABLE_TABLES) {
              const table = schema.tables[tableName];
              if (!table) continue;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const t = table as any;
              const meta = TABLE_REGISTRY[tableName];
              if (!meta) continue;

              // Build user filter conditions
              const conditions: unknown[] = [];

              if (t.userId) {
                conditions.push(eq(t.userId, userId));
              } else if (t.userRef) {
                conditions.push(eq(t.userRef, userId));
              } else if (t.privateFor) {
                conditions.push(
                  or(isNull(t.privateFor), eq(t.privateFor, userId))
                );
              } else if (t.privateToUser) {
                conditions.push(
                  or(isNull(t.privateToUser), eq(t.privateToUser, userId))
                );
              } else if (t.playlistRef) {
                const playlistIdList = Array.from(userPlaylistIds);
                if (playlistIdList.length > 0) {
                  conditions.push(inArray(t.playlistRef, playlistIdList));
                } else {
                  // User has no playlists, skip tables that require playlist ownership
                  continue;
                }
              }
              // Static tables (genre, tune_type) have no conditions

              // Execute query
              let query = tx.select().from(table);
              if (conditions.length > 0) {
                // @ts-expect-error - dynamic where
                query = query.where(and(...conditions));
              }

              const rows = await query;

              // Process each row
              for (const row of rows) {
                let r = row as Record<string, unknown>;

                // Get row ID
                let rowId: string;
                if (r.id != null) {
                  rowId = String(r.id);
                } else {
                  const pkDefs = getConflictColumns(tableName, t);
                  const pkValues: Record<string, unknown> = {};
                  for (const pk of pkDefs) {
                    pkValues[pk.prop] = r[pk.prop];
                  }
                  rowId = JSON.stringify(pkValues);
                }

                // Apply normalization
                const normalizer = getNormalizer(tableName);
                if (normalizer) {
                  r = normalizer(r);
                }

                // Convert Postgres booleans to SQLite integers
                r = postgresToSqlite(tableName, r);

                responseChanges.push({
                  table: tableName as SyncableTableName,
                  rowId,
                  data: r,
                  deleted: !!r.deleted,
                  lastModifiedAt:
                    (r.lastModifiedAt as string) || new Date(0).toISOString(),
                });
              }
            }
          } else {
            // ==============================================================
            // INCREMENTAL SYNC: Query sync_outbox for changes
            // ==============================================================
            const outboxChanges = await tx
              .select()
              .from(schema.syncOutbox)
              .where(gt(schema.syncOutbox.changedAt, payload.lastSyncAt!));

            // Group changes by table for efficient batch fetching
            const changesByTable = new Map<
              string,
              Array<{ rowId: string; operation: string }>
            >();

            for (const entry of outboxChanges) {
              const tableName = entry.tableName;
              if (!changesByTable.has(tableName)) {
                changesByTable.set(tableName, []);
              }
              changesByTable.get(tableName)!.push({
                rowId: entry.rowId,
                operation: entry.operation,
              });
            }

            // Fetch actual rows for each changed table
            for (const [tableName, changes] of changesByTable) {
              const table =
                schema.tables[tableName as keyof typeof schema.tables];
              if (!table) continue;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const t = table as any;

              for (const change of changes) {
                if (change.operation === "DELETE") {
                  // For hard deletes, we need to send a deleted marker
                  // Parse the rowId to get key values
                  const pkDefs = getConflictColumns(tableName, t);
                  let data: Record<string, unknown>;

                  if (pkDefs.length === 1) {
                    data = { [pkDefs[0].prop]: change.rowId };
                  } else {
                    const parsed = parseOutboxRowId(tableName, change.rowId);
                    data =
                      typeof parsed === "string"
                        ? { [pkDefs[0].prop]: parsed }
                        : (parsed as Record<string, unknown>);
                  }

                  responseChanges.push({
                    table: tableName as SyncableTableName,
                    rowId: change.rowId,
                    data,
                    deleted: true,
                    lastModifiedAt: now,
                  });
                } else {
                  // INSERT or UPDATE - fetch the actual row
                  const pkCondition = buildPkCondition(
                    tableName,
                    change.rowId,
                    t
                  );

                  const rows = await tx
                    .select()
                    .from(table)
                    // @ts-expect-error - dynamic where
                    .where(pkCondition);

                  if (rows.length === 0) {
                    // Row was deleted after outbox entry - treat as delete
                    const pkDefs = getConflictColumns(tableName, t);
                    let data: Record<string, unknown>;

                    if (pkDefs.length === 1) {
                      data = { [pkDefs[0].prop]: change.rowId };
                    } else {
                      const parsed = parseOutboxRowId(tableName, change.rowId);
                      data =
                        typeof parsed === "string"
                          ? { [pkDefs[0].prop]: parsed }
                          : (parsed as Record<string, unknown>);
                    }

                    responseChanges.push({
                      table: tableName as SyncableTableName,
                      rowId: change.rowId,
                      data,
                      deleted: true,
                      lastModifiedAt: now,
                    });
                    continue;
                  }

                  let r = rows[0] as Record<string, unknown>;

                  // Check user access
                  if (
                    !userCanAccessRow(tableName, r, userId, userPlaylistIds)
                  ) {
                    continue; // Skip rows user doesn't have access to
                  }

                  // Apply normalization
                  const normalizer = getNormalizer(tableName);
                  if (normalizer) {
                    r = normalizer(r);
                  }

                  // Convert Postgres booleans to SQLite integers
                  r = postgresToSqlite(tableName, r);

                  responseChanges.push({
                    table: tableName as SyncableTableName,
                    rowId: change.rowId,
                    data: r,
                    deleted: !!r.deleted,
                    lastModifiedAt:
                      (r.lastModifiedAt as string) || new Date(0).toISOString(),
                  });
                }
              }
            }

            // Mark processed outbox entries as synced
            if (outboxChanges.length > 0) {
              const outboxIds = outboxChanges.map((e) => e.id);
              await tx
                .update(schema.syncOutbox)
                .set({ status: "synced", syncedAt: now })
                .where(inArray(schema.syncOutbox.id, outboxIds));
            }
          }
        });

        const response: SyncResponse = {
          changes: responseChanges,
          syncedAt: now,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
