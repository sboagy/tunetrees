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

import type { Table } from "@tanstack/solid-table";
import { Columns, Plus, Send } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
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
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/switch";
import { AddTunesDialog } from "./AddTunesDialog";
import { FlashcardFieldVisibilityMenu } from "./FlashcardFieldVisibilityMenu";
import type { FlashcardFieldVisibilityByFace } from "./flashcard-fields";
import { QueueDateSelector } from "./QueueDateSelector";

export interface PracticeControlBannerProps {
  /** Number of evaluations staged for submit */
  evaluationsCount?: number;
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
  /** Handler for queue date selection */
  onQueueDateChange?: (date: Date, isPreview: boolean) => void;
  /** Handler for queue reset */
  onQueueReset?: () => void;
}

export const PracticeControlBanner: Component<PracticeControlBannerProps> = (
  props
) => {
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showQueueSelector, setShowQueueSelector] = createSignal(false);
  const [showAddTunesDialog, setShowAddTunesDialog] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const { incrementPracticeListStagedChanged } = useAuth();

  let columnsButtonRef: HTMLButtonElement | undefined;

  const handleSubmit = async () => {
    // Protect against rapid clicks by disabling immediately
    if (isSubmitting()) return;
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

  const handleDisplaySubmittedToggle = () => {
    if (props.onShowSubmittedChange) {
      props.onShowSubmittedChange(!(props.showSubmitted ?? false));
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

  const handleQueueReset = () => {
    if (props.onQueueReset) {
      props.onQueueReset();
    }
  };

  const handleFlashcardToggle = () => {
    if (props.onFlashcardModeChange) {
      props.onFlashcardModeChange(!(props.flashcardMode ?? false));
    }
  };

  const handleColumnsToggle = () => {
    setShowColumnsDropdown(!showColumnsDropdown());
  };

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
              isSubmitting()
            }
            title={`Submit ${props.evaluationsCount || 0} practice evaluations`}
            class={`${TOOLBAR_BUTTON_BASE}`}
            classList={{
              [`${TOOLBAR_BUTTON_PRIMARY}`]:
                !!props.evaluationsCount &&
                props.evaluationsCount > 0 &&
                !isSubmitting(),
              "text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800/70 border-gray-300/50 dark:border-gray-600/50 opacity-60 cursor-not-allowed":
                !props.evaluationsCount ||
                props.evaluationsCount === 0 ||
                isSubmitting(),
            }}
          >
            <Send size={14} />
            <span class="hidden sm:inline">Submit</span>
            <Show when={props.evaluationsCount && props.evaluationsCount > 0}>
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
              onChange={handleDisplaySubmittedToggle}
              data-testid="display-submitted-switch"
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
              <SwitchLabel class="text-xs font-medium cursor-pointer select-none ml-2 hidden sm:inline">
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
            <span class="hidden md:inline">Add More</span>
          </button>

          {/* Queue control button */}
          <button
            type="button"
            onClick={() => setShowQueueSelector(true)}
            title="Select practice queue date"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
          >
            <svg
              class={TOOLBAR_ICON_SIZE}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span class="hidden lg:inline">
              {formatQueueDate(props.queueDate || new Date())}
            </span>
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Flashcard Mode toggle - Switch component */}
          <div
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL} gap-3 px-3 py-1`}
            title="Toggle flashcard practice mode"
          >
            <Switch
              checked={props.flashcardMode ?? false}
              onChange={handleFlashcardToggle}
              data-testid="flashcard-mode-switch"
            >
              <SwitchControl>
                <SwitchThumb />
              </SwitchControl>
              <SwitchLabel class="text-xs font-medium cursor-pointer select-none ml-2 hidden sm:inline">
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
              props.flashcardMode ? "Show/hide fields" : "Show/hide columns"
            }
            data-testid="practice-columns-button"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
          >
            <Columns size={14} />
            <span class="hidden sm:inline">
              {props.flashcardMode ? "Fields" : "Columns"}
            </span>
            <svg
              class="w-3.5 h-3.5 hidden lg:inline"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Grid Columns menu */}
          <Show
            when={showColumnsDropdown() && !props.flashcardMode && props.table}
          >
            <ColumnVisibilityMenu
              isOpen={showColumnsDropdown()}
              table={props.table!}
              onClose={() => setShowColumnsDropdown(false)}
              triggerRef={columnsButtonRef}
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
              triggerRef={columnsButtonRef}
            />
          </Show>
        </div>
      </div>

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
        onSelectDate={handleQueueDateSelect}
        onReset={handleQueueReset}
        onClose={() => setShowQueueSelector(false)}
      />
    </div>
  );
};
