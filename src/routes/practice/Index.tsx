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
import { toast } from "solid-sonner";
import { TunesGridScheduled } from "../../components/grids";
import { GRID_CONTENT_CONTAINER } from "../../components/grids/shared-toolbar-styles";
import { PracticeControlBanner } from "../../components/practice";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { addTunesToQueue } from "../../lib/services/practice-queue";
import { commitStagedEvaluations } from "../../lib/services/practice-recording";

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
  const { user, localDb, incrementSyncVersion } = useAuth();
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
    const playlistId = currentPlaylistId();

    if (!db || !playlistId) {
      console.error("Missing required data for submit");
      toast.error("Cannot submit: Missing database or playlist data");
      return;
    }

    // TODO: Get actual user ID from user_profile table
    // For now, using hardcoded user ID 1 (same as grid)
    const userId = 1;

    const count = evaluationsCount();
    if (count === 0) {
      toast.warning("No evaluations to submit");
      return;
    }

    console.log(
      `Submitting ${count} staged evaluations for playlist ${playlistId}`
    );

    try {
      // Call new commit service
      const result = await commitStagedEvaluations(db, userId, playlistId);

      if (result.success) {
        // Success toast (auto-dismiss after 3 seconds)
        toast.success(
          `Successfully submitted ${result.count} evaluation${
            result.count !== 1 ? "s" : ""
          }`,
          {
            duration: 3000,
          }
        );

        // Clear evaluations in grid
        if (clearEvaluationsCallback) {
          clearEvaluationsCallback();
        }

        // Reset count
        setEvaluationsCount(0);

        console.log(
          `✅ Submit complete: ${result.count} evaluations committed`
        );
      } else {
        // Error toast (requires manual dismiss)
        toast.error(
          `Failed to submit evaluations: ${result.error || "Unknown error"}`,
          {
            duration: Number.POSITIVE_INFINITY, // Requires manual dismiss
          }
        );

        console.error("Submit failed:", result.error);
      }
    } catch (error) {
      // Unexpected error toast
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error during submit: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });

      console.error("Error submitting evaluations:", error);
    }
  };

  // Handle add tunes to queue
  const handleAddTunes = async (count: number) => {
    const db = localDb();
    const playlistId = currentPlaylistId();

    if (!db || !playlistId) {
      console.error("Missing required data for add tunes");
      toast.error("Cannot add tunes: Missing database or playlist data");
      return;
    }

    // TODO: Get actual user ID from user_profile table
    // For now, using hardcoded user ID 1 (same as grid)
    const userId = 1;

    console.log(
      `Adding ${count} tunes to practice queue for playlist ${playlistId}`
    );

    try {
      const added = await addTunesToQueue(db, userId, playlistId, count);

      if (added.length > 0) {
        toast.success(
          `Added ${added.length} tune${added.length !== 1 ? "s" : ""} to queue`,
          {
            duration: 3000,
          }
        );

        // Trigger grid refresh
        incrementSyncVersion();

        console.log(`✅ Added ${added.length} tunes to queue`);
      } else {
        toast.warning("No additional tunes available to add");
        console.log("⚠️ No tunes added - backlog may be empty");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Error adding tunes: ${errorMessage}`, {
        duration: Number.POSITIVE_INFINITY,
      });

      console.error("Error adding tunes to queue:", error);
    }
  };

  return (
    <div class="h-full flex flex-col">
      {/* Sticky Control Banner */}
      <PracticeControlBanner
        evaluationsCount={evaluationsCount()}
        onSubmitEvaluations={handleSubmitEvaluations}
        onAddTunes={handleAddTunes}
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
