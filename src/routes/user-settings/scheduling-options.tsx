/**
 * Scheduling Options Settings Page
 *
 * Configure scheduling constraints and practice calendar.
 * Matches legacy: legacy/frontend/app/user-settings/scheduling-options/page.tsx
 *
 * @module routes/user-settings/scheduling-options
 */

import type { Component } from "solid-js";

const SchedulingOptionsPage: Component = () => {
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
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Scheduling options form will be implemented here.
        </p>
        {/* TODO: Implement form with:
          - Acceptable Delinquency Window (days)
          - Min Reviews Per Day
          - Max Reviews Per Day
          - Days per Week
          - Weekly Rules (JSON)
          - Exceptions (JSON)
        */}
      </div>
    </div>
  );
};

export default SchedulingOptionsPage;
