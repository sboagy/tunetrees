/**
 * Catalog Control Banner Component
 *
 * Control banner for the Catalog tab with action buttons.
 *
 * Features:
 * - Add Tune button
 * - Additional catalog controls (future expansion)
 * - Responsive design
 *
 * @module components/catalog/CatalogControlBanner
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";

export const CatalogControlBanner: Component = () => {
  const navigate = useNavigate();

  const handleAddTune = () => {
    navigate("/tunes/new");
  };

  return (
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-12">
        {/* Left side - label */}
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
            Catalog Controls
          </span>
        </div>

        {/* Right side - action buttons */}
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddTune}
            class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            <span>➕</span>
            <span class="hidden sm:inline">Add Tune</span>
            <span class="sm:hidden">Add</span>
          </button>

          {/* Future: Add more control buttons here (Import, Export, etc.) */}
        </div>
      </div>
    </div>
  );
};
