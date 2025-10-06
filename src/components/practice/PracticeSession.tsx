/**
 * Practice Session Component
 *
 * Client-side practice session UI with FSRS scheduling.
 * Displays due tunes and rating buttons (Again/Hard/Good/Easy).
 * All operations use local SQLite WASM (no server calls).
 *
 * Features:
 * - Loads due tunes from local SQLite
 * - Rating buttons (Again=1, Hard=2, Good=3, Easy=4)
 * - Progress tracking (tunes practiced today)
 * - ABC notation display (when available)
 * - Offline-first with background sync
 *
 * Replaces legacy practice UI:
 * - legacy/frontend/app/practice/page.tsx (Next.js version)
 * - legacy/frontend/components/PracticeSession.tsx
 *
 * @module components/practice/PracticeSession
 */

import { type Component, createEffect, createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import type { DueTuneEntry } from "../../lib/db/queries/practice";
import { getDueTunes } from "../../lib/db/queries/practice";
import { FSRS_QUALITY_MAP } from "../../lib/scheduling/fsrs-service";
import { recordPracticeRating } from "../../lib/services/practice-recording";

/**
 * Practice Session Component
 *
 * @example
 * ```tsx
 * <PracticeSession playlistId={1} onComplete={() => console.log('Done!')} />
 * ```
 */
export const PracticeSession: Component<{
  playlistId: number;
  onComplete?: () => void;
}> = (props) => {
  const { user, localDb } = useAuth();
  const [dueTunes, setDueTunes] = createSignal<DueTuneEntry[]>([]);
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [practiceCount, setPracticeCount] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);

  // Load due tunes on mount
  createEffect(() => {
    const db = localDb();
    if (!db) return;

    loadDueTunes();
  });

  async function loadDueTunes() {
    const db = localDb();
    if (!db) return;

    try {
      setLoading(true);
      setError(null);

      const tunes = await getDueTunes(db, props.playlistId, new Date(), 7);
      setDueTunes(tunes);
    } catch (err) {
      console.error("Error loading due tunes:", err);
      setError(err instanceof Error ? err.message : "Failed to load due tunes");
    } finally {
      setLoading(false);
    }
  }

  async function handleRating(quality: number) {
    const db = localDb();
    const currentUser = user();
    const currentTune = dueTunes()[currentIndex()];

    if (!db || !currentUser || !currentTune) return;

    try {
      setSubmitting(true);
      setError(null);

      const result = await recordPracticeRating(db, currentUser.id, {
        tuneRef: currentTune.tuneRef,
        playlistRef: props.playlistId,
        quality,
        practiced: new Date(),
        goal: "recall",
      });

      if (!result.success) {
        setError(result.error || "Failed to record practice");
        return;
      }

      // Move to next tune or complete session
      setPracticeCount(practiceCount() + 1);

      if (currentIndex() < dueTunes().length - 1) {
        setCurrentIndex(currentIndex() + 1);
      } else {
        // Session complete
        props.onComplete?.();
      }
    } catch (err) {
      console.error("Error recording practice:", err);
      setError(
        err instanceof Error ? err.message : "Failed to record practice"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const currentTune = () => dueTunes()[currentIndex()];
  const isComplete = () => currentIndex() >= dueTunes().length;
  const progress = () => {
    const total = dueTunes().length;
    if (total === 0) return 0;
    return Math.round((currentIndex() / total) * 100);
  };

  return (
    <div class="w-full max-w-4xl mx-auto">
      {/* Header with Progress */}
      <div class="mb-6">
        <div class="flex justify-between items-center mb-2">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Practice Session
          </h2>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {currentIndex()} / {dueTunes().length} completed
          </div>
        </div>

        {/* Progress Bar */}
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            class="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress()}%` }}
          />
        </div>
      </div>

      {/* Error Message */}
      <Show when={error()}>
        <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-300">{error()}</p>
        </div>
      </Show>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p class="mt-4 text-gray-600 dark:text-gray-400">
            Loading practice queue...
          </p>
        </div>
      </Show>

      {/* No Tunes Due */}
      <Show when={!loading() && dueTunes().length === 0}>
        <div class="text-center py-12 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div class="text-6xl mb-4">🎉</div>
          <h3 class="text-xl font-semibold text-green-900 dark:text-green-300 mb-2">
            All Caught Up!
          </h3>
          <p class="text-green-700 dark:text-green-400">
            No tunes are due for practice right now.
          </p>
          <p class="text-sm text-green-600 dark:text-green-500 mt-2">
            Come back later for your next practice session.
          </p>
        </div>
      </Show>

      {/* Session Complete */}
      <Show when={!loading() && isComplete() && dueTunes().length > 0}>
        <div class="text-center py-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="text-6xl mb-4">✨</div>
          <h3 class="text-xl font-semibold text-blue-900 dark:text-blue-300 mb-2">
            Session Complete!
          </h3>
          <p class="text-blue-700 dark:text-blue-400">
            You practiced {practiceCount()} tune
            {practiceCount() !== 1 ? "s" : ""} today.
          </p>
          <button
            type="button"
            onClick={() => {
              setCurrentIndex(0);
              setPracticeCount(0);
              loadDueTunes();
            }}
            class="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Start Another Session
          </button>
        </div>
      </Show>

      {/* Practice Card */}
      <Show when={!loading() && !isComplete() && currentTune()}>
        {(tune) => (
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            {/* Tune Header */}
            <div class="mb-6">
              <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {tune().title}
              </h3>
              <div class="flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Show when={tune().type}>
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {tune().type}
                  </span>
                </Show>
                <Show when={tune().mode}>
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {tune().mode}
                  </span>
                </Show>
                <Show when={tune().structure}>
                  <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                    {tune().structure}
                  </span>
                </Show>
              </div>
            </div>

            {/* ABC Notation Display */}
            <Show when={tune().tune.incipit}>
              <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  ABC Notation
                </h4>
                <pre class="text-sm text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
                  {tune().tune.incipit}
                </pre>
              </div>
            </Show>

            {/* Scheduling Info */}
            <Show when={tune().schedulingInfo}>
              {(info) => (
                <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    Scheduling Info
                  </h4>
                  <div class="grid grid-cols-2 gap-2 text-xs">
                    <Show when={info().stability !== null}>
                      <div>
                        <span class="text-blue-700 dark:text-blue-400">
                          Stability:{" "}
                        </span>
                        <span class="text-blue-900 dark:text-blue-300 font-mono">
                          {info().stability?.toFixed(2)}
                        </span>
                      </div>
                    </Show>
                    <Show when={info().difficulty !== null}>
                      <div>
                        <span class="text-blue-700 dark:text-blue-400">
                          Difficulty:{" "}
                        </span>
                        <span class="text-blue-900 dark:text-blue-300 font-mono">
                          {info().difficulty?.toFixed(2)}
                        </span>
                      </div>
                    </Show>
                    <Show when={info().state !== null}>
                      <div>
                        <span class="text-blue-700 dark:text-blue-400">
                          State:{" "}
                        </span>
                        <span class="text-blue-900 dark:text-blue-300 font-mono">
                          {
                            ["New", "Learning", "Review", "Relearning"][
                              info().state!
                            ]
                          }
                        </span>
                      </div>
                    </Show>
                    <Show when={info().due}>
                      <div>
                        <span class="text-blue-700 dark:text-blue-400">
                          Due:{" "}
                        </span>
                        <span class="text-blue-900 dark:text-blue-300 font-mono">
                          {new Date(info().due!).toLocaleDateString()}
                        </span>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </Show>

            {/* Rating Buttons */}
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                How well did you recall this tune?
              </h4>

              <div class="grid grid-cols-2 gap-3">
                {/* Again Button */}
                <button
                  type="button"
                  onClick={() => handleRating(FSRS_QUALITY_MAP.AGAIN)}
                  disabled={submitting()}
                  class="p-4 text-left border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <div class="font-semibold text-red-700 dark:text-red-300">
                    Again
                  </div>
                  <div class="text-xs text-red-600 dark:text-red-400 mt-1">
                    Complete failure, restart learning
                  </div>
                </button>

                {/* Hard Button */}
                <button
                  type="button"
                  onClick={() => handleRating(FSRS_QUALITY_MAP.HARD)}
                  disabled={submitting()}
                  class="p-4 text-left border-2 border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <div class="font-semibold text-orange-700 dark:text-orange-300">
                    Hard
                  </div>
                  <div class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Difficult, interval increased slightly
                  </div>
                </button>

                {/* Good Button */}
                <button
                  type="button"
                  onClick={() => handleRating(FSRS_QUALITY_MAP.GOOD)}
                  disabled={submitting()}
                  class="p-4 text-left border-2 border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <div class="font-semibold text-green-700 dark:text-green-300">
                    Good
                  </div>
                  <div class="text-xs text-green-600 dark:text-green-400 mt-1">
                    Correct response, standard interval
                  </div>
                </button>

                {/* Easy Button */}
                <button
                  type="button"
                  onClick={() => handleRating(FSRS_QUALITY_MAP.EASY)}
                  disabled={submitting()}
                  class="p-4 text-left border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <div class="font-semibold text-blue-700 dark:text-blue-300">
                    Easy
                  </div>
                  <div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Very easy, longer interval
                  </div>
                </button>
              </div>
            </div>

            {/* Submitting State */}
            <Show when={submitting()}>
              <div class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Recording practice...
              </div>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
};
