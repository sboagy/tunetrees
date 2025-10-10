/**
 * Practice Control Banner Component
 *
 * Control banner for the Practice tab with action buttons.
 * Displays below the tab bar, similar to legacy app.
 *
 * Features:
 * - History button (navigates to practice history)
 * - Additional practice controls (future expansion)
 * - Responsive design
 *
 * @module components/practice/PracticeControlBanner
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

export const PracticeControlBanner: Component = () => {
  const navigate = useNavigate();

  return (
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-12">
        {/* Left side - could add filters or other controls */}
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
            Practice Controls
          </span>
        </div>

        {/* Right side - action buttons */}
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/practice/history")}
            class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span class="hidden sm:inline">Practice History</span>
            <span class="sm:hidden">History</span>
          </button>

          {/* Future: Add more control buttons here */}
          {/* Example: Submit Practiced Tunes, Display Options, etc. */}
        </div>
      </div>
    </div>
  );
};
