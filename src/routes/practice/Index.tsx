/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface with grid view.
 * Clean layout with sticky control banner and practice queue grid.
 *
 * @module routes/practice/Index
 */

import {
  type Component,
  createEffect,
  createSignal,
  onMount,
  Show,
} from "solid-js";
import { TunesGridScheduled } from "../../components/grids";
import { GRID_CONTENT_CONTAINER } from "../../components/grids/shared-toolbar-styles";
import { PracticeControlBanner } from "../../components/practice";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import type { RecordPracticeInput } from "../../lib/db/types";
import { FSRS_QUALITY_MAP } from "../../lib/scheduling/fsrs-service";
import { batchRecordPracticeRatings } from "../../lib/services/practice-recording";

/**
 * Practice Index Page Component
 *
 * Features:
 * - Sticky control banner with actions
 * - TunesGridScheduled with embedded evaluation controls
 * - Shows due tunes based on practice queue
 *
 * @example
 * ```tsx
 * <Route path="/practice" component={() => (
 *   <ProtectedRoute>
 *     <PracticeIndex />
 *   </ProtectedRoute>
 * )} />
 * ```
 */
const PracticeIndex: Component = () => {
  const { user, localDb } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Track evaluations count and table instance for toolbar
  const [evaluationsCount, setEvaluationsCount] = createSignal(0);

  // Display Submitted state - persisted to localStorage
  const STORAGE_KEY = "TT_PRACTICE_SHOW_SUBMITTED";
  const [showSubmitted, setShowSubmitted] = createSignal(false);

  // Load showSubmitted from localStorage on mount
  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setShowSubmitted(stored === "true");
    }
  });

  // Persist showSubmitted to localStorage on change
  createEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showSubmitted()));
  });

  const [tableInstance, setTableInstance] = createSignal<any>(null);

  // Callback from grid to clear evaluations after submit
  let clearEvaluationsCallback: (() => void) | undefined;
  const setClearEvaluationsCallback = (callback: () => void) => {
    clearEvaluationsCallback = callback;
  };

  // Handle recall evaluation changes
  const handleRecallEvalChange = (tuneId: number, evaluation: string) => {
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);
    // Evaluation is staged locally in grid component state
    // Will be submitted in batch by handleSubmitEvaluations()
  };

  // Handle goal changes
  const handleGoalChange = (tuneId: number, goal: string | null) => {
    console.log(`Goal for tune ${tuneId}: ${goal}`);
    // TODO: Update goal in local DB immediately
    // TODO: Queue sync to Supabase
  };

  // Handle submit evaluations
  const handleSubmitEvaluations = async () => {
    const db = localDb();
    const userId = user()?.id;
    const playlistId = currentPlaylistId();
    const table = tableInstance();

    if (!db || !userId || !playlistId || !table) {
      console.error("Missing required data for submit");
      return;
    }

    console.log(`Submitting ${evaluationsCount()} practice evaluations`);

    try {
      // Get all rows from table
      const rows = table.getRowModel().rows;
      const practiceInputs: RecordPracticeInput[] = [];
      const practiceDate = new Date();

      // Collect evaluations from rows
      for (const row of rows) {
        const tune = row.original;
        const recallEval = tune.recall_eval;

        if (!recallEval || recallEval === "") {
          continue; // Skip tunes without evaluations
        }

        // Map evaluation string to FSRS quality number
        let quality: number;
        switch (recallEval.toLowerCase()) {
          case "again":
            quality = FSRS_QUALITY_MAP.AGAIN; // 1
            break;
          case "hard":
            quality = FSRS_QUALITY_MAP.HARD; // 2
            break;
          case "good":
            quality = FSRS_QUALITY_MAP.GOOD; // 3
            break;
          case "easy":
            quality = FSRS_QUALITY_MAP.EASY; // 4
            break;
          default:
            console.warn(
              `Unknown evaluation: ${recallEval} for tune ${tune.tune_id}`
            );
            continue;
        }

        practiceInputs.push({
          tuneRef: tune.tune_id,
          playlistRef: playlistId,
          quality,
          practiced: practiceDate,
          goal: tune.goal || "recall",
          technique: undefined,
        });
      }

      if (practiceInputs.length === 0) {
        console.warn("No evaluations to submit");
        return;
      }

      // Submit all practice ratings using batch service
      const results = await batchRecordPracticeRatings(
        db,
        userId,
        practiceInputs
      );

      // Count successes
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      console.log(
        `Submit complete: ${successCount} succeeded, ${failCount} failed`
      );

      if (failCount > 0) {
        console.error(
          "Some submissions failed:",
          results.filter((r) => !r.success)
        );
      }

      // Clear evaluations in grid
      if (clearEvaluationsCallback) {
        clearEvaluationsCallback();
      }

      // Reset count
      setEvaluationsCount(0);

      // Grid will automatically refresh when syncVersion increments
      // (happens when background sync completes)
    } catch (error) {
      console.error("Error submitting practice evaluations:", error);
    }
  };

  return (
    <div class="h-full flex flex-col">
      {/* Sticky Control Banner */}
      <PracticeControlBanner
        evaluationsCount={evaluationsCount()}
        onSubmitEvaluations={handleSubmitEvaluations}
        showSubmitted={showSubmitted()}
        onShowSubmittedChange={setShowSubmitted}
        table={tableInstance()}
      />

      {/* Main Content Area - Grid fills remaining space */}
      <div class={GRID_CONTENT_CONTAINER}>
        <Show
          when={user() && localDb() && currentPlaylistId()}
          fallback={
            <div class="flex items-center justify-center h-full">
              <p class="text-gray-500 dark:text-gray-400">
                Loading practice queue...
              </p>
            </div>
          }
        >
          {/* Use a derivation to get the stable number value */}
          <Show when={currentPlaylistId()}>
            {(playlistId) => (
              <TunesGridScheduled
                userId={1} // TODO: Get actual user ID from user_profile
                playlistId={playlistId()}
                tablePurpose="scheduled"
                onRecallEvalChange={handleRecallEvalChange}
                onGoalChange={handleGoalChange}
                onEvaluationsCountChange={setEvaluationsCount}
                onTableInstanceChange={setTableInstance}
                onClearEvaluationsReady={setClearEvaluationsCallback}
                showSubmitted={showSubmitted()}
              />
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default PracticeIndex;
