import { X } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { Button } from "@/components/ui/button";
import type { TuneSetWithSummary } from "@/lib/db/queries/tune-sets";

interface GroupAsSetPopoverProps {
  isOpen: boolean;
  tuneTitles: string[];
  initialName: string;
  availableTuneSets: TuneSetWithSummary[];
  loadingTuneSets?: boolean;
  addingToSetId?: string | null;
  isSaving?: boolean;
  error?: string | null;
  onSave: (data: { name: string; description: string }) => void;
  onAddToExistingSet: (tuneSetId: string) => void;
  onClose: () => void;
}

export const GroupAsSetPopover: Component<GroupAsSetPopoverProps> = (props) => {
  const [name, setName] = createSignal(props.initialName);
  const [description, setDescription] = createSignal("");
  const [mode, setMode] = createSignal<"create" | "existing">("create");

  createEffect(() => {
    if (!props.isOpen) return;
    setName(props.initialName);
    setDescription("");
    setMode("create");
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
    props.onSave({ name: name(), description: description() });
  };

  const content = (
    <div
      class="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-as-set-title"
      data-testid="group-as-set-popover"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3
            id="group-as-set-title"
            class="text-base font-semibold text-gray-900 dark:text-white"
          >
            Save Selection as Set
          </h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Choose what to do with these {props.tuneTitles.length} selected
            {props.tuneTitles.length === 1 ? " tune" : " tunes"}.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={props.onClose}
          aria-label="Close group as set popover"
          data-testid="close-group-as-set-popover-button"
        >
          <X class="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <div
        class="mt-4 grid gap-3 sm:grid-cols-2"
        data-testid="group-as-set-mode-switch"
      >
        <button
          type="button"
          class={`rounded-xl border px-4 py-3 text-left transition-colors ${
            mode() === "create"
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-background text-foreground hover:bg-accent/30"
          }`}
          onClick={() => setMode("create")}
          data-testid="group-as-set-create-mode-button"
        >
          <div class="text-sm font-semibold">Create New Set</div>
          <div class="mt-1 text-xs text-muted-foreground">
            Name and save this selection as a new reusable set.
          </div>
        </button>

        <button
          type="button"
          class={`rounded-xl border px-4 py-3 text-left transition-colors ${
            mode() === "existing"
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-background text-foreground hover:bg-accent/30"
          }`}
          onClick={() => setMode("existing")}
          data-testid="group-as-set-existing-mode-button"
        >
          <div class="text-sm font-semibold">Add to Existing Set</div>
          <div class="mt-1 text-xs text-muted-foreground">
            Pick one of your current sets and add this selection there.
          </div>
        </button>
      </div>

      <Show when={mode() === "create"}>
        <div class="mt-4 space-y-2" data-testid="group-as-set-create-panel">
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

          <label
            for="group-as-set-description"
            class="block pt-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Description
          </label>
          <textarea
            id="group-as-set-description"
            value={description()}
            onInput={(event) => setDescription(event.currentTarget.value)}
            class="min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            data-testid="group-as-set-description-input"
            placeholder="Optional notes about when or why you use this set"
          />
        </div>
      </Show>

      <Show when={mode() === "existing"}>
        <div
          class="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
          data-testid="group-as-set-existing-panel"
        >
          <div class="mb-2">
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              Choose Existing Set
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Reuse one of your personal sets instead of creating a new one.
            </p>
          </div>

          <Show
            when={!props.loadingTuneSets}
            fallback={
              <div class="py-3 text-sm text-gray-500 dark:text-gray-400">
                Loading tune sets...
              </div>
            }
          >
            <Show
              when={props.availableTuneSets.length > 0}
              fallback={
                <div class="rounded-md border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  No personal tune sets yet. Switch to Create New Set instead.
                </div>
              }
            >
              <div
                class="max-h-48 space-y-2 overflow-y-auto"
                data-testid="group-as-set-existing-list"
              >
                <For each={props.availableTuneSets}>
                  {(tuneSet) => (
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                      disabled={Boolean(props.addingToSetId) || props.isSaving}
                      onClick={() => props.onAddToExistingSet(tuneSet.id)}
                      data-testid="add-selection-to-tune-set-option"
                    >
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {tuneSet.name}
                        </div>
                        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {tuneSet.tuneCount} tune
                          {tuneSet.tuneCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <Show
                        when={props.addingToSetId === tuneSet.id}
                        fallback={
                          <span class="text-xs font-medium text-primary">
                            Add
                          </span>
                        }
                      >
                        <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Show>

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

      <div class="mt-4 flex w-full items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={props.onClose}
          disabled={props.isSaving || Boolean(props.addingToSetId)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          disabled={
            mode() !== "create" ||
            props.isSaving ||
            Boolean(props.addingToSetId)
          }
          data-testid="save-group-as-set-button"
        >
          <Show when={props.isSaving} fallback={<span>Create New Set</span>}>
            <span>Saving...</span>
          </Show>
        </Button>
      </div>
    </div>
  );

  return (
    <Show when={props.isOpen}>
      <div>
        <button
          type="button"
          class="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70"
          onClick={props.onClose}
          aria-label="Close group as set backdrop"
        />
        <div class="fixed left-1/2 top-1/2 z-[70] w-[95vw] max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto">
          <div class="p-1 md:p-0">{content}</div>
        </div>
      </div>
    </Show>
  );
};
