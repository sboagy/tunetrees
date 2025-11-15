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

import { CircleX, Save } from "lucide-solid";
import type { Component } from "solid-js";
import {
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
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
  const [playlist, { refetch }] = createResource(
    () => {
      const userId = user()?.id;
      const db = localDb();
      const playlistId = props.playlistId;
      const isOpen = props.isOpen; // Track dialog open state
      return userId && db && playlistId && isOpen
        ? { userId, db, playlistId }
        : null;
    },
    async (params) => {
      if (!params) return null;
      const result = await getPlaylistById(
        params.db,
        params.playlistId,
        params.userId
      );
      return result;
    }
  );

  // Refs to form data and validation functions
  let getFormData: (() => Partial<Playlist> | null) | undefined;
  let getIsValid: (() => boolean) | undefined;
  let setError: ((error: string | null) => void) | undefined;

  const [isSaving, setIsSaving] = createSignal(false);

  // Handle Escape key to close dialog
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.isOpen && !isSaving()) {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  const handleSave = async () => {
    const userId = user()?.id;
    const db = localDb();

    if (!userId || !db) {
      console.error("Cannot save playlist: missing user or database");
      setError?.("Error: User not authenticated or database not available");
      return;
    }

    // Get form data from PlaylistEditor
    const playlistData = getFormData?.();
    if (!playlistData) {
      // Validation failed, error already shown in form
      return;
    }

    setIsSaving(true);
    setError?.(null); // Clear any previous errors

    try {
      if (props.playlistId) {
        // Update existing playlist
        await updatePlaylist(db, props.playlistId, userId, playlistData);
      } else {
        // Create new playlist
        await createPlaylist(db, userId, {
          name: playlistData.name ?? "Untitled Playlist",
          genreDefault: playlistData.genreDefault ?? null,
          instrumentRef: playlistData.instrumentRef ?? null,
          srAlgType: playlistData.srAlgType ?? "fsrs",
        });
      }

      // Notify parent and close dialog
      props.onSaved?.();
      props.onClose();
    } catch (error) {
      console.error("Failed to save playlist:", error);
      setError?.("Failed to save playlist. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      {/* Backdrop - higher z-index to appear over manager dialog */}
      <button
        type="button"
        class="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 cursor-default"
        onClick={props.onClose}
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
          <div class="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving()}
              class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label="Save playlist"
              data-testid="save-playlist-button"
            >
              <Show
                when={isSaving()}
                fallback={
                  <>
                    Save <Save size={24} />
                  </>
                }
              >
                <div class="animate-spin h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full" />
                Saving...
              </Show>
            </button>
            <button
              type="button"
              onClick={props.onClose}
              disabled={isSaving()}
              class="text-gray-700 dark:text-gray-300 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel and close dialog"
              data-testid="cancel-playlist-button"
            >
              <div class="flex items-center gap-2">
                <span>Cancel</span>
                <CircleX size={20} />
              </div>
            </button>
            {/* <button
              type="button"
              onClick={props.onClose}
              disabled={isSaving()}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close dialog"
              data-testid="close-playlist-editor"
            >
              <X size={24} />
            </button> */}
          </div>
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
              onGetFormData={(getter) => {
                getFormData = getter;
              }}
              onGetIsValid={(getter) => {
                getIsValid = getter;
              }}
              onSetError={(setter) => {
                setError = setter;
              }}
            />
          </Show>
        </div>
      </div>
    </Show>
  );
};
