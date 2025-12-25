/**
 * Onboarding Overlay Component
 *
 * Displays step-by-step instructions for new users to set up their account.
 * Guides them through creating a playlist and adding tunes from the catalog.
 *
 * @module components/onboarding/OnboardingOverlay
 */

import { useNavigate } from "@solidjs/router";
import { Info, X } from "lucide-solid";
import { type Component, createSignal, Match, Show, Switch } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useOnboarding } from "../../lib/context/OnboardingContext";
import { PlaylistEditorDialog } from "../playlists/PlaylistEditorDialog";

/**
 * Onboarding Overlay Component
 *
 * Shows instructional overlays based on the current onboarding step.
 */
export const OnboardingOverlay: Component = () => {
  const { needsOnboarding, onboardingStep, nextStep, skipOnboarding } =
    useOnboarding();
  const { incrementRepertoireListChanged } = useAuth();
  const navigate = useNavigate();
  const [showPlaylistDialog, setShowPlaylistDialog] = createSignal(false);

  const handlePlaylistCreated = () => {
    setShowPlaylistDialog(false);
    // Trigger global playlist list refresh so TopNav dropdown updates
    incrementRepertoireListChanged();
    // Move to next step: view catalog
    nextStep();
    navigate("/?tab=catalog");
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  return (
    <>
      {/* Playlist Editor Dialog */}
      <Show when={showPlaylistDialog()}>
        <PlaylistEditorDialog
          isOpen={showPlaylistDialog()}
          onClose={() => {
            setShowPlaylistDialog(false);
            skipOnboarding(); // If they close without creating, skip onboarding
          }}
          onSaved={handlePlaylistCreated}
        />
      </Show>

      {/* Onboarding Overlays */}
      <Show when={needsOnboarding()}>
        <Switch>
          {/* Step 1: Create Playlist */}
          <Match when={onboardingStep() === "create-playlist"}>
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <Info class="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                      Welcome to TuneTrees! 🎵
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleSkip}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Skip tour"
                  >
                    <X class="w-5 h-5" />
                  </button>
                </div>

                <div class="space-y-4">
                  <p class="text-gray-600 dark:text-gray-300">
                    Let's get you started! First, create a repertoire to
                    organize tunes.
                  </p>

                  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                    <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      What's a repertoire?
                    </h3>
                    <p class="text-sm text-blue-800 dark:text-blue-200">
                      A repertoire provides the context for specific
                      instruments, genres, or practice goals. You can manage
                      multiple repertoires or maintain a single one.
                    </p>
                  </div>

                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSkip}
                      class="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md transition-colors"
                    >
                      Skip Tour
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPlaylistDialog(true)}
                      class="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                      data-testid="onboarding-create-repertoire"
                    >
                      Create Repertoire
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Match>

          {/* Step 2: View Catalog */}
          <Match when={onboardingStep() === "view-catalog"}>
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                      <Info class="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                      Great! Now let's add some tunes 🎶
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleSkip}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Skip tour"
                  >
                    <X class="w-5 h-5" />
                  </button>
                </div>

                <div class="space-y-4">
                  <p class="text-gray-600 dark:text-gray-300">
                    You're now viewing the <strong>Catalog tab</strong>. This is
                    where you'll find all available tunes.
                  </p>

                  <div class="space-y-3">
                    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                      <h3 class="font-semibold text-green-900 dark:text-green-100 mb-2">
                        📚 Browse the catalog
                      </h3>
                      <p class="text-sm text-green-800 dark:text-green-200">
                        Use the search and filters to find tunes you want to
                        learn.
                      </p>
                    </div>

                    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                      <h3 class="font-semibold text-green-900 dark:text-green-100 mb-2">
                        ➕ Add to Repertoire
                      </h3>
                      <p class="text-sm text-green-800 dark:text-green-200">
                        Click on a tune and use the{" "}
                        <strong>"Add to Repertoire"</strong> button to add it to
                        the current repertoire.
                      </p>
                    </div>

                    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                      <h3 class="font-semibold text-green-900 dark:text-green-100 mb-2">
                        🎯 Practice tab
                      </h3>
                      <p class="text-sm text-green-800 dark:text-green-200">
                        Once you've added tunes, visit the{" "}
                        <strong>Practice tab</strong> to start your practice
                        session!
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSkip}
                    class="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </Match>
        </Switch>
      </Show>
    </>
  );
};
