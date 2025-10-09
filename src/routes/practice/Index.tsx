/**
 * Practice Page (Index)
 *
 * Protected route - main practice interface.
 * Shows user info and provides access to practice sessions.
 *
 * @module routes/practice/Index
 */

import { useNavigate } from "@solidjs/router";
import { type Component, createSignal, Show } from "solid-js";
import {
  PracticeControlBanner,
  PracticeSession,
} from "../../components/practice";
import { TuneList } from "../../components/tunes/TuneList";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import type { Tune } from "../../lib/db/types";

/**
 * Practice Index Page Component
 *
 * Features:
 * - Displays user information
 * - Shows local database status
 * - Provides logout functionality
 * - Placeholder for future practice features
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
  const navigate = useNavigate();
  const { user, localDb } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const [showPracticeSession, setShowPracticeSession] = createSignal(false);

  const handleTuneSelect = (tune: Tune) => {
    navigate(`/tunes/${tune.id}`);
  };

  const handleStartPractice = () => {
    setShowPracticeSession(true);
  };

  const handlePracticeComplete = () => {
    setShowPracticeSession(false);
  };

  return (
    <div>
      {/* Practice Control Banner */}
      <PracticeControlBanner />

      {/* Main Content */}
      <div class="p-6">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome to Practice Mode! 🎶
          </h2>
        </div>

        {/* User Info */}
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
          <h3 class="font-semibold text-blue-900 dark:text-blue-300 mb-2">
            User Information
          </h3>
          <Show when={user()}>
            {(u) => (
              <dl class="space-y-1 text-sm">
                <div class="flex gap-2">
                  <dt class="font-medium text-blue-800 dark:text-blue-400">
                    Email:
                  </dt>
                  <dd class="text-blue-700 dark:text-blue-300">{u().email}</dd>
                </div>
                <div class="flex gap-2">
                  <dt class="font-medium text-blue-800 dark:text-blue-400">
                    User ID:
                  </dt>
                  <dd class="text-blue-700 dark:text-blue-300 font-mono text-xs">
                    {u().id}
                  </dd>
                </div>
                <div class="flex gap-2">
                  <dt class="font-medium text-blue-800 dark:text-blue-400">
                    Name:
                  </dt>
                  <dd class="text-blue-700 dark:text-blue-300">
                    {u().user_metadata?.name || "Not set"}
                  </dd>
                </div>
              </dl>
            )}
          </Show>
        </div>

        {/* Local Database Status */}
        <div class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
          <h3 class="font-semibold text-green-900 dark:text-green-300 mb-2">
            Local Database Status
          </h3>
          <Show
            when={localDb()}
            fallback={
              <p class="text-sm text-green-700 dark:text-green-300">
                ⏳ Initializing local database...
              </p>
            }
          >
            <p class="text-sm text-green-700 dark:text-green-300">
              ✅ Local database initialized and ready
            </p>
            <p class="text-xs text-green-600 dark:text-green-400 mt-1">
              Your data is being synced between local storage and Supabase
            </p>
          </Show>
        </div>

        {/* Practice Section */}
        <Show
          when={!showPracticeSession()}
          fallback={
            <Show when={currentPlaylistId()}>
              {(playlistId) => (
                <PracticeSession
                  playlistId={playlistId()}
                  onComplete={handlePracticeComplete}
                />
              )}
            </Show>
          }
        >
          <div class="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🎯 Ready to Practice?
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Start your practice session with FSRS-powered spaced repetition.
              Your progress is automatically saved and synced.
            </p>
            <div class="flex gap-3">
              <button
                type="button"
                onClick={handleStartPractice}
                class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
              >
                Start Practice Session
              </button>
              <button
                type="button"
                onClick={() => navigate("/practice/history")}
                class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg"
              >
                View Practice History
              </button>
            </div>
          </div>
        </Show>

        {/* Tune Library */}
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📚 Tune Library
          </h3>
          <Show
            when={localDb()}
            fallback={
              <div class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p class="text-gray-600 dark:text-gray-400">
                  Waiting for local database to initialize...
                </p>
              </div>
            }
          >
            <TuneList onTuneSelect={handleTuneSelect} filterByPlaylist={true} />
          </Show>
        </div>
      </div>
    </div>
  );
};

export default PracticeIndex;
