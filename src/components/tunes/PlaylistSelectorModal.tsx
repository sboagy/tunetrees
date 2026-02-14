import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { getUserPlaylists } from "@/lib/db/queries/playlists";
import type { PlaylistWithSummary } from "@/lib/db/types";

/**
 * PlaylistSelectorModal Component
 *
 * Modal dialog for selecting a playlist to add tunes to.
 * Displays all user playlists with tune counts.
 *
 * Features:
 * - Lists all user playlists
 * - Shows tune count for each playlist
 * - Handles selection and submission
 * - Keyboard support (Escape to cancel)
 * - Dark mode support
 *
 * @example
 * ```tsx
 * <PlaylistSelectorModal
 *   isOpen={showModal()}
 *   tuneCount={selectedTunes().length}
 *   onSelect={handlePlaylistSelect}
 *   onCancel={() => setShowModal(false)}
 * />
 * ```
 */

interface PlaylistSelectorModalProps {
  isOpen: boolean;
  tuneCount: number;
  onSelect: (playlistId: string) => void;
  onCancel: () => void;
}

export const PlaylistSelectorModal: Component<PlaylistSelectorModalProps> = (
  props
) => {
  const { localDb, user } = useAuth();
  const [selectedPlaylistId, setSelectedPlaylistId] = createSignal<
    string | null
  >(null);

  // Fetch user playlists
  const [playlists] = createResource(async () => {
    const db = localDb();
    const userId = user()?.id;

    if (!db || !userId) {
      return [];
    }

    return await getUserPlaylists(db, userId);
  });

  const handleSelect = () => {
    const playlistId = selectedPlaylistId();
    if (playlistId !== null) {
      props.onSelect(playlistId);
      setSelectedPlaylistId(null); // Reset selection
    }
  };

  const handleCancel = () => {
    setSelectedPlaylistId(null); // Reset selection
    props.onCancel();
  };

  // Keyboard event handler
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  // Add keyboard listener when modal opens
  if (props.isOpen) {
    document.addEventListener("keydown", handleKeyDown);
  } else {
    document.removeEventListener("keydown", handleKeyDown);
  }

  return (
    <Show when={props.isOpen}>
      <button
        type="button"
        class="fixed inset-0 z-40 bg-black/50 dark:bg-black/70 cursor-default"
        onClick={handleCancel}
        aria-label="Close modal backdrop"
      />
      <div
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-modal-title"
      >
        <h2
          id="playlist-modal-title"
          class="mb-4 text-xl font-semibold text-gray-900 dark:text-white"
        >
          Add to Playlist
        </h2>

        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Select a playlist to add {props.tuneCount}{" "}
          {props.tuneCount === 1 ? "tune" : "tunes"}:
        </p>

        <Show
          when={!playlists.loading}
          fallback={
            <div class="py-8 text-center text-gray-500 dark:text-gray-400">
              Loading playlists...
            </div>
          }
        >
          <Show
            when={playlists() && playlists()!.length > 0}
            fallback={
              <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                No playlists found. Create a playlist first.
              </div>
            }
          >
            <div class="mb-6 max-h-96 space-y-2 overflow-y-auto">
              <For each={playlists()}>
                {(playlistItem: PlaylistWithSummary) => (
                  <button
                    type="button"
                    class={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                      selectedPlaylistId() === playlistItem.repertoireId
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                    }`}
                    onClick={() =>
                      setSelectedPlaylistId(playlistItem.repertoireId)
                    }
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-white">
                          {playlistItem.name}
                        </div>
                        <div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {playlistItem.tuneCount}{" "}
                          {playlistItem.tuneCount === 1 ? "tune" : "tunes"}
                        </div>
                      </div>
                      <Show
                        when={selectedPlaylistId() === playlistItem.repertoireId}
                      >
                        <svg
                          class="h-5 w-5 text-blue-500 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <title>Selected</title>
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </Show>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            onClick={handleSelect}
            disabled={selectedPlaylistId() === null}
          >
            Add to Playlist
          </button>
        </div>
      </div>
    </Show>
  );
};
