import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { afterEach, expect, it, vi } from "vitest";
import type { SqliteDatabase } from "@/lib/db/client-sqlite";
import { commitStagedEvaluations } from "@/lib/services/practice-recording";

const { persist } = vi.hoisted(() => ({ persist: vi.fn() }));
vi.mock("@/lib/db/client-sqlite", () => ({ persistDb: persist }));
afterEach(() => vi.restoreAllMocks());

it("commits the original rating and preserves a same-value revision staged while pending", async () => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  let finishPersistence!: () => void;
  persist.mockReturnValue(
    new Promise<void>((resolve) => {
      finishPersistence = resolve;
    })
  );
  const original = {
    tune_id: "tune",
    quality: 3,
    difficulty: 4,
    stability: 3,
    interval: 2,
    step: 2,
    repetitions: 2,
    practiced: "2026-04-05T12:00:00.000Z",
    due: "2026-04-07T12:00:00.000Z",
    state: 2,
    goal: "recall",
    technique: "fsrs",
    recall_eval: "good",
  };
  let staged: typeof original | undefined = original;
  const recordedIntervals: unknown[] = [];
  const dialect = new SQLiteSyncDialect();
  // Model just the synchronous commit queries; persistence is the controlled
  // asynchronous boundary where a user can stage another revision.
  const db = {
    all(statement: SQL) {
      const { sql } = dialect.sqlToQuery(statement);
      if (sql.includes("FROM table_transient_data"))
        return staged ? [staged] : [];
      if (sql.includes("FROM daily_practice_queue"))
        return [
          { tune_ref: "tune", scheduled_snapshot: null, generated_at: null },
        ];
      return [];
    },
    get(statement: SQL) {
      const { sql } = dialect.sqlToQuery(statement);
      if (sql.includes("FROM daily_practice_queue"))
        return { completed_at: "2026-04-05T12:00:00.000Z" };
      return undefined;
    },
    run(statement: SQL) {
      const { sql, params } = dialect.sqlToQuery(statement);
      if (sql.includes("INSERT INTO practice_record"))
        recordedIntervals.push(params[5]);
      if (sql.includes("DELETE FROM table_transient_data")) staged = undefined;
    },
  } as unknown as SqliteDatabase;

  const committing = commitStagedEvaluations(
    db,
    "user",
    "rep",
    "2026-04-05T00:00:00"
  );
  const newer = { ...original, interval: 7 };
  staged = newer;
  finishPersistence();
  expect(await committing).toEqual({ success: true, count: 1 });
  expect(recordedIntervals).toEqual([2]);
  expect(staged).toBe(newer);
});
