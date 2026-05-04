/**
 * Onboarding Overlay Component
 *
 * Displays the modal steps for the new-user onboarding flow after a starter
 * repertoire has been chosen or a custom repertoire created.
 *
 * Step 1 ("create-repertoire") is now embedded inline in the
 * RepertoireEmptyState panel; this component handles only Steps 2 and 3.
 *
 * @module components/onboarding/OnboardingOverlay
 */

import { useNavigate } from "@solidjs/router";
import { Info, X } from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../../lib/context/CurrentRepertoireContext";
import { useOnboarding } from "../../lib/context/OnboardingContext";
import { getStarterTemplateById } from "../../lib/db/starter-repertoire-templates";
import { generateOrGetPracticeQueue } from "../../lib/services/practice-queue";
import {
  createStarterRepertoire,
  populateStarterRepertoireFromCatalog,
  setSelectedRepertoireId,
} from "../../lib/services/repertoire-service";
import { getPracticeDate } from "../../lib/utils/practice-date";
import { type Genre, GenreMultiSelect } from "../genre-selection";
import { Button } from "../ui/button";

/**
 * Onboarding Overlay Component
 *
 * Shows instructional overlays for Steps 2 ("choose-genres") and 3 ("view-catalog").
 * Triggered after the user picks or creates a repertoire from the empty-state panel.
 */
