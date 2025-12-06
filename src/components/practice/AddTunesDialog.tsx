/**
 * Add Tunes Dialog Component
 *
 * Modal dialog for adding tunes from backlog to the practice queue.
 * User specifies how many tunes to add (default: 5).
 *
 * @module components/practice/AddTunesDialog
 */

import { X } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";

export interface AddTunesDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Callback when user clicks Add */
  onConfirm: (count: number) => void;
  /** Callback when user clicks Cancel or closes */
  onClose: () => void;
}

export const AddTunesDialog: Component<AddTunesDialogProps> = (props) => {
  const [count, setCount] = createSignal(5);

  const handleConfirm = () => {
    const value = count();
    if (value >= 1) {
      props.onConfirm(value);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape key handled via onKeyDown */}
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={props.onClose}
        onKeyDown={(e) => e.key === "Escape" && props.onClose()}
      >
        {/* Dialog */}
        <div
          class="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Add More Tunes
            </h2>
            <button
              type="button"
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div class="mb-6">
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              Choose how many tunes to add from your backlog.
            </p>

            <label class="block">
              <span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Count
              </span>
              <input
                type="number"
                min="1"
                max="50"
                value={count()}
                onInput={(e) =>
                  setCount(parseInt(e.currentTarget.value, 10) || 5)
                }
                onKeyDown={handleKeyDown}
                class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autofocus
              />
            </label>
          </div>

          {/* Actions */}
          <div class="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={props.onClose}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
