import type { Grade } from "ts-fsrs";
import { describe, expect, it } from "vitest";
import type {
  IUserSchedulingOptions,
  PracticeRecord,
  PrefsSpacedRepetition,
} from "../../src/lib/db/types";
import { getBuiltInGoals } from "../../src/lib/goals/builtins";
import { calculateFsrs } from "../../src/lib/goals/fsrs";
import { readPracticeState } from "../../src/lib/goals/practice-state";

type ReviewInput = { quality: number; practiced: Date };

// Project the active scheduler result onto the existing compatibility snapshots.
// These expectations predate the goal cutover; do not regenerate them to hide drift.
function scheduler(
  prefs: PrefsSpacedRepetition,
  daily: IUserSchedulingOptions,
  options?: { repertoireTuneCount: number }
) {
  const goal = getBuiltInGoals()[0];
  if (goal.config.scheduler.id !== "builtin:fsrs6")
    throw new Error("Expected Recall");
  const config = {
    ...goal.config.scheduler,
    weights: prefs.fsrsWeights
      ? JSON.parse(prefs.fsrsWeights)
      : goal.config.scheduler.weights,
    retention: prefs.requestRetention ?? 0.9,
    fuzz: false,
    learningStepsMinutes: prefs.learningSteps
      ? JSON.parse(prefs.learningSteps)
      : [1, 10],
    relearningStepsMinutes: prefs.relearningSteps
      ? JSON.parse(prefs.relearningSteps)
      : [10],
  };
  async function review(input: ReviewInput, record?: PracticeRecord) {
    const previous = record ? readPracticeState(record, goal.id) : null;
    if (previous && previous.kind !== "fsrs6")
      throw new Error("Invalid persisted FSRS state");
    const result = await calculateFsrs({
      config,
      maximumInterval: Math.round(
        (3 * (options?.repertoireTuneCount ?? 400)) /
          (daily.maxReviewsPerDay ?? 10)
      ),
      practiced: input.practiced,
      rating: input.quality as Grade,
      predecessor:
        record && previous?.kind === "fsrs6"
          ? {
              state: previous.state,
              practiced: new Date(record.practiced!),
              due: new Date(record.due!),
            }
          : null,
    });
    return {
      nextDue: result.due,
      state: result.state.status,
      stability: result.state.stability,
      difficulty: result.state.difficulty,
      elapsed_days: result.elapsedDays,
      scheduled_days: result.state.scheduledDays,
      reps: result.state.reps,
      lapses: result.state.lapses,
      last_review: input.practiced,
      interval: Math.max(
        1,
        Math.round(
          (result.due.getTime() - input.practiced.getTime()) / 86400000
        )
      ),
    };
  }
  return {
    processFirstReview: (input: ReviewInput) => review(input),
    processReview: review,
    config,
  };
}

const prefs: PrefsSpacedRepetition = {
  userId: "user",
  algType: "FSRS",
  fsrsWeights: null,
  requestRetention: 0.9,
  maximumInterval: 36500,
  learningSteps: null,
  relearningSteps: null,
  enableFuzzing: 1,
  syncVersion: 0,
  lastModifiedAt: "2026-11-01T12:00:00.000Z",
  deviceId: null,
};
const options: IUserSchedulingOptions = {
  userId: "user",
  acceptableDelinquencyWindow: 7,
  minReviewsPerDay: 5,
  maxReviewsPerDay: 10,
  daysPerWeek: null,
  weeklyRules: null,
  exceptions: null,
  autoScheduleNew: true,
};
const input: ReviewInput = {
  quality: 3,
  practiced: new Date("2026-11-06T12:00:00.000Z"),
};

function history(overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return {
    id: "history",
    tuneRef: "tune",
    repertoireRef: "repertoire",
    practiced: "2026-11-01T12:00:00.000Z",
    due: "2026-11-04T12:00:00.000Z",
    quality: 3,
    stability: 12,
    difficulty: 5,
    state: 2,
    repetitions: 10,
    lapses: 2,
    elapsedDays: 3,
    interval: 3,
    easiness: 2.5,
    step: 0,
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
    syncVersion: 0,
    lastModifiedAt: "2026-11-01T12:00:00.000Z",
    deviceId: null,
    ...overrides,
  };
}

