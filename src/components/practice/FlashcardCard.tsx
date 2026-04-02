/**
 * Flashcard Card Component
 *
 * Individual flashcard for tune practice.
 * Front: Tune name + type + mode
 * Back: ABC notation, structure, notes, audio, references
 *
 * @module components/practice/FlashcardCard
 */

import { FlipVertical2 } from "lucide-solid";
import type { Component } from "solid-js";
import { createMemo, Show } from "solid-js";
import { RecallEvalComboBox } from "../grids/RecallEvalComboBox";
import type { ITuneOverview } from "../grids/types";
import type {
  FlashcardFieldVisibility,
  FlashcardFieldVisibilityByFace,
} from "./flashcard-fields";

export interface FlashcardCardProps {
  tune: ITuneOverview;
  currentEvaluation: string; // Current evaluation value
  isRevealed: boolean;
  fieldVisibility?: FlashcardFieldVisibilityByFace;
  onRecallEvalChange?: (evaluation: string) => void;
  onReveal?: () => void;
}

export const FlashcardCard: Component<FlashcardCardProps> = (props) => {
  const handleEvalChange = (newValue: string) => {
    if (props.onRecallEvalChange) {
      props.onRecallEvalChange(newValue);
    }
  };

  const formatMode = (mode: string | null): string => {
    if (!mode) return "";
    // Capitalize first letter of each word
    return mode
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  /**
   * Check if a field should be visible based on field visibility settings and current face
   * Uses createMemo to make it reactive to prop changes
   */
  const isFieldVisible = createMemo(() => {
    return (fieldId: keyof FlashcardFieldVisibility): boolean => {
      if (!props.fieldVisibility) return true; // Show all by default

      // Determine which face to check based on revealed state
      const face = props.isRevealed ? "back" : "front";
      return props.fieldVisibility[face][fieldId] ?? true;
    };
  });

  /**
   * Render evaluation control or static text based on completed_at status
   * Matches the logic from TuneColumns.tsx evaluation cell
   */
  const renderEvaluation = () => {
    const completedAt = props.tune.completed_at;

    // If completed_at is set, show static text (tune already submitted)
    if (completedAt) {
      let label = "(Not Set)";
      let colorClass = "text-gray-600 dark:text-gray-400";

      // Check if we have quality data to display
      if (
        props.tune.latest_quality !== null &&
        props.tune.latest_quality !== undefined
      ) {
        const quality = props.tune.latest_quality;
        const technique = props.tune.latest_technique || "fsrs";

        if (technique === "sm2") {
          // SM2 uses 0-5 scale
          const sm2Labels: Record<number, string> = {
            0: "Complete blackout",
            1: "Incorrect response",
            2: "Incorrect (easy to recall)",
            3: "Correct (serious difficulty)",
            4: "Correct (hesitation)",
            5: "Perfect response",
          };
          const sm2Colors: Record<number, string> = {
            0: "text-red-600 dark:text-red-400",
            1: "text-red-600 dark:text-red-400",
            2: "text-orange-600 dark:text-orange-400",
            3: "text-yellow-600 dark:text-yellow-400",
            4: "text-green-600 dark:text-green-400",
            5: "text-blue-600 dark:text-blue-400",
          };
          label = sm2Labels[quality] || `Quality ${quality}`;
          colorClass = sm2Colors[quality] || colorClass;
        } else {
          // FSRS uses 1-4 scale
          const fsrsLabels: Record<number, string> = {
            1: "Again",
            2: "Hard",
            3: "Good",
            4: "Easy",
          };
          const fsrsColors: Record<number, string> = {
            1: "text-red-600 dark:text-red-400",
            2: "text-orange-600 dark:text-orange-400",
            3: "text-green-600 dark:text-green-400",
            4: "text-blue-600 dark:text-blue-400",
          };
          label = fsrsLabels[quality] || `Quality ${quality}`;
          colorClass = fsrsColors[quality] || colorClass;
        }
      }
      // Fallback to recall_eval text if quality not available
      else if (props.currentEvaluation) {
        const fsrsLabels: Record<string, string> = {
          again: "Again",
          hard: "Hard",
          good: "Good",
          easy: "Easy",
        };
        const fsrsColors: Record<string, string> = {
          again: "text-red-600 dark:text-red-400",
          hard: "text-orange-600 dark:text-orange-400",
          good: "text-green-600 dark:text-green-400",
          easy: "text-blue-600 dark:text-blue-400",
        };
        label = fsrsLabels[props.currentEvaluation] || props.currentEvaluation;
        colorClass =
          fsrsColors[props.currentEvaluation] ||
          "text-gray-600 dark:text-gray-400";
      }

      return (
        <div class="text-center">
          <span class={`text-lg ${colorClass} italic font-medium`}>
            {label}
          </span>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            (Submitted)
          </p>
        </div>
      );
    }

    // Otherwise show editable combobox
    return (
      <RecallEvalComboBox
        tuneId={props.tune.id}
        value={props.currentEvaluation}
        onChange={handleEvalChange}
      />
    );
  };

  return (
    <div
      class="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      data-testid="flashcard-card"
    >
      {/* Front Side - Always Visible */}
      <div class="flex-1 flex flex-col p-8">
        {/* Tune Name */}
        <div class="text-center mb-6">
          <div class="flex items-center justify-center mb-2">
            <h2
              class="text-3xl font-bold text-gray-900 dark:text-gray-100"
              data-testid="flashcard-tune-title"
            >
              {props.tune.title || "Untitled"}
            </h2>
          </div>
          {/* Front/Back Indicator with Flip Button */}
          <div class="flex items-center justify-center gap-2 mb-2">
            <span
              class="text-xs font-medium px-2 py-1 rounded"
              classList={{
                "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300":
                  !props.isRevealed,
                "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300":
                  props.isRevealed,
              }}
            >
              {props.isRevealed ? "Back" : "Front"}
            </span>
            <button
              type="button"
              onClick={props.onReveal}
              class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              title={props.isRevealed ? "Show front" : "Show back"}
              aria-label={props.isRevealed ? "Show front" : "Show back"}
              data-testid="flashcard-reveal-toggle"
            >
              <FlipVertical2 class="w-4 h-4" />
            </button>
          </div>
          <div class="flex items-center justify-center gap-4 text-lg text-gray-600 dark:text-gray-400">
            <Show when={props.tune.type && isFieldVisible()("type")}>
              <span
                class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
                data-testid="flashcard-field-type"
              >
                {props.tune.type}
              </span>
            </Show>
            <Show when={props.tune.mode && isFieldVisible()("mode")}>
              <span
                class="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                data-testid="flashcard-field-mode"
              >
                {formatMode(props.tune.mode)}
              </span>
            </Show>
          </div>
        </div>

        {/* Evaluation Control */}
        <div class="mb-6" data-testid="flashcard-evaluation">
          {renderEvaluation()}
        </div>

        {/* Detail Fields - Shown based on current face and field visibility settings */}
        <div class="flex-1 overflow-y-auto space-y-6">
          {/* Composer */}
          <Show when={isFieldVisible()("composer")}>
            <div data-testid="flashcard-field-composer">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Composer
              </h3>
              <p class="text-gray-900 dark:text-gray-100">
                {props.tune.composer || "—"}
              </p>
            </div>
          </Show>

          {/* Artist */}
          <Show when={isFieldVisible()("artist")}>
            <div data-testid="flashcard-field-artist">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Artist
              </h3>
              <p class="text-gray-900 dark:text-gray-100">
                {props.tune.artist || "—"}
              </p>
            </div>
          </Show>

          {/* Release Year */}
          <Show when={isFieldVisible()("release_year")}>
            <div data-testid="flashcard-field-release_year">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Release Year
              </h3>
              <p class="text-gray-900 dark:text-gray-100">
                {props.tune.release_year !== null &&
                props.tune.release_year !== undefined
                  ? props.tune.release_year
                  : "—"}
              </p>
            </div>
          </Show>

          {/* External ID */}
          <Show when={isFieldVisible()("id_foreign")}>
            <div data-testid="flashcard-field-id_foreign">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                External ID
              </h3>
              <p class="text-gray-900 dark:text-gray-100 font-mono break-all">
                {props.tune.id_foreign || "—"}
              </p>
            </div>
          </Show>

          {/* Structure */}
          <Show when={isFieldVisible()("structure")}>
            <div data-testid="flashcard-field-structure">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Structure
              </h3>
              <p class="text-gray-900 dark:text-gray-100 font-mono">
                {props.tune.structure || "—"}
              </p>
            </div>
          </Show>

          {/* Incipit (ABC Notation preview) */}
          <Show when={isFieldVisible()("incipit")}>
            <div data-testid="flashcard-field-incipit">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Incipit
              </h3>
              <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100 overflow-x-auto">
                {props.tune.incipit || "—"}
              </div>
            </div>
          </Show>

          {/* Public Notes */}
          <Show when={isFieldVisible()("note_public")}>
            <div data-testid="flashcard-field-note_public">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </h3>
              <div class="prose dark:prose-invert max-w-none">
                <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {props.tune.note_public || "—"}
                </p>
              </div>
            </div>
          </Show>

          {/* Private Notes */}
          <Show when={isFieldVisible()("note_private")}>
            <div data-testid="flashcard-field-note_private">
              <h3 class="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
                Private Notes
              </h3>
              <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border border-yellow-200 dark:border-yellow-700">
                <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {props.tune.note_private || "—"}
                </p>
              </div>
            </div>
          </Show>

          {/* Favorite URL */}
          <Show when={isFieldVisible()("favorite_url")}>
            <div data-testid="flashcard-field-favorite_url">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Reference
              </h3>
              <Show
                when={props.tune.favorite_url}
                fallback={<p class="text-gray-500 dark:text-gray-400">—</p>}
              >
                <a
                  href={props.tune.favorite_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {props.tune.favorite_url}
                </a>
              </Show>
            </div>
          </Show>

          {/* Goal */}
          <Show when={isFieldVisible()("goal")}>
            <div data-testid="flashcard-field-goal">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Goal
              </h3>
              <p class="text-gray-900 dark:text-gray-100">
                {props.tune.goal || props.tune.latest_goal || "—"}
              </p>
            </div>
          </Show>

          {/* Technique */}
          <Show when={isFieldVisible()("technique")}>
            <div data-testid="flashcard-field-technique">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Technique
              </h3>
              <p class="text-gray-900 dark:text-gray-100">
                {props.tune.latest_technique || "—"}
              </p>
            </div>
          </Show>

          {/* Scheduling Info */}
          <Show when={isFieldVisible()("practice_history")}>
            <div
              class="pt-4 border-t border-gray-200 dark:border-gray-700"
              data-testid="flashcard-field-practice_history"
            >
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Practice History
              </h3>
              <div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Last practiced:{" "}
                  {props.tune.latest_practiced
                    ? new Date(props.tune.latest_practiced).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  Next review: {(() => {
                    const scheduled = props.tune.scheduled;
                    if (scheduled === null || scheduled === undefined)
                      return "—";

                    const date = new Date(scheduled * 1000);
                    const now = new Date();
                    const diffDays = Math.floor(
                      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    return diffDays === 0 ? "Today" : date.toLocaleDateString();
                  })()}
                </p>
                <p>
                  Interval:{" "}
                  {props.tune.latest_interval
                    ? `${props.tune.latest_interval} days`
                    : "—"}
                </p>
                <p>
                  Repetitions:{" "}
                  {props.tune.latest_repetitions !== null &&
                  props.tune.latest_repetitions !== undefined
                    ? props.tune.latest_repetitions
                    : "—"}
                </p>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
