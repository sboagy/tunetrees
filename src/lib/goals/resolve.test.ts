import { readFileSync } from "node:fs";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "@oosync/runtime/sqlite-wasm-adapter";
import { drizzle } from "drizzle-orm/sql-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import codegenConfig from "../../../oosync.codegen.config.json";
import {
  getLatestPracticeRecord,
  getPracticeHistory,
} from "../db/queries/practice";
import { getPracticeRecordsForTune } from "../db/queries/practice-records";
import {
  goal,
  goalUserSettings,
  practiceRecord,
  repertoireTune,
} from "../db/schema";
import {
  normalizePracticeTimestamp,
  orderPracticeHistory,
} from "../utils/practice-history";
import { getBuiltInGoals } from "./builtins";
import { canonicalJson } from "./config";
import {
  practiceContextFingerprints,
  prepareGoalPracticePreview,
} from "./preview";
import { readGoalPracticeContext, resolveGoalReference } from "./resolve";

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
afterEach(() => raw.close());

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