export const OnboardingOverlay: Component = () => {
  const {
    needsOnboarding,
    onboardingStep,
    nextStep,
    skipOnboarding,
    dismissGenreDialog,
    clearPendingStarter,
    pendingStarterRepertoireId,
    pendingStarterTemplateId,
    chosenStarterTemplateId,
    setChosenStarterTemplateId,
    setPendingStarter,
  } = useOnboarding();
  const {
    localDb,
    forceSyncDown,
    forceSyncUp,
    remoteSyncDownCompletionVersion,
    user,
    userIdInt,
    incrementPracticeListStagedChanged,
    incrementRepertoireListChanged,
    catalogSyncPending,
    triggerCatalogSync,
  } = useAuth();
  const { setCurrentRepertoireId } = useCurrentRepertoire();
  const navigate = useNavigate();
  const [genres, setGenres] = createSignal<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = createSignal<string[]>([]);
  const [isLoadingGenres, setIsLoadingGenres] = createSignal(false);
  const [isSavingGenres, setIsSavingGenres] = createSignal(false);
  /**
   * Shown in Step 2 when tune auto-population failed (non-fatal —
   * user can still add tunes manually from the catalog).
   */
  const [populationWarning, setPopulationWarning] = createSignal<string | null>(
    null
  );
  /** Non-fatal error shown in the dialog when repertoire creation fails. */
  const [creationError, setCreationError] = createSignal<string | null>(null);

  /**
   * Genre IDs that must be selected because the chosen starter template
   * requires them. Derived reactively so it always matches the current template
   * even when the user switches between starter cards.
   */
  const starterLockedGenreIds = () => {
    const id = chosenStarterTemplateId();
    if (!id) return [];
    return getStarterTemplateById(id)?.preselectedGenreIds ?? [];
  };

  /**
   * The selection that GenreMultiSelect actually renders: user-chosen ids
   * merged with the locked (starter-required) ids. This guarantees locked
   * genres are always shown checked regardless of async load timing.
   */
  const effectiveSelectedGenreIds = () =>
    Array.from(new Set([...selectedGenreIds(), ...starterLockedGenreIds()]));

  /**
   * Cancel: close the genre dialog without creating anything. The user goes
   * back to the starter-picker panel so they can try again or choose a
   * different option. Does NOT mark onboarding as skipped/completed.
   *
   * Also resets local genre state so the next dialog open always starts
   * completely fresh, regardless of which template was previously viewed.
   */
  const handleCancel = () => {
    // Reset local state BEFORE dismissing so the signals are clean if the
    // component re-enters "choose-genres" for a different template.
    setSelectedGenreIds([]);
    setGenres([]);
    setCreationError(null);
    setPopulationWarning(null);
    dismissGenreDialog();
  };

  /**
   * Skip / finish the Step 3 "view-catalog" tour: mark onboarding done.
   * The repertoire already exists at this point so persisting the skip flag
   * is correct and intentional.
   */
  const handleSkip = () => {
    skipOnboarding();
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

          const genreList = await getGenresWithSelection(db, resolvedUserId);
          // Sort by name
          genreList.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
          setGenres(genreList);
          // selectedGenreIds is deliberately left empty here.
          // Locked (starter-required) genres are merged in reactively via
          // effectiveSelectedGenreIds below, so they always appear checked.
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
    // Snapshot the effective selection NOW — before any signal mutations.
    // effectiveSelectedGenreIds() merges selectedGenreIds with the locked
    // starter genres derived from chosenStarterTemplateId(). Clearing
    // chosenStarterTemplateId later in Step A would drop those locked genres
    // from a reactive re-call, causing an empty genre save and empty sync.
    const genreIdsToSave = effectiveSelectedGenreIds();
    if (genreIdsToSave.length === 0) return;

    const db = localDb();
    const userId = user()?.id;
    // userIdInt is the UUID from user_profile.id (matched against authUserId),
    // used for DB ownership checks. Falls back to the auth user id.
    const userIntId = userIdInt() ?? userId;
    if (!db || !userId) return;

    setCreationError(null);
    setIsSavingGenres(true);
    try {
      // ── Step A: Create the starter repertoire if it was only chosen (not yet created) ──
      // When the user clicks a starter card, we just open this dialog; the
      // actual DB row is created here so that Cancel truly cancels everything.
      const templateId = chosenStarterTemplateId();
      if (templateId && !pendingStarterRepertoireId()) {
        const template = getStarterTemplateById(templateId);
        if (!template || !userIntId) {
          setCreationError(
            "Could not find starter template. Please try again."
          );
          return;
        }
        try {
          const newRepertoire = await createStarterRepertoire(
            db,
            userIntId,
            template
          );
          setCurrentRepertoireId(newRepertoire.repertoireId);
          setSelectedRepertoireId(userId, newRepertoire.repertoireId);
          // Store for genre-step population (Step B below)
          setPendingStarter(newRepertoire.repertoireId, template.id);
          // Reflect new repertoire in the top-nav dropdown
          incrementRepertoireListChanged();
          // Clear the pre-creation placeholder — safe now because we already
          // snapshotted genreIdsToSave above before this mutation.
          setChosenStarterTemplateId(null);
          console.log(
            `✅ Created starter repertoire "${newRepertoire.repertoireId}"`
          );
        } catch (createError) {
          console.error("Failed to create starter repertoire:", createError);
          setCreationError(
            "Could not create the starter repertoire. Please try again or choose Create Custom Repertoire."
          );
          return;
        }
      }

      const { upsertUserGenreSelection, purgeLocalCatalogForGenres } =
        await import("@/lib/db/queries/user-genre-selection");

      // Save genre selection — uses the snapshot captured before Step A mutations
      await upsertUserGenreSelection(db, userId, genreIdsToSave);
      console.log("✅ Genre selection saved:", genreIdsToSave);

      // If catalog sync was deferred until onboarding, trigger it now with genre filter
      if (catalogSyncPending()) {
        console.log(
          "🎵 Triggering catalog sync with selected genres:",
          genreIdsToSave
        );
        await triggerCatalogSync();
      } else {
        // Catalog was already synced (e.g., user changed genres after initial onboarding)
        // Purge deselected genres and re-sync
        console.log("🧹 Purging non-selected catalog tunes...");
        const allGenres = genres().map((g) => g.id);
        const deselectedGenres = allGenres.filter(
          (id) => !genreIdsToSave.includes(id)
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
            if (result.added > 0 || result.skipped > 0) {
              await generateOrGetPracticeQueue(
                db,
                userId,
                starterRepertoireId,
                getPracticeDate(),
                null,
                "per_day",
                true
              );
              await forceSyncUp();
              incrementPracticeListStagedChanged();
            }
            if (result.added === 0 && result.skipped === 0) {
              // Catalog may not have synced tunes yet; user can add from catalog manually
              setPopulationWarning(
                `No matching tunes were found in the catalog for "${template.name}". ` +
                  "You can add tunes manually from the Catalog tab."
              );
            }
          } catch (popErr) {
            // Non-fatal: user can add tunes manually from catalog
            console.warn(
              "Failed to auto-populate starter repertoire tunes:",
              popErr
            );
            setPopulationWarning(
              `Could not auto-populate tunes for "${template.name}". ` +
                "You can add tunes manually from the Catalog tab."
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
      {/* Onboarding Overlays — Steps 2 and 3 only.
          Step 1 (starter-repertoire picker) is embedded inline in the
          RepertoireEmptyState panel rendered by each tab (Practice, Repertoire). */}
      <Show when={needsOnboarding()}>
        <Switch>
          {/* Step 2: Choose Genres */}
          <Match when={onboardingStep() === "choose-genres"}>
            <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div class="p-6 pb-0">
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
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
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
                      selectedGenreIds={effectiveSelectedGenreIds()}
                      onChange={setSelectedGenreIds}
                      searchable={true}
                      disabled={isSavingGenres()}
                      autoScrollToSelected={true}
                      testIdPrefix="onboarding-genre"
                      listContainerClass="max-h-[min(42vh,20rem)]"
                      lockedGenreIds={starterLockedGenreIds()}
                      lockedLabel="Required for starter"
                    />
                  </Show>

                  {/* Repertoire creation error (non-fatal — shown if creation fails on Continue) */}
                  <Show when={creationError()}>
                    <output class="block text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md px-3 py-2">
                      {creationError()}
                    </output>
                  </Show>

                  {/* Tune population warning (shown after save if auto-populate failed) */}
                  <Show when={populationWarning()}>
                    <output class="block text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md px-3 py-2">
                      {populationWarning()}
                    </output>
                  </Show>
                </div>

                <div class="shrink-0 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
                  <div class="flex w-full justify-between gap-3">
                    <Button
                      type="button"
                      onClick={handleCancel}
                      disabled={isSavingGenres()}
                      variant="outline"
                      class="min-h-11"
                      data-testid="onboarding-genre-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveGenres}
                      disabled={
                        isSavingGenres() ||
                        effectiveSelectedGenreIds().length === 0
                      }
                      variant="default"
                      class="min-h-11"
                      data-testid="onboarding-genre-continue"
                    >
                      {isSavingGenres() ? "Saving..." : "Continue"}
                    </Button>
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
