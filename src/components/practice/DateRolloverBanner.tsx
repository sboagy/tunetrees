/**
 * Pure display banner shown when the resolved practice queue date differs from
 * the current wall-clock practice date.
 */

import type { Component } from "solid-js";

export interface DateRolloverBannerProps {
  /** The new wall-clock date the user can advance to. */
  newDate: Date;
  /** Callback when user clicks refresh button */
  onRefresh?: () => void | Promise<void>;
}

export const DateRolloverBanner: Component<DateRolloverBannerProps> = (
  props
) => {
  const handleRefresh = async () => {
    if (props.onRefresh) {
      await props.onRefresh();
      return;
    }
    window.location.reload();
  };

  return (
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
              The practice date is now {props.newDate.toLocaleDateString()}.
              Refresh to see today's queue.
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
  );
};
