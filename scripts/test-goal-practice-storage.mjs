/** Local-only integration: SQLite WASM -> generated Worker -> Postgres -> SQLite.
 * Uses isolated UUID fixtures and an ephemeral JWT key, never real credentials.
 * No listening server is started. Concurrent SQL exercises the Worker's upsert.
 */
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "oosync/runtime/sqlite-wasm-adapter";
import { camelizeKeys, snakifyKeys } from "oosync/sync/casing";
import postgres from "postgres";
import { installSyncTriggers } from "../src/lib/db/install-triggers.ts";
import worker from "../worker/src/index.ts";

const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = postgres(databaseUrl, { max: 4, onnotice: () => {} });
const userId = randomUUID();
const repertoireId = randomUUID();
const tuneId = randomUUID();
const eventId = randomUUID();
const otherUserId = randomUUID();
const otherRepertoireId = randomUUID();
const otherEventId = randomUUID();
const privateGoalId = randomUUID();
const goalId = "00000000-0000-0000-0000-000000000003";
const stamp = "2025-11-17T12:00:00.000Z";
const state = '{"version":1,"ladderIndex":0,"ladderHash":"fixture"}';
const snapshot =
  '{"goalLabel":"Fluency","choiceLabel":"Fluent","action":{"kind":"stay"}}';
const key = randomBytes(32).toString("hex");
const header = Buffer.from(
  JSON.stringify({ alg: "HS256", typ: "JWT" })
).toString("base64url");
const claims = Buffer.from(
  JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 600 })
).toString("base64url");
const signingInput = `${header}.${claims}`;
const signature = createHmac("sha256", key)
  .update(signingInput)
  .digest("base64url");
const token = `${signingInput}.${signature}`;
const sqliteModule = await initSqliteWasm();
let local;

function localRows(query, values = []) {
  const result = local.exec(query, values)[0];
  return result
    ? result.values.map((row) =>
        Object.fromEntries(result.columns.map((column, i) => [column, row[i]]))
      )
    : [];
}

async function sync(
  changes,
  pullTables = ["practice_record", "table_transient_data"]
) {
  return await worker.fetch(
    new Request("http://local.test/api/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changes,
        schemaVersion: 1,
        pullTables,
        initialPageCount: 10,
      }),
    }),
    {
      DATABASE_URL: databaseUrl,
      BYPASS_HYPERDRIVE: "true",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_JWT_SECRET: key,
    }
  );
}

function change(table, data) {
  return {
    table,
    rowId:
      data.id ??
      JSON.stringify({
        tune_id: data.tuneId,
        user_id: data.userId,
        repertoire_id: data.repertoireId,
      }),
    data,
    deleted: false,
    lastModifiedAt: stamp,
  };
}

async function expectSqlError(statement, code) {
  await assert.rejects(statement, (error) => error.code === code);
}

// Match the existing Worker natural-key upsert, including omission of id on UPDATE.
function upsert(client, id, practiced, evaluation = "fluent") {
  return client`INSERT INTO public.practice_record
    (id, repertoire_ref, tune_ref, practiced, scheduler_id, scheduler_version, evaluation_id)
    VALUES (${id}, ${repertoireId}, ${tuneId}, ${practiced}, 'builtin:interval-ladder', 1, ${evaluation})
    ON CONFLICT (tune_ref, repertoire_ref, practiced) DO UPDATE SET
      scheduler_id = excluded.scheduler_id, scheduler_version = excluded.scheduler_version,
      evaluation_id = excluded.evaluation_id`;
}

