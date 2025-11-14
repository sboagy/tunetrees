/**
 * Playlist Editor Dialog Component
 *
 * Modal dialog for creating and editing playlists.
 * Wraps PlaylistEditor in a modal overlay to avoid route navigation.
 *
 * Features:
 * - Modal overlay with backdrop
 * - Create or edit mode
 * - Save and Cancel buttons at top
 * - Close via X button, backdrop click, or Escape key
 * - Dark mode support
 *
 * @module components/playlists/PlaylistEditorDialog
 */

import { X } from "lucide-solid";
import type { Component } from "solid-js";
import { createResource, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import {
  createPlaylist,
  getPlaylistById,
  updatePlaylist,
} from "../../lib/db/queries/playlists";
import type { Playlist } from "../../lib/db/types";
import { PlaylistEditor } from "./PlaylistEditor";

interface PlaylistEditorDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Playlist ID to edit (undefined for new playlist) */
  playlistId?: string;
  /** Callback after successful save */
  onSaved?: () => void;
}

/**
 * Playlist Editor Dialog Component
 *
 * @example
 * ```tsx
 * <PlaylistEditorDialog
 *   isOpen={showEditor()}
 *   onClose={() => setShowEditor(false)}
 *   playlistId={selectedPlaylistId()}
 *   onSaved={() => refetchPlaylists()}
 * />
 * ```
 */
export const PlaylistEditorDialog: Component<PlaylistEditorDialogProps> = (
  props
) => {
  const { user, localDb } = useAuth();

  // Fetch playlist data if editing
  const [playlist] = createResource(
    () => {
      const userId = user()?.id;
      const db = localDb();
      const playlistId = props.playlistId;
      return userId && db && playlistId && props.isOpen
        ? { userId, db, playlistId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      return await getPlaylistById(params.db, params.playlistId, params.userId);
    }
  );

  const handleSave = async (playlistData: Partial<Playlist>) => {
    const userId = user()?.id;
    const db = localDb();

    if (!userId || !db) {
      console.error("Cannot save playlist: missing user or database");
      alert("Error: User not authenticated or database not available");
      return;
    }

    try {
      if (props.playlistId) {
        // Update existing playlist
        await updatePlaylist(db, props.playlistId, userId, playlistData);
        console.log("Playlist updated:", props.playlistId);
      } else {
        // Create new playlist
        const newPlaylist = await createPlaylist(db, userId, {
          name: playlistData.name ?? "Untitled Playlist",
          genreDefault: playlistData.genreDefault ?? null,
          instrumentRef: playlistData.instrumentRef ?? null,
          srAlgType: playlistData.srAlgType ?? "fsrs",
        });
        console.log("Playlist created:", newPlaylist);
      }

      // Notify parent and close dialog
      props.onSaved?.();
      props.onClose();
    } catch (error) {
      console.error("Failed to save playlist:", error);
      throw error; // Let PlaylistEditor handle the error display
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop - higher z-index to appear over manager dialog */}
      <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
        onKeyDown={handleKeyDown}
        aria-label="Close modal backdrop"
        data-testid="playlist-editor-backdrop"
      />

      {/* Dialog - higher z-index to appear over manager dialog */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Dialog is modal and has backdrop for closing */}
      <div
        class="fixed left-1/2 top-1/2 z-[70] w-[95vw] max-w-2xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-editor-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="playlist-editor-dialog"
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="playlist-editor-title"
            class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white"
          >
            {props.playlistId ? "Edit Playlist" : "Create New Playlist"}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close dialog"
            data-testid="close-playlist-editor"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div class="flex-1 overflow-y-auto p-4 sm:p-6">
          <Show
            when={!props.playlistId || !playlist.loading}
            fallback={
              <div class="flex items-center justify-center py-12">
                <div class="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            }
          >
            <PlaylistEditor
              playlist={playlist() ?? undefined}
              onSave={handleSave}
              onCancel={props.onClose}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
};
