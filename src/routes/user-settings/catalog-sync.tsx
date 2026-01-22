/**
 * Catalog & Sync Settings Page
 *
 * Allows users to manage which genres are downloaded/synced.
 *
 * @module routes/user-settings/catalog-sync
 */

import { type Component, createEffect, createSignal, Show } from "solid-js";
import { type Genre, GenreMultiSelect } from "@/components/genre-selection";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getGenresWithSelection,
  upsertUserGenreSelection,
} from "@/lib/db/queries/user-genre-selection";

const CatalogSyncPage: Component = () => {
  const { user, localDb } = useAuth();

  // State
  const [genres, setGenres] = createSignal<Genre[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = createSignal<string[]>([]);
  const [originalSelectedIds, setOriginalSelectedIds] = createSignal<string[]>(
    []
  );

  // UI state
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  // Load genres and current selection
  createEffect(() => {
    const currentUser = user();
    const db = localDb();
    if (currentUser?.id && db) {
      setIsLoading(true);
      getGenresWithSelection(db, currentUser.id)
        .then((genreList) => {
          // Sort by name
          genreList.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
          setGenres(genreList);

          const selectedIds = genreList
            .filter((g) => g.selected)
            .map((g) => g.id);
          setSelectedGenreIds(selectedIds);
          setOriginalSelectedIds(selectedIds);
        })
        .catch((error) => {
          console.error("Failed to load genres:", error);
          setErrorMessage("Failed to load genres");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  });

  // Track changes
  const handleSelectionChange = (newIds: string[]) => {
    setSelectedGenreIds(newIds);
    setIsDirty(
      JSON.stringify(newIds.sort()) !==
        JSON.stringify(originalSelectedIds().sort())
    );
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Save changes
  const handleSave = async () => {
    if (selectedGenreIds().length === 0) {
      setErrorMessage("Please select at least one genre");
      return;
    }

    const currentUser = user();
    const db = localDb();
    if (!currentUser?.id || !db) {
      setErrorMessage("User not authenticated");
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertUserGenreSelection(db, currentUser.id, selectedGenreIds());
      setOriginalSelectedIds([...selectedGenreIds()]);
      setIsDirty(false);
      setSuccessMessage("Catalog selection saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save selection:", error);
      setErrorMessage("Failed to save genre selection");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="max-w-2xl">
      {/* Header */}
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Catalog & Sync
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-2">
          Choose which genres are stored offline and synced.
        </p>
      </div>

      {/* Messages */}
      <Show when={successMessage()}>
        <div class="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
          ✓ {successMessage()}
        </div>
      </Show>

      <Show when={errorMessage()}>
        <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          ✕ {errorMessage()}
        </div>
      </Show>

      {/* Loading state */}
      <Show
        when={!isLoading()}
        fallback={
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        }
      >
        {/* Genre selection */}
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <GenreMultiSelect
            genres={genres()}
            selectedGenreIds={selectedGenreIds()}
            onChange={handleSelectionChange}
            searchable={true}
            disabled={isSubmitting()}
            testIdPrefix="settings-genre"
          />
        </div>

        {/* Save button */}
        <div class="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty() || isSubmitting()}
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="settings-genre-save"
          >
            {isSubmitting() ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Info box */}
        <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 About genre selection
          </h3>
          <p class="text-sm text-blue-800 dark:text-blue-200">
            Your selected genres will be downloaded and synced when you connect
            to the internet. Unselected genres will not be stored locally,
            reducing data usage.
          </p>
        </div>
      </Show>
    </div>
  );
};

export default CatalogSyncPage;
