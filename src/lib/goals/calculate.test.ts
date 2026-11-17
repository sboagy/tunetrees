import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IUserSchedulingOptions,
  PracticeRecord,
  PrefsSpacedRepetition,
} from "../db/types";
import { FSRSService } from "../scheduling/fsrs-service";
import { getBuiltInGoals } from "./builtins";
import { calculateGoalPractice, type GoalPracticeInput } from "./calculate";
import { canonicalJson } from "./config";
import { effectiveFsrsMaximum } from "./fsrs";
import { readPracticeState } from "./practice-state";

function options(name = "recall"): GoalPracticeInput {
  const goal = getBuiltInGoals().find((entry) => entry.name === name);
  if (!goal) throw new Error("Missing goal fixture");
  return {
    goalId: goal.id,
    goalLabel: goal.displayName,
    config: goal.config,
    evaluationId: goal.config.evaluations[2].id,
    practiced: new Date("2026-11-16T12:00:00.987Z"),
    goalTuneCount: 100,
    predecessor: null,
    legacyGoalId: getBuiltInGoals()[0].id,
  };
}
function legacy(status = 2): PracticeRecord {
  return {
    id: "event",
    repertoireRef: "repertoire",
    tuneRef: "tune",
    practiced: "2026-11-11T12:00:00.000Z",
    due: "2026-11-14T12:00:00.000Z",
    quality: 3,
    stability: 12,
    difficulty: 5,
    state: status,
    repetitions: 10,
    lapses: 2,
    elapsedDays: 3,
    interval: 3,
    step: null,
    easiness: null,
    backupPracticed: null,
    goal: "recall",
    technique: null,
    goalId: null,
    evaluationId: null,
    evaluationSnapshot: null,
    schedulerId: null,
    schedulerVersion: null,
    schedulerState: null,
    intervalDays: null,
    syncVersion: 1,
    lastModifiedAt: "2026-11-11T12:00:00.000Z",
    deviceId: null,
  };
}
function oldService(input: GoalPracticeInput) {
  const config = input.config.scheduler;
  if (config.id !== "builtin:fsrs6") throw new Error("Expected FSRS");
  const prefs: PrefsSpacedRepetition = {
    userId: "user",
    algType: "FSRS",
    fsrsWeights: JSON.stringify(config.weights),
    requestRetention: config.retention,
    maximumInterval: config.maximumIntervalDays,
    learningSteps: JSON.stringify(config.learningStepsMinutes),
    relearningSteps: JSON.stringify(config.relearningStepsMinutes),
    enableFuzzing: 0,
    syncVersion: 1,
    lastModifiedAt: "2026-11-11T12:00:00.000Z",
    deviceId: null,
  };
  const scheduling: IUserSchedulingOptions = {
    userId: "user",
    acceptableDelinquencyWindow: 7,
    minReviewsPerDay: 3,
    maxReviewsPerDay: input.config.daily.maximum,
    daysPerWeek: null,
    weeklyRules: null,
    exceptions: null,
    autoScheduleNew: true,
  };
  return new FSRSService(prefs, scheduling, {
    repertoireTuneCount: input.goalTuneCount,
  });
}

