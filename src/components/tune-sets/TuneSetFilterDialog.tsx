import { X } from "lucide-solid";
import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import {
  getPersonalTuneSets,
  type TuneSetWithSummary,
} from "@/lib/db/queries/tune-sets";
import { TuneSetManagerDialog } from "./TuneSetManagerDialog";

interface TuneSetFilterDialogProps {
  isOpen: boolean;
  selectedTuneSetId: string | null;
  onSelect: (tuneSetId: string | null) => void;
  onClose: () => void;
}

export const TuneSetFilterDialog: Component<TuneSetFilterDialogProps> = (
  props
) => {
  const { localDb, user } = useAuth();
  const { tuneSetListChanged } = useCurrentTuneSet();
  const [showManagerDialog, setShowManagerDialog] = createSignal(false);

  const [tuneSets] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = tuneSetListChanged();
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (!params) return [];
      return getPersonalTuneSets(params.db, params.userId);
    }
  );

  const handleSelect = (tuneSetId: string | null) => {
    props.onSelect(tuneSetId);
    props.onClose();
  };

  return (
    <>
      <Show when={props.isOpen}>
        <button
          type="button"
          class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
          onClick={props.onClose}
          aria-label="Close tune-set filter backdrop"
          data-testid="tune-set-filter-backdrop"
        />

        <div
          class="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tune-set-filter-title"
          data-testid="tune-set-filter-dialog"
        >
          <div class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
            <div>
              <h2
                id="tune-set-filter-title"
                class="text-xl font-bold text-gray-900 dark:text-white"
              >
                Tune Set Filter
              </h2>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Filter this grid to a saved personal tune set.
              </p>
            </div>

            <button
              type="button"
              onClick={props.onClose}
              class="relative z-10 flex h-10 w-10 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              aria-label="Close tune-set filter dialog"
              data-testid="close-tune-set-filter-dialog"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <div class="space-y-2">
              <button
                type="button"
                class="w-full rounded-lg border px-4 py-3 text-left transition-colors"
                classList={{
                  "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300":
                    props.selectedTuneSetId === null,
                  "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800":
                    props.selectedTuneSetId !== null,
                }}
                onClick={() => handleSelect(null)}
                data-testid="tune-set-filter-all-button"
              >
                <div class="font-medium">All Tunes</div>
                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Show the full current grid without a tune-set filter.
                </div>
              </button>

              <Show
                when={!tuneSets.loading}
                fallback={
                  <div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading tune sets...
                  </div>
                }
              >
                <Show
                  when={(tuneSets() ?? []).length > 0}
                  fallback={
                    <div class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No tune sets yet. Use Group as Set from Repertoire to
                      create one.
                    </div>
                  }
                >
                  <For each={tuneSets() ?? []}>
                    {(tuneSet: TuneSetWithSummary) => (
                      <button
                        type="button"
                        class="w-full rounded-lg border px-4 py-3 text-left transition-colors"
                        classList={{
                          "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300":
                            props.selectedTuneSetId === tuneSet.id,
                          "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800":
                            props.selectedTuneSetId !== tuneSet.id,
                        }}
                        onClick={() => handleSelect(tuneSet.id)}
                        data-testid="tune-set-filter-option-button"
                      >
                        <div class="min-w-0">
                          <div class="truncate font-medium">{tuneSet.name}</div>
                          <div class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                            {tuneSet.tuneCount}{" "}
                            {tuneSet.tuneCount === 1 ? "tune" : "tunes"}
                            {tuneSet.description
                              ? ` • ${tuneSet.description}`
                              : ""}
                          </div>
                        </div>
                      </button>
                    )}
                  </For>
                </Show>
              </Show>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
            <button
              type="button"
              onClick={() => {
                props.onClose();
                setShowManagerDialog(true);
              }}
              class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              data-testid="open-tune-set-manager-button"
            >
              Manage Tune Sets
            </button>

            <button
              type="button"
              onClick={props.onClose}
              class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </Show>

      <TuneSetManagerDialog
        isOpen={showManagerDialog()}
        onClose={() => setShowManagerDialog(false)}
      />
    </>
  );
};
