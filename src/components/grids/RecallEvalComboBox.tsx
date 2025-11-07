/**
 * Recall Evaluation ComboBox Component
 *
 * Embedded dropdown for selecting practice recall evaluation.
 * Port from: legacy/frontend/app/(main)/pages/practice/components/RowRecallEvalComboBox.tsx
 *
 * Options:
 * - (Not Set) - Default state
 * - Again: need to practice again soon
 * - Hard: difficult recall with effort
 * - Good: satisfactory recall performance
 * - Easy: effortless and confident recall
 *
 * @module components/grids/RecallEvalComboBox
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ChevronDown } from "lucide-solid";
import type { Component } from "solid-js";
import { For } from "solid-js";

interface RecallEvalComboBoxProps {
  tuneId: string;
  value: string;
  onChange: (value: string) => void;
  // Controlled open state (optional). When provided, the dropdown will keep
  // its open/close state across parent re-renders (e.g., grid refresh).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const RecallEvalComboBox: Component<RecallEvalComboBoxProps> = (
  props,
) => {
  const options = [
    {
      value: "",
      label: "(Not Set)",
      color: "text-gray-500 dark:text-gray-400",
    },
    {
      value: "again",
      label: "Again: need to practice again soon",
      color: "text-red-600 dark:text-red-400",
    },
    {
      value: "hard",
      label: "Hard: difficult recall with effort",
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      value: "good",
      label: "Good: satisfactory recall performance",
      color: "text-green-600 dark:text-green-400",
    },
    {
      value: "easy",
      label: "Easy: effortless and confident recall",
      color: "text-blue-600 dark:text-blue-400",
    },
  ];

  const selectedOption = () =>
    options.find((opt) => opt.value === props.value) || options[0];

  return (
    <div class="relative inline-block w-full">
      <DropdownMenu
        // Control open state if provided to avoid unexpected closes on grid refresh
        open={props.open}
        onOpenChange={props.onOpenChange}
        // Non-modal prevents aggressive focus stealing which can contribute to closes
        modal={false}
      >
        <DropdownMenu.Trigger
          data-testid={`recall-eval-${props.tuneId}`}
          class="w-full flex items-center justify-between px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span class={selectedOption().color}>{selectedOption().label}</span>
          <ChevronDown class="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            data-testid={`recall-eval-menu-${props.tuneId}`}
            class="z-50 mt-1 w-[var(--kb-dropdown-menu-trigger-width, var(--tt-ev-width, 100%))] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-72 overflow-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <For each={options}>
              {(option) => (
                <DropdownMenu.Item
                  data-testid={`recall-eval-option-${
                    option.value || "not-set"
                  }`}
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onSelect={() => props.onChange(option.value)}
                >
                  <span class={option.color}>{option.label}</span>
                </DropdownMenu.Item>
              )}
            </For>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </div>
  );
};
