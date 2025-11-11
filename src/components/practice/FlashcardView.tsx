/**
 * Flashcard View Component
 *
 * Full-screen flashcard interface for tune practice.
 * Replaces the grid view when flashcard mode is active.
 *
 * Features:
 * - Navigate through tunes with arrow keys or touch gestures
 * - Spacebar to reveal/hide notation
 * - Number keys 1-4 to select evaluation
 * - Progress indicator (N of M)
 * - Respects "Show Submitted" filter
 *
 * @module components/practice/FlashcardView
 */

import { ChevronLeft, ChevronRight } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import type { SqliteDatabase } from "../../lib/db/client-sqlite";
import type { ITuneOverview } from "../grids/types";
import { FlashcardCard } from "./FlashcardCard";
import type { FlashcardFieldVisibilityByFace } from "./flashcard-fields";

export interface FlashcardViewProps {
  tunes: ITuneOverview[];
  onRecallEvalChange?: (tuneId: string, value: string) => void;
  fieldVisibility?: FlashcardFieldVisibilityByFace;
  // Shared evaluation state (same as TunesGridScheduled)
  evaluations?: Record<string, string>;
  // For staging to table_transient_data
  localDb?: () => SqliteDatabase | null;
  userId?: string;
  playlistId?: string;
}

export const FlashcardView: Component<FlashcardViewProps> = (props) => {
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [isRevealed, setIsRevealed] = createSignal(false);
  const [didInitFromSelection, setDidInitFromSelection] = createSignal(false);
  // Auth context currently only needed if future features require local staging directly
  // (evaluation staging now centralized in parent PracticeIndex)
  // const { incrementPracticeListStagedChanged } = useAuth();

  // Use shared evaluations from parent (single source of truth)
  const evaluations = () => props.evaluations || {};

  // Get current tune
  const currentTune = () => {
    const tunes = props.tunes;
    const index = currentIndex();
    return tunes[index] || null;
  };

  // When tunes list changes (e.g., after submit with showSubmitted=false),
  // adjust currentIndex if it's now out of bounds
  createEffect(() => {
    const tunesLength = props.tunes.length;
    const index = currentIndex();

    console.log(
      `[FlashcardView] Tunes count: ${tunesLength}, currentIndex: ${index}`
    );

    if (index >= tunesLength && tunesLength > 0) {
      // Current index out of bounds, go to last tune
      console.log(
        `[FlashcardView] Index out of bounds, adjusting to ${tunesLength - 1}`
      );
      setCurrentIndex(tunesLength - 1);
    } else if (tunesLength === 0) {
      // No tunes left, reset to 0
      console.log("[FlashcardView] No tunes left, resetting index to 0");
      setCurrentIndex(0);
    }
  });

  // On initial mount: if a current tune is selected in the grid, start on that tune's index
  // Runs once when tunes are available and a selection exists
  createEffect(() => {
    if (didInitFromSelection()) return;
    const selectedId = currentTuneId?.() ?? null;
    const tunes = props.tunes;
    if (!tunes || tunes.length === 0) return; // wait until tunes are ready

    if (selectedId !== null) {
      const idx = tunes.findIndex((t) => t.id === selectedId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }
    setDidInitFromSelection(true);
  });

  // Set current tune in context whenever flashcard changes
  createEffect(() => {
    const tune = currentTune();
    if (tune) {
      setCurrentTuneId(tune.id);
    }
  });

  // Navigation handlers
  const goToPrevious = () => {
    if (currentIndex() > 0) {
      setCurrentIndex(currentIndex() - 1);
      setIsRevealed(false); // Reset reveal state
    }
  };

  const goToNext = () => {
    if (currentIndex() < props.tunes.length - 1) {
      setCurrentIndex(currentIndex() + 1);
      setIsRevealed(false); // Reset reveal state
    }
  };

  const toggleReveal = () => {
    setIsRevealed(!isRevealed());
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        goToPrevious();
        break;
      case "ArrowRight":
        e.preventDefault();
        goToNext();
        break;
      case " ": // Spacebar
        e.preventDefault();
        toggleReveal();
        break;
      case "1":
        e.preventDefault();
        handleRecallEvalChange("again");
        break;
      case "2":
        e.preventDefault();
        handleRecallEvalChange("hard");
        break;
      case "3":
        e.preventDefault();
        handleRecallEvalChange("good");
        break;
      case "4":
        e.preventDefault();
        handleRecallEvalChange("easy");
        break;
      default:
        break;
    }
  };

  const handleRecallEvalChange = async (evaluation: string) => {
    const tune = currentTune();
    if (!tune) return;

    console.log(
      `[FlashcardView] Evaluation changed for tune ${tune.id}: ${evaluation}`
    );
    console.log(`[FlashcardView] Current evaluations:`, evaluations());

    // Delegate to parent handler (single source of truth)
    props.onRecallEvalChange?.(tune.id, evaluation);
  };

  // Set up keyboard listeners
  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Touch gesture support (basic swipe)
  let touchStartX = 0;
  let touchEndX = 0;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const swipeThreshold = 75; // Minimum swipe distance
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swiped left - go to next
        goToNext();
      } else {
        // Swiped right - go to previous
        goToPrevious();
      }
    }
  };

  // Reset reveal state when tune changes
  createEffect(() => {
    currentIndex(); // Track dependency
    setIsRevealed(false);
  });

  return (
    <div
      class="h-full flex flex-col bg-gray-50 dark:bg-gray-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="flashcard-view"
    >
      {/* Progress Indicator */}
      <div
        class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3"
        data-testid="flashcard-header"
      >
        <div class="flex items-center justify-between">
          <div
            class="text-sm text-gray-600 dark:text-gray-400"
            data-testid="flashcard-counter"
          >
            <span class="font-semibold text-gray-900 dark:text-gray-100">
              {currentIndex() + 1}
            </span>{" "}
            of{" "}
            <span class="font-semibold text-gray-900 dark:text-gray-100">
              {props.tunes.length}
            </span>
          </div>

          {/* Keyboard Shortcuts Help */}
          <div class="hidden md:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                ←→
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                Space
              </kbd>{" "}
              Reveal
            </span>
            <span>
              <kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                1-4
              </kbd>{" "}
              Rate
            </span>
          </div>
        </div>
      </div>

      {/* Flashcard Container */}
      <div class="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <Show
          when={currentTune()}
          fallback={
            <div
              class="text-center text-gray-500 dark:text-gray-400"
              data-testid="flashcard-empty-state"
            >
              <p class="text-xl mb-2">No tunes available</p>
              <p class="text-sm">
                Add tunes to your practice queue to get started.
              </p>
            </div>
          }
        >
          {(tune) => (
            <div
              class="w-full max-w-4xl h-full max-h-[calc(100vh-12rem)] relative"
              data-testid="flashcard-card-container"
            >
              {/* Navigation Buttons - Aligned with Front/Back label */}
              <button
                type="button"
                onClick={goToPrevious}
                disabled={currentIndex() === 0}
                class="absolute left-2 top-20 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all z-10"
                aria-label="Previous tune"
                data-testid="flashcard-prev-button"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                onClick={goToNext}
                disabled={currentIndex() === props.tunes.length - 1}
                class="absolute right-2 top-20 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all z-10"
                aria-label="Next tune"
                data-testid="flashcard-next-button"
              >
                <ChevronRight size={24} />
              </button>

              {/* Card */}
              <FlashcardCard
                tune={tune()}
                currentEvaluation={(() => {
                  const evals = evaluations();
                  const id = tune().id;
                  return id in evals ? evals[id] : tune().recall_eval || "";
                })()}
                isRevealed={isRevealed()}
                fieldVisibility={props.fieldVisibility}
                onRecallEvalChange={handleRecallEvalChange}
                onReveal={toggleReveal}
              />
            </div>
          )}
        </Show>
      </div>

      {/* Mobile bottom nav removed: swipe + floating arrows are sufficient */}
    </div>
  );
};
