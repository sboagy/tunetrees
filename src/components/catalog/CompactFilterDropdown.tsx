/**
 * Compact Filter Dropdown Component
 *
 * Multi-select dropdown for filtering (Type, Mode, Genre).
 * Designed to fit in control banner, similar to legacy design.
 *
 * @module components/catalog/CompactFilterDropdown
 */

import {
  type Component,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

export interface CompactFilterDropdownProps {
  /** Label for the dropdown (e.g., "Type", "Mode", "Genre") */
  label: string;
  /** Available options */
  options: string[];
  /** Selected values */
  selectedValues: string[];
  /** Change handler */
  onChange: (values: string[]) => void;
  /** Placeholder when no items selected */
  placeholder?: string;
}

/**
 * Compact Filter Dropdown
 *
 * @example
 * ```tsx
 * <CompactFilterDropdown
 *   label="Type"
 *   options={["Reel", "Jig", "Polka"]}
 *   selectedValues={selectedTypes()}
 *   onChange={setSelectedTypes}
 * />
 * ```
 */
export const CompactFilterDropdown: Component<CompactFilterDropdownProps> = (
  props
) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  // Close dropdown when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });

  // Toggle selection
  const toggleValue = (value: string) => {
    const current = props.selectedValues;
    if (current.includes(value)) {
      props.onChange(current.filter((v) => v !== value));
    } else {
      props.onChange([...current, value]);
    }
  };

  // Display text
  const displayText = () => {
    const count = props.selectedValues.length;
    if (count === 0) return props.placeholder || props.label;
    return `${props.label} (${count} selected)`;
  };

  return (
    <div ref={dropdownRef} class="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-w-[140px] justify-between"
      >
        <span class="truncate">{displayText()}</span>
        <svg
          class={`w-4 h-4 transition-transform ${isOpen() ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>Dropdown arrow</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      <Show when={isOpen()}>
        <div class="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          <div class="p-2">
            <Show
              when={props.options.length > 0}
              fallback={
                <p class="text-xs text-gray-500 dark:text-gray-400 italic p-2">
                  No options available
                </p>
              }
            >
              <For each={props.options}>
                {(option) => (
                  <label class="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                    <input
                      type="checkbox"
                      checked={props.selectedValues.includes(option)}
                      onChange={() => toggleValue(option)}
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-900 dark:text-white">
                      {option}
                    </span>
                  </label>
                )}
              </For>
            </Show>

            {/* Clear selection button */}
            <Show when={props.selectedValues.length > 0}>
              <div class="border-t border-gray-200 dark:border-gray-600 mt-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    props.onChange([]);
                    setIsOpen(false);
                  }}
                  class="w-full px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                >
                  Clear selection
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
