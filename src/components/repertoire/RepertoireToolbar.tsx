/**
 * Repertoire Toolbar Component
 *
 * Toolbar for the Repertoire tab with complete controls.
 * Layout: Add To Review | Filter textbox | Filters | Add Tune | Remove From Repertoire | Columns
 *
 * Features:
 * - Add To Review button with icon (left-most)
 * - Responsive filter textbox (min-width 12ch)
 * - Combined filter dropdown (Type, Mode, Genre - NO Playlist filter)
 * - Add Tune button with + icon (opens AddTuneDialog)
 * - Remove From Repertoire button (enabled when rows selected, shows confirmation)
 * - Columns dropdown
 * - Tooltips for all controls
 * - Responsive text labels
 *
 * @module components/repertoire/RepertoireToolbar
 */

import type { Table } from "@tanstack/solid-table";
import { Columns } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getDb, persistDb } from "../../lib/db/client-sqlite";
import { removeTuneFromPlaylist } from "../../lib/db/queries/playlists";
import { addTunesToPracticeQueue } from "../../lib/db/queries/practice";
import { generateOrGetPracticeQueue } from "../../lib/services/practice-queue";
import { ColumnVisibilityMenu } from "../catalog/ColumnVisibilityMenu";
import { FilterPanel } from "../catalog/FilterPanel";
import {
  TOOLBAR_BUTTON_BASE,
  TOOLBAR_BUTTON_GROUP_CLASSES,
  TOOLBAR_BUTTON_NEUTRAL_ALT,
  TOOLBAR_BUTTON_PRIMARY,
  TOOLBAR_BUTTON_SUCCESS,
  TOOLBAR_BUTTON_WARNING,
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";

export interface RepertoireToolbarProps {
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
  /** Available types */
  availableTypes: string[];
  /** Available modes */
  availableModes: string[];
  /** Available genres */
  availableGenres: string[];
  /** Selected rows count for Remove button state */
  selectedRowsCount?: number;
  /** Table instance for column visibility control and row selection */
  table?: Table<ITuneOverview>;
  /** Playlist ID for adding tunes to practice queue */
  playlistId?: string;
}

export const RepertoireToolbar: Component<RepertoireToolbarProps> = (props) => {
  const {
    incrementPracticeListStagedChanged,
    incrementRepertoireListChanged,
    forceSyncUp,
    user,
    userIdInt,
  } = useAuth();
  const [showColumnsDropdown, setShowColumnsDropdown] = createSignal(false);
  const [showAddTuneDialog, setShowAddTuneDialog] = createSignal(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = createSignal(false);
  const [isRemoving, setIsRemoving] = createSignal(false);
  let columnsDropdownRef: HTMLDivElement | undefined;
  let columnsButtonRef: HTMLButtonElement | undefined;

  const handleAddToReview = async () => {
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

      // Get selected rows
      const selectedRows = props.table.getSelectedRowModel().rows;
      if (selectedRows.length === 0) {
        alert(
          "No tunes selected. Please select tunes to add to practice queue."
        );
        return;
      }

      // Extract tune IDs
      const tuneIds = selectedRows.map((row) => row.original.id);
      console.log(`Adding ${tuneIds.length} tunes to practice queue:`, tuneIds);

      // Call database function
      const db = getDb();
      const result = await addTunesToPracticeQueue(
        db,
        props.playlistId,
        tuneIds
      );

      // Show feedback
      let message = "";
      if (result.added > 0) {
        message += `Added ${result.added} tune${result.added > 1 ? "s" : ""} to practice queue.`;
      }
      if (result.skipped > 0) {
        message += ` ${result.skipped} tune${result.skipped > 1 ? "s were" : " was"} already scheduled.`;
      }
      alert(message || "No tunes were added.");

      // Clear selection
      props.table.resetRowSelection();

      // Regenerate practice queue to include newly added tunes
      console.log("🔄 [AddToReview] Regenerating practice queue...");
      const currentUserIdInt = userIdInt();
      if (currentUserIdInt && props.playlistId) {
        try {
          await generateOrGetPracticeQueue(
            db,
            currentUserIdInt,
            props.playlistId,
            new Date(),
            null,
            "per_day",
            true // force regeneration to pick up newly added tunes
          );
          console.log("✅ Practice queue regenerated");
        } catch (err) {
          console.error("Error regenerating practice queue:", err);
        }
      }

      // Force sync up to Supabase BEFORE triggering UI refresh
      console.log("🔄 [AddToReview] Syncing changes to Supabase...");
      await forceSyncUp();

      // Trigger practice list refresh using view-specific signal
      incrementPracticeListStagedChanged();

      console.log("Add to review completed:", result);
    } catch (error) {
      console.error("Error adding tunes to practice queue:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Failed to add tunes to practice queue"}`
      );
    }
  };

  const handleAddTune = () => {
    setShowAddTuneDialog(true);
  };

  const removeSelectedFromRepertoire = async (): Promise<void> => {
    if (!props.table) return;
    if (!props.playlistId) return;

    const currentUserId = user()?.id;
    if (!currentUserId) return;

    const selectedRows = props.table.getSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const tuneIds = selectedRows.map((row) => row.original.id);

    const db = getDb();

    setIsRemoving(true);
    try {
      // Soft-delete playlist_tune rows so they disappear from repertoire immediately
      await Promise.all(
        tuneIds.map((tuneId) =>
          removeTuneFromPlaylist(db, props.playlistId!, tuneId, currentUserId)
        )
      );

      // Persist local DB to IndexedDB so offline reload keeps the deletion
      await persistDb();

      // Clear selection and refresh repertoire list
      props.table.resetRowSelection();
      incrementRepertoireListChanged();

      // If we happen to be online, push immediately; if offline, outbox will flush later
      if (navigator.onLine) {
        await forceSyncUp();
      }
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRemoveFromRepertoire = async () => {
    setShowRemoveConfirm(true);
  };

  const handleColumnsToggle = () => {
    setShowColumnsDropdown(!showColumnsDropdown());
  };

  return (
    <div class={TOOLBAR_CONTAINER_CLASSES}>
      {/* Main toolbar */}
      <div class={TOOLBAR_INNER_CLASSES}>
        <div class={TOOLBAR_BUTTON_GROUP_CLASSES}>
          {/* Add To Review button - left-most */}
          <button
            type="button"
            onClick={handleAddToReview}
            title="Add selected tunes to practice review queue"
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_PRIMARY}`}
            data-testid="add-to-review-button"
            disabled={!props.table}
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
            <span class="hidden md:inline">Add To Review</span>
            <span class="hidden sm:inline md:hidden">Review</span>
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

          {/* FilterPanel - search shows inside on mobile, NO Playlist filter */}
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
            availablePlaylists={[]}
            selectedPlaylistIds={[]}
            onPlaylistIdsChange={() => {}}
            hidePlaylistFilter={true}
          />

          {/* Add Tune button */}
          <button
            type="button"
            onClick={handleAddTune}
            title="Add a new tune"
            data-testid="repertoire-add-tune-button"
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

          {/* Remove From Repertoire button */}
          <button
            type="button"
            onClick={handleRemoveFromRepertoire}
            title="Remove selected tunes from repertoire"
            data-testid="repertoire-remove-button"
            disabled={!props.selectedRowsCount || props.selectedRowsCount === 0}
            class={`${TOOLBAR_BUTTON_BASE} ${TOOLBAR_BUTTON_WARNING}`}
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
                d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span class="hidden md:inline">Remove From Repertoire</span>
            <span class="hidden sm:inline md:hidden">Remove</span>
          </button>
        </div>

        {/* Spacer to push Columns to the right */}
        <div class={TOOLBAR_SPACER} />

        {/* Columns dropdown */}
        <div class="relative" ref={columnsDropdownRef!}>
          <button
            ref={columnsButtonRef!}
            type="button"
            onClick={handleColumnsToggle}
            title="Show/hide columns"
            data-testid="repertoire-columns-button"
            aria-expanded={showColumnsDropdown()}
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

      {/* Add Tune Dialog */}
      <AddTuneDialog
        open={showAddTuneDialog()}
        onOpenChange={setShowAddTuneDialog}
      />

      {/* Confirm Remove From Repertoire Dialog */}
      <AlertDialog
        open={showRemoveConfirm()}
        onOpenChange={setShowRemoveConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove selected tunes?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected tunes from your repertoire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveConfirm(false)}
              disabled={isRemoving()}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await removeSelectedFromRepertoire();
                setShowRemoveConfirm(false);
              }}
              disabled={isRemoving()}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
