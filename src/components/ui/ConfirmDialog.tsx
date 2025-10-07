/**
 * Confirm Dialog Component
 *
 * A simple confirmation dialog for destructive actions.
 * Features:
 * - Modal overlay with backdrop
 * - Confirm/Cancel buttons
 * - Keyboard support (Escape to cancel)
 * - Dark mode support
 *
 * @module components/ui/ConfirmDialog
 */

import { type Component, onCleanup, onMount, Show } from "solid-js";

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/content */
  message: string;
  /** Confirm button text (default: "Confirm") */
  confirmText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Confirm button variant (default: "danger") */
  variant?: "danger" | "primary";
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled or closed */
  onCancel: () => void;
}

/**
 * Confirm Dialog Component
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   isOpen={showDeleteDialog()}
 *   title="Delete Tunes?"
 *   message="Are you sure you want to delete 3 tunes? This action cannot be undone."
 *   confirmText="Delete"
 *   variant="danger"
 *   onConfirm={handleDeleteConfirm}
 *   onCancel={() => setShowDeleteDialog(false)}
 * />
 * ```
 */
export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && props.isOpen) {
      props.onCancel();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  const confirmButtonClass = () => {
    if (props.variant === "primary") {
      return "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-800";
    }
    return "bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-800";
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={props.onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        <div
          ref={dialogRef}
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Title */}
          <h2
            id="dialog-title"
            class="text-xl font-semibold text-gray-900 dark:text-white mb-4"
          >
            {props.title}
          </h2>

          {/* Message */}
          <p
            id="dialog-description"
            class="text-gray-600 dark:text-gray-300 mb-6"
          >
            {props.message}
          </p>

          {/* Actions */}
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onClick={props.onCancel}
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600 transition-colors"
            >
              {props.cancelText || "Cancel"}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              class={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmButtonClass()}`}
            >
              {props.confirmText || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
