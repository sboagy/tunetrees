import { readFileSync } from "node:fs";
import {
  createSqliteWasmDatabase,
  initSqliteWasm,
} from "@oosync/runtime/sqlite-wasm-adapter";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import codegenConfig from "../../../oosync.codegen.config.json";
import { persistDb } from "../db/client-sqlite";
import {
  dailyPracticeQueue,
  goal,
  goalUserSettings,
  plugin,
  practiceRecord,
  repertoireTune,
  tableTransientData,
  tune,
} from "../db/schema";
import * as pluginRuntime from "../plugins/runtime";
import { getBuiltInGoals } from "./builtins";
import { canonicalJson } from "./config";
import { inspectGoalPlugin } from "./plugin-settings";
import {
  createConfiguredGoal,
  deleteConfiguredGoal,
  type EditableGoalDefinition,
  readGoalSettings,
  readGoalSettingsCatalog,
  saveGoalSettings,
} from "./settings";

vi.mock("../db/client-sqlite", () => ({ persistDb: vi.fn() }));
let raw: ReturnType<typeof createSqliteWasmDatabase>;
let db: ReturnType<typeof drizzle>;
const stamp = "2026-11-17T12:00:00Z";
const recall = getBuiltInGoals()[0];
const custom = {
  displayName: "My goal",
  description: "Personal intent",
  config: getBuiltInGoals()[2].config,
};
const entry = (id = recall.id, user = "owner") =>
  readGoalSettings(db, user).find((item) => item.row.id === id)!;
beforeEach(async () => {
  raw = createSqliteWasmDatabase(await initSqliteWasm());
  for (const file of codegenConfig.browserSqlite.migrationFiles) {
    for (const statement of readFileSync(file.slice(1), "utf8").split(
      "--> statement-breakpoint"
    ))
      if (statement.trim()) raw.exec(statement);
  }
  db = drizzle(raw as never);
  raw.run(
    "INSERT INTO user_profile (id,last_modified_at) VALUES ('owner',?),('other',?)",
    [stamp, stamp]
  );
  raw.run(
    "INSERT INTO repertoire (repertoire_id,user_ref,last_modified_at) VALUES ('rep','owner',?),('foreign','other',?)",
    [stamp, stamp]
  );
  for (const item of getBuiltInGoals()) {
    raw.run("DELETE FROM goal WHERE id = ?", [item.id]);
    db.insert(goal)
      .values({
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        description: item.description,
        defaultConfig: canonicalJson(item.config),
        lastModifiedAt: stamp,
      })
      .run();
  }
});
afterEach(() => {
  raw.close();
  vi.mocked(persistDb).mockReset();
});

async function assignedCustom() {
  await createConfiguredGoal(db, "owner", "custom-id", custom);
  db.insert(tune).values({ id: "tune", lastModifiedAt: stamp }).run();
  db.insert(repertoireTune)
    .values({
      tuneRef: "tune",
      repertoireRef: "rep",
      goal: "custom:custom-id",
      goalId: "custom-id",
      scheduled: stamp,
      lastModifiedAt: stamp,
    })
    .run();
  return entry("custom-id");
}

