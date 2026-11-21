import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getBuiltInGoals } from "./builtins";
import {
  canonicalJson,
  hashCanonicalJson,
  MAX_DATE_MS,
  parseGoalConfig,
  parseGoalOverrides,
  resolveGoalConfig,
  resolveGoalDefinition,
  SCHEDULER_STATE_BYTES,
  serializeEvaluationSnapshot,
  validateIntervals,
} from "./config";

function config(name = "fluency") {
  const goal = getBuiltInGoals().find((entry) => entry.name === name);
  if (!goal) throw new Error("Missing fixture");
  return goal.config;
}

describe("goal definitions and overrides", () => {
  it.each([{}, { allowSameDayReviews: false }, { allowSameDayReviews: true }])(
    "accepts the FSRS same-day setting %j",
    (setting) => {
      const value = config("recall");
      if (value.scheduler.id !== "builtin:fsrs6")
        throw new Error("Expected FSRS");
      value.scheduler = { ...value.scheduler, ...setting };
      expect(parseGoalConfig(value)).toEqual(value);
    }
  );
  it("rejects a non-boolean FSRS same-day setting", () => {
    const value = config("recall");
    expect(() =>
      parseGoalConfig({
        ...value,
        scheduler: { ...value.scheduler, allowSameDayReviews: "true" },
      })
    ).toThrow("must be boolean");
  });
  it("accepts explicit plugin identity and named action mappings", () => {
    const value = config();
    value.scheduler = {
      id: "plugin",
      version: 1,
      pluginId: "selected",
      options: {},
    };
    value.evaluations = [
      {
        id: "smooth",
        label: "Smooth",
        description: "",
        action: { kind: "plugin", actionId: "advance" },
      },
    ];
    expect(parseGoalConfig(value)).toEqual(value);
  });
  it("rejects a plugin choice on a built-in scheduler", () => {
    const value = config();
    value.evaluations[0].action = { kind: "plugin", actionId: "advance" };
    expect(() => parseGoalConfig(value)).toThrow("must match");
  });
  it("rejects numeric FSRS choices on a plugin scheduler", () => {
    const value = config("recall");
    value.scheduler = {
      id: "plugin",
      version: 1,
      pluginId: "selected",
      options: {},
    };
    expect(() => parseGoalConfig(value)).toThrow("must match");
  });
  it.each(["x".repeat(17000), "🎵".repeat(5000), "x\n".repeat(6000)])(
    "rejects evaluations exceeding the serialized snapshot budget (%#)",
    (text) => {
      const value = config();
      value.evaluations[0].label = text;
      expect(() => parseGoalConfig(value)).toThrow(/large/);
      expect(() =>
        parseGoalOverrides({ evaluations: value.evaluations })
      ).toThrow(/large/);
    }
  );
  it("rejects combined evaluation text that exceeds the snapshot budget", () => {
    const value = config();
    value.evaluations[0].label = "x".repeat(9000);
    value.evaluations[0].description = "y".repeat(9000);
    expect(() => parseGoalConfig(value)).toThrow(/large/);
  });
  it("checks inherited evaluations against the overridden goal name", () => {
    const defaults = { displayName: "Goal", description: "", config: config() };
    defaults.config.evaluations[0].label = "x".repeat(9000);
    const overrides = { displayName: "y".repeat(9000) };
    expect(() => parseGoalOverrides(overrides)).not.toThrow();
    expect(() => resolveGoalDefinition(defaults, overrides)).toThrow(/large/);
  });
  it("checks overridden evaluations against the inherited goal name", () => {
    const defaults = {
      displayName: "x".repeat(9000),
      description: "",
      config: config(),
    };
    const evaluations = config().evaluations;
    evaluations[0].label = "y".repeat(9000);
    expect(() => resolveGoalDefinition(defaults, { evaluations })).toThrow(
      /large/
    );
  });
  it("accepts a complete snapshot exactly at the byte limit", () => {
    const defaults = { displayName: "Goal", description: "", config: config() };
    const choice = defaults.config.evaluations[0];
    choice.description = "";
    const size = new TextEncoder().encode(
      serializeEvaluationSnapshot(defaults.displayName, choice)
    ).length;
    choice.description = "x".repeat(SCHEDULER_STATE_BYTES - size);
    expect(() => resolveGoalDefinition(defaults)).not.toThrow();
    choice.description += "x";
    expect(() => resolveGoalDefinition(defaults)).toThrow(/large/);
  });

  it.each(["\u0000", "\ud800", "\udfff"])(
    "rejects unstorable override text %j",
    (text) => {
      expect(() => parseGoalOverrides({ description: text })).toThrow(
        /NUL|surrogate/
      );
    }
  );
  it.each(["\u0000", "\ud800", "\udfff"])(
    "rejects unstorable configuration text %j",
    (text) => {
      const value = config();
      value.evaluations[0].label = text;
      expect(() => parseGoalConfig(value)).toThrow(/NUL|surrogate/);
    }
  );
  it("preserves valid Unicode including surrogate pairs", () => {
    const description = "Flûte 🎵";
    expect(parseGoalOverrides({ description })).toEqual({ description });
  });
  it("rejects unstorable JSON object keys", () => {
    expect(() => canonicalJson({ "\ud800": 1 })).toThrow(/surrogate/);
  });
  it("keeps the recall identity", () => {
    const recall = getBuiltInGoals()[0];
    expect(recall.id).toBe("00000000-0000-0000-0000-000000000001");
  });
  it("keeps the pinned FSRS-6 scheduler", () => {
    const recall = getBuiltInGoals()[0];
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
  });
  it("keeps recall daily settings", () => {
    const recall = getBuiltInGoals()[0];
    expect(recall.config.daily).toMatchObject({ minimum: 3, maximum: 10 });
  });
  it("keeps fluency daily settings", () => {
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
  it("inherits changed default evaluations", () => {
    const updated = config();
    updated.evaluations[0].label = "New developer label";
    expect(resolveGoalConfig(updated).evaluations[0].label).toBe(
      "New developer label"
    );
  });
  it("preserves overridden evaluations when defaults change", () => {
    const old = config();
    const updated = config();
    updated.evaluations[0].label = "New developer label";
    expect(
      resolveGoalConfig(updated, { evaluations: old.evaluations })
        .evaluations[0].label
    ).toBe("Fragmented");
  });
  it("uses updated defaults for an empty override", () => {
    const updated = config();
    updated.evaluations[0].label = "New developer label";
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
  it("rejects an array masquerading as an action kind", () => {
    const value = config();
    expect(() =>
      parseGoalConfig({
        ...value,
        evaluations: [
          { ...value.evaluations[0], action: { kind: ["advance"] } },
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
  it("rejects a sparse array whose extra property hides the hole", () => {
    const value = Object.assign(new Array(1), { extra: 1 });
    expect(() => canonicalJson(value)).toThrow(/Sparse or decorated/);
  });
  it("rejects nonenumerable array decorations", () => {
    const value = Object.defineProperty([1], "extra", { value: 2 });
    expect(() => canonicalJson(value)).toThrow(/Sparse or decorated/);
  });
  it("rejects cycles", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(() => canonicalJson(value)).toThrow(/cycles/);
  });
});

describe("ladder interval representation", () => {
  it("rejects intervals rounded to zero seconds", () => {
    expect(() => validateIntervals([0.49 / 86400])).toThrow(/second precision/);
  });
  it("accepts intervals rounded to one second", () => {
    expect(() => validateIntervals([0.5 / 86400])).not.toThrow();
  });
  it("rejects intervals longer than the entire Date range", () => {
    expect(() => validateIntervals([200_000_001])).toThrow(/Date range/);
  });
  it("accepts the full Date span from the earliest practiced time", () => {
    expect(() => validateIntervals([200_000_000], -MAX_DATE_MS)).not.toThrow();
  });
  it("rejects a due date beyond the range for the supplied practiced time", () => {
    expect(() => validateIntervals([1], MAX_DATE_MS - 1000)).toThrow(
      /Date range/
    );
  });
});

describe("canonical JSON hashing", () => {
  it("hashes the same bytes regardless of object insertion order", async () => {
    const expected = createHash("sha256").update('{"a":1,"b":2}').digest("hex");
    expect(await hashCanonicalJson({ b: 2, a: 1 })).toBe(expected);
    expect(await hashCanonicalJson({ a: 1, b: 2 })).toBe(expected);
  });
  it("preserves caller-specific UTF-8 payload budgets", async () => {
    await expect(hashCanonicalJson("é", 3)).rejects.toThrow(/large/);
    await expect(hashCanonicalJson("é", 4)).resolves.toMatch(/^[a-f0-9]{64}$/);
  });
});
