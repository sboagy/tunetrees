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

import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import type { Table } from "@tanstack/solid-table";
import { ChevronRight, Columns, EllipsisVertical, Plus } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { createIsMobile } from "@/lib/hooks/useIsMobile";
import { useAuth } from "../../lib/auth/AuthContext";
import { getDb, persistDb } from "../../lib/db/client-sqlite";
import {
  addTunesToRepertoire,
  type RepertoireWithSummary,
} from "../../lib/db/queries/repertoires";
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
import { useRegisterMobileControlBar } from "../layout/MobileControlBarContext";
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
  /** Loading states for async data */
  loading?: {
    genres?: boolean;
    repertoires?: boolean;
  };
  /** Selected rows count for Delete button state */
  selectedRowsCount?: number;
  /** Table instance for column visibility control and row selection */
  table?: Table<ITuneOverview>;
  /** Repertoire ID for adding tunes to repertoire */
  repertoireId?: string;
  /** Controlled state for filter panel expansion */
  filterPanelExpanded?: boolean;
  onFilterPanelExpandedChange?: (expanded: boolean) => void;
  /** Hide repertoire filter (for Repertoire tab where repertoire is implied) */
  hideRepertoireFilter?: boolean;
}

export const CatalogToolbar: Component<CatalogToolbarProps> = (props) => {
  const isMobile = createIsMobile();
  const auth = useAuth();
  const { incrementRepertoireListChanged, forceSyncUp } = useAuth();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showAddTuneDialog, setShowAddTuneDialog] = createSignal(false);
  const [showOverflowMenu, setShowOverflowMenu] = createSignal(false);
  let columnsButtonRef: HTMLButtonElement | undefined;
  let mobileOverflowButtonRef: HTMLButtonElement | undefined;

  const activeRepertoireId = () => props.repertoireId;
  const hasSelectedRows = () =>
    Boolean(
      props.table && props.selectedRowsCount && props.selectedRowsCount > 0
    );
  const canAddToRepertoire = () =>
    Boolean(hasSelectedRows() && activeRepertoireId() && auth.user());

  const handleAddToRepertoire = async () => {
    try {
      // Validation
      if (!props.table) {
        alert("Table not initialized");
        return;
      }
      if (!activeRepertoireId()) {
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
        activeRepertoireId()!,
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

  const openDisplayOptions = () => {
    setShowOverflowMenu(false);
    setShowColumnsDropdown(true);
  };

  const displayOptionsTriggerRef = () =>
    isMobile() ? mobileOverflowButtonRef : columnsButtonRef;

  const mobileMenuItemClasses =
    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-left text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-800";

  useRegisterMobileControlBar(() => {
    if (!isMobile()) return undefined;

    return (
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <div class="relative min-w-0 flex-1">
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
            class={`${TOOLBAR_SEARCH_INPUT} h-10 pr-3`}
            data-testid="search-box-panel"
          />
        </div>

        <FilterPanel
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
          loading={props.loading}
          hideRepertoireFilter={props.hideRepertoireFilter}
          isExpanded={props.filterPanelExpanded}
          onExpandedChange={props.onFilterPanelExpandedChange}
        />

        <DropdownMenu
          open={showOverflowMenu()}
          onOpenChange={setShowOverflowMenu}
        >
          <DropdownMenu.Trigger
            ref={mobileOverflowButtonRef}
            type="button"
            data-testid="catalog-columns-button"
            aria-label="More options"
            class="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <EllipsisVertical class="h-4 w-4" />
            <span class="sr-only">More options</span>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content class="z-50 min-w-[16rem] rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <button
                type="button"
                data-testid="catalog-add-to-repertoire-button"
                class={mobileMenuItemClasses}
                disabled={!canAddToRepertoire()}
                onClick={() => {
                  setShowOverflowMenu(false);
                  void handleAddToRepertoire();
                }}
              >
                <span>Add To Repertoire</span>
              </button>

              <button
                type="button"
                data-testid="catalog-add-tune-button"
                class={mobileMenuItemClasses}
                onClick={() => {
                  setShowOverflowMenu(false);
                  handleAddTune();
                }}
              >
                <span class="flex items-center gap-2">
                  <Plus class="h-4 w-4" />
                  Add Tune
                </span>
              </button>

              <button
                type="button"
                data-testid="catalog-delete-button"
                class={mobileMenuItemClasses}
                disabled={
                  !props.selectedRowsCount || props.selectedRowsCount === 0
                }
                onClick={() => {
                  setShowOverflowMenu(false);
                  handleDeleteTunes();
                }}
              >
                <span>Delete</span>
              </button>

              <div class="my-1 h-px bg-gray-200 dark:bg-gray-700" />

              <button
                type="button"
                data-testid="display-options-entry-button"
                class={mobileMenuItemClasses}
                onClick={openDisplayOptions}
              >
                <span>Display Options</span>
                <ChevronRight class="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    );
  });

  return (
    <>
      <Show when={!isMobile()}>
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
                disabled={!canAddToRepertoire()}
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
                <span>Add To Repertoire</span>
              </button>

              {/* Search input - always visible across all screen sizes */}
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

              {/* FilterPanel - type/mode/genre/repertoire filters */}
              <FilterPanel
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
                loading={props.loading}
                hideRepertoireFilter={props.hideRepertoireFilter}
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
                <span>Add Tune</span>
              </button>

              {/* Delete Tunes button */}
              <button
                type="button"
                onClick={handleDeleteTunes}
                title="Delete selected tunes"
                data-testid="catalog-delete-button"
                disabled={
                  !props.selectedRowsCount || props.selectedRowsCount === 0
                }
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
                <span>Delete</span>
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
                  title="Display options"
                  data-testid="catalog-columns-button"
                  class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_NEUTRAL_ALT}`}
                >
                  <Columns size={14} />
                  <span>Display Options</span>
                  <svg
                    class="w-3.5 h-3.5"
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
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Column visibility menu */}
      <Show when={props.table}>
        <ColumnVisibilityMenu
          table={props.table!}
          isOpen={showColumnsDropdown()}
          onClose={() => setShowColumnsDropdown(false)}
          triggerRef={displayOptionsTriggerRef()}
          title="Display Options"
        />
      </Show>

      {/* Add Tune Dialog */}
      <AddTuneDialog
        open={showAddTuneDialog()}
        onOpenChange={setShowAddTuneDialog}
      />
    </>
  );
};
