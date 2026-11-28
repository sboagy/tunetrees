import { readFileSync } from "node:fs";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "@oosync/runtime/sqlite-wasm-adapter";
import { drizzle } from "drizzle-orm/sql-js";
import {
  newQuickJSAsyncWASMModule,
  type QuickJSAsyncRuntime,
} from "quickjs-emscripten";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import codegenConfig from "../../../oosync.codegen.config.json";
import { expectSqliteTriggerFailure } from "../../../tests/helpers/expected-console";
import { persistDb } from "../db/client-sqlite";
import {
  getFsrsRetentionCurve,
  getStalenessData,
} from "../db/queries/analysis";
import {
  getLatestPracticeRecord,
  getPracticeHistory,
  getPracticeRecords,
} from "../db/queries/practice";
import { getPracticeRecordsForTune } from "../db/queries/practice-records";
import {
  dailyPracticeQueue,
  goal,
  goalUserSettings,
  plugin,
  practiceRecord,
  repertoireTune,
  tableTransientData,
} from "../db/schema";
import { executePlugin } from "../plugins/quickjs-core";
import * as pluginRuntime from "../plugins/runtime";
import {
  computeSchedulingWindows,
  generateDailyPracticeQueue,
} from "../services/queue-generator";
import {
  normalizePracticeTimestamp,
  orderPracticeHistory,
} from "../utils/practice-history";
import { changePracticeGoals } from "./assignment";
import { getBuiltInGoals } from "./builtins";
import {
  commitGoalPracticeEvaluations,
  type GoalCommitItem,
  GoalPracticePersistenceError,
  readGoalCommitItems,
} from "./commit";
import { canonicalJson } from "./config";
import {
  ManualPracticePersistenceError,
  ManualPracticeRemovedError,
  prepareManualPractice,
  saveManualPractice,
} from "./manual-practice";
import { readHistoryEvent } from "./practice-history";
import { readPracticeSession } from "./practice-session";
import {
  practiceContextFingerprints,
  prepareGoalPracticePreview,
  prepareLadderDuePreviews,
} from "./preview";
import { readGoalPracticeContext, resolveGoalReference } from "./resolve";
import {
  clearGoalPracticeEvaluation,
  clearReviewedDraftNotes,
  stageGoalPracticeEvaluation,
} from "./staging";

vi.mock("../db/client-sqlite", () => ({ persistDb: vi.fn() }));

let raw: ReturnType<typeof createSqliteWasmDatabase>;
let db: ReturnType<typeof drizzle>;
const stamp = "2026-11-16T12:00:00Z";
const recall = getBuiltInGoals()[0];
const fluency = getBuiltInGoals().find((row) => row.name === "fluency");
if (!fluency) throw new Error("Missing fixture");
const fluencyId = fluency.id;
const context = () => readGoalPracticeContext(db, "owner", "rep", "tune");
function assign(goalId: string | null, key = "recall") {
  raw.run(
    "UPDATE repertoire_tune SET goal_id = ?, goal = ? WHERE repertoire_ref = 'rep'",
    [goalId, key]
  );
}
function event(id: string, practiced: string | null = stamp, modified = stamp) {
  db.insert(practiceRecord)
    .values({
      id,
      repertoireRef: "rep",
      tuneRef: "tune",
      practiced,
      lastModifiedAt: modified,
      goal: "recall",
      due: "2026-11-20T12:00:00Z",
      stability: 12,
      difficulty: 5,
      repetitions: 10,
      lapses: 1,
      state: 2,
    })
    .run();
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
  // Same supported sql.js-compatible adapter boundary as the browser runtime.
  db = drizzle(raw as never);
  raw.run(
    "INSERT INTO user_profile (id, last_modified_at) VALUES ('owner', ?), ('other', ?)",
    [stamp, stamp]
  );
  raw.run(
    "INSERT INTO repertoire (repertoire_id,user_ref,last_modified_at) VALUES ('rep','owner',?),('rep2','owner',?),('foreign','other',?)",
    [stamp, stamp, stamp]
  );
  raw.run(
    "INSERT INTO tune (id,last_modified_at) VALUES ('tune',?),('second',?)",
    [stamp, stamp]
  );
  db.insert(repertoireTune)
    .values([
      {
        repertoireRef: "rep",
        tuneRef: "tune",
        goal: "recall",
        lastModifiedAt: stamp,
      },
      {
        repertoireRef: "rep2",
        tuneRef: "tune",
        goal: "recall",
        lastModifiedAt: stamp,
      },
    ])
    .run();
  // Migrations contain legacy seeds; install the current typed definitions.
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
  vi.restoreAllMocks();
  vi.mocked(persistDb).mockReset();
});

describe("owner-scoped goal practice context", () => {
  it("rejects another user's repertoire before reading practice data", () => {
    expect(() => readGoalPracticeContext(db, "other", "rep", "tune")).toThrow(
      /unavailable/
    );
  });
  it("rejects a tune outside the repertoire", () => {
    expect(() => readGoalPracticeContext(db, "owner", "rep", "second")).toThrow(
      /not active/
    );
  });
  it("applies owner overrides across repertoires without another owner's settings", () => {
    db.insert(goalUserSettings)
      .values([
        {
          userId: "owner",
          goalId: recall.id,
          overrides: '{"displayName":"My Recall"}',
          lastModifiedAt: stamp,
        },
        {
          userId: "other",
          goalId: recall.id,
          overrides: '{"displayName":"Secret"}',
          lastModifiedAt: stamp,
        },
      ])
      .run();
    expect(context().displayName).toBe("My Recall");
    expect(
      readGoalPracticeContext(db, "owner", "rep2", "tune").displayName
    ).toBe("My Recall");
  });
  it("ignores tombstoned overrides", () => {
    db.insert(goalUserSettings)
      .values({
        userId: "owner",
        goalId: recall.id,
        overrides: '{"displayName":"Removed"}',
        deleted: 1,
        lastModifiedAt: stamp,
      })
      .run();
    expect(context().displayName).toBe(recall.displayName);
  });
  it("resolves owner legacy names before system names", () => {
    db.insert(goal)
      .values({
        id: "custom",
        name: "recall",
        privateFor: "owner",
        defaultConfig: canonicalJson(recall.config),
        lastModifiedAt: stamp,
      })
      .run();
    event("old");
    const result = context();
    expect(result.goalId).toBe("custom");
    expect(result.legacyGoalId).toBe("custom");
  });
  it("recognizes an active legacy-key edit without relabeling attributed history", () => {
    assign(recall.id, "fluency");
    const rows = db.select().from(goal).all();
    expect(context().goalId).toBe(fluencyId);
    expect(
      resolveGoalReference(
        rows,
        "owner",
        { goalId: recall.id, goal: "fluency" },
        true
      )?.id
    ).toBe(recall.id);
  });
  it("falls back visibly for inaccessible goals without exposing their definition", () => {
    db.insert(goal)
      .values({
        id: "private",
        name: "secret",
        privateFor: "other",
        defaultConfig: "not-json",
        lastModifiedAt: stamp,
      })
      .run();
    assign("private", "secret");
    expect(context()).toMatchObject({
      goalId: recall.id,
      notices: ["Assigned goal is unavailable; using Recall"],
    });
  });
  it("falls back for a deleted goal but preserves history attribution and dates", () => {
    raw.run("UPDATE goal SET deleted = 1 WHERE id = ?", [fluencyId]);
    assign(fluencyId, "fluency");
    event("old");
    raw.run("UPDATE practice_record SET goal_id = ?, goal = 'fluency'", [
      fluencyId,
    ]);
    const result = context();
    expect(result.goalId).toBe(recall.id);
    expect(result.legacyGoalId).toBe(fluencyId);
    expect(result.predecessor?.due).toBe("2026-11-20T12:00:00Z");
    expect(result.notices).toHaveLength(1);
  });
  it("attributes legacy history to a deleted owner goal instead of the same-named system goal", () => {
    db.insert(goal)
      .values({
        id: "old-private",
        name: "recall",
        privateFor: "owner",
        deleted: 1,
        lastModifiedAt: stamp,
      })
      .run();
    event("old");
    expect(context().goalId).toBe(recall.id);
    expect(context().legacyGoalId).toBe("old-private");
  });
  it("does not hide corrupt goal configuration behind defaults", () => {
    raw.run("UPDATE goal SET default_config = '{}' WHERE id = ?", [recall.id]);
    expect(context).toThrow(/version/);
  });
  it("does not guess the semantics of an unconverted custom goal", () => {
    db.insert(goal)
      .values({
        id: "custom",
        name: "custom",
        privateFor: "owner",
        lastModifiedAt: stamp,
      })
      .run();
    assign("custom", "custom");
    expect(context).toThrow(/explicit configuration/);
  });
  it("counts only active repertoire tunes assigned to this effective goal", () => {
    db.insert(repertoireTune)
      .values({
        repertoireRef: "rep",
        tuneRef: "second",
        goal: "fluency",
        lastModifiedAt: stamp,
      })
      .run();
    expect(context().goalTuneCount).toBe(1);
    raw.run(
      "UPDATE repertoire_tune SET goal='missing' WHERE tune_ref='second'"
    );
    expect(context().goalTuneCount).toBe(2);
    raw.run("UPDATE tune SET deleted=1 WHERE id='second'");
    expect(context().goalTuneCount).toBe(1);
  });
});

