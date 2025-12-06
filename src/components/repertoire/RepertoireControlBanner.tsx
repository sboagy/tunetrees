/**
 * Repertoire Control Banner Component
 *
 * Control banner for the Repertoire tab with action buttons.
 *
 * Features:
 * - Add To Review button
 * - Additional repertoire controls (future expansion)
 * - Responsive design
 *
 * @module components/repertoire/RepertoireControlBanner
 */

import type { Component } from "solid-js";

export const RepertoireControlBanner: Component = () => {
  const handleAddToReview = () => {
    // TODO: Implement "Add To Review" functionality
    // This should add selected tunes to the practice queue
    console.log("Add To Review clicked");
  };

  return (
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-12">
        {/* Left side - label */}
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
            Repertoire Controls
          </span>
        </div>

        {/* Right side - action buttons */}
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddToReview}
            class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            <span>➕</span>
            <span class="hidden sm:inline">Add To Review</span>
            <span class="sm:hidden">Add</span>
          </button>

          {/* Future: Add more control buttons here */}
        </div>
      </div>
    </div>
  );
};
