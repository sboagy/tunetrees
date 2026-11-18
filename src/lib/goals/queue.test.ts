import { readFileSync } from "node:fs";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "@oosync/runtime/sqlite-wasm-adapter";
import { drizzle } from "drizzle-orm/sql-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import codegenConfig from "../../../oosync.codegen.config.json";
import { persistDb } from "../db/client-sqlite";
import {
  dailyPracticeQueue,
  goal,
  goalUserSettings,
  practiceRecord,
  repertoireTune,
  tableTransientData,
  tune,
} from "../db/schema";
import { getBuiltInGoals } from "./builtins";
import { canonicalJson, type DailyGoalSettings } from "./config";
import {
  type GoalQueueAction,
  GoalQueuePersistenceError,
  persistGoalQueueResult,
  updateGoalPracticeQueue,
} from "./queue";

vi.mock("../db/client-sqlite", () => ({ persistDb: vi.fn() }));
let raw: ReturnType<typeof createSqliteWasmDatabase>;
let db: ReturnType<typeof drizzle>;
const stamp = "2026-11-16T12:00:00Z";
const recall = getBuiltInGoals()[0];
const fluency = getBuiltInGoals().find((row) => row.name === "fluency")!;
const request = {
  userId: "owner",
  repertoireId: "rep",
  practiceDate: new Date(stamp),
  now: new Date(stamp),
};
const run = (action: GoalQueueAction = { kind: "load" }) =>
  updateGoalPracticeQueue(db, request, action);
function add(id: string, due: string | null = stamp, definition = recall) {
  db.insert(tune).values({ id, lastModifiedAt: stamp }).run();
  db.insert(repertoireTune)
    .values({
      repertoireRef: "rep",
      tuneRef: id,
      goalId: definition.id,
      goal: definition.name,
      scheduled: due,
      lastModifiedAt: stamp,
    })
    .run();
}
function settings(
  definition: typeof recall,
  daily: Partial<DailyGoalSettings>
) {
  db.insert(goalUserSettings)
    .values({
      userId: "owner",
      goalId: definition.id,
      overrides: canonicalJson({ daily }),
      lastModifiedAt: stamp,
    })
    .onConflictDoUpdate({
      target: [goalUserSettings.userId, goalUserSettings.goalId],
      set: { overrides: canonicalJson({ daily }) },
    })
    .run();
}
function queue(
  id: string,
  extras: Partial<typeof dailyPracticeQueue.$inferInsert> = {}
) {
  db.insert(dailyPracticeQueue)
    .values({
      id: `q-${id}`,
      userRef: "owner",
      repertoireRef: "rep",
      tuneRef: id,
      windowStartUtc: "2026-11-16 00:00:00",
      windowEndUtc: "2026-11-17 00:00:00",
      bucket: 1,
      orderIndex: 0,
      generatedAt: stamp,
      snapshotCoalescedTs: stamp,
      lastModifiedAt: stamp,
      ...extras,
    })
    .run();
}
function history(
  id: string,
  due: string,
  practiced = "2026-11-15T12:00:00Z",
  recordId = `event-${id}`
) {
  db.insert(practiceRecord)
    .values({
      id: recordId,
      repertoireRef: "rep",
      tuneRef: id,
      practiced,
      due,
      lastModifiedAt: practiced,
    })
    .run();
}
function ids(result: Awaited<ReturnType<typeof run>>) {
  return result.rows.map((row) => row.tuneRef);
}

beforeEach(async () => {
  raw = createSqliteWasmDatabase(await initSqliteWasm());
  for (const file of codegenConfig.browserSqlite.migrationFiles) {
    for (const statement of readFileSync(file.slice(1), "utf8").split(
      "--> statement-breakpoint"
    )) {
      if (statement.trim()) raw.exec(statement);
    }
  }
  db = drizzle(raw as never);
  raw.run(
    "INSERT INTO user_profile (id,last_modified_at) VALUES ('owner',?), ('other',?)",
    [stamp, stamp]
  );
  raw.run(
    "INSERT INTO repertoire (repertoire_id,user_ref,last_modified_at) VALUES ('rep','owner',?),('foreign','other',?)",
    [stamp, stamp]
  );
  for (const row of getBuiltInGoals()) {
    raw.run("DELETE FROM goal WHERE id = ?", [row.id]);
    db.insert(goal)
      .values({
        id: row.id,
        name: row.name,
        displayName: row.displayName,
        description: row.description,
        defaultConfig: canonicalJson(row.config),
        lastModifiedAt: stamp,
      })
      .run();
  }
});
afterEach(() => {
  raw.close();
  vi.mocked(persistDb).mockReset();
});