// Perform a real intervening SQLite mutation while calculation is awaiting crypto.
function duringCalculation(action: () => void) {
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(
    (algorithm, data) => {
      action();
      return digest(algorithm, data);
    }
  );
}

describe("goal assignment changes", () => {
  const input = () => ({
    userId: "owner",
    repertoireId: "rep",
    tuneIds: ["tune"],
    goal: "fluency",
  });
  it("changes both identity fields without enqueuing or rescheduling a tune", async () => {
    event("history");
    raw.run(
      "UPDATE repertoire_tune SET scheduled = '2026-12-01T12:00:00Z' WHERE repertoire_ref = 'rep'"
    );
    const before = db.select().from(practiceRecord).all();
    await changePracticeGoals(db, input(), () => true);
    expect(context()).toMatchObject({ goalId: fluencyId, goalKey: "fluency" });
    expect(
      raw.exec(
        "SELECT goal_id, goal, scheduled FROM repertoire_tune WHERE repertoire_ref='rep'"
      )[0].values
    ).toEqual([[fluencyId, "fluency", "2026-12-01T12:00:00Z"]]);
    expect(db.select().from(practiceRecord).all()).toEqual(before);
    expect(db.select().from(dailyPracticeQueue).all()).toEqual([]);
  });
  it("clears incompatible evaluation state but preserves draft notes", async () => {
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date(stamp),
      },
      () => true
    );
    raw.run("UPDATE table_transient_data SET note_private='Keep my note'");
    expect(await changePracticeGoals(db, input(), () => true)).toMatchObject({
      clearedEvaluations: 1,
    });
    expect(db.select().from(tableTransientData).get()).toMatchObject({
      notePrivate: "Keep my note",
      evaluationId: null,
      schedulerState: null,
    });
  });
  it("does not clear a staged evaluation when the effective goal is unchanged", async () => {
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date(stamp),
      },
      () => true
    );
    const before = db.select().from(tableTransientData).get();
    await changePracticeGoals(db, { ...input(), goal: "recall" }, () => true);
    expect(db.select().from(tableTransientData).get()).toEqual(before);
  });
  it("clears a deleted goal's draft when selecting the effective Recall fallback", async () => {
    await changePracticeGoals(db, input(), () => true);
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "effortless",
        practiced: new Date(stamp),
      },
      () => true
    );
    raw.run("UPDATE table_transient_data SET note_private='Keep my note'");
    raw.run("UPDATE goal SET deleted=1 WHERE id=?", [fluencyId]);
    expect(
      await changePracticeGoals(db, { ...input(), goal: "recall" }, () => true)
    ).toMatchObject({ clearedEvaluations: 1 });
    expect(db.select().from(tableTransientData).get()).toMatchObject({
      evaluationId: null,
      notePrivate: "Keep my note",
    });
  });
  it("persists an unchanged-goal retry after the first save fails", async () => {
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(changePracticeGoals(db, input(), () => true)).rejects.toThrow(
      "disk unavailable"
    );
    expect(context().goalId).toBe(fluencyId);
    vi.mocked(persistDb).mockClear();
    await changePracticeGoals(db, input(), () => true);
    expect(persistDb).toHaveBeenCalledOnce();
    expect(context().goalId).toBe(fluencyId);
  });
  it("can leave a goal whose scheduler configuration is invalid", async () => {
    raw.run("UPDATE goal SET default_config='{}' WHERE id=?", [recall.id]);
    await changePracticeGoals(db, input(), () => true);
    expect(context().goalId).toBe(fluencyId);
  });
  it("rejects a bulk change containing an inactive tune before changing any assignment", async () => {
    await expect(
      changePracticeGoals(
        db,
        { ...input(), tuneIds: ["tune", "second"] },
        () => true
      )
    ).rejects.toThrow("not active");
    expect(context().goalKey).toBe("recall");
  });
  it("rolls back draft clearing if the assignment update fails", async () => {
    expectSqliteTriggerFailure('update "repertoire_tune"');
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date(stamp),
      },
      () => true
    );
    const before = db.select().from(tableTransientData).get();
    raw.run(
      "CREATE TRIGGER reject_goal BEFORE UPDATE ON repertoire_tune BEGIN SELECT RAISE(ABORT, 'assignment rejected'); END"
    );
    await expect(changePracticeGoals(db, input(), () => true)).rejects.toThrow(
      "assignment rejected"
    );
    expect(db.select().from(tableTransientData).get()).toEqual(before);
    expect(context().goalKey).toBe("recall");
  });
  it("rejects a goal that is no longer available instead of silently assigning Recall", async () => {
    await expect(
      changePracticeGoals(db, { ...input(), goal: "missing" }, () => true)
    ).rejects.toThrow("unavailable");
    expect(context().goalKey).toBe("recall");
  });
});

