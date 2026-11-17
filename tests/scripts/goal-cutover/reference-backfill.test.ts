import { describe, expect, it } from "vitest";
import {
  type GoalReferenceSource,
  prepareGoalReferenceBackfill,
} from "../../../scripts/lib/goal-cutover/reference-backfill";
import type { GoalIdentity } from "../../../src/lib/goals/references";

const goals: GoalIdentity[] = [
  { id: "recall", name: "recall", privateFor: null, deleted: false },
  { id: "shared", name: "practice", privateFor: null, deleted: false },
  { id: "owned", name: "practice", privateFor: "owner", deleted: false },
  { id: "foreign", name: "secret", privateFor: "another", deleted: false },
];
function source(
  overrides: Partial<GoalReferenceSource> = {}
): GoalReferenceSource {
  return {
    kind: "history",
    key: "event",
    ownerId: "owner",
    goal: "practice",
    goalId: null,
    schedulerId: null,
    row: {
      goal: "practice",
      goal_id: null,
      practiced: "2020-01-01T00:00:00.123456",
    },
    ...overrides,
  };
}

describe("legacy goal-reference backfill", () => {
  it("uses owner-before-system attribution without changing raw evidence", () => {
    const original = source();
    const before = structuredClone(original);
    const result = prepareGoalReferenceBackfill(goals, [original]);
    expect(result.updates[0].goalId).toBe("owned");
    expect(original).toEqual(before);
    expect(result.updates[0].expected).toEqual(before);
    expect(result.updates[0].expected).not.toBe(original);
    expect(original.goalId).toBeNull();
  });

  it("does not expose another owner's private goal", () => {
    const result = prepareGoalReferenceBackfill(goals, [
      source({ goal: "secret" }),
    ]);
    expect(result.updates).toEqual([]);
    expect(result.unresolved).toHaveLength(1);
  });

  it("leaves ambiguous shared names unattributed", () => {
    const result = prepareGoalReferenceBackfill(
      [
        ...goals,
        { id: "duplicate", name: "recall", privateFor: null, deleted: false },
      ],
      [source({ goal: "recall" })]
    );
    expect(result.updates).toEqual([]);
    expect(result.unresolved[0].reason).toMatch(/Ambiguous/);
  });

  it("leaves an unknown historical name intact rather than attributing it to Recall", () => {
    const result = prepareGoalReferenceBackfill(goals, [
      source({ goal: "missing" }),
    ]);
    expect(result.updates).toEqual([]);
    expect(result.unresolved[0].reason).toMatch(/unavailable/);
  });

  it("attributes an absent legacy goal to the established Recall default", () => {
    expect(
      prepareGoalReferenceBackfill(goals, [source({ goal: null })]).updates[0]
        .goalId
    ).toBe("recall");
  });

  it("never rewrites an already attributed event after a legacy-name change", () => {
    expect(
      prepareGoalReferenceBackfill(goals, [source({ goalId: "recall" })])
    ).toEqual({ updates: [], unresolved: [] });
  });

  it("does not repair a malformed new-format event by guessing from its legacy name", () => {
    const result = prepareGoalReferenceBackfill(goals, [
      source({ schedulerId: "builtin:fsrs6" }),
    ]);
    expect(result.updates).toEqual([]);
    expect(result.unresolved[0].reason).toMatch(/New-format/);
  });

  it("reconciles a changed legacy name on an active assignment", () => {
    const result = prepareGoalReferenceBackfill(goals, [
      source({ kind: "assignment", goalId: "recall" }),
    ]);
    expect(result.updates[0].goalId).toBe("owned");
  });

  it.each([
    ["evaluation_id", ""],
    ["evaluation_snapshot", "{}"],
    ["scheduler_id", "builtin:fsrs6"],
    ["scheduler_version", 1],
    ["scheduler_version", 0],
    ["scheduler_state", "{}"],
    ["interval_days", 0],
  ])("leaves partial event metadata (%s) unattributed", (field, value) => {
    const original = source();
    const result = prepareGoalReferenceBackfill(goals, [
      { ...original, row: { ...original.row, [field]: value } },
    ]);
    expect(result.updates).toEqual([]);
    expect(result.unresolved[0].reason).toMatch(/New-format/);
  });

  it("still attributes a genuinely legacy row with all new fields null", () => {
    const original = source();
    const result = prepareGoalReferenceBackfill(goals, [
      {
        ...original,
        row: {
          ...original.row,
          evaluation_id: null,
          evaluation_snapshot: null,
          scheduler_id: null,
          scheduler_version: null,
          scheduler_state: null,
          interval_days: null,
        },
      },
    ]);
    expect(result.updates[0].goalId).toBe("owned");
    expect(result.unresolved).toEqual([]);
  });

  it("allows historical attribution to a deleted goal", () => {
    const deleted = goals.map((goal) => ({ ...goal, deleted: true }));
    expect(
      prepareGoalReferenceBackfill(deleted, [source()]).updates[0].goalId
    ).toBe("owned");
  });

  it("does not attribute an active assignment to a deleted goal", () => {
    const deleted = goals.map((goal) => ({ ...goal, deleted: true }));
    const result = prepareGoalReferenceBackfill(deleted, [
      source({ kind: "assignment" }),
    ]);
    expect(result.updates).toEqual([]);
    expect(result.unresolved).toHaveLength(1);
  });
});
