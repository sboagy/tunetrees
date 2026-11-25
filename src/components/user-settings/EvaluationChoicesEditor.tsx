import { Plus, Save, SquarePen, Trash2 } from "lucide-solid";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createDraftExitGuard } from "@/components/ui/createDraftExitGuard";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EvaluationAction, EvaluationChoice } from "@/lib/goals/config";

import { GoalSettingsPersistenceError } from "@/lib/goals/settings";

export class GoalDetailsRequiredError extends Error {}

/** Choice edits have their own explicit save boundary; the goal owns persistence. */
export function EvaluationChoicesEditor(props: {
  choices: EvaluationChoice[];
  actions: {
    value: string;
    label: string;
    description?: string;
    action: EvaluationAction;
  }[];
  actionValue: (action: EvaluationAction) => string;
  newAction: () => EvaluationAction;
  disabled: boolean;
  isNew: boolean;
  schedulerChanged: boolean;
  onDraftStateChange: (dirty: boolean, pending: boolean) => void;
  onSave: (choices: EvaluationChoice[]) => Promise<void>;
  onCompleteDetails: (choices: EvaluationChoice[]) => void;
}) {
  const [draft, setDraft] = createSignal<EvaluationChoice>();
  const [original, setOriginal] = createSignal<EvaluationChoice>();
  const [deleting, setDeleting] = createSignal<EvaluationChoice>();
  const [busy, setBusy] = createSignal(false);
  const [persistOnly, setPersistOnly] = createSignal(false);
  const locked = () => busy() || persistOnly();
  const [error, setError] = createSignal("");
  const [needsDetails, setNeedsDetails] = createSignal(false);
  let trigger: HTMLElement | undefined;
  let addButton: HTMLButtonElement | undefined;
  let deleteCancel: HTMLButtonElement | undefined;
  const changed = () => JSON.stringify(draft()) !== JSON.stringify(original());
  createEffect(() =>
    props.onDraftStateChange(Boolean(draft()) && changed(), locked())
  );
  onCleanup(() => props.onDraftStateChange(false, false));
  const saveLabel = () => {
    if (busy()) return "Saving…";
    return persistOnly() ? "Retry Saving to Device" : "Save Changes";
  };
  const close = () => {
    setDraft(undefined);
    setDeleting(undefined);
    setError("");
    setNeedsDetails(false);
  };
  const { requestExit, Confirmation } = createDraftExitGuard({
    dirty: () => Boolean(draft()) && changed(),
    pending: locked,
    discard: close,
    description:
      "Unsaved changes to this evaluation choice will be lost. Previously saved choices are kept.",
  });
  const edit = (choice: EvaluationChoice | undefined, target: HTMLElement) => {
    trigger = target;
    setOriginal(choice && structuredClone(choice));
    setDraft(
      structuredClone(
        choice ?? {
          id: crypto.randomUUID(),
          label: "",
          description: "",
          action: props.newAction(),
        }
      )
    );
    setError("");
    setNeedsDetails(false);
  };
  const index = () =>
    Math.max(
      0,
      props.choices.findIndex((choice) => choice.id === draft()?.id)
    );
  const updated = () => {
    const choice = draft();
    if (!choice) return props.choices;
    return props.choices.some((item) => item.id === choice.id)
      ? props.choices.map((item) => (item.id === choice.id ? choice : item))
      : [...props.choices, choice];
  };
  const persist = async (choices: EvaluationChoice[]) => {
    if (busy() || props.disabled) return;
    setBusy(true);
    setError("");
    setNeedsDetails(false);
    try {
      await props.onSave(choices);
      setPersistOnly(false);
      close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this choice. Try again."
      );
      setPersistOnly(cause instanceof GoalSettingsPersistenceError);
      setNeedsDetails(cause instanceof GoalDetailsRequiredError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section class="min-w-0 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h4 class="font-medium">Evaluation Choices</h4>
        <Button
          type="button"
          variant="accent"
          class="min-h-11 gap-1"
          as="button"
          ref={addButton}
          data-testid="goal-choice-add"
          disabled={props.disabled}
          onClick={() => {
            if (addButton) edit(undefined, addButton);
          }}
        >
          <Plus class="size-4" aria-hidden="true" /> Add Choice
        </Button>
      </div>
      <p class="text-sm text-muted-foreground">
        Choices are saved separately. Canceling the goal does not undo saved
        choices.
      </p>
      <Show when={props.choices.length === 1}>
        <p class="text-sm text-muted-foreground">
          At least one evaluation choice is required.
        </p>
      </Show>
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-left text-sm">
          <thead class="bg-muted">
            <tr>
              <th class="p-2">Label</th>
              <th class="p-2">Scheduling Effect</th>
              <th class="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.choices}>
              {(choice, i) => (
                <tr class="border-t border-border" data-testid="goal-choice">
                  <td class="p-2 break-words">
                    <span data-testid={`goal-choice-summary-${i()}`}>
                      {choice.label}
                    </span>
                    <p class="text-muted-foreground">{choice.description}</p>
                  </td>
                  <td class="p-2">
                    {props.actions.find(
                      (action) =>
                        action.value === props.actionValue(choice.action)
                    )?.label ?? "Unavailable Effect"}
                  </td>
                  <td class="p-2">
                    <div class="flex justify-end">
                      <Tooltip>
                        <TooltipTrigger
                          as={Button}
                          type="button"
                          variant="ghost"
                          class="min-h-11 min-w-11"
                          title={`Edit ${choice.label}`}
                          aria-label={`Edit ${choice.label}`}
                          data-testid={`goal-choice-edit-${i()}`}
                          disabled={props.disabled}
                          onClick={(event) => edit(choice, event.currentTarget)}
                        >
                          <SquarePen class="size-4" aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>Edit {choice.label}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          as={Button}
                          type="button"
                          variant="destructive-ghost"
                          class="min-h-11 min-w-11"
                          title={
                            props.choices.length === 1
                              ? "At least one choice is required"
                              : `Delete ${choice.label}`
                          }
                          aria-label={`Delete ${choice.label}`}
                          data-testid={`goal-choice-remove-${i()}`}
                          disabled={
                            props.disabled || props.choices.length === 1
                          }
                          onClick={(event) => {
                            trigger = event.currentTarget;
                            setError("");
                            setDeleting(choice);
                          }}
                        >
                          <Trash2 class="size-4" aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>Delete {choice.label}</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      <AlertDialog
        open={Boolean(draft() || deleting())}
        onOpenChange={(open) => {
          if (!open) requestExit(close);
        }}
      >
        <AlertDialogContent
          class="settings-task-dialog flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col overflow-y-auto text-foreground"
          data-testid="goal-choice-dialog"
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            if (deleting()) {
              event.preventDefault();
              deleteCancel?.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (trigger?.isConnected ? trigger : addButton)?.focus();
          }}
        >
          <AlertDialogTitle class="pr-12">
            {deleting()
              ? "Delete Evaluation Choice?"
              : "Edit Evaluation Choice"}
          </AlertDialogTitle>
          <AlertDialogCloseButton disabled={locked()} />
          <AlertDialogDescription>
            {props.isNew
              ? "Saving this choice also creates the new goal with its current settings."
              : "Changes are saved immediately and are not undone when you cancel the goal."}
            <Show when={props.schedulerChanged}>
              {" "}
              The changed scheduler and its compatible choices will also be
              saved.
            </Show>
          </AlertDialogDescription>
          <Show when={draft()}>
            {(choice) => (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  persist(updated());
                }}
                class="space-y-3"
              >
                <fieldset
                  disabled={locked() || props.disabled}
                  class="space-y-3"
                >
                  <label class="block space-y-1 text-sm">
                    <span>Label</span>
                    <input
                      autofocus
                      required
                      class="w-full min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
                      data-testid={`goal-choice-label-${index()}`}
                      value={choice().label}
                      onInput={(event) =>
                        setDraft({
                          ...choice(),
                          label: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label class="block space-y-1 text-sm">
                    <span>Explanation</span>
                    <input
                      class="w-full min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
                      data-testid={`goal-choice-description-${index()}`}
                      value={choice().description}
                      onInput={(event) =>
                        setDraft({
                          ...choice(),
                          description: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label class="block space-y-1 text-sm">
                    <span>Scheduling Effect</span>
                    <select
                      class="w-full min-h-11 rounded-md border border-input bg-background px-3 text-foreground"
                      data-testid={`goal-choice-action-${index()}`}
                      value={props.actionValue(choice().action)}
                      onChange={(event) => {
                        const action = props.actions.find(
                          (item) => item.value === event.currentTarget.value
                        );
                        if (action)
                          setDraft({ ...choice(), action: action.action });
                      }}
                    >
                      <Show
                        when={
                          !props.actions.some(
                            (item) =>
                              item.value === props.actionValue(choice().action)
                          )
                        }
                      >
                        <option value={props.actionValue(choice().action)}>
                          Unavailable effect — choose another
                        </option>
                      </Show>
                      <For each={props.actions}>
                        {(action) => (
                          <option
                            value={action.value}
                            selected={
                              action.value ===
                              props.actionValue(choice().action)
                            }
                          >
                            {action.label}
                          </option>
                        )}
                      </For>
                    </select>
                  </label>
                  <p class="text-sm text-muted-foreground">
                    {
                      props.actions.find(
                        (item) =>
                          item.value === props.actionValue(choice().action)
                      )?.description
                    }
                  </p>
                </fieldset>
                <div class="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked()}
                    onClick={() => requestExit(close)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    data-testid="goal-choice-save"
                    disabled={
                      busy() ||
                      props.disabled ||
                      (!changed() &&
                        !persistOnly() &&
                        !props.isNew &&
                        !props.schedulerChanged)
                    }
                  >
                    <Save class="size-4" aria-hidden="true" />
                    {saveLabel()}
                  </Button>
                </div>
              </form>
            )}
          </Show>
          <Show when={deleting()}>
            {(choice) => (
              <>
                <p>
                  Delete “{choice().label}”? Previously recorded practice is
                  kept.
                </p>
                <div class="flex justify-end gap-2">
                  <Button
                    ref={deleteCancel}
                    type="button"
                    variant="outline"
                    disabled={locked()}
                    onClick={() => requestExit(close)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    disabled={busy() || props.disabled}
                    data-testid="goal-choice-confirm-delete"
                    onClick={() =>
                      persist(
                        props.choices.filter((item) => item.id !== choice().id)
                      )
                    }
                  >
                    {persistOnly() ? "Retry Saving to Device" : "Delete Choice"}
                  </Button>
                </div>
              </>
            )}
          </Show>
          <Show when={error()}>
            <p role="alert" class="text-sm text-destructive">
              {error()}
            </p>
          </Show>
          <Show when={needsDetails()}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                props.onCompleteDetails(
                  deleting()
                    ? props.choices.filter(
                        (choice) => choice.id !== deleting()?.id
                      )
                    : updated()
                );
                close();
              }}
            >
              Complete Goal Details
            </Button>
          </Show>
          <Confirmation />
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
