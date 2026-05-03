/**
 * Bulk Actions Bar Component
 *
 * Displays bulk action controls when one or more tunes are selected in the table.
 * Features:
 * - Selection count display
 * - Action buttons: Add to Repertoire, Add Tags, Delete, Export
 * - Sticky positioning for visibility
 * - Dark mode support
 *
 * @module components/tunes/BulkActionsBar
 */

import { Download, Plus, Tag, Trash2, X } from "lucide-solid";
import { type Component, Show } from "solid-js";

interface BulkActionsBarProps {
  /** Array of selected tunes */
  selectedTunes: any[];
  /** Callback to add selected tunes to a repertoire */
  onAddToRepertoire?: () => void;
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
 *   onAddToRepertoire={() => setShowRepertoireModal(true)}
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
              onClick={props.onAddToRepertoire}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Add selected tunes to a repertoire"
            >
              <Plus class="w-4 h-4" />
              <span>Add to Repertoire</span>
            </button>

            <button
              type="button"
              onClick={props.onAddTags}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Add tags to selected tunes"
            >
              <Tag class="w-4 h-4" />
              <span>Add Tags</span>
            </button>

            <button
              type="button"
              onClick={props.onDelete}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800 transition-colors"
              title="Delete selected tunes"
            >
              <Trash2 class="w-4 h-4" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={props.onExport}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
              title="Export selected tunes as JSON"
            >
              <Download class="w-4 h-4" />
              <span>Export</span>
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={props.onClearSelection}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Clear selection"
            >
              <X class="w-4 h-4" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