describe("FSRS package migration compatibility", () => {
  // Captured with ts-fsrs 5.4.2, then reviewed against v6. The two Hard learning
  // due dates now retain second precision (5m30s instead of rounding to 6m).
  it.each([1, 2, 3, 4])(
    "preserves first-review scheduling for rating %i",
    async (quality) => {
      const service = scheduler(prefs, options);
      expect(
        await service.processFirstReview({ ...input, quality })
      ).toMatchSnapshot();
    }
  );

  it.each([
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
    [3, 1],
    [3, 2],
    [3, 3],
    [3, 4],
  ])("preserves persisted state %i with rating %i", async (state, quality) => {
    const service = scheduler(prefs, options);
    const record = history({ state });
    const original = structuredClone(record);
    expect(
      await service.processReview({ ...input, quality }, record)
    ).toMatchSnapshot();
    expect(record).toEqual(original);
  });

  it("uses actual UTC review dates for elapsed days across midnight", async () => {
    const service = scheduler(prefs, options);
    const record = history({
      practiced: "2026-11-05T23:59:00.000Z",
      due: "2026-12-01T00:00:00.000Z",
    });
    const schedule = await service.processReview(
      { ...input, practiced: new Date("2026-11-06T00:01:00.000Z") },
      record
    );
    expect(schedule.elapsed_days).toBe(1);
  });

  it.each([17, 19, 21])(
    "preserves stored %i-weight preferences",
    async (length) => {
      // Existing FSRS-4/5/6 parameter layouts supported by the v5 integration.
      const weights = [
        0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18,
        0.05, 0.34, 1.26, 0.29, 2.61, 0.54, 0.09, 0.06, 0.15,
      ].slice(0, length);
      const storedPrefs = { ...prefs, fsrsWeights: JSON.stringify(weights) };
      const service = scheduler(storedPrefs, options);
      expect(await service.processReview(input, history())).toMatchSnapshot();
      expect(storedPrefs.fsrsWeights).toBe(JSON.stringify(weights));
    }
  );

  it("preserves custom learning steps", async () => {
    const service = scheduler({ ...prefs, learningSteps: "[5,30]" }, options);
    expect(
      (await service.processFirstReview(input)).nextDue.toISOString()
    ).toBe("2026-11-06T12:30:00.000Z");
  });

  it("preserves custom relearning steps after a lapse", async () => {
    const service = scheduler({ ...prefs, relearningSteps: "[20]" }, options);
    const schedule = await service.processReview(
      { ...input, quality: 1 },
      history()
    );
    expect(schedule.nextDue.toISOString()).toBe("2026-11-06T12:20:00.000Z");
    expect(schedule.lapses).toBe(3);
    expect(schedule.state).toBe(3);
  });

  it("keeps same-day elapsed days at zero", async () => {
    const service = scheduler(prefs, options);
    expect(
      (
        await service.processReview(
          input,
          history({ practiced: "2026-11-06T01:00:00.000Z" })
        )
      ).elapsed_days
    ).toBe(0);
  });

  it("keeps reset cards at zero elapsed days despite older history", async () => {
    const service = scheduler(prefs, options);
    expect(
      (await service.processReview(input, history({ state: 0 }))).elapsed_days
    ).toBe(0);
  });

  it.each([1, 2, 3, 4])(
    "keeps fuzzed rating %i deterministic and within the repertoire cap",
    async (quality) => {
      const service = scheduler(prefs, options, {
        repertoireTuneCount: 50,
      });
      service.config.fuzz = true;
      const record = history({ stability: 100 });
      const schedule = await service.processReview(
        { ...input, quality },
        record
      );
      expect(
        await service.processReview({ ...input, quality }, record)
      ).toEqual(schedule);
      expect(schedule.scheduled_days).toBeLessThanOrEqual(15);
      expect(schedule.nextDue.getTime()).toBeGreaterThan(
        input.practiced.getTime()
      );
    }
  );

  it("rejects invalid persisted state rather than discarding learned memory", async () => {
    const service = scheduler(prefs, options);
    await expect(
      service.processReview(input, history({ state: 9 }))
    ).rejects.toThrow("Invalid FSRS-6 state");
  });
});
