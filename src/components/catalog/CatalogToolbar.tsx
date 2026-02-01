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
 * - Add Tune button with + icon (opens AddTuneDialog)
 * - Delete Tunes button with trash icon
 * - Columns dropdown
 * - Tooltips for all controls
 * - Responsive text labels
 *
 * @module components/catalog/CatalogToolbar
 */

import type { Table } from "@tanstack/solid-table";
import { Columns } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getDb, persistDb } from "../../lib/db/client-sqlite";
import { addTunesToPlaylist } from "../../lib/db/queries/playlists";
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
  TOOLBAR_SPACER,
} from "../grids/shared-toolbar-styles";
import type { ITuneOverview } from "../grids/types";
import { AddTuneDialog } from "../import/AddTuneDialog";
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
  selectedPlaylistIds: string[];
  /** Playlist IDs change handler */
  onPlaylistIdsChange: (playlistIds: string[]) => void;
  /** Available types */
  availableTypes: string[];
  /** Available modes */
  availableModes: string[];
  /** Available genres */
  availableGenres: string[];
  /** Available playlists */
  availablePlaylists: PlaylistWithSummary[];
  /** Loading states for async data */
  loading?: {
    genres?: boolean;
    playlists?: boolean;
  };
  /** Selected rows count for Delete button state */
  selectedRowsCount?: number;
  /** Table instance for column visibility control and row selection */
  table?: Table<ITuneOverview>;
  /** Playlist ID for adding tunes to repertoire */
  playlistId?: string;
  /** Controlled state for filter panel expansion */
  filterPanelExpanded?: boolean;
  onFilterPanelExpandedChange?: (expanded: boolean) => void;
  /** Hide playlist filter (for Repertoire tab where playlist is implied) */
  hidePlaylistFilter?: boolean;
}

export const CatalogToolbar: Component<CatalogToolbarProps> = (props) => {
  const auth = useAuth();
  const { incrementRepertoireListChanged, forceSyncUp } = useAuth();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showAddTuneDialog, setShowAddTuneDialog] = createSignal(false);
  let columnsButtonRef: HTMLButtonElement | undefined;

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

      // Persist database immediately so offline refresh retains the added repertoire rows.
      await persistDb();

      // Show feedback
      let message = "";
      if (result.added > 0) {
        message += `Added ${result.added} tune${result.added > 1 ? "s" : ""} to repertoire.`;
      }
      if (result.skipped > 0) {
        message += ` ${result.skipped} tune${result.skipped > 1 ? "s were" : " was"} already in repertoire.`;
      }
      alert(message || "No tunes were added.");

      // Clear selection
      props.table.resetRowSelection();

      // Force sync up to Supabase BEFORE triggering UI refresh
      console.log("🔄 [AddToRepertoire] Syncing changes to Supabase...");
      await forceSyncUp();

      // Trigger repertoire list refresh using view-specific signal
      incrementRepertoireListChanged();

      console.log("Add to repertoire completed:", result);
    } catch (error) {
      console.error("Error adding tunes to repertoire:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Failed to add tunes to repertoire"}`
      );
    }
  };

  const handleAddTune = () => {
    setShowAddTuneDialog(true);
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
            data-testid="catalog-add-to-repertoire-button"
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
              data-testid="search-box-panel"
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
            loading={props.loading}
            hidePlaylistFilter={props.hidePlaylistFilter}
            isExpanded={props.filterPanelExpanded}
            onExpandedChange={props.onFilterPanelExpandedChange}
          />

          {/* Add Tune button */}
          <button
            type="button"
            onClick={handleAddTune}
            title="Add a new tune"
            data-testid="catalog-add-tune-button"
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
            data-testid="catalog-delete-button"
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
        </div>

        {/* Spacer to push Columns to the right */}
        <div class={TOOLBAR_SPACER} />

        {/* Right-aligned group: Columns dropdown */}
        <div class={TOOLBAR_BUTTON_GROUP_CLASSES}>
          <div class="relative">
            <button
              ref={columnsButtonRef!}
              type="button"
              onClick={handleColumnsToggle}
              title="Show/hide columns"
              data-testid="catalog-columns-button"
              class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL_ALT}`}
            >
              <Columns size={14} />
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

      {/* Add Tune Dialog */}
      <AddTuneDialog
        open={showAddTuneDialog()}
        onOpenChange={setShowAddTuneDialog}
      />
    </div>
  );
};
