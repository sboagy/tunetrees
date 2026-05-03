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

import { useLocation, useNavigate } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import { ChevronDown, Columns, Plus, Search, Trash2 } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getDb } from "../../lib/db/client-sqlite";
import {
  addTunesToRepertoire,
  type RepertoireWithSummary,
} from "../../lib/db/queries/repertoires";
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
  /** Selected repertoire IDs */
  selectedRepertoireIds: string[];
  /** Repertoire IDs change handler */
  onRepertoireIdsChange: (repertoireIds: string[]) => void;
  /** Available types */
  availableTypes: string[];
  /** Available modes */
  availableModes: string[];
  /** Available genres */
  availableGenres: string[];
  /** Available repertoires */
  availableRepertoires: RepertoireWithSummary[];
  /** Selected rows count for Delete button state */
  selectedRowsCount?: number;
  /** Table instance for accessing selected rows */
  table?: Table<ITuneOverview>;
  /** Repertoire ID for adding tunes to repertoire */
  repertoireId?: string;
}

export const CatalogToolbar: Component<CatalogToolbarProps> = (props) => {
  const navigate = useNavigate();
  const location = useLocation();
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
      if (!props.repertoireId) {
        alert("No active repertoire selected");
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
      const result = await addTunesToRepertoire(
        db,
        props.repertoireId,
        tuneIds,
        auth.user()!.id
      );

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

      console.log("Add to repertoire completed:", result);
    } catch (error) {
      console.error("Error adding tunes to repertoire:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Failed to add tunes to repertoire"}`
      );
    }
  };

  const handleAddTune = () => {
    const fullPath = location.pathname + location.search;
    navigate("/tunes/new", { state: { from: fullPath } });
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
            <Plus class="w-4 h-4" aria-hidden="true" />
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
              title="Search/filter tunes by title, artist, composer, incipit, or structure"
              class="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[12ch]"
              style="min-width: 12ch"
            />
            <Search
              class="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              aria-hidden="true"
            />
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
            availableRepertoires={props.availableRepertoires}
            selectedRepertoireIds={props.selectedRepertoireIds}
            onRepertoireIdsChange={props.onRepertoireIdsChange}
          />

          {/* Add Tune button */}
          <button
            type="button"
            onClick={handleAddTune}
            title="Add a new tune"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_SUCCESS}`}
          >
            <Plus class="w-4 h-4" aria-hidden="true" />
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
            <Trash2 class="w-4 h-4" aria-hidden="true" />
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
            <Columns class="w-4 h-4" aria-hidden="true" />
            <span class="hidden lg:inline">Columns</span>
            <ChevronDown class="w-4 h-4" aria-hidden="true" />
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
