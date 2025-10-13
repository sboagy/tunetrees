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

import { ChevronDown } from "lucide-solid";
import {
  type Component,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

interface RecallEvalComboBoxProps {
  tuneId: number;
  value: string;
  onChange: (value: string) => void;
}

export const RecallEvalComboBox: Component<RecallEvalComboBoxProps> = (
  props
) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

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

  const handleSelect = (value: string) => {
    props.onChange(value);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (
      dropdownRef &&
      buttonRef &&
      !dropdownRef.contains(e.target as Node) &&
      !buttonRef.contains(e.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  return (
    <div class="relative inline-block w-full">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // Prevent row click
          setIsOpen(!isOpen());
        }}
        class="w-full flex items-center justify-between px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <span class={selectedOption().color}>{selectedOption().label}</span>
        <ChevronDown class="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {/* Dropdown Menu */}
      <Show when={isOpen()}>
        <div
          ref={dropdownRef}
          class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-auto"
          style="left: 32px;"
        >
          {options.map((option) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(option.value);
              }}
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              classList={{
                "bg-blue-50 dark:bg-blue-900/20": option.value === props.value,
              }}
            >
              <span class={option.color}>{option.label}</span>
            </button>
          ))}
        </div>
      </Show>
    </div>
  );
};
