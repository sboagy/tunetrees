import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IUserSchedulingOptions,
  PracticeRecord,
  PrefsSpacedRepetition,
  RecordPracticeInput,
} from "../../src/lib/db/types";
import { FSRSService } from "../../src/lib/scheduling/fsrs-service";

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
const input: RecordPracticeInput = {
  tuneRef: "tune",
  repertoireRef: "repertoire",
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
    syncVersion: 0,
    lastModifiedAt: "2026-11-01T12:00:00.000Z",
    deviceId: null,
    ...overrides,
  };
}

describe("FSRS package migration compatibility", () => {
  beforeEach(() => {
    // Disable fuzz through the existing test hook, keeping production policy intact.
    vi.stubGlobal("window", { __TUNETREES_TEST_ENABLE_FUZZ__: false });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Captured with ts-fsrs 5.4.2, then reviewed against v6. The two Hard learning
  // due dates now retain second precision (5m30s instead of rounding to 6m).
  it.each([1, 2, 3, 4])(
    "preserves first-review scheduling for rating %i",
    async (quality) => {
      const service = new FSRSService(prefs, options);
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
    const service = new FSRSService(prefs, options);
    const record = history({ state });
    const original = structuredClone(record);
    expect(
      await service.processReview({ ...input, quality }, record)
    ).toMatchSnapshot();
    expect(record).toEqual(original);
  });

  it("uses actual UTC review dates for elapsed days across midnight", async () => {
    const service = new FSRSService(prefs, options);
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

  it("persists elapsed days and learned state in the existing history format", async () => {
    const service = new FSRSService(prefs, options);
    const schedule = await service.processReview(input, history());
    const stored = service.createPracticeRecord(
      input,
      schedule,
      input.repertoireRef
    );
    expect(stored).toMatchObject({
      practiced: input.practiced.toISOString(),
      elapsedDays: 5,
      stability: schedule.stability,
      difficulty: schedule.difficulty,
      state: schedule.state,
      repetitions: 11,
      lapses: 2,
      due: schedule.nextDue.toISOString(),
    });
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
      const service = new FSRSService(storedPrefs, options);
      expect(await service.processReview(input, history())).toMatchSnapshot();
      expect(storedPrefs.fsrsWeights).toBe(JSON.stringify(weights));
    }
  );

  it("preserves custom learning steps", async () => {
    const service = new FSRSService(
      { ...prefs, learningSteps: "[5,30]" },
      options
    );
    expect(
      (await service.processFirstReview(input)).nextDue.toISOString()
    ).toBe("2026-11-06T12:30:00.000Z");
  });

  it("preserves custom relearning steps after a lapse", async () => {
    const service = new FSRSService(
      { ...prefs, relearningSteps: "[20]" },
      options
    );
    const schedule = await service.processReview(
      { ...input, quality: 1 },
      history()
    );
    expect(schedule.nextDue.toISOString()).toBe("2026-11-06T12:20:00.000Z");
    expect(schedule.lapses).toBe(3);
    expect(schedule.state).toBe(3);
  });

  it("keeps same-day elapsed days at zero", async () => {
    const service = new FSRSService(prefs, options);
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
    const service = new FSRSService(prefs, options);
    expect(
      (await service.processReview(input, history({ state: 0 }))).elapsed_days
    ).toBe(0);
  });

  it.each([1, 2, 3, 4])(
    "keeps fuzzed rating %i deterministic and within the repertoire cap",
    async (quality) => {
      vi.stubGlobal("window", { __TUNETREES_TEST_ENABLE_FUZZ__: true });
      const service = new FSRSService(prefs, options, {
        repertoireTuneCount: 50,
      });
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
    const service = new FSRSService(prefs, options);
    await expect(
      service.processReview(input, history({ state: 9 }))
    ).rejects.toThrow("Invalid persisted FSRS state: 9");
  });
});
