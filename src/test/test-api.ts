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
    FROM tune_override tovr
    WHERE tovr.user_ref = ${userRef}
  `);
  return rows[0]?.count ?? 0;
}

/**
 * Get practice records for specific tunes
 */
async function getPracticeRecords(tuneIds: string[]) {
  const db = await ensureDb();
  if (!tuneIds || tuneIds.length === 0) return [];
  // Build an IN list (UUIDs) for test-only usage. UUIDs contain no quotes.
  const inList = tuneIds.map((id) => `'${id}'`).join(",");
  const rows = await db.all<{
    id: string;
    tune_ref: string;
    playlist_ref: string;
    practiced: string | null;
    due: string | null;
    quality: number | null;
    interval: number | null;
    repetitions: number | null;
    stability: number | null;
    difficulty: number | null;
    state: number | null;
    step: number | null;
    goal: string | null;
    technique: string | null;
    elapsed_days: number | null;
    lapses: number | null;
  }>(sql`
    SELECT 
      id, tune_ref, playlist_ref, practiced, due, quality, 
      interval, repetitions, stability, difficulty, state, step,
      goal, technique, elapsed_days, lapses
    FROM practice_record
    WHERE tune_ref IN (${sql.raw(inList)})
    ORDER BY id DESC
  `);
  return rows;
}

/**
 * Get latest practice record for a single tune
 */
async function getLatestPracticeRecord(tuneId: string, playlistId: string) {
  // Instrumentation to aid Playwright debugging (use console.log for visibility in headless)
  // eslint-disable-next-line no-console
  console.log(
    `[TestApi] getLatestPracticeRecord invoked tuneId=${tuneId} playlistId=${playlistId}`
  );
  if (!/^[0-9A-Za-z-]+$/.test(tuneId)) {
    throw new Error(`Invalid tuneId format: ${tuneId}`);
  }
  if (!/^[0-9A-Za-z-]+$/.test(playlistId)) {
    throw new Error(`Invalid playlistId format: ${playlistId}`);
  }
  const db = await ensureDb();
  const rows = await db.all<{
    id: string;
    tune_ref: string;
    playlist_ref: string;
    practiced: string | null;
    due: string | null;
    quality: number | null;
    interval: number | null;
    repetitions: number | null;
    stability: number | null;
    difficulty: number | null;
    state: number | null;
    step: number | null;
    goal: string | null;
    technique: string | null;
    elapsed_days: number | null;
    lapses: number | null;
    sync_version: number;
    last_modified_at: string;
  }>(sql`
    SELECT 
      id, tune_ref, playlist_ref, practiced, due, quality,
      interval, repetitions, stability, difficulty, state, step,
      goal, technique, elapsed_days, lapses, sync_version, last_modified_at
    FROM practice_record
    WHERE tune_ref = ${sql.raw(`'${tuneId}'`)}
      AND playlist_ref = ${sql.raw(`'${playlistId}'`)}
    ORDER BY
      CASE WHEN practiced IS NULL THEN 1 ELSE 0 END ASC,
      practiced DESC,
      last_modified_at DESC
    LIMIT 1
  `);
  // eslint-disable-next-line no-console
  console.log(`[TestApi] getLatestPracticeRecord committedRows=${rows.length}`);
  if (rows.length === 0) {
    // Additional diagnostic: count total rows for tune regardless of playlist to spot mismatch
    const diagRows = await db.all<{ c: number }>(sql`
      SELECT COUNT(*) as c FROM practice_record WHERE tune_ref = ${sql.raw(`'${tuneId}'`)}
    `);
    // eslint-disable-next-line no-console
    console.log(
      `[TestApi] getLatestPracticeRecord DIAG tuneIdRows=${diagRows[0]?.c ?? 0}`
    );
  }
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get scheduled dates for tunes in a playlist
 */
async function getScheduledDates(playlistId: string, tuneIds?: string[]) {
  const db = await ensureDb();
  const query = sql`
    SELECT tune_ref, scheduled, learned, current
    FROM playlist_tune
    WHERE playlist_ref = ${playlistId}
  `;

  if (tuneIds && tuneIds.length > 0) {
    const inList = tuneIds.map((id) => `'${id}'`).join(",");
    const rows = await db.all<{
      tune_ref: string;
      scheduled: string | null;
      learned: string | null;
      current: string | null;
    }>(sql`
      SELECT tune_ref, scheduled, learned, current
      FROM playlist_tune
      WHERE playlist_ref = ${playlistId}
        AND tune_ref IN (${sql.raw(inList)})
    `);
    const result: Record<
      string,
      {
        tune_ref: string;
        scheduled: string | null;
        learned: string | null;
        current: string | null;
      }
    > = {};
    for (const row of rows) {
      result[row.tune_ref] = row;
    }
    return result;
  }

  const rows = await db.all<{
    tune_ref: string;
    scheduled: string | null;
    learned: string | null;
    current: string | null;
  }>(query);

  const result: Record<
    string,
    {
      tune_ref: string;
      scheduled: string | null;
      learned: string | null;
      current: string | null;
    }
  > = {};
  for (const row of rows) {
    result[row.tune_ref] = row;
  }
  return result;
}

/**
 * Get practice queue for a specific window
 */
async function getPracticeQueue(playlistId: string, windowStartUtc?: string) {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);

  let query: any;
  if (windowStartUtc) {
    query = sql`
      SELECT id, tune_ref, bucket, order_index, window_start_utc, 
             window_end_utc, completed_at, snapshot_coalesced_ts
      FROM daily_practice_queue
      WHERE user_ref = ${userRef}
        AND playlist_ref = ${playlistId}
        AND window_start_utc = ${windowStartUtc}
        AND active = 1
      ORDER BY bucket ASC, order_index ASC
    `;
  } else {
    query = sql`
      SELECT id, tune_ref, bucket, order_index, window_start_utc,
             window_end_utc, completed_at, snapshot_coalesced_ts
      FROM daily_practice_queue
      WHERE user_ref = ${userRef}
        AND playlist_ref = ${playlistId}
        AND active = 1
        AND window_start_utc = (
          SELECT MAX(window_start_utc)
          FROM daily_practice_queue
          WHERE user_ref = ${userRef} AND playlist_ref = ${playlistId} AND active = 1
        )
      ORDER BY bucket ASC, order_index ASC
    `;
  }

  const rows = await db.all<{
    id: string;
    tune_ref: string;
    bucket: number;
    order_index: number;
    window_start_utc: string;
    window_end_utc: string;
    completed_at: string | null;
    snapshot_coalesced_ts: string | null;
  }>(query);

  return rows;
}

/**
 * Get single playlist_tune row (for consistency checks with practice_record)
 */
async function getPlaylistTuneRow(playlistId: string, tuneId: string) {
  const db = await ensureDb();
  const rows = await db.all<{
    playlist_ref: string;
    tune_ref: string;
    scheduled: string | null;
    current: string | null;
    learned: string | null;
    sync_version: number;
    last_modified_at: string;
  }>(sql`
    SELECT playlist_ref, tune_ref, scheduled, current, learned, sync_version, last_modified_at
    FROM playlist_tune
    WHERE playlist_ref = ${playlistId} AND tune_ref = ${tuneId} AND deleted = 0
    LIMIT 1
  `);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Count distinct practice_record rows per playlist/tune (duplicate guard)
 */
async function getDistinctPracticeRecordCount(
  playlistId: string,
  tuneId: string
) {
  const db = await ensureDb();
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM practice_record
    WHERE playlist_ref = ${playlistId} AND tune_ref = ${tuneId}
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
      // Staging & committing helpers
      stageEvaluation: (
        tuneId: string,
        playlistId: string,
        evaluation: string,
        goal?: string,
        technique?: string
      ) => Promise<{
        quality: number;
        easiness: number | null;
        difficulty: number | null;
        stability: number | null;
        interval: number;
        step: number | null;
        repetitions: number;
        practiced: string;
        due: string;
        state: number;
        goal: string;
        technique: string;
      }>;
      commitStaged: (
        playlistId: string,
        windowStartUtc?: string
      ) => Promise<{ success: boolean; count: number; error?: string }>;
      getPracticeListStaged: (
        playlistId: string,
        tuneIds?: string[]
      ) => Promise<
        Array<{
          id: string;
          playlist_ref: string;
          tune_ref: string;
          latest_due: string | null;
          latest_interval: number | null;
          latest_quality: number | null;
          latest_state: number | null;
          has_staged: number; // 1/0
        }>
      >;
      getQueueWindows: (playlistId: string) => Promise<string[]>;
      // New query functions for scheduling tests
      getPracticeRecords: (tuneIds: string[]) => Promise<
        Array<{
          id: string;
          tune_ref: string;
          playlist_ref: string;
          practiced: string | null;
          due: string | null;
          quality: number | null;
          interval: number | null;
          repetitions: number | null;
          stability: number | null;
          difficulty: number | null;
          state: number | null;
          step: number | null;
          goal: string | null;
          technique: string | null;
          elapsed_days: number | null;
          lapses: number | null;
        }>
      >;
      getLatestPracticeRecord: (
        tuneId: string,
        playlistId: string
      ) => Promise<{
        id: string;
        tune_ref: string;
        playlist_ref: string;
        practiced: string | null;
        due: string | null;
        quality: number | null;
        interval: number | null;
        repetitions: number | null;
        stability: number | null;
        difficulty: number | null;
        state: number | null;
        step: number | null;
        goal: string | null;
        technique: string | null;
        elapsed_days: number | null;
        lapses: number | null;
        sync_version: number;
        last_modified_at: string;
      } | null>;
      getScheduledDates: (
        playlistId: string,
        tuneIds?: string[]
      ) => Promise<
        Record<
          string,
          {
            tune_ref: string;
            scheduled: string | null;
            learned: string | null;
            current: string | null;
          }
        >
      >;
      getPracticeQueue: (
        playlistId: string,
        windowStartUtc?: string
      ) => Promise<
        Array<{
          id: string;
          tune_ref: string;
          bucket: number;
          order_index: number;
          window_start_utc: string;
          window_end_utc: string;
          completed_at: string | null;
          snapshot_coalesced_ts: string | null;
        }>
      >;
      getPlaylistTuneRow: (
        playlistId: string,
        tuneId: string
      ) => Promise<{
        playlist_ref: string;
        tune_ref: string;
        scheduled: string | null;
        current: string | null;
        learned: string | null;
        sync_version: number;
        last_modified_at: string;
      } | null>;
      getDistinctPracticeRecordCount: (
        playlistId: string,
        tuneId: string
      ) => Promise<number>;
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
      getPracticeRecords,
      getLatestPracticeRecord,
      getScheduledDates,
      getPracticeQueue,
      getPlaylistTuneRow,
      getDistinctPracticeRecordCount,
      stageEvaluation: async (
        tuneId: string,
        playlistId: string,
        evaluation: string,
        goal?: string,
        technique?: string
      ) => {
        const { stagePracticeEvaluation } = await import(
          "@/lib/services/practice-staging"
        );
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        return await stagePracticeEvaluation(
          db,
          userRef,
          playlistId,
          tuneId,
          evaluation,
          goal,
          technique
        );
      },
      commitStaged: async (playlistId: string, windowStartUtc?: string) => {
        const { commitStagedEvaluations } = await import(
          "@/lib/services/practice-recording"
        );
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        return await commitStagedEvaluations(
          db,
          userRef,
          playlistId,
          windowStartUtc
        );
      },
      getPracticeListStaged: async (playlistId: string, tuneIds?: string[]) => {
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        let rows: Array<{
          id: string;
          playlist_ref: string;
          tune_ref: string;
          latest_due: string | null;
          latest_interval: number | null;
          latest_quality: number | null;
          latest_state: number | null;
          has_staged: number;
        }>;
        if (tuneIds && tuneIds.length > 0) {
          const inList = tuneIds.map((id) => `'${id}'`).join(",");
          rows = await db.all<{
            id: string;
            playlist_ref: string;
            tune_ref: string;
            latest_due: string | null;
            latest_interval: number | null;
            latest_quality: number | null;
            latest_state: number | null;
            has_staged: number;
          }>(sql`
            SELECT
              tune.id as id,
              playlist.playlist_id as playlist_ref,
              tune.id as tune_ref,
              COALESCE(td.due, pr.due) AS latest_due,
              COALESCE(td.interval, pr.interval) AS latest_interval,
              COALESCE(td.quality, pr.quality) AS latest_quality,
              COALESCE(td.state, pr.state) AS latest_state,
              CASE WHEN td.practiced IS NOT NULL OR td.due IS NOT NULL THEN 1 ELSE 0 END AS has_staged
            FROM tune
            LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
            LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
            LEFT JOIN (
              SELECT pr.* FROM practice_record pr
              INNER JOIN (
                SELECT tune_ref, playlist_ref, MAX(id) as max_id
                FROM practice_record
                GROUP BY tune_ref, playlist_ref
              ) latest ON pr.tune_ref = latest.tune_ref
                AND pr.playlist_ref = latest.playlist_ref
                AND pr.id = latest.max_id
            ) pr ON pr.tune_ref = tune.id AND pr.playlist_ref = playlist_tune.playlist_ref
            LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.playlist_id = playlist_tune.playlist_ref
            WHERE playlist.playlist_id = ${playlistId} AND playlist.user_ref = ${userRef} AND tune.id IN (${sql.raw(inList)})
          `);
        } else {
          rows = await db.all<{
            id: string;
            playlist_ref: string;
            tune_ref: string;
            latest_due: string | null;
            latest_interval: number | null;
            latest_quality: number | null;
            latest_state: number | null;
            has_staged: number;
          }>(sql`
            SELECT
              tune.id as id,
              playlist.playlist_id as playlist_ref,
              tune.id as tune_ref,
              COALESCE(td.due, pr.due) AS latest_due,
              COALESCE(td.interval, pr.interval) AS latest_interval,
              COALESCE(td.quality, pr.quality) AS latest_quality,
              COALESCE(td.state, pr.state) AS latest_state,
              CASE WHEN td.practiced IS NOT NULL OR td.due IS NOT NULL THEN 1 ELSE 0 END AS has_staged
            FROM tune
            LEFT JOIN playlist_tune ON playlist_tune.tune_ref = tune.id
            LEFT JOIN playlist ON playlist.playlist_id = playlist_tune.playlist_ref
            LEFT JOIN (
              SELECT pr.* FROM practice_record pr
              INNER JOIN (
                SELECT tune_ref, playlist_ref, MAX(id) as max_id
                FROM practice_record
                GROUP BY tune_ref, playlist_ref
              ) latest ON pr.tune_ref = latest.tune_ref
                AND pr.playlist_ref = latest.playlist_ref
                AND pr.id = latest.max_id
            ) pr ON pr.tune_ref = tune.id AND pr.playlist_ref = playlist_tune.playlist_ref
            LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.playlist_id = playlist_tune.playlist_ref
            WHERE playlist.playlist_id = ${playlistId} AND playlist.user_ref = ${userRef}
          `);
        }
        return rows;
      },
      getQueueWindows: async (playlistId: string) => {
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        const rows = await db.all<{ window_start_utc: string }>(sql`
          SELECT DISTINCT window_start_utc
          FROM daily_practice_queue
          WHERE user_ref = ${userRef} AND playlist_ref = ${playlistId}
          ORDER BY window_start_utc DESC
        `);
        return rows.map((r) => r.window_start_utc);
      },
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
