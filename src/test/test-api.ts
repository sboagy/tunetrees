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
  getSqliteInstance,
  initializeDb,
  type SqliteDatabase,
} from "@/lib/db/client-sqlite";
import {
  dailyPracticeQueue,
  note,
  plugin,
  practiceRecord,
  reference,
  repertoireTune,
} from "@/lib/db/schema";
import { serializeCapabilities } from "@/lib/plugins/capabilities";
import { generateOrGetPracticeQueue } from "@/lib/services/practice-queue";
import { supabase } from "@/lib/supabase/client";
import { generateId } from "@/lib/utils/uuid";

type SeedAddToReviewInput = {
  repertoireId: string; // UUID
  tuneIds: string[]; // UUIDs
  // Optional explicit user id (Supabase Auth UUID). If omitted, we will
  // resolve from current Supabase session via user_profile lookup.
  userId?: string;
};

type SeedSchedulingPluginInput = {
  script?: string;
  goals?: string[];
  userId?: string;
  name?: string;
  description?: string | null;
  enabled?: boolean;
  isPublic?: boolean;
};

const DEFAULT_SCHEDULING_PLUGIN_SCRIPT = `function createScheduler() {
  function apply(payload) {
    const practiced = new Date(payload.input.practiced);
    const nextDue = new Date(practiced);
    nextDue.setDate(nextDue.getDate() + 1);

    return {
      ...payload.fallback,
      lastReview: payload.input.practiced,
      nextDue: nextDue.toISOString(),
      interval: 1,
      scheduledDays: 1,
    };
  }

  return {
    async processFirstReview(payload) {
      return apply(payload);
    },
    async processReview(payload) {
      return apply(payload);
    },
  };
}`;

/**
 * Injected test user ID - set via window.__ttTestUserId to bypass Supabase auth lookup.
 * This allows tests to run without requiring a valid Supabase session.
 */
declare global {
  interface Window {
    __ttTestUserId?: string;
  }
}

async function ensureDb(): Promise<SqliteDatabase> {
  try {
    return getDb();
  } catch {
    // Use a test user ID for initialization
    return await initializeDb("test-user-id");
  }
}

async function resolveUserId(_db: SqliteDatabase): Promise<string> {
  // First check for injected test user ID (bypasses Supabase entirely)
  if (typeof window !== "undefined" && window.__ttTestUserId) {
    console.log(
      `[TestApi] Using injected test user ID: ${window.__ttTestUserId}`
    );
    return window.__ttTestUserId;
  }

  // After eliminating user_profile.id, just return the Supabase Auth UUID
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("No authenticated user in test session");
  return userId;
}

