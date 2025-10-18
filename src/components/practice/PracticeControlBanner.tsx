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
import { ColumnVisibilityMenu } from "../catalog/ColumnVisibilityMenu";
import {
  TOOLBAR_BADGE,
  TOOLBAR_BUTTON_ACCENT,
  TOOLBAR_BUTTON_BASE,
  TOOLBAR_BUTTON_GROUP_CLASSES,
  TOOLBAR_BUTTON_NEUTRAL,
  TOOLBAR_CONTAINER_CLASSES,
  TOOLBAR_ICON_SIZE,
  TOOLBAR_INNER_CLASSES,
} from "../grids/shared-toolbar-styles";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../ui/switch";
import { AddTunesDialog } from "./AddTunesDialog";
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
  /** Table instance for column visibility control */
  table?: Table<any>;
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
  const [flashcardMode, setFlashcardMode] = createSignal(false);
  const [showAddTunesDialog, setShowAddTunesDialog] = createSignal(false);

  let columnsButtonRef: HTMLButtonElement | undefined;

  const handleSubmit = () => {
    if (props.onSubmitEvaluations) {
      props.onSubmitEvaluations();
    } else {
      console.log("Submit practice evaluations");
    }
  };

  const handleDisplaySubmittedToggle = () => {
    if (props.onShowSubmittedChange) {
      props.onShowSubmittedChange(!(props.showSubmitted ?? false));
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
    setFlashcardMode(!flashcardMode());
    console.log(`Flashcard mode: ${!flashcardMode()}`);
    // TODO: Switch between table and flashcard view
  };

  const handleColumnsToggle = () => {
    setShowColumnsDropdown(!showColumnsDropdown());
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
            disabled={!props.evaluationsCount || props.evaluationsCount === 0}
            title={`Submit ${props.evaluationsCount || 0} practice evaluations`}
            class={`${TOOLBAR_BUTTON_BASE}`}
            classList={{
              "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/50":
                !!props.evaluationsCount && props.evaluationsCount > 0,
              "text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800/70 border-gray-300/50 dark:border-gray-600/50 opacity-60 cursor-not-allowed":
                !props.evaluationsCount || props.evaluationsCount === 0,
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
            class="flex items-center gap-3 px-3 py-1 rounded-md border border-gray-200/50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
              <SwitchLabel class="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none ml-2 hidden sm:inline">
                Show Submitted
              </SwitchLabel>
            </Switch>
          </div>

          {/* Add Tunes button */}
          <button
            type="button"
            onClick={handleAddTunes}
            title="Add tunes from repertoire to practice queue"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_ACCENT}`}
          >
            <Plus size={14} />
            <span class="hidden md:inline">Add Tunes</span>
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
            <span class="hidden lg:inline">Queue</span>
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

          {/* Flashcard Mode toggle */}
          <button
            type="button"
            onClick={handleFlashcardToggle}
            title="Toggle flashcard practice mode"
            class={TOOLBAR_BUTTON_BASE}
            classList={{
              "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 border-orange-200/50 dark:border-orange-700/50":
                flashcardMode(),
              "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200/50 dark:border-gray-700/50":
                !flashcardMode(),
            }}
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
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            <span class="hidden lg:inline">Flashcard</span>
          </button>

          {/* Columns dropdown */}
          <div class="relative">
            <button
              ref={columnsButtonRef}
              type="button"
              onClick={handleColumnsToggle}
              title="Show/hide columns"
              data-testid="practice-columns-button"
              class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
            >
              <Columns size={14} />
              <span class="hidden sm:inline">Columns</span>
            </button>

            {/* Columns menu */}
            <Show when={showColumnsDropdown() && props.table}>
              <ColumnVisibilityMenu
                isOpen={showColumnsDropdown()}
                table={props.table!}
                onClose={() => setShowColumnsDropdown(false)}
                triggerRef={columnsButtonRef}
              />
            </Show>
          </div>
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
