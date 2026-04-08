/**
 * Onboarding Overlay Component
 *
 * Displays step-by-step instructions for new users to set up their account.
 * Guides them through creating a repertoire and adding tunes from the catalog.
 *
 * @module components/onboarding/OnboardingOverlay
 */

import { useNavigate } from "@solidjs/router";
import { Info, X } from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  Match,
  Show,
  Switch,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useOnboarding } from "../../lib/context/OnboardingContext";
import {
  STARTER_TEMPLATES,
  getStarterTemplateById,
} from "../../lib/db/starter-repertoire-templates";
import {
  createStarterRepertoire,
  populateStarterRepertoireFromCatalog,
} from "../../lib/services/repertoire-service";
import { type Genre, GenreMultiSelect } from "../genre-selection";
import { RepertoireEditorDialog } from "../repertoires/RepertoireEditorDialog";

/**
 * Onboarding Overlay Component
 *
 * Shows instructional overlays based on the current onboarding step.
 */
export const OnboardingOverlay: Component = () => {
  const {
    needsOnboarding,
    onboardingStep,
    nextStep,
    skipOnboarding,
    setPendingStarter,
    clearPendingStarter,
    pendingStarterRepertoireId,
    pendingStarterTemplateId,
  } = useOnboarding();
  const {
    incrementRepertoireListChanged,
    localDb,
    forceSyncDown,
    remoteSyncDownCompletionVersion,
    user,
    catalogSyncPending,
    triggerCatalogSync,
  } = useAuth();
  const navigate = useNavigate();
  const [showRepertoireDialog, setShowRepertoireDialog] = createSignal(false);
  const [repertoireCreated, setRepertoireCreated] = createSignal(false);
  const [genres, setGenres] = createSignal<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = createSignal<string[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = createSignal(false);
  const [isSavingGenres, setIsSavingGenres] = createSignal(false);
  const [isCreatingStarter, setIsCreatingStarter] = createSignal(false);

  const handleRepertoireCreated = () => {
    setRepertoireCreated(true);
    setShowRepertoireDialog(false);
    // Trigger global repertoire list refresh so TopNav dropdown updates
    incrementRepertoireListChanged();
    // Move to next step: choose genres (don't navigate yet)
    nextStep();
  };

  const handleSkip = () => {
    skipOnboarding();
  };

  /**
   * Handle the user choosing a starter/demo repertoire template.
   * Creates the repertoire immediately and defers tune population to
   * after the catalog sync in the next step.
   */
  const handleStarterChosen = async (templateId: string) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;

    const template = getStarterTemplateById(templateId);
    if (!template) return;

    setIsCreatingStarter(true);
    try {
      const newRepertoire = await createStarterRepertoire(db, userId, template);

      // Store the pending starter so Step 2 can populate it after sync
      setPendingStarter(newRepertoire.repertoireId, template.id);

      // Pre-select the starter's genres for Step 2
      setSelectedGenreIds(template.preselectedGenreIds);

      // Refresh the repertoire dropdown in TopNav
      incrementRepertoireListChanged();

      setRepertoireCreated(true);
      nextStep();
    } catch (error) {
      console.error("Failed to create starter repertoire:", error);
    } finally {
      setIsCreatingStarter(false);
    }
  };

  // Load genres when component mounts or step changes to choose-genres
  createEffect(() => {
    const syncVersion = remoteSyncDownCompletionVersion();
    void syncVersion;

    if (onboardingStep() === "choose-genres" && genres().length === 0) {
      const loadGenres = async () => {
        const db = localDb();
        if (!db || isLoadingGenres()) return;

        const resolvedUserId = user()?.id;
        if (!resolvedUserId) return;

        setIsLoadingGenres(true);
        try {
          const { getGenresWithSelection } = await import(
            "@/lib/db/queries/user-genre-selection"
          );
          const { getUserRepertoires } = await import(
            "@/lib/db/queries/repertoires"
          );

          const genreList = await getGenresWithSelection(db, resolvedUserId);
          // Sort by name
          genreList.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
          setGenres(genreList);

          // If user already made a selection, preserve it; otherwise default to existing selection or all
          if (selectedGenreIds().length === 0) {
            const preselected = genreList
              .filter((g) => g.selected)
              .map((g) => g.id);

            if (preselected.length > 0) {
              setSelectedGenreIds(preselected);
            } else if (genreList.length > 0) {
              const repertoires = await getUserRepertoires(db, resolvedUserId);
              const latest = repertoires[repertoires.length - 1];
              const defaultGenreId = latest?.genreDefault ?? null;

              if (
                defaultGenreId &&
                genreList.some((g) => g.id === defaultGenreId)
              ) {
                setSelectedGenreIds([defaultGenreId]);
              } else {
                setSelectedGenreIds(genreList.map((g) => g.id));
              }
            }
          }
        } catch (error) {
          console.error("Failed to load genres:", error);
        } finally {
          setIsLoadingGenres(false);
        }
      };

      loadGenres();
    }
  });

  const handleSaveGenres = async () => {
    if (selectedGenreIds().length === 0) return;

    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;

    setIsSavingGenres(true);
    try {
      const { upsertUserGenreSelection, purgeLocalCatalogForGenres } =
        await import("@/lib/db/queries/user-genre-selection");

      // Save genre selection
      await upsertUserGenreSelection(db, userId, selectedGenreIds());
      console.log("✅ Genre selection saved");

      // If catalog sync was deferred until onboarding, trigger it now with genre filter
      if (catalogSyncPending()) {
        console.log(
          "🎵 Triggering catalog sync with selected genres:",
          selectedGenreIds()
        );
        await triggerCatalogSync();
      } else {
        // Catalog was already synced (e.g., user changed genres after initial onboarding)
        // Purge deselected genres and re-sync
        console.log("🧹 Purging non-selected catalog tunes...");
        const allGenres = genres().map((g) => g.id);
        const deselectedGenres = allGenres.filter(
          (id) => !selectedGenreIds().includes(id)
        );
        const purgeResult = await purgeLocalCatalogForGenres(
          db,
          userId,
          deselectedGenres
        );
        console.log(
          `✅ Purged ${purgeResult.tuneIds.length} tunes from deselected genres`
        );

        void forceSyncDown({ full: true }).catch((error) => {
          console.warn(
            "Failed to refresh catalog after genre selection:",
            error
          );
        });
      }

      // If the user picked a starter repertoire in Step 1, populate it now
      // that the catalog has synced and tunes are available locally.
      const starterRepertoireId = pendingStarterRepertoireId();
      const starterTemplateId = pendingStarterTemplateId();
      if (starterRepertoireId && starterTemplateId) {
        const template = getStarterTemplateById(starterTemplateId);
        if (template) {
          console.log(
            `🎵 Populating starter repertoire "${starterRepertoireId}" from template "${starterTemplateId}"`
          );
          try {
            const result = await populateStarterRepertoireFromCatalog(
              db,
              userId,
              starterRepertoireId,
              template
            );
            console.log(
              `✅ Added ${result.added} tunes to starter repertoire (${result.skipped} already present)`
            );
          } catch (popErr) {
            // Non-fatal: user can add tunes manually from catalog
            console.warn(
              "Failed to auto-populate starter repertoire tunes:",
              popErr
            );
          }
        }
        clearPendingStarter();
      }

      nextStep();
      navigate("/?tab=catalog");
    } catch (error) {
      console.error("Failed to save genre selection:", error);
    } finally {
      setIsSavingGenres(false);
    }
  };

  return (
    <>
      {/* Repertoire Editor Dialog */}
      <Show when={showRepertoireDialog()}>
        <RepertoireEditorDialog
          isOpen={showRepertoireDialog()}
          onClose={() => {
            setShowRepertoireDialog(false);
            if (!repertoireCreated()) {
              skipOnboarding(); // If they close without creating, skip onboarding
            }
          }}
          onSaved={handleRepertoireCreated}
        />
      </Show>

      {/* Onboarding Overlays */}
      <Show when={needsOnboarding()}>
        <Switch>
          {/* Step 1: Choose starter or create custom repertoire */}
          <Match when={onboardingStep() === "create-repertoire"}>
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
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
                    Get started with a pre-populated demo repertoire, or create
                    your own from scratch.
                  </p>

                  {/* Starter repertoire cards */}
                  <div class="space-y-3">
                    <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Demo Repertoires
                    </h3>

                    <For each={STARTER_TEMPLATES}>
                      {(template) => (
                        <button
                          type="button"
                          onClick={() => handleStarterChosen(template.id)}
                          disabled={isCreatingStarter()}
                          data-testid={`onboarding-starter-${template.id}`}
                          class="w-full text-left border border-blue-200 dark:border-blue-700 rounded-lg p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <div class="flex items-start gap-3">
                            <span class="text-2xl leading-none mt-0.5" aria-hidden="true">
                              {template.emoji}
                            </span>
                            <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-semibold text-gray-900 dark:text-white text-sm">
                                  {template.name}
                                </span>
                                <span class="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  ~{template.estimatedTuneCount} tunes
                                </span>
                              </div>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                {template.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>

                  {/* Divider */}
                  <div class="flex items-center gap-3">
                    <div class="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
                    <span class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      or
                    </span>
                    <div class="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
                  </div>

                  {/* Custom repertoire + skip */}
                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSkip}
                      class="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-md transition-colors text-sm"
                    >
                      Skip Tour
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRepertoireCreated(false);
                        setShowRepertoireDialog(true);
                      }}
                      disabled={isCreatingStarter()}
                      class="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      data-testid="onboarding-create-repertoire"
                    >
                      Create Custom
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Match>

          {/* Step 2: Choose Genres */}
          <Match when={onboardingStep() === "choose-genres"}>
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <Info class="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                      Choose additional genres to download 🎵
                    </h2>
                  </div>
                </div>

                <div class="space-y-4">
                  <p class="text-gray-600 dark:text-gray-300 text-sm">
                    Select the genres you want available offline. You can change
                    this later in Settings.
                  </p>

                  {/* Genre multi-select component */}
                  <Show
                    when={!isLoadingGenres()}
                    fallback={
                      <div class="flex items-center justify-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    }
                  >
                    <GenreMultiSelect
                      genres={genres()}
                      selectedGenreIds={selectedGenreIds()}
                      onChange={setSelectedGenreIds}
                      searchable={true}
                      disabled={isSavingGenres()}
                      autoScrollToSelected={true}
                      testIdPrefix="onboarding-genre"
                    />
                  </Show>

                  <div class="flex gap-3">
                    <button
                      type="button"
                      onClick={handleSaveGenres}
                      disabled={
                        isSavingGenres() || selectedGenreIds().length === 0
                      }
                      class="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="onboarding-genre-continue"
                    >
                      {isSavingGenres() ? "Saving..." : "Continue"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Match>

          {/* Step 3: View Catalog */}
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
