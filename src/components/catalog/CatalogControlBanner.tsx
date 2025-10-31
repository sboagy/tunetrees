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
import { createEffect, createSignal } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getDb } from "../../lib/db/client-sqlite";
import { addTunesToPlaylist } from "../../lib/db/queries/playlists";
import type { PlaylistWithSummary } from "../../lib/db/types";
import {
  TOOLBAR_BUTTON_BASE,
  TOOLBAR_BUTTON_DANGER,
  TOOLBAR_BUTTON_GROUP_CLASSES,
  TOOLBAR_BUTTON_NEUTRAL,
  TOOLBAR_BUTTON_SUCCESS,
  TOOLBAR_CONTAINER_CLASSES,
  TOOLBAR_INNER_CLASSES,
  TOOLBAR_SPACER,
} from "../grids/shared-toolbar-styles";
import type { ITuneOverview } from "../grids/types";
import { CombinedFilterDropdown } from "./CombinedFilterDropdown";

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
  /** Table instance for accessing selected rows */
  table?: Table<ITuneOverview>;
  /** Playlist ID for adding tunes to repertoire */
  playlistId?: number;
}

export const CatalogToolbar: Component<CatalogToolbarProps> = (props) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  let columnsDropdownRef: HTMLDivElement | undefined;

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

  const handleAddToRepertoire = async () => {
    try {
      // Validation
      if (!props.table) {
        alert("Table not initialized");
        return;
      }
      if (!props.playlistId) {
        alert("No active playlist selected");
        return;
      }
      if (!auth.user()) {
        alert("User not authenticated");
        return;
      }

      // Get selected rows
      const selectedRows = props.table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        alert("No tunes selected. Please select tunes to add to repertoire.");
        return;
      }

      // Extract tune IDs
      const tuneIds = selectedRows.map((row) => row.original.id);
      console.log(`Adding ${tuneIds.length} tunes to repertoire:`, tuneIds);

      // Call database function
      const db = getDb();
      const result = await addTunesToPlaylist(
        db,
        props.playlistId,
        tuneIds,
        auth.user()!.id
      );

      // Show feedback
      let message = "";
      if (result.added > 0) {
        message += `Added ${result.added} tune${
          result.added > 1 ? "s" : ""
        } to repertoire.`;
      }
      if (result.skipped > 0) {
        message += ` ${result.skipped} tune${
          result.skipped > 1 ? "s were" : " was"
        } already in repertoire.`;
      }
      alert(message || "No tunes were added.");

      // Clear selection
      props.table.resetRowSelection();

      console.log("Add to repertoire completed:", result);
    } catch (error) {
      console.error("Error adding tunes to repertoire:", error);
      alert(
        `Error: ${
          error instanceof Error
            ? error.message
            : "Failed to add tunes to repertoire"
        }`
      );
    }
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
      <div class={TOOLBAR_INNER_CLASSES}>
        <div class={TOOLBAR_BUTTON_GROUP_CLASSES}>
          {/* Add To Repertoire button */}
          <button
            type="button"
            onClick={handleAddToRepertoire}
            title="Add selected tunes to repertoire"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
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
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <span class="hidden lg:inline">Add To Repertoire</span>
            <span class="lg:hidden hidden sm:inline">Add To Rep</span>
          </button>

          {/* Filter textbox */}
          <div class="relative min-w-[200px] max-w-xs flex-shrink-0">
            <input
              type="text"
              value={props.searchQuery}
              onInput={(e) => props.onSearchChange(e.currentTarget.value)}
              placeholder="Filter"
              title="Search/filter tunes by title, incipit, or structure"
              class="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[12ch]"
              style="min-width: 12ch"
            />
            <svg
              class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
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

          {/* Combined filter dropdown */}
          <CombinedFilterDropdown
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span class="hidden lg:inline">Add Tune</span>
            <span class="lg:hidden">Add</span>
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span class="hidden lg:inline">Delete Tunes</span>
            <span class="lg:hidden">Delete</span>
          </button>
        </div>

        {/* Spacer to push Columns to the right */}
        <div class={TOOLBAR_SPACER} />

        {/* Columns dropdown */}
        <div class="relative" ref={columnsDropdownRef!}>
          <button
            type="button"
            onClick={handleColumnsToggle}
            title="Show/hide columns"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL}`}
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
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
            <span class="hidden lg:inline">Columns</span>
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Columns dropdown menu */}
          {showColumnsDropdown() && (
            <div class="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
              <div class="p-2 text-sm text-gray-500 dark:text-gray-400">
                Column visibility controls - Not yet implemented
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
