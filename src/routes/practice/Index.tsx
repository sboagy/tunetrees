/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface.
 * Clean layout with sticky control banner and practice session area.
 *
 * @module routes/practice/Index
 */

import { type Component, createSignal, Show } from "solid-js";
import {
  PracticeControlBanner,
  PracticeSession,
} from "../../components/practice";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";

/**
 * Practice Index Page Component
 *
 * Features:
 * - Sticky control banner with actions
 * - Practice session area
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
  const { currentPlaylistId } = useCurrentPlaylist();
  const [showPracticeSession, setShowPracticeSession] = createSignal(false);

  const handlePracticeComplete = () => {
    setShowPracticeSession(false);
  };

  return (
    <div class="h-full flex flex-col">
      {/* Sticky Control Banner */}
      <PracticeControlBanner />

      {/* Main Content Area */}
      <div class="flex-1 overflow-auto">
        <Show when={showPracticeSession()}>
          <Show when={currentPlaylistId()}>
            {(playlistId) => (
              <PracticeSession
                playlistId={playlistId()}
                onComplete={handlePracticeComplete}
              />
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
};

export default PracticeIndex;