describe("goal-aware daily queue", () => {
  it("limits each goal independently without a combined trim", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    settings(fluency, { maximum: 2 });
    add("recall-a");
    add("recall-b");
    add("fluency-a", stamp, fluency);
    add("fluency-b", stamp, fluency);
    add("fluency-c", stamp, fluency);
    expect(ids(await run())).toEqual(["recall-a", "fluency-a", "fluency-b"]);
  });
  it("selects old backlog before introducing new work and never tops up to maximum", async () => {
    settings(recall, { minimum: 3, maximum: 10 });
    for (let i = 0; i < 6; i++) add(`old-${i}`, "2026-01-01T00:00:00Z");
    add("new", null);
    expect(ids(await run())).toEqual([
      "old-0",
      "old-1",
      "old-2",
      "old-3",
      "old-4",
      "old-5",
    ]);
  });
  it("fills only the minimum with unscheduled then nearest future tunes", async () => {
    settings(recall, { minimum: 3, maximum: 10 });
    add("due");
    add("new", null);
    add("far", "2027-01-01T00:00:00Z");
    add("near", "2026-11-17T00:00:00Z");
    const result = await run();
    expect(ids(result)).toEqual(["due", "new", "near"]);
    expect(result.rows.map((row) => [row.bucket, row.selectionReason])).toEqual(
      [
        [1, "due_today"],
        [3, "unscheduled_topup"],
        [1, "future_topup"],
      ]
    );
  });
  it("minimum zero permits due work but not unscheduled introductions", async () => {
    add("due", stamp, fluency);
    add("new", null, fluency);
    expect(ids(await run())).toEqual(["due"]);
  });
  it("honors Unlimited and the persisted automatic-new preference", async () => {
    settings(recall, { minimum: 3, maximum: 0, autoNew: false });
    add("new", null);
    add("future", "2027-01-01T00:00:00Z");
    expect(ids(await run())).toEqual(["future"]);
    expect((await run({ kind: "refresh" })).shortfalls).toEqual([
      { goalId: recall.id, missing: 2 },
    ]);
  });
  it("does not cap Unlimited due work at the minimum", async () => {
    settings(recall, { minimum: 0, maximum: 0 });
    for (let i = 0; i < 12; i++) add(`due-${i}`);
    expect((await run()).rows).toHaveLength(12);
  });
  it("uses per-goal delinquency and normalized offsets/sub-day boundaries", async () => {
    settings(recall, { minimum: 0, maximum: 10, delinquencyDays: 1 });
    settings(fluency, { maximum: 10, delinquencyDays: 7 });
    add("r-old", "2026-11-14T12:00:00Z");
    add("f-recent", "2026-11-14T12:00:00Z", fluency);
    add("today", "2026-11-17T00:30:00+01:00");
    const result = await run();
    expect(ids(result)).toEqual(["today", "f-recent", "r-old"]);
    expect(result.rows.map((row) => row.selectionReason)).toEqual([
      "due_today",
      "recent_overdue",
      "old_overdue",
    ]);
  });
  it("falls back to latest history due, never an older overdue event", async () => {
    settings(recall, { minimum: 0 });
    add("tune", null);
    history(
      "tune",
      "2026-01-01T00:00:00Z",
      "2026-11-15T12:00:00.000001Z",
      "old"
    );
    history(
      "tune",
      "2027-01-01T00:00:00Z",
      "2026-11-15T12:00:00.000002Z",
      "latest"
    );
    expect(ids(await run())).toEqual([]);
  });
  it("explicit schedule overrides a future history due", async () => {
    settings(recall, { minimum: 0 });
    add("tune");
    history("tune", "2027-01-01T00:00:00Z");
    expect(ids(await run())).toEqual(["tune"]);
  });
  it("does not automatically expose a tune twice in one day", async () => {
    add("tune");
    history("tune", "2026-11-16T18:00:00Z", stamp);
    expect(ids(await run())).toEqual([]);
  });
  it("surfaces Recall fallback without losing an unavailable-goal tune", async () => {
    add("tune");
    raw.run("UPDATE repertoire_tune SET goal_id = NULL, goal = 'missing'");
    const result = await run();
    expect(result.rows[0].allocationGoalId).toBe(recall.id);
    expect(result.notices).toEqual([
      { tuneId: "tune", message: "Assigned goal is unavailable; using Recall" },
    ]);
  });
  it("rejects cross-owner repertoires and manual nonmembers atomically", async () => {
    add("tune");
    await expect(
      updateGoalPracticeQueue(db, { ...request, repertoireId: "foreign" })
    ).rejects.toThrow(/unavailable/);
    await expect(
      run({ kind: "manual", tuneIds: ["tune", "missing"] })
    ).rejects.toThrow(/not active/);
    expect(db.select().from(dailyPracticeQueue).all()).toEqual([]);
  });
  it("freezes legacy allocation once and preserves completion/displayed event metadata", async () => {
    add("tune");
    queue("tune", {
      completedAt: stamp,
      displayedPracticeRecordId: "historical",
      exposuresCompleted: 2,
    });
    const first = await run();
    raw.run("UPDATE repertoire_tune SET goal_id = ?, goal = 'fluency'", [
      fluency.id,
    ]);
    const second = await run();
    expect(second.rows).toEqual(first.rows);
    expect(second.rows[0]).toMatchObject({
      allocationGoalId: recall.id,
      selectionReason: null,
      displayedPracticeRecordId: "historical",
      exposuresCompleted: 2,
    });
  });
  it("Refresh preserves completed and note-only drafts even above a reduced maximum", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    add("done");
    add("draft");
    add("extra");
    queue("done", {
      completedAt: stamp,
      displayedPracticeRecordId: "event",
      orderIndex: 0,
      allocationGoalId: recall.id,
    });
    queue("draft", { orderIndex: 1, allocationGoalId: recall.id });
    db.insert(tableTransientData)
      .values({
        userId: "owner",
        repertoireId: "rep",
        tuneId: "draft",
        notePrivate: "Keep this",
      })
      .run();
    const before = db.select().from(dailyPracticeQueue).all();
    expect((await run({ kind: "refresh" })).rows).toEqual(before);
    expect(db.select().from(tableTransientData).get()?.notePrivate).toBe(
      "Keep this"
    );
  });
  it("a retained allocation counts against its original goal after a goal change", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    add("done", stamp, fluency);
    add("recall-other");
    add("fluency-other", stamp, fluency);
    queue("done", { completedAt: stamp, allocationGoalId: recall.id });
    expect(ids(await run({ kind: "refresh" }))).toEqual([
      "done",
      "fluency-other",
    ]);
  });
  it("Refresh deactivates unselected rows and reuses IDs without deleting history", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    add("a");
    add("b");
    queue("b");
    expect(ids(await run({ kind: "refresh" }))).toEqual(["a"]);
    const inactive = db
      .select()
      .from(dailyPracticeQueue)
      .all()
      .find((row) => row.tuneRef === "b");
    expect(inactive?.active).toBe(0);
    const result = await run({ kind: "manual", tuneIds: ["b"] });
    expect(result.rows.find((row) => row.tuneRef === "b")?.id).toBe("q-b");
    expect(db.select().from(dailyPracticeQueue).all()).toHaveLength(2);
  });
  it("manual additions are explicit limit exceptions and preserve actual due snapshots", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    add("a");
    add("b", "2027-01-01T00:00:00Z");
    await run();
    const result = await run({ kind: "manual", tuneIds: ["b", "b"] });
    expect(ids(result)).toEqual(["a", "b"]);
    expect(result.rows[1]).toMatchObject({
      selectionReason: "manual",
      scheduledSnapshot: "2027-01-01T00:00:00Z",
      allocationGoalId: recall.id,
    });
  });
  it("add-more shares category priority and does not select existing or practiced tunes", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    add("a");
    add("recent", "2026-11-15T00:00:00Z");
    add("old", "2025-01-01T00:00:00Z");
    add("practiced");
    history("practiced", stamp, stamp);
    await run();
    const result = await run({ kind: "add-more", count: 2 });
    expect(ids(result)).toEqual(["a", "recent", "old"]);
    expect(result.rows.slice(1).map((row) => row.selectionReason)).toEqual([
      "manual",
      "manual",
    ]);
  });
  it("manual additions honor a selected older queue rather than the latest window", async () => {
    add("a");
    add("b");
    add("new");
    queue("a", {
      windowStartUtc: "2026-11-14T00:00:00Z",
      windowEndUtc: "2026-11-15T00:00:00Z",
    });
    queue("b");
    const result = await run({
      kind: "manual",
      tuneIds: ["new"],
      windowStart: "2026-11-14 00:00:00",
    });
    expect(ids(result)).toEqual(["a", "new"]);
    expect(result.rows[1].windowStartUtc).toBe("2026-11-14T00:00:00Z");
  });
  it("bad timestamps do not destroy a queue on Refresh", async () => {
    add("tune", "not-a-date");
    queue("tune");
    const before = db.select().from(dailyPracticeQueue).all();
    await expect(run({ kind: "refresh" })).rejects.toThrow(/timestamp/);
    expect(db.select().from(dailyPracticeQueue).all()).toEqual(before);
  });
  it("a later insert failure rolls back legacy attribution and all earlier inserts", async () => {
    add("existing");
    add("a");
    add("z");
    queue("existing");
    raw.exec(
      "CREATE TRIGGER fail_queue BEFORE INSERT ON daily_practice_queue WHEN NEW.tune_ref = 'z' BEGIN SELECT RAISE(ABORT, 'test failure'); END;"
    );
    const before = db.select().from(dailyPracticeQueue).all();
    await expect(run({ kind: "manual", tuneIds: ["a", "z"] })).rejects.toThrow(
      /test failure/
    );
    expect(db.select().from(dailyPracticeQueue).all()).toEqual(before);
  });
  it("manual retries persist an in-memory success without inserting duplicates", async () => {
    add("tune");
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk full"));
    await expect(run({ kind: "manual", tuneIds: ["tune"] })).rejects.toThrow(
      /saving it failed/
    );
    const before = db.select().from(dailyPracticeQueue).all();
    expect((await run({ kind: "manual", tuneIds: ["tune"] })).rows).toEqual(
      before
    );
    expect(persistDb).toHaveBeenCalledTimes(2);
  });
});