describe("goal preview staging", () => {
  const input = () => ({
    userId: "owner",
    repertoireId: "rep",
    tuneId: "tune",
    evaluationId: "good",
    practiced: new Date(stamp),
  });
  const draft = () => db.select().from(tableTransientData).get();

  it("clears only reviewed notes without changing a staged evaluation", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    raw.run(
      "UPDATE table_transient_data SET note_private='Keep me', purpose='Practice purpose'"
    );
    const before = draft();
    if (!before) throw new Error("Missing draft");
    await clearReviewedDraftNotes(db, before, () => true);
    expect(draft()).toMatchObject({
      evaluationId: before.evaluationId,
      schedulerState: before.schedulerState,
      practiceRecordId: before.practiceRecordId,
      notePrivate: null,
      purpose: "Practice purpose",
    });
  });
  it("refuses to clear notes changed since recovery displayed them", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    const before = draft();
    if (!before) throw new Error("Missing draft");
    raw.run("UPDATE table_transient_data SET note_private='New text'");
    await expect(
      clearReviewedDraftNotes(db, before, () => true)
    ).rejects.toThrow("Draft notes changed");
    expect(draft()?.notePrivate).toBe("New text");
  });
  it("allows persistence retry after a note clear failed to save", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    raw.run("UPDATE table_transient_data SET note_private='Saved elsewhere'");
    const before = draft();
    if (!before) throw new Error("Missing draft");
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk full"));
    await expect(
      clearReviewedDraftNotes(db, before, () => true)
    ).rejects.toThrow("disk full");
    await clearReviewedDraftNotes(db, before, () => true);
    expect(draft()?.notePrivate).toBeNull();
  });
  it("calculates menu dates using the staging calculator without creating drafts", async () => {
    assign(fluencyId, "fluency");
    const estimates = await prepareLadderDuePreviews(db, input());
    const preview = await prepareGoalPracticePreview(db, {
      ...input(),
      evaluationId: "effortless",
    });
    expect(estimates.effortless).toBe(preview.due);
    expect(draft()).toBeUndefined();
    expect(db.select().from(practiceRecord).all()).toEqual([]);
  });

  it("stores a complete checked first preview without changing history or queue", async () => {
    const result = await stageGoalPracticeEvaluation(db, input(), () => true);
    expect(result.status).toBe("staged");
    expect(draft()).toMatchObject({
      goalId: recall.id,
      goal: "recall",
      schedulerId: "builtin:fsrs6",
      schedulerVersion: 1,
      practiced: "2026-11-16T12:00:00.000Z",
      predecessorRecordId: null,
      predecessorFingerprint: null,
      calculationConfigHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      practiceRecordId: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
    expect(JSON.parse(draft()?.schedulerState ?? "{}")).toHaveProperty(
      "stability"
    );
    expect(db.select().from(practiceRecord).all()).toEqual([]);
    expect(
      raw.exec("SELECT count(*) FROM daily_practice_queue")[0].values
    ).toEqual([[0]]);
    expect(persistDb).toHaveBeenCalledOnce();
  });

  it("retains the event ID and notes when the pending evaluation changes", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    raw.run("UPDATE table_transient_data SET note_private='Keep my note'");
    const before = draft();
    await stageGoalPracticeEvaluation(
      db,
      { ...input(), evaluationId: "hard" },
      () => true
    );
    expect(draft()).toMatchObject({
      practiceRecordId: before?.practiceRecordId,
      evaluationId: "hard",
      notePrivate: "Keep my note",
      syncVersion: (before?.syncVersion ?? 0) + 1,
    });
  });

  it("replaces FSRS projections with ladder state and retains fractional due times", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    const initial = getBuiltInGoals().find(
      (row) => row.name === "initial_learn"
    );
    expect(initial).toBeDefined();
    assign(initial?.id ?? "missing", "initial_learn");
    const evaluationId = initial?.config.evaluations[0].id ?? "missing";
    await stageGoalPracticeEvaluation(
      db,
      { ...input(), evaluationId },
      () => true
    );
    expect(draft()).toMatchObject({
      schedulerId: "builtin:interval-ladder",
      quality: null,
      difficulty: null,
      stability: null,
      repetitions: null,
      state: null,
      intervalDays: 0.1,
      due: "2026-11-16T14:24:00.000Z",
    });
  });

  it("rejects a predecessor arriving during calculation", async () => {
    duringCalculation(() => event("arrived"));
    expect(await stageGoalPracticeEvaluation(db, input(), () => true)).toEqual({
      status: "stale",
    });
    expect(draft()).toBeUndefined();
    expect(persistDb).not.toHaveBeenCalled();
  });

  it("rejects changed predecessor content even when its ID is unchanged", async () => {
    event("existing", "2026-11-15T12:00:00Z");
    duringCalculation(() => raw.run("UPDATE practice_record SET stability=99"));
    expect(await stageGoalPracticeEvaluation(db, input(), () => true)).toEqual({
      status: "stale",
    });
    expect(draft()).toBeUndefined();
  });

  it("rejects a goal switch during calculation", async () => {
    duringCalculation(() => assign(fluencyId, "fluency"));
    expect(await stageGoalPracticeEvaluation(db, input(), () => true)).toEqual({
      status: "stale",
    });
    expect(draft()).toBeUndefined();
  });

  it("leaves an existing preview intact when its replacement becomes stale", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    const before = draft();
    duringCalculation(() => event("arrived"));
    expect(await stageGoalPracticeEvaluation(db, input(), () => true)).toEqual({
      status: "stale",
    });
    expect(draft()).toEqual(before);
  });

  it("rolls back a failed staged write without losing the existing preview", async () => {
    expectSqliteTriggerFailure('insert into "table_transient_data"');
    await stageGoalPracticeEvaluation(db, input(), () => true);
    const before = draft();
    raw.run(
      "CREATE TRIGGER reject_staging AFTER UPDATE ON table_transient_data BEGIN SELECT RAISE(ABORT, 'staging rejected'); END"
    );
    await expect(
      stageGoalPracticeEvaluation(
        db,
        { ...input(), evaluationId: "hard" },
        () => true
      )
    ).rejects.toThrow();
    expect(draft()).toEqual(before);
    expect(persistDb).toHaveBeenCalledOnce();
  });

  it("rejects settings changed during calculation", async () => {
    duringCalculation(() => {
      db.insert(goalUserSettings)
        .values({
          userId: "owner",
          goalId: recall.id,
          overrides: '{"displayName":"Changed"}',
          lastModifiedAt: stamp,
        })
        .run();
    });
    expect(await stageGoalPracticeEvaluation(db, input(), () => true)).toEqual({
      status: "stale",
    });
    expect(draft()).toBeUndefined();
  });

  it("rechecks repertoire ownership after calculation", async () => {
    duringCalculation(() =>
      raw.run(
        "UPDATE repertoire SET user_ref='other' WHERE repertoire_id='rep'"
      )
    );
    await expect(
      stageGoalPracticeEvaluation(db, input(), () => true)
    ).rejects.toThrow(/unavailable/);
    expect(draft()).toBeUndefined();
  });

  it("does not overwrite an intervening staged edit", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    duringCalculation(() =>
      raw.run("UPDATE table_transient_data SET note_private='New note'")
    );
    expect(
      await stageGoalPracticeEvaluation(
        db,
        { ...input(), evaluationId: "hard" },
        () => true
      )
    ).toEqual({ status: "superseded" });
    expect(draft()).toMatchObject({
      notePrivate: "New note",
      evaluationId: "good",
    });
  });

  it("canceling the first pending calculation cannot recreate an absent draft", async () => {
    let current = true;
    const pending = stageGoalPracticeEvaluation(db, input(), () => current);
    expect(draft()).toBeUndefined();
    // Same request ownership contract as the UI: a new clear request supersedes
    // the old evaluation before either asynchronous operation can write.
    current = false;
    await expect(
      clearGoalPracticeEvaluation(db, input(), () => true)
    ).resolves.toEqual({ status: "cleared" });
    expect(await pending).toEqual({ status: "superseded" });
    expect(draft()).toBeUndefined();
  });

  it("does not recreate a draft cleared during calculation", async () => {
    await stageGoalPracticeEvaluation(db, input(), () => true);
    duringCalculation(() => raw.run("DELETE FROM table_transient_data"));
    expect(await stageGoalPracticeEvaluation(db, input(), () => true)).toEqual({
      status: "superseded",
    });
    expect(draft()).toBeUndefined();
  });

  it("does not write after the caller's request or authentication lifetime expires", async () => {
    let current = true;
    duringCalculation(() => {
      current = false;
    });
    expect(
      await stageGoalPracticeEvaluation(db, input(), () => current)
    ).toEqual({ status: "superseded" });
    expect(draft()).toBeUndefined();
    expect(persistDb).not.toHaveBeenCalled();
  });

  it("reports a persistence failure and retains the same recoverable draft ID", async () => {
    vi.mocked(persistDb).mockRejectedValueOnce(
      new Error("storage unavailable")
    );
    await expect(
      stageGoalPracticeEvaluation(db, input(), () => true)
    ).rejects.toThrow("storage unavailable");
    const failed = draft();
    expect(failed?.practiceRecordId).toBeTruthy();
    await stageGoalPracticeEvaluation(db, input(), () => true);
    expect(draft()?.practiceRecordId).toBe(failed?.practiceRecordId);
  });
});

describe("canonical predecessor ordering", () => {
  it("uses the same canonical order in existing queries and the goal resolver, before limiting", async () => {
    event("lexically-later", "2026-11-16T12:00:00Z");
    event("actually-later", "2026-11-16 08:00:00-05");
    expect(context().predecessor?.id).toBe("actually-later");
    expect((await getLatestPracticeRecord(db, "tune", "rep"))?.id).toBe(
      "actually-later"
    );
    expect(
      (await getPracticeRecordsForTune(db, "tune", "rep")).map((row) => row.id)
    ).toEqual(["actually-later", "lexically-later"]);
    expect(
      (await getPracticeHistory(db, "tune", "rep", 1)).map((row) => row.id)
    ).toEqual(["actually-later"]);
  });

  it("normalizes UTC offsets and legacy SQLite timestamp syntax", () => {
    expect(normalizePracticeTimestamp("2026-11-16 07:00:00.123456-05")).toBe(
      "2026-11-16T12:00:00.123456Z"
    );
    expect(normalizePracticeTimestamp("2026-11-16 12:00:00")).toBe(
      "2026-11-16T12:00:00.000000Z"
    );
  });
  it("orders instants, microseconds, modified ties, IDs and nulls without mutation", () => {
    event("null", null);
    event("earlier", "2026-11-16T12:00:00.000001Z");
    event("a", "2026-11-16T12:00:00.000002Z");
    event("b", "2026-11-16 07:00:00.000002-05", "2026-11-17T00:00:00Z");
    event("c", "2026-11-16T12:00:00.000002+00:00", "2026-11-17T00:00:00Z");
    const rows = db.select().from(practiceRecord).all();
    const original = rows.map((row) => row.id);
    expect(orderPracticeHistory(rows).map((row) => row.id)).toEqual([
      "c",
      "b",
      "a",
      "earlier",
      "null",
    ]);
    expect(rows.map((row) => row.id)).toEqual(original);
    expect(context().predecessor?.id).toBe("c");
  });
  it("never searches past the latest event for an older matching goal", () => {
    event("recall-old", "2026-11-15T12:00:00Z");
    event("fluency-new");
    raw.run(
      "UPDATE practice_record SET goal_id=?, goal='fluency' WHERE id='fluency-new'",
      [fluencyId]
    );
    expect(context().predecessor?.id).toBe("fluency-new");
  });
});

