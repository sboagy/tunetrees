/**
 * Tune Detail Component
 *
 * Displays full   const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  // Load tags for this tune - reactive: refetches when tune.id or user changes
  const [tuneTags] = createResource(
    () => ({ tuneId: props.tune.id, userId: user()?.id }),
    async (params) => {
      if (!params.userId || !params.tuneId) return [];

      const db = getDb();
      const tags = await getTuneTags(db, params.tuneId, params.userId); // params.userId is already a UUID string
      return tags.map((t) => t.tagText);
    },
  );

  // Load references for this tune - reactive: refetches when tune.id or user changes
  const [tuneReferences] = createResource(
    () => ({ tuneId: props.tune.id, userId: user()?.id }),
    async (params) => {
      if (!params.userId || !params.tuneId) return [];

      const db = getDb();
      return await getReferencesByTune(db, params.tuneId, params.userId); // params.userId is UUID string
    },
  );on including:
 * - Title, type, mode, and metadata
 * - ABC notation preview (when abcjs is installed)
 * - References and notes
 * - Tags
 *
 * @module components/tunes/TuneDetail
 */

import { type Component, createResource, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDb } from "@/lib/db/client-sqlite";
import { getReferencesByTune } from "@/lib/db/queries/references";
import { getTuneTags } from "@/lib/db/queries/tags";
import type { Tune } from "../../lib/db/types";
import { ReferenceList } from "../references/ReferenceList";
import { AbcNotation } from "./AbcNotation";
import { TagList } from "./TagList";

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
  const { user } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  // Load tags for this tune - reactive: refetches when tune.id or user changes
  const [tuneTags] = createResource(
    () => ({ tuneId: props.tune.id, userId: user()?.id }),
    async (params) => {
      if (!params.userId || !params.tuneId) return [];

      const db = getDb();
      const tags = await getTuneTags(db, params.tuneId, params.userId); // params.userId is already a UUID string
      return tags.map((t) => t.tagText);
    }
  );

  // Load references for this tune - reactive: refetches when tune.id or user changes
  const [tuneReferences] = createResource(
    () => ({ tuneId: props.tune.id, userId: user()?.id }),
    async (params) => {
      if (!params.userId || !params.tuneId) return [];

      const db = getDb();
      return await getReferencesByTune(db, params.tuneId, params.userId); // params.userId is UUID string
    }
  );

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

  return (
    <>
      <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        {/* Scrollable Content with constrained width */}
        <div class="max-w-4xl mx-auto py-6 px-4 w-full">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            {/* Header with Edit/Delete buttons inside constrained area */}
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              {/* Left: Title */}
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {props.tune.title}
              </h2>

              {/* Right: Edit and Delete buttons */}
              <div class="flex items-center gap-3">
                <Show when={props.showEditButton && props.onEdit}>
                  <button
                    type="button"
                    onClick={handleEdit}
                    class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium flex items-center gap-2"
                    aria-label="Edit tune"
                  >
                    Edit
                  </button>
                </Show>
                <Show when={props.showDeleteButton && props.onDelete}>
                  <button
                    type="button"
                    onClick={handleDelete}
                    class="text-red-600 dark:text-red-400 hover:underline text-sm font-medium flex items-center gap-2"
                    aria-label="Delete tune"
                  >
                    Delete
                  </button>
                </Show>
              </div>
            </div>

            {/* Content - matching TuneEditor structure */}
            <div class="p-6">
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

                  {/* Composer */}
                  <Show when={props.tune.composer}>
                    <div>
                      <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Composer
                      </dt>
                      <dd class="mt-1 text-gray-900 dark:text-white">
                        {props.tune.composer}
                      </dd>
                    </div>
                  </Show>

                  {/* Artist */}
                  <Show when={props.tune.artist}>
                    <div>
                      <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Artist
                      </dt>
                      <dd class="mt-1 text-gray-900 dark:text-white">
                        {props.tune.artist}
                      </dd>
                    </div>
                  </Show>

                  {/* Release Year */}
                  <Show when={props.tune.releaseYear}>
                    <div>
                      <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Year
                      </dt>
                      <dd class="mt-1 text-gray-900 dark:text-white">
                        {props.tune.releaseYear}
                      </dd>
                    </div>
                  </Show>

                  {/* External ID */}
                  <Show when={props.tune.idForeign}>
                    <div>
                      <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                        External ID
                      </dt>
                      <dd class="mt-1 text-gray-900 dark:text-white font-mono text-sm">
                        {props.tune.idForeign}
                      </dd>
                    </div>
                  </Show>

                  {/* Tags */}
                  <div class="md:col-span-2">
                    <dt class="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Tags
                    </dt>
                    <dd class="mt-1">
                      <Show
                        when={!tuneTags.loading}
                        fallback={
                          <span class="text-xs text-gray-400">
                            Loading tags...
                          </span>
                        }
                      >
                        <TagList
                          tags={tuneTags() || []}
                          variant="primary"
                          size="md"
                        />
                      </Show>
                    </dd>
                  </div>

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

              {/* ABC Notation - Rendered from Incipit */}
              <Show when={props.tune.incipit}>
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Music Notation
                  </h2>

                  {/* Render ABC notation */}
                  <AbcNotation
                    notation={`X:1\nT:${props.tune.title || "Untitled"}\nM:4/4\nL:1/8\nK:${props.tune.mode || "D"}\n${
                      props.tune.incipit
                    }`}
                    responsive={true}
                    showErrors={true}
                    class="mb-4"
                  />

                  {/* Raw ABC Display (collapsible) */}
                  <details class="mt-4">
                    <summary class="cursor-pointer text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      Show ABC Notation Source
                    </summary>
                    <div class="mt-2 font-mono text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-x-auto">
                      <pre>{props.tune.incipit}</pre>
                    </div>
                  </details>
                </div>
              </Show>

              {/* Placeholder sections for future features */}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* References Section */}
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    References
                    <Show when={!tuneReferences.loading && tuneReferences()}>
                      <span class="text-sm font-normal text-gray-500 ml-2">
                        ({tuneReferences()!.length})
                      </span>
                    </Show>
                  </h2>
                  <Show
                    when={!tuneReferences.loading}
                    fallback={
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        Loading references...
                      </p>
                    }
                  >
                    <ReferenceList
                      references={tuneReferences() || []}
                      groupByType={true}
                      showActions={false}
                    />
                  </Show>
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
          </div>
        </div>
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
    </>
  );
};