beforeEach(() => {
  vi.stubGlobal("window", { __TUNETREES_TEST_ENABLE_FUZZ__: false });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("goal-selected calculations with JSON state", () => {
  it.each([1, 2, 3, 4])(
    "preserves first-review FSRS-6 calculation for rating %i",
    async (rating) => {
      const input = options();
      input.evaluationId = input.config.evaluations[rating - 1].id;
      const result = await calculateGoalPractice(input);
      const old = await oldService(input).processFirstReview({
        repertoireRef: "repertoire",
        tuneRef: "tune",
        quality: rating,
        practiced: new Date(result.practiced),
      });
      expect(result.due).toBe(old.nextDue.toISOString());
      expect(JSON.parse(result.schedulerState)).toMatchObject({
        stability: old.stability,
        difficulty: old.difficulty,
        reps: old.reps,
        status: old.state,
      });
    }
  );
  it.each(
    [1, 2, 3].flatMap((status) =>
      [1, 2, 3, 4].map((rating) => ({ status, rating }))
    )
  )(
    "preserves legacy state $status continuation for rating $rating",
    async ({ status, rating }) => {
      const input = options();
      // Test model parity below the cap; cap enforcement has its own regression below.
      input.config.daily.maximum = 3;
      input.predecessor = legacy(status);
      input.evaluationId = input.config.evaluations[rating - 1].id;
      const result = await calculateGoalPractice(input);
      const old = await oldService(input).processReview(
        {
          repertoireRef: "repertoire",
          tuneRef: "tune",
          quality: rating,
          practiced: new Date(result.practiced),
        },
        legacy(status)
      );
      expect(result.due).toBe(old.nextDue.toISOString());
      expect(JSON.parse(result.schedulerState)).toMatchObject({
        stability: old.stability,
        difficulty: old.difficulty,
        reps: old.reps,
        status: old.state,
      });
      expect(result.continued).toBe(true);
    }
  );
  it.each([1, 3])(
    "caps Easy graduation from legacy state %i",
    async (status) => {
      const input = options();
      input.predecessor = legacy(status);
      input.evaluationId = input.config.evaluations[3].id;
      const result = await calculateGoalPractice(input);
      // The deprecated API returned 36 days here despite the 30-day maximum.
      expect(result.intervalDays).toBe(30);
      expect(result.due).toBe("2026-12-16T12:00:00.000Z");
      expect(JSON.parse(result.schedulerState).scheduledDays).toBe(30);
    }
  );
  it("continues equivalently from normalized legacy and matching JSON despite stale columns", async () => {
    const input = { ...options(), predecessor: legacy() };
    const decoded = readPracticeState(input.predecessor, input.legacyGoalId);
    if (decoded.kind !== "fsrs6") throw new Error("Expected legacy FSRS");
    const fromLegacy = await calculateGoalPractice(input);
    const fromJson = await calculateGoalPractice({
      ...input,
      predecessor: {
        ...legacy(),
        goalId: input.goalId,
        schedulerId: "builtin:fsrs6",
        schedulerVersion: 1,
        schedulerState: canonicalJson(decoded.state),
        stability: 999,
        repetitions: 999,
      },
    });
    expect(fromJson.schedulerState).toBe(fromLegacy.schedulerState);
    expect(fromJson.due).toBe(fromLegacy.due);
  });
  it("persists learning progress across same-day reviews", async () => {
    const input = options();
    const first = await calculateGoalPractice(input); // Good advances to the second learning step.
    expect(JSON.parse(first.schedulerState).learningSteps).toBe(1);
    const second = await calculateGoalPractice({
      ...input,
      practiced: new Date(first.due),
      predecessor: { ...legacy(), ...first },
    });
    expect(JSON.parse(second.schedulerState).status).toBe(2); // Graduates instead of repeating step zero.
    expect(second.continued).toBe(true);
  });
  it("never runs hidden FSRS or invents numeric ratings for ladder choices", async () => {
    const input = options("fluency");
    const result = await calculateGoalPractice({
      ...input,
      predecessor: legacy(),
    });
    expect(JSON.parse(result.schedulerState)).toMatchObject({
      version: 1,
      ladderIndex: 0,
    });
    expect(result.compatibility).toMatchObject({
      stability: null,
      difficulty: null,
      quality: null,
      repetitions: null,
    });
    expect(result.continued).toBe(false);
  });
  it("starts fresh on Recall after a submitted Fluency event", async () => {
    const fluent = await calculateGoalPractice(options("fluency"));
    const fresh = await calculateGoalPractice(options());
    const result = await calculateGoalPractice({
      ...options(),
      predecessor: { ...legacy(), ...fluent },
    });
    expect(result.schedulerState).toBe(fresh.schedulerState);
    expect(result.continued).toBe(false);
  });
  it("starts fresh between two goals using FSRS", async () => {
    const first = await calculateGoalPractice(options());
    const result = await calculateGoalPractice({
      ...options(),
      goalId: "custom-fsrs",
      predecessor: { ...legacy(), ...first },
    });
    expect(result.continued).toBe(false);
  });
  it("does not fall back to typed FSRS fields for corrupt JSON", async () => {
    await expect(
      calculateGoalPractice({
        ...options(),
        predecessor: {
          ...legacy(),
          goalId: options().goalId,
          schedulerId: "builtin:fsrs6",
          schedulerVersion: 1,
          schedulerState: "{}",
        },
      })
    ).rejects.toThrow(/version/);
  });
  it("retains fractional times and snapshots the evaluation meaning", async () => {
    const input = options("initial_learn");
    input.evaluationId = "cannot_play";
    const result = await calculateGoalPractice(input);
    expect(result.intervalDays).toBe(0.1);
    expect(result.due).toBe("2026-11-16T14:24:00.000Z");
    input.config.evaluations[0].label = "Renamed";
    expect(JSON.parse(result.evaluationSnapshot).choiceLabel).toBe(
      "Cannot play through"
    );
  });
  it("rejects an unknown choice instead of mapping it to Good", async () => {
    await expect(
      calculateGoalPractice({ ...options(), evaluationId: "missing" })
    ).rejects.toThrow(/valid/);
  });
  it("uses the explicit FSRS cap for Unlimited", () => {
    const input = options();
    input.config.daily.maximum = 0;
    expect(effectiveFsrsMaximum(input.config, 1)).toBe(36500);
  });
  it("uses the smaller explicit cap", () => {
    const input = options();
    if (input.config.scheduler.id !== "builtin:fsrs6")
      throw new Error("Expected FSRS");
    input.config.scheduler.maximumIntervalDays = 5;
    expect(effectiveFsrsMaximum(input.config, 100)).toBe(5);
  });
  it.each([
    [1, 15],
    [100, 30],
    [500, 120],
  ])("caps the population %i at %i days", (population, cap) => {
    expect(effectiveFsrsMaximum(options().config, population)).toBe(cap);
  });
});
