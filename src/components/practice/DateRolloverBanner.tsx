/**
 * Date Rollover Banner
 *
 * Detects when the practice date has changed (midnight rollover or test date change)
 * and displays a banner prompting the user to refresh.
 *
 * @module components/practice/DateRolloverBanner
 */

import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import {
  getPracticeDate,
  hasPracticeDateChanged,
} from "../../lib/utils/practice-date";

export interface DateRolloverBannerProps {
  /** Initial practice date to compare against */
  initialDate: Date;
  /** Callback when user clicks refresh button */
  onRefresh?: () => void | Promise<void>;
  /** Optional hook to decide whether to show the banner when a change is detected */
  onDateChange?: (newDate: Date) => boolean | undefined;
}

/**
 * Banner component that appears when practice date changes
 *
 * Checks every minute if the practice date has changed.
 * Shows a prominent banner with refresh button when detected.
 *
 * @example
 * ```tsx
 * <DateRolloverBanner
 *   initialDate={practiceDate()}
 *   onRefresh={() => window.location.reload()}
 * />
 * ```
 */
export const DateRolloverBanner: Component<DateRolloverBannerProps> = (
  props
) => {
  const [showBanner, setShowBanner] = createSignal(false);
  const [newDate, setNewDate] = createSignal<string>("");

  const getRolloverIntervalMs = () => {
    if (typeof window !== "undefined") {
      const override = (
        window as unknown as {
          __TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__?: number;
        }
      ).__TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__;
      const parsed = Number(override);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return 60000;
  };

  // Check for date change every minute
  createEffect(() => {
    const intervalMs = getRolloverIntervalMs();
    let loggedForCurrentInitialDate = false;

    const checkForDateRollover = () => {
      if (hasPracticeDateChanged(props.initialDate)) {
        const current = getPracticeDate();
        const shouldShow = props.onDateChange?.(current);

        if (shouldShow === false) {
          if (showBanner()) {
            setShowBanner(false);
          }
          return;
        }

        setNewDate(current.toLocaleDateString());
        setShowBanner(true);

        if (!loggedForCurrentInitialDate) {
          console.log(
            `🔄 [DateRollover] Practice date changed from ${props.initialDate.toLocaleDateString()} to ${current.toLocaleDateString()}`
          );
          loggedForCurrentInitialDate = true;
        }
      }
    };

    // Evaluate immediately so reloads and tab restores are handled without waiting.
    checkForDateRollover();

    const checkInterval = setInterval(checkForDateRollover, intervalMs);

    onCleanup(() => clearInterval(checkInterval));
  });

  const handleRefresh = async () => {
    if (props.onRefresh) {
      try {
        await props.onRefresh();
      } finally {
        setShowBanner(false);
      }
      return;
    }
    window.location.reload();
  };

  return (
    <>
      {showBanner() && (
        <div
          class="w-full bg-yellow-500 dark:bg-yellow-600 text-black dark:text-white px-4 py-3 shadow-lg"
          data-testid="date-rollover-banner"
          role="alert"
        >
          <div class="flex items-center justify-between max-w-7xl mx-auto">
            <div class="flex items-center space-x-3">
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Clock icon</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p class="font-semibold">Practice date has changed</p>
                <p class="text-sm">
                  The practice date is now {newDate()}. Refresh to see today's
                  queue.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              class="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md font-medium hover:opacity-90 transition-opacity"
              data-testid="date-rollover-refresh-button"
            >
              Refresh Now
            </button>
          </div>
        </div>
      )}
    </>
  );
};
