/**
 * Queue Date Selector Component
 *
 * Modal for selecting practice queue date with options:
 * - Most recent queue
 * - Recent queue history
 * - Custom Date picker
 * - Reset today's queue
 *
 * @module components/practice/QueueDateSelector
 */

import { X } from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";

export interface QueueDateSelectorProps {
  isOpen: boolean;
  currentDate: Date;
  latestQueueDate: Date | null;
  recentQueueDates: Date[];
  hasMoreRecentQueues: boolean;
  onSelectDate: (date: Date, isPreview?: boolean) => void;
  onSelectLatestQueue?: () => void | Promise<void>;
  onLoadMoreRecentQueues?: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onClose: () => void;
}

export const QueueDateSelector: Component<QueueDateSelectorProps> = (props) => {
  const [customDate, setCustomDate] = createSignal("");
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });

  let pointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let dialogRef: HTMLDivElement | undefined;

  const today = new Date();
  today.setHours(12, 0, 0, 0);

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

  const formatQueueHeading = (date: Date): string => {
    if (isSameDay(date, today)) return "Today";

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, yesterday)) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const handleRecentQueue = async (date: Date) => {
    if (
      props.latestQueueDate &&
      isSameDay(date, props.latestQueueDate) &&
      props.onSelectLatestQueue
    ) {
      await props.onSelectLatestQueue();
    } else {
      props.onSelectDate(date, false);
    }
  };

  const handleLoadMoreRecentQueues = async () => {
    if (isLoadingMore() || !props.onLoadMoreRecentQueues) return;

    setIsLoadingMore(true);
    try {
      await props.onLoadMoreRecentQueues();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleCustomDate = async () => {
    const date = parseInputDate(customDate());
    if (date) {
      if (
        props.latestQueueDate &&
        isSameDay(date, props.latestQueueDate) &&
        props.onSelectLatestQueue
      ) {
        await props.onSelectLatestQueue();
      } else {
        const isPreview = date > today;
        props.onSelectDate(date, isPreview);
      }
      props.onClose();
    }
  };

  const canResetTodayQueue = () =>
    !!props.latestQueueDate && isSameDay(props.latestQueueDate, today);

  const handleReset = async () => {
    if (
      confirm(
        "Reset today's queue? This will regenerate it on next access."
      )
    ) {
      await props.onReset();
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

  const clampOffset = (x: number, y: number) => {
    if (!dialogRef) return { x, y };

    const rect = dialogRef.getBoundingClientRect();
    const horizontalMargin = 16;
    const verticalMargin = 16;

    const minX = horizontalMargin - rect.left;
    const maxX = window.innerWidth - horizontalMargin - rect.right;
    const minY = verticalMargin - rect.top;
    const maxY = window.innerHeight - verticalMargin - rect.bottom;

    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  };

  const stopDrag = () => {
    pointerId = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerUp);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (pointerId === null || event.pointerId !== pointerId) return;

    const nextOffset = clampOffset(
      dragOriginX + (event.clientX - dragStartX),
      dragOriginY + (event.clientY - dragStartY)
    );
    setDragOffset(nextOffset);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (pointerId === null || event.pointerId !== pointerId) return;
    stopDrag();
  };

  const handleHeaderPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if ((event.target as HTMLElement).closest("button, input, label")) return;

    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginX = dragOffset().x;
    dragOriginY = dragOffset().y;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  createEffect(() => {
    if (props.isOpen) {
      setDragOffset({ x: 0, y: 0 });
    } else {
      stopDrag();
    }
  });

  onCleanup(() => {
    stopDrag();
  });

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
            ref={dialogRef}
            class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-date-selector-title"
            style={{
              transform: `translate(${dragOffset().x}px, ${dragOffset().y}px)`,
            }}
          >
            {/* Header */}
            <div
              class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={handleHeaderPointerDown}
              title="Drag to move dialog"
            >
              <h2
                id="queue-date-selector-title"
                class="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                Select Practice Queue
              </h2>
              <button
                type="button"
                onClick={props.onClose}
                onPointerDown={(e) => e.stopPropagation()}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div class="p-4 space-y-3">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose a recent queue or jump to a specific date. Future dates
                are preview only.
              </p>

              <Show
                when={props.recentQueueDates.length > 0}
                fallback={
                  <div class="rounded-md border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                    No recent queues available yet.
                  </div>
                }
              >
                <div class="space-y-2">
                  <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Recent Queues
                  </div>
                  <div class="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                    <For each={props.recentQueueDates}>
                      {(date) => {
                        const isLatestQueue =
                          !!props.latestQueueDate &&
                          isSameDay(date, props.latestQueueDate);
                        const isSelected = isSameDay(props.currentDate, date);

                        return (
                          <button
                            type="button"
                            data-testid={
                              isLatestQueue ? "queue-latest-option" : undefined
                            }
                            onClick={() => void handleRecentQueue(date)}
                            class="w-full text-left px-4 py-3 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                            classList={{
                              "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700":
                                isSelected,
                            }}
                          >
                            <div class="flex items-center justify-between gap-3">
                              <div class="font-medium text-gray-900 dark:text-gray-100">
                                {isLatestQueue
                                  ? "Most Recent Queue"
                                  : formatQueueHeading(date)}
                              </div>
                              <Show when={isSelected}>
                                <span class="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                  Selected
                                </span>
                              </Show>
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {formatDateForInput(date)}
                              {isLatestQueue ? " (Current active queue)" : ""}
                            </div>
                          </button>
                        );
                      }}
                    </For>

                    <Show when={props.hasMoreRecentQueues}>
                      <button
                        type="button"
                        data-testid="queue-history-load-more"
                        onClick={() => void handleLoadMoreRecentQueues()}
                        disabled={isLoadingMore()}
                        class="w-full rounded-md border border-dashed border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <div class="text-lg leading-none">...</div>
                        <div class="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {isLoadingMore() ? "Loading more queues" : "Load 10 more"}
                        </div>
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>

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
                  onClick={() => void handleReset()}
                  disabled={!canResetTodayQueue()}
                  class="w-full text-left px-4 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  title={
                    !canResetTodayQueue()
                      ? "Reset is only available when today's queue exists"
                      : "Reset today's active queue"
                  }
                >
                  <div class="font-medium">Reset Today's Queue</div>
                  <div class="text-xs opacity-75">
                    Delete and rebuild today's queue from scratch
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