describe("prepared goal previews and fingerprints", () => {
  it("prepares first practice without writing and marks its checked null predecessor", async () => {
    const before = raw.exec("SELECT total_changes()")[0].values;
    const preview = await prepareGoalPracticePreview(db, {
      userId: "owner",
      repertoireId: "rep",
      tuneId: "tune",
      evaluationId: "good",
      practiced: new Date(stamp),
    });
    expect(preview.predecessorRecordId).toBeNull();
    expect(preview.predecessorFingerprint).toBeNull();
    expect(preview.calculationConfigHash).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.schedulerId).toBe("builtin:fsrs6");
    expect(raw.exec("SELECT total_changes()")[0].values).toEqual(before);
  });
  it("detects changed predecessor content while ignoring transport-only changes", async () => {
    event("old");
    const initial = await practiceContextFingerprints(context(), "good");
    raw.run(
      "UPDATE practice_record SET sync_version=99, device_id='other', last_modified_at='2026-11-17T00:00:00Z'"
    );
    expect(await practiceContextFingerprints(context(), "good")).toEqual(
      initial
    );
    raw.run("UPDATE practice_record SET stability=20");
    expect(
      (await practiceContextFingerprints(context(), "good"))
        .predecessorFingerprint
    ).not.toBe(initial.predecessorFingerprint);
  });
  it("fingerprints authoritative JSON, not its compatibility projections or key order", async () => {
    const preview = await prepareGoalPracticePreview(db, {
      userId: "owner",
      repertoireId: "rep",
      tuneId: "tune",
      evaluationId: "good",
      practiced: new Date(stamp),
    });
    event("new");
    raw.run(
      "UPDATE practice_record SET goal_id=?, scheduler_id=?, scheduler_version=1, scheduler_state=?",
      [recall.id, preview.schedulerId, preview.schedulerState]
    );
    const first = await practiceContextFingerprints(context(), "good");
    const json = JSON.parse(preview.schedulerState);
    raw.run("UPDATE practice_record SET stability=999, scheduler_state=?", [
      JSON.stringify(
        Object.fromEntries(Object.entries(json).reverse()),
        null,
        2
      ),
    ]);
    expect(await practiceContextFingerprints(context(), "good")).toEqual(first);
    json.learningSteps = 2;
    raw.run("UPDATE practice_record SET scheduler_state=?", [
      JSON.stringify(json),
    ]);
    expect(
      (await practiceContextFingerprints(context(), "good"))
        .predecessorFingerprint
    ).not.toBe(first.predecessorFingerprint);
  });
  it("includes the selected evaluation in the calculation fingerprint", async () => {
    const current = context();
    const good = await practiceContextFingerprints(current, "good");
    const hard = await practiceContextFingerprints(current, "hard");
    expect(good.calculationConfigHash).not.toBe(hard.calculationConfigHash);
  });
  it("detects configuration and population changes independently of predecessor state", async () => {
    const initial = await practiceContextFingerprints(context(), "good");
    db.insert(goalUserSettings)
      .values({
        userId: "owner",
        goalId: recall.id,
        overrides: '{"displayName":"Renamed"}',
        lastModifiedAt: stamp,
      })
      .run();
    const renamed = await practiceContextFingerprints(context(), "good");
    expect(renamed.calculationConfigHash).not.toBe(
      initial.calculationConfigHash
    );
    db.insert(repertoireTune)
      .values({
        repertoireRef: "rep",
        tuneRef: "second",
        goal: "recall",
        lastModifiedAt: stamp,
      })
      .run();
    expect(
      (await practiceContextFingerprints(context(), "good"))
        .calculationConfigHash
    ).not.toBe(renamed.calculationConfigHash);
  });
});

