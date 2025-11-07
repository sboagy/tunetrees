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
      class={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md ${colorClasses[props.type]}`}
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
  selectedItems: string[];
  onSelectionChange: (selected: string[]) => void;
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
      const selected = props.selectedItems;
      if (selected.includes(playlistId)) {
        props.onSelectionChange(selected.filter((id) => id !== playlistId));
      } else {
        props.onSelectionChange([...selected, playlistId]);
      }
    } else {
      const value = item as string;
      const selected = props.selectedItems;
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
      return props.selectedItems.includes(playlistId);
    } else {
      return props.selectedItems.includes(item as string);
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
  /** Search query */
  searchQuery: string;
  /** Search change handler */
  onSearchChange: (query: string) => void;
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
  /** Loading states */
  loading?: {
    genres?: boolean;
    playlists?: boolean;
  };
  /** Hide playlist filter (for Repertoire tab where playlist is implied) */
  hidePlaylistFilter?: boolean;
}

export const FilterPanel: Component<FilterPanelProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [panelStyle, setPanelStyle] = createSignal<{
    top: string;
    left?: string;
    right?: string;
  }>({ top: "0px" });
  let panelRef: HTMLDivElement | undefined;
  let buttonRef: HTMLButtonElement | undefined;

  // Calculate panel position based on trigger button
  const updatePosition = () => {
    if (buttonRef && isExpanded()) {
      const rect = buttonRef.getBoundingClientRect();
      const panelWidth = 384; // min-w-96 = 24rem = 384px
      const viewportWidth = window.innerWidth;
      const gap = 4;

      // On mobile, make it full width with padding
      const isMobile = viewportWidth < 768; // md breakpoint

      if (isMobile) {
        // Full width on mobile with padding
        setPanelStyle({
          top: `${rect.bottom + gap}px`,
          left: "8px",
          right: "8px",
        });
      } else {
        // Desktop: align with button, check for overflow
        const wouldOverflowRight = rect.left + panelWidth > viewportWidth;

        setPanelStyle({
          top: `${rect.bottom + gap}px`,
          left: wouldOverflowRight ? undefined : `${rect.left}px`,
          right: wouldOverflowRight
            ? `${viewportWidth - rect.right}px`
            : undefined,
        });
      }
    }
  };

  // Update position when opened or window resizes
  createEffect(() => {
    if (isExpanded()) {
      updatePosition();
    }
  });

  onCleanup(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    }
  });

  createEffect(() => {
    if (isExpanded()) {
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
    }
  });

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

  const removePlaylist = (playlistId: string) => {
    props.onPlaylistIdsChange(
      props.selectedPlaylistIds.filter((id) => id !== playlistId)
    );
  };

  // Get playlist display name by ID
  const getPlaylistNameById = (playlistId: string): string => {
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
    if (!props.hidePlaylistFilter) {
      props.onPlaylistIdsChange([]);
    }
  };

  // Get total selected count
  const totalSelected = () => {
    const playlistCount = props.hidePlaylistFilter
      ? 0
      : props.selectedPlaylistIds.length;
    return (
      props.selectedTypes.length +
      props.selectedModes.length +
      props.selectedGenres.length +
      playlistCount
    );
  };

  return (
    <div class="relative" ref={panelRef}>
      {/* Single "Filters" trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        title="Open filter options"
        class="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors whitespace-nowrap border border-gray-200/50 dark:border-gray-700/50"
        aria-label="Filter options"
        aria-expanded={isExpanded()}
        aria-haspopup="true"
      >
        <svg
          class="w-3.5 h-3.5 flex-shrink-0"
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
        <span class="hidden sm:inline">Filters</span>
        <Show when={totalSelected() > 0}>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium">
            {totalSelected()}
          </span>
        </Show>
        <svg
          class={`w-3.5 h-3.5 hidden sm:inline transition-transform ${isExpanded() ? "rotate-180" : ""}`}
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
            class="fixed p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999] md:min-w-96"
            style={panelStyle()}
          >
            <div class="space-y-3">
              {/* Search input - only shown on mobile when hidden from toolbar */}
              <div class="relative md:hidden">
                <input
                  type="text"
                  value={props.searchQuery}
                  onInput={(e) => props.onSearchChange(e.currentTarget.value)}
                  placeholder="Search tunes..."
                  data-testid="search-box-panel"
                  class="w-full px-3 py-1.5 pl-9 border border-gray-300/50 dark:border-gray-600/50 rounded-sm bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <svg
                  class="absolute left-2.5 top-2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

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

                {/* Playlist filter - only shown when not hidden */}
                <Show when={!props.hidePlaylistFilter}>
                  <FilterDropdown
                    title="Playlist"
                    items={props.availablePlaylists}
                    selectedItems={props.selectedPlaylistIds}
                    onSelectionChange={(selected) =>
                      props.onPlaylistIdsChange(selected)
                    }
                    loading={props.loading?.playlists}
                    isPlaylist={true}
                  />
                </Show>

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

                  {/* Playlist chips - only shown when playlist filter not hidden */}
                  <Show when={!props.hidePlaylistFilter}>
                    <For each={props.selectedPlaylistIds}>
                      {(playlistId) => (
                        <FilterChip
                          label={getPlaylistNameById(playlistId)}
                          onRemove={() => removePlaylist(playlistId)}
                          type="playlist"
                        />
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
