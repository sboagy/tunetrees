/**
 * Playlist Selector Component
 *
 * Dropdown for selecting active playlist.
 * Persists selection to localStorage and provides callback on change.
 *
 * Features:
 * - Shows all user playlists
 * - Displays selected repertoire name
 * - Persists selection across sessions
 * - Loads playlists from local SQLite
 * - Auto-selects default playlist if none selected
 *
 * @module components/playlists/PlaylistSelector
 */

import {
  type Component,
  createEffect,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getUserPlaylists } from "../../lib/db/queries/playlists";
import type { PlaylistWithSummary } from "../../lib/db/types";
import {
  getSelectedPlaylistId,
  setSelectedPlaylistId,
} from "../../lib/services/playlist-service";

interface PlaylistSelectorProps {
  /**
   * Callback when playlist selection changes
   */
  onPlaylistChange?: (playlistId: string) => void;

  /**
   * CSS class for styling
   */
  class?: string;
}

/**
 * Playlist Selector Component
 *
 * @example
 * ```tsx
 * <PlaylistSelector
 *   onPlaylistChange={(id) => console.log('Selected:', id)}
 *   class="w-64"
 * />
 * ```
 */
export const PlaylistSelector: Component<PlaylistSelectorProps> = (props) => {
  const { user, localDb } = useAuth();
  const [playlists, setPlaylists] = createSignal<PlaylistWithSummary[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistIdSignal] = createSignal<
    string | null
  >(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [isOpen, setIsOpen] = createSignal(false);

  // Load playlists on mount
  createEffect(() => {
    const db = localDb();
    const currentUser = user();

    if (!db || !currentUser) return;

    loadPlaylists();
  });

  async function loadPlaylists() {
    const db = localDb();
    const currentUser = user();

    if (!db || !currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // Get all playlists
      const userPlaylists = await getUserPlaylists(db, currentUser.id);
      setPlaylists(userPlaylists);

      // Get stored selection or default to first playlist
      let storedSelection = getSelectedPlaylistId(currentUser.id);

      if (!storedSelection && userPlaylists.length > 0) {
        // Default to first playlist
        storedSelection = userPlaylists[0].playlistId;
        setSelectedPlaylistId(currentUser.id, storedSelection);
      }

      setSelectedPlaylistIdSignal(storedSelection);

      // Notify parent of initial selection
      if (storedSelection && props.onPlaylistChange) {
        props.onPlaylistChange(storedSelection);
      }
    } catch (err) {
      console.error("Error loading playlists:", err);
      setError(err instanceof Error ? err.message : "Failed to load playlists");
    } finally {
      setLoading(false);
    }
  }

  function handlePlaylistSelect(playlistId: string) {
    const currentUser = user();
    if (!currentUser) return;

    setSelectedPlaylistIdSignal(playlistId);
    setSelectedPlaylistId(currentUser.id, playlistId);
    setIsOpen(false);

    // Notify parent
    if (props.onPlaylistChange) {
      props.onPlaylistChange(playlistId);
    }
  }

  const selectedPlaylist = () => {
    const id = selectedPlaylistId();
    if (!id) return null;
    return playlists().find((p) => p.playlistId === id);
  };

  return (
    <div class={`relative ${props.class || ""}`}>
      {/* Selected Playlist Display / Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        disabled={loading() || playlists().length === 0}
        class="w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center"
      >
        <Show
          when={!loading() && selectedPlaylist()}
          fallback={
            <span class="text-gray-500 dark:text-gray-400">
              {loading() ? "Loading playlists..." : "No playlists"}
            </span>
          }
        >
          <div class="flex-1">
            <div class="font-medium text-gray-900 dark:text-white">
              {selectedPlaylist()?.name ||
                selectedPlaylist()?.instrumentName ||
                "Unnamed Playlist"}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {selectedPlaylist()?.tuneCount || 0} tune
              {selectedPlaylist()?.tuneCount !== 1 ? "s" : ""}
            </div>
          </div>
        </Show>

        {/* Dropdown Arrow */}
        <svg
          class={`w-5 h-5 text-gray-400 transition-transform ${isOpen() ? "rotate-180" : ""}`}
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

      {/* Error Message */}
      <Show when={error()}>
        <div class="mt-2 text-sm text-red-600 dark:text-red-400">{error()}</div>
      </Show>

      {/* Dropdown Menu */}
      <Show when={isOpen() && playlists().length > 0}>
        <div class="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <For each={playlists()}>
            {(playlist) => (
              <button
                type="button"
                onClick={() => handlePlaylistSelect(playlist.playlistId)}
                class={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  playlist.playlistId === selectedPlaylistId()
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : ""
                }`}
              >
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">
                      {playlist.name ||
                        playlist.instrumentName ||
                        "Unnamed Playlist"}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {playlist.tuneCount}{" "}
                      {playlist.tuneCount === 1 ? "tune" : "tunes"}
                      <Show when={playlist.genreDefault}>
                        {" • "}
                        {playlist.genreDefault}
                      </Show>
                    </div>
                  </div>

                  {/* Selected Checkmark */}
                  <Show when={playlist.playlistId === selectedPlaylistId()}>
                    <svg
                      class="w-5 h-5 text-blue-600 dark:text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </Show>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Click Outside Handler */}
      <Show when={isOpen()}>
        <div
          class="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      </Show>
    </div>
  );
};
