/**
 * Test API (browser-exposed) for fast, deterministic E2E setup
 *
 * Provides helpers to seed local SQLite (sql.js) directly during Playwright tests,
 * bypassing slow remote DB resets. Attached as window.__ttTestApi.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import {
  clearDb,
  getDb,
  initializeDb,
  type SqliteDatabase,
} from "@/lib/db/client-sqlite";
import {
  dailyPracticeQueue,
  playlistTune,
  practiceRecord,
  tuneOverride,
} from "@/lib/db/schema";
import { generateOrGetPracticeQueue } from "@/lib/services/practice-queue";
import { supabase } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/uuid";

type SeedAddToReviewInput = {
  playlistId: string; // UUID
  tuneIds: string[]; // UUIDs
  // Optional explicit user id (user_profile.id UUID). If omitted, we will
  // resolve from current Supabase session via user_profile lookup.
  userId?: string;
};

async function ensureDb(): Promise<SqliteDatabase> {
  try {
    return getDb();
  } catch {
    return await initializeDb();
  }
}

async function resolveUserId(db: SqliteDatabase): Promise<string> {
  // Try to fetch current auth user from Supabase and map to user_profile.id
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("No authenticated user in test session");

  const result = await db.all<{ id: string }>(
    sql`SELECT id FROM user_profile WHERE supabase_user_id = ${userId} LIMIT 1`
  );
  const id = result[0]?.id;
  if (!id) throw new Error("user_profile row not found for current user");
  return id;
}

async function seedAddToReview(input: SeedAddToReviewInput) {
  const db = await ensureDb();
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);

  const userRef = input.userId ?? (await resolveUserId(db));

  // 1) Update playlist_tune.scheduled for provided tuneIds
  let updated = 0;
  for (const tuneId of input.tuneIds) {
    const res = await db
      .update(playlistTune)
      .set({
        scheduled: now,
        syncVersion: sql.raw(`${playlistTune.syncVersion} + 1`),
        lastModifiedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(playlistTune.playlistRef, input.playlistId),
          eq(playlistTune.tuneRef, tuneId),
          eq(playlistTune.deleted, 0)
        )
      )
      .returning();
    if (res && res.length > 0) updated++;
  }

  // 2) Ensure practice_record exists for each tune
  for (const tuneId of input.tuneIds) {
    const existing = await db
      .select()
      .from(practiceRecord)
      .where(
        and(
          eq(practiceRecord.playlistRef, input.playlistId),
          eq(practiceRecord.tuneRef, tuneId)
        )
      )
      .limit(1);

    if (!existing || existing.length === 0) {
      await db
        .insert(practiceRecord)
        .values({
          id: generateId(),
          playlistRef: input.playlistId,
          tuneRef: tuneId,
          practiced: null,
          quality: null,
          easiness: null,
          difficulty: 0,
          stability: null,
          interval: null,
          step: null,
          repetitions: 0,
          lapses: 0,
          elapsedDays: 0,
          state: 0,
          due: null,
          backupPracticed: null,
          goal: "recall",
          technique: null,
          syncVersion: 1,
          lastModifiedAt: new Date().toISOString(),
          deviceId: "local",
        })
        .run();
    }
  }

  // 3) Clear existing queue snapshot for the most recent window (or today)
  const latestWindow = await db
    .select({ windowStart: dailyPracticeQueue.windowStartUtc })
    .from(dailyPracticeQueue)
    .where(
      and(
        eq(dailyPracticeQueue.userRef, userRef),
        eq(dailyPracticeQueue.playlistRef, input.playlistId),
        eq(dailyPracticeQueue.active, 1)
      )
    )
    .orderBy(desc(dailyPracticeQueue.windowStartUtc))
    .limit(1);

  if (latestWindow.length > 0) {
    await db
      .delete(dailyPracticeQueue)
      .where(
        and(
          eq(dailyPracticeQueue.userRef, userRef),
          eq(dailyPracticeQueue.playlistRef, input.playlistId),
          eq(dailyPracticeQueue.windowStartUtc, latestWindow[0].windowStart)
        )
      )
      .run();
  }

  // 4) Force-regenerate queue so Practice picks up the latest changes
  const regenerated = await generateOrGetPracticeQueue(
    db,
    userRef,
    input.playlistId,
    new Date(),
    null,
    "per_day",
    true
  );

  // Return a compact summary
  return {
    updated,
    queueCount: regenerated.length,
    userRef,
  };
}

async function getPracticeCount(playlistId: string) {
  const db = await ensureDb();
  // Resolve userId
  const userRef = await resolveUserId(db);
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM daily_practice_queue dpq
    WHERE dpq.user_ref = ${userRef}
      AND dpq.playlist_ref = ${playlistId}
      AND dpq.active = 1
      AND dpq.window_start_utc = (
        SELECT MAX(window_start_utc)
        FROM daily_practice_queue
        WHERE user_ref = ${userRef} AND playlist_ref = ${playlistId} AND active = 1
      )
  `);
  return rows[0]?.count ?? 0;
}

async function getTuneOverrideCountForCurrentUser() {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);
  // Prefer SQL to avoid ORM differences across builds
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM ${tuneOverride} tovr
    WHERE tovr.user_ref = ${userRef}
  `);
  return rows[0]?.count ?? 0;
}

// Attach to window
declare global {
  interface Window {
    __ttTestApi?: {
      seedAddToReview: (input: SeedAddToReviewInput) => Promise<{
        updated: number;
        queueCount: number;
        userRef: string; // UUID
      }>;
      getPracticeCount: (playlistId: string) => Promise<number>; // UUID
      getTuneOverrideCountForCurrentUser: () => Promise<number>;
      getSyncVersion: () => number;
      isInitialSyncComplete: () => boolean;
      dispose: () => Promise<void>;
    };
  }
}

if (typeof window !== "undefined") {
  // Idempotent attach
  if (!window.__ttTestApi) {
    window.__ttTestApi = {
      seedAddToReview,
      getPracticeCount,
      getTuneOverrideCountForCurrentUser,
      getSyncVersion: () => {
        // Access the sync version from AuthContext
        // The version starts at 0 and increments to 1 after initial sync
        const el = document.querySelector("[data-auth-initialized]");
        const version = el?.getAttribute("data-sync-version");
        return version ? Number.parseInt(version, 10) : 0;
      },
      isInitialSyncComplete: () => {
        // Initial sync is complete when syncVersion >= 1
        const el = document.querySelector("[data-auth-initialized]");
        const version = el?.getAttribute("data-sync-version");
        return version ? Number.parseInt(version, 10) >= 1 : false;
      },
      dispose: async () => {
        try {
          await clearDb();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[TestApi] dispose clearDb error:", e);
        }
      },
    };
    // eslint-disable-next-line no-console
    console.log("[TestApi] __ttTestApi attached to window");
  }
}