describe("atomic goal practice submission", () => {
  async function item(
    tuneId = "tune",
    evaluationId = "good"
  ): Promise<GoalCommitItem> {
    const queueRowId = `queue-${tuneId}`;
    db.insert(dailyPracticeQueue)
      .values({
        id: queueRowId,
        userRef: "owner",
        repertoireRef: "rep",
        tuneRef: tuneId,
        windowStartUtc: stamp,
        windowEndUtc: "2026-11-17T12:00:00Z",
        bucket: 1,
        orderIndex: 0,
        snapshotCoalescedTs: stamp,
        generatedAt: stamp,
        lastModifiedAt: stamp,
      })
      .run();
    const result = await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId,
        evaluationId,
        practiced: new Date(stamp),
      },
      () => true
    );
    if (result.status !== "staged") throw new Error("Fixture did not stage");
    const draft = db
      .select()
      .from(tableTransientData)
      .all()
      .find((row) => row.tuneId === tuneId);
    if (!draft) throw new Error("Missing fixture draft");
    return { queueRowId, draft };
  }
  const submit = (items: GoalCommitItem[], isCurrent = () => true) =>
    commitGoalPracticeEvaluations(
      db,
      { userId: "owner", repertoireId: "rep", items },
      isCurrent
    );
  const events = () => db.select().from(practiceRecord).all();
  const drafts = () => db.select().from(tableTransientData).all();
  const queue = () => db.select().from(dailyPracticeQueue).get();

  const capture = (windowStart = stamp) =>
    readGoalCommitItems(db, {
      userId: "owner",
      repertoireId: "rep",
      windowStart,
    });
  const cancel = (isCurrent = () => true) =>
    clearGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
      },
      isCurrent
    );

  it("captures reviewed receipts for only the selected active queue window", async () => {
    const receipt = await item();
    expect(capture("2026-11-16 07:00:00-05")).toEqual([receipt]);
    expect(capture("2026-11-17T12:00:00Z")).toEqual([]);
    raw.run("UPDATE daily_practice_queue SET active=0");
    expect(capture()).toEqual([]);
  });

  it("rejects receipt capture for a different owner", async () => {
    await item();
    expect(() =>
      readGoalCommitItems(db, {
        userId: "other",
        repertoireId: "rep",
        windowStart: stamp,
      })
    ).toThrow(/unavailable/);
  });

  it("rejects clearing a draft through another owner's repertoire", async () => {
    await item();
    const before = drafts();
    await expect(
      clearGoalPracticeEvaluation(
        db,
        {
          userId: "other",
          repertoireId: "rep",
          tuneId: "tune",
        },
        () => true
      )
    ).rejects.toThrow(/unavailable/);
    expect(drafts()).toEqual(before);
  });

  it("captures incomplete legacy ratings so Submit requires review instead of skipping them", async () => {
    await item();
    raw.run(
      "UPDATE table_transient_data SET evaluation_id=NULL, evaluation_snapshot=NULL"
    );
    expect(capture()).toHaveLength(1);
    await expect(submit(capture())).rejects.toThrow(/incomplete preview/);
    expect(events()).toEqual([]);
    expect(drafts()).toHaveLength(1);
  });

  it("keeps a captured receipt independent of subsequent draft changes", async () => {
    await item();
    const receipt = capture();
    raw.run("UPDATE table_transient_data SET recall_eval='again'");
    expect(receipt[0].draft.recallEval).toBe("good");
    expect((await submit(receipt)).status).toBe("stale");
    expect(events()).toEqual([]);
  });

  it("clears evaluation state while preserving note-only drafts", async () => {
    await item();
    raw.run(
      "UPDATE table_transient_data SET note_private='Private draft', note_public='Public draft', purpose='notes'"
    );
    await cancel();
    expect(drafts()[0]).toMatchObject({
      notePrivate: "Private draft",
      notePublic: "Public draft",
      purpose: "notes",
      evaluationId: null,
      evaluationSnapshot: null,
      schedulerState: null,
      practiced: null,
      due: null,
      practiceRecordId: null,
      calculationConfigHash: null,
    });
    expect(capture()).toEqual([]);
    raw.run("UPDATE table_transient_data SET recall_eval=''");
    expect(capture()).toEqual([]);
  });

  it("does not clear another session's draft after cancellation", async () => {
    await item();
    const before = drafts();
    expect(await cancel(() => false)).toEqual({ status: "superseded" });
    expect(drafts()).toEqual(before);
  });

  it("retries persistence after clearing the in-memory draft", async () => {
    await item();
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk full"));
    await expect(cancel()).rejects.toThrow("disk full");
    expect(drafts()).toEqual([]);
    await expect(cancel()).resolves.toEqual({ status: "cleared" });
  });

  it.each(["2026-11-16T18:00:00Z", "2026-11-17T12:00:00Z"])(
    "appends a repeat at %s and preserves the earlier event",
    async (practiced) => {
      await submit([await item()]);
      const first = events()[0];
      await stageGoalPracticeEvaluation(
        db,
        {
          userId: "owner",
          repertoireId: "rep",
          tuneId: "tune",
          evaluationId: "hard",
          practiced: new Date(practiced),
        },
        () => true
      );
      const receipts = capture();
      expect(receipts[0].draft.practiceRecordId).not.toBe(first.id);
      expect((await submit(receipts)).status).toBe("committed");
      expect(events()).toHaveLength(2);
      expect(events().find((row) => row.id === first.id)).toEqual(first);
      expect(queue()?.displayedPracticeRecordId).toBe(
        receipts[0].draft.practiceRecordId
      );
      expect(queue()?.exposuresCompleted).toBe(2);
      await submit(receipts);
      expect(events()).toHaveLength(2);
      expect(queue()?.exposuresCompleted).toBe(2);
    }
  );

  it.each(["again", "hard", "good", "easy"])(
    "submits a repeat %s after an older review at a non-rounded time",
    async (evaluationId) => {
      event("older", "2026-11-01T17:43:12.123Z");
      await submit([await item()]);
      await stageGoalPracticeEvaluation(
        db,
        {
          userId: "owner",
          repertoireId: "rep",
          tuneId: "tune",
          evaluationId,
          practiced: new Date("2026-11-24T23:17:43.987Z"),
        },
        () => true
      );
      // Reproduce the 15-significant-digit value observed in synced drafts:
      // a 25-hour interval returned as 1.04166666666667 instead of 25 / 24.
      const interval = capture()[0].draft.intervalDays;
      if (interval === null) throw new Error("Missing interval");
      raw.run("UPDATE table_transient_data SET interval_days = ?", [
        Number(interval.toPrecision(15)),
      ]);
      expect((await submit(capture())).status).toBe("committed");
      expect(events()).toHaveLength(3);
    }
  );

  it("still rejects a stored interval changed by one second", async () => {
    await item("tune", "again");
    raw.run(
      "UPDATE table_transient_data SET interval_days = interval_days + ?",
      [1 / 86400]
    );
    await expect(submit(capture())).rejects.toThrow("Stored preview differs");
    expect(events()).toHaveLength(0);
    expect(drafts()).toHaveLength(1);
  });

  it("canceling a repeat preserves completion, history and the next due date", async () => {
    await submit([await item()]);
    const previousEvents = events();
    const completed = queue();
    const assignment = db.select().from(repertoireTune).all();
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "again",
        practiced: new Date("2026-11-16T18:00:00Z"),
      },
      () => true
    );
    await cancel();
    expect(events()).toEqual(previousEvents);
    expect(queue()).toEqual(completed);
    expect(db.select().from(repertoireTune).all()).toEqual(assignment);
    expect(drafts()).toEqual([]);
  });

  describe("explicit goal plugin integration", () => {
    let runtime: QuickJSAsyncRuntime;
    const script = `
      function describeGoalSchedulerV1() {
        return { apiVersion: 1, stateVersion: 1, compatibleStateVersions: [1],
          actions: [{ id: "advance", label: "Advance", description: "Review in six hours" }] };
      }
      function scheduleGoalV1(input) {
        return { due: new Date(Date.parse(input.practiced) + 21600000).toISOString(),
          state: { count: input.previousState ? input.previousState.data.count + 1 : 1 } };
      }
    `;
    beforeEach(async () => {
      runtime = (await newQuickJSAsyncWASMModule()).newRuntime();
      vi.spyOn(pluginRuntime, "runPluginFunction").mockImplementation(
        (params) =>
          executePlugin(runtime, { ...params, type: "invoke", id: 1 }, {})
      );
      db.insert(plugin)
        .values({
          id: "selected",
          userRef: "owner",
          name: "My scheduler",
          script,
          capabilities: '{"scheduleGoal":true}',
          lastModifiedAt: stamp,
        })
        .run();
      db.insert(goalUserSettings)
        .values({
          userId: "owner",
          goalId: recall.id,
          overrides: canonicalJson({
            scheduler: {
              id: "plugin",
              version: 1,
              pluginId: "selected",
              options: {},
            },
            evaluations: [
              {
                id: "smooth",
                label: "Smooth",
                description: "Played smoothly",
                action: { kind: "plugin", actionId: "advance" },
              },
            ],
          }),
          lastModifiedAt: stamp,
        })
        .run();
    });
    afterEach(() => runtime.dispose());

    it("stages and submits a real sandbox result with truthful JSON-only state", async () => {
      const receipt = await item("tune", "smooth");
      expect(receipt.draft).toMatchObject({
        schedulerId: "plugin:selected",
        intervalDays: 0.25,
        quality: null,
        stability: null,
        technique: "plugin:selected",
      });
      expect(await submit([receipt])).toMatchObject({ status: "committed" });
      expect(events()[0]).toMatchObject({
        schedulerState: receipt.draft.schedulerState,
        due: "2026-11-16T18:00:00.000Z",
        intervalDays: 0.25,
      });
      expect(queue()?.displayedPracticeRecordId).toBe(
        receipt.draft.practiceRecordId
      );
      expect(drafts()).toHaveLength(0);
    });
    it("submits a synced plugin interval rounded by Postgres transport", async () => {
      raw.run("UPDATE plugin SET script=? WHERE id='selected'", [
        script.replace("21600000", "90000000"),
      ]);
      await item("tune", "smooth");
      raw.run("UPDATE table_transient_data SET interval_days=?", [
        Number((25 / 24).toPrecision(15)),
      ]);
      expect((await submit(capture())).status).toBe("committed");
      expect(events()[0].intervalDays).toBe(25 / 24);
      expect(drafts()).toHaveLength(0);
    });

    it("continues the latest matching plugin state after submission", async () => {
      await submit([await item("tune", "smooth")]);
      const preview = await prepareGoalPracticePreview(db, {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "smooth",
        practiced: new Date("2026-11-17T12:00:00Z"),
      });
      expect(preview.continued).toBe(true);
      expect(JSON.parse(preview.schedulerState).data.count).toBe(2);
    });
    it("commits the exact random plugin result that was staged without rerunning it", async () => {
      raw.run("UPDATE plugin SET script = script || ? WHERE id='selected'", [
        `
        function scheduleGoalV1(input) {
          return { due: new Date(Date.parse(input.practiced) + 21600000).toISOString(),
            state: { nonce: Math.random() } };
        }
      `,
      ]);
      const receipt = await item("tune", "smooth");
      const calls = vi.mocked(pluginRuntime.runPluginFunction).mock.calls
        .length;
      expect(await submit([receipt])).toMatchObject({ status: "committed" });
      expect(pluginRuntime.runPluginFunction).toHaveBeenCalledTimes(calls);
      expect(events()[0].schedulerState).toBe(receipt.draft.schedulerState);
    });
    it("rejects changed staged plugin state even when the caller reloads the changed draft", async () => {
      const receipt = await item("tune", "smooth");
      const changed = JSON.parse(receipt.draft.schedulerState!);
      changed.data.count = 999;
      raw.run("UPDATE table_transient_data SET scheduler_state=?", [
        JSON.stringify(changed),
      ]);
      receipt.draft = drafts()[0];
      expect(await submit([receipt])).toMatchObject({ status: "stale" });
      expect(events()).toHaveLength(0);
      expect(drafts()).toHaveLength(1);
    });
    it("starts fresh in a ladder after a same-goal plugin event", async () => {
      await submit([await item("tune", "smooth")]);
      const ladder = getBuiltInGoals().find(
        (entry) => entry.name === "fluency"
      )!;
      raw.run(
        "UPDATE goal_user_settings SET overrides=? WHERE user_id='owner'",
        [canonicalJson(ladder.config)]
      );
      const preview = await prepareGoalPracticePreview(db, {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: ladder.config.evaluations[0].id,
        practiced: new Date("2026-11-17T12:00:00Z"),
      });
      expect(preview.schedulerId).toBe("builtin:interval-ladder");
      expect(preview.continued).toBe(false);
    });
    it("starts fresh in FSRS after changing a goal's scheduler from plugin to built-in", async () => {
      await submit([await item("tune", "smooth")]);
      raw.run("DELETE FROM goal_user_settings WHERE user_id='owner'");
      const preview = await prepareGoalPracticePreview(db, {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date("2026-11-17T12:00:00Z"),
      });
      expect(preview.schedulerId).toBe("builtin:fsrs6");
      expect(preview.continued).toBe(false);
    });
    it("retries a completed submission after the plugin is disabled without rerunning it", async () => {
      const receipt = await item("tune", "smooth");
      await submit([receipt]);
      const invocations = vi.mocked(pluginRuntime.runPluginFunction).mock.calls
        .length;
      raw.run("UPDATE plugin SET enabled=0 WHERE id='selected'");
      expect(await submit([receipt])).toMatchObject({ status: "committed" });
      expect(pluginRuntime.runPluginFunction).toHaveBeenCalledTimes(
        invocations
      );
      expect(events()).toHaveLength(1);
      expect(queue()?.exposuresCompleted).toBe(1);
    });
    it("invalidates a staged preview when the script changes without a version bump", async () => {
      const receipt = await item("tune", "smooth");
      raw.run("UPDATE plugin SET script = script || ? WHERE id='selected'", [
        "\n// revised",
      ]);
      expect(await submit([receipt])).toMatchObject({ status: "stale" });
      expect(events()).toHaveLength(0);
      expect(drafts()).toHaveLength(1);
    });
    it("rejects a script change during evaluation before staging writes", async () => {
      vi.mocked(pluginRuntime.runPluginFunction).mockImplementation(
        async (params) => {
          const result = await executePlugin(
            runtime,
            { ...params, type: "invoke", id: 1 },
            {}
          );
          raw.run(
            "UPDATE plugin SET script = script || ? WHERE id='selected'",
            ["\n// revised"]
          );
          return result;
        }
      );
      const result = await stageGoalPracticeEvaluation(
        db,
        {
          userId: "owner",
          repertoireId: "rep",
          tuneId: "tune",
          evaluationId: "smooth",
          practiced: new Date(stamp),
        },
        () => true
      );
      expect(result.status).toBe("stale");
      expect(drafts()).toHaveLength(0);
    });
    it("keeps the existing draft when a later plugin calculation fails", async () => {
      const receipt = await item("tune", "smooth");
      raw.run("UPDATE plugin SET script=? WHERE id='selected'", [
        "throw new Error('Broken scheduler')",
      ]);
      await expect(
        stageGoalPracticeEvaluation(
          db,
          {
            userId: "owner",
            repertoireId: "rep",
            tuneId: "tune",
            evaluationId: "smooth",
            practiced: new Date(stamp),
          },
          () => true
        )
      ).rejects.toThrow("Broken scheduler");
      expect(drafts()[0]).toEqual(receipt.draft);
      expect(events()).toHaveLength(0);
    });
    it("rejects a private plugin owned by another user", () => {
      raw.run("UPDATE plugin SET user_ref='other' WHERE id='selected'");
      expect(context).toThrow("unavailable");
    });
    it("permits an explicitly selected public plugin", () => {
      raw.run(
        "UPDATE plugin SET user_ref='other', is_public=1 WHERE id='selected'"
      );
      expect(context().plugin?.id).toBe("selected");
    });
    it("blocks submission if the selected plugin was disabled", async () => {
      const receipt = await item("tune", "smooth");
      raw.run("UPDATE plugin SET enabled=0 WHERE id='selected'");
      await expect(submit([receipt])).rejects.toThrow("unavailable");
      expect(events()).toHaveLength(0);
      expect(drafts()).toHaveLength(1);
    });
  });

  it("atomically records the reviewed event and completes its queue item", async () => {
    const receipt = await item();
    expect(await submit([receipt])).toEqual({
      status: "committed",
      eventIds: [receipt.draft.practiceRecordId],
    });
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      id: receipt.draft.practiceRecordId,
      practiced: receipt.draft.practiced,
      due: receipt.draft.due,
      schedulerState: receipt.draft.schedulerState,
      intervalDays: receipt.draft.intervalDays,
    });
    expect(drafts()).toEqual([]);
    expect(queue()).toMatchObject({
      displayedPracticeRecordId: receipt.draft.practiceRecordId,
      exposuresCompleted: 1,
      completedAt: expect.any(String),
    });
    expect(db.select().from(repertoireTune).get()?.current).toBe(
      receipt.draft.due
    );
  });

  it("preserves sub-day ladder timing and leaves FSRS projections empty", async () => {
    const initial = getBuiltInGoals().find(
      (row) => row.name === "initial_learn"
    );
    if (!initial) throw new Error("Missing fixture goal");
    assign(initial.id, initial.name);
    const receipt = await item("tune", "cannot_play");
    await submit([receipt]);
    expect(events()[0]).toMatchObject({
      intervalDays: 0.1,
      due: "2026-11-16T14:24:00.000Z",
      stability: null,
      difficulty: null,
    });
  });

  it("preserves a same-rating draft staged while Submit persistence is pending", async () => {
    const receipt = await item();
    let finishPersistence!: () => void;
    let notifyPersisting!: () => void;
    const persisting = new Promise<void>((resolve) => {
      notifyPersisting = resolve;
    });
    vi.mocked(persistDb).mockImplementationOnce(() => {
      notifyPersisting();
      return new Promise<void>((resolve) => {
        finishPersistence = resolve;
      });
    });
    const committing = submit([receipt]);
    // Wait for the real transaction to finish before staging another evaluation.
    // Only the device persistence boundary is controlled; SQLite writes are real.
    await persisting;
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date("2026-11-17T12:00:00Z"),
      },
      () => true
    );
    const newer = drafts();
    expect(newer).toHaveLength(1);
    finishPersistence();
    expect((await committing).status).toBe("committed");
    expect(drafts()).toEqual(newer);
    expect(events()).toHaveLength(1);
    expect(events()[0].id).toBe(receipt.draft.practiceRecordId);
    expect(queue()?.displayedPracticeRecordId).toBe(events()[0].id);
  });

  it("preserves a newer draft when retrying an older completed submission", async () => {
    const receipt = await item();
    await submit([receipt]);
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date("2026-11-17T12:00:00Z"),
      },
      () => true
    );
    const newer = drafts();
    expect((await submit([receipt])).status).toBe("committed");
    expect(drafts()).toEqual(newer);
    expect(events()).toHaveLength(1);
  });

  it("preserves a newer explicit schedule", async () => {
    const receipt = await item();
    raw.run("UPDATE repertoire_tune SET scheduled='2026-12-01T12:00:00Z'");
    await submit([receipt]);
    expect(db.select().from(repertoireTune).get()?.scheduled).toBe(
      "2026-12-01T12:00:00Z"
    );
  });

  it("does not discard notes held only by the draft", async () => {
    const receipt = await item();
    raw.run("UPDATE table_transient_data SET note_private='Keep this note'");
    receipt.draft = drafts()[0];
    await expect(submit([receipt])).rejects.toThrow(
      "Save or explicitly clear draft notes"
    );
    expect(events()).toEqual([]);
    expect(drafts()[0].notePrivate).toBe("Keep this note");
    expect(queue()?.completedAt).toBeNull();
  });

  it("rejects backdated ladder submission instead of regressing the current schedule", async () => {
    const initial = getBuiltInGoals().find(
      (row) => row.name === "initial_learn"
    );
    if (!initial) throw new Error("Missing fixture goal");
    assign(initial.id, initial.name);
    event("later", "2026-11-17T12:00:00Z");
    raw.run("UPDATE repertoire_tune SET current='2026-11-18T12:00:00Z'");
    const receipt = await item("tune", "cannot_play");
    await expect(submit([receipt])).rejects.toThrow(
      "Practice time precedes the latest submitted event"
    );
    expect(events()).toHaveLength(1);
    expect(drafts()).toHaveLength(1);
    expect(db.select().from(repertoireTune).get()?.current).toBe(
      "2026-11-18T12:00:00Z"
    );
  });

  it("retries without rewriting a later schedule or incrementing counters", async () => {
    const receipt = await item();
    await submit([receipt]);
    raw.run("UPDATE repertoire_tune SET current='2027-01-01T12:00:00Z'");
    expect((await submit([receipt])).status).toBe("committed");
    expect(events()).toHaveLength(1);
    expect(queue()?.exposuresCompleted).toBe(1);
    expect(db.select().from(repertoireTune).get()?.current).toBe(
      "2027-01-01T12:00:00Z"
    );
  });

  it("displays the linked legacy Recall rating after switching the active goal", async () => {
    await item();
    event("legacy", stamp, "2026-11-18T04:57:13.050Z");
    raw.run("UPDATE practice_record SET quality = 2 WHERE id = 'legacy'");
    raw.run(
      "UPDATE daily_practice_queue SET completed_at = ?, displayed_practice_record_id = 'legacy'",
      [stamp]
    );
    assign(fluencyId, "fluency");
    expect(
      readPracticeSession(db, "owner", "rep", stamp).get("tune")?.submittedLabel
    ).toBe("Hard");
  });

  it("does not borrow the latest legacy rating when a completed queue has no event link", async () => {
    await item();
    event("unlinked", stamp, "2026-11-18T04:57:13.050Z");
    raw.run("UPDATE practice_record SET quality = 3 WHERE id = 'unlinked'");
    raw.run("UPDATE daily_practice_queue SET completed_at = ?", [stamp]);
    expect(
      readPracticeSession(db, "owner", "rep", stamp).get("tune")?.submittedLabel
    ).toBe("Not available");
  });

  it("displays a legacy non-Recall label without interpreting it as FSRS", async () => {
    await item();
    event("legacy-ladder");
    raw.run(
      "UPDATE practice_record SET quality = 3, goal = 'fluency', goal_id = ?",
      [fluencyId]
    );
    raw.run(
      "UPDATE daily_practice_queue SET completed_at = ?, displayed_practice_record_id = 'legacy-ladder'",
      [stamp]
    );
    const session = readPracticeSession(db, "owner", "rep", stamp).get("tune");
    expect(session?.submittedLabel).toBe("Good");
    expect(session?.submittedColor).toBe("text-foreground");
    const recorded = session?.event;
    if (!recorded) throw new Error("Missing linked legacy event");
    const historical = readHistoryEvent(
      recorded,
      db.select().from(goal).all(),
      "owner"
    );
    expect(historical.rating).toBeNull();
    expect(historical.state.kind).toBe("unavailable");
  });

  it("links the displayed event rather than a newer event and uses the current goal", async () => {
    const receipt = await item();
    await submit([receipt]);
    event("newer", "2026-11-17T12:00:00Z");
    assign(fluencyId, "fluency");
    const session = readPracticeSession(db, "owner", "rep", stamp).get("tune");
    expect(session?.event?.id).toBe(receipt.draft.practiceRecordId);
    expect(session?.submittedLabel).toBe("Good");
    expect(
      session?.definition.config.evaluations.map((choice) => choice.id)
    ).toContain("effortless");
    raw.run("UPDATE repertoire_tune SET deleted = 1");
    expect(readPracticeSession(db, "owner", "rep", stamp).size).toBe(0);
  });

  it("retries persistence after an already committed local transaction", async () => {
    const receipt = await item();
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("Persistence failed"));
    await expect(submit([receipt])).rejects.toThrow(
      GoalPracticePersistenceError
    );
    expect(events()).toHaveLength(1);
    expect(drafts()).toEqual([]);
    expect((await submit([receipt])).status).toBe("committed");
    expect(queue()?.exposuresCompleted).toBe(1);
  });

  it("rejects a changed predecessor without consuming the draft", async () => {
    const receipt = await item();
    event("arrived", "2026-11-15T12:00:00Z");
    expect(await submit([receipt])).toEqual({ status: "stale" });
    expect(events().map((row) => row.id)).toEqual(["arrived"]);
    expect(drafts()).toHaveLength(1);
    expect(queue()?.completedAt).toBeNull();
  });

  it("checks queue changes made while awaiting calculation", async () => {
    const receipt = await item();
    duringCalculation(() =>
      raw.run("UPDATE daily_practice_queue SET exposures_completed=4")
    );
    expect(await submit([receipt])).toEqual({ status: "stale" });
    expect(events()).toEqual([]);
    expect(drafts()).toHaveLength(1);
    expect(queue()?.exposuresCompleted).toBe(4);
  });

  it("does not submit after the caller lifetime ends", async () => {
    const receipt = await item();
    let current = true;
    duringCalculation(() => {
      current = false;
    });
    expect(await submit([receipt], () => current)).toEqual({
      status: "superseded",
    });
    expect(events()).toEqual([]);
    expect(drafts()).toHaveLength(1);
  });

  it("rolls back the whole batch when the second queue update fails", async () => {
    expectSqliteTriggerFailure('update "daily_practice_queue"');
    db.insert(repertoireTune)
      .values({
        repertoireRef: "rep",
        tuneRef: "second",
        goal: "recall",
        lastModifiedAt: stamp,
      })
      .run();
    const first = await item();
    const second = await item("second");
    raw.exec(
      "CREATE TRIGGER reject_second BEFORE UPDATE ON daily_practice_queue WHEN NEW.tune_ref='second' BEGIN SELECT RAISE(ABORT, 'injected failure'); END"
    );
    await expect(submit([first, second])).rejects.toThrow("injected failure");
    expect(events()).toEqual([]);
    expect(drafts()).toHaveLength(2);
    expect(
      db
        .select()
        .from(dailyPracticeQueue)
        .all()
        .map((row) => row.completedAt)
    ).toEqual([null, null]);
    expect(
      db
        .select()
        .from(repertoireTune)
        .all()
        .map((row) => row.current)
    ).toEqual([null, null, null]);
  });

  it("rejects a different UUID at the same normalized practiced time", async () => {
    const receipt = await item();
    event("collision", "2026-11-16T07:00:00-05:00");
    await expect(submit([receipt])).rejects.toThrow(
      "already uses this practiced time"
    );
    expect(events()).toHaveLength(1);
    expect(drafts()).toHaveLength(1);
  });

  it("rejects reuse of an event UUID with different content", async () => {
    const receipt = await item();
    await submit([receipt]);
    raw.run("UPDATE practice_record SET interval_days=999");
    await expect(submit([receipt])).rejects.toThrow(
      "conflicts with different content"
    );
    expect(queue()?.exposuresCompleted).toBe(1);
  });

  it("requires review of legacy incomplete drafts", async () => {
    const receipt = await item();
    receipt.draft.schedulerState = null;
    await expect(submit([receipt])).rejects.toThrow(
      "must be recalculated and reviewed"
    );
    expect(events()).toEqual([]);
    expect(drafts()).toHaveLength(1);
  });
});

