import type { Component } from "solid-js";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import type { Tune } from "@/lib/db/types";

interface TunePickerDialogProps {
  isOpen: boolean;
  label: string;
  tunes: Tune[];
  existingTuneIds?: string[];
  isSaving?: boolean;
  error?: string | null;
  emptyMessage: string;
  onClose: () => void;
  onAddSelected: (tuneIds: string[]) => void;
}

export const TunePickerDialog: Component<TunePickerDialogProps> = (props) => {
  const [query, setQuery] = createSignal("");
  const [selectedTuneIds, setSelectedTuneIds] = createSignal<string[]>([]);

  createEffect(() => {
    if (!props.isOpen) return;
    setQuery("");
    setSelectedTuneIds([]);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !props.isSaving) {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const existingTuneIdSet = createMemo(
    () => new Set(props.existingTuneIds ?? [])
  );

  const filteredTunes = createMemo(() => {
    const normalizedQuery = query().trim().toLowerCase();
    return props.tunes.filter((tune) => {
      if (!normalizedQuery) return true;

      return [tune.title, tune.type, tune.mode, tune.incipit]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  });

  const toggleSelection = (tuneId: string) => {
    setSelectedTuneIds((current) =>
      current.includes(tuneId)
        ? current.filter((id) => id !== tuneId)
        : [...current, tuneId]
    );
  };

  const selectVisibleTunes = () => {
    const visibleIds = filteredTunes()
      .map((tune) => tune.id)
      .filter((id) => !existingTuneIdSet().has(id));
    setSelectedTuneIds(visibleIds);
  };

  const clearSelection = () => setSelectedTuneIds([]);

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-[80] bg-black/50 dark:bg-black/70"
        onClick={props.onClose}
        aria-label={`Close add tunes to ${props.label.toLowerCase()} backdrop`}
        data-testid="tune-picker-backdrop"
      />

      <div
        class="fixed left-1/2 top-1/2 z-[90] w-[95vw] max-w-3xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tune-picker-title"
        data-testid="tune-picker-dialog"
      >
        <div class="flex items-start justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
          <div>
            <h3
              id="tune-picker-title"
              class="text-lg font-semibold text-gray-900 dark:text-white"
            >
              Add Tunes to {props.label}
            </h3>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Search your visible tunes and add one or more entries.
            </p>
          </div>
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            onClick={props.onClose}
            disabled={props.isSaving}
            data-testid="close-tune-picker-button"
          >
            Close
          </button>
        </div>

        <div class="space-y-4 p-4 sm:p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="text"
              value={query()}
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search by title, type, mode, or incipit"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              data-testid="tune-picker-search-input"
            />
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={selectVisibleTunes}
                disabled={props.isSaving}
                data-testid="select-visible-tunes-button"
              >
                Select Visible
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={clearSelection}
                disabled={props.isSaving || selectedTuneIds().length === 0}
                data-testid="clear-selected-tunes-button"
              >
                Clear
              </button>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 dark:border-gray-700">
            <Show
              when={filteredTunes().length > 0}
              fallback={
                <div class="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                  {props.emptyMessage}
                </div>
              }
            >
              <div
                class="max-h-[24rem] overflow-y-auto"
                data-testid="tune-picker-results"
              >
                <For each={filteredTunes()}>
                  {(tune) => {
                    const alreadyIncluded = createMemo(() =>
                      existingTuneIdSet().has(tune.id)
                    );

                    return (
                      <label class="flex items-start gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedTuneIds().includes(tune.id)}
                          disabled={props.isSaving || alreadyIncluded()}
                          onChange={() => toggleSelection(tune.id)}
                          class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                          data-testid="tune-picker-option"
                        />
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm font-medium text-gray-900 dark:text-white">
                            {tune.title}
                          </div>
                          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {[tune.type, tune.mode, tune.genre]
                              .filter(Boolean)
                              .join(" | ") || "Tune"}
                          </div>
                        </div>
                        <Show when={alreadyIncluded()}>
                          <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            Already added
                          </span>
                        </Show>
                      </label>
                    );
                  }}
                </For>
              </div>
            </Show>
          </div>

          <Show when={props.error}>
            <p class="text-sm text-red-600 dark:text-red-400">{props.error}</p>
          </Show>

          <div class="flex items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {selectedTuneIds().length} tune
              {selectedTuneIds().length === 1 ? "" : "s"} selected
            </p>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                onClick={props.onClose}
                disabled={props.isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => props.onAddSelected(selectedTuneIds())}
                disabled={props.isSaving || selectedTuneIds().length === 0}
                data-testid="confirm-add-selected-tunes-button"
              >
                <Show when={props.isSaving} fallback="Add Selected Tunes">
                  Adding...
                </Show>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};
