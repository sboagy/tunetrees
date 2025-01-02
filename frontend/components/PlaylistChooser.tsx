"use client";

import { usePlaylist } from "@/app/(main)/pages/practice/components/CurrentPlaylistProvider";
import { useTuneDataRefresh } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import { fetchViewPlaylistJoined } from "@/app/(main)/pages/practice/queries";
import {
  type ITabGroupMainStateModel,
  getTabGroupMainState,
  updateTabGroupMainState,
} from "@/app/(main)/pages/practice/settings";
import type { IViewPlaylistJoined } from "@/app/(main)/pages/practice/types";
import { ChevronDownIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import styles from "./PlaylistChooser.module.css";
import PlaylistDialog from "./PlaylistDialog";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function PlaylistChooser() {
  const { data: session } = useSession();
  const { currentPlaylist, setCurrentPlaylist } = usePlaylist();
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string>("");
  const [currentPlaylistDescription, setCurrentPlaylistDescription] =
    useState<string>("");
  const { triggerRefresh } = useTuneDataRefresh();

  const [playlistsInMenu, setPlaylistsInMenu] = useState<IViewPlaylistJoined[]>(
    [],
  );

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlaylistsAndSetCurrent = async (
    userId: number,
  ): Promise<number> => {
    try {
      const playlists = await fetchViewPlaylistJoined(userId);
      if (typeof playlists === "string") {
        console.error("Error fetching playlists:", playlists);
        // return -1;
      }
      if (Array.isArray(playlists)) {
        if (playlists.length === 0 && !isDialogOpen) {
          setIsDialogOpen(true);
        }
        setPlaylistsInMenu(playlists);
        const tabGroupMainState = await getTabGroupMainState(
          userId,
          currentPlaylist,
        );
        const playlistId = tabGroupMainState?.playlist_id ?? 1;
        let playlist = playlists.find(
          (playlist) => playlist.playlist_id === playlistId,
        );
        if (playlist === undefined && playlists.length > 0) {
          const playlistId2 = playlists[0].playlist_id;
          playlist = playlists.find(
            (playlist) => playlist.playlist_id === playlistId2,
          );
        }
        if (playlist) {
          setCurrentPlaylist(playlist.playlist_id);
          setCurrentPlaylistName(playlist.instrument ?? "(None)");
          setCurrentPlaylistDescription(playlist.description ?? "");
        } else {
          console.log("Playlist not found in playlists array!");
          setCurrentPlaylist(-1);
          setCurrentPlaylistName("(None)");
          setCurrentPlaylistDescription("");
        }
        triggerRefresh();
      } else {
        setCurrentPlaylist(-1);
        triggerRefresh();
        console.error("playlists should be an array!");
        return -1;
      }
    } catch (error) {
      console.log("Error fetching playlists and setting current:", error);
      return -1;
    }
    return 0;
  };

  useEffect(() => {
    // This may be a problem if the user is not logged in, or going from not logged in to logged in
    const fetchData = async () => {
      try {
        if (isLoading) {
          const userId = session?.user?.id
            ? Number.parseInt(session?.user?.id)
            : -1;
          await fetchPlaylistsAndSetCurrent(userId);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  });

  const handleSelect = (playlistObject: IViewPlaylistJoined) => {
    setCurrentPlaylist(playlistObject.playlist_id);
    setCurrentPlaylistName(playlistObject.instrument ?? "NULL INSTRUMENT");
    setCurrentPlaylistDescription(playlistObject.description ?? "");
    const tabGroupMainStateUpdate: Partial<ITabGroupMainStateModel> = {
      playlist_id: playlistObject.playlist_id,
    };
    const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;
    void updateTabGroupMainState(userId, tabGroupMainStateUpdate);
    triggerRefresh();
  };

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`${styles.headerMenuTrigger}`}
          title={currentPlaylistDescription}
          asChild
        >
          <Button
            variant="ghost"
            className={`${styles.dropDownMenuTriggerInnerButton}`}
          >
            Instrument: {currentPlaylistName} (id-{currentPlaylist})
            <ChevronDownIcon className={`${styles.dropDownMenuChevronDown}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white dark:bg-background border border-gray-300 dark:border-gray-700 rounded shadow-lg">
          {playlistsInMenu.map((playlist) => (
            <DropdownMenuItem
              key={playlist.playlist_id}
              onSelect={() => handleSelect(playlist)}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center space-x-2"
            >
              {playlist.playlist_id === currentPlaylist && (
                <span className="text-green-500">✔</span>
              )}
              <span>
                {playlist.instrument} (id-{playlist.playlist_id})
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="border-t border-gray-400 dark:border-gray-600 my-2" />
          <DropdownMenuItem
            onSelect={() => setIsDialogOpen(true)}
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            Edit Repertoire List...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isDialogOpen && (
        <PlaylistDialog
          playlistsInMenu={playlistsInMenu}
          onClose={() => setIsDialogOpen(false)}
          fetchPlaylistsAndSetCurrent={fetchPlaylistsAndSetCurrent}
        />
      )}
    </div>
  );
}
