import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getUserRepertoires } from "@/lib/db/queries/repertoires";
import type { RepertoireWithSummary } from "@/lib/db/types";

/**
 * RepertoireSelectorModal Component
 *
 * Modal dialog for selecting a repertoire to add tunes to.
 * Displays all user repertoires with tune counts.
 *
 * Features:
 * - Lists all user repertoires
 * - Shows tune count for each repertoire
 * - Handles selection and submission
 * - Keyboard support (Escape to cancel)
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <RepertoireSelectorModal
 *   isOpen={showModal()}
 *   tuneCount={selectedTunes().length}
 *   onSelect={handleRepertoireSelect}
 *   onCancel={() => setShowModal(false)}
 * />
 * ```
 */

interface RepertoireSelectorModalProps {
  isOpen: boolean;
  tuneCount: number;
  onSelect: (repertoireId: string) => void;
  onCancel: () => void;
}

export const RepertoireSelectorModal: Component<RepertoireSelectorModalProps> = (
  props
) => {
  const { localDb, user } = useAuth();
  const [selectedRepertoireId, setSelectedRepertoireId] = createSignal<
    string | null
  >(null);

  // Fetch user repertoires
  const [repertoires] = createResource(async () => {
    const db = localDb();
    const userId = user()?.id;

    if (!db || !userId) {
      return [];
    }

    return await getUserRepertoires(db, userId);
  });

  const handleSelect = () => {
    const repertoireId = selectedRepertoireId();
    if (repertoireId !== null) {
      props.onSelect(repertoireId);
      setSelectedRepertoireId(null); // Reset selection
    }
  };

  const handleCancel = () => {
    setSelectedRepertoireId(null); // Reset selection
    props.onCancel();
  };

  // Keyboard event handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  // Add keyboard listener when modal opens
  if (props.isOpen) {
    document.addEventListener("keydown", handleKeyDown);
  } else {
    document.removeEventListener("keydown", handleKeyDown);
  }

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
        onClick={handleCancel}
        aria-label="Close modal backdrop"
      />
      <div
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repertoire-modal-title"
      >
        <h2
          id="repertoire-modal-title"
          class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
        >
          Add to Repertoire
        </h2>

        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Select a repertoire to add {props.tuneCount}{" "}
          {props.tuneCount === 1 ? "tune" : "tunes"}:
        </p>

        <Show
          when={!repertoires.loading}
          fallback={
            <div class="py-8 text-center text-gray-500 dark:text-gray-400">
              Loading repertoires...
            </div>
          }
        >
          <Show
            when={repertoires() && repertoires()!.length > 0}
            fallback={
              <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                No repertoires found. Create a repertoire first.
              </div>
            }
          >
            <div class="mb-6 max-h-96 space-y-2 overflow-y-auto">
              <For each={repertoires()}>
                {(repertoireItem: RepertoireWithSummary) => (
                  <button
                    type="button"
                    class={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                      selectedRepertoireId() === repertoireItem.repertoireId
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                    }`}
                    onClick={() =>
                      setSelectedRepertoireId(repertoireItem.repertoireId)
                    }
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-white">
                          {repertoireItem.name}
                        </div>
                        <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {repertoireItem.tuneCount}{" "}
                          {repertoireItem.tuneCount === 1 ? "tune" : "tunes"}
                        </div>
                      </div>
                      <Show
                        when={
                          selectedRepertoireId() === repertoireItem.repertoireId
                        }
                      >
                        <svg
                          class="h-5 w-5 text-blue-500 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>Selected</title>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </Show>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            onClick={handleSelect}
            disabled={selectedRepertoireId() === null}
          >
            Add to Repertoire
          </button>
        </div>
      </div>
    </Show>
  );
};