describe("queue persistence and window safeguards", () => {
  it("retries add-more persistence from its receipt without selecting another tune", async () => {
    settings(recall, { minimum: 0, maximum: 1 });
    add("a");
    add("b");
    add("c");
    await run();
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk full"));
    const error = await run({ kind: "add-more", count: 1 }).catch(
      (failure: unknown) => failure
    );
    expect(error).toBeInstanceOf(GoalQueuePersistenceError);
    if (!(error instanceof GoalQueuePersistenceError))
      throw new Error("Missing persistence receipt");
    const result = await persistGoalQueueResult(error.result);
    expect(ids(result)).toEqual(["a", "b"]);
    expect(db.select().from(dailyPracticeQueue).all()).toHaveLength(2);
  });
  it("does not reset an inactive completed row through manual addition", async () => {
    add("done");
    queue("done", {
      active: 0,
      completedAt: stamp,
      displayedPracticeRecordId: "event",
    });
    const before = db.select().from(dailyPracticeQueue).all();
    await expect(run({ kind: "manual", tuneIds: ["done"] })).rejects.toThrow(
      /Practice again/
    );
    expect(db.select().from(dailyPracticeQueue).all()).toEqual(before);
  });
  it("does not merge conflicting equivalent-window rows silently", async () => {
    add("tune");
    queue("tune");
    queue("tune", { id: "duplicate", windowStartUtc: "2026-11-16T00:00:00Z" });
    await expect(run()).rejects.toThrow(/Duplicate queue/);
    expect(
      db
        .select()
        .from(dailyPracticeQueue)
        .all()
        .every((row) => row.allocationGoalId === null)
    ).toBe(true);
  });
  it("uses the local practice-day boundary, including its exclusive end", async () => {
    settings(recall, { minimum: 0 });
    add("before", "2026-11-16T04:59:59.999999Z");
    add("start", "2026-11-16T05:00:00Z");
    add("end", "2026-11-17T05:00:00Z");
    const result = await updateGoalPracticeQueue(db, {
      ...request,
      localTzOffsetMinutes: -300,
    });
    expect(ids(result)).toEqual(["start", "before"]);
    expect(result.rows.map((row) => row.selectionReason)).toEqual([
      "due_today",
      "recent_overdue",
    ]);
  });
});

