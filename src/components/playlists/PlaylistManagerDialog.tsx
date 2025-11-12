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
import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { Show } from "solid-js";
import { PlaylistList } from "./PlaylistList";
import type { PlaylistWithSummary } from "../../lib/db/types";

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
  const navigate = useNavigate();

  const handlePlaylistSelect = (playlist: PlaylistWithSummary) => {
    // Close dialog and navigate to edit page
    props.onClose();
    navigate(`/playlists/${playlist.playlistId}/edit`);
  };

  const handlePlaylistDeleted = (playlistId: string) => {
    console.log("Playlist deleted:", playlistId);
    // PlaylistList will automatically refetch, no action needed
  };

  const handleCreateNew = () => {
    // Close dialog and navigate to new playlist page
    props.onClose();
    navigate("/playlists/new");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
        onKeyDown={handleKeyDown}
        aria-label="Close modal backdrop"
        data-testid="playlist-manager-backdrop"
      />

      {/* Dialog */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Dialog is modal and has backdrop for closing */}
      <div
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-6xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-manager-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="playlist-manager-dialog"
      >
        {/* Header */}
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2
              id="playlist-manager-title"
              class="text-2xl font-bold text-gray-900 dark:text-white"
            >
              Manage Playlists
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create, edit, and organize your practice playlists
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateNew}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
              data-testid="create-playlist-button"
            >
              <svg
                class="w-5 h-5"
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
              Create New Playlist
            </button>
            <button
              type="button"
              onClick={props.onClose}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
              data-testid="close-playlist-manager"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div class="flex-1 overflow-y-auto p-6">
          <PlaylistList
            onPlaylistSelect={handlePlaylistSelect}
            onPlaylistDeleted={handlePlaylistDeleted}
          />
        </div>
      </div>
    </Show>
  );
};
