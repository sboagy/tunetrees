/**
 * Playlists Page
 *
 * Displays list of user's playlists with CRUD actions.
 *
 * @module routes/playlists
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { PlaylistList } from "../../components/playlists/PlaylistList";
import type { PlaylistWithSummary } from "../../lib/db/types";

/**
 * Playlists Page Component
 */
const PlaylistsPage: Component = () => {
  const navigate = useNavigate();

  const handlePlaylistSelect = (playlist: PlaylistWithSummary) => {
    console.log("Playlist selected:", playlist);
    navigate(`/playlists/${playlist.playlistId}/edit`);
  };

  const handlePlaylistDeleted = (playlistId: string) => {
    console.log("Playlist deleted:", playlistId);
    // PlaylistList will automatically refetch, no action needed
  };

  const handleCreateNew = () => {
    navigate("/playlists/new");
  };

  return (
    <div class="container mx-auto px-4 py-8">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Playlists
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            Manage your practice playlists
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateNew}
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
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
      </div>

      <PlaylistList
        onPlaylistSelect={handlePlaylistSelect}
        onPlaylistDeleted={handlePlaylistDeleted}
      />
    </div>
  );
};

export default PlaylistsPage;
