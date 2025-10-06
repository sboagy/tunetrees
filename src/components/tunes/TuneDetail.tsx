/**
 * Tune Detail Component
 *
 * Displays full tune information including:
 * - Title, type, mode, and metadata
 * - ABC notation preview (when abcjs is installed)
 * - References and notes
 * - Tags
 *
 * @module components/tunes/TuneDetail
 */

import { type Component, createSignal, Show } from "solid-js";
import type { Tune } from "../../lib/db/types";

interface TuneDetailProps {
  /** The tune to display */
  tune: Tune;
  /** Callback when edit button is clicked */
  onEdit?: (tune: Tune) => void;
  /** Callback when delete button is clicked */
  onDelete?: (tune: Tune) => void;
  /** Callback when back/close button is clicked */
  onClose?: () => void;
  /** Show edit button */
  showEditButton?: boolean;
  /** Show delete button */
  showDeleteButton?: boolean;
}

/**
 * Tune Detail Component
 *
 * @example
 * ```tsx
 * <TuneDetail
 *   tune={selectedTune}
 *   onEdit={(tune) => navigate(`/tunes/${tune.id}/edit`)}
 *   onClose={() => navigate('/practice')}
 *   showEditButton={true}
 * />
 * ```
 */
export const TuneDetail: Component<TuneDetailProps> = (props) => {
  const [showFullStructure, setShowFullStructure] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  const handleEdit = () => {
    props.onEdit?.(props.tune);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    props.onDelete?.(props.tune);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleClose = () => {
    props.onClose?.();
  };

  // Format structure for display (truncate if too long)
  const displayStructure = () => {
    const structure = props.tune.structure;
    if (!structure) return null;

    const maxLength = 200;
    if (showFullStructure() || structure.length <= maxLength) {
      return structure;
    }
    return `${structure.substring(0, maxLength)}...`;
  };

  return (
    <div class="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Show when={props.onClose}>
            <button
              type="button"
              onClick={handleClose}
              class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Back to list"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Back arrow</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </Show>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {props.tune.title}
          </h1>
        </div>

        <Show when={props.showEditButton && props.onEdit}>
          <div class="flex gap-2">
            <button
              type="button"
              onClick={handleEdit}
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              ✏️ Edit
            </button>
            <Show when={props.showDeleteButton && props.onDelete}>
              <button
                type="button"
                onClick={handleDelete}
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                🗑️ Delete
              </button>
            </Show>
          </div>
        </Show>
      </div>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteConfirm()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Delete Tune?
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete "{props.tune.title}"? This action
              cannot be undone.
            </p>
            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelDelete}
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Metadata Card */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Tune Information
        </h2>

        <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Type */}
          <Show when={props.tune.type}>
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Type
              </dt>
              <dd class="mt-1">
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
                  {props.tune.type}
                </span>
              </dd>
            </div>
          </Show>

          {/* Mode */}
          <Show when={props.tune.mode}>
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Mode
              </dt>
              <dd class="mt-1">
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-medium">
                  {props.tune.mode}
                </span>
              </dd>
            </div>
          </Show>

          {/* Genre */}
          <Show when={props.tune.genre}>
            <div>
              <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                Genre
              </dt>
              <dd class="mt-1 text-gray-900 dark:text-white">
                {props.tune.genre}
              </dd>
            </div>
          </Show>

          {/* Privacy Status */}
          <div>
            <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Visibility
            </dt>
            <dd class="mt-1">
              <Show
                when={props.tune.privateFor}
                fallback={
                  <span class="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium">
                    🌍 Public
                  </span>
                }
              >
                <span class="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-medium">
                  🔒 Private
                </span>
              </Show>
            </dd>
          </div>
        </dl>

        {/* Incipit */}
        <Show when={props.tune.incipit}>
          <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <dt class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Incipit (First Few Bars)
            </dt>
            <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-3 rounded-md overflow-x-auto">
              {props.tune.incipit}
            </dd>
          </div>
        </Show>
      </div>

      {/* ABC Notation Structure */}
      <Show when={props.tune.structure}>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              ABC Notation
            </h2>
            <Show when={(props.tune.structure?.length ?? 0) > 200}>
              <button
                type="button"
                onClick={() => setShowFullStructure(!showFullStructure())}
                class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showFullStructure() ? "Show less" : "Show more"}
              </button>
            </Show>
          </div>

          <div class="font-mono text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
            {displayStructure()}
          </div>

          {/* ABC Notation Preview */}
          <div class="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              📝 <strong>Note:</strong> ABC notation visual preview will be
              available once{" "}
              <code class="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 rounded">
                abcjs
              </code>{" "}
              library is installed.
            </p>
            <p class="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              Run:{" "}
              <code class="px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900 rounded">
                npm install abcjs
              </code>
            </p>
          </div>
        </div>
      </Show>

      {/* Placeholder sections for future features */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* References Section */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            References
          </h2>
          <div class="text-sm text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p>📚 References will be loaded from the database</p>
            <p class="mt-2 text-xs">
              Will display: URLs, book references, and other sources
            </p>
          </div>
        </div>

        {/* Notes Section */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Notes
          </h2>
          <div class="text-sm text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p>📝 User notes will be loaded from the database</p>
            <p class="mt-2 text-xs">
              Will display: Practice notes, performance tips, etc.
            </p>
          </div>
        </div>

        {/* Tags Section */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Tags
          </h2>
          <div class="text-sm text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p>🏷️ Tags will be loaded from the database</p>
            <p class="mt-2 text-xs">
              Will display: User-defined tags for organization
            </p>
          </div>
        </div>

        {/* Practice History Section */}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Practice History
          </h2>
          <div class="text-sm text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-900 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p>📊 Practice records will be loaded from the database</p>
            <p class="mt-2 text-xs">
              Will display: FSRS data, practice dates, quality ratings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
