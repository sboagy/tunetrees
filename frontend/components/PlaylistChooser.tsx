"use client";

import { usePlaylist } from "@/app/(main)/pages/practice/components/CurrentPlaylistProvider";
import { useTuneDataRefresh } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import {
  type IPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylists,
  updatePlaylist,
} from "@/app/(main)/pages/practice/queries";
import { getTabGroupMainState } from "@/app/(main)/pages/practice/settings";
import deepEqual from "fast-deep-equal"; // Import deepEqual
import { ChevronDownIcon, MinusIcon, PlusIcon, TrashIcon } from "lucide-react"; // Import the TrashIcon
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";

export default function PlaylistChooser() {
  const { data: session } = useSession();
  const { setCurrentPlaylist } = usePlaylist();
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string>("");
  const [currentPlaylistDescription, setCurrentPlaylistDescription] =
    useState<string>("");
  const { triggerRefresh } = useTuneDataRefresh();
  const [playlists, setPlaylists] = useState<IPlaylist[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editedPlaylists, setEditedPlaylists] = useState<IPlaylist[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchPlaylistsAndSetCurrent = async (
    userId: number,
  ): Promise<number> => {
    try {
      const playlists = await getPlaylists(userId);
      if (typeof playlists === "string") {
        console.error("Error fetching playlists:", playlists);
        return -1;
      }
      if (Array.isArray(playlists)) {
        setPlaylists(playlists);
        setEditedPlaylists(playlists);
        const tabGroupMainState = await getTabGroupMainState(userId);
        const playlistId = tabGroupMainState?.playlist_id ?? 1;
        setCurrentPlaylist(playlistId);
        triggerRefresh();
        const playlist = playlists.find(
          (playlist) => playlist.playlist_id === playlistId,
        );
        if (playlist) {
          setCurrentPlaylistName(playlist.instrument ?? "NULL INSTRUMENT");
          setCurrentPlaylistDescription(playlist.description ?? "");
        } else {
          console.error("Playlist not found in playlists array!");
          setCurrentPlaylistName("??? INSTRUMENT ???");
          setCurrentPlaylistDescription("");
        }
      } else {
        console.error("playlists should be an array!");
        return -1;
      }
    } catch (error) {
      console.error("Error fetching playlists and setting current:", error);
      return -1;
    }
    return 0;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const fetchData = () => {
      const userId = session?.user?.id
        ? Number.parseInt(session?.user?.id)
        : -1;
      void fetchPlaylistsAndSetCurrent(userId);
    };
    fetchData();
  }, [session]);

  const handleSelect = (playlistObject: IPlaylist) => {
    setCurrentPlaylist(playlistObject.playlist_id);
    setCurrentPlaylistName(playlistObject.instrument ?? "NULL INSTRUMENT");
    setCurrentPlaylistDescription(playlistObject.description ?? "");
    triggerRefresh();
  };

  const handleAddPlaylist = () => {
    setEditedPlaylists([
      ...editedPlaylists,
      {
        playlist_id: -Date.now(), // Use negative ID for new playlists
        user_ref: session?.user?.id ? Number(session.user.id) : undefined,
        instrument: "",
        description: "",
      },
    ]);
    setHasChanges(true);
  };

  const handleEditPlaylist = (
    index: number,
    field: keyof IPlaylist,
    value: string,
  ) => {
    const updatedPlaylists = [...editedPlaylists];
    updatedPlaylists[index] = {
      ...updatedPlaylists[index],
      [field]: value,
    };
    setEditedPlaylists(updatedPlaylists);
    setHasChanges(
      JSON.stringify(updatedPlaylists) !== JSON.stringify(playlists),
    );
  };

  const handleDeletePlaylist = (index: number) => {
    const updatedPlaylists = editedPlaylists.filter((_, i) => i !== index);
    setEditedPlaylists(updatedPlaylists);
    setHasChanges(!deepEqual(updatedPlaylists, playlists));
  };

  const handleSubmit = async () => {
    try {
      const existingPlaylistIds = playlists.map(
        (playlist) => playlist.playlist_id,
      );
      const editedPlaylistIds = new Set(
        editedPlaylists.map((playlist) => playlist.playlist_id),
      );

      // Check for existing playlists with an empty "instrument" field
      for (const playlist of editedPlaylists) {
        if (playlist.playlist_id > 0 && !playlist.instrument) {
          alert("Instrument field cannot be empty for existing playlists.");
          return;
        }
      }

      // Delete playlists that are not in the editedPlaylists array
      for (const playlistId of existingPlaylistIds) {
        if (!editedPlaylistIds.has(playlistId)) {
          await deletePlaylist(playlistId);
        }
      }

      // Create or update playlists
      for (const playlist of editedPlaylists) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { playlist_id, ...playlistData } = playlist;
        if (playlist_id < 0 && !playlist.instrument) {
          continue; // Skip new items with an empty "instrument" field
        }
        await (playlist_id < 0
          ? createPlaylist({ ...playlistData, instrument: playlist.instrument })
          : updatePlaylist(playlist_id, playlistData));
      }

      const userId = session?.user?.id
        ? Number.parseInt(session?.user?.id)
        : -1;
      const status = await fetchPlaylistsAndSetCurrent(userId);
      console.log("fetchPlaylistsAndSetCurrent status:", status);
      setIsDialogOpen(false);
      setHasChanges(false);
    } catch (error) {
      console.error("Error submitting playlists:", error);
    }
  };

  const hasEmptyVisibleInstrument = editedPlaylists.some(
    (playlist) => playlist.instrument === "",
  );

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="px-4 py-2 border rounded bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out flex items-center space-x-2"
          title={currentPlaylistDescription} // Add hover text
        >
          <span>Playlist: {currentPlaylistName}</span>
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg">
          {playlists.map((playlist) => (
            <DropdownMenuItem
              key={playlist.playlist_id}
              onSelect={() => handleSelect(playlist)}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              {playlist.instrument}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="border-t border-gray-400 dark:border-gray-600 my-2" />
          <DropdownMenuItem
            onSelect={() => setIsDialogOpen(true)}
            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            Manage Playlists...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center">
              <DialogTitle>Manage Playlists</DialogTitle>
              <Button
                variant="secondary"
                className="flex items-center ml-12" // Align with the baseline of the DialogTitle text and add right margin of 3em
                onClick={handleAddPlaylist}
              >
                <PlusIcon className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>
          {editedPlaylists.map((playlist, index) => (
            <div key={playlist.playlist_id} className="flex space-x-2 mb-2">
              <Input
                value={playlist.instrument ?? ""} // Ensure value is not null
                onChange={(e) =>
                  handleEditPlaylist(index, "instrument", e.target.value)
                }
                placeholder="Instrument"
              />
              <Input
                value={playlist.description ?? ""} // Ensure value is not null
                onChange={(e) =>
                  handleEditPlaylist(index, "description", e.target.value)
                }
                placeholder="Description"
              />
              <Button
                variant="destructive"
                className="bg-transparent" // Match the dialog background color
                onClick={() => handleDeletePlaylist(index)}
              >
                {playlist.playlist_id > 0 ? (
                  <TrashIcon className="w-5 h-5" />
                ) : (
                  <MinusIcon className="w-5 h-5" />
                )}
              </Button>
            </div>
          ))}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => void handleSubmit()}
              disabled={!hasChanges || hasEmptyVisibleInstrument}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