async function concurrentUpserts(
  practiced,
  secondId,
  secondEvaluation,
  expectedCode
) {
  const firstId = randomUUID();
  const contenderId = secondId === "same" ? firstId : randomUUID();
  const contender = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const [{ pid }] = await contender`SELECT pg_backend_pid() AS pid`;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let inserted;
  const ready = new Promise((resolve) => {
    inserted = resolve;
  });
  const first = sql.begin(async (tx) => {
    await upsert(tx, firstId, practiced);
    inserted();
    await held;
  });
  let second;
  try {
    await Promise.race([ready, first]);
    // Observe the actual server lock rather than assuming a sleep creates overlap.
    second = contender
      .begin((tx) => upsert(tx, contenderId, practiced, secondEvaluation))
      .then(
        () => ({ code: null }),
        (error) => ({ code: error.code })
      );
    const deadline = Date.now() + 5000;
    let waiting = false;
    while (!waiting && Date.now() < deadline) {
      const [activity] =
        await sql`SELECT wait_event FROM pg_stat_activity WHERE pid = ${pid}`;
      waiting = activity?.wait_event === "advisory";
      if (!waiting) await delay(10);
    }
    assert.ok(waiting, "second insert must wait for the natural-key lock");
    release();
    await first;
    assert.equal((await second).code, expectedCode);
    const [row] =
      await sql`SELECT id, evaluation_id FROM public.practice_record WHERE repertoire_ref = ${repertoireId} AND practiced = ${practiced}`;
    assert.equal(row.id, firstId);
    assert.equal(row.evaluation_id, "fluent");
  } finally {
    release();
    await Promise.allSettled([first, second]);
    await contender.end();
  }
}

