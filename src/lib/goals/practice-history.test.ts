import { describe, expect, it } from "vitest";
import type { PracticeRecord } from "../db/types";
import { getBuiltInGoals } from "./builtins";
import { serializeEvaluationSnapshot } from "./config";
import {
  buildHistoryEvents,
  historyStabilitySeries,
  summarizeHistoryEvents,
} from "./practice-history";

const goals = getBuiltInGoals().map((goal) => ({
  ...goal,
  privateFor: null,
  deleted: false,
}));
const recall = goals.find((goal) => goal.name === "recall")!;
const fluency = goals.find((goal) => goal.name === "fluency")!;
function record(overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return {
    id: "event",
    repertoireRef: "repertoire",
    tuneRef: "tune",
    practiced: "2026-11-19T12:00:00Z",
    due: "2026-11-20T12:00:00Z",
    goal: "recall",
    technique: "fsrs",
    goalId: recall.id,
    evaluationId: "good",
    evaluationSnapshot: serializeEvaluationSnapshot("Recorded Recall", {
      label: "Remembered",
      description: "No help",
      action: { kind: "fsrs", rating: 3 },
    }),
    schedulerId: "builtin:fsrs6",
    schedulerVersion: 1,
    schedulerState: JSON.stringify({
      version: 1,
      stability: 12,
      difficulty: 5,
      scheduledDays: 1,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      status: 2,
    }),
    intervalDays: 0.5,
    interval: 99,
    quality: 1,
    stability: 999,
    difficulty: 9,
    state: 0,
    repetitions: 99,
    lapses: 0,
    step: null,
    easiness: null,
    elapsedDays: null,
    backupPracticed: null,
    lastModifiedAt: "2026-11-19T12:00:00Z",
    syncVersion: 1,
    deviceId: null,
    ...overrides,
  };
}
function ladder(overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return record({
    goalId: fluency.id,
    goal: "fluency",
    schedulerId: "builtin:interval-ladder",
    schedulerState: JSON.stringify({
      version: 1,
      ladderIndex: 2,
      ladderHash: "ladder-a",
    }),
    evaluationId: "smooth",
    evaluationSnapshot: serializeEvaluationSnapshot("Recorded Fluency", {
      label: "Smooth",
      description: "Advance",
      action: { kind: "advance" },
    }),
    ...overrides,
  });
}
const read = (records: PracticeRecord[]) =>
  buildHistoryEvents(records, goals, "user");

describe("mixed-goal history", () => {
  it("uses immutable labels and authoritative JSON instead of current settings and projections", () => {
    const [event] = read([record()]);
    expect(event).toMatchObject({
      goalLabel: "Recorded Recall",
      evaluationLabel: "Remembered",
      rating: 3,
      intervalDays: 0.5,
      state: { kind: "fsrs6", state: { stability: 12, reps: 1 } },
    });
  });
  it("keeps deleted goals and unsupported models visible without legacy fallback", () => {
    const [event] = read([
      record({ goalId: "deleted-goal", schedulerVersion: 99 }),
    ]);
    expect(event).toMatchObject({
      goalKey: "goal:deleted-goal",
      goalLabel: "Recorded Recall",
      evaluationLabel: "Remembered",
      rating: null,
      state: { kind: "unavailable" },
    });
  });
  it("keeps malformed state and evaluation rows visible", () => {
    const [event] = read([
      record({ schedulerState: "broken", evaluationSnapshot: "broken" }),
    ]);
    expect(event).toMatchObject({
      evaluationLabel: "good",
      rating: null,
      state: { kind: "unavailable" },
    });
    expect(event.notices).toHaveLength(2);
  });
  it("does not interpret ladder compatibility ratings as FSRS success", () => {
    expect(
      summarizeHistoryEvents(read([record(), ladder({ id: "ladder" })]))
    ).toMatchObject({
      totalSessions: 2,
      successRate: null,
      currentStreak: null,
      averageInterval: 0.5,
    });
  });
  it("assigns episodes before filtering Recall around intervening Fluency", () => {
    const events = read([
      record({ id: "first", practiced: "2026-11-17T12:00:00Z" }),
      ladder({ id: "middle", practiced: "2026-11-18T12:00:00Z" }),
      record({ id: "last" }),
    ]).filter((event) => event.goalKey === `goal:${recall.id}`);
    expect(events.map((event) => event.episode)).toEqual([3, 1]);
    expect(summarizeHistoryEvents(events).currentStreak).toBe(1);
  });
  it("does not join FSRS state when counters reset within the same goal", () => {
    expect(
      read([record({ id: "a" }), record({ id: "b" })]).map(
        (event) => event.episode
      )
    ).toEqual([2, 1]);
  });
  it("uses the legacy decoder only for resolved Recall", () => {
    const [event] = read([
      record({
        goalId: null,
        schedulerId: null,
        schedulerVersion: null,
        schedulerState: null,
        evaluationId: null,
        evaluationSnapshot: null,
        quality: 4,
        state: 2,
        repetitions: 10,
      }),
    ]);
    expect(event).toMatchObject({
      legacy: true,
      evaluationLabel: "Easy",
      rating: 4,
      intervalDays: 99,
      state: { source: "legacy" },
    });
  });
  it("excludes unknown intervals rather than substituting zero or compatibility values", () => {
    expect(
      summarizeHistoryEvents(
        read([record({ intervalDays: null }), ladder({ id: "b" })])
      ).averageInterval
    ).toBe(0.5);
  });
  it("counts repeated same-day events independently in canonical order", () => {
    const events = read([
      record({ id: "a", practiced: "2026-11-19T12:00:00.000002Z" }),
      record({ id: "b", practiced: "2026-11-19T12:00:00.000001Z" }),
    ]);
    expect(events.map((event) => event.record.id)).toEqual(["a", "b"]);
    expect(summarizeHistoryEvents(events).totalSessions).toBe(2);
  });
});

it("keeps filtered stability points in separate state-series datasets", () => {
  const events = read([
    record({ id: "a", practiced: "2026-11-17T12:00:00Z" }),
    ladder({ id: "b", practiced: "2026-11-18T12:00:00Z" }),
    record({ id: "c" }),
  ]).filter((event) => event.state.kind === "fsrs6");
  expect(
    historyStabilitySeries(events).series.map((series) => series.points)
  ).toEqual([[{ x: 0, y: 12 }], [{ x: 1, y: 12 }]]);
});
