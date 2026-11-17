import { describe, expect, it } from "vitest";
import { getBuiltInGoals } from "./builtins";
import { prepareGoalCutoverPlan } from "./cutover-plan";
import {
  type LegacyGoalDefinition,
  prepareLegacyGoalDefinition,
} from "./legacy-goals";

const custom: LegacyGoalDefinition = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "My practice",
  privateFor: "22222222-2222-4222-8222-222222222222",
  deleted: false,
  defaultTechnique: "base_interval",
  baseIntervals: "[0.1,0.5,1,3]",
  defaultConfig: null,
  displayName: null,
  description: null,
};
const recall: LegacyGoalDefinition = {
  ...custom,
  id: getBuiltInGoals()[0].id,
  name: "recall",
  privateFor: null,
  defaultTechnique: "fsrs",
  baseIntervals: null,
};

describe("legacy custom goal conversion", () => {
  it("retains fractional intervals and gives each explicit ladder action a UUID", () => {
    const result = prepareLegacyGoalDefinition(custom);
    const config = JSON.parse(result?.defaultConfig ?? "null");
    expect(config.scheduler.intervalsDays).toEqual([0.1, 0.5, 1, 3]);
    expect(
      config.evaluations.map((choice: { action: unknown }) => choice.action)
    ).toEqual([
      { kind: "reset" },
      { kind: "back" },
      { kind: "stay" },
      { kind: "advance" },
    ]);
    expect(
      new Set(config.evaluations.map((choice: { id: string }) => choice.id))
        .size
    ).toBe(4);
    expect(config.evaluations[0].id).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/
    );
    expect(result?.displayName).toBe(custom.name);
    expect(result).not.toHaveProperty("name");
  });

  it("uses common FSRS defaults with deliberate zero-minimum custom practice", () => {
    const result = prepareLegacyGoalDefinition({
      ...custom,
      defaultTechnique: "fsrs",
    });
    const config = JSON.parse(result?.defaultConfig ?? "null");
    expect(config.scheduler).toEqual(getBuiltInGoals()[0].config.scheduler);
    expect(config.daily.minimum).toBe(0);
    expect(
      config.evaluations.map((choice: { action: unknown }) => choice.action)
    ).toEqual([
      { kind: "fsrs", rating: 1 },
      { kind: "fsrs", rating: 2 },
      { kind: "fsrs", rating: 3 },
      { kind: "fsrs", rating: 4 },
    ]);
  });

  it("preserves valid existing configuration and choice identities on retry", () => {
    const first = prepareLegacyGoalDefinition(custom);
    expect(prepareLegacyGoalDefinition({ ...custom, ...first })).toBeNull();
  });

  it.each([null, "[]", "[3,1]", "{}", "not JSON"])(
    "rejects missing or invalid ladder intervals: %s",
    (baseIntervals) => {
      expect(() =>
        prepareLegacyGoalDefinition({ ...custom, baseIntervals })
      ).toThrow();
    }
  );

  it("rejects corrupt new configuration instead of decoding old fields", () => {
    expect(() =>
      prepareLegacyGoalDefinition({ ...custom, defaultConfig: "{}" })
    ).toThrow();
  });

  it("blocks plugin conversion without a contract", () => {
    expect(() =>
      prepareLegacyGoalDefinition({
        ...custom,
        defaultTechnique: "plugin:unknown",
      })
    ).toThrow(/contract/);
  });

  it("blocks custom/system name collisions rather than merging meanings", () => {
    expect(() =>
      prepareLegacyGoalDefinition({ ...custom, name: "fluency" })
    ).toThrow(/identity/);
  });

  it("leaves missing shared built-in configuration to the generated seed", () => {
    expect(prepareLegacyGoalDefinition(recall)).toBeNull();
  });

  it("rejects an unknown shared goal", () => {
    expect(() =>
      prepareLegacyGoalDefinition({ ...custom, privateFor: null })
    ).toThrow(/shared/);
  });
});

describe("server cutover data plan", () => {
  it("prepares custom definitions and only absent Recall overrides", () => {
    const plan = prepareGoalCutoverPlan(
      [recall, custom],
      [
        { id: "new", preferences: { hasExistingOverride: false } },
        { id: "existing", preferences: { hasExistingOverride: true } },
      ]
    );
    expect(plan.goalUpdates.map((entry) => entry.id)).toEqual([custom.id]);
    expect(plan.recallSettingsInserts.map((entry) => entry.userId)).toEqual([
      "new",
    ]);
    expect(plan.goalUpdates[0].expected).toEqual(custom);
    expect(plan.goalUpdates[0].expected).not.toBe(custom);
  });

  it("does not return a partial plan when a later goal cannot convert", () => {
    expect(() =>
      prepareGoalCutoverPlan(
        [
          recall,
          custom,
          { ...custom, id: "unknown", defaultTechnique: "unknown" },
        ],
        []
      )
    ).toThrow(/contract/);
  });

  it("requires shared Recall before preparing user settings", () => {
    expect(() => prepareGoalCutoverPlan([custom], [])).toThrow(/Recall/);
  });

  it("rejects a deleted shared Recall goal", () => {
    expect(() =>
      prepareGoalCutoverPlan([{ ...recall, deleted: true }], [])
    ).toThrow(/Recall/);
  });
});