describe("empty-day additions", () => {
  it.each(["add-more", "manual"] as const)(
    "%s targets the requested empty day rather than yesterday",
    async (kind) => {
      settings(recall, { minimum: 0 });
      add("future", "2027-01-01T00:00:00Z");
      queue("historical", {
        windowStartUtc: "2026-11-15T00:00:00Z",
        windowEndUtc: "2026-11-16T00:00:00Z",
      });
      expect(ids(await run())).toEqual([]);
      const actions = {
        "add-more": { kind: "add-more", count: 1 },
        manual: { kind: "manual", tuneIds: ["future"] },
      } satisfies Record<string, GoalQueueAction>;
      const result = await run(actions[kind]);
      expect(ids(result)).toEqual(["future"]);
      expect(result.rows[0].windowStartUtc).toBe("2026-11-16 00:00:00");
    }
  );
  it("rejects an explicitly selected missing old window instead of redirecting", async () => {
    add("tune");
    queue("tune");
    const before = db.select().from(dailyPracticeQueue).all();
    await expect(
      run({ kind: "add-more", count: 1, windowStart: "2026-11-14T00:00:00Z" })
    ).rejects.toThrow(/window is unavailable/);
    expect(db.select().from(dailyPracticeQueue).all()).toEqual(before);
  });
  it("permits an explicitly selected empty current day", async () => {
    add("tune");
    const result = await run({
      kind: "manual",
      tuneIds: ["tune"],
      windowStart: "2026-11-16T00:00:00Z",
    });
    expect(ids(result)).toEqual(["tune"]);
  });
});

