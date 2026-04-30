import type { Component } from "solid-js";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

interface GroupAsSetPopoverProps {
  isOpen: boolean;
  isMobile?: boolean;
  tuneTitles: string[];
  initialName: string;
  isSaving?: boolean;
  error?: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
}

export const GroupAsSetPopover: Component<GroupAsSetPopoverProps> = (props) => {
  const [name, setName] = createSignal(props.initialName);

  createEffect(() => {
    if (!props.isOpen) return;
    setName(props.initialName);
  });

  createEffect(() => {
    if (!props.isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !props.isSaving) {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleSave = () => {
    props.onSave(name());
  };

  const content = (
    <div
      class="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      role="dialog"
      aria-modal={props.isMobile ? "true" : "false"}
      aria-labelledby="group-as-set-title"
      data-testid="group-as-set-popover"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3
            id="group-as-set-title"
            class="text-base font-semibold text-gray-900 dark:text-white"
          >
            Group as Set
          </h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Save {props.tuneTitles.length} selected
            {props.tuneTitles.length === 1 ? " tune" : " tunes"} as a reusable
            tune set.
          </p>
        </div>

        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          onClick={props.onClose}
          aria-label="Close group as set popover"
          data-testid="close-group-as-set-popover-button"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="mt-4 space-y-2">
        <label
          for="group-as-set-name"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Set Name
        </label>
        <input
          id="group-as-set-name"
          type="text"
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          data-testid="group-as-set-name-input"
          placeholder="Ballydesmond 1 / Music in the Glen"
        />
      </div>

      <Show when={props.tuneTitles.length > 0}>
        <div class="mt-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/70">
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Selected Tunes
          </div>
          <div
            class="flex flex-wrap gap-2"
            data-testid="group-as-set-selected-titles"
          >
            <For each={props.tuneTitles}>
              {(title) => (
                <span class="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
                  {title}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={props.error}>
        <p class="mt-3 text-sm text-red-600 dark:text-red-400">{props.error}</p>
      </Show>

      <div class="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          onClick={props.onClose}
          disabled={props.isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          onClick={handleSave}
          disabled={props.isSaving}
          data-testid="save-group-as-set-button"
        >
          <Show when={props.isSaving} fallback={<span>Save Set</span>}>
            <span>Saving...</span>
          </Show>
        </button>
      </div>
    </div>
  );

  return (
    <Show when={props.isOpen}>
      <Show
        when={props.isMobile}
        fallback={
          <div class="absolute left-0 top-full z-50 mt-2 w-[min(32rem,calc(100vw-2rem))]">
            {content}
          </div>
        }
      >
        <div>
          <button
            type="button"
            class="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
            onClick={props.onClose}
            aria-label="Close group as set backdrop"
          />
          <div class="fixed inset-x-3 bottom-3 z-50">{content}</div>
        </div>
      </Show>
    </Show>
  );
};
