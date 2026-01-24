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
  getRequiredGenreIdsForUser,
  purgeLocalCatalogForGenres,
  upsertUserGenreSelection,
} from "@/lib/db/queries/user-genre-selection";

// Genre with selection status (returned by getGenresWithSelection)
type GenreWithSelection = Genre & { selected: boolean };

const CatalogSyncPage: Component = () => {
  const {
    user,
    localDb,
    forceSyncDown,
    forceSyncUp,
    incrementCatalogListChanged,
  } = useAuth();

  // State
  const [genres, setGenres] = createSignal<GenreWithSelection[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = createSignal<string[]>([]);
  const [originalSelectedIds, setOriginalSelectedIds] = createSignal<string[]>(
    []
  );
  const [requiredGenreIds, setRequiredGenreIds] = createSignal<string[]>([]);

  // UI state
  const [isLoading, setIsLoading] = createSignal(true);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isDirty, setIsDirty] = createSignal(false);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  const normalizeIds = (ids: string[]) => [...ids].sort();
  const idsEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const aSorted = normalizeIds(a);
    const bSorted = normalizeIds(b);
    return aSorted.every((id, index) => id === bSorted[index]);
  };

  // Load genres and current selection
  createEffect(() => {
    const currentUserId = user()?.id;
    const db = localDb();
    if (currentUserId && db) {
      setIsLoading(true);
      Promise.all([
        getGenresWithSelection(db, currentUserId),
        getRequiredGenreIdsForUser(db, currentUserId),
      ])
        .then(([genreList, requiredIds]) => {
          // Sort by name
          genreList.sort((a: GenreWithSelection, b: GenreWithSelection) =>
            (a.name ?? "").localeCompare(b.name ?? "")
          );
          setGenres(genreList);

          const selectedIds = genreList
            .filter((g: GenreWithSelection) => g.selected)
            .map((g: GenreWithSelection) => g.id);
          const combined = Array.from(
            new Set([...selectedIds, ...requiredIds])
          );

          setRequiredGenreIds(requiredIds);
          setSelectedGenreIds(combined);
          setOriginalSelectedIds([...combined]);
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
    const locked = requiredGenreIds();
    const combined = Array.from(new Set([...newIds, ...locked]));
    setSelectedGenreIds(combined);
    setIsDirty(!idsEqual(combined, originalSelectedIds()));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  // Save changes
  const handleSave = async () => {
    const currentUserId = user()?.id;
    const db = localDb();
    if (!currentUserId || !db) {
      setErrorMessage("User not authenticated");
      return;
    }

    const locked = requiredGenreIds();
    const nextSelected = Array.from(
      new Set([...selectedGenreIds(), ...locked])
    );
    if (nextSelected.length === 0) {
      setErrorMessage("Please select at least one genre");
      return;
    }

    const removed = originalSelectedIds().filter(
      (id) => !nextSelected.includes(id)
    );
    const added = nextSelected.filter(
      (id) => !originalSelectedIds().includes(id)
    );

    setIsSubmitting(true);
    try {
      await upsertUserGenreSelection(db, currentUserId, nextSelected);

      if (removed.length > 0) {
        const { tuneIds } = await purgeLocalCatalogForGenres(
          db,
          currentUserId,
          removed
        );
        if (tuneIds.length > 0) {
          incrementCatalogListChanged();
        }
      }

      await forceSyncUp({ allowDeletes: true });

      if (added.length > 0 || removed.length > 0) {
        await forceSyncDown({ full: true });
      }

      setSelectedGenreIds([...nextSelected]);
      setOriginalSelectedIds([...nextSelected]);
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
    <div class="space-y-6">
      {/* Header */}
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
          Catalog & Sync
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Choose which genres are stored offline and synced. Your selected
          genres will be downloaded and synced when you connect to the internet.
          Unselected genres will not be stored locally, reducing data usage.
        </p>
      </div>

      {/* Messages */}
      <Show when={successMessage()}>
        <div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <p class="text-sm text-green-800 dark:text-green-200">
            {successMessage()}
          </p>
        </div>
      </Show>

      <Show when={errorMessage()}>
        <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p class="text-sm text-red-800 dark:text-red-200">{errorMessage()}</p>
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
        <GenreMultiSelect
          genres={genres() as Genre[]}
          selectedGenreIds={selectedGenreIds()}
          onChange={handleSelectionChange}
          searchable={true}
          disabled={isSubmitting()}
          testIdPrefix="settings-genre"
          listContainerClass="h-40"
          density="compact"
          lockedGenreIds={requiredGenreIds()}
          lockedLabel="In repertoire"
        />

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty() || isSubmitting()}
          class="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
          data-testid="settings-genre-save"
        >
          {isSubmitting() ? "Saving..." : "Save Changes"}
        </button>

        {/* Info box */}
      </Show>
    </div>
  );
};

export default CatalogSyncPage;
