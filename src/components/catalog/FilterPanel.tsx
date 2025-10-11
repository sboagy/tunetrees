/**
 * Filter Panel Component
 *
 * Implements the new separate dropdowns + filter chips pattern:
 * - 4 separate dropdown buttons (Type, Mode, Genre, Playlist)
 * - Selected filter chips displayed below the dropdowns
 * - Each dropdown manages only its own filter type
 * - Clear loading states and proper responsive design
 *
 * @module components/catalog/FilterPanel
 */

import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { PlaylistWithSummary } from "../../lib/db/types";

// Helper function to get display name for a playlist
const getPlaylistDisplayName = (playlist: PlaylistWithSummary): string => {
  if (playlist.name?.trim()) {
    return playlist.name.trim();
  }
  const instrument = playlist.instrumentName || "Unknown";
  return `${instrument} (${playlist.playlistId})`;
};

// Filter chip component for selected items
const FilterChip: Component<{
  label: string;
  onRemove: () => void;
  type: "type" | "mode" | "genre" | "playlist";
}> = (props) => {
  const colorClasses = {
    type: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    mode: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    genre: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    playlist:
      "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  };

  return (
    <span
      class={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md ${
        colorClasses[props.type]
      }`}
    >
      <span>{props.label}</span>
      <button
        type="button"
        onClick={props.onRemove}
        class="hover:bg-opacity-20 hover:bg-gray-600 rounded-full p-0.5 transition-colors"
        aria-label={`Remove ${props.label} filter`}
      >
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <title>Remove filter</title>
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </span>
  );
};

// Individual dropdown component
const FilterDropdown: Component<{
  title: string;
  items: string[] | PlaylistWithSummary[];
  selectedItems: string[] | number[];
  onSelectionChange: (selected: string[] | number[]) => void;
  loading?: boolean;
  isPlaylist?: boolean;
}> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  // Handle click outside to close
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (
      dropdownRef &&
      !dropdownRef.contains(target) &&
      buttonRef &&
      !buttonRef.contains(target)
    ) {
      setIsOpen(false);
    }
  };

  // Setup click outside listener
  createEffect(() => {
    if (isOpen()) {
      document.addEventListener("mousedown", handleClickOutside);
      onCleanup(() => {
        document.removeEventListener("mousedown", handleClickOutside);
      });
    }
  });

  const toggleSelection = (item: any) => {
    if (props.isPlaylist) {
      const playlistId = (item as PlaylistWithSummary).playlistId;
      const selected = props.selectedItems as number[];
      if (selected.includes(playlistId)) {
        props.onSelectionChange(selected.filter((id) => id !== playlistId));
      } else {
        props.onSelectionChange([...selected, playlistId]);
      }
    } else {
      const value = item as string;
      const selected = props.selectedItems as string[];
      if (selected.includes(value)) {
        props.onSelectionChange(selected.filter((i) => i !== value));
      } else {
        props.onSelectionChange([...selected, value]);
      }
    }
  };

  const isSelected = (item: any): boolean => {
    if (props.isPlaylist) {
      const playlistId = (item as PlaylistWithSummary).playlistId;
      return (props.selectedItems as number[]).includes(playlistId);
    } else {
      return (props.selectedItems as string[]).includes(item as string);
    }
  };

  return (
    <div class="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
        aria-label={`Filter by ${props.title}`}
        aria-expanded={isOpen()}
        aria-haspopup="listbox"
      >
        <span>{props.title}</span>
        <Show when={props.loading}>
          <div class="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full"></div>
        </Show>
        <Show when={props.selectedItems.length > 0}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
            {props.selectedItems.length}
          </span>
        </Show>
        <svg
          class={`w-4 h-4 transition-transform ${isOpen() ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>Toggle dropdown</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <Show when={isOpen()}>
        <div class="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          <div class="p-2">
            <Show
              when={!props.loading && props.items.length > 0}
              fallback={
                <div class="text-xs text-gray-500 dark:text-gray-400 italic px-2 py-2">
                  <Show
                    when={props.loading}
                    fallback={`No ${props.title.toLowerCase()} available`}
                  >
                    Loading...
                  </Show>
                </div>
              }
            >
              <For each={props.items}>
                {(item) => (
                  <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={isSelected(item)}
                      onChange={() => toggleSelection(item)}
                      class="w-4 h-4"
                    />
                    <span class="text-gray-900 dark:text-white flex-1">
                      {props.isPlaylist
                        ? getPlaylistDisplayName(item as PlaylistWithSummary)
                        : (item as string)}
                    </span>
                    <Show when={props.isPlaylist}>
                      <span class="text-xs text-gray-500 dark:text-gray-400">
                        {(item as PlaylistWithSummary).tuneCount}
                      </span>
                    </Show>
                  </label>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export interface FilterPanelProps {
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
  selectedPlaylistIds: number[];
  /** Playlist IDs change handler */
  onPlaylistIdsChange: (playlistIds: number[]) => void;
  /** Loading states */
  loading?: {
    genres?: boolean;
    playlists?: boolean;
  };
}

export const FilterPanel: Component<FilterPanelProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  let panelRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  // Handle click outside to close panel
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;

    // Check if click is on the trigger button
    if (buttonRef?.contains(target)) {
      return; // Let the button handle its own click
    }

    // Check if click is inside the Portal-rendered panel content
    // Use a data attribute to identify our Portal-rendered content
    const portalPanel = document.querySelector('[data-filter-panel="true"]');
    if (portalPanel?.contains(target)) {
      return; // Don't close if clicking inside the panel
    }

    // Click is outside - close the panel
    setIsExpanded(false);
  };

  // Setup click outside listener
  createEffect(() => {
    if (isExpanded()) {
      document.addEventListener("mousedown", handleClickOutside);
      onCleanup(() => {
        document.removeEventListener("mousedown", handleClickOutside);
      });
    }
  });

  // Remove individual selections
  const removeType = (type: string) => {
    props.onTypesChange(props.selectedTypes.filter((t) => t !== type));
  };

  const removeMode = (mode: string) => {
    props.onModesChange(props.selectedModes.filter((m) => m !== mode));
  };

  const removeGenre = (genre: string) => {
    props.onGenresChange(props.selectedGenres.filter((g) => g !== genre));
  };

  const removePlaylist = (playlistId: number) => {
    props.onPlaylistIdsChange(
      props.selectedPlaylistIds.filter((id) => id !== playlistId)
    );
  };

  // Get playlist display name by ID
  const getPlaylistNameById = (playlistId: number): string => {
    const playlist = props.availablePlaylists.find(
      (p) => p.playlistId === playlistId
    );
    return playlist
      ? getPlaylistDisplayName(playlist)
      : `Playlist ${playlistId}`;
  };

  // Clear all selections
  const clearAll = () => {
    props.onTypesChange([]);
    props.onModesChange([]);
    props.onGenresChange([]);
    props.onPlaylistIdsChange([]);
  };

  // Get total selected count
  const totalSelected = () =>
    props.selectedTypes.length +
    props.selectedModes.length +
    props.selectedGenres.length +
    props.selectedPlaylistIds.length;

  return (
    <div class="relative" ref={panelRef}>
      {/* Single "Filters" trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        title="Open filter options"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors whitespace-nowrap"
        aria-label="Filter options"
        aria-expanded={isExpanded()}
        aria-haspopup="true"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        <span>Filters</span>
        <Show when={totalSelected() > 0}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
            {totalSelected()}
          </span>
        </Show>
        <svg
          class={`w-4 h-4 transition-transform ${
            isExpanded() ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>Toggle filters</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible filter panel */}
      <Show when={isExpanded()}>
        <Portal>
          <div
            data-filter-panel="true"
            class="fixed p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999] min-w-96"
            style={{
              left: buttonRef
                ? `${buttonRef.getBoundingClientRect().left}px`
                : "1rem",
              top: buttonRef
                ? `${buttonRef.getBoundingClientRect().bottom + 4}px`
                : "5rem",
            }}
          >
            <div class="space-y-3">
              {/* Filter dropdown buttons row */}
              <div class="flex items-center gap-2 flex-wrap">
                <FilterDropdown
                  title="Type"
                  items={props.availableTypes}
                  selectedItems={props.selectedTypes}
                  onSelectionChange={(selected) =>
                    props.onTypesChange(selected as string[])
                  }
                />

                <FilterDropdown
                  title="Mode"
                  items={props.availableModes}
                  selectedItems={props.selectedModes}
                  onSelectionChange={(selected) =>
                    props.onModesChange(selected as string[])
                  }
                />

                <FilterDropdown
                  title="Genre"
                  items={props.availableGenres}
                  selectedItems={props.selectedGenres}
                  onSelectionChange={(selected) =>
                    props.onGenresChange(selected as string[])
                  }
                  loading={props.loading?.genres}
                />

                <FilterDropdown
                  title="Playlist"
                  items={props.availablePlaylists}
                  selectedItems={props.selectedPlaylistIds}
                  onSelectionChange={(selected) =>
                    props.onPlaylistIdsChange(selected as number[])
                  }
                  loading={props.loading?.playlists}
                  isPlaylist={true}
                />

                {/* Clear all button */}
                <Show when={totalSelected() > 0}>
                  <button
                    type="button"
                    onClick={clearAll}
                    class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
                  >
                    Clear all ({totalSelected()})
                  </button>
                </Show>
              </div>

              {/* Selected filter chips below */}
              <Show when={totalSelected() > 0}>
                <div class="flex flex-wrap gap-1">
                  <For each={props.selectedTypes}>
                    {(type) => (
                      <FilterChip
                        label={type}
                        onRemove={() => removeType(type)}
                        type="type"
                      />
                    )}
                  </For>

                  <For each={props.selectedModes}>
                    {(mode) => (
                      <FilterChip
                        label={mode}
                        onRemove={() => removeMode(mode)}
                        type="mode"
                      />
                    )}
                  </For>

                  <For each={props.selectedGenres}>
                    {(genre) => (
                      <FilterChip
                        label={genre}
                        onRemove={() => removeGenre(genre)}
                        type="genre"
                      />
                    )}
                  </For>

                  <For each={props.selectedPlaylistIds}>
                    {(playlistId) => (
                      <FilterChip
                        label={getPlaylistNameById(playlistId)}
                        onRemove={() => removePlaylist(playlistId)}
                        type="playlist"
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