async function seedAddToReview(input: SeedAddToReviewInput) {
  const db = await ensureDb();
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  const repertoireId = input.repertoireId;

  if (!repertoireId) {
    throw new Error("seedAddToReview requires repertoireId");
  }

  const userRef = input.userId ?? (await resolveUserId(db));

  // 1) Update repertoire_tune.scheduled for provided tuneIds
  let updated = 0;
  for (const tuneId of input.tuneIds) {
    const res = await db
      .update(repertoireTune)
      .set({
        scheduled: now,
        syncVersion: sql.raw(`${repertoireTune.syncVersion} + 1`),
        lastModifiedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(repertoireTune.repertoireRef, repertoireId),
          eq(repertoireTune.tuneRef, tuneId),
          eq(repertoireTune.deleted, 0)
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
          eq(practiceRecord.repertoireRef, repertoireId),
          eq(practiceRecord.tuneRef, tuneId)
        )
      )
      .limit(1);

    if (!existing || existing.length === 0) {
      await db
        .insert(practiceRecord)
        .values({
          id: generateId(),
          repertoireRef: repertoireId,
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
        eq(dailyPracticeQueue.repertoireRef, repertoireId),
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
          eq(dailyPracticeQueue.repertoireRef, repertoireId),
          eq(dailyPracticeQueue.windowStartUtc, latestWindow[0].windowStart)
        )
      )
      .run();
  }

  // 4) Force-regenerate queue so Practice picks up the latest changes
  const regenerated = await generateOrGetPracticeQueue(
    db,
    userRef,
    repertoireId,
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

async function seedSchedulingPlugin(input: SeedSchedulingPluginInput = {}) {
  const db = await ensureDb();
  const userRef = input.userId ?? (await resolveUserId(db));
  const now = new Date().toISOString();
  const goals = Array.isArray(input.goals) ? input.goals : ["recall"];
  const script = input.script ?? DEFAULT_SCHEDULING_PLUGIN_SCRIPT;

  const [created] = await db
    .insert(plugin)
    .values({
      id: generateId(),
      userRef,
      name: input.name ?? "E2E Scheduling Plugin",
      description: input.description ?? "Seeded by test API",
      script,
      capabilities: serializeCapabilities({
        scheduleGoal: true,
        goals,
      }),
      goals: JSON.stringify(goals),
      isPublic: input.isPublic ? 1 : 0,
      enabled: input.enabled === false ? 0 : 1,
      version: 1,
      deleted: 0,
      syncVersion: 1,
      lastModifiedAt: now,
      deviceId: "local",
    })
    .returning();

  if (!created) throw new Error("Failed to seed scheduling plugin");
  return created;
}

async function getPracticeCount(repertoireId: string) {
  const db = await ensureDb();
  // Resolve userId
  const userRef = await resolveUserId(db);
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM daily_practice_queue dpq
    WHERE dpq.user_ref = ${userRef}
      AND dpq.repertoire_ref = ${repertoireId}
      AND dpq.active = 1
      AND dpq.window_start_utc = (
        SELECT MAX(window_start_utc)
        FROM daily_practice_queue
        WHERE user_ref = ${userRef} AND repertoire_ref = ${repertoireId} AND active = 1
      )
  `);
  return rows[0]?.count ?? 0;
}

async function getRepertoireCount(repertoireId: string) {
  const db = await ensureDb();
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM repertoire_tune pt
    WHERE pt.repertoire_ref = ${repertoireId}
      AND pt.deleted = 0
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

async function getCatalogTuneCountsForUser() {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);

  const totalRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM tune t
    WHERE t.deleted = 0
  `);

  const { getTunesForUser } = await import("@/lib/db/queries/tunes");
  const filtered = await getTunesForUser(db, userRef);

  return {
    total: Number(totalRows[0]?.count ?? 0),
    filtered: filtered.length,
  };
}

async function getCatalogSelectionDiagnostics() {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);

  const userProfileRows = await db.all<{
    id: string;
  }>(sql`
    SELECT id
    FROM user_profile
    WHERE id = ${userRef}
  `);

  const userIds = new Set<string>([userRef]);
  for (const row of userProfileRows) {
    if (row.id) userIds.add(row.id);
  }

  const userIdList = Array.from(userIds)
    .map((id) => `'${id.replace(/'/g, "''")}'`)
    .join(", ");

  const selectionRows = await db.all<{ user_id: string; genre_id: string }>(
    sql`
      SELECT user_id, genre_id
      FROM user_genre_selection
      WHERE user_id IN (${sql.raw(userIdList)})
    `
  );

  const repertoireDefaultsRows = await db.all<{ genre: string | null }>(sql`
    SELECT DISTINCT p.genre_default AS genre
    FROM repertoire p
    WHERE p.deleted = 0
      AND p.user_ref IN (${sql.raw(userIdList)})
      AND p.genre_default IS NOT NULL
  `);

  const repertoireGenreRows = await db.all<{ genre: string | null }>(sql`
    SELECT DISTINCT COALESCE(o.genre, t.genre) AS genre
    FROM repertoire_tune pt
    JOIN repertoire p
      ON p.repertoire_id = pt.repertoire_ref AND p.deleted = 0
    JOIN tune t
      ON t.id = pt.tune_ref AND t.deleted = 0
    LEFT JOIN tune_override o
      ON o.tune_ref = t.id
      AND o.user_ref IN (${sql.raw(userIdList)})
      AND o.deleted = 0
    WHERE pt.deleted = 0
      AND p.user_ref IN (${sql.raw(userIdList)})
  `);

  const repertoireCountRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM repertoire p
    WHERE p.deleted = 0
      AND p.user_ref IN (${sql.raw(userIdList)})
  `);

  const repertoireTuneCountRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM repertoire_tune pt
    JOIN repertoire p
      ON p.repertoire_id = pt.repertoire_ref AND p.deleted = 0
    WHERE pt.deleted = 0
      AND p.user_ref IN (${sql.raw(userIdList)})
  `);

  const catalogTuneCountRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM tune t
    WHERE t.deleted = 0
  `);

  return {
    userRef,
    userIdVariants: Array.from(userIds),
    userProfile: userProfileRows,
    selectionRows,
    selectedGenreIds: selectionRows.map((row) => row.genre_id),
    playlistDefaults: repertoireDefaultsRows
      .map((row) => row.genre)
      .filter((genreId): genreId is string => !!genreId),
    repertoireGenres: repertoireGenreRows
      .map((row) => row.genre)
      .filter((genreId): genreId is string => !!genreId),
    counts: {
      playlistCount: Number(repertoireCountRows[0]?.count ?? 0),
      playlistTuneCount: Number(repertoireTuneCountRows[0]?.count ?? 0),
      tuneCount: Number(catalogTuneCountRows[0]?.count ?? 0),
    },
  };
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
    repertoire_ref: string;
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
      id, tune_ref, repertoire_ref, practiced, due, quality,
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
async function getLatestPracticeRecord(tuneId: string, repertoireId: string) {
  // Instrumentation to aid Playwright debugging (use console.log for visibility in headless)
  // eslint-disable-next-line no-console
  console.log(
    `[TestApi] getLatestPracticeRecord invoked tuneId=${tuneId} repertoireId=${repertoireId}`
  );
  if (!/^[0-9A-Za-z-]+$/.test(tuneId)) {
    throw new Error(`Invalid tuneId format: ${tuneId}`);
  }
  if (!/^[0-9A-Za-z-]+$/.test(repertoireId)) {
    throw new Error(`Invalid repertoireId format: ${repertoireId}`);
  }
  const db = await ensureDb();
  const rows = await db.all<{
    id: string;
    tune_ref: string;
    repertoire_ref: string;
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
      id, tune_ref, repertoire_ref, practiced, due, quality,
      interval, repetitions, stability, difficulty, state, step,
      goal, technique, elapsed_days, lapses, sync_version, last_modified_at
    FROM practice_record
    WHERE tune_ref = ${sql.raw(`'${tuneId}'`)}
      AND repertoire_ref = ${sql.raw(`'${repertoireId}'`)}
    ORDER BY
      CASE WHEN practiced IS NULL THEN 1 ELSE 0 END ASC,
      practiced DESC,
      last_modified_at DESC
    LIMIT 1
  `);
  // eslint-disable-next-line no-console
  console.log(`[TestApi] getLatestPracticeRecord committedRows=${rows.length}`);
  if (rows.length === 0) {
    // Additional diagnostic: count total rows for tune regardless of repertoire to spot mismatch
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
 * Get scheduled dates for tunes in a repertoire
 */
async function getScheduledDates(repertoireId: string, tuneIds?: string[]) {
  const db = await ensureDb();
  const query = sql`
    SELECT tune_ref, scheduled, learned, current
    FROM repertoire_tune
    WHERE repertoire_ref = ${repertoireId}
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
      FROM repertoire_tune
      WHERE repertoire_ref = ${repertoireId}
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
 * Update scheduled dates for tunes in a repertoire (local SQLite only)
 * Used by tests to set up specific bucket distributions without going through Supabase sync.
 *
 * @param repertoireId - The repertoire ID
 * @param updates - Array of { tuneId, scheduled } where scheduled is ISO string or null
 */
async function updateScheduledDates(
  repertoireId: string,
  updates: Array<{ tuneId: string; scheduled: string | null }>
): Promise<{ updated: number }> {
  const db = await ensureDb();
  let updated = 0;

  for (const { tuneId, scheduled } of updates) {
    const result = await db
      .update(repertoireTune)
      .set({
        scheduled: scheduled,
        syncVersion: sql.raw(`${repertoireTune.syncVersion.name} + 1`),
        lastModifiedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(repertoireTune.repertoireRef, repertoireId),
          eq(repertoireTune.tuneRef, tuneId)
        )
      )
      .returning();

    if (result && result.length > 0) {
      updated++;
    }
  }

  return { updated };
}

/**
 * Get practice queue for a specific window
 */
async function getPracticeQueue(repertoireId: string, windowStartUtc?: string) {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);

  let query: any;
  if (windowStartUtc) {
    query = sql`
      SELECT id, tune_ref, bucket, order_index, window_start_utc, 
             window_end_utc, completed_at, snapshot_coalesced_ts
      FROM daily_practice_queue
      WHERE user_ref = ${userRef}
        AND repertoire_ref = ${repertoireId}
        AND window_start_utc = ${windowStartUtc}
        AND active = 1
      ORDER BY bucket ASC, order_index ASC
    `;
  } else {
    // When no explicit windowStartUtc is provided, select the latest
    // queue window using the UUIDv7 id ordering (monotonic by time).
    query = sql`
      SELECT id, tune_ref, bucket, order_index, window_start_utc,
             window_end_utc, completed_at, snapshot_coalesced_ts
      FROM daily_practice_queue
      WHERE user_ref = ${userRef}
        AND repertoire_ref = ${repertoireId}
        AND active = 1
        AND window_start_utc = (
          SELECT window_start_utc
          FROM daily_practice_queue
          WHERE user_ref = ${userRef}
            AND repertoire_ref = ${repertoireId}
            AND active = 1
          ORDER BY id DESC
          LIMIT 1
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
 * Get single repertoire_tune row (for consistency checks with practice_record)
 */
async function getPlaylistTuneRow(repertoireId: string, tuneId: string) {
  const db = await ensureDb();
  const rows = await db.all<{
    repertoire_ref: string;
    tune_ref: string;
    scheduled: string | null;
    current: string | null;
    learned: string | null;
    sync_version: number;
    last_modified_at: string;
  }>(sql`
    SELECT repertoire_ref, tune_ref, scheduled, current, learned, sync_version, last_modified_at
    FROM repertoire_tune
    WHERE repertoire_ref = ${repertoireId} AND tune_ref = ${tuneId} AND deleted = 0
    LIMIT 1
  `);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Count distinct practice_record rows per repertoire/tune (duplicate guard)
 */
async function getDistinctPracticeRecordCount(
  repertoireId: string,
  tuneId: string
) {
  const db = await ensureDb();
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM practice_record
    WHERE repertoire_ref = ${repertoireId} AND tune_ref = ${tuneId}
  `);
  return rows[0]?.count ?? 0;
}

/**
 * Get all queue window dates for debugging (returns ALL windows for a repertoire)
 */
async function getAllQueueWindows(repertoireId: string) {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);
  const rows = await db.all<{
    window_start_utc: string;
    count: number;
    active: number;
  }>(sql`
    SELECT window_start_utc, COUNT(*) as count, active
    FROM daily_practice_queue
    WHERE user_ref = ${userRef} AND repertoire_ref = ${repertoireId}
    GROUP BY window_start_utc, active
    ORDER BY window_start_utc DESC
    LIMIT 20
  `);
  return rows;
}

/**
 * Get tunes by their titles from the local database.
 * Returns an array of { id, title } objects.
 */
async function getTunesByTitles(titles: string[]) {
  const db = await ensureDb();
  if (!titles || titles.length === 0) return [];
  // Escape single quotes in titles for safety
  const inList = titles.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
  const rows = await db.all<{ id: string; title: string }>(sql`
    SELECT id, title FROM tune WHERE title IN (${sql.raw(inList)})
  `);
  return rows;
}

async function seedSampleCatalogRow() {
  const now = new Date().toISOString();
  const rawDb = await getSqliteInstance();
  if (!rawDb) {
    throw new Error("SQLite instance not available for seed");
  }
  // Ensure genre exists to satisfy FK.
  rawDb.run(
    "INSERT OR IGNORE INTO genre (id, name, region, description) VALUES (?, ?, ?, ?)",
    ["itrad", "Irish Traditional", "Ireland", "Traditional Irish music genre"]
  );
  rawDb.run(
    "INSERT OR IGNORE INTO user_profile (id, name, email, sr_alg_type, deleted, sync_version, last_modified_at, device_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ["test-user-id", "Test User", null, "fsrs", 0, 1, now, "local"]
  );
  rawDb.run(
    `INSERT OR REPLACE INTO tune (
      id,
      title,
      type,
      structure,
      mode,
      incipit,
      genre,
      composer,
      artist,
      id_foreign,
      release_year,
      private_for,
      primary_origin,
      deleted,
      sync_version,
      last_modified_at,
      device_id
    ) VALUES (
      '${generateId()}',
      'Sample Reel',
      'Reel',
      'AABB',
      'Dmix',
      'd2 dA',
      'itrad',
      'Traditional',
      'Session',
      '12345',
      2020,
      NULL,
      'irishtune.info',
      0,
      1,
      '${now}',
      'local'
    )`
  );
}
/**
 * Get count of pending sync outbox items
 * Used by offline tests to verify sync state
 */
async function getSyncOutboxCount(): Promise<number> {
  const db = await ensureDb();
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM sync_push_queue
  `);
  return rows[0]?.count ?? 0;
}

/**
 * Get count of playlists in local SQLite.
 * Used by E2E to assert repertoire data is present after sync.
 */
async function getPlaylistCount(): Promise<number> {
  const db = await ensureDb();
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM repertoire WHERE deleted = 0
  `);
  return rows[0]?.count ?? 0;
}

/**
 * Check if sync is currently in progress
 * Returns false when offline tests can proceed
 */
function isSyncComplete(): boolean {
  // For offline tests, always return true since we're not actually syncing
  // In online tests, this would check if the sync service is idle
  const el = document.querySelector("[data-auth-initialized]");
  const isSyncing = el?.getAttribute("data-is-syncing") === "true";
  return !isSyncing;
}

/**
 * Get any sync errors that occurred
 * Returns array of error messages
 */
async function getSyncErrors(): Promise<string[]> {
  // For now, return empty array - in future could query error log table
  return [];
}

/**
 * Get a record from Supabase (remote database)
 * For offline tests, this will fail - use only in online tests
 */
async function getSupabaseRecord(
  table: string,
  recordId: string | number
): Promise<any> {
  // This requires network access - will fail in offline tests
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", recordId)
    .single();

  if (error)
    throw new Error(`Failed to fetch Supabase record: ${error.message}`);
  return data;
}

/**
 * Get a record from local SQLite database
 */
async function getLocalRecord(
  table: string,
  recordId: string | number
): Promise<any> {
  const db = await ensureDb();
  // Simple query - assumes table has 'id' column
  const rows = db.all(
    `SELECT * FROM ${sql.raw(table)} WHERE id = ${recordId} LIMIT 1`
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get currently selected genres for the user
 */
async function getSelectedGenres(): Promise<string[]> {
  const db = await ensureDb();
  const rows = db.all(sql`SELECT genre_id FROM user_genre_selection`);
  return rows.map((row: any) => row.genre_id);
}

/**
 * Get a tune ID by genre
 * Returns the first tune found for the given genre
 */
async function getTuneIdByGenre(genre: string): Promise<string | null> {
  const db = await ensureDb();
  const rows = await db.all(
    sql`SELECT id FROM tune WHERE genre = ${genre} AND deleted = 0 LIMIT 1`
  );
  return rows.length > 0 ? (rows[0] as { id: string }).id : null;
}

// Attach to window
declare global {
  interface Window {
    __ttTestApi?: {
      // User ID injection for bypassing Supabase auth
      setTestUserId: (userId: string) => void;
      getTestUserId: () => string | undefined;
      clearTestUserId: () => void;
      getCurrentUserId: () => Promise<string>;
      findOrCreatePrivateTune: (
        genre: string,
        userId: string
      ) => Promise<string>;
      seedAddToReview: (input: SeedAddToReviewInput) => Promise<{
        updated: number;
        queueCount: number;
        userRef: string; // UUID
      }>;
      seedSchedulingPlugin: (input?: SeedSchedulingPluginInput) => Promise<{
        id: string;
      }>;
      getPracticeCount: (repertoireId: string) => Promise<number>; // UUID
      getRepertoireCount: (repertoireId: string) => Promise<number>; // UUID
      getTuneOverrideCountForCurrentUser: () => Promise<number>;
      getCatalogTuneCountsForUser: () => Promise<{
        total: number;
        filtered: number;
      }>;
      getCatalogSelectionDiagnostics: () => Promise<{
        userRef: string;
        userIdVariants: string[];
        userProfile: Array<{ id: string }>;
        selectionRows: Array<{ user_id: string; genre_id: string }>;
        selectedGenreIds: string[];
        playlistDefaults: string[];
        repertoireGenres: string[];
        counts: {
          playlistCount: number;
          playlistTuneCount: number;
          tuneCount: number;
        };
      }>;
      getSyncVersion: () => number;
      isInitialSyncComplete: () => boolean;
      dispose: () => Promise<void>;
      // Staging & committing helpers
      stageEvaluation: (
        tuneId: string,
        repertoireId: string,
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
        repertoireId: string,
        windowStartUtc?: string
      ) => Promise<{ success: boolean; count: number; error?: string }>;
      getPracticeListStaged: (
        repertoireId: string,
        tuneIds?: string[]
      ) => Promise<
        Array<{
          id: string;
          repertoire_ref: string;
          tune_ref: string;
          latest_due: string | null;
          latest_interval: number | null;
          latest_quality: number | null;
          latest_state: number | null;
          has_staged: number; // 1/0
        }>
      >;
      getQueueWindows: (repertoireId: string) => Promise<string[]>;
      seedSampleCatalogRow: () => Promise<void>;
      // New query functions for scheduling tests
      getPracticeRecords: (tuneIds: string[]) => Promise<
        Array<{
          id: string;
          tune_ref: string;
          repertoire_ref: string;
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
        repertoireId: string
      ) => Promise<{
        id: string;
        tune_ref: string;
        repertoire_ref: string;
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
        repertoireId: string,
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
      updateScheduledDates: (
        repertoireId: string,
        updates: Array<{ tuneId: string; scheduled: string | null }>
      ) => Promise<{ updated: number }>;
      getPracticeQueue: (
        repertoireId: string,
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
        repertoireId: string,
        tuneId: string
      ) => Promise<{
        repertoire_ref: string;
        tune_ref: string;
        scheduled: string | null;
        current: string | null;
        learned: string | null;
        sync_version: number;
        last_modified_at: string;
      } | null>;
      getDistinctPracticeRecordCount: (
        repertoireId: string,
        tuneId: string
      ) => Promise<number>;
      getAllQueueWindows: (repertoireId: string) => Promise<
        Array<{
          window_start_utc: string;
          count: number;
          active: number;
        }>
      >;
      getTunesByTitles: (
        titles: string[]
      ) => Promise<Array<{ id: string; title: string }>>;
      getSyncOutboxCount: () => Promise<number>;
      getPlaylistCount: () => Promise<number>;
      isSyncComplete: () => boolean;
      getSyncErrors: () => Promise<string[]>;
      getSupabaseRecord: (
        table: string,
        recordId: string | number
      ) => Promise<any>;
      getLocalRecord: (
        table: string,
        recordId: string | number
      ) => Promise<any>;
      getSelectedGenres: () => Promise<string[]>;
      getTuneIdByGenre: (genre: string) => Promise<string | null>;
      getAnnotationCounts: (options?: {
        tuneId?: string;
      }) => Promise<{ notes: number; references: number }>;
      getOrphanedAnnotationCounts: () => Promise<{
        orphanedNotes: number;
        orphanedReferences: number;
      }>;
      seedAnnotations: (input: {
        tuneId: string;
        noteCount?: number;
        referenceCount?: number;
        userId?: string;
      }) => Promise<{ notesCreated: number; referencesCreated: number }>;
    };
  }
}

if (typeof window !== "undefined") {
  // Idempotent attach
  if (!window.__ttTestApi) {
    window.__ttTestApi = {
      // User ID injection methods
      setTestUserId: (userId: string) => {
        window.__ttTestUserId = userId;
        console.log(`[TestApi] Test user ID set to: ${userId}`);
      },
      getTestUserId: () => window.__ttTestUserId,
      clearTestUserId: () => {
        delete window.__ttTestUserId;
        console.log("[TestApi] Test user ID cleared");
      },
      getCurrentUserId: async () => {
        const db = await ensureDb();
        return await resolveUserId(db);
      },
      findOrCreatePrivateTune: async (genre: string, userId: string) => {
        const db = await ensureDb();

        // Try to find existing private tune
        const existing = await db.all<{ id: string }>(
          sql`SELECT id FROM tune WHERE genre = ${genre} AND private_for = ${userId} AND deleted = 0 LIMIT 1`
        );

        if (existing.length > 0 && existing[0]?.id) {
          return existing[0].id;
        }

        // Create a private tune using raw SQL
        const tuneId = generateId();
        const now = new Date().toISOString();

        await db.run(
          sql.raw(`INSERT INTO tune (
            id, title, genre, private_for, deleted, sync_version, last_modified_at
          ) VALUES (
            '${tuneId}', 
            'E2E Private Tune ${genre}', 
            '${genre}', 
            '${userId}', 
            0, 
            1,
            '${now}'
          )`)
        );

        return tuneId;
      },
      seedAddToReview,
      seedSchedulingPlugin,
      getPracticeCount,
      getRepertoireCount,
      getTuneOverrideCountForCurrentUser,
      getCatalogTuneCountsForUser,
      getCatalogSelectionDiagnostics,
      getPracticeRecords,
      getLatestPracticeRecord,
      getScheduledDates,
      updateScheduledDates,
      getPracticeQueue,
      getPlaylistTuneRow,
      getDistinctPracticeRecordCount,
      getAllQueueWindows,
      getTunesByTitles,
      stageEvaluation: async (
        tuneId: string,
        repertoireId: string,
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
          repertoireId,
          tuneId,
          evaluation,
          goal,
          technique
        );
      },
      commitStaged: async (repertoireId: string, windowStartUtc?: string) => {
        const { commitStagedEvaluations } = await import(
          "@/lib/services/practice-recording"
        );
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        return await commitStagedEvaluations(
          db,
          userRef,
          repertoireId,
          windowStartUtc
        );
      },
      getPracticeListStaged: async (
        repertoireId: string,
        tuneIds?: string[]
      ) => {
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        let rows: Array<{
          id: string;
          repertoire_ref: string;
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
            repertoire_ref: string;
            tune_ref: string;
            latest_due: string | null;
            latest_interval: number | null;
            latest_quality: number | null;
            latest_state: number | null;
            has_staged: number;
          }>(sql`
            SELECT
              tune.id as id,
              repertoire.repertoire_id as repertoire_ref,
              tune.id as tune_ref,
              COALESCE(td.due, pr.due) AS latest_due,
              COALESCE(td.interval, pr.interval) AS latest_interval,
              COALESCE(td.quality, pr.quality) AS latest_quality,
              COALESCE(td.state, pr.state) AS latest_state,
              CASE WHEN td.practiced IS NOT NULL OR td.due IS NOT NULL THEN 1 ELSE 0 END AS has_staged
            FROM tune
            LEFT JOIN repertoire_tune ON repertoire_tune.tune_ref = tune.id
            LEFT JOIN repertoire ON repertoire.repertoire_id = repertoire_tune.repertoire_ref
            LEFT JOIN (
              SELECT pr.* FROM practice_record pr
              INNER JOIN (
                SELECT tune_ref, repertoire_ref, MAX(id) as max_id
                FROM practice_record
                GROUP BY tune_ref, repertoire_ref
              ) latest ON pr.tune_ref = latest.tune_ref
                AND pr.repertoire_ref = latest.repertoire_ref
                AND pr.id = latest.max_id
            ) pr ON pr.tune_ref = tune.id AND pr.repertoire_ref = repertoire_tune.repertoire_ref
            LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.repertoire_id = repertoire_tune.repertoire_ref
            WHERE repertoire.repertoire_id = ${repertoireId} AND repertoire.user_ref = ${userRef} AND tune.id IN (${sql.raw(inList)})
          `);
        } else {
          rows = await db.all<{
            id: string;
            repertoire_ref: string;
            tune_ref: string;
            latest_due: string | null;
            latest_interval: number | null;
            latest_quality: number | null;
            latest_state: number | null;
            has_staged: number;
          }>(sql`
            SELECT
              tune.id as id,
              repertoire.repertoire_id as repertoire_ref,
              tune.id as tune_ref,
              COALESCE(td.due, pr.due) AS latest_due,
              COALESCE(td.interval, pr.interval) AS latest_interval,
              COALESCE(td.quality, pr.quality) AS latest_quality,
              COALESCE(td.state, pr.state) AS latest_state,
              CASE WHEN td.practiced IS NOT NULL OR td.due IS NOT NULL THEN 1 ELSE 0 END AS has_staged
            FROM tune
            LEFT JOIN repertoire_tune ON repertoire_tune.tune_ref = tune.id
            LEFT JOIN repertoire ON repertoire.repertoire_id = repertoire_tune.repertoire_ref
            LEFT JOIN (
              SELECT pr.* FROM practice_record pr
              INNER JOIN (
                SELECT tune_ref, repertoire_ref, MAX(id) as max_id
                FROM practice_record
                GROUP BY tune_ref, repertoire_ref
              ) latest ON pr.tune_ref = latest.tune_ref
                AND pr.repertoire_ref = latest.repertoire_ref
                AND pr.id = latest.max_id
            ) pr ON pr.tune_ref = tune.id AND pr.repertoire_ref = repertoire_tune.repertoire_ref
            LEFT JOIN table_transient_data td ON td.tune_id = tune.id AND td.repertoire_id = repertoire_tune.repertoire_ref
            WHERE repertoire.repertoire_id = ${repertoireId} AND repertoire.user_ref = ${userRef}
          `);
        }
        return rows;
      },
      getQueueWindows: async (repertoireId: string) => {
        const db = await ensureDb();
        const userRef = await resolveUserId(db);
        const rows = await db.all<{ window_start_utc: string }>(sql`
          SELECT DISTINCT window_start_utc
          FROM daily_practice_queue
          WHERE user_ref = ${userRef} AND repertoire_ref = ${repertoireId}
          ORDER BY window_start_utc DESC
        `);
        return rows.map((r) => r.window_start_utc);
      },
      seedSampleCatalogRow: async () => {
        await seedSampleCatalogRow();
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
          // Best-effort: stop background sync before clearing the local DB.
          // Background auto sync timers can race with clearDb() during E2E teardown.
          const ctrl = (window as any).__ttSyncControl;
          if (ctrl?.stop) {
            await ctrl.stop();
          }
          if (ctrl?.waitForIdle) {
            const ok = await ctrl.waitForIdle(2000);
            if (!ok) {
              // eslint-disable-next-line no-console
              console.warn(
                "[TestApi] Sync still in progress after timeout; proceeding with clearDb()"
              );
            }
          }
          await clearDb();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[TestApi] dispose clearDb error:", e);
        }
      },
      getSyncOutboxCount: async () => {
        return await getSyncOutboxCount();
      },
      getPlaylistCount: async () => {
        return await getPlaylistCount();
      },
      isSyncComplete: () => {
        return isSyncComplete();
      },
      getSyncErrors: async () => {
        return await getSyncErrors();
      },
      getSupabaseRecord: async (table: string, recordId: string | number) => {
        return await getSupabaseRecord(table, recordId);
      },
      getLocalRecord: async (table: string, recordId: string | number) => {
        return await getLocalRecord(table, recordId);
      },
      getAnnotationCounts: async (options?: { tuneId?: string }) => {
        const db = await ensureDb();
        const userRef = await resolveUserId(db);

        // Count notes (filtered by genre via tune JOIN)
        const noteQuery = options?.tuneId
          ? sql`SELECT COUNT(*) as count FROM note n WHERE n.tune_ref = ${options.tuneId}`
          : sql`
              SELECT COUNT(*) as count 
              FROM note n
              JOIN tune t ON n.tune_ref = t.id
              WHERE (n.user_ref IS NULL OR n.user_ref = ${userRef})
                AND t.deleted = 0
            `;

        const noteRows = await db.all<{ count: number }>(noteQuery);

        // Count references (same pattern)
        const refQuery = options?.tuneId
          ? sql`SELECT COUNT(*) as count FROM reference r WHERE r.tune_ref = ${options.tuneId}`
          : sql`
              SELECT COUNT(*) as count 
              FROM reference r
              JOIN tune t ON r.tune_ref = t.id
              WHERE (r.user_ref IS NULL OR r.user_ref = ${userRef})
                AND t.deleted = 0
            `;

        const refRows = await db.all<{ count: number }>(refQuery);

        return {
          notes: Number(noteRows[0]?.count ?? 0),
          references: Number(refRows[0]?.count ?? 0),
        };
      },
      getSelectedGenres,
      getTuneIdByGenre,
      getOrphanedAnnotationCounts: async () => {
        const db = await ensureDb();

        // Count notes with tune_ref NOT in tune table
        const orphanedNotes = await db.all<{ count: number }>(sql`
          SELECT COUNT(*) as count
          FROM note n
          WHERE n.tune_ref NOT IN (SELECT id FROM tune WHERE deleted = 0)
        `);

        // Count references with tune_ref NOT in tune table
        const orphanedRefs = await db.all<{ count: number }>(sql`
          SELECT COUNT(*) as count
          FROM reference r
          WHERE r.tune_ref NOT IN (SELECT id FROM tune WHERE deleted = 0)
        `);

        return {
          orphanedNotes: Number(orphanedNotes[0]?.count ?? 0),
          orphanedReferences: Number(orphanedRefs[0]?.count ?? 0),
        };
      },
      seedAnnotations: async (input: {
        tuneId: string;
        noteCount?: number;
        referenceCount?: number;
        userId?: string;
      }) => {
        const db = await ensureDb();
        const userRef = input.userId ?? (await resolveUserId(db));
        const now = new Date().toISOString();

        // Seed notes
        for (let i = 0; i < (input.noteCount ?? 0); i++) {
          await db.insert(note).values({
            tuneRef: input.tuneId,
            userRef,
            noteText: `Test note ${i + 1}`,
            public: 0,
            deleted: 0,
            displayOrder: i + 1,
            createdDate: now,
            lastModifiedAt: now,
            syncVersion: 1,
          });
        }

        // Seed references
        for (let i = 0; i < (input.referenceCount ?? 0); i++) {
          await db.insert(reference).values({
            tuneRef: input.tuneId,
            userRef,
            url: `https://example.com/ref${i + 1}`,
            comment: `Test reference ${i + 1}`,
            deleted: 0,
            lastModifiedAt: now,
            syncVersion: 1,
          });
        }

        return {
          notesCreated: input.noteCount ?? 0,
          referencesCreated: input.referenceCount ?? 0,
        };
      },
    };
    // eslint-disable-next-line no-console
    console.log("[TestApi] __ttTestApi attached to window");
  }
}
