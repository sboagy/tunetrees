// @vitest-environment jsdom
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import type { NextReviewSchedule } from "@/lib/db/types";
import { usePracticeEvaluations } from "@/routes/practice/usePracticeEvaluations";

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  persist: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/db/client-sqlite", () => ({ persistDb: mocks.persist }));
vi.mock("@/lib/services/practice-recording", () => ({
  evaluatePractice: mocks.evaluate,
}));
vi.mock("solid-sonner", () => ({ toast: { error: mocks.error } }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function schedule(interval: number): { schedule: NextReviewSchedule } {
  const now = new Date();
  const due = new Date(now);
  due.setDate(due.getDate() + interval);
  return {
    schedule: {
      nextDue: due,
      last_review: now,
      interval,
      state: 2,
      stability: 3,
      difficulty: 4,
      elapsed_days: 1,
      scheduled_days: interval,
      reps: 2,
      lapses: 0,
    },
  };
}
let sqlite: InstanceType<typeof Database>;
let db: SqliteDatabase;
let state: ReturnType<typeof usePracticeEvaluations>;
let dispose: () => void;
let setRepertoire: (value: string) => string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.persist.mockResolvedValue(undefined);
  sqlite = new Database(":memory:");
  sqlite.exec(`CREATE TABLE repertoire_tune (repertoire_ref TEXT, tune_ref TEXT, goal TEXT);
    INSERT INTO repertoire_tune VALUES ('rep','tune','fluency'),('rep','other','fluency');
    CREATE TABLE table_transient_data (user_id TEXT, tune_id TEXT, repertoire_id TEXT, quality INTEGER,
    difficulty REAL, stability REAL, interval INTEGER, step INTEGER, repetitions INTEGER, practiced TEXT,
    due TEXT, state INTEGER, goal TEXT, technique TEXT, recall_eval TEXT, sync_version INTEGER,
    last_modified_at TEXT, PRIMARY KEY(user_id,tune_id,repertoire_id));`);
  // Same synchronous SQLite/Drizzle operations as the browser service, with a
  // native in-memory driver at this test boundary. Only scheduling is delayed.
  db = drizzle(sqlite) as unknown as SqliteDatabase;
  createRoot((cleanup) => {
    dispose = cleanup;
    const [repertoire, set] = createSignal("rep");
    setRepertoire = set;
    state = usePracticeEvaluations({
      localDb: () => db,
      getUserId: async () => "user",
      currentRepertoireId: repertoire,
      practiceListData: () => [],
      filteredPracticeList: () => [],
      goalsMap: () => new Map(),
      incrementPracticeListStagedChanged: () => {},
      suppressNextViewRefresh: () => {},
    });
  });
  await Promise.resolve();
});
afterEach(() => {
  dispose();
  sqlite.close();
  vi.restoreAllMocks();
});
const row = () =>
  sqlite
    .prepare(
      "SELECT recall_eval, interval FROM table_transient_data WHERE tune_id = ?"
    )
    .get("tune");
const begin = async (value: string) => {
  const reply = deferred<ReturnType<typeof schedule>>();
  mocks.evaluate.mockReturnValueOnce(reply.promise);
  const count = mocks.evaluate.mock.calls.length;
  const task = state.handleRecallEvalChange("tune", value);
  // Wait for the scheduling boundary, not an arbitrary wall-clock delay.
  await vi.waitFor(() =>
    expect(mocks.evaluate).toHaveBeenCalledTimes(count + 1)
  );
  return { ...reply, task };
};
describe("staging request ownership with real SQLite writes", () => {
  it("keeps Submit blocked when an older rating finishes first", async () => {
    const first = await begin("good");
    const second = await begin("easy");
    first.resolve(schedule(4));
    await first.task;
    expect(state.isStaging()).toBe(true);
    expect(row()).toBeUndefined();
    second.resolve(schedule(7));
    await second.task;
    expect(row()).toEqual({ recall_eval: "easy", interval: 7 });
    expect(state.isStaging()).toBe(false);
  });
  it("does not overwrite a newer result when the older rating finishes last", async () => {
    const first = await begin("good");
    const second = await begin("easy");
    second.resolve(schedule(7));
    await second.task;
    first.resolve(schedule(4));
    await first.task;
    expect(row()).toEqual({ recall_eval: "easy", interval: 7 });
    expect(state.evaluations().tune).toBe("easy");
  });
  it("ignores a stale rejection after a newer success", async () => {
    const first = await begin("good");
    const second = await begin("easy");
    second.resolve(schedule(7));
    await second.task;
    first.reject(new Error("old scheduling failure"));
    await first.task;
    expect(row()).toEqual({ recall_eval: "easy", interval: 7 });
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("does not resurrect a cleared evaluation", async () => {
    const first = await begin("good");
    await state.handleRecallEvalChange("tune", "");
    first.resolve(schedule(4));
    await first.task;
    expect(row()).toBeUndefined();
    expect(state.evaluationsCount()).toBe(0);
  });
  it("invalidates scheduling when the goal changes", async () => {
    const first = await begin("good");
    await state.handleGoalChange("tune", "recall");
    first.resolve(schedule(4));
    await first.task;
    expect(row()).toBeUndefined();
    expect(state.evaluationsCount()).toBe(0);
  });
  it("waits for a goal write before staging a new rating", async () => {
    const persistence = deferred<void>();
    mocks.persist.mockReturnValueOnce(persistence.promise);
    const goal = state.handleGoalChange("tune", "recall");
    await vi.waitFor(() => expect(mocks.persist).toHaveBeenCalledOnce());
    mocks.evaluate.mockResolvedValueOnce(schedule(5));
    const rating = state.handleRecallEvalChange("tune", "good");
    expect(state.isStaging()).toBe(true);
    expect(mocks.evaluate).not.toHaveBeenCalled();
    persistence.resolve();
    await goal;
    await rating;
    expect(mocks.evaluate.mock.calls[0]?.[2]).toMatchObject({ goal: "recall" });
    expect(row()).toEqual({ recall_eval: "good", interval: 5 });
  });
  it("invalidates old work on repertoire change", async () => {
    const first = await begin("good");
    setRepertoire("another-repertoire");
    first.resolve(schedule(4));
    await first.task;
    expect(row()).toBeUndefined();
    expect(state.isStaging()).toBe(false);
  });
  it("invalidates work when the view is disposed", async () => {
    const first = await begin("good");
    dispose();
    first.resolve(schedule(4));
    await first.task;
    expect(row()).toBeUndefined();
  });
  it("keeps independent tunes pending separately", async () => {
    const first = await begin("good");
    mocks.evaluate.mockResolvedValueOnce(schedule(7));
    await state.handleRecallEvalChange("other", "easy");
    expect(state.isStaging()).toBe(true);
    first.resolve(schedule(4));
    await first.task;
    expect(
      sqlite.prepare("SELECT count(*) AS count FROM table_transient_data").get()
    ).toEqual({ count: 2 });
  });
});
