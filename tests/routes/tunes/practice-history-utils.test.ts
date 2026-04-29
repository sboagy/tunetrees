import { describe, expect, it } from "vitest";
import type { PracticeRecord } from "../../../src/lib/db/types";
import { FSRS_QUALITY_MAP } from "../../../src/lib/scheduling/fsrs-service";
import {
  buildPracticeHistoryQualityChart,
  buildPracticeHistoryStabilityChart,
  buildPracticeHistorySummary,
  getPracticeHistoryQualityDisplay,
  getPracticeHistoryStateLabel,
} from "../../../src/routes/tunes/[id]/practice-history/practice-history-utils";

function createPracticeRecord(
  overrides: Partial<PracticeRecord> = {}
): PracticeRecord {
  return {
    id: "practice-record-id",
    repertoireRef: "repertoire-id",
    tuneRef: "tune-id",
    practiced: "2026-04-20T10:00:00.000Z",
    quality: FSRS_QUALITY_MAP.GOOD,
    easiness: null,
    difficulty: 5.25,
    stability: 1.5,
    interval: 3,
    step: null,
    repetitions: 2,
    lapses: 0,
    elapsedDays: 2,
    state: 2,
    due: "2026-04-23T10:00:00.000Z",
    backupPracticed: null,
    goal: "recall",
    technique: "fsrs",
    syncVersion: 1,
    lastModifiedAt: "2026-04-20T10:00:00.000Z",
    deviceId: "local",
    ...overrides,
  } as PracticeRecord;
}

describe("practice-history utils", () => {
  it("builds summary metrics from FSRS records", () => {
    const records = [
      createPracticeRecord({
        id: "r1",
        practiced: "2026-04-19T10:00:00.000Z",
        quality: FSRS_QUALITY_MAP.AGAIN,
        interval: 1,
      }),
      createPracticeRecord({
        id: "r2",
        practiced: "2026-04-20T10:00:00.000Z",
        quality: FSRS_QUALITY_MAP.GOOD,
        interval: 3,
      }),
      createPracticeRecord({
        id: "r3",
        practiced: "2026-04-21T10:00:00.000Z",
        quality: FSRS_QUALITY_MAP.EASY,
        interval: 5,
      }),
    ];

    expect(buildPracticeHistorySummary(records)).toEqual({
      totalSessions: 3,
      successRate: 67,
      currentStreak: 2,
      averageInterval: 3,
    });
  });

  it("orders quality chart data chronologically and uses FSRS values", () => {
    const chart = buildPracticeHistoryQualityChart([
      createPracticeRecord({
        id: "newest",
        practiced: "2026-04-22T10:00:00.000Z",
        quality: FSRS_QUALITY_MAP.EASY,
      }),
      createPracticeRecord({
        id: "oldest",
        practiced: "2026-04-20T10:00:00.000Z",
        quality: FSRS_QUALITY_MAP.HARD,
      }),
    ]);

    expect(chart?.datasets[0]?.data).toEqual([
      FSRS_QUALITY_MAP.HARD,
      FSRS_QUALITY_MAP.EASY,
    ]);
  });

  it("builds a stability chart only for rows that include stability data", () => {
    const chart = buildPracticeHistoryStabilityChart([
      createPracticeRecord({
        id: "missing-stability",
        practiced: "2026-04-20T10:00:00.000Z",
        stability: null,
      }),
      createPracticeRecord({
        id: "with-stability",
        practiced: "2026-04-21T10:00:00.000Z",
        stability: 4.126,
      }),
    ]);

    expect(chart?.datasets[0]?.data).toEqual([4.13]);
  });

  it("maps FSRS quality and state labels for display", () => {
    expect(
      getPracticeHistoryQualityDisplay(FSRS_QUALITY_MAP.GOOD)
    ).toMatchObject({
      label: "Good",
    });
    expect(getPracticeHistoryStateLabel(3)).toBe("Relearning");
  });
});
