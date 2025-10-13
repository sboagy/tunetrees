/**
 * Catalog Toolbar Component
 *
 * Toolbar for the Catalog tab with complete controls.
 * Layout matches design: Add To Repertoire | Filter textbox | Filters | Add Tune | Delete Tunes | Columns
 *
 * Features:
 * - Add To Repertoire button with icon
 * - Responsive filter textbox (min-width 12ch)
 * - Combined filter dropdown
 * - Add Tune button with + icon
 * - Delete Tunes button with trash icon
 * - Columns dropdown
 * - Tooltips for all controls
 * - Responsive text labels
 *
 * @module components/catalog/CatalogToolbar
 */

import { useNavigate } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import type { Component } from "solid-js";
import { createEffect, createSignal, Show } from "solid-js";
import type { PlaylistWithSummary } from "../../lib/db/types";
import {
  TOOLBAR_BUTTON_BASE,
  TOOLBAR_BUTTON_DANGER,
  TOOLBAR_BUTTON_GROUP_CLASSES,
  TOOLBAR_BUTTON_NEUTRAL_ALT,
  TOOLBAR_BUTTON_PRIMARY,
  TOOLBAR_BUTTON_SUCCESS,
  TOOLBAR_CONTAINER_CLASSES,
  TOOLBAR_ICON_SIZE,
  TOOLBAR_INNER_CLASSES,
  TOOLBAR_SEARCH_CONTAINER,
  TOOLBAR_SEARCH_ICON,
  TOOLBAR_SEARCH_INPUT,
} from "../grids/shared-toolbar-styles";
import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu";
import { FilterPanel } from "./FilterPanel";

export interface CatalogToolbarProps {
  /** Search query */
  searchQuery: string;
  /** Search change handler */
  onSearchChange: (query: string) => void;
  /** Selected types */
  selectedTypes: string[];
  /** Types change handler */
  onTypesChange: (types: string[]) => void;
  /** Selected modes */
  selectedModes: string[];
  /** Modes change handler */
  onModesChange: (modes: string[]) => void;
  /** Selected genres */
  selectedGenres: string[];
  /** Genres change handler */
  onGenresChange: (genres: string[]) => void;
  /** Selected playlist IDs */
  selectedPlaylistIds: number[];
  /** Playlist IDs change handler */
  onPlaylistIdsChange: (playlistIds: number[]) => void;
  /** Available types */
  availableTypes: string[];
  /** Available modes */
  availableModes: string[];
  /** Available genres */
  availableGenres: string[];
  /** Available playlists */
  availablePlaylists: PlaylistWithSummary[];
  /** Selected rows count for Delete button state */
  selectedRowsCount?: number;
  /** Table instance for column visibility control */
  table?: Table<any>;
}

export const CatalogToolbar: Component<CatalogToolbarProps> = (props) => {
  const navigate = useNavigate();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  let columnsDropdownRef: HTMLDivElement | undefined;
  let columnsButtonRef: HTMLButtonElement | undefined;

  // Handle click outside to close columns dropdown
  const handleClickOutside = (event: MouseEvent) => {
    if (
      columnsDropdownRef &&
      !columnsDropdownRef.contains(event.target as Node)
    ) {
      setShowColumnsDropdown(false);
    }
  };

  // Setup click outside listener
  createEffect(() => {
    if (showColumnsDropdown()) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  });

  const handleAddToRepertoire = () => {
    alert("Add To Repertoire - Not yet implemented");
  };

  const handleAddTune = () => {
    navigate("/tunes/new");
  };

  const handleDeleteTunes = () => {
    alert("Delete Tunes - Not yet implemented");
  };

  const handleColumnsToggle = () => {
    setShowColumnsDropdown(!showColumnsDropdown());
  };

  return (
    <div class={TOOLBAR_CONTAINER_CLASSES}>
      {/* Main toolbar */}
      <div class={TOOLBAR_INNER_CLASSES}>
        <div class={TOOLBAR_BUTTON_GROUP_CLASSES}>
          {/* Add To Repertoire button */}
          <button
            type="button"
            onClick={handleAddToRepertoire}
            title="Add selected tunes to repertoire"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_PRIMARY}`}
          >
            <svg
              class={TOOLBAR_ICON_SIZE}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span class="hidden md:inline">Add To Repertoire</span>
            <span class="hidden sm:inline md:hidden">Add To Rep</span>
          </button>

          {/* Search input - visible on larger screens, hidden on mobile (moves to FilterPanel) */}
          <div class={TOOLBAR_SEARCH_CONTAINER}>
            <svg
              class={TOOLBAR_SEARCH_ICON}
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
            <input
              type="text"
              placeholder="Search tunes..."
              value={props.searchQuery}
              onInput={(e) => props.onSearchChange(e.currentTarget.value)}
              class={TOOLBAR_SEARCH_INPUT}
            />
          </div>

          {/* FilterPanel - search shows inside on mobile */}
          <FilterPanel
            searchQuery={props.searchQuery}
            onSearchChange={props.onSearchChange}
            availableTypes={props.availableTypes}
            selectedTypes={props.selectedTypes}
            onTypesChange={props.onTypesChange}
            availableModes={props.availableModes}
            selectedModes={props.selectedModes}
            onModesChange={props.onModesChange}
            availableGenres={props.availableGenres}
            selectedGenres={props.selectedGenres}
            onGenresChange={props.onGenresChange}
            availablePlaylists={props.availablePlaylists}
            selectedPlaylistIds={props.selectedPlaylistIds}
            onPlaylistIdsChange={props.onPlaylistIdsChange}
          />

          {/* Add Tune button */}
          <button
            type="button"
            onClick={handleAddTune}
            title="Add a new tune"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_SUCCESS}`}
          >
            <svg
              class={TOOLBAR_ICON_SIZE}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="hidden sm:inline">Add Tune</span>
          </button>

          {/* Delete Tunes button */}
          <button
            type="button"
            onClick={handleDeleteTunes}
            title="Delete selected tunes"
            disabled={!props.selectedRowsCount || props.selectedRowsCount === 0}
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_DANGER}`}
          >
            <svg
              class={TOOLBAR_ICON_SIZE}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span class="hidden sm:inline">Delete</span>
          </button>

          {/* Columns dropdown */}
          <div class="relative" ref={columnsDropdownRef!}>
            <button
              ref={columnsButtonRef!}
              type="button"
              onClick={handleColumnsToggle}
              title="Show/hide columns"
              class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL_ALT}`}
            >
              <svg
                class={TOOLBAR_ICON_SIZE}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <span class="hidden lg:inline">Columns</span>
              <svg
                class="w-3.5 h-3.5 hidden lg:inline"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Column visibility menu */}
            <Show when={props.table}>
              <ColumnVisibilityMenu
                table={props.table!}
                isOpen={showColumnsDropdown()}
                onClose={() => setShowColumnsDropdown(false)}
                triggerRef={columnsButtonRef}
              />
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};
