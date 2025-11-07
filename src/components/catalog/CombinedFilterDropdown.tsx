/**
 * Combined Filter Dropdown Component
 *
 * Single dropdown panel that combines Type, Mode, Genre, and Playlist filters.
 * Responsive design: 4 columns on desktop, 2 columns on tablet, 1 column on mobile.
 * Matches the design shown in the user's screenshot with upside-down caret.
 *
 * @module components/catalog/CombinedFilterDropdown
 */

import { type Component, createSignal, For, onCleanup, Show } from "solid-js";
import type { PlaylistWithSummary } from "../../lib/db/types";

// Helper function to get display name for a playlist
const getPlaylistDisplayName = (playlist: PlaylistWithSummary): string => {
  // If name exists and is not empty, use it
  if (playlist.name?.trim()) {
    return playlist.name.trim();
  }

  // Otherwise use instrument + id format
  const instrument = playlist.instrumentName || "Unknown";
  return `${instrument} (${playlist.playlistId})`;
};

export interface CombinedFilterDropdownProps {
  /** Available types */
  availableTypes: string[];
  /** Selected types */
  selectedTypes: string[];
  /** Types change handler */
  onTypesChange: (types: string[]) => void;
  /** Available modes */
  availableModes: string[];
  /** Selected modes */
  selectedModes: string[];
  /** Modes change handler */
  onModesChange: (modes: string[]) => void;
  /** Available genres */
  availableGenres: string[];
  /** Selected genres */
  selectedGenres: string[];
  /** Genres change handler */
  onGenresChange: (genres: string[]) => void;
  /** Available playlists */
  availablePlaylists: PlaylistWithSummary[];
  /** Selected playlist IDs */
  selectedPlaylistIds: string[];
  /** Playlist IDs change handler */
  onPlaylistIdsChange: (playlistIds: string[]) => void;
}

export const CombinedFilterDropdown: Component<CombinedFilterDropdownProps> = (
  props
) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  // Debug logging
  console.log(
    "CombinedFilterDropdown render - availablePlaylists:",
    props.availablePlaylists?.length || 0
  );
  console.log(
    "CombinedFilterDropdown render - availableGenres:",
    props.availableGenres?.length || 0
  );

  // Get total selected count
  const totalSelected = () =>
    props.selectedTypes.length +
    props.selectedModes.length +
    props.selectedGenres.length +
    props.selectedPlaylistIds.length;

  // Handle click outside to close
  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  // Setup click outside listener
  const setupClickOutside = () => {
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  };

  setupClickOutside();

  // Toggle selection for a value in an array
  const toggleSelection = (
    value: string,
    selected: string[],
    onChange: (values: string[]) => void
  ) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  // Clear all selections
  const clearAll = () => {
    props.onTypesChange([]);
    props.onModesChange([]);
    props.onGenresChange([]);
    props.onPlaylistIdsChange([]);
  };

  return (
    <div class="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        data-testid="combined-filter-button"
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      >
        <span>Filters</span>
        <Show when={totalSelected() > 0}>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            {totalSelected()}
          </span>
        </Show>
        {/* Upside-down caret */}
        <svg
          class={`w-4 h-4 transition-transform ${isOpen() ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>Toggle filters dropdown</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      <Show when={isOpen()}>
        <div
          data-testid="combined-filter-dropdown"
          class="absolute right-0 top-full mt-1 w-80 sm:w-96 lg:w-[600px] xl:w-[800px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-w-screen-lg"
        >
          <div class="p-4 lg:p-5">
            {/* Header with clear button */}
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                Filter Options
              </h3>
              <Show when={totalSelected() > 0}>
                <button
                  type="button"
                  onClick={clearAll}
                  class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              </Show>
            </div>

            {/* Responsive grid: 1 col on mobile, 2 cols on tablet/desktop - 2x2 layout */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Type column */}
              <div>
                <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type ({props.selectedTypes.length} selected)
                </h4>
                <div class="space-y-2 max-h-32 sm:max-h-36 overflow-y-auto">
                  <For each={props.availableTypes}>
                    {(type) => (
                      <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-2 rounded touch-manipulation">
                        <input
                          type="checkbox"
                          checked={props.selectedTypes.includes(type)}
                          onChange={() =>
                            toggleSelection(
                              type,
                              props.selectedTypes,
                              props.onTypesChange
                            )
                          }
                          class="w-4 h-4"
                        />
                        <span class="text-gray-900 dark:text-white">
                          {type}
                        </span>
                      </label>
                    )}
                  </For>
                </div>
              </div>

              {/* Mode column */}
              <div>
                <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mode ({props.selectedModes.length} selected)
                </h4>
                <div class="space-y-2 max-h-32 sm:max-h-36 overflow-y-auto">
                  <For each={props.availableModes}>
                    {(mode) => (
                      <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-2 rounded touch-manipulation">
                        <input
                          type="checkbox"
                          checked={props.selectedModes.includes(mode)}
                          onChange={() =>
                            toggleSelection(
                              mode,
                              props.selectedModes,
                              props.onModesChange
                            )
                          }
                          class="w-4 h-4"
                        />
                        <span class="text-gray-900 dark:text-white">
                          {mode}
                        </span>
                      </label>
                    )}
                  </For>
                </div>
              </div>

              {/* Genre column */}
              <div>
                <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Genre ({props.selectedGenres.length} selected)
                </h4>
                <div class="space-y-2 max-h-32 sm:max-h-36 overflow-y-auto">
                  <Show
                    when={props.availableGenres.length > 0}
                    fallback={
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic px-2">
                        No genres available
                      </span>
                    }
                  >
                    <For each={props.availableGenres}>
                      {(genre) => (
                        <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-2 rounded touch-manipulation">
                          <input
                            type="checkbox"
                            checked={props.selectedGenres.includes(genre)}
                            onChange={() =>
                              toggleSelection(
                                genre,
                                props.selectedGenres,
                                props.onGenresChange
                              )
                            }
                            class="w-4 h-4"
                          />
                          <span class="text-gray-900 dark:text-white">
                            {genre}
                          </span>
                        </label>
                      )}
                    </For>
                  </Show>
                </div>
              </div>

              {/* Playlist column */}
              <div>
                <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Playlist ({props.selectedPlaylistIds.length} selected)
                </h4>
                <div class="space-y-2 max-h-32 sm:max-h-36 overflow-y-auto">
                  <Show
                    when={props.availablePlaylists.length > 0}
                    fallback={
                      <span class="text-xs text-gray-500 dark:text-gray-400 italic px-2">
                        No playlists available
                      </span>
                    }
                  >
                    <For each={props.availablePlaylists}>
                      {(playlist) => (
                        <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-2 rounded touch-manipulation">
                          <input
                            type="checkbox"
                            checked={props.selectedPlaylistIds.includes(
                              playlist.playlistId
                            )}
                            onChange={() => {
                              const playlistId = playlist.playlistId;
                              if (
                                props.selectedPlaylistIds.includes(playlistId)
                              ) {
                                props.onPlaylistIdsChange(
                                  props.selectedPlaylistIds.filter(
                                    (id) => id !== playlistId
                                  )
                                );
                              } else {
                                props.onPlaylistIdsChange([
                                  ...props.selectedPlaylistIds,
                                  playlistId,
                                ]);
                              }
                            }}
                            class="w-4 h-4"
                          />
                          <span
                            class="text-gray-900 dark:text-white"
                            title={`${playlist.tuneCount} tunes`}
                          >
                            {getPlaylistDisplayName(playlist)}
                          </span>
                        </label>
                      )}
                    </For>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
