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
import type { ITuneOverview } from "../grids/types";
import { FlashcardCard } from "./FlashcardCard";
import type { FlashcardFieldVisibilityByFace } from "./flashcard-fields";

export interface FlashcardViewProps {
  tunes: ITuneOverview[];
  onEvaluationChange?: (tuneId: number, value: string) => void;
  onExitFlashcardMode?: () => void;
  fieldVisibility?: FlashcardFieldVisibilityByFace;
}

export const FlashcardView: Component<FlashcardViewProps> = (props) => {
  const { setCurrentTuneId } = useCurrentTune();
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [isRevealed, setIsRevealed] = createSignal(false);
  const [evaluations, setEvaluations] = createSignal<Record<number, string>>(
    {}
  );

  // Get current tune
  const currentTune = () => {
    const tunes = props.tunes;
    const index = currentIndex();
    return tunes[index] || null;
  };

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

  const handleRecallEvalChange = (evaluation: string) => {
    const tune = currentTune();
    if (tune && props.onEvaluationChange) {
      // Update local evaluations signal
      setEvaluations((prev) => ({ ...prev, [tune.id]: evaluation }));
      // Call parent handler
      props.onEvaluationChange(tune.id, evaluation);
    }
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
    >
      {/* Progress Indicator */}
      <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-600 dark:text-gray-400">
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
            <div class="text-center text-gray-500 dark:text-gray-400">
              <p class="text-xl mb-2">No tunes available</p>
              <p class="text-sm">
                Add tunes to your practice queue to get started.
              </p>
            </div>
          }
        >
          {(tune) => (
            <div class="w-full max-w-4xl h-full max-h-[calc(100vh-12rem)] relative">
              {/* Navigation Buttons - Aligned with Front/Back label */}
              <button
                type="button"
                onClick={goToPrevious}
                disabled={currentIndex() === 0}
                class="absolute left-2 top-20 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all z-10"
                aria-label="Previous tune"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                onClick={goToNext}
                disabled={currentIndex() === props.tunes.length - 1}
                class="absolute right-2 top-20 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all z-10"
                aria-label="Next tune"
              >
                <ChevronRight size={24} />
              </button>

              {/* Card */}
              <FlashcardCard
                tune={tune()}
                currentEvaluation={evaluations()[tune().id] || ""}
                isRevealed={isRevealed()}
                fieldVisibility={props.fieldVisibility}
                onRecallEvalChange={handleRecallEvalChange}
                onReveal={toggleReveal}
              />
            </div>
          )}
        </Show>
      </div>

      {/* Mobile Navigation Buttons */}
      <div class="flex-shrink-0 md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <div class="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={currentIndex() === 0}
            class="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed font-medium"
          >
            ← Previous
          </button>

          <button
            type="button"
            onClick={toggleReveal}
            class="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium"
          >
            {isRevealed() ? "Hide" : "Reveal"}
          </button>

          <button
            type="button"
            onClick={goToNext}
            disabled={currentIndex() === props.tunes.length - 1}
            class="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed font-medium"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};
