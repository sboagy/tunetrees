/** Existing in-row evaluation menu; choices come from the effective goal. */

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Check, ChevronDown } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal, For, on, onCleanup, Show } from "solid-js";

import {
  type EvaluationChoice,
  LADDER_ACTION_LABELS,
  type LadderAction,
} from "../../lib/goals/config";
import { evaluationChoiceColor } from "../../lib/goals/evaluation-colors";

import {
  createEvaluationMenuPositioning,
  evaluationMenuClass,
  evaluationMenuItemClass,
} from "./evaluation-menu";

const compactActions: Record<LadderAction, string> = {
  reset: "Restart",
  back: "Step back",
  stay: "Repeat",
  advance: "Advance",
};

function dueEstimate(value: string, now: number): string {
  const due = new Date(value);
  const minutes = Math.ceil((due.getTime() - now) / 60000);
  if (!Number.isFinite(minutes)) return "Due estimate unavailable";
  if (minutes <= 0) return "Due now";
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (minutes < 60) return `Due ${relative.format(minutes, "minute")}`;
  if (minutes < 1440)
    return `Due ${relative.format(Math.round(minutes / 60), "hour")}`;
  return `Due ${due.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

interface RecallEvalComboBoxProps {
  choices: readonly EvaluationChoice[];
  loadDuePreviews?: () => Promise<Record<string, string>>;
  disabled?: boolean;
  tuneId: string;
  value: string;
  onChange: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const RecallEvalComboBox: Component<RecallEvalComboBoxProps> = (
  props
) => {
  const [selectedValue, setSelectedValue] = createSignal(props.value);
  const [duePreviews, setDuePreviews] = createSignal<Record<string, string>>(
    {}
  );
  const [previewStatus, setPreviewStatus] = createSignal("");
  const [explainChoices, setExplainChoices] = createSignal(false);
  const [previewTime, setPreviewTime] = createSignal(Date.now());
  const [localOpen, setLocalOpen] = createSignal(false);
  let previewRequest = 0;
  const choiceElements = new Map<string, HTMLDivElement>();
  const menuPosition = createEvaluationMenuPositioning(
    () => props.open ?? localOpen(),
    () =>
      choiceElements.get(selectedValue()) ??
      choiceElements.get(props.choices[0]?.id),
    () => !previewStatus()
  );
  onCleanup(() => {
    previewRequest++;
  });
  const handleOpenChange = (open: boolean) => {
    setLocalOpen(open);
    props.onOpenChange?.(open);
  };
  const refreshDuePreviews = async (open: boolean) => {
    const request = ++previewRequest;
    setDuePreviews({});
    setPreviewTime(Date.now());
    setPreviewStatus("");
    if (!open || !props.loadDuePreviews) return;
    const tuneId = props.tuneId,
      choices = props.choices;
    const current = () =>
      request === previewRequest &&
      props.tuneId === tuneId &&
      props.choices === choices;
    setPreviewStatus("Calculating due-time estimates…");
    try {
      const result = await props.loadDuePreviews();
      if (!current()) return;
      setDuePreviews(result);
      setPreviewStatus("");
    } catch {
      if (current())
        setPreviewStatus(
          "Due-time estimates unavailable. Reopen the menu to retry."
        );
    }
  };

  createEffect(
    on(
      () => [props.open ?? localOpen(), props.tuneId, props.choices] as const,
      ([open]) => {
        if (!open) {
          setExplainChoices(false);
        }
        refreshDuePreviews(open);
      }
    )
  );

  createEffect(() => {
    // Re-sync when the virtualized row is reused for a different tune.
    const currentRow = { tuneId: props.tuneId, value: props.value };
    setSelectedValue(currentRow.value);
  });

  const options = () =>
    props.choices.map((choice, index) => ({
      value: choice.id,
      label: choice.label,
      description: choice.description,
      effect:
        choice.action.kind === "fsrs" || choice.action.kind === "plugin"
          ? ""
          : compactActions[choice.action.kind],
      explanation:
        choice.action.kind === "fsrs" || choice.action.kind === "plugin"
          ? ""
          : LADDER_ACTION_LABELS[choice.action.kind],
      color: evaluationChoiceColor(choice, index, props.choices.length),
    }));
  const selectedOption = () =>
    options().find((opt) => opt.value === selectedValue()) ?? {
      ...(selectedValue()
        ? {
            label: "Evaluation unavailable — choose again",
            color: "text-destructive",
          }
        : { label: "(Not Set)", color: "text-muted-foreground" }),

      value: selectedValue(),
      description: "",
    };

  return (
    <div class="relative inline-block w-full">
      <DropdownMenu
        open={props.open}
        onOpenChange={handleOpenChange}
        // Non-modal prevents aggressive focus stealing which can contribute to closes
        modal={false}
        fitViewport
        overflowPadding={16}
        placement="bottom-start"
        getAnchorRect={menuPosition.anchor}
        flip={false}
        overlap
        gutter={0}
      >
        <DropdownMenu.Trigger
          disabled={props.disabled}
          aria-label="Evaluation"
          data-testid={`recall-eval-${props.tuneId}`}
          class="w-full min-h-11 flex items-center justify-between px-3 py-1.5 text-left text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          // Prevent the enclosing grid row click handler from treating an
          // evaluation interaction as a row-selection click.
          onPointerDown={menuPosition.onTriggerPointerDown}
          onClick={(event) => event.stopPropagation()}
        >
          <span
            class={`min-w-0 break-words whitespace-normal ${selectedOption().color}`}
          >
            {selectedOption().label}
          </span>
          <ChevronDown
            class="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2"
            aria-hidden="true"
          />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            ref={menuPosition.setContent}
            oncapture:pointerdown={menuPosition.onContentPointerDown}
            oncapture:pointerup={menuPosition.onContentPointerUp}
            data-testid={`recall-eval-menu-${props.tuneId}`}
            class={evaluationMenuClass}
          >
            <Show when={props.loadDuePreviews && !previewStatus()}>
              <p class="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                Scheduling estimates
              </p>
            </Show>
            <Show when={previewStatus()}>
              <output class="block px-3 py-2 text-sm text-muted-foreground">
                {previewStatus()}
              </output>
            </Show>
            <For each={options()}>
              {(option) => (
                <DropdownMenu.Item
                  ref={(element) => choiceElements.set(option.value, element)}
                  data-testid={`recall-eval-option-${option.value || "not-set"}`}
                  class={evaluationMenuItemClass}
                  onSelect={() => {
                    setSelectedValue(option.value);
                    props.onChange(option.value);
                  }}
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class={option.color}>{option.label}</span>
                    <Show when={selectedValue() === option.value}>
                      <Check class="size-4 shrink-0" aria-hidden="true" />
                      <span class="sr-only">Current selection</span>
                    </Show>
                  </span>
                  <Show when={option.effect || duePreviews()[option.value]}>
                    <span class="block text-sm text-muted-foreground">
                      {option.effect}
                      {option.effect && duePreviews()[option.value]
                        ? " · "
                        : ""}
                      <Show when={duePreviews()[option.value]}>
                        {(due) => (
                          <time
                            dateTime={due()}
                            title={new Date(due()).toLocaleString()}
                          >
                            <span aria-hidden="true">
                              {dueEstimate(due(), previewTime())}
                            </span>
                            <span class="sr-only">
                              Estimated due {new Date(due()).toLocaleString()}
                            </span>
                          </time>
                        )}
                      </Show>
                    </span>
                  </Show>
                  <Show when={explainChoices()}>
                    <span class="block text-sm text-muted-foreground">
                      {[option.description, option.explanation]
                        .filter(Boolean)
                        .join(" — ")}
                    </span>
                    <Show when={duePreviews()[option.value]}>
                      {(due) => (
                        <span class="block text-sm text-muted-foreground">
                          Estimated due: {new Date(due()).toLocaleString()}
                        </span>
                      )}
                    </Show>
                  </Show>
                </DropdownMenu.Item>
              )}
            </For>
            <DropdownMenu.Separator class="my-1 border-t border-border" />
            <DropdownMenu.CheckboxItem
              checked={explainChoices()}
              onChange={setExplainChoices}
              closeOnSelect={false}
              data-testid="recall-eval-explain"
              class="flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground data-[highlighted]:bg-accent cursor-pointer"
            >
              Explain choices
              <ChevronDown
                class="size-4 shrink-0"
                classList={{ "rotate-180": explainChoices() }}
                aria-hidden="true"
              />
            </DropdownMenu.CheckboxItem>
            <DropdownMenu.Item
              data-testid="recall-eval-option-not-set"
              class="min-h-11 px-3 py-2 text-sm text-muted-foreground data-[highlighted]:bg-accent cursor-pointer"
              onSelect={() => {
                setSelectedValue("");
                props.onChange("");
              }}
            >
              Clear evaluation
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  );
};
