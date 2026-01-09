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

import type { Component } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
} from "../ui/combobox";

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
  props
) => {
  // NOTE: In the virtualized grid, the TanStack cell renderer does not
  // necessarily re-run when the external open-state map updates.
  // If we rely on a fully controlled `open={props.open}`, the Combobox may never
  // visibly open (aria-expanded stays false) because the prop doesn't update
  // synchronously.
  //
  // We therefore keep an internal open signal that updates immediately on
  // `onOpenChange`, while still syncing to/from `props.open` when provided.
  const [localOpen, setLocalOpen] = createSignal(props.open ?? false);

  createEffect(() => {
    // If the virtualized grid reuses this cell for a different tune, ensure we
    // don't carry over any prior open state.
    void props.tuneId;

    if (props.open !== undefined) setLocalOpen(props.open);
    else setLocalOpen(false);
  });

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

  const selected = () =>
    options.find((o) => o.value === props.value) ?? options[0];

  const selectedOption = () => selected();

  const scrollSelectedIntoView = () => {
    const content = document.querySelector(
      `[data-testid="recall-eval-menu-${props.tuneId}"]`
    ) as HTMLElement | null;
    if (!content) return;

    const selectedItem = content.querySelector(
      "[data-selected]"
    ) as HTMLElement | null;

    selectedItem?.scrollIntoView({ block: "center" });
  };

  return (
    <div class="relative inline-block w-full">
      <Combobox
        options={options}
        optionValue="value"
        optionTextValue="label"
        optionLabel="label"
        value={selectedOption()}
        onChange={(option) => {
          const next = option?.value ?? "";
          // Kobalte Combobox may emit the current value during open/close
          // transitions; avoid staging/clearing unless it truly changed.
          if (next === props.value) return;
          props.onChange(next);
        }}
        open={localOpen()}
        onOpenChange={(isOpen) => {
          setLocalOpen(isOpen);
          props.onOpenChange?.(isOpen);

          if (isOpen) {
            queueMicrotask(() => {
              requestAnimationFrame(() => {
                scrollSelectedIntoView();
              });
            });
          }
        }}
        // Non-modal prevents aggressive focus stealing (important in the grid).
        modal={false}
        closeOnSelection={true}
        placement="bottom-start"
        gutter={0}
        sameWidth={true}
        itemComponent={(itemProps) => {
          const raw = itemProps.item.rawValue as unknown;

          const option =
            raw &&
            typeof raw === "object" &&
            "value" in raw &&
            "label" in raw &&
            "color" in raw
              ? (raw as (typeof options)[number])
              : (options.find((o) => o.value === String(raw ?? "")) ??
                options[0]);

          const optionValue = option.value;

          return (
            <ComboboxItem
              item={itemProps.item}
              data-testid={`recall-eval-option-${optionValue === "" ? "not-set" : optionValue}`}
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <span class={option.color}>{option.label}</span>
            </ComboboxItem>
          );
        }}
      >
        <ComboboxTrigger
          data-testid={`recall-eval-${props.tuneId}`}
          class="h-auto w-full flex items-center justify-between px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <span class={selected().color}>{selected().label}</span>
        </ComboboxTrigger>

        <ComboboxContent
          data-testid={`recall-eval-menu-${props.tuneId}`}
          class="z-50 w-[var(--kb-popper-anchor-width, var(--tt-ev-width, 100%))] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-72 overflow-auto"
        />
      </Combobox>
    </div>
  );
};
