/**
 * Bulk Actions Bar Component
 *
 * Displays bulk action controls when one or more tunes are selected in the table.
 * Features:
 * - Selection count display
 * - Action buttons: Add to Playlist, Add Tags, Delete, Export
 * - Sticky positioning for visibility
 * - Dark mode support
 *
 * @module components/tunes/BulkActionsBar
 */

import { type Component, Show } from "solid-js";
import type { Tune } from "../../lib/db/types";

interface BulkActionsBarProps {
  /** Array of selected tunes */
  selectedTunes: Tune[];
  /** Callback to add selected tunes to a playlist */
  onAddToPlaylist?: () => void;
  /** Callback to add tags to selected tunes */
  onAddTags?: () => void;
  /** Callback to delete selected tunes */
  onDelete?: () => void;
  /** Callback to export selected tunes */
  onExport?: () => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
}

/**
 * Bulk Actions Bar Component
 *
 * @example
 * ```tsx
 * <BulkActionsBar
 *   selectedTunes={selectedTunes()}
 *   onAddToPlaylist={() => setShowPlaylistModal(true)}
 *   onAddTags={() => setShowTagModal(true)}
 *   onDelete={() => setShowDeleteModal(true)}
 *   onExport={handleExport}
 *   onClearSelection={() => setRowSelection({})}
 * />
 * ```
 */
export const BulkActionsBar: Component<BulkActionsBarProps> = (props) => {
  const count = () => props.selectedTunes.length;

  return (
    <Show when={count() > 0}>
      <div class="sticky top-0 z-10 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 px-4 py-3 mb-4 rounded-lg shadow-md">
        <div class="flex items-center justify-between gap-4">
          {/* Selection Count */}
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-600 text-white">
              {count()}
            </span>
            <span class="text-gray-700 dark:text-gray-300 font-medium">
              {count() === 1 ? "tune selected" : "tunes selected"}
            </span>
          </div>

          {/* Action Buttons */}
          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={props.onAddToPlaylist}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Add selected tunes to a playlist"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Playlist icon"
              >
                <title>Add to Playlist</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <span>Add to Playlist</span>
            </button>

            <button
              type="button"
              onClick={props.onAddTags}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Add tags to selected tunes"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Tag icon"
              >
                <title>Add Tags</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <span>Add Tags</span>
            </button>

            <button
              type="button"
              onClick={props.onDelete}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800 transition-colors"
              title="Delete selected tunes"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Delete icon"
              >
                <title>Delete</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={props.onExport}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Export selected tunes as JSON"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Export icon"
              >
                <title>Export</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>Export</span>
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={props.onClearSelection}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Clear selection"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Clear icon"
              >
                <title>Clear Selection</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
