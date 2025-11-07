/**
 * Queue Date Selector Component
 *
 * Modal for selecting practice queue date with options:
 * - Yesterday
 * - Today (active queue)
 * - Tomorrow (preview only - doesn't persist)
 * - Custom Date picker
 * - Reset Active Queue
 *
 * @module components/practice/QueueDateSelector
 */

import { X } from "lucide-solid";
import { type Component, createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";

export interface QueueDateSelectorProps {
  isOpen: boolean;
  currentDate: Date;
  onSelectDate: (date: Date, isPreview?: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}

export const QueueDateSelector: Component<QueueDateSelectorProps> = (props) => {
  const [customDate, setCustomDate] = createSignal("");

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseInputDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return date;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const handleYesterday = () => {
    props.onSelectDate(yesterday, false);
    props.onClose();
  };

  const handleToday = () => {
    props.onSelectDate(today, false);
    props.onClose();
  };

  const handleTomorrow = () => {
    props.onSelectDate(tomorrow, true); // Mark as preview
    props.onClose();
  };

  const handleCustomDate = () => {
    const date = parseInputDate(customDate());
    if (date) {
      const isPreview = date > today;
      props.onSelectDate(date, isPreview);
      props.onClose();
    }
  };

  const handleReset = () => {
    if (
      confirm(
        "Reset the current active queue? This will regenerate the queue on next access.",
      )
    ) {
      props.onReset();
      props.onClose();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Escape key handled via onKeyDown */}
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
          onClick={handleBackdropClick}
          onKeyDown={handleKeyDown}
        >
          <div
            class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-date-selector-title"
          >
            {/* Header */}
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2
                id="queue-date-selector-title"
                class="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                Select Practice Queue
              </h2>
              <button
                type="button"
                onClick={props.onClose}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div class="p-4 space-y-3">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose a date to view the practice queue. Future dates are
                preview only.
              </p>

              {/* Quick date buttons */}
              <div class="space-y-2">
                <button
                  type="button"
                  onClick={handleYesterday}
                  class="w-full text-left px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  classList={{
                    "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700":
                      isSameDay(props.currentDate, yesterday),
                  }}
                >
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    Yesterday
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateForInput(yesterday)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleToday}
                  class="w-full text-left px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  classList={{
                    "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700":
                      isSameDay(props.currentDate, today),
                  }}
                >
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    Today
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateForInput(today)} (Active Queue)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleTomorrow}
                  class="w-full text-left px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  classList={{
                    "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700":
                      isSameDay(props.currentDate, tomorrow),
                  }}
                >
                  <div class="font-medium text-gray-900 dark:text-gray-100">
                    Tomorrow (Preview)
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateForInput(tomorrow)}
                  </div>
                </button>
              </div>

              {/* Custom date picker */}
              <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                <label
                  for="custom-date-input"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Custom Date
                </label>
                <div class="flex gap-2">
                  <input
                    id="custom-date-input"
                    type="date"
                    value={customDate()}
                    onInput={(e) => setCustomDate(e.currentTarget.value)}
                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    aria-label="Custom date"
                  />
                  <button
                    type="button"
                    onClick={handleCustomDate}
                    disabled={!customDate()}
                    class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600"
                  >
                    Go
                  </button>
                </div>
              </div>

              {/* Reset button */}
              <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!isSameDay(props.currentDate, today)}
                  class="w-full text-left px-4 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  title={
                    !isSameDay(props.currentDate, today)
                      ? "Reset only available for today's queue"
                      : "Reset today's active queue"
                  }
                >
                  <div class="font-medium">Reset Active Queue</div>
                  <div class="text-xs opacity-75">
                    Regenerate today's queue from scratch
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div class="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={props.onClose}
                class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
