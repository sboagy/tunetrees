/**
 * New Playlist Page
 *
 * Page for creating a new playlist.
 *
 * @module routes/playlists/new
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { PlaylistEditor } from "../../components/playlists/PlaylistEditor";
import { useAuth } from "../../lib/auth/AuthContext";
import { createPlaylist } from "../../lib/db/queries/playlists";
import type { Playlist } from "../../lib/db/types";

/**
 * New Playlist Page Component
 */
const NewPlaylistPage: Component = () => {
  const navigate = useNavigate();
  const { user, localDb } = useAuth();

  const handleSave = async (playlistData: Partial<Playlist>) => {
    const userId = user()?.id;
    const db = localDb();

    if (!userId || !db) {
      console.error("Cannot create playlist: missing user or database");
      alert("Error: User not authenticated or database not available");
      return;
    }

    try {
      const newPlaylist = await createPlaylist(db, userId, {
        name: playlistData.name ?? "Untitled Playlist",
        genreDefault: playlistData.genreDefault ?? null,
        instrumentRef: playlistData.instrumentRef ?? null,
        srAlgType: playlistData.srAlgType ?? "fsrs",
      });

      console.log("Playlist created:", newPlaylist);

      // Navigate back to playlists list
      navigate("/playlists");
    } catch (error) {
      console.error("Failed to create playlist:", error);
      throw error; // Let PlaylistEditor handle the error display
    }
  };

  const handleCancel = () => {
    navigate("/playlists");
  };

  return (
    <div class="container mx-auto px-4 py-8">
      <PlaylistEditor onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
};

export default NewPlaylistPage;
