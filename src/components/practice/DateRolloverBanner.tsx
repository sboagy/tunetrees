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
  onRefresh?: () => void;
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

  // Check for date change every minute
  createEffect(() => {
    const checkInterval = setInterval(() => {
      if (hasPracticeDateChanged(props.initialDate)) {
        const current = getPracticeDate();
        setNewDate(current.toLocaleDateString());
        setShowBanner(true);
        console.log(
          `🔄 [DateRollover] Practice date changed from ${props.initialDate.toLocaleDateString()} to ${current.toLocaleDateString()}`
        );
      }
    }, 60000); // Check every minute

    onCleanup(() => clearInterval(checkInterval));
  });

  const handleRefresh = () => {
    if (props.onRefresh) {
      props.onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      {showBanner() && (
        <div
          class="fixed top-0 left-0 right-0 z-50 bg-yellow-500 dark:bg-yellow-600 text-black dark:text-white px-4 py-3 shadow-lg"
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
            >
              Refresh Now
            </button>
          </div>
        </div>
      )}
    </>
  );
};
