/**
 * Cloudflare Worker Sync Endpoint
 *
 * This worker handles the "Serverless Sync" logic for TuneTrees.
 * It acts as the central synchronization authority, mediating between
 * the client's local SQLite database and the central Supabase PostgreSQL database.
 *
 * Core Responsibilities:
 * 1. Authentication: Verifies Supabase JWTs using `jose`.
 * 2. Push: Receives batches of changes from clients and applies them to Postgres
 *    using a "Last Write Wins" strategy with soft-delete support.
 * 3. Pull: Returns all records modified since the client's last sync timestamp.
 * 4. Conflict Resolution: Handles composite primary keys and ensures data integrity.
 */
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { jwtVerify } from "jose";
import postgres from "postgres";
import { COL, TBL } from "../../shared/db-constants";
import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "../../shared/sync-types";
import { hasDeletedFlag } from "../../shared/table-meta";
import * as schema from "./schema-postgres";

export interface Env {
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
}

// Helper to get PK columns for conflict resolution
function getConflictTarget(
  tableName: string,
  table: any
): { col: any; prop: string }[] {
  switch (tableName) {
    case TBL.TABLE_STATE:
      return [
        { col: table.userId, prop: "userId" },
        { col: table.screenSize, prop: "screenSize" },
        { col: table.purpose, prop: "purpose" },
        { col: table.playlistId, prop: "playlistId" },
      ];
    case TBL.TABLE_TRANSIENT_DATA:
      return [
        { col: table.userId, prop: "userId" },
        { col: table.tuneId, prop: "tuneId" },
        { col: table.playlistId, prop: "playlistId" },
      ];
    case TBL.GENRE_TUNE_TYPE:
      return [
        { col: table.genreId, prop: "genreId" },
        { col: table.tuneTypeId, prop: "tuneTypeId" },
      ];
    case TBL.PLAYLIST_TUNE:
      return [
        { col: table.playlistRef, prop: "playlistRef" },
        { col: table.tuneRef, prop: "tuneRef" },
      ];
    case TBL.PREFS_SPACED_REPETITION:
      return [
        { col: table.userId, prop: "userId" },
        { col: table.algType, prop: "algType" },
      ];
    case TBL.PLAYLIST:
      return [{ col: table.playlistId, prop: "playlistId" }];
    case TBL.USER_PROFILE:
      return [{ col: table.supabaseUserId, prop: "supabaseUserId" }];
    case TBL.PREFS_SCHEDULING_OPTIONS:
      return [{ col: table.userId, prop: "userId" }];
    case TBL.TAG:
      return [{ col: table.id, prop: "id" }];
    default:
      return [{ col: table.id, prop: "id" }];
  }
}