describe("repertoire history SQL consumers", () => {
  it("preserves the existing queue when malformed history blocks regeneration", async () => {
    event("damaged", "not-a-date");
    const windows = computeSchedulingWindows(new Date(stamp), 7, 0);
    db.insert(dailyPracticeQueue)
      .values({
        id: "preserved",
        userRef: "owner",
        repertoireRef: "rep",
        tuneRef: "tune",
        windowStartUtc: windows.startTs,
        windowEndUtc: windows.endTs,
        bucket: 1,
        orderIndex: 0,
        snapshotCoalescedTs: stamp,
        generatedAt: stamp,
        lastModifiedAt: stamp,
      })
      .run();
    await expect(
      generateDailyPracticeQueue(db, "owner", "rep", new Date(stamp), {
        forceRegen: true,
      })
    ).rejects.toThrow("Invalid practice timestamp");
    expect(db.select().from(dailyPracticeQueue).get()).toMatchObject({
      id: "preserved",
      active: 1,
    });
  });

  it("limits enriched history only after normalized timestamp and ID ordering", async () => {
    event("earlier", "2026-11-16T13:00:00.999998+01:00");
    event("latest", "2026-11-16T07:00:00.999999-05:00");
    const records = await getPracticeRecords(db, "rep", 1);
    expect(records.map((row) => row.id)).toEqual(["latest"]);
  });

  it("does not show an older overdue record when the latest review is scheduled in the future", async () => {
    event("older", "2026-11-15T12:00:00Z");
    event("latest", "2026-11-16T12:00:00Z");
    raw.run(
      "UPDATE practice_record SET due = CASE id WHEN 'older' THEN '2000-01-01' ELSE '2999-01-01' END"
    );
    expect(
      (await getStalenessData(db, "rep")).map((bucket) => bucket.count)
    ).toEqual([0, 0, 0, 0, 0]);
  });

  it("counts overdue ladder events without FSRS compatibility fields", async () => {
    event("ladder");
    raw.run(
      "UPDATE practice_record SET due='2000-01-01', stability=NULL, goal='fluency'"
    );
    expect(
      (await getStalenessData(db, "rep")).map((bucket) => bucket.count)
    ).toEqual([0, 0, 0, 0, 1]);
  });

  it("reads JSON-only FSRS stability for Analysis", async () => {
    const preview = await prepareGoalPracticePreview(db, {
      userId: "owner",
      repertoireId: "rep",
      tuneId: "tune",
      evaluationId: "good",
      practiced: new Date(stamp),
    });
    event("json");
    raw.run(
      "UPDATE practice_record SET goal_id=?, scheduler_id=?, scheduler_version=1, scheduler_state=?, stability=NULL",
      [recall.id, preview.schedulerId, preview.schedulerState]
    );
    const curve = await getFsrsRetentionCurve(db, "rep");
    expect(curve).toHaveLength(61);
    expect(curve[1].retention).toBeCloseTo(
      0.9 ** (1 / JSON.parse(preview.schedulerState).stability)
    );
  });

  it("never falls back to compatibility stability for malformed JSON", async () => {
    event("broken");
    raw.run(
      "UPDATE practice_record SET goal_id=?, scheduler_id='builtin:fsrs6', scheduler_version=1, scheduler_state='{}'",
      [recall.id]
    );
    expect(await getFsrsRetentionCurve(db, "rep")).toEqual([]);
  });

  it("excludes legacy ladder events even when they contain FSRS-looking columns", async () => {
    event("ladder");
    raw.run("UPDATE practice_record SET goal='fluency'");
    expect(await getFsrsRetentionCurve(db, "rep")).toEqual([]);
  });

  it("does not resurrect FSRS stability from an older goal after a ladder event", async () => {
    event("older", "2026-11-15T12:00:00Z");
    event("latest", "2026-11-16T12:00:00Z");
    raw.run(
      "UPDATE practice_record SET stability = NULL, goal = 'fluency' WHERE id='latest'"
    );
    expect(await getFsrsRetentionCurve(db, "rep")).toEqual([]);
  });
});

