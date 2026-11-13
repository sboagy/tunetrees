// @vitest-environment jsdom

import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ITuneOverview } from "@/components/grids/types";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { repertoireTune } from "@/lib/db/schema";
import type { NextReviewSchedule } from "@/lib/db/types";
import { usePracticeEvaluations } from "@/routes/practice/usePracticeEvaluations";

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  getUserId: vi.fn(),
  persist: vi.fn(),
  error: vi.fn(),
  refresh: vi.fn(),
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
let practiceRows: ITuneOverview[];
let stagedRows: Map<string, { recall_eval: string; interval: number }>;
let goals: Map<string, string | null>;
const dialect = new SQLiteSyncDialect();
// Compile Drizzle predicates/parameters without opening a native database.
// The fake implements only the synchronous reads/writes used by staging.
function createDbFake(): SqliteDatabase {
  return {
    run(statement: SQL) {
      const { sql, params } = dialect.sqlToQuery(statement);
      const tuneId = String(params[1]);
      if (sql.trimStart().startsWith("INSERT")) {
        stagedRows.set(tuneId, {
          recall_eval: String(params[14]),
          interval: Number(params[6]),
        });
      } else if (sql.trimStart().startsWith("DELETE")) {
        stagedRows.delete(tuneId);
      } else throw new Error(`Unexpected statement: ${sql}`);
    },
    select() {
      return {
        from: (table: unknown) => ({
          where: (predicate: SQL) => ({
            get: () => {
              const { params } = dialect.sqlToQuery(predicate);
              if (table === repertoireTune)
                return { goal: goals.get(String(params[0])) };
              const row = stagedRows.get(String(params[1]));
              return row ? { recallEval: row.recall_eval } : undefined;
            },
          }),
        }),
      };
    },
    update() {
      return {
        set: ({ goal }: { goal: string | null }) => ({
          where: (predicate: SQL) => ({
            run: () => {
              const { params } = dialect.sqlToQuery(predicate);
              goals.set(String(params[0]), goal);
            },
          }),
        }),
      };
    },
  } as unknown as SqliteDatabase;
}
let db: SqliteDatabase;
let state: ReturnType<typeof usePracticeEvaluations>;
let dispose: () => void;
let setRepertoire: (value: string) => string;
beforeEach(async () => {
  vi.clearAllMocks();
  practiceRows = [];
  mocks.getUserId.mockResolvedValue("user");
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.persist.mockResolvedValue(undefined);
  stagedRows = new Map();
  goals = new Map([
    ["tune", "fluency"],
    ["other", "fluency"],
  ]);
  db = createDbFake();
  createRoot((cleanup) => {
    dispose = cleanup;
    const [repertoire, set] = createSignal("rep");
    setRepertoire = set;
    state = usePracticeEvaluations({
      localDb: () => db,
      getUserId: () => mocks.getUserId(),
      currentRepertoireId: repertoire,
      practiceListData: () => practiceRows,
      filteredPracticeList: () => [],
      goalsMap: () => new Map(),
      incrementPracticeListStagedChanged: mocks.refresh,
      suppressNextViewRefresh: () => {},
    });
  });
  await Promise.resolve();
});
afterEach(() => {
  dispose();
  vi.restoreAllMocks();
});
const row = () => stagedRows.get("tune");
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
describe("staging request ownership with synchronous writes", () => {
  it("preserves a same-value rating started after the submission snapshot", async () => {
    mocks.evaluate.mockResolvedValueOnce(schedule(2));
    await state.handleRecallEvalChange("tune", "good");
    const clearSubmitted = state.prepareClearEvaluations();
    const later = await begin("good");
    clearSubmitted();
    expect(state.isStaging()).toBe(true);
    expect(state.evaluations().tune).toBe("good");
    later.resolve(schedule(7));
    await later.task;
    expect(row()).toEqual({ recall_eval: "good", interval: 7 });
  });
  it("clears submitted overrides but retains a later completed edit", async () => {
    mocks.evaluate.mockResolvedValue(schedule(2));
    await state.handleRecallEvalChange("other", "hard");
    const clearSubmitted = state.prepareClearEvaluations();
    await state.handleRecallEvalChange("tune", "easy");
    clearSubmitted();
    expect(state.evaluations()).toEqual({ tune: "easy" });
  });
  it("refreshes the stored goal after persistence fails", async () => {
    mocks.persist.mockRejectedValueOnce(new Error("persist failed"));
    await state.handleGoalChange("tune", "recall");
    expect(goals.get("tune")).toBe("recall");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
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
  it("restores the staged rating when a newer rating fails while an older one is pending", async () => {
    mocks.evaluate.mockResolvedValueOnce(schedule(2));
    await state.handleRecallEvalChange("tune", "hard");
    const older = await begin("good");
    const newer = await begin("easy");
    newer.reject(new Error("scheduling failed"));
    await newer.task;
    // "good" was only the older request's optimistic value; "hard" is staged.
    expect(state.evaluations().tune).toBe("hard");
    older.resolve(schedule(4));
    await older.task;
    expect(state.evaluations().tune).toBe("hard");
    expect(row()).toEqual({ recall_eval: "hard", interval: 2 });
  });
  it("does not restore a cancelled optimistic rating when the goal change fails", async () => {
    const pending = await begin("good");
    mocks.persist.mockRejectedValueOnce(new Error("persist failed"));
    await state.handleGoalChange("tune", "recall");
    // Nothing is staged, so Submit must not count the cancelled rating.
    expect(state.evaluations().tune).toBeFalsy();
    expect(state.evaluationsCount()).toBe(0);
    pending.resolve(schedule(4));
    await pending.task;
    expect(row()).toBeUndefined();
    expect(state.evaluationsCount()).toBe(0);
  });
  it("reconciles a failed goal clear even when user lookup finishes after the goal task", async () => {
    mocks.evaluate.mockResolvedValueOnce(schedule(2));
    await state.handleRecallEvalChange("tune", "hard");
    // Only these overview fields are consumed by the hook. Keep the view stale
    // after SQLite clears its row to reproduce the original phantom Submit count.
    practiceRows = [
      { id: "tune", has_staged: 1, recall_eval: "hard" } as ITuneOverview,
    ];
    const persistence = deferred<void>();
    mocks.persist.mockReturnValueOnce(persistence.promise);
    const goal = state.handleGoalChange("tune", "recall");
    await vi.waitFor(() => expect(row()).toBeUndefined());

    const userLookup = deferred<string>();
    mocks.getUserId.mockReturnValueOnce(userLookup.promise);
    const rating = state.handleRecallEvalChange("tune", "good");
    persistence.reject(new Error("persist failed"));
    await goal;
    // The goal has already left the pending map when lookup returns. The
    // rating must retain its rejected task and recover from SQLite, not stage.
    userLookup.resolve("user");
    await rating;

    expect(row()).toBeUndefined();
    expect(state.evaluations().tune).toBe("");
    expect(state.evaluationsCount()).toBe(0);
    expect(state.isStaging()).toBe(false);
    expect(mocks.evaluate).toHaveBeenCalledTimes(1);
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
    expect(stagedRows.size).toBe(2);
  });
});
