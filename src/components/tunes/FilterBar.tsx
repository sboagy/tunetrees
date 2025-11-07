/**
 * FilterBar Component
 *
 * Advanced search and filtering UI for tune list.
 * Features:
 * - Debounced search input
 * - Multi-select filters for type, mode, genre
 * - Clear filters button
 * - Active filter count badge
 * - URL query param persistence
 *
 * @module components/tunes/FilterBar
 */

import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";

export interface FilterBarProps {
  /** Current search query */
  searchQuery: string;
  /** Search query change handler */
  onSearchChange: (query: string) => void;
  /** Selected tune types */
  selectedTypes: string[];
  /** Type selection change handler */
  onTypesChange: (types: string[]) => void;
  /** Selected modes */
  selectedModes: string[];
  /** Mode selection change handler */
  onModesChange: (modes: string[]) => void;
  /** Selected genres */
  selectedGenres: string[];
  /** Genre selection change handler */
  onGenresChange: (genres: string[]) => void;
  /** Available tune types */
  availableTypes: string[];
  /** Available modes */
  availableModes: string[];
  /** Available genres */
  availableGenres: string[];
  /** Clear all filters */
  onClearFilters: () => void;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
}

/**
 * FilterBar Component
 *
 * @example
 * ```tsx
 * <FilterBar
 *   searchQuery={searchQuery()}
 *   onSearchChange={setSearchQuery}
 *   selectedTypes={selectedTypes()}
 *   onTypesChange={setSelectedTypes}
 *   // ... other props
 * />
 * ```
 */
export const FilterBar: Component<FilterBarProps> = (props) => {
  const [localSearchQuery, setLocalSearchQuery] = createSignal(
    props.searchQuery,
  );
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  // Debounced search handler
  createEffect(() => {
    const query = localSearchQuery();

    // Clear previous timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = setTimeout(() => {
      props.onSearchChange(query);
    }, props.debounceMs ?? 300);
  });

  // Cleanup timer on unmount
  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  // Sync local state with prop changes
  createEffect(() => {
    setLocalSearchQuery(props.searchQuery);
  });

  // Calculate active filter count
  const activeFilterCount = () => {
    let count = 0;
    if (props.searchQuery.trim()) count++;
    if (props.selectedTypes.length > 0) count++;
    if (props.selectedModes.length > 0) count++;
    if (props.selectedGenres.length > 0) count++;
    return count;
  };

  // Handle multi-select change
  const handleMultiSelect = (
    currentValues: string[],
    newValue: string,
    onChange: (values: string[]) => void,
  ) => {
    if (currentValues.includes(newValue)) {
      onChange(currentValues.filter((v) => v !== newValue));
    } else {
      onChange([...currentValues, newValue]);
    }
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
      {/* Search Input */}
      <div class="mb-4">
        <div class="relative">
          <input
            type="text"
            value={localSearchQuery()}
            onInput={(e) => setLocalSearchQuery(e.currentTarget.value)}
            placeholder="Search tunes by title, incipit, or structure..."
            class="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            class="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Search icon</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Filter Controls */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Type Filter */}
        <div>
          <div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type ({props.selectedTypes.length} selected)
          </div>
          <div class="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700">
            <Show
              when={props.availableTypes.length > 0}
              fallback={
                <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                  No types available
                </p>
              }
            >
              <For each={props.availableTypes}>
                {(type) => (
                  <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 rounded px-2">
                    <input
                      type="checkbox"
                      checked={props.selectedTypes.includes(type)}
                      onChange={() =>
                        handleMultiSelect(
                          props.selectedTypes,
                          type,
                          props.onTypesChange,
                        )
                      }
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-900 dark:text-white">
                      {type}
                    </span>
                  </label>
                )}
              </For>
            </Show>
          </div>
        </div>

        {/* Mode Filter */}
        <div>
          <div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mode ({props.selectedModes.length} selected)
          </div>
          <div class="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700">
            <Show
              when={props.availableModes.length > 0}
              fallback={
                <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                  No modes available
                </p>
              }
            >
              <For each={props.availableModes}>
                {(mode) => (
                  <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 rounded px-2">
                    <input
                      type="checkbox"
                      checked={props.selectedModes.includes(mode)}
                      onChange={() =>
                        handleMultiSelect(
                          props.selectedModes,
                          mode,
                          props.onModesChange,
                        )
                      }
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-900 dark:text-white">
                      {mode}
                    </span>
                  </label>
                )}
              </For>
            </Show>
          </div>
        </div>

        {/* Genre Filter */}
        <div>
          <div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Genre ({props.selectedGenres.length} selected)
          </div>
          <div class="max-h-32 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 bg-white dark:bg-gray-700">
            <Show
              when={props.availableGenres.length > 0}
              fallback={
                <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                  No genres available
                </p>
              }
            >
              <For each={props.availableGenres}>
                {(genre) => (
                  <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 rounded px-2">
                    <input
                      type="checkbox"
                      checked={props.selectedGenres.includes(genre)}
                      onChange={() =>
                        handleMultiSelect(
                          props.selectedGenres,
                          genre,
                          props.onGenresChange,
                        )
                      }
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-900 dark:text-white">
                      {genre}
                    </span>
                  </label>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>

      {/* Active Filters Summary & Clear Button */}
      <div class="mt-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Show when={activeFilterCount() > 0}>
            <span class="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium">
              {activeFilterCount()}{" "}
              {activeFilterCount() === 1 ? "filter" : "filters"} active
            </span>
          </Show>

          {/* Individual filter tags */}
          <Show when={props.searchQuery.trim()}>
            <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
              Search: "{props.searchQuery}"
            </span>
          </Show>

          <Show when={props.selectedTypes.length > 0}>
            <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
              Types: {props.selectedTypes.join(", ")}
            </span>
          </Show>

          <Show when={props.selectedModes.length > 0}>
            <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
              Modes: {props.selectedModes.join(", ")}
            </span>
          </Show>

          <Show when={props.selectedGenres.length > 0}>
            <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
              Genres: {props.selectedGenres.join(", ")}
            </span>
          </Show>
        </div>

        <Show when={activeFilterCount() > 0}>
          <button
            type="button"
            onClick={props.onClearFilters}
            class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            Clear Filters
          </button>
        </Show>
      </div>
    </div>
  );
};