describe("manual goal-aware practice history", () => {
  const input = () => ({
    userId: "owner",
    repertoireId: "rep",
    tuneId: "tune",
    goalId: recall.id,
    evaluationId: "good",
    practiced: new Date("2026-11-15T12:00:00Z"),
  });
  it("rejects future dates before calculation", async () => {
    await expect(
      prepareManualPractice(db, {
        ...input(),
        practiced: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(/future/);
  });
  it("preserves later history and the current schedule on backdated insertion", async () => {
    event("later");
    const before = db.select().from(practiceRecord).all();
    const assignment = db.select().from(repertoireTune).all();
    const receipt = await prepareManualPractice(db, input());
    await saveManualPractice(db, receipt, () => true);
    expect(db.select().from(practiceRecord).all()).toEqual(
      expect.arrayContaining(before)
    );
    expect(db.select().from(repertoireTune).all()).toEqual(assignment);
    expect(db.select().from(practiceRecord).all()).toHaveLength(2);
  });
  it("calculates from the preceding event rather than a later submitted event", async () => {
    event("earlier", "2026-11-14T12:00:00Z");
    const withoutLater = await prepareManualPractice(db, input());
    event("later");
    const withLater = await prepareManualPractice(db, input());
    expect(JSON.parse(withLater.record.schedulerState).reps).toBe(11);
    expect(withLater.record.schedulerState).toBe(
      withoutLater.record.schedulerState
    );
  });
  it("records ladder history without changing the tune's assigned goal", async () => {
    const receipt = await prepareManualPractice(db, {
      ...input(),
      goalId: fluencyId,
      evaluationId: fluency.config.evaluations[0].id,
    });
    await saveManualPractice(db, receipt, () => true);
    expect(db.select().from(practiceRecord).all()[0]).toMatchObject({
      goalId: fluencyId,
      schedulerId: "builtin:interval-ladder",
    });
    expect(context().goalId).toBe(recall.id);
    expect(context().predecessor?.due).toBe(receipt.record.due);
  });
  it("rejects a changed snapshot before inserting an entry", async () => {
    const receipt = await prepareManualPractice(db, input());
    event("intervening", "2026-11-14T12:00:00Z");
    await expect(saveManualPractice(db, receipt, () => true)).rejects.toThrow(
      /changed/
    );
    expect(db.select().from(practiceRecord).all()).toHaveLength(1);
  });
  it("rejects a foreign owner", async () => {
    await expect(
      prepareManualPractice(db, { ...input(), userId: "other" })
    ).rejects.toThrow(/unavailable/);
  });
  it("does not write when the caller's auth lifetime has ended", async () => {
    const receipt = await prepareManualPractice(db, input());
    await expect(saveManualPractice(db, receipt, () => false)).rejects.toThrow(
      /context changed/
    );
    expect(db.select().from(practiceRecord).all()).toHaveLength(0);
  });
  it("retries device persistence without duplicating the event or overwriting newer scheduling", async () => {
    const receipt = await prepareManualPractice(db, input());
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk"));
    await expect(
      saveManualPractice(db, receipt, () => true)
    ).rejects.toBeInstanceOf(ManualPracticePersistenceError);
    raw.run(
      "UPDATE repertoire_tune SET current = '2027-01-01' WHERE repertoire_ref = 'rep'"
    );
    await saveManualPractice(db, receipt, () => true);
    expect(persistDb).toHaveBeenCalledTimes(2);
    expect(db.select().from(practiceRecord).all()).toHaveLength(1);
    expect(db.select().from(repertoireTune).all()[0].current).toBe(
      "2027-01-01"
    );
  });
  it("rejects a duplicate practiced time", async () => {
    event("same", input().practiced.toISOString());
    await expect(prepareManualPractice(db, input())).rejects.toThrow(
      /already uses/
    );
  });
  it("rejects settings different from the choices shown in the form", async () => {
    await expect(
      prepareManualPractice(db, {
        ...input(),
        expectedConfiguration: "outdated settings",
      })
    ).rejects.toThrow(/Goal settings changed/);
    expect(db.select().from(practiceRecord).all()).toHaveLength(0);
  });
  it("preserves existing staged work and queue completion", async () => {
    db.insert(dailyPracticeQueue)
      .values({
        id: "queue",
        userRef: "owner",
        repertoireRef: "rep",
        tuneRef: "tune",
        windowStartUtc: stamp,
        windowEndUtc: "2026-11-17T12:00:00Z",
        bucket: 1,
        orderIndex: 0,
        snapshotCoalescedTs: stamp,
        generatedAt: stamp,
        lastModifiedAt: stamp,
      })
      .run();
    await stageGoalPracticeEvaluation(
      db,
      {
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        evaluationId: "good",
        practiced: new Date(stamp),
      },
      () => true
    );
    const drafts = db.select().from(tableTransientData).all();
    const queue = db.select().from(dailyPracticeQueue).all();
    const receipt = await prepareManualPractice(db, input());
    await saveManualPractice(db, receipt, () => true);
    expect(db.select().from(tableTransientData).all()).toEqual(drafts);
    expect(db.select().from(dailyPracticeQueue).all()).toEqual(queue);
  });
  it("ignores undated legacy entries when selecting a dated predecessor", async () => {
    event("undated", null);
    event("earlier", "2026-11-14T12:00:00Z");
    const receipt = await prepareManualPractice(db, input());
    expect(JSON.parse(receipt.record.schedulerState).reps).toBe(11);
    await saveManualPractice(db, receipt, () => true);
    expect(db.select().from(practiceRecord).all()).toHaveLength(3);
  });
  it("does not resurrect a deleted backfill when retrying device persistence", async () => {
    event("later");
    const receipt = await prepareManualPractice(db, input());
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk"));
    await expect(
      saveManualPractice(db, receipt, () => true)
    ).rejects.toBeInstanceOf(ManualPracticePersistenceError);
    expect(receipt.committed).toBe(true);
    raw.run("DELETE FROM practice_record WHERE id = ?", [receipt.record.id]);
    await expect(
      saveManualPractice(db, receipt, () => true)
    ).rejects.toBeInstanceOf(ManualPracticeRemovedError);
    expect(
      db
        .select()
        .from(practiceRecord)
        .all()
        .map((row) => row.id)
    ).toEqual(["later"]);
    expect(persistDb).toHaveBeenCalledTimes(1);
  });
});
