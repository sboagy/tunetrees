import { describe, expect, it } from "vitest";
import {
  type LegacyRecallPreferences,
  prepareLegacyRecallSettings,
} from "../../../scripts/lib/goal-cutover/legacy-preferences";
import { getBuiltInGoals } from "../../../src/lib/goals/builtins";

const fsrsPreferences = {
  algType: "fsrs",
  fsrsWeights: null,
  requestRetention: 0.85,
  maximumInterval: 400,
  learningSteps: "[0.5,10]",
  relearningSteps: "[]",
  enableFuzzing: false,
} satisfies NonNullable<LegacyRecallPreferences["spacedRepetition"]>;

describe("legacy Recall cutover preferences", () => {
  it("uses developer daily defaults when no preferences exist", () => {
    expect(
      prepareLegacyRecallSettings({ hasExistingOverride: false })?.daily
    ).toEqual(getBuiltInGoals()[0].config.daily);
  });

  it("preserves zero limits, false auto-new and zero delinquency", () => {
    expect(
      prepareLegacyRecallSettings({
        hasExistingOverride: false,
        scheduling: {
          minReviewsPerDay: 0,
          maxReviewsPerDay: 0,
          autoScheduleNew: false,
          acceptableDelinquencyWindow: 0,
        },
      })?.daily
    ).toEqual({ minimum: 0, maximum: 0, autoNew: false, delinquencyDays: 0 });
  });

  it("preserves FSRS parameters, fractional steps and explicitly empty steps", () => {
    expect(
      prepareLegacyRecallSettings({
        hasExistingOverride: false,
        spacedRepetition: fsrsPreferences,
      })?.scheduler
    ).toEqual({
      ...getBuiltInGoals()[0].config.scheduler,
      retention: 0.85,
      maximumIntervalDays: 400,
      learningStepsMinutes: [0.5, 10],
      relearningStepsMinutes: [],
      fuzz: false,
    });
  });

  it("ignores even malformed FSRS-shaped fields on an SM2 row", () => {
    expect(
      prepareLegacyRecallSettings({
        hasExistingOverride: false,
        spacedRepetition: {
          ...fsrsPreferences,
          algType: "sm2",
          fsrsWeights: "not JSON",
        },
      })?.scheduler
    ).toBeUndefined();
  });

  it("does not replace an existing override or its tombstone", () => {
    expect(
      prepareLegacyRecallSettings({
        hasExistingOverride: true,
        spacedRepetition: { ...fsrsPreferences, fsrsWeights: "not JSON" },
      })
    ).toBeNull();
  });

  it.each(["not JSON", "{}", "[1,2]", "[]"])(
    "blocks invalid saved weights instead of dropping them: %s",
    (fsrsWeights) => {
      expect(() =>
        prepareLegacyRecallSettings({
          hasExistingOverride: false,
          spacedRepetition: { ...fsrsPreferences, fsrsWeights },
        })
      ).toThrow();
    }
  );

  it("blocks incompatible saved daily limits", () => {
    expect(() =>
      prepareLegacyRecallSettings({
        hasExistingOverride: false,
        scheduling: {
          minReviewsPerDay: 8,
          maxReviewsPerDay: 2,
          autoScheduleNew: true,
          acceptableDelinquencyWindow: 7,
        },
      })
    ).toThrow(/Minimum/);
  });
});
