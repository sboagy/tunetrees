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
import { and, eq, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { jwtVerify } from "jose";
import postgres from "postgres";
import { COL, TBL } from "../../shared/db-constants";
import type {
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "../../shared/sync-types";
import * as schema from "./schema-postgres";

export interface Env {
  HYPERDRIVE: Hyperdrive;
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
    case TBL.TUNE_OVERRIDE:
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
  } catch {
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
      const userId = await verifyAuth(request, env.SUPABASE_JWT_SECRET);
      if (!userId) {
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const client = postgres(env.HYPERDRIVE.connectionString);
        const db = drizzle(client, { schema });
        const payload = (await request.json()) as SyncRequest;
        const responseChanges: SyncChange[] = [];
        const now = new Date().toISOString();

        // Transaction "Sandwich"
        await db.transaction(async (tx) => {
          // 1. PUSH: Apply client changes
          for (const change of payload.changes) {
            const table = schema.tables[change.table];
            if (!table) continue;

            // Cast to any for dynamic access
            const t = table as any;
            if (!t.lastModifiedAt) continue;

            // Security: Ensure user can only touch their own data
            // TODO: Enforce userId check against token.

            const pkDefs = getConflictTarget(change.table, t);

            if (change.deleted) {
              // Soft Delete
              const whereConditions = pkDefs.map((pk) => {
                return eq(pk.col, change.data[pk.prop]);
              });

              await tx
                .update(table)
                .set({
                  [COL.DELETED]: true,
                  [COL.LAST_MODIFIED_AT]: change.lastModifiedAt,
                })
                .where(and(...whereConditions));
            } else {
              // Upsert
              const targetCols = pkDefs.map((pk) => pk.col);

              await tx
                .insert(table)
                .values(change.data)
                .onConflictDoUpdate({
                  target: targetCols,
                  set: change.data,
                  // Only update if client is newer
                  where: lt(t.lastModifiedAt, change.lastModifiedAt),
                });
            }
          }

          // 2. PULL: Fetch server changes
          // Iterate all tables
          for (const [tableName, table] of Object.entries(schema.tables)) {
            // Skip internal sync tables
            if (tableName === TBL.SYNC_QUEUE || tableName === TBL.SYNC_OUTBOX)
              continue;

            // Cast to any to access properties dynamically
            const t = table as any;

            // Check if table has lastModifiedAt (required for sync)
            if (!t.lastModifiedAt) continue;

            let query = tx.select().from(table);

            const conditions = [];
            if (payload.lastSyncAt) {
              conditions.push(gt(t.lastModifiedAt, payload.lastSyncAt));
            }

            // Filter by user
            if (t.userId) {
              conditions.push(eq(t.userId, userId));
            } else if (t.userRef) {
              conditions.push(eq(t.userRef, userId));
            } else if (t.privateFor) {
              conditions.push(eq(t.privateFor, userId));
            } else if (t.privateToUser) {
              // instrument table
              conditions.push(eq(t.privateToUser, userId));
            }

            if (conditions.length > 0) {
              // @ts-expect-error - dynamic where is hard to type across union of tables
              query = query.where(and(...conditions));
            }

            const rows = await query;

            for (const row of rows) {
              const r = row as any;

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
                lastModifiedAt: r.lastModifiedAt,
              });
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
