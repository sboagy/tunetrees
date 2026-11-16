import { describe, expect, it } from "vitest";
import { getBuiltInGoals } from "./builtins";
import {
  canonicalJson,
  parseGoalConfig,
  resolveGoalConfig,
  resolveGoalDefinition,
} from "./config";

function config(name = "fluency") {
  const goal = getBuiltInGoals().find((entry) => entry.name === name);
  if (!goal) throw new Error("Missing fixture");
  return goal.config;
}

describe("goal definitions and overrides", () => {
  it("keeps built-in identities and the pinned FSRS-6 default", () => {
    const recall = getBuiltInGoals()[0];
    expect(recall.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(recall.config.scheduler).toMatchObject({
      id: "builtin:fsrs6",
      maximumIntervalDays: 36500,
      retention: 0.9,
      learningStepsMinutes: [1, 10],
      relearningStepsMinutes: [10],
      weights: [
        0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
        0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
        0.0912, 0.0658, 0.1542,
      ],
      fuzz: false,
    });
    expect(recall.config.daily).toMatchObject({ minimum: 3, maximum: 10 });
    expect(config().daily).toMatchObject({ minimum: 0, maximum: 2 });
  });
  it("merges daily fields independently, preserving false and Unlimited", () => {
    expect(
      resolveGoalConfig(config(), {
        daily: { maximum: 0, minimum: 5, autoNew: false },
      }).daily
    ).toEqual({ minimum: 5, maximum: 0, autoNew: false, delinquencyDays: 7 });
  });
  it("rejects a partial override inconsistent with an inherited maximum", () => {
    expect(() =>
      resolveGoalConfig(config(), { daily: { minimum: 3 } })
    ).toThrow(/Minimum/);
  });
  it("replaces evaluation sections without merging by array index", () => {
    const evaluations = [
      {
        id: "personal",
        label: "Try later",
        description: "",
        action: { kind: "back" },
      },
    ];
    expect(resolveGoalConfig(config(), { evaluations }).evaluations).toEqual(
      evaluations
    );
  });
  it("inherits changed defaults, preserves customized choices, and resets by omission", () => {
    const old = config();
    const updated = config();
    updated.evaluations[0].label = "New developer label";
    expect(resolveGoalConfig(updated).evaluations[0].label).toBe(
      "New developer label"
    );
    expect(
      resolveGoalConfig(updated, { evaluations: old.evaluations })
        .evaluations[0].label
    ).toBe("Fragmented");
    expect(resolveGoalConfig(updated, {}).evaluations[0].label).toBe(
      "New developer label"
    );
  });
  it("rejects ladder actions on an FSRS scheduler", () => {
    expect(() =>
      resolveGoalConfig(config("recall"), { evaluations: config().evaluations })
    ).toThrow(/match/);
  });
  it("rejects unknown evaluations instead of mapping to Good", () => {
    const value = config();
    expect(() =>
      parseGoalConfig({
        ...value,
        evaluations: [
          { ...value.evaluations[0], action: { kind: "whatever" } },
        ],
      })
    ).toThrow(/Unknown/);
  });
  it("rejects duplicate evaluation identities", () => {
    const value = config();
    value.evaluations.push(value.evaluations[0]);
    expect(() => parseGoalConfig(value)).toThrow(/unique/);
  });
  it.each(
    [[], [0], [1, 1], [2, 1], [1, Infinity]].map((intervalsDays) => ({
      intervalsDays,
    }))
  )("rejects invalid ladder $intervalsDays", ({ intervalsDays }) => {
    expect(() =>
      resolveGoalConfig(config(), {
        scheduler: { id: "builtin:interval-ladder", version: 1, intervalsDays },
      })
    ).toThrow();
  });
  it("overrides display names without replacing goal or choice identities", () => {
    const defaults = getBuiltInGoals()[2];
    const effective = resolveGoalDefinition(defaults, {
      displayName: "Comfortable playing",
    });
    expect(effective.displayName).toBe("Comfortable playing");
    expect(effective.config.evaluations.map((choice) => choice.id)).toEqual(
      defaults.config.evaluations.map((choice) => choice.id)
    );
    expect(resolveGoalDefinition(defaults).displayName).toBe("Fluency");
  });
  it("returns isolated configurations", () => {
    const first = config();
    const resolved = resolveGoalConfig(first);
    resolved.evaluations[0].label = "Personal";
    expect(first.evaluations[0].label).toBe("Fragmented");
    expect(config().evaluations[0].label).toBe("Fragmented");
  });
  it("round trips fractional settings through canonical JSON text", () => {
    const source = config("initial_learn");
    expect(parseGoalConfig(JSON.parse(canonicalJson(source)))).toEqual(source);
  });
});

describe("canonical JSON boundary", () => {
  it("sorts nested object keys without reordering arrays", () => {
    expect(canonicalJson({ z: [2, 1], a: { y: 2, x: 1 } })).toBe(
      '{"a":{"x":1,"y":2},"z":[2,1]}'
    );
  });
  it("uses stable code-unit key order rather than locale collation", () => {
    const expected = '{"10":4,"2":5,"Z":0,"a":1,"ä":2}';
    expect(canonicalJson({ ä: 2, a: 1, Z: 0, 2: 5, 10: 4 })).toBe(expected);
    expect(canonicalJson({ 10: 4, Z: 0, 2: 5, a: 1, ä: 2 })).toBe(expected);
  });
  it.each([NaN, Infinity, undefined, new Date(), { missing: undefined }])(
    "rejects lossy values %j",
    (value) => {
      expect(() => canonicalJson(value)).toThrow();
    }
  );
  it("enforces UTF-8 bytes rather than character count", () => {
    expect(() => canonicalJson("éé", 5)).toThrow(/large/);
  });
  it("rejects cycles", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(() => canonicalJson(value)).toThrow(/cycles/);
  });
});