try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO public.user_profile(id) VALUES (${userId}), (${otherUserId})`;
    await tx`INSERT INTO public.repertoire(repertoire_id, user_ref) VALUES (${otherRepertoireId}, ${otherUserId})`;
    await tx`INSERT INTO public.goal(id, name, private_for) VALUES (${privateGoalId}, 'storage test private goal', ${otherUserId})`;
    await tx`INSERT INTO public.repertoire(repertoire_id, user_ref) VALUES (${repertoireId}, ${userId})`;
    await tx`INSERT INTO public.tune(id, private_for) VALUES (${tuneId}, ${userId})`;
    await tx`INSERT INTO public.practice_record(id, repertoire_ref, tune_ref, practiced, goal_id)
      VALUES (${otherEventId}, ${otherRepertoireId}, ${tuneId}, ${stamp}, ${goalId})`;
  });
  local = createSqliteWasmDatabase(sqliteModule);
  const config = JSON.parse(readFileSync("oosync.codegen.config.json", "utf8"));
  for (const file of config.browserSqlite.migrationFiles) {
    for (const statement of readFileSync(file.slice(1), "utf8")
      .split("--> statement-breakpoint")
      .filter((part) => part.trim()))
      local.exec(statement);
  }
  local.run("INSERT INTO user_profile (id, last_modified_at) VALUES (?, ?)", [
    userId,
    stamp,
  ]);
  local.run(
    "INSERT INTO repertoire (repertoire_id, user_ref, last_modified_at) VALUES (?, ?, ?)",
    [repertoireId, userId, stamp]
  );
  local.run("INSERT INTO tune (id, last_modified_at) VALUES (?, ?)", [
    tuneId,
    stamp,
  ]);
  local.run(
    "INSERT INTO goal (id, name, last_modified_at) VALUES (?, 'fluency', ?)",
    [goalId, stamp]
  );
  installSyncTriggers(local);
  local.run(
    `INSERT INTO practice_record
    (id, repertoire_ref, tune_ref, practiced, due, goal_id, evaluation_id, evaluation_snapshot,
     scheduler_id, scheduler_version, scheduler_state, interval_days, last_modified_at)
    VALUES (?, ?, ?, ?, '2025-11-17T14:24:00.000Z', ?, 'fluent', ?, 'builtin:interval-ladder', 1, ?, 0.1, ?)`,
    [eventId, repertoireId, tuneId, stamp, goalId, snapshot, state, stamp]
  );
  local.run(
    `INSERT INTO table_transient_data
    (user_id, repertoire_id, tune_id, practiced, goal_id, evaluation_id, evaluation_snapshot,
     scheduler_id, scheduler_version, scheduler_state, interval_days, predecessor_record_id,
     predecessor_fingerprint, calculation_config_hash, practice_record_id, last_modified_at)
    VALUES (?, ?, ?, ?, ?, 'fluent', ?, 'builtin:interval-ladder', 1, ?, ?, ?, 'before', 'config', ?, ?)`,
    [
      userId,
      repertoireId,
      tuneId,
      stamp,
      goalId,
      snapshot,
      state,
      1 / 3,
      eventId,
      randomUUID(),
      stamp,
    ]
  );
  assert.equal(localRows("SELECT * FROM sync_push_queue").length, 2);
  const originalEvent = camelizeKeys(
    localRows("SELECT * FROM practice_record")[0]
  );
  const originalDraft = camelizeKeys(
    localRows("SELECT * FROM table_transient_data")[0]
  );
  // Export/reopen exercises durable SQLite representation before upload.
  const bytes = local.export();
  local.close();
  local = createSqliteWasmDatabase(sqliteModule, bytes);
  assert.equal(
    localRows("SELECT interval_days FROM practice_record")[0].interval_days,
    0.1
  );
  const changes = [
    change("practice_record", originalEvent),
    change("table_transient_data", originalDraft),
  ];
  const pushed = await sync(changes);
  assert.equal(pushed.status, 200, await pushed.clone().text());
  const retry = await sync(changes);
  assert.equal(retry.status, 200, await retry.clone().text());
  const response = await sync([]);
  assert.equal(response.status, 200, await response.clone().text());
  const downloaded = await response.json();
  assert.ok(!downloaded.nextCursor, "fixture pull must be complete");
  const pulledEvent = downloaded.changes.find(
    (row) => row.table === "practice_record" && row.data.id === eventId
  );
  const pulledDraft = downloaded.changes.find(
    (row) => row.table === "table_transient_data"
  );
  assert.ok(
    !downloaded.changes.some((row) => row.data.id === otherEventId),
    "shared goals must not expose another user's practice history"
  );
  assert.ok(pulledEvent);
  assert.ok(pulledDraft);
  assert.equal(pulledEvent.data.intervalDays, 0.1);
  // Floating-point transport may round the last decimal; timestamps use seconds.
  assert.ok(Math.abs(pulledDraft.data.intervalDays - 1 / 3) * 86400 < 0.000001);
  assert.equal(pulledDraft.data.predecessorRecordId, eventId);
  assert.equal(
    pulledDraft.data.practiceRecordId,
    originalDraft.practiceRecordId
  );
  for (const row of [pulledEvent, pulledDraft]) {
    assert.equal(row.data.schedulerState, state);
    assert.equal(row.data.evaluationSnapshot, snapshot);
    const data = snakifyKeys(row.data);
    local.run(
      `INSERT OR REPLACE INTO ${row.table} (${Object.keys(data).join(",")}) VALUES (${Object.keys(
        data
      )
        .map(() => "?")
        .join(",")})`,
      Object.values(data)
    );
  }
  assert.ok(
    Math.abs(
      localRows("SELECT interval_days FROM table_transient_data")[0]
        .interval_days -
        1 / 3
    ) *
      86400 <
      0.000001
  );
  const [stored] =
    await sql`SELECT interval_days, extract(epoch FROM due - practiced) / 86400 AS duration FROM public.practice_record WHERE id = ${eventId}`;
  assert.equal(stored.interval_days, 0.1);
  assert.equal(Number(stored.duration), 0.1);
  const collision = await sync([
    change("practice_record", { ...originalEvent, id: randomUUID() }),
  ]);
  assert.notEqual(
    collision.status,
    200,
    "Worker must surface a natural-key UUID conflict"
  );
  const altered = await sync([
    change("practice_record", { ...originalEvent, evaluationId: "changed" }),
  ]);
  assert.notEqual(
    altered.status,
    200,
    "Worker must reject changed event content"
  );
  await expectSqlError(
    sql`UPDATE public.table_transient_data SET scheduler_state = '[]' WHERE user_id = ${userId}`,
    "23514"
  );
  await expectSqlError(
    sql`UPDATE public.table_transient_data SET evaluation_snapshot = ${JSON.stringify({ text: "x".repeat(16384) })} WHERE user_id = ${userId}`,
    "23514"
  );
  await expectSqlError(
    sql`UPDATE public.table_transient_data SET interval_days = 'NaN' WHERE user_id = ${userId}`,
    "23514"
  );
  await expectSqlError(
    sql`UPDATE public.table_transient_data SET interval_days = 'Infinity' WHERE user_id = ${userId}`,
    "23514"
  );
  await expectSqlError(
    sql`UPDATE public.table_transient_data SET scheduler_version = 0 WHERE user_id = ${userId}`,
    "23514"
  );
  const forbiddenGoal = await sync([
    change("table_transient_data", { ...originalDraft, goalId: privateGoalId }),
  ]);
  assert.notEqual(
    forbiddenGoal.status,
    200,
    "Worker must reject another user's private goal"
  );
  const [unchangedDraft] =
    await sql`SELECT goal_id FROM public.table_transient_data WHERE user_id = ${userId}`;
  assert.equal(unchangedDraft.goal_id, goalId, "rejected push must roll back");
  await expectSqlError(
    sql`INSERT INTO public.practice_record
    (id, repertoire_ref, tune_ref, practiced, goal_id) VALUES
    (${randomUUID()}, ${repertoireId}, ${tuneId}, '2025-11-18T12:00:00Z', ${privateGoalId})`,
    "23514"
  );
  await expectSqlError(
    sql`INSERT INTO public.repertoire_tune
    (repertoire_ref, tune_ref, goal_id) VALUES (${repertoireId}, ${tuneId}, ${privateGoalId})`,
    "23514"
  );
  await expectSqlError(
    sql`INSERT INTO public.daily_practice_queue
    (id, user_ref, repertoire_ref, tune_ref, bucket, order_index, allocation_goal_id) VALUES
    (${randomUUID()}, ${userId}, ${repertoireId}, ${tuneId}, 1, 0, ${privateGoalId})`,
    "23514"
  );
  // Old bundles can still create and update records without the new payload.
  const legacyId = randomUUID();
  await sql`INSERT INTO public.practice_record(id, repertoire_ref, tune_ref, practiced, quality)
    VALUES (${legacyId}, ${repertoireId}, ${tuneId}, '2025-11-19T12:00:00Z', 1)`;
  await sql`INSERT INTO public.practice_record(id, repertoire_ref, tune_ref, practiced, quality)
    VALUES (${randomUUID()}, ${repertoireId}, ${tuneId}, '2025-11-19T12:00:00Z', 2)
    ON CONFLICT (tune_ref, repertoire_ref, practiced) DO UPDATE SET quality = excluded.quality`;
  const [legacy] =
    await sql`SELECT id, quality, scheduler_id FROM public.practice_record WHERE id = ${legacyId}`;
  assert.deepEqual(legacy, { id: legacyId, quality: 2, scheduler_id: null });
  await concurrentUpserts(
    "2026-11-18T12:00:00Z",
    "different",
    "fluent",
    "23505"
  );
  await concurrentUpserts("2026-11-19T12:00:00Z", "same", "fluent", null);
  await concurrentUpserts("2026-11-20T12:00:00Z", "same", "changed", "23514");
  console.log(
    "PASS: SQLite persistence/outbox, Worker round trip, fractional intervals, JSON guards and concurrent identity enforcement"
  );
} finally {
  local?.close();
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.allow_practice_record_delete', 'on', true)`;
    await tx`DELETE FROM public.table_transient_data WHERE user_id = ${userId}`;
    await tx`DELETE FROM public.practice_record WHERE repertoire_ref IN (${repertoireId}, ${otherRepertoireId})`;
    await tx`DELETE FROM public.goal WHERE id = ${privateGoalId}`;
    await tx`DELETE FROM public.repertoire WHERE repertoire_id IN (${repertoireId}, ${otherRepertoireId})`;
    await tx`DELETE FROM public.tune WHERE id = ${tuneId}`;
    await tx`DELETE FROM public.user_profile WHERE id IN (${userId}, ${otherUserId})`;
  });
  await sql.end();
}