async function verifyAuth(request: Request, secret: string) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return payload.sub; // User ID
  } catch (e) {
    console.error("JWT Verification failed:", e);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health Check
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Sync Endpoint
    if (request.method === "POST" && url.pathname === "/api/sync") {
      console.log("Sync request received");
      const userId = await verifyAuth(request, env.SUPABASE_JWT_SECRET);
      if (!userId) {
        console.log("Auth failed");
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      }
      console.log("Auth verified for user:", userId);

      try {
        const connectionString =
          env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
        if (!connectionString) {
          return new Response("Database configuration error", {
            status: 500,
            headers: corsHeaders,
          });
        }
        console.log("Connecting to DB...");
        const client = postgres(connectionString);
        const db = drizzle(client, { schema });
        console.log("DB client created");

        const payload = (await request.json()) as SyncRequest;
        const responseChanges: SyncChange[] = [];
        const now = new Date().toISOString();
        const debugLogs: string[] = [];

        console.log("Starting transaction...");
        // Transaction "Sandwich"
        await db.transaction(async (tx) => {
          console.log("Inside transaction");
          // 1. PUSH: Apply client changes
          for (const change of payload.changes) {
            const table = schema.tables[change.table];
            if (!table) continue;

            // Cast to any for dynamic access
            const t = table as any;
            if (!t.lastModifiedAt) continue;

            // DEBUG: Log daily_practice_queue pushes with key fields only
            if (change.table === TBL.DAILY_PRACTICE_QUEUE) {
              console.log(
                `[Worker] 🔍 PUSH daily_practice_queue:`,
                JSON.stringify(
                  {
                    table: change.table,
                    op: change.deleted ? "delete" : "upsert",
                    windowStartUtc:
                      (change.data as any)?.window_start_utc ??
                      (change.data as any)?.windowStartUtc,
                    active: (change.data as any)?.active,
                    lastModifiedAt:
                      (change.data as any)?.last_modified_at ??
                      (change.data as any)?.lastModifiedAt,
                  },
                  null,
                  2
                )
              );
            }

            // Security: Ensure user can only touch their own data
            // TODO: Enforce userId check against token.

            const pkDefs = getConflictTarget(change.table, t);

            if (change.deleted) {
              const whereConditions = pkDefs.map((pk) => {
                return eq(pk.col, change.data[pk.prop]);
              });

              const softDeletable = hasDeletedFlag(change.table);

              // ======= DEBUG =======
              const wherePkValues = pkDefs.reduce<Record<string, unknown>>(
                (acc, pk) => {
                  acc[pk.prop] = change.data[pk.prop];
                  return acc;
                },
                {}
              );
              console.log(
                `[Worker] 🔍 PUSH - doing ${softDeletable ? "Soft" : "Hard"} Delete on ${change.table}, WHERE ${JSON.stringify(
                  wherePkValues
                )}`
              );
              // ======= END DEBUG =======

              if (softDeletable) {
                await tx
                  .update(table)
                  .set({
                    [COL.DELETED]: true,
                    [COL.LAST_MODIFIED_AT]: change.lastModifiedAt,
                  })
                  .where(and(...whereConditions));
              } else {
                await tx.delete(table).where(and(...whereConditions));
              }
              console.log("[Worker] 🔍 PUSH - back from Delete");
            } else {
              console.log("[Worker] 🔍 PUSH - doing Upsert");
              // Upsert
              const targetCols = pkDefs.map((pk) => pk.col);

              // ======= DEBUG =======
              const wherePkValues = pkDefs.reduce<Record<string, unknown>>(
                (acc, pk) => {
                  acc[pk.prop] = change.data[pk.prop];
                  return acc;
                },
                {}
              );
              console.log(
                `[Worker] 🔍 PUSH - doing doing Upsert on ${change.table}, change.data: ${JSON.stringify(
                  wherePkValues
                )}, targetCols: ${targetCols}`
              );
              console.log(
                `.    ...(upsert) ${change.table}, t.lastModifiedAt: ${t.lastModifiedAt}, , change.lastModifiedAt: ${change.lastModifiedAt}`
              );
              // ======= END DEBUG =======

              await tx.insert(table).values(change.data).onConflictDoUpdate({
                target: targetCols,
                set: change.data,
                // NOTE: We intentionally omit conditional updates here.
                // Drizzle's onConflictDoUpdate setWhere was generating invalid
                // SQL ("syntax error at or near \"where\"") in the worker
                // environment, which broke daily_practice_queue upserts and
                // caused active windows to be marked inactive. Last-write-wins
                // semantics are acceptable for now, so we disable setWhere
                // until we can safely re-introduce versioned conflict checks.
                // setWhere: lt(t.lastModifiedAt, change.lastModifiedAt),
              });
              console.log("[Worker] 🔍 PUSH - back from Upsert");
            }
          }

          // 2. PULL: Fetch server changes
          // Iterate all tables
          console.log("[Worker] 🔍 PULL: Fetch server changes");
          for (const [tableName, table] of Object.entries(schema.tables)) {
            try {
              // Skip internal sync tables
              if (tableName === TBL.SYNC_QUEUE || tableName === TBL.SYNC_OUTBOX)
                continue;

              console.log(`[Worker] 🔍 PULL: considering ${tableName}`);

              // Cast to any to access properties dynamically
              const t = table as any;

              // Check if table has lastModifiedAt (required for sync)
              // Exception: Static reference tables (genre, tune_type)
              const isStaticTable =
                tableName === TBL.GENRE ||
                tableName === TBL.TUNE_TYPE ||
                tableName === TBL.GENRE_TUNE_TYPE;

              if (!t.lastModifiedAt && !isStaticTable) continue;

              let query = tx.select().from(table);

              const conditions = [];
              if (payload.lastSyncAt && !isStaticTable) {
                conditions.push(gt(t.lastModifiedAt, payload.lastSyncAt));
              }

              // Filter by user
              if (t.userId) {
                conditions.push(eq(t.userId, userId));
              } else if (t.userRef) {
                conditions.push(eq(t.userRef, userId));
              } else if (t.privateFor) {
                // tune table: public (null) OR private to user
                conditions.push(
                  or(isNull(t.privateFor), eq(t.privateFor, userId))
                );
              } else if (t.privateToUser) {
                // instrument table: public (null) OR private to user
                conditions.push(
                  or(isNull(t.privateToUser), eq(t.privateToUser, userId))
                );
              } else if (
                tableName === TBL.PLAYLIST_TUNE ||
                tableName === TBL.PRACTICE_RECORD ||
                tableName === TBL.DAILY_PRACTICE_QUEUE
              ) {
                // Junction/dependent tables: filter by playlistRef → playlist.userRef
                // Use a subquery to get user's playlist IDs
                const userPlaylistIds = tx
                  .select({ id: schema.playlist.playlistId })
                  .from(schema.playlist)
                  .where(eq(schema.playlist.userRef, userId));
                conditions.push(inArray(t.playlistRef, userPlaylistIds));
              }

              if (conditions.length > 0) {
                // @ts-expect-error - dynamic where is hard to type across union of tables
                query = query.where(and(...conditions));
              }

              if (tableName === TBL.TUNE) {
                debugLogs.push(
                  `[Worker] Tune table conditions count: ${conditions.length}`
                );
                debugLogs.push(
                  `[Worker] Tune table privateFor check: ${t.privateFor ? "Present" : "Missing"}`
                );
              }

              const rows = await query;

              // DEBUG: Log daily_practice_queue pulls
              if (tableName === TBL.DAILY_PRACTICE_QUEUE) {
                console.log(
                  `[Worker] 🔍 PULL daily_practice_queue: ${rows.length} rows`,
                  JSON.stringify(
                    rows.slice(0, 10).map((r) => ({
                      windowStartUtc:
                        (r as any).window_start_utc ??
                        (r as any).windowStartUtc,
                      active: (r as any).active,
                      lastModifiedAt:
                        (r as any).last_modified_at ??
                        (r as any).lastModifiedAt,
                    })),
                    null,
                    2
                  )
                );
              }

              if (tableName === TBL.TUNE) {
                debugLogs.push(`[Worker] Tune table rows: ${rows.length}`);
                if (rows.length > 0) {
                  debugLogs.push(
                    `[Worker] First tune row keys: ${Object.keys(rows[0]).join(", ")}`
                  );
                }
              }
              console.log(
                `[Worker] Table ${tableName}: Found ${rows.length} rows. Conditions: ${conditions.length}`
              );
              if (rows.length > 0) {
                console.log(
                  `[Worker] Table ${tableName} sample:`,
                  JSON.stringify(rows[0])
                );
              }

              for (const row of rows) {
                const r = row as any;

                if (
                  tableName === TBL.TUNE &&
                  responseChanges.filter((c) => c.table === TBL.TUNE).length ===
                    0
                ) {
                  debugLogs.push(
                    `[Worker] Processing first tune row. ID: ${r.id}`
                  );
                }

                let rowId = r.id;
                if (!rowId) {
                  // Composite PK handling
                  const pkDefs = getConflictTarget(tableName, t);
                  const pkValues: Record<string, any> = {};
                  pkDefs.forEach((pk) => {
                    pkValues[pk.prop] = r[pk.prop];
                  });
                  rowId = JSON.stringify(pkValues);
                }

                responseChanges.push({
                  table: tableName as any,
                  rowId: rowId,
                  data: r,
                  deleted: !!r.deleted,
                  lastModifiedAt: r.lastModifiedAt || new Date(0).toISOString(),
                });
              }
            } catch (e) {
              throw new Error(`Error processing table ${tableName}: ${e}`);
            }
          }
        });

        const response: SyncResponse & { debug?: string[] } = {
          changes: responseChanges,
          syncedAt: now,
          debug: debugLogs,
        };

        const tuneCount = responseChanges.filter(
          (c) => c.table === TBL.TUNE
        ).length;
        debugLogs.push(`[Worker] Final response tune count: ${tuneCount}`);

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
