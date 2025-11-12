/**
 * Spaced Repetition Settings Page
 *
 * Configure spaced repetition algorithm preferences (FSRS/SM2).
 * Matches legacy: legacy/frontend/app/user-settings/spaced-repetition/page.tsx
 *
 * @module routes/user-settings/spaced-repetition
 */

import { type Component, createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getSpacedRepetitionPrefs,
  updateSpacedRepetitionPrefs,
} from "@/lib/db/queries/user-settings";

// Default FSRS weights from legacy app
const DEFAULT_FSRS_WEIGHTS =
  "0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621";

const SpacedRepetitionPage: Component = () => {
  const { user } = useAuth();

  // Form state
  const [algType, setAlgType] = createSignal<"SM2" | "FSRS">("FSRS");
  const [fsrsWeights, setFsrsWeights] = createSignal<string>(
    DEFAULT_FSRS_WEIGHTS
  );
  const [requestRetention, setRequestRetention] = createSignal<string>("0.9");
  const [maximumInterval, setMaximumInterval] = createSignal<string>("365");

  // UI state
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isOptimizing, setIsOptimizing] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [validationErrors, setValidationErrors] = createSignal<
    Record<string, string>
  >({});

  // Load existing preferences
  createEffect(() => {
    const currentUser = user();
    if (currentUser?.id) {
      setIsLoading(true);
      getSpacedRepetitionPrefs(currentUser.id, algType())
        .then((prefs) => {
          if (prefs) {
            setAlgType(prefs.algType as "SM2" | "FSRS");
            setFsrsWeights(prefs.fsrsWeights ?? DEFAULT_FSRS_WEIGHTS);
            setRequestRetention(prefs.requestRetention?.toString() ?? "0.9");
            setMaximumInterval(prefs.maximumInterval?.toString() ?? "365");
          }
        })
        .catch((error) => {
          console.error("Failed to load spaced repetition preferences:", error);
          setErrorMessage("Failed to load spaced repetition preferences");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  });

  // Track form changes
  const markDirty = () => {
    if (!isDirty()) {
      setIsDirty(true);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  };

  // Validation helpers
  const parseFloatOrNull = (value: string): number | null => {
    if (!value || value.trim() === "") return null;
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseIntOrNull = (value: string): number | null => {
    if (!value || value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate maximum interval
    const maxInt = parseIntOrNull(maximumInterval());
    if (maxInt === null || maxInt <= 0) {
      errors.maximumInterval = "Must be a positive number";
    }

    // Validate request retention (0-1)
    const reqRet = parseFloatOrNull(requestRetention());
    if (reqRet === null || reqRet < 0 || reqRet > 1) {
      errors.requestRetention = "Must be between 0 and 1";
    }

    // Validate FSRS weights if FSRS is selected
    if (algType() === "FSRS") {
      const weights = fsrsWeights().trim();
      if (!weights) {
        errors.fsrsWeights = "FSRS weights are required";
      } else {
        // Check if it's a valid comma-separated list of numbers
        const parts = weights.split(",").map((s) => s.trim());
        const allNumbers = parts.every((part) => !Number.isNaN(Number.parseFloat(part)));
        if (!allNumbers) {
          errors.fsrsWeights =
            "Must be comma-separated numbers (e.g., 0.4, 1.2, 3.1)";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validateForm()) {
      setErrorMessage("Please fix validation errors");
      return;
    }

    const currentUser = user();
    if (!currentUser?.id) {
      setErrorMessage("User not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSpacedRepetitionPrefs({
        userId: currentUser.id,
        algType: algType(),
        fsrsWeights: algType() === "FSRS" ? fsrsWeights().trim() : null,
        requestRetention: parseFloatOrNull(requestRetention()),
        maximumInterval: parseIntOrNull(maximumInterval()),
      });

      setSuccessMessage("Spaced repetition preferences updated successfully");
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to update spaced repetition preferences:", error);
      setErrorMessage("Failed to update spaced repetition preferences");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle FSRS parameter optimization (placeholder for now)
  const handleOptimizeParams = async () => {
    setIsOptimizing(true);
    setErrorMessage(null);

    try {
      // TODO: Implement FSRS optimization API call
      // For now, just show a message that this feature is coming soon
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setErrorMessage(
        "FSRS optimization API not yet implemented. This feature will be added in a future update."
      );
    } catch (error) {
      console.error("Failed to optimize FSRS parameters:", error);
      setErrorMessage("Failed to optimize FSRS parameters");
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Spaced Repetition
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure your spaced repetition algorithm preferences (FSRS/SM2).
        </p>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
        <Show
          when={!isLoading()}
          fallback={
            <div class="text-sm text-gray-500">Loading preferences...</div>
          }
        >
          <form onSubmit={handleSubmit} class="space-y-6">
            {/* Maximum Interval */}
            <div class="space-y-1.5">
              <label
                for="maximum-interval"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Maximum Interval (days)
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Maximum number of days between reviews
              </p>
              <input
                id="maximum-interval"
                type="number"
                min="1"
                placeholder="365"
                value={maximumInterval()}
                onInput={(e) => {
                  setMaximumInterval(e.currentTarget.value);
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <Show when={validationErrors().maximumInterval}>
                <p class="text-xs text-red-600">
                  {validationErrors().maximumInterval}
                </p>
              </Show>
            </div>

            {/* Algorithm Type */}
            <div class="space-y-1.5">
              <label
                for="algorithm-type"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Algorithm Type
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Choose your preferred spaced repetition algorithm
              </p>
              <select
                id="algorithm-type"
                value={algType()}
                onChange={(e) => {
                  setAlgType(e.currentTarget.value as "SM2" | "FSRS");
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="SM2">SM2</option>
                <option value="FSRS">FSRS</option>
              </select>
            </div>

            {/* FSRS-specific fields */}
            <Show when={algType() === "FSRS"}>
              {/* FSRS Initial Weights */}
              <div class="space-y-1.5">
                <label
                  for="fsrs-weights"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  FSRS Initial Weights
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Custom weights for FSRS algorithm (comma-separated values).
                  The algorithm will adjust these significantly based on your
                  actual performance. The initial weights influence how quickly
                  stability increases and how intervals are initially set.
                </p>
                <textarea
                  id="fsrs-weights"
                  rows="4"
                  placeholder="e.g., 0.40255, 1.18385, 3.173, 15.69105, ..."
                  value={fsrsWeights()}
                  onInput={(e) => {
                    setFsrsWeights(e.currentTarget.value);
                    markDirty();
                  }}
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                />
                <Show when={validationErrors().fsrsWeights}>
                  <p class="text-xs text-red-600">
                    {validationErrors().fsrsWeights}
                  </p>
                </Show>

                {/* Auto-Optimize Button */}
                <div class="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleOptimizeParams}
                    disabled={isOptimizing()}
                    class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-md transition-colors"
                    data-testid="optimize-params-inline-button"
                  >
                    {isOptimizing()
                      ? "Optimizing..."
                      : "Auto-Optimize Parameters"}
                  </button>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    Automatically optimize weights based on your practice
                    history
                  </span>
                </div>
              </div>

              {/* Target Retention Rate */}
              <div class="space-y-1.5">
                <label
                  for="request-retention"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Target Retention Rate
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Your desired memory retention rate (0-1)
                </p>
                <input
                  id="request-retention"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="0.9"
                  value={requestRetention()}
                  onInput={(e) => {
                    setRequestRetention(e.currentTarget.value);
                    markDirty();
                  }}
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <Show when={validationErrors().requestRetention}>
                  <p class="text-xs text-red-600">
                    {validationErrors().requestRetention}
                  </p>
                </Show>
              </div>

              {/* Additional Optimize Button */}
              <button
                type="button"
                onClick={handleOptimizeParams}
                disabled={isOptimizing()}
                class="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-md transition-colors"
                data-testid="optimize-params-main-button"
              >
                {isOptimizing() ? "Optimizing..." : "Optimize FSRS Parameters"}
              </button>
            </Show>

            {/* Success/Error Messages */}
            <Show when={successMessage()}>
              <div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <p class="text-sm text-green-800 dark:text-green-200">
                  {successMessage()}
                </p>
              </div>
            </Show>

            <Show when={errorMessage()}>
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p class="text-sm text-red-800 dark:text-red-200">
                  {errorMessage()}
                </p>
              </div>
            </Show>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                !isDirty() ||
                isSubmitting() ||
                Object.keys(validationErrors()).length > 0
              }
              class="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
              data-testid="spaced-rep-update-button"
            >
              {isSubmitting() ? "Saving..." : "Update"}
            </button>
          </form>
        </Show>
      </div>
    </div>
  );
};

export default SpacedRepetitionPage;