describe("goal settings persistence", () => {
  it("saves only personal differences including zero and false, without changing shared defaults", async () => {
    const before = entry();
    const edited = structuredClone(before.effective);
    edited.displayName = "Remember";
    edited.config.daily.minimum = 0;
    edited.config.daily.maximum = 0;
    edited.config.daily.autoNew = false;
    await saveGoalSettings(db, "owner", before, edited);
    expect(
      JSON.parse(db.select().from(goalUserSettings).get()!.overrides)
    ).toEqual({
      displayName: "Remember",
      daily: { minimum: 0, maximum: 0, autoNew: false },
    });
    expect(entry().row).toEqual(before.row);
    expect(entry(recall.id, "other").effective).toEqual(before.effective);
  });
  it("reset inherits current defaults and preserves the syncable settings row", async () => {
    const before = entry();
    await saveGoalSettings(db, "owner", before, {
      ...before.effective,
      displayName: "Remember",
    });
    const updated = entry();
    await saveGoalSettings(db, "owner", updated, updated.defaults);
    expect(db.select().from(goalUserSettings).get()?.overrides).toBe("{}");
    expect(entry().overridden).toBe(false);
  });
  it("rejects stale editors after another save", async () => {
    const before = entry();
    await saveGoalSettings(db, "owner", before, {
      ...before.effective,
      displayName: "First",
    });
    await expect(
      saveGoalSettings(db, "owner", before, {
        ...before.effective,
        displayName: "Second",
      })
    ).rejects.toThrow("changed");
    expect(entry().effective.displayName).toBe("First");
  });
  it("rejects invalid min/max before any writes", async () => {
    const before = entry();
    const edited = structuredClone(before.effective);
    edited.config.daily.minimum = 10;
    edited.config.daily.maximum = 2;
    await expect(saveGoalSettings(db, "owner", before, edited)).rejects.toThrow(
      "Minimum"
    );
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
  it("creates a stable key and allows exact persistence retries without duplicates", async () => {
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk full"));
    await expect(
      createConfiguredGoal(db, "owner", "new-id", custom)
    ).rejects.toThrow("could not be saved");
    await createConfiguredGoal(db, "owner", "new-id", custom);
    expect(
      readGoalSettings(db, "owner").filter(
        (item) => item.row.name === "custom:new-id"
      )
    ).toHaveLength(1);
    expect(entry("new-id").effective).toEqual(custom);
  });
  it("rejects foreign-goal writes and identity collisions", async () => {
    await createConfiguredGoal(db, "other", "foreign-goal", custom);
    const foreign = entry("foreign-goal", "other");
    await expect(
      saveGoalSettings(db, "owner", foreign, custom)
    ).rejects.toThrow("changed");
    await expect(
      createConfiguredGoal(db, "owner", "foreign-goal", custom)
    ).rejects.toThrow("different content");
  });
  it("replaces assignments while preserving due dates, history and frozen queue attribution", async () => {
    const source = await assignedCustom();
    db.insert(practiceRecord)
      .values({
        id: "history",
        tuneRef: "tune",
        repertoireRef: "rep",
        goalId: source.row.id,
        practiced: stamp,
        lastModifiedAt: stamp,
      })
      .run();
    db.insert(dailyPracticeQueue)
      .values({
        id: "queue",
        userRef: "owner",
        repertoireRef: "rep",
        tuneRef: "tune",
        windowStartUtc: stamp,
        windowEndUtc: stamp,
        generatedAt: stamp,
        snapshotCoalescedTs: stamp,
        bucket: 1,
        orderIndex: 0,
        allocationGoalId: source.row.id,
        lastModifiedAt: stamp,
      })
      .run();
    const history = db.select().from(practiceRecord).all();
    const queue = db.select().from(dailyPracticeQueue).all();
    await deleteConfiguredGoal(db, "owner", source, recall.id);
    expect(db.select().from(repertoireTune).get()).toMatchObject({
      goalId: recall.id,
      goal: "recall",
      scheduled: stamp,
    });
    expect(db.select().from(practiceRecord).all()).toEqual(history);
    expect(db.select().from(dailyPracticeQueue).all()).toEqual(queue);
    expect(
      db.select().from(goal).where(eq(goal.id, source.row.id)).get()?.deleted
    ).toBe(1);
  });
  it("blocks deletion with note-only drafts without changing assignments", async () => {
    const source = await assignedCustom();
    db.insert(tableTransientData)
      .values({
        userId: "owner",
        repertoireId: "rep",
        tuneId: "tune",
        lastModifiedAt: stamp,
      })
      .run();
    await expect(
      deleteConfiguredGoal(db, "owner", source, recall.id)
    ).rejects.toThrow("pending practice");
    expect(db.select().from(repertoireTune).get()?.goalId).toBe(source.row.id);
    expect(entry(source.row.id)).toBeDefined();
  });
  it("requires an available replacement and refuses deletion of built-ins", async () => {
    const source = await assignedCustom();
    await expect(
      deleteConfiguredGoal(db, "owner", source, "missing")
    ).rejects.toThrow("replacement");
    await expect(
      deleteConfiguredGoal(db, "owner", entry(), source.row.id)
    ).rejects.toThrow("Built-in");
  });
  it("rolls replacement back when deletion fails late", async () => {
    const source = await assignedCustom();
    raw.exec(
      "CREATE TRIGGER reject_goal_delete BEFORE UPDATE ON goal BEGIN SELECT RAISE(ABORT, 'late failure'); END;"
    );
    await expect(
      deleteConfiguredGoal(db, "owner", source, recall.id)
    ).rejects.toThrow("late failure");
    expect(db.select().from(repertoireTune).get()?.goalId).toBe(source.row.id);
  });
  it("does not change another owner's repertoire during replacement", async () => {
    const source = await assignedCustom();
    db.insert(repertoireTune)
      .values({
        repertoireRef: "foreign",
        tuneRef: "tune",
        goalId: source.row.id,
        goal: source.row.name,
        lastModifiedAt: stamp,
      })
      .run();
    await deleteConfiguredGoal(db, "owner", source, recall.id);
    expect(
      db
        .select()
        .from(repertoireTune)
        .where(eq(repertoireTune.repertoireRef, "foreign"))
        .get()?.goalId
    ).toBe(source.row.id);
  });
  it("keeps committed settings available after persistence failure", async () => {
    const before = entry();
    vi.mocked(persistDb).mockRejectedValueOnce(new Error("disk full"));
    await expect(
      saveGoalSettings(db, "owner", before, {
        ...before.effective,
        displayName: "Saved locally",
      })
    ).rejects.toThrow("could not be saved");
    await persistDb();
    expect(entry().effective.displayName).toBe("Saved locally");
  });
});

it("keeps legacy custom goals visible without blocking configured goals", async () => {
  db.insert(goal)
    .values({
      id: "legacy",
      name: "old-plugin",
      privateFor: "owner",
      defaultTechnique: "unknown-plugin",
      lastModifiedAt: stamp,
    })
    .run();
  const catalog = readGoalSettingsCatalog(db, "owner");
  expect(catalog.unavailable.map((item) => item.row.id)).toEqual(["legacy"]);
  const before = entry();
  await saveGoalSettings(db, "owner", before, {
    ...before.effective,
    displayName: "Still editable",
  });
  expect(entry().effective.displayName).toBe("Still editable");
  expect(
    db.select().from(goal).where(eq(goal.id, "legacy")).get()?.defaultConfig
  ).toBeNull();
});

it("blocks deletion for attributed drafts even after assignment changes", async () => {
  const source = await assignedCustom();
  db.update(repertoireTune).set({ goalId: recall.id, goal: "recall" }).run();
  db.insert(tableTransientData)
    .values({
      userId: "owner",
      repertoireId: "rep",
      tuneId: "tune",
      goalId: source.row.id,
      goal: source.row.name,
      lastModifiedAt: stamp,
    })
    .run();
  await expect(
    deleteConfiguredGoal(db, "owner", source, recall.id)
  ).rejects.toThrow("pending practice");
  expect(entry(source.row.id)).toBeDefined();
});

describe("explicit scheduler settings validation", () => {
  const manifest = {
    apiVersion: 1,
    stateVersion: 1,
    compatibleStateVersions: [1],
    actions: [
      { id: "advance", label: "Advance", description: "Review tomorrow" },
    ],
  };
  const pluginDefinition = (): EditableGoalDefinition => ({
    ...structuredClone(custom),
    config: {
      ...structuredClone(custom.config),
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
          description: "Played confidently",
          action: { kind: "plugin", actionId: "advance" },
        },
      ],
    },
  });
  beforeEach(() => {
    db.insert(plugin)
      .values({
        id: "selected",
        userRef: "owner",
        name: "My scheduler",
        script: "script-v1",
        capabilities: '{"scheduleGoal":true}',
        lastModifiedAt: stamp,
      })
      .run();
    vi.spyOn(pluginRuntime, "runPluginFunction").mockResolvedValue(manifest);
  });
  afterEach(() => vi.restoreAllMocks());

  it("saves reviewed named actions as personal overrides", async () => {
    const reviewedPlugin = await inspectGoalPlugin(db, "owner", "selected");
    const definition = pluginDefinition();
    await saveGoalSettings(db, "owner", entry(), definition, {
      reviewedPlugin,
    });
    expect(entry().effective).toEqual(definition);
    expect(pluginRuntime.runPluginFunction).toHaveBeenCalledTimes(2);
  });
  it("creates a custom plugin goal with truthful technique metadata", async () => {
    await createConfiguredGoal(
      db,
      "owner",
      "custom-plugin",
      pluginDefinition()
    );
    expect(entry("custom-plugin").row.defaultTechnique).toBe("plugin:selected");
    expect(entry("custom-plugin").effective).toEqual(pluginDefinition());
  });
  it("rejects a removed named action before writing", async () => {
    const definition = pluginDefinition();
    definition.config.evaluations[0].action = {
      kind: "plugin",
      actionId: "removed",
    };
    await expect(
      saveGoalSettings(db, "owner", entry(), definition)
    ).rejects.toThrow("available scheduling effect");
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
  it("rejects script changes after the editor reviewed the actions", async () => {
    const reviewedPlugin = await inspectGoalPlugin(db, "owner", "selected");
    db.update(plugin).set({ script: "changed-without-version-bump" }).run();
    await expect(
      saveGoalSettings(db, "owner", entry(), pluginDefinition(), {
        reviewedPlugin,
      })
    ).rejects.toThrow("plugin changed");
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
  it("rejects script changes during sandbox validation", async () => {
    vi.mocked(pluginRuntime.runPluginFunction).mockImplementationOnce(
      async () => {
        db.update(plugin).set({ script: "changed-while-awaiting" }).run();
        return manifest;
      }
    );
    await expect(
      createConfiguredGoal(db, "owner", "not-created", pluginDefinition())
    ).rejects.toThrow("plugin changed");
    expect(
      db.select().from(goal).where(eq(goal.id, "not-created")).get()
    ).toBeUndefined();
  });
  it("rejects a settings-session change before the write", async () => {
    let current = true;
    vi.mocked(pluginRuntime.runPluginFunction).mockImplementationOnce(
      async () => {
        current = false;
        return manifest;
      }
    );
    await expect(
      saveGoalSettings(db, "owner", entry(), pluginDefinition(), {
        isCurrent: () => current,
      })
    ).rejects.toThrow("session changed");
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
  it("rejects goal edits that arrive during sandbox validation", async () => {
    vi.mocked(pluginRuntime.runPluginFunction).mockImplementationOnce(
      async () => {
        db.update(goal)
          .set({ displayName: "Incoming edit" })
          .where(eq(goal.id, recall.id))
          .run();
        return manifest;
      }
    );
    await expect(
      saveGoalSettings(db, "owner", entry(), pluginDefinition())
    ).rejects.toThrow("settings changed");
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
  it("does not silently accept a changed declaration with unchanged code", async () => {
    const reviewedPlugin = await inspectGoalPlugin(db, "owner", "selected");
    vi.mocked(pluginRuntime.runPluginFunction).mockResolvedValueOnce({
      ...manifest,
      actions: [{ ...manifest.actions[0], description: "Review in a year" }],
    });
    await expect(
      saveGoalSettings(db, "owner", entry(), pluginDefinition(), {
        reviewedPlugin,
      })
    ).rejects.toThrow("actions changed");
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
  it.each([{ enabled: 0 }, { userRef: "other", isPublic: 0 }, { deleted: 1 }])(
    "rejects an unavailable plugin %j",
    async (changes) => {
      db.update(plugin).set(changes).run();
      await expect(
        saveGoalSettings(db, "owner", entry(), pluginDefinition())
      ).rejects.toThrow("unavailable");
      expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
    }
  );
  it("allows an explicitly selected public plugin", async () => {
    db.update(plugin).set({ userRef: "other", isPublic: 1 }).run();
    await saveGoalSettings(db, "owner", entry(), pluginDefinition());
    expect(entry().effective.config.scheduler).toEqual(
      pluginDefinition().config.scheduler
    );
  });
  it("keeps legacy scripts without a valid declaration from becoming goal schedulers", async () => {
    vi.mocked(pluginRuntime.runPluginFunction).mockResolvedValueOnce(null);
    await expect(
      saveGoalSettings(db, "owner", entry(), pluginDefinition())
    ).rejects.toThrow("contract object");
    expect(db.select().from(goalUserSettings).all()).toHaveLength(0);
  });
});
