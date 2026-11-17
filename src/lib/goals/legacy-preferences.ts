import { getBuiltInGoals } from "./builtins";
import {
  type GoalOverrides,
  parseGoalOverrides,
  resolveGoalConfig,
} from "./config";

/** Server-snapshot inputs, not a browser-time fallback to global preferences. */
export interface LegacyRecallPreferences {
  scheduling?: {
    minReviewsPerDay: number | null;
    maxReviewsPerDay: number | null;
    autoScheduleNew: boolean | null;
    acceptableDelinquencyWindow: number | null;
  } | null;
  spacedRepetition?: {
    algType: string;
    fsrsWeights: string | null;
    requestRetention: number | null;
    maximumInterval: number | null;
    learningSteps: string | null;
    relearningSteps: string | null;
    enableFuzzing: boolean | null;
  } | null;
  // Includes tombstones: an intentional reset must not re-import old settings.
  hasExistingOverride: boolean;
}

/**
 * Prepare insert-if-absent Recall settings for the coordinated server cutover.
 * Invalid saved values block conversion; silently substituting defaults would
 * lose user intent. The caller owns snapshot consistency and durable insertion.
 */
export function prepareLegacyRecallSettings(
  input: LegacyRecallPreferences
): GoalOverrides | null {
  if (input.hasExistingOverride) return null;
  const recall = getBuiltInGoals().find((goal) => goal.name === "recall");
  if (recall?.config.scheduler.id !== "builtin:fsrs6") {
    throw new Error("Recall FSRS defaults are unavailable");
  }
  const defaults = recall.config;
  const scheduling = input.scheduling;
  const prefs = input.spacedRepetition;
  const scheduler = recall.config.scheduler;
  const overrides = parseGoalOverrides({
    version: 1,
    daily: {
      minimum: scheduling?.minReviewsPerDay ?? defaults.daily.minimum,
      maximum: scheduling?.maxReviewsPerDay ?? defaults.daily.maximum,
      autoNew: scheduling?.autoScheduleNew ?? defaults.daily.autoNew,
      delinquencyDays:
        scheduling?.acceptableDelinquencyWindow ??
        defaults.daily.delinquencyDays,
    },
    // Never import SM2 values into FSRS. Null fields use shared FSRS-6 defaults,
    // including weights; do not consult the library's changing default model.
    ...(prefs?.algType === "fsrs"
      ? {
          scheduler: {
            ...scheduler,
            weights: decodeArray(prefs.fsrsWeights, scheduler.weights),
            retention: prefs.requestRetention ?? scheduler.retention,
            maximumIntervalDays:
              prefs.maximumInterval ?? scheduler.maximumIntervalDays,
            learningStepsMinutes: decodeArray(
              prefs.learningSteps,
              scheduler.learningStepsMinutes
            ),
            relearningStepsMinutes: decodeArray(
              prefs.relearningSteps,
              scheduler.relearningStepsMinutes
            ),
            fuzz: prefs.enableFuzzing ?? scheduler.fuzz,
          },
        }
      : {}),
  });
  resolveGoalConfig(defaults, overrides);
  return overrides;
}

function decodeArray(value: string | null, fallback: number[]): unknown {
  return value === null ? fallback : JSON.parse(value);
}
