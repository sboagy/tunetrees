/**
 * Genre Multi-Select Component
 *
 * Reusable component for selecting multiple genres with search and select-all/clear-all functionality.
 * Used by both onboarding and settings pages.
 *
 * @module components/genre-selection/GenreMultiSelect
 */

import { Search, X } from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  Show,
} from "solid-js";

export interface Genre {
  id: string;
  name: string | null;
  region: string | null;
  description: string | null;
}

interface GenreMultiSelectProps {
  genres: Genre[];
  selectedGenreIds: string[];
  onChange: (genreIds: string[]) => void;
  searchable?: boolean;
  disabled?: boolean;
  testIdPrefix?: string;
  autoScrollToSelected?: boolean;
}

/**
 * Genre Multi-Select Component
 *
 * Renders checkboxes for each genre with optional search functionality.
 */
export const GenreMultiSelect: Component<GenreMultiSelectProps> = (props) => {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [hasAutoScrolled, setHasAutoScrolled] = createSignal(false);
  const itemRefs = new Map<string, HTMLLabelElement>();

  // Filter genres based on search query
  const filteredGenres = () => {
    const query = searchQuery().toLowerCase();
    if (!query) return props.genres;
    return props.genres.filter((g) => {
      const name = (g.name ?? "").toLowerCase();
      const id = g.id.toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  };

  // Handle checkbox change
  const handleGenreChange = (genreId: string) => {
    const newSelection = props.selectedGenreIds.includes(genreId)
      ? props.selectedGenreIds.filter((id) => id !== genreId)
      : [...props.selectedGenreIds, genreId];
    props.onChange(newSelection);
  };

  // Handle select all
  const handleSelectAll = () => {
    const filteredIds = filteredGenres().map((g) => g.id);
    const combined = Array.from(
      new Set([...props.selectedGenreIds, ...filteredIds])
    );
    props.onChange(combined);
  };

  // Handle clear all
  const handleClearAll = () => {
    const filteredIds = new Set(filteredGenres().map((g) => g.id));
    const newSelection = props.selectedGenreIds.filter(
      (id) => !filteredIds.has(id)
    );
    props.onChange(newSelection);
  };

  // Check if all filtered genres are selected
  const allFiltered = () => {
    const filteredIds = filteredGenres().map((g) => g.id);
    return (
      filteredIds.length > 0 &&
      filteredIds.every((id) => props.selectedGenreIds.includes(id))
    );
  };

  createEffect(() => {
    if (!props.autoScrollToSelected) return;
    if (hasAutoScrolled()) return;
    if (searchQuery()) return;

    const selectedIds = props.selectedGenreIds;
    if (selectedIds.length === 0) return;

    const filtered = filteredGenres();
    if (filtered.length === 0) return;

    const target = filtered.find((g) => selectedIds.includes(g.id));
    if (!target) return;

    const runScroll = () => {
      const el = itemRefs.get(target.id);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      setHasAutoScrolled(true);
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(runScroll);
    } else {
      runScroll();
    }
  });

  // Check if some (but not all) filtered genres are selected
  // (currently unused but kept for potential future UI enhancements)
  // const _someFiltered = () => {
  //   const filteredIds = filteredGenres().map((g) => g.id);
  //   return (
  //     filteredIds.length > 0 &&
  //     filteredIds.some((id) => props.selectedGenreIds.includes(id)) &&
  //     !allFiltered()
  //   );
  // };

  return (
    <div class="space-y-4" data-testid={props.testIdPrefix}>
      {/* Search input (if enabled) */}
      <Show when={props.searchable !== false}>
        <div class="relative">
          <Search class="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search genres..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            disabled={props.disabled}
            class="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            data-testid={`${props.testIdPrefix || "genre-multiselect"}-search`}
          />
          <Show when={searchQuery()}>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              class="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X class="w-4 h-4" />
            </button>
          </Show>
        </div>
      </Show>

      {/* Select all / Clear all buttons */}
      <div class="flex gap-3 text-sm">
        <button
          type="button"
          onClick={handleSelectAll}
          disabled={props.disabled || allFiltered()}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`${props.testIdPrefix || "genre-multiselect"}-select-all`}
        >
          Select all
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={props.disabled || props.selectedGenreIds.length === 0}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid={`${props.testIdPrefix || "genre-multiselect"}-clear-all`}
        >
          Clear all
        </button>
      </div>

      {/* Genre checkboxes */}
      <div class="space-y-3 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-700/50">
        <Show
          when={filteredGenres().length > 0}
          fallback={
            <p class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              No genres found
            </p>
          }
        >
          <For each={filteredGenres()}>
            {(gen) => {
              const isSelected = () => props.selectedGenreIds.includes(gen.id);
              return (
                <label
                  ref={(el) => {
                    if (el) {
                      itemRefs.set(gen.id, el);
                    } else {
                      itemRefs.delete(gen.id);
                    }
                  }}
                  class="flex items-start gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/50 p-2 rounded -mx-2 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isSelected()}
                    onChange={() => handleGenreChange(gen.id)}
                    disabled={props.disabled}
                    class="mt-1 w-4 h-4 accent-blue-600 dark:accent-blue-400 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={`${props.testIdPrefix || "genre-multiselect"}-checkbox-${gen.id}`}
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {gen.id}
                      <Show when={gen.name}>
                        <span class="text-gray-700 dark:text-gray-200">
                          {" "}
                          - {gen.name}
                        </span>
                      </Show>
                    </div>
                    <Show when={gen.region}>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {gen.region}
                      </p>
                    </Show>
                  </div>
                </label>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Selection summary */}
      <div class="text-sm text-gray-600 dark:text-gray-400">
        {props.selectedGenreIds.length === 0
          ? "No genres selected"
          : `${props.selectedGenreIds.length} genre${props.selectedGenreIds.length === 1 ? "" : "s"} selected`}
      </div>
    </div>
  );
};
