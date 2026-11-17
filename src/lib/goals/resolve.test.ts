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
  practiceRecord,
  repertoireTune,
  tableTransientData,
} from "../db/schema";
import {
  computeSchedulingWindows,
  generateDailyPracticeQueue,
} from "../services/queue-generator";
import {
  normalizePracticeTimestamp,
  orderPracticeHistory,
} from "../utils/practice-history";
import { getBuiltInGoals } from "./builtins";
import { commitGoalPracticeEvaluations, type GoalCommitItem } from "./commit";
import { canonicalJson } from "./config";
import {
  practiceContextFingerprints,
  prepareGoalPracticePreview,
} from "./preview";
import { readGoalPracticeContext, resolveGoalReference } from "./resolve";
import { stageGoalPracticeEvaluation } from "./staging";

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

describe("goal preview staging", () => {
  const input = () => ({
    userId: "owner",
    repertoireId: "rep",
    tuneId: "tune",
    evaluationId: "good",
    practiced: new Date(stamp),
  });
  const draft = () => db.select().from(tableTransientData).get();

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

  it("retries persistence after an already committed local transaction", async () => {
    const receipt = await item();
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("Persistence failed"));
    await expect(submit([receipt])).rejects.toThrow("Persistence failed");
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

  it("does not resurrect FSRS stability from an older goal after a ladder event", async () => {
    event("older", "2026-11-15T12:00:00Z");
    event("latest", "2026-11-16T12:00:00Z");
    raw.run(
      "UPDATE practice_record SET stability = NULL, goal = 'fluency' WHERE id='latest'"
    );
    expect(await getFsrsRetentionCurve(db, "rep")).toEqual([]);
  });
});
