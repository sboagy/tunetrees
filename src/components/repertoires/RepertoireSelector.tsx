/**
 * Repertoire Selector Component
 *
 * Dropdown for selecting active repertoire.
 * Persists selection to localStorage and provides callback on change.
 *
 * Features:
 * - Shows all user repertoires
 * - Displays selected repertoire name
 * - Persists selection across sessions
 * - Loads repertoires from local SQLite
 * - Auto-selects default repertoire if none selected
 *
 * @module components/repertoires/RepertoireSelector
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

interface RepertoireSelectorProps {
  /**
   * Callback when repertoire selection changes
   */
  onRepertoireChange?: (repertoireId: string) => void;

  /**
   * CSS class for styling
   */
  class?: string;
}

/**
 * Repertoire Selector Component
 *
 * @example
 * ```tsx
 * <RepertoireSelector
 *   onRepertoireChange={(id) => console.log('Selected:', id)}
 *   class="w-64"
 * />
 * ```
 */
export const RepertoireSelector: Component<RepertoireSelectorProps> = (props) => {
  const { user, localDb } = useAuth();
  const [repertoires, setRepertoires] = createSignal<PlaylistWithSummary[]>([]);
  const [selectedRepertoireId, setSelectedRepertoireIdSignal] = createSignal<
    string | null
  >(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [isOpen, setIsOpen] = createSignal(false);

  // Load repertoires on mount
  createEffect(() => {
    const db = localDb();
    const currentUser = user();

    if (!db || !currentUser) return;

    loadRepertoires();
  });

  async function loadRepertoires() {
    const db = localDb();
    const currentUser = user();

    if (!db || !currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // Get all repertoires
      const userRepertoires = await getUserPlaylists(db, currentUser.id);
      setRepertoires(userRepertoires);

      // Get stored selection or default to first repertoire
      let storedSelection = getSelectedPlaylistId(currentUser.id);

      if (!storedSelection && userRepertoires.length > 0) {
        // Default to first repertoire
        storedSelection = userRepertoires[0].playlistId;
        setSelectedPlaylistId(currentUser.id, storedSelection);
      }

      setSelectedRepertoireIdSignal(storedSelection);

      // Notify parent of initial selection
      if (storedSelection && props.onRepertoireChange) {
        props.onRepertoireChange(storedSelection);
      }
    } catch (err) {
      console.error("Error loading repertoires:", err);
      setError(err instanceof Error ? err.message : "Failed to load repertoires");
    } finally {
      setLoading(false);
    }
  }

  function handleRepertoireSelect(repertoireId: string) {
    const currentUser = user();
    if (!currentUser) return;

    setSelectedRepertoireIdSignal(repertoireId);
    setSelectedPlaylistId(currentUser.id, repertoireId);
    setIsOpen(false);

    // Notify parent
    if (props.onRepertoireChange) {
      props.onRepertoireChange(repertoireId);
    }
  }

  const selectedRepertoire = () => {
    const id = selectedRepertoireId();
    if (!id) return null;
    return repertoires().find((p) => p.playlistId === id);
  };

  return (
    <div class={`relative ${props.class || ""}`}>
      {/* Selected Repertoire Display / Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen())}
        disabled={loading() || repertoires().length === 0}
        class="w-full px-4 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between items-center"
      >
        <Show
          when={!loading() && selectedRepertoire()}
          fallback={
            <span class="text-gray-500 dark:text-gray-400">
              {loading() ? "Loading repertoires..." : "No repertoires"}
            </span>
          }
        >
          <div class="flex-1">
            <div class="font-medium text-gray-900 dark:text-white">
              {selectedRepertoire()?.name ||
                selectedRepertoire()?.instrumentName ||
                "Unnamed Repertoire"}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {selectedRepertoire()?.tuneCount || 0} tune
              {selectedRepertoire()?.tuneCount !== 1 ? "s" : ""}
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
      <Show when={isOpen() && repertoires().length > 0}>
        <div class="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <For each={repertoires()}>
            {(repertoire) => (
              <button
                type="button"
                onClick={() => handleRepertoireSelect(repertoire.playlistId)}
                class={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  repertoire.playlistId === selectedRepertoireId()
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : ""
                }`}
              >
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-white">
                      {repertoire.name ||
                        repertoire.instrumentName ||
                        "Unnamed Repertoire"}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {repertoire.tuneCount}{" "}
                      {repertoire.tuneCount === 1 ? "tune" : "tunes"}
                      <Show when={repertoire.genreDefault}>
                        {" • "}
                        {repertoire.genreDefault}
                      </Show>
                    </div>
                  </div>

                  {/* Selected Checkmark */}
                  <Show when={repertoire.playlistId === selectedRepertoireId()}>
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
