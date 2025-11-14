/**
 * Playlist Editor Component
 *
 * Form for creating and editing playlists (repertoire lists).
 * Fields:
 * - Name (required - e.g., "My Irish Tunes")
 * - Genre Default (optional - default genre for tunes in this playlist)
 * - Instrument (optional - integer reference, deferred for now)
 * - SR Algorithm Type (optional - default "fsrs")
 *
 * @module components/playlists/PlaylistEditor
 */

import type { Component } from "solid-js";
import { createResource, createSignal, For, Show } from "solid-js";
import { genre } from "../../../drizzle/schema-sqlite";
import { useAuth } from "../../lib/auth/AuthContext";
import type { Playlist } from "../../lib/db/types";

interface PlaylistEditorProps {
  /** Playlist to edit (undefined for new playlist) */
  playlist?: Playlist;
  /** Callback when save is requested */
  onSave?: (playlistData: Partial<Playlist>) => void | Promise<void>;
  /** Callback when cancel is requested */
  onCancel?: () => void;
}

const SR_ALG_TYPES = [
  { value: "fsrs", label: "FSRS (Free Spaced Repetition Scheduler)" },
  { value: "sm2", label: "SM2 (SuperMemo 2)" },
];

/**
 * Playlist Editor Component
 *
 * @example
 * ```tsx
 * <PlaylistEditor
 *   playlist={existingPlaylist}
 *   onSave={handleSave}
 *   onCancel={() => navigate(-1)}
 * />
 * ```
 */
export const PlaylistEditor: Component<PlaylistEditorProps> = (props) => {
  const { localDb } = useAuth();

  // Form state signals
  const [name, setName] = createSignal(props.playlist?.name || "");
  const [genreDefault, setGenreDefault] = createSignal<string | null>(
    props.playlist?.genreDefault ?? null
  );
  const [instrumentRef, setInstrumentRef] = createSignal<string | null>(
    props.playlist?.instrumentRef ?? null
  );
  const [srAlgType, setSrAlgType] = createSignal(
    props.playlist?.srAlgType || "fsrs"
  );

  // UI state
  const [isSaving, setIsSaving] = createSignal(false);
  const [errors, setErrors] = createSignal<Record<string, string>>({});

  // Fetch available genres from database
  const [genres] = createResource(
    () => localDb(),
    async (db) => {
      if (!db) return [];
      return await db.select().from(genre).all();
    }
  );

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name().trim()) {
      newErrors.name = "Playlist name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setIsSaving(true);

    const playlistData: Partial<Playlist> = {
      name: name().trim(),
      genreDefault: genreDefault(),
      instrumentRef: instrumentRef(),
      srAlgType: srAlgType() || "fsrs",
    };

    try {
      await props.onSave?.(playlistData);
    } catch (error) {
      console.error("Save error:", error);
      setErrors({
        submit: "Failed to save playlist. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    props.onCancel?.();
  };

  return (
    <div class="w-full">
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          class="space-y-6"
        >
          {/* Action Buttons - at top as text links */}
          <div class="flex justify-start gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={isSaving()}
              class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Show when={isSaving()} fallback={<>Save</>}>
                <div class="animate-spin h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full" />
                Saving...
              </Show>
            </button>
            <button
              type="button"
              onClick={handleCancel}
              class="text-gray-700 dark:text-gray-300 hover:underline text-sm font-medium"
            >
              Cancel
            </button>
          </div>

          {/* Error message */}
          <Show when={errors().submit}>
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-sm text-red-600 dark:text-red-400">
                {errors().submit}
              </p>
            </div>
          </Show>

          {/* Playlist Info */}
          <Show when={props.playlist}>
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p class="text-sm text-blue-800 dark:text-blue-200">
                <strong>Playlist ID:</strong> {props.playlist?.playlistId}
              </p>
              <p class="text-sm text-blue-800 dark:text-blue-200 mt-1">
                <strong>User Ref:</strong> {props.playlist?.userRef}
              </p>
            </div>
          </Show>

          {/* Playlist Name */}
          <div class="space-y-2">
            <label
              for="playlist-name"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Playlist Name <span class="text-red-500">*</span>
            </label>
            <input
              id="playlist-name"
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="e.g., My Irish Tunes, Bluegrass Practice"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              classList={{ "border-red-500": !!errors().name }}
            />
            <Show when={errors().name}>
              <p class="text-xs text-red-500">{errors().name}</p>
            </Show>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Give your playlist a descriptive name (e.g., "My Irish Tunes",
              "Beginner Bluegrass")
            </p>
          </div>

          {/* Genre Default */}
          <div class="space-y-2">
            <label
              for="genre-default"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Default Genre
            </label>
            <select
              id="genre-default"
              value={genreDefault() ?? ""}
              onChange={(e) => setGenreDefault(e.currentTarget.value || null)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">No default genre</option>
              <Show when={!genres.loading}>
                <For each={genres()}>
                  {(g) => (
                    <option value={g.id}>
                      {g.id} - {g.name || "Unnamed Genre"}
                    </option>
                  )}
                </For>
              </Show>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Set a default genre for tunes in this playlist (e.g., ITRAD, BGRA,
              OTIME)
            </p>
          </div>

          {/* Instrument Reference */}
          <div class="space-y-2">
            <label
              for="instrument-ref"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Instrument Reference{" "}
              <span class="text-xs text-gray-500">
                (Optional - for future use)
              </span>
            </label>
            <input
              id="instrument-ref"
              type="number"
              value={instrumentRef() ?? ""}
              onInput={(e) => {
                const value = e.currentTarget.value;
                setInstrumentRef(value || null);
              }}
              placeholder="Leave blank for now"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              classList={{ "border-red-500": !!errors().instrumentRef }}
              disabled
            />
            <Show when={errors().instrumentRef}>
              <p class="text-xs text-red-500">{errors().instrumentRef}</p>
            </Show>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Instrument management will be added in a future update.
            </p>
          </div>

          {/* SR Algorithm Type */}
          <div class="space-y-2">
            <label
              for="sr-alg-type"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Spaced Repetition Algorithm
            </label>
            <select
              id="sr-alg-type"
              value={srAlgType()}
              onChange={(e) => setSrAlgType(e.currentTarget.value)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              {SR_ALG_TYPES.map((alg) => (
                <option value={alg.value}>{alg.label}</option>
              ))}
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Choose the spaced repetition algorithm for this playlist's
              practice scheduling.
            </p>
          </div>

          {/* Info about sync metadata */}
          <div class="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-600 dark:text-gray-400">
              <strong>Note:</strong> Sync metadata (syncVersion, lastModifiedAt,
              deviceId) will be automatically managed when you save.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
