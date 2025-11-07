/**
 * Edit Playlist Page
 *
 * Page for editing an existing playlist.
 *
 * @module routes/playlists/[id]/edit
 */

import { useNavigate, useParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { createResource, Show } from "solid-js";
import { PlaylistEditor } from "../../../components/playlists/PlaylistEditor";
import { useAuth } from "../../../lib/auth/AuthContext";
import {
  getPlaylistById,
  updatePlaylist,
} from "../../../lib/db/queries/playlists";
import type { Playlist } from "../../../lib/db/types";

/**
 * Edit Playlist Page Component
 */
const EditPlaylistPage: Component = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const { user, localDb } = useAuth();

  // Fetch playlist data
  const [playlist] = createResource(
    () => {
      const userId = user()?.id;
      const db = localDb();
      const playlistId = params.id;
      return userId && db && playlistId ? { userId, db, playlistId } : null;
    },
    async (params) => {
      if (!params) return null;
      return await getPlaylistById(params.db, params.playlistId, params.userId);
    }
  );

  const handleSave = async (playlistData: Partial<Playlist>) => {
    const userId = user()?.id;
    const db = localDb();
    const playlistId = params.id;

    if (!userId || !db || !playlistId) {
      console.error("Cannot update playlist: missing user, database, or ID");
      alert("Error: Invalid playlist or user data");
      return;
    }

    try {
      await updatePlaylist(db, playlistId, userId, {
        name: playlistData.name,
        genreDefault: playlistData.genreDefault,
        instrumentRef: playlistData.instrumentRef,
        srAlgType: playlistData.srAlgType,
      });

      console.log("Playlist updated:", playlistId);

      // Navigate back to playlists list
      navigate("/playlists");
    } catch (error) {
      console.error("Failed to update playlist:", error);
      throw error; // Let PlaylistEditor handle the error display
    }
  };

  const handleCancel = () => {
    navigate("/playlists");
  };

  return (
    <div class="container mx-auto px-4 py-8">
      <Show
        when={!playlist.loading}
        fallback={
          <div class="text-center py-12">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              Loading playlist...
            </p>
          </div>
        }
      >
        <Show
          when={playlist()}
          fallback={
            <div class="text-center py-12">
              <p class="text-lg text-red-600 dark:text-red-400">
                Playlist not found or you don't have permission to edit it.
              </p>
              <button
                type="button"
                onClick={() => navigate("/playlists")}
                class="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Back to Playlists
              </button>
            </div>
          }
        >
          {(loadedPlaylist) => (
            <PlaylistEditor
              playlist={loadedPlaylist()}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </Show>
      </Show>
    </div>
  );
};

export default EditPlaylistPage;
