/** Existing in-row evaluation menu; choices come from the effective goal. */

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ChevronDown } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal, For } from "solid-js";

import {
  type EvaluationChoice,
  LADDER_ACTION_LABELS,
} from "../../lib/goals/config";
import { getSubmittedEvaluationDisplay } from "./evaluation-display";

interface RecallEvalComboBoxProps {
  choices: readonly EvaluationChoice[];
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

  createEffect(() => {
    // Re-sync when the virtualized row is reused for a different tune.
    const currentRow = { tuneId: props.tuneId, value: props.value };
    setSelectedValue(currentRow.value);
  });

  const options = () => [
    {
      value: "",
      label: "(Not Set)",
      description: "",
      color: "text-muted-foreground",
    },
    ...props.choices.map((choice) => ({
      value: choice.id,
      label: choice.label,
      description: [
        choice.description,
        choice.action.kind === "fsrs" || choice.action.kind === "plugin"
          ? ""
          : LADDER_ACTION_LABELS[choice.action.kind],
      ]
        .filter(Boolean)
        .join(" — "),
      color:
        choice.action.kind === "fsrs"
          ? getSubmittedEvaluationDisplay({
              latestQuality: choice.action.rating,
            }).colorClass
          : "text-foreground",
    })),
  ];
  const selectedOption = () =>
    options().find((opt) => opt.value === selectedValue()) ?? {
      value: selectedValue(),
      label: "Evaluation unavailable — choose again",
      description: "",
      color: "text-destructive",
    };

  return (
    <div class="relative inline-block w-full">
      <DropdownMenu
        open={props.open}
        onOpenChange={props.onOpenChange}
        // Non-modal prevents aggressive focus stealing which can contribute to closes
        modal={false}
      >
        <DropdownMenu.Trigger
          disabled={props.disabled}
          aria-label="Evaluation"
          data-testid={`recall-eval-${props.tuneId}`}
          class="w-full min-h-11 flex items-center justify-between px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          // Prevent the enclosing grid row click handler from treating an
          // evaluation interaction as a row-selection click.
          onClick={(event) => event.stopPropagation()}
        >
          <span class={selectedOption().color}>
            {selectedOption().label}
            {selectedOption().description
              ? `: ${selectedOption().description}`
              : ""}
          </span>
          <ChevronDown
            class="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2"
            aria-hidden="true"
          />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            data-testid={`recall-eval-menu-${props.tuneId}`}
            class="z-50 mt-1 w-[var(--kb-dropdown-menu-trigger-width, var(--tt-ev-width, 100%))] bg-popover text-popover-foreground border border-border rounded shadow-lg max-h-72 overflow-auto"
          >
            <For each={options()}>
              {(option) => (
                <DropdownMenu.Item
                  data-testid={`recall-eval-option-${option.value || "not-set"}`}
                  class="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-accent data-[highlighted]:bg-accent cursor-pointer"
                  onSelect={() => {
                    setSelectedValue(option.value);
                    props.onChange(option.value);
                  }}
                >
                  <span class={option.color}>{option.label}</span>
                  <span class="block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </DropdownMenu.Item>
              )}
            </For>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  );
};
