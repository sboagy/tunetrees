/**
 * Playlist Manager Dialog Component
 *
 * Modal dialog for managing user's playlists (create, edit, delete).
 * Replaces the full-page /playlists route with a modal dialog approach
 * matching the legacy app's "Edit Repertoire List" dialog.
 *
 * Features:
 * - Modal overlay with backdrop
 * - Table-based playlist list display
 * - Create new playlist button
 * - Edit/Delete actions
 * - Keyboard support (Escape to close)
 * - Dark mode support
 *
 * @module components/playlists/PlaylistManagerDialog
 */

import { X } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import type { PlaylistWithSummary } from "../../lib/db/types";
import { PlaylistEditorDialog } from "./PlaylistEditorDialog";
import { PlaylistList } from "./PlaylistList";

interface PlaylistManagerDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
}

/**
 * Playlist Manager Dialog Component
 *
 * @example
 * ```tsx
 * <PlaylistManagerDialog
 *   isOpen={showDialog()}
 *   onClose={() => setShowDialog(false)}
 * />
 * ```
 */
export const PlaylistManagerDialog: Component<PlaylistManagerDialogProps> = (
  props
) => {
  const { incrementRepertoireListChanged } = useAuth();
  const [showEditorDialog, setShowEditorDialog] = createSignal(false);
  const [editingPlaylistId, setEditingPlaylistId] = createSignal<
    string | undefined
  >(undefined);

  // Handle Escape key to close dialog
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.isOpen) {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handlePlaylistSelect = (playlist: PlaylistWithSummary) => {
    // Open editor dialog instead of navigating
    setEditingPlaylistId(playlist.playlistId);
    setShowEditorDialog(true);
  };

  const handlePlaylistDeleted = (playlistId: string) => {
    console.log("Playlist deleted:", playlistId);
    // Trigger global playlist list refresh
    incrementRepertoireListChanged();
  };

  const handleCreateNew = () => {
    // Open editor dialog for new playlist
    setEditingPlaylistId(undefined);
    setShowEditorDialog(true);
  };

  const handleEditorClose = () => {
    setShowEditorDialog(false);
    setEditingPlaylistId(undefined);
  };

  const handleEditorSaved = () => {
    // Trigger global playlist list refresh
    incrementRepertoireListChanged();
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") props.onClose();
        }}
        aria-label="Close modal backdrop"
        data-testid="playlist-manager-backdrop"
      />

      {/* Dialog */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Dialog is modal and has backdrop for closing */}
      <div
        class="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-4xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-manager-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="playlist-manager-dialog"
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="min-w-0 flex-1">
            <h2
              id="playlist-manager-title"
              class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate"
            >
              Manage Playlists
            </h2>
            <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 hidden sm:block">
              Create, edit, and organize your practice playlists
            </p>
          </div>
          <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={handleCreateNew}
              class="px-3 py-2 sm:px-4 text-xs sm:text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-1 sm:gap-2"
              data-testid="create-playlist-button"
            >
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5"
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
              <span class="hidden sm:inline">Create New Playlist</span>
              <span class="sm:hidden">New</span>
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
              data-testid="close-playlist-manager"
            >
              <X size={20} class="sm:hidden" />
              <X size={24} class="hidden sm:block" />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div class="flex-1 overflow-auto p-4 sm:p-6">
          <PlaylistList
            onPlaylistSelect={handlePlaylistSelect}
            onPlaylistDeleted={handlePlaylistDeleted}
          />
        </div>
      </div>

      {/* Nested Editor Dialog */}
      <PlaylistEditorDialog
        isOpen={showEditorDialog()}
        onClose={handleEditorClose}
        playlistId={editingPlaylistId()}
        onSaved={handleEditorSaved}
      />
    </Show>
  );
};
