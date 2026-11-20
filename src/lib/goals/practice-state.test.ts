import { describe, expect, it } from "vitest";
import { getBuiltInGoals } from "./builtins";
import { canonicalJson } from "./config";
import { type PracticeStateRecord, readPracticeState } from "./practice-state";
import { parseFsrs6State } from "./state";

const recallId = getBuiltInGoals()[0].id;
const legacy: PracticeStateRecord = {
  goalId: null,
  goal: "recall",
  technique: null,
  schedulerId: null,
  schedulerVersion: null,
  schedulerState: null,
  stability: 12,
  difficulty: 5,
  state: 2,
  repetitions: 10,
  lapses: 2,
};
const state = {
  version: 1,
  stability: 12,
  difficulty: 5,
  status: 2,
  reps: 10,
  lapses: 2,
  learningSteps: 1,
  scheduledDays: 3,
};
const modern: PracticeStateRecord = {
  ...legacy,
  goalId: recallId,
  schedulerId: "builtin:fsrs6",
  schedulerVersion: 1,
  schedulerState: canonicalJson(state),
};

describe("single practice state reader", () => {
  it("uses JSON despite contradictory legacy projections", () => {
    const decoded = readPracticeState(
      { ...modern, stability: 999, state: 0 },
      null
    );
    expect(decoded).toMatchObject({ kind: "fsrs6", source: "json", state });
  });
  it("decodes legacy Recall and exposes unrecoverable learning progress", () => {
    expect(readPracticeState(legacy, recallId)).toMatchObject({
      kind: "fsrs6",
      source: "legacy",
      state: { stability: 12, reps: 10, learningSteps: 0, scheduledDays: 0 },
      limitations: [expect.stringContaining("not stored")],
    });
  });
  it("preserves the old reader's zero-lapse default for imported legacy Recall", () => {
    expect(
      readPracticeState({ ...legacy, lapses: null }, recallId)
    ).toMatchObject({
      kind: "fsrs6",
      source: "legacy",
      state: { lapses: 0, stability: 12, reps: 10 },
      limitations: expect.arrayContaining([
        expect.stringContaining("lapse count"),
      ]),
    });
  });
  it("does not default missing lapses in new JSON state", () => {
    expect(() =>
      readPracticeState(
        {
          ...modern,
          schedulerState: canonicalJson({ ...state, lapses: null }),
        },
        recallId
      )
    ).toThrow("Invalid FSRS-6 state");
  });
  it.each(["base_interval", "plugin-id", "metronome"])(
    "does not infer FSRS from numeric columns for legacy technique %s",
    (technique) => {
      expect(readPracticeState({ ...legacy, technique }, recallId).kind).toBe(
        "unavailable"
      );
    }
  );
  it("does not attribute a same-name private goal to built-in Recall", () => {
    expect(readPracticeState(legacy, "private-recall").kind).toBe(
      "unavailable"
    );
  });
  it("keeps unresolved historical goals unavailable", () => {
    expect(readPracticeState(legacy, null).kind).toBe("unavailable");
  });
  it.each([null, "{", "{}", '{"version":2}', "[]"])(
    "rejects malformed new state without legacy fallback: %s",
    (schedulerState) => {
      expect(() =>
        readPracticeState({ ...modern, schedulerState }, recallId)
      ).toThrow();
    }
  );
  it("reports unsupported scheduler contracts", () => {
    expect(
      readPracticeState({ ...modern, schedulerVersion: 2 }, recallId)
    ).toMatchObject({ kind: "unavailable" });
  });
  it("reports an unknown scheduler without interpreting its data as FSRS", () => {
    expect(
      readPracticeState(
        { ...modern, schedulerId: "unsupported:unknown" },
        recallId
      )
    ).toMatchObject({ kind: "unavailable" });
  });
  it("rejects missing new goal identity", () => {
    expect(() =>
      readPracticeState({ ...modern, goalId: null }, recallId)
    ).toThrow(/identity/);
  });
  it.each([
    { stability: -1 },
    { difficulty: 11 },
    { learningSteps: 0.5 },
    { reps: -1 },
    { lapses: 11 },
    { status: 4 },
    { scheduledDays: Infinity },
    { extra: "unexpected" },
  ])("rejects invalid FSRS state %j", (invalid) => {
    expect(() => parseFsrs6State({ ...state, ...invalid })).toThrow();
  });
  it("rejects oversized state before parsing", () => {
    expect(() =>
      readPracticeState({ ...modern, schedulerState: " ".repeat(16385) }, null)
    ).toThrow(/large/);
  });
  it("returns a copy rather than exposing mutable state", () => {
    const parsed = parseFsrs6State(state);
    parsed.reps = 99;
    expect(state.reps).toBe(10);
  });
});
