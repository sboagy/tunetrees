/**
 * Add Tunes Dialog Component
 *
 * Modal dialog for adding tunes from backlog to the practice queue.
 * User specifies how many tunes to add (default: 5).
 *
 * @module components/practice/AddTunesDialog
 */

import { Plus } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { Button } from "@/components/ui/button";

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
          <header class="flex justify-between items-center w-full mb-4">
            <div class="flex flex-1 justify-start">
              <Button type="button" onClick={props.onClose} variant="outline">
                Cancel
              </Button>
            </div>
            <div class="flex min-w-0 flex-1 justify-center px-3">
              <h2 class="text-center text-xl font-semibold text-gray-900 dark:text-gray-100">
                Add More Tunes
              </h2>
            </div>
            <div class="flex flex-1 justify-end">
              <Button type="button" onClick={handleConfirm} variant="default">
                <Plus size={16} />
                Add
              </Button>
            </div>
          </header>

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
        </div>
      </div>
    </Show>
  );
};
