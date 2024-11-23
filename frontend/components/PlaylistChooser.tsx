"use client";

import { usePlaylist } from "@/app/(main)/pages/practice/components/CurrentPlaylistProvider";
import { useTuneDataRefresh } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import {
  type IPlaylist,
  getPlaylists,
} from "@/app/(main)/pages/practice/queries";
import {
  type ITabGroupMainStateModel,
  getTabGroupMainState,
} from "@/app/(main)/pages/practice/settings";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function PlaylistChooser() {
  const { data: session } = useSession();

  const { setCurrentPlaylist } = usePlaylist();
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string>("");
  const { triggerRefresh } = useTuneDataRefresh();

  const [playlists, setPlaylists] = useState<IPlaylist[]>([]);

  useEffect(() => {
    const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;
    getPlaylists(userId)
      .then((playlists: IPlaylist[] | { detail: string }) => {
        if (typeof playlists === "string") {
          console.error("Error fetching playlists:", playlists);
          return;
        }
        if (Array.isArray(playlists)) {
          setPlaylists(playlists);
          getTabGroupMainState(userId)
            .then((tabGroupMainState: ITabGroupMainStateModel | null) => {
              const playlistId = tabGroupMainState?.playlist_id ?? 1;
              setCurrentPlaylist(playlistId);
              triggerRefresh();
              const playlist = playlists.find(
                (playlist) => playlist.playlist_id === playlistId,
              );
              if (playlist) {
                setCurrentPlaylistName(
                  playlist.instrument ?? "NULL INSTRUMENT",
                );
              } else {
                console.error("Playlist not found in playlists array!");
                setCurrentPlaylistName("??? INSTRUMENT ???");
              }
            })
            .catch((error: Error) => {
              console.error("Error getting tab group main state:", error);
            });
        } else {
          console.error("playlists should be an array!");
        }
      })
      .catch((error: Error) => {
        console.error("Error getting playlists:", error);
      });
  }, [session, setCurrentPlaylist, triggerRefresh]);

  // const playlists = ["Flute", "Banjo", "Fiddle"];

  const handleSelect = (playlistObject: IPlaylist) => {
    setCurrentPlaylist(playlistObject.playlist_id);
    setCurrentPlaylistName(playlistObject.instrument ?? "NULL INSTRUMENT");
    triggerRefresh();
  };

  return (
    <div className="flex items-center space-x-2">
      <span>Playlist:</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="px-4 py-2 border rounded">
          {currentPlaylistName}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {playlists.map((playlist) => (
            <DropdownMenuItem
              key={playlist.playlist_id}
              onSelect={() => handleSelect(playlist)}
            >
              {playlist.instrument}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => alert("Manage Playlists...")}>
            Manage Playlists...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
