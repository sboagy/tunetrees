import { X } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { TuneSetWithSummary } from "@/lib/db/queries/tune-sets";
import { TuneSetEditorDialog } from "./TuneSetEditorDialog";
import { TuneSetList } from "./TuneSetList";

interface TuneSetManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TuneSetManagerDialog: Component<TuneSetManagerDialogProps> = (
  props
) => {
  const [showEditorDialog, setShowEditorDialog] = createSignal(false);
  const [editingTuneSetId, setEditingTuneSetId] = createSignal<
    string | undefined
  >(undefined);

  onMount(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && props.isOpen) {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleTuneSetSelect = (tuneSet: TuneSetWithSummary) => {
    setEditingTuneSetId(tuneSet.id);
    setShowEditorDialog(true);
  };

  const handleCreateNew = () => {
    setEditingTuneSetId(undefined);
    setShowEditorDialog(true);
  };

  const handleEditorClose = () => {
    setShowEditorDialog(false);
    setEditingTuneSetId(undefined);
  };

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
        aria-label="Close tune-set manager backdrop"
        data-testid="tune-set-manager-backdrop"
      />

      <div
        class="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-4xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tune-set-manager-title"
        data-testid="tune-set-manager-dialog"
      >
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="min-w-0 flex-1">
            <h2
              id="tune-set-manager-title"
              class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate"
            >
              Tune Sets
            </h2>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
              Save and reuse focused subsets of your repertoire.
            </p>
          </div>
          <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={handleCreateNew}
              class="px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-1 sm:gap-2"
              data-testid="create-tune-set-button"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span class="hidden sm:inline">New Tune Set</span>
              <span class="sm:hidden">New</span>
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="relative z-10 flex h-10 w-10 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
              data-testid="close-tune-set-manager"
            >
              <X size={20} class="sm:hidden" />
              <X size={24} class="hidden sm:block" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-4 sm:p-6">
          <TuneSetList onTuneSetSelect={handleTuneSetSelect} />
        </div>
      </div>

      <TuneSetEditorDialog
        isOpen={showEditorDialog()}
        onClose={handleEditorClose}
        tuneSetId={editingTuneSetId()}
      />
    </Show>
  );
};
