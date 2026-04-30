import type { Component } from "solid-js";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getPersonalTuneSets,
  type TuneSetWithSummary,
} from "@/lib/db/queries/tune-sets";

interface TuneSetSelectorModalProps {
  isOpen: boolean;
  tuneCount: number;
  initialTuneSetId?: string | null;
  onSelect: (tuneSetId: string) => void;
  onCancel: () => void;
}

export const TuneSetSelectorModal: Component<TuneSetSelectorModalProps> = (
  props
) => {
  const { localDb, user } = useAuth();
  const [selectedTuneSetId, setSelectedTuneSetId] = createSignal<string | null>(
    props.initialTuneSetId ?? null
  );

  const [tuneSets] = createResource(async () => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return [];
    return getPersonalTuneSets(db, userId);
  });

  createEffect(() => {
    if (!props.isOpen) return;
    setSelectedTuneSetId(props.initialTuneSetId ?? null);
  });

  createEffect(() => {
    if (!props.isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  const handleSelect = () => {
    const tuneSetId = selectedTuneSetId();
    if (!tuneSetId) return;
    props.onSelect(tuneSetId);
  };

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onCancel}
        aria-label="Close add-to-tune-set backdrop"
      />
      <div
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tune-set-modal-title"
        data-testid="add-to-tune-set-dialog"
      >
        <h2
          id="tune-set-modal-title"
          class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
        >
          Add to Tune Set
        </h2>

        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Select a tune set to add {props.tuneCount}{" "}
          {props.tuneCount === 1 ? "tune" : "tunes"}:
        </p>

        <Show
          when={!tuneSets.loading}
          fallback={
            <div class="py-8 text-center text-gray-500 dark:text-gray-400">
              Loading tune sets...
            </div>
          }
        >
          <Show
            when={(tuneSets() ?? []).length > 0}
            fallback={
              <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                No tune sets found. Create one from the Tune Sets menu first.
              </div>
            }
          >
            <div class="mb-6 max-h-96 space-y-2 overflow-y-auto">
              <For each={tuneSets() ?? []}>
                {(tuneSet: TuneSetWithSummary) => (
                  <button
                    type="button"
                    class={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                      selectedTuneSetId() === tuneSet.id
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setSelectedTuneSetId(tuneSet.id)}
                    data-testid="tune-set-option-button"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 dark:text-white truncate">
                          {tuneSet.name}
                        </div>
                        <div class="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate">
                          {tuneSet.tuneCount}{" "}
                          {tuneSet.tuneCount === 1 ? "tune" : "tunes"}
                          {tuneSet.description
                            ? ` • ${tuneSet.description}`
                            : ""}
                        </div>
                      </div>
                      <Show when={selectedTuneSetId() === tuneSet.id}>
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
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            onClick={handleSelect}
            disabled={!selectedTuneSetId()}
            data-testid="confirm-add-to-tune-set-button"
          >
            Add to Tune Set
          </button>
        </div>
      </div>
    </Show>
  );
};
