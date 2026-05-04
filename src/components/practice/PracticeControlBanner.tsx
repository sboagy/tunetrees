/**
 * Practice Control Banner Component
 *
 * Complete toolbar for the Practice tab with all action buttons.
 * Layout: Submit | Display Submitted | Add Tunes | Queue | Flashcard Mode | Columns
 *
 * Features:
 * - Submit button (enabled when evaluations > 0)
 * - Display Submitted toggle
 * - Add Tunes button
 * - Queue date selector (Yesterday, Today, Tomorrow, Custom Date, Reset)
 * - Flashcard Mode toggle
 * - Columns menu
 * - Responsive design
 *
 * @module components/practice/PracticeControlBanner
 */

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import type { Table } from "@tanstack/solid-table";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Columns,
  EllipsisVertical,
  ListRestart,
  Plus,
  Send,
} from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { createIsMobile } from "@/lib/hooks/useIsMobile";
import { ColumnVisibilityMenu } from "../catalog/ColumnVisibilityMenu";
import {
  TOOLBAR_BADGE,
  TOOLBAR_BUTTON_BASE,
  TOOLBAR_BUTTON_GROUP_CLASSES,
  TOOLBAR_BUTTON_NEUTRAL,
  TOOLBAR_BUTTON_PRIMARY,
  TOOLBAR_CONTAINER_CLASSES,
  TOOLBAR_ICON_SIZE,
  TOOLBAR_INNER_CLASSES,
  TOOLBAR_SPACER,
} from "../grids/shared-toolbar-styles";
import { useRegisterMobileControlBar } from "../layout/MobileControlBarContext";
import { TuneSetFilterDialog } from "../tune-sets/TuneSetFilterDialog";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/switch";
import { AddTunesDialog } from "./AddTunesDialog";
import { FlashcardFieldVisibilityMenu } from "./FlashcardFieldVisibilityMenu";
import type { FlashcardFieldVisibilityByFace } from "./flashcard-fields";
import { QueueDateSelector } from "./QueueDateSelector";

export interface PracticeControlBannerProps {
  /** Number of evaluations staged for submit */
  evaluationsCount?: number;
  /** True when evaluations are still staging */
  isStaging?: boolean;
  /** Handler for submit evaluations */
  onSubmitEvaluations?: () => void;
  /** Show submitted records flag */
  showSubmitted?: boolean;
  /** Handler for display submitted toggle */
  onShowSubmittedChange?: (show: boolean) => void;
  /** Flashcard mode flag */
  flashcardMode?: boolean;
  /** Handler for flashcard mode toggle */
  onFlashcardModeChange?: (enabled: boolean) => void;
  /** Table instance for column visibility control (grid mode) */
  table?: Table<any>;
  /** Local practice-grid tune-set filter */
  selectedTuneSetId?: string | null;
  /** Handler for local practice-grid tune-set filter changes */
  onSelectedTuneSetChange?: (tuneSetId: string | null) => void;
  /** Flashcard field visibility (flashcard mode) */
  flashcardFieldVisibility?: FlashcardFieldVisibilityByFace;
  /** Handler for flashcard field visibility change */
  onFlashcardFieldVisibilityChange?: (
    visibility: FlashcardFieldVisibilityByFace
  ) => void;
  /** Handler for add tunes action */
  onAddTunes?: (count: number) => void;
  /** Current queue date */
  queueDate?: Date;
  /** Latest non-preview queue date available in the database */
  latestQueueDate?: Date | null;
  /** Recent non-preview queue dates for selector history */
  recentQueueDates?: Date[];
  /** True when more recent queue history can be loaded */
  hasMoreRecentQueues?: boolean;
  /** Handler for queue date selection */
  onQueueDateChange?: (date: Date, isPreview: boolean) => void;
  /** Return to the most recent queue rather than a manual date selection */
  onSelectLatestQueue?: () => void | Promise<void>;
  /** Load the next page of recent queue history */
  onLoadMoreRecentQueues?: () => void | Promise<void>;
  /** Handler for queue reset */
  onQueueReset?: () => void | Promise<void>;
  /**
   * When true, the practice date has rolled over and the user can build a new queue.
   */
  rolloverPending?: boolean;
  /** The new wall-clock date that is now current (shown in tooltip when rollover is pending) */
  rolloverDate?: Date;
  /** Handler called when the user clicks the refresh-queue button */
  onPracticeDateRefresh?: () => void | Promise<void>;
}

