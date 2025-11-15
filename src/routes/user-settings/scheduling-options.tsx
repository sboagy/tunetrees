/**
 * Scheduling Options Settings Page
 *
 * Configure scheduling constraints and practice calendar.
 * Matches legacy: legacy/frontend/app/user-settings/scheduling-options/page.tsx
 *
 * @module routes/user-settings/scheduling-options
 */

import { type Component, createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getSchedulingOptions,
  updateSchedulingOptions,
} from "@/lib/db/queries/user-settings";

const SchedulingOptionsPage: Component = () => {
  const { user, localDb } = useAuth();

  // Form state
  const [acceptableDelinquencyWindow, setAcceptableDelinquencyWindow] =
    createSignal<number>(21);
  const [minReviewsPerDay, setMinReviewsPerDay] = createSignal<string>("");
  const [maxReviewsPerDay, setMaxReviewsPerDay] = createSignal<string>("");
  const [daysPerWeek, setDaysPerWeek] = createSignal<string>("");
  const [weeklyRules, setWeeklyRules] = createSignal<string>("");
  const [exceptions, setExceptions] = createSignal<string>("");

  // UI state
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [validationErrors, setValidationErrors] = createSignal<
    Record<string, string>
  >({});

  // Load existing preferences
  createEffect(() => {
    const currentUser = user();
    const db = localDb();
    if (currentUser?.id && db) {
      setIsLoading(true);
      getSchedulingOptions(db, currentUser.id)
        .then((prefs) => {
          if (prefs) {
            setAcceptableDelinquencyWindow(
              prefs.acceptableDelinquencyWindow ?? 21
            );
            setMinReviewsPerDay(prefs.minReviewsPerDay?.toString() ?? "");
            setMaxReviewsPerDay(prefs.maxReviewsPerDay?.toString() ?? "");
            setDaysPerWeek(prefs.daysPerWeek?.toString() ?? "");
            setWeeklyRules(prefs.weeklyRules ?? "");
            setExceptions(prefs.exceptions ?? "");
          }
        })
        .catch((error) => {
          console.error("Failed to load scheduling options:", error);
          setErrorMessage("Failed to load scheduling options");
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
  const parseIntOrNull = (value: string): number | null => {
    if (!value || value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const validateJSON = (
    value: string,
    fieldName: string,
    expectArray: boolean = false
  ): string | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;

    try {
      const parsed = JSON.parse(trimmed);
      if (expectArray && !Array.isArray(parsed)) {
        return `${fieldName} must be a valid JSON array`;
      }
      if (!expectArray && Array.isArray(parsed)) {
        return `${fieldName} must be a valid JSON object`;
      }
      return null;
    } catch {
      return `${fieldName} must be valid JSON`;
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate acceptable delinquency window
    const adw = acceptableDelinquencyWindow();
    if (adw < 0 || adw > 365) {
      errors.acceptableDelinquencyWindow = "Must be between 0 and 365 days";
    }

    // Validate min/max reviews per day
    const minReviews = parseIntOrNull(minReviewsPerDay());
    const maxReviews = parseIntOrNull(maxReviewsPerDay());
    if (minReviews !== null && (minReviews < 0 || minReviews > 10000)) {
      errors.minReviewsPerDay = "Must be between 0 and 10000";
    }
    if (maxReviews !== null && (maxReviews < 0 || maxReviews > 10000)) {
      errors.maxReviewsPerDay = "Must be between 0 and 10000";
    }

    // Validate days per week
    const dpw = parseIntOrNull(daysPerWeek());
    if (dpw !== null && (dpw < 0 || dpw > 7)) {
      errors.daysPerWeek = "Must be between 0 and 7";
    }

    // Validate JSON fields
    const weeklyRulesError = validateJSON(weeklyRules(), "Weekly Rules", false);
    if (weeklyRulesError) {
      errors.weeklyRules = weeklyRulesError;
    }

    const exceptionsError = validateJSON(exceptions(), "Exceptions", true);
    if (exceptionsError) {
      errors.exceptions = exceptionsError;
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
    const db = localDb();
    if (!currentUser?.id || !db) {
      setErrorMessage("User not authenticated or database not ready");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateSchedulingOptions(db, {
        userId: currentUser.id,
        acceptableDelinquencyWindow: acceptableDelinquencyWindow(),
        minReviewsPerDay: parseIntOrNull(minReviewsPerDay()),
        maxReviewsPerDay: parseIntOrNull(maxReviewsPerDay()),
        daysPerWeek: parseIntOrNull(daysPerWeek()),
        weeklyRules: weeklyRules().trim() || null,
        exceptions: exceptions().trim() || null,
      });

      setSuccessMessage("Scheduling options updated successfully");
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to update scheduling options:", error);
      setErrorMessage("Failed to update scheduling options");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Scheduling Options
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure scheduling constraints and your practice calendar.
        </p>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
        <Show
          when={!isLoading()}
          fallback={
            <div class="text-sm text-gray-500">Loading preferences...</div>
          }
        >
          <form onSubmit={handleSubmit} class="space-y-4">
            {/* Acceptable Delinquency Window */}
            <div class="space-y-1.5">
              <label
                for="acceptable-delinquency"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Acceptable Delinquency Window (days)
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                How many days late a review can be without penalty.
              </p>
              <input
                id="acceptable-delinquency"
                type="number"
                min="0"
                max="365"
                value={acceptableDelinquencyWindow()}
                onInput={(e) => {
                  setAcceptableDelinquencyWindow(
                    Number.parseInt(e.currentTarget.value, 10) || 0
                  );
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                data-testid="sched-acceptable-delinquency-input"
              />
              <Show when={validationErrors().acceptableDelinquencyWindow}>
                <p class="text-xs text-red-600">
                  {validationErrors().acceptableDelinquencyWindow}
                </p>
              </Show>
            </div>

            {/* Min/Max Reviews Per Day */}
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label
                  for="min-reviews"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Min Reviews Per Day
                </label>
                <input
                  id="min-reviews"
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={minReviewsPerDay()}
                  onInput={(e) => {
                    setMinReviewsPerDay(e.currentTarget.value);
                    markDirty();
                  }}
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  data-testid="sched-min-per-day-input"
                />
                <Show when={validationErrors().minReviewsPerDay}>
                  <p class="text-xs text-red-600">
                    {validationErrors().minReviewsPerDay}
                  </p>
                </Show>
              </div>

              <div class="space-y-1.5">
                <label
                  for="max-reviews"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Max Reviews Per Day
                </label>
                <input
                  id="max-reviews"
                  type="number"
                  min="0"
                  placeholder="e.g. 50"
                  value={maxReviewsPerDay()}
                  onInput={(e) => {
                    setMaxReviewsPerDay(e.currentTarget.value);
                    markDirty();
                  }}
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  data-testid="sched-max-per-day-input"
                />
                <Show when={validationErrors().maxReviewsPerDay}>
                  <p class="text-xs text-red-600">
                    {validationErrors().maxReviewsPerDay}
                  </p>
                </Show>
              </div>
            </div>

            {/* Days per Week */}
            <div class="space-y-1.5">
              <label
                for="days-per-week"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Days per Week
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                How many days you aim to practice each week.
              </p>
              <input
                id="days-per-week"
                type="number"
                min="0"
                max="7"
                placeholder="e.g. 5"
                value={daysPerWeek()}
                onInput={(e) => {
                  setDaysPerWeek(e.currentTarget.value);
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                data-testid="sched-days-per-week-input"
              />
              <Show when={validationErrors().daysPerWeek}>
                <p class="text-xs text-red-600">
                  {validationErrors().daysPerWeek}
                </p>
              </Show>
            </div>

            {/* Weekly Rules (JSON) */}
            <div class="space-y-1.5">
              <label
                for="weekly-rules"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Weekly Rules (JSON)
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Describe weekly practice rules (e.g., which weekdays to
                practice).
              </p>
              <textarea
                id="weekly-rules"
                rows="3"
                placeholder='{"mon": true, "wed": true, "fri": true}'
                value={weeklyRules()}
                onInput={(e) => {
                  setWeeklyRules(e.currentTarget.value);
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                data-testid="sched-weekly-rules-input"
              />
              <Show when={validationErrors().weeklyRules}>
                <p class="text-xs text-red-600">
                  {validationErrors().weeklyRules}
                </p>
              </Show>
            </div>

            {/* Exceptions (JSON) */}
            <div class="space-y-1.5">
              <label
                for="exceptions"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Exceptions (JSON)
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Specific date overrides (YYYY-MM-DD).
              </p>
              <textarea
                id="exceptions"
                rows="3"
                placeholder='["2025-08-15", "2025-08-22"]'
                value={exceptions()}
                onInput={(e) => {
                  setExceptions(e.currentTarget.value);
                  markDirty();
                }}
                class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                data-testid="sched-exceptions-input"
              />
              <Show when={validationErrors().exceptions}>
                <p class="text-xs text-red-600">
                  {validationErrors().exceptions}
                </p>
              </Show>
            </div>

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
              data-testid="sched-submit-button"
            >
              {isSubmitting() ? "Saving..." : "Update scheduling options"}
            </button>
          </form>
        </Show>
      </div>
    </div>
  );
};

export default SchedulingOptionsPage;
