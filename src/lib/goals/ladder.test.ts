import { describe, expect, it } from "vitest";
import { getBuiltInGoals } from "./builtins";
import { calculateLadder, type LadderPredecessor } from "./ladder";

const practiced = new Date("2026-11-15T10:00:00.987Z");
function input(name = "fluency") {
  const goal = getBuiltInGoals().find((entry) => entry.name === name);
  if (!goal) throw new Error("Missing fixture");
  return {
    goalId: goal.id,
    config: goal.config,
    evaluationId: goal.config.evaluations[3].id,
    practiced,
    predecessor: null as LadderPredecessor | null,
  };
}
async function prior(index: number): Promise<LadderPredecessor> {
  const initial = input();
  const result = await calculateLadder(initial);
  return {
    goalId: initial.goalId,
    schedulerId: "builtin:interval-ladder",
    schedulerVersion: 1,
    schedulerState: { ...result.state, ladderIndex: index },
  };
}

describe("independent interval ladder", () => {
  it.each([
    ["fragmented", 1],
    ["uneven", 1],
    ["fluent", 1],
    ["effortless", 3],
  ])(
    "starts fresh with %s due in %s days",
    async (evaluationId, intervalDays) => {
      expect(
        (await calculateLadder({ ...input(), evaluationId })).intervalDays
      ).toBe(intervalDays);
    }
  );
  it.each([
    ["fragmented", 1],
    ["uneven", 3],
    ["fluent", 7],
    ["effortless", 14],
  ])("applies %s at the seven-day rung", async (evaluationId, intervalDays) => {
    expect(
      (
        await calculateLadder({
          ...input(),
          evaluationId,
          predecessor: await prior(2),
        })
      ).intervalDays
    ).toBe(intervalDays);
  });
  it("clamps advance at the last rung and reports the boundary", async () => {
    const result = await calculateLadder({
      ...input(),
      predecessor: await prior(4),
    });
    expect(result.intervalDays).toBe(21);
    expect(result.boundary).toBe("longest");
  });
  it("keeps fractional due times and a valid legacy integer projection", async () => {
    const result = await calculateLadder({
      ...input("initial_learn"),
      evaluationId: "cannot_play",
    });
    expect(result.practiced.toISOString()).toBe("2026-11-15T10:00:00.000Z");
    expect(result.due.toISOString()).toBe("2026-11-15T12:24:00.000Z");
    expect(result.intervalDays).toBe(0.1);
    expect(result.legacyInterval).toBe(1);
  });
  it("starts fresh after a submitted different goal using the same scheduler", async () => {
    const predecessor = { ...(await prior(4)), goalId: "other-goal" };
    const result = await calculateLadder({ ...input(), predecessor });
    expect(result.continued).toBe(false);
    expect(result.intervalDays).toBe(3);
  });
  it("continues after label/daily edits and uses remapped actions", async () => {
    const options = input();
    options.config.evaluations[3].label = "My label";
    options.config.evaluations[3].action = { kind: "back" };
    options.config.daily.minimum = 1;
    const result = await calculateLadder({
      ...options,
      predecessor: await prior(2),
    });
    expect(result.continued).toBe(true);
    expect(result.intervalDays).toBe(3);
  });
  it("starts fresh after the interval ladder changes", async () => {
    const options = input();
    options.config.scheduler = {
      id: "builtin:interval-ladder",
      version: 1,
      intervalsDays: [2, 4, 8],
    };
    const result = await calculateLadder({
      ...options,
      predecessor: await prior(2),
    });
    expect(result.continued).toBe(false);
    expect(result.intervalDays).toBe(4);
  });
  it("does not mutate committed state during repeated previews", async () => {
    const predecessor = await prior(2);
    const first = await calculateLadder({ ...input(), predecessor });
    const second = await calculateLadder({ ...input(), predecessor });
    expect(second).toEqual(first);
    expect(predecessor.schedulerState).toMatchObject({ ladderIndex: 2 });
  });
  it("supports a single-step ladder", async () => {
    const options = input();
    options.config.scheduler = {
      id: "builtin:interval-ladder",
      version: 1,
      intervalsDays: [0.5],
    };
    expect((await calculateLadder(options)).intervalDays).toBe(0.5);
  });
  it("rejects an unmapped choice", async () => {
    await expect(
      calculateLadder({ ...input(), evaluationId: "unknown" })
    ).rejects.toThrow(/valid/);
  });
  it("rejects invalid state instead of silently advancing", async () => {
    const predecessor = {
      ...(await prior(2)),
      schedulerState: { version: 1, ladderIndex: -1, ladderHash: "broken" },
    };
    await expect(calculateLadder({ ...input(), predecessor })).rejects.toThrow(
      /state/
    );
  });
});