export const PracticeControlBanner: Component<PracticeControlBannerProps> = (
  props
) => {
  const isMobile = createIsMobile();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showQueueSelector, setShowQueueSelector] = createSignal(false);
  const [showAddTunesDialog, setShowAddTunesDialog] = createSignal(false);
  const [showTuneSetFilterDialog, setShowTuneSetFilterDialog] =
    createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isRefreshingQueue, setIsRefreshingQueue] = createSignal(false);
  const [showOverflowMenu, setShowOverflowMenu] = createSignal(false);
  const [pendingDisplayOptionsOpen, setPendingDisplayOptionsOpen] =
    createSignal(false);
  const { incrementPracticeListStagedChanged } = useAuth();

  let columnsButtonRef: HTMLButtonElement | undefined;
  let mobileOverflowButtonRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (!pendingDisplayOptionsOpen() || showOverflowMenu()) {
      return;
    }

    setPendingDisplayOptionsOpen(false);
    queueMicrotask(() => {
      setShowColumnsDropdown(true);
    });
  });

  const handleSubmit = async () => {
    // Protect against rapid clicks by disabling immediately
    if (isSubmitting() || props.isStaging) return;
    setIsSubmitting(true);

    try {
      if (props.onSubmitEvaluations) {
        await props.onSubmitEvaluations();
      } else {
        console.log("Submit practice evaluations");
      }
    } finally {
      // Re-enable after handler completes (or after a short delay if sync)
      setTimeout(() => setIsSubmitting(false), 100);
    }
  };

  const handleDisplaySubmittedChange = (showSubmitted: boolean) => {
    if (props.onShowSubmittedChange) {
      props.onShowSubmittedChange(showSubmitted);
      incrementPracticeListStagedChanged();
    }
  };

  const handleAddTunes = () => {
    setShowAddTunesDialog(true);
  };

  const handleAddTunesConfirm = (count: number) => {
    setShowAddTunesDialog(false);
    if (props.onAddTunes) {
      props.onAddTunes(count);
    }
  };

  const handleAddTunesCancel = () => {
    setShowAddTunesDialog(false);
  };

  const handleQueueDateSelect = (date: Date, isPreview: boolean = false) => {
    if (props.onQueueDateChange) {
      props.onQueueDateChange(date, isPreview);
    }
  };

  const handleSelectLatestQueue = async () => {
    if (props.onSelectLatestQueue) {
      await props.onSelectLatestQueue();
    }
  };

  const handleLoadMoreRecentQueues = async () => {
    if (props.onLoadMoreRecentQueues) {
      await props.onLoadMoreRecentQueues();
    }
  };

  const handleQueueReset = async () => {
    if (props.onQueueReset) {
      await props.onQueueReset();
    }
  };

  const handlePracticeDateRefresh = async () => {
    if (isRefreshingQueue() || !props.onPracticeDateRefresh) return;

    setIsRefreshingQueue(true);
    try {
      await props.onPracticeDateRefresh();
    } finally {
      setIsRefreshingQueue(false);
    }
  };

  const handleFlashcardModeChange = (enabled: boolean) => {
    if (props.onFlashcardModeChange) {
      props.onFlashcardModeChange(enabled);
    }
  };

  const handleColumnsToggle = () => {
    setShowColumnsDropdown(!showColumnsDropdown());
  };

  const handleDisplayOptionsOpen = () => {
    setPendingDisplayOptionsOpen(true);
    setShowOverflowMenu(false);
  };

  const handleQueueSelectorOpen = () => {
    setShowOverflowMenu(false);
    setShowQueueSelector(true);
  };

  const displayOptionsTriggerRef = () =>
    isMobile() ? mobileOverflowButtonRef : columnsButtonRef;

  const mobileMenuItemClasses =
    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-left text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800";

  const mobileMenuMetaClasses =
    "text-xs font-medium text-gray-500 dark:text-gray-400";

  useRegisterMobileControlBar(() => {
    if (!isMobile()) return undefined;

    return (
      <div class="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div class="flex min-w-0 flex-1 items-center justify-end gap-2">
          <button
            type="button"
            data-testid="submit-evaluations-button"
            onClick={handleSubmit}
            disabled={
              !props.evaluationsCount ||
              props.evaluationsCount === 0 ||
              isSubmitting() ||
              props.isStaging
            }
            title={
              props.isStaging
                ? "Staging evaluations..."
                : `Submit ${props.evaluationsCount || 0} practice evaluations`
            }
            class="flex h-10 min-w-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            classList={{
              "border-blue-600 bg-blue-600 text-white hover:bg-blue-500":
                !!props.evaluationsCount &&
                props.evaluationsCount > 0 &&
                !isSubmitting() &&
                !props.isStaging,
              "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-500":
                !props.evaluationsCount ||
                props.evaluationsCount === 0 ||
                isSubmitting() ||
                props.isStaging,
            }}
          >
            <Send size={15} />
            <span>Submit</span>
            <Show when={props.evaluationsCount && props.evaluationsCount > 0}>
              <span class="rounded-full bg-white/20 px-1.5 py-0 text-[10px] font-semibold text-current">
                {props.evaluationsCount}
              </span>
            </Show>
          </button>

          <Show when={props.rolloverPending}>
            <button
              type="button"
              data-testid="date-rollover-refresh-button"
              onClick={handlePracticeDateRefresh}
              disabled={isRefreshingQueue()}
              title={
                isRefreshingQueue()
                  ? "Building a new practice queue..."
                  : `Practice date has changed to ${props.rolloverDate?.toLocaleDateString() ?? "today"}. Build a new practice queue.`
              }
              class="flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/80 text-amber-600 transition-colors hover:bg-amber-50 dark:border-amber-600/70 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              <ListRestart class="h-4 w-4" />
              <span class="sr-only">New Practice Queue</span>
            </button>
          </Show>
        </div>

        <DropdownMenu
          open={showOverflowMenu()}
          onOpenChange={setShowOverflowMenu}
        >
          <DropdownMenu.Trigger
            ref={mobileOverflowButtonRef}
            type="button"
            data-testid="practice-columns-button"
            aria-label="More options"
            class="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <EllipsisVertical class="h-4 w-4" />
            <span class="sr-only">More options</span>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content class="z-50 min-w-[16rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <button
                type="button"
                class={mobileMenuItemClasses}
                onClick={() => {
                  setShowOverflowMenu(false);
                  handleAddTunes();
                }}
              >
                <span class="flex items-center gap-2">
                  <Plus class="h-4 w-4" />
                  Add More
                </span>
              </button>

              <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

              <Switch
                checked={props.showSubmitted ?? false}
                onChange={(checked) => {
                  handleDisplaySubmittedChange(checked);
                  setShowOverflowMenu(false);
                }}
                data-testid="display-submitted-switch"
                class={mobileMenuItemClasses}
              >
                <SwitchLabel class="flex-1 cursor-pointer select-none text-sm">
                  Show Submitted
                </SwitchLabel>
                <span class={mobileMenuMetaClasses}>
                  {props.showSubmitted ? "On" : "Off"}
                </span>
                <SwitchControl class="ml-1">
                  <SwitchThumb />
                </SwitchControl>
              </Switch>

              <Switch
                checked={props.flashcardMode ?? false}
                onChange={(checked) => {
                  handleFlashcardModeChange(checked);
                  setShowOverflowMenu(false);
                }}
                data-testid="flashcard-mode-switch"
                class={mobileMenuItemClasses}
              >
                <SwitchLabel class="flex-1 cursor-pointer select-none text-sm">
                  Flashcard Mode
                </SwitchLabel>
                <span class={mobileMenuMetaClasses}>
                  {props.flashcardMode ? "On" : "Off"}
                </span>
                <SwitchControl class="ml-1">
                  <SwitchThumb />
                </SwitchControl>
              </Switch>

              <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

              <button
                type="button"
                class={mobileMenuItemClasses}
                onClick={() => {
                  setShowOverflowMenu(false);
                  setShowTuneSetFilterDialog(true);
                }}
              >
                <span>Tune Set</span>
                <span class={mobileMenuMetaClasses}>
                  {props.selectedTuneSetId ? "On" : "Off"}
                </span>
              </button>

              <button
                type="button"
                class={mobileMenuItemClasses}
                onClick={handleQueueSelectorOpen}
              >
                <span>Select Practice Queue</span>
                <span class={mobileMenuMetaClasses}>
                  {formatQueueDate(props.queueDate || new Date())}
                </span>
              </button>

              <button
                type="button"
                data-testid="display-options-entry-button"
                class={mobileMenuItemClasses}
                onClick={handleDisplayOptionsOpen}
              >
                <span>Display Options</span>
                <ChevronRight class="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    );
  });

  const formatQueueDate = (date: Date): string => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const compareDate = new Date(date);
    compareDate.setHours(12, 0, 0, 0);

    const isSameDay = (d1: Date, d2: Date): boolean => {
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    };

    if (isSameDay(compareDate, today)) return "Today";
    if (isSameDay(compareDate, yesterday)) return "Yesterday";
    if (isSameDay(compareDate, tomorrow)) return "Tomorrow";

    // Format as "Mon, Jan 20" or similar
    return compareDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Show when={!isMobile()}>
        <div class={TOOLBAR_CONTAINER_CLASSES}>
          <div class={TOOLBAR_INNER_CLASSES}>
            <div class={TOOLBAR_BUTTON_GROUP_CLASSES}>
              {/* Submit button - enabled when evaluations > 0 */}
              <button
                type="button"
                data-testid="submit-evaluations-button"
                onClick={handleSubmit}
                disabled={
                  !props.evaluationsCount ||
                  props.evaluationsCount === 0 ||
                  isSubmitting() ||
                  props.isStaging
                }
                title={
                  props.isStaging
                    ? "Staging evaluations..."
                    : `Submit ${props.evaluationsCount || 0} practice evaluations`
                }
                class={`${TOOLBAR_BUTTON_BASE}`}
                classList={{
                  [`${TOOLBAR_BUTTON_PRIMARY}`]:
                    !!props.evaluationsCount &&
                    props.evaluationsCount > 0 &&
                    !isSubmitting() &&
                    !props.isStaging,
                  "text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800/70 border-gray-300/50 dark:border-gray-600/50 opacity-60 cursor-not-allowed":
                    !props.evaluationsCount ||
                    props.evaluationsCount === 0 ||
                    isSubmitting() ||
                    props.isStaging,
                }}
              >
                <Send size={14} />
                <span>Submit</span>
                <Show
                  when={props.evaluationsCount && props.evaluationsCount > 0}
                >
                  <span class={TOOLBAR_BADGE}>{props.evaluationsCount}</span>
                </Show>
              </button>

              {/* Show Submitted toggle - Switch component */}
              <div
                class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL} gap-3 px-3 py-1`}
                title="Show submitted evaluations in the practice grid"
              >
                <Switch
                  checked={props.showSubmitted ?? false}
                  onChange={handleDisplaySubmittedChange}
                  data-testid="display-submitted-switch"
                >
                  <SwitchControl>
                    <SwitchThumb />
                  </SwitchControl>
                  <SwitchLabel class="text-xs font-medium cursor-pointer select-none ml-2">
                    Show Submitted
                  </SwitchLabel>
                </Switch>
              </div>

              {/* Add More button */}
              <button
                type="button"
                onClick={handleAddTunes}
                title="Add more tunes from repertoire to practice queue"
                class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
              >
                <Plus size={14} />
                <span>Add More</span>
              </button>

              <Show when={props.rolloverPending}>
                <button
                  type="button"
                  data-testid="date-rollover-refresh-button"
                  onClick={handlePracticeDateRefresh}
                  disabled={isRefreshingQueue()}
                  title={
                    isRefreshingQueue()
                      ? "Building a new practice queue..."
                      : `Practice date has changed to ${props.rolloverDate?.toLocaleDateString() ?? "today"}. Build a new practice queue.`
                  }
                  class={`${TOOLBAR_BUTTON_BASE}`}
                  classList={{
                    "text-amber-600 dark:text-amber-400 border-amber-400/70 dark:border-amber-600/70 hover:bg-amber-50 dark:hover:bg-amber-900/20":
                      !isRefreshingQueue(),
                    "cursor-not-allowed opacity-70 text-amber-500 dark:text-amber-300 border-amber-300/70 dark:border-amber-500/70":
                      isRefreshingQueue(),
                  }}
                >
                  <ListRestart size={14} />
                  <span>New Practice Queue</span>
                </button>
              </Show>

              {/* Queue control button */}
              <button
                type="button"
                onClick={() => setShowTuneSetFilterDialog(true)}
                title="Filter this practice grid by a tune set"
                class={`${TOOLBAR_BUTTON_BASE} ${
                  props.selectedTuneSetId
                    ? TOOLBAR_BUTTON_PRIMARY
                    : TOOLBAR_BUTTON_NEUTRAL
                }`}
              >
                <Plus class={TOOLBAR_ICON_SIZE} aria-hidden="true" />
                <span>Tune Set</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQueueSelector(true)}
                title="Select practice queue date"
                class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
              >
                <Calendar class={TOOLBAR_ICON_SIZE} aria-hidden="true" />
                <span>{formatQueueDate(props.queueDate || new Date())}</span>
                <ChevronDown class="w-3 h-3" aria-hidden="true" />
              </button>

              {/* Flashcard Mode toggle - Switch component */}
              <div
                class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL} gap-3 px-3 py-1`}
                title="Toggle flashcard practice mode"
              >
                <Switch
                  checked={props.flashcardMode ?? false}
                  onChange={handleFlashcardModeChange}
                  data-testid="flashcard-mode-switch"
                >
                  <SwitchControl>
                    <SwitchThumb />
                  </SwitchControl>
                  <SwitchLabel class="text-xs font-medium cursor-pointer select-none ml-2">
                    Flashcard Mode
                  </SwitchLabel>
                </Switch>
              </div>
            </div>

            {/* Spacer to push Columns/Fields to the right */}
            <div class={TOOLBAR_SPACER} />

            {/* Columns/Fields dropdown */}
            <div class="relative">
              <button
                ref={columnsButtonRef}
                type="button"
                onClick={handleColumnsToggle}
                title={
                  props.flashcardMode ? "Show/hide fields" : "Display options"
                }
                data-testid="practice-columns-button"
                class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
              >
                <Columns size={14} />
                <span>
                  {props.flashcardMode ? "Fields" : "Display Options"}
                </span>
                <ChevronDown class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Grid Columns menu */}
      <Show when={showColumnsDropdown() && !props.flashcardMode && props.table}>
        <ColumnVisibilityMenu
          isOpen={showColumnsDropdown()}
          table={props.table!}
          onClose={() => setShowColumnsDropdown(false)}
          triggerRef={displayOptionsTriggerRef()}
          closeGuardRef={isMobile() ? null : undefined}
          title="Display Options"
        />
      </Show>

      {/* Flashcard Fields menu */}
      <Show
        when={
          showColumnsDropdown() &&
          props.flashcardMode &&
          props.flashcardFieldVisibility
        }
      >
        <FlashcardFieldVisibilityMenu
          isOpen={showColumnsDropdown()}
          fieldVisibility={props.flashcardFieldVisibility!}
          onFieldVisibilityChange={(visibility) => {
            if (props.onFlashcardFieldVisibilityChange) {
              props.onFlashcardFieldVisibilityChange(visibility);
            }
          }}
          onClose={() => setShowColumnsDropdown(false)}
          triggerRef={displayOptionsTriggerRef()}
          closeGuardRef={isMobile() ? null : undefined}
        />
      </Show>

      {/* Add Tunes Dialog */}
      <AddTunesDialog
        isOpen={showAddTunesDialog()}
        onConfirm={handleAddTunesConfirm}
        onClose={handleAddTunesCancel}
      />

      {/* Queue Date Selector Dialog */}
      <QueueDateSelector
        isOpen={showQueueSelector()}
        currentDate={props.queueDate || new Date()}
        latestQueueDate={props.latestQueueDate ?? null}
        recentQueueDates={props.recentQueueDates ?? []}
        hasMoreRecentQueues={props.hasMoreRecentQueues ?? false}
        onSelectDate={handleQueueDateSelect}
        onSelectLatestQueue={handleSelectLatestQueue}
        onLoadMoreRecentQueues={handleLoadMoreRecentQueues}
        onReset={handleQueueReset}
        onClose={() => setShowQueueSelector(false)}
      />

      <TuneSetFilterDialog
        isOpen={showTuneSetFilterDialog()}
        selectedTuneSetId={props.selectedTuneSetId ?? null}
        onSelect={(tuneSetId) => props.onSelectedTuneSetChange?.(tuneSetId)}
        onClose={() => setShowTuneSetFilterDialog(false)}
      />
    </>
  );
};