it("keeps frozen row identities when a saved daily maximum is lowered", async () => {
  add("a");
  add("b");
  add("c");
  const original = await run();
  settings(recall, { minimum: 0, maximum: 1 });
  expect((await run()).rows).toEqual(original.rows);
  expect((await run({ kind: "refresh" })).rows).toHaveLength(1);
});

it("loads an existing UTC window with fractional seconds without replacing completed rows", async () => {
  add("done");
  queue("done", {
    windowStartUtc: "2026-11-16 00:00:00.000Z",
    windowEndUtc: "2026-11-17 00:00:00.000Z",
    completedAt: stamp,
    displayedPracticeRecordId: "event",
  });
  const result = await updateGoalPracticeQueue(db, {
    ...request,
    localTzOffsetMinutes: 0,
  });
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({
    id: "q-done",
    completedAt: stamp,
    displayedPracticeRecordId: "event",
  });
  expect(db.select().from(dailyPracticeQueue).all()).toHaveLength(1);
});

it("adds to the selected historical window with fractional UTC timestamps", async () => {
  add("existing");
  add("extra", "2026-11-13T12:00:00Z");
  queue("existing", {
    windowStartUtc: "2026-11-14 00:00:00.000Z",
    windowEndUtc: "2026-11-15 00:00:00.000Z",
  });
  const result = await run({
    kind: "add-more",
    count: 1,
    windowStart: "2026-11-14T00:00:00",
  });
  expect(ids(result)).toEqual(["existing", "extra"]);
  expect(result.rows.map((row) => row.windowStartUtc)).toEqual([
    "2026-11-14 00:00:00.000Z",
    "2026-11-14 00:00:00.000Z",
  ]);
});
