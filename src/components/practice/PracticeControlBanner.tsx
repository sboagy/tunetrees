/**
 * Practice Control Banner Component
 *
 * Complete toolbar for the Practice tab with all action buttons.
 * Layout: Submit | Display Submitted | Add Tunes | Queue dropdown | Flashcard Mode | Columns | History
 *
 * Features:
 * - Submit button (enabled when evaluations > 0)
 * - Display Submitted toggle
 * - Add Tunes button
 * - Queue control dropdown (Today, Yesterday, Tomorrow, Custom Date, Reset)
 * - Flashcard Mode toggle
 * - Columns menu
 * - Practice History button
 * - Responsive design
 *
 * @module components/practice/PracticeControlBanner
 */

import { useNavigate } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import { Columns, Plus, Send } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
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
  TOOLBAR_SPACER,
} from "../grids/shared-toolbar-styles";

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
}

export const PracticeControlBanner: Component<PracticeControlBannerProps> = (
  props
) => {
  const navigate = useNavigate();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showQueueDropdown, setShowQueueDropdown] = createSignal(false);
  const [flashcardMode, setFlashcardMode] = createSignal(false);

  let columnsButtonRef: HTMLButtonElement | undefined;
  let queueButtonRef: HTMLButtonElement | undefined;

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
    console.log("Add Tunes to practice queue - Not yet implemented");
    // TODO: Open dialog to select tunes from repertoire
  };

  const handleQueueOption = (option: string) => {
    console.log(`Queue option selected: ${option}`);
    // TODO: Implement queue date filtering
    setShowQueueDropdown(false);
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
            onClick={handleSubmit}
            disabled={!props.evaluationsCount || props.evaluationsCount === 0}
            title={`Submit ${props.evaluationsCount || 0} practice evaluations`}
            class={`${TOOLBAR_BUTTON_BASE} disabled:opacity-50 disabled:cursor-not-allowed`}
            classList={{
              "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/50":
                !!props.evaluationsCount && props.evaluationsCount > 0,
              "text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200/50 dark:border-gray-700/50":
                !props.evaluationsCount || props.evaluationsCount === 0,
            }}
          >
            <Send size={14} />
            <span class="hidden sm:inline">Submit</span>
            <Show when={props.evaluationsCount && props.evaluationsCount > 0}>
              <span class={TOOLBAR_BADGE}>{props.evaluationsCount}</span>
            </Show>
          </button>

          {/* Display Submitted toggle */}
          <button
            type="button"
            onClick={handleDisplaySubmittedToggle}
            title="Toggle display of submitted practice records"
            class={TOOLBAR_BUTTON_BASE}
            classList={{
              "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200/50 dark:border-green-700/50":
                props.showSubmitted,
              "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200/50 dark:border-gray-700/50":
                !props.showSubmitted,
            }}
          >
            <Show
              when={props.showSubmitted}
              fallback={
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              }
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
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.5 6.5m3.378 3.378l4.242 4.242M21 21l-5.6-5.6m0 0a10.05 10.05 0 01-2.025 1.025"
                />
              </svg>
            </Show>
            <span class="hidden md:inline">
              {props.showSubmitted ? "Hide" : "Show"} Submitted
            </span>
          </button>

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

          {/* Queue control dropdown */}
          <div class="relative">
            <button
              ref={queueButtonRef}
              type="button"
              onClick={() => setShowQueueDropdown(!showQueueDropdown())}
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

            {/* Queue dropdown menu */}
            <Show when={showQueueDropdown()}>
              <div class="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20">
                <For
                  each={[
                    "Today",
                    "Yesterday",
                    "Tomorrow",
                    "Custom Date",
                    "Reset",
                  ]}
                >
                  {(option) => (
                    <button
                      type="button"
                      onClick={() => handleQueueOption(option)}
                      class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md"
                    >
                      {option}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

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

          {/* Spacer */}
          <div class={TOOLBAR_SPACER} />

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

          {/* History button */}
          <button
            type="button"
            onClick={() => navigate("/practice/history")}
            title="View practice history"
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span class="hidden sm:inline">History</span>
          </button>
        </div>
      </div>
    </div>
  );
};
