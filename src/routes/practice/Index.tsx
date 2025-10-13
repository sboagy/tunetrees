/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface with grid view.
 * Clean layout with sticky control banner and practice queue grid.
 *
 * @module routes/practice/Index
 */

import { type Component, createSignal, Show } from "solid-js";
import { TunesGridScheduled } from "../../components/grids";
import { GRID_CONTENT_CONTAINER } from "../../components/grids/shared-toolbar-styles";
import { PracticeControlBanner } from "../../components/practice";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";

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
  const [showSubmitted, setShowSubmitted] = createSignal(false);
  const [tableInstance, setTableInstance] = createSignal<any>(null);

  // Handle recall evaluation changes
  const handleRecallEvalChange = (tuneId: number, evaluation: string) => {
    console.log(`Recall evaluation for tune ${tuneId}: ${evaluation}`);
    // TODO: Stage feedback locally
    // TODO: Update practice record
    // TODO: Queue sync to Supabase
  };

  // Handle goal changes
  const handleGoalChange = (tuneId: number, goal: string | null) => {
    console.log(`Goal for tune ${tuneId}: ${goal}`);
    // TODO: Update goal in local DB
    // TODO: Queue sync to Supabase
  };

  // Handle submit evaluations
  const handleSubmitEvaluations = () => {
    console.log(`Submitting ${evaluationsCount()} practice evaluations`);
    // TODO: Submit staged evaluations to database
    // TODO: Clear evaluations after submit
    setEvaluationsCount(0);
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
              />
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default PracticeIndex;
