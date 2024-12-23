"use client";

import { usePlaylist } from "@/app/(main)/pages/practice/components/CurrentPlaylistProvider";
import { useTuneDataRefresh } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import {
  createPlaylistJoined,
  deletePlaylist,
  fetchViewPlaylistJoined,
  getAllGenres,
  getRepertoireTunesOverview, // Import getTunesInPlaylistForUser
  updatePlaylist,
} from "@/app/(main)/pages/practice/queries";
import {
  type ITabGroupMainStateModel,
  getTabGroupMainState,
  updateTabGroupMainState,
} from "@/app/(main)/pages/practice/settings";
import type {
  IGenre,
  IViewPlaylistJoined,
} from "@/app/(main)/pages/practice/types";
import deepEqual from "fast-deep-equal"; // Import deepEqual
import {
  ChevronDownIcon,
  ListChecksIcon,
  MinusIcon,
  PlusIcon,
  SquareCheckBigIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react"; // Import the TrashIcon
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
  const { currentPlaylist, setCurrentPlaylist } = usePlaylist();
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string>("");
  const [currentPlaylistDescription, setCurrentPlaylistDescription] =
    useState<string>("");
  const { triggerRefresh } = useTuneDataRefresh();
  const [playlists, setPlaylists] = useState<IViewPlaylistJoined[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editedPlaylists, setEditedPlaylists] = useState<IViewPlaylistJoined[]>(
    [],
  );

  useEffect(() => {
    // Reset editedPlaylists whenever the dialog is opened
    if (isDialogOpen) {
      const fetchAndSetEditedPlaylists = async (userId: number) => {
        const playlistsEditList = await fetchViewPlaylistJoined(
          userId,
          undefined,
          false,
          false,
          true,
        );
        setEditedPlaylists(playlistsEditList);
      };

      void fetchAndSetEditedPlaylists(
        session?.user?.id ? Number(session?.user?.id) : -1,
      );
    } else {
      setEditedPlaylists([]);
    }
  }, [isDialogOpen, session?.user?.id]);

  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlaylistsAndSetCurrent = async (
    userId: number,
  ): Promise<number> => {
    try {
      // const playlists = await getPlaylists(userId);
      // Let's try getting all playlists for now
      const playlists = await fetchViewPlaylistJoined(userId);
      if (typeof playlists === "string") {
        console.error("Error fetching playlists:", playlists);
        return -1;
      }
      if (Array.isArray(playlists)) {
        setPlaylists(playlists);
        const tabGroupMainState = await getTabGroupMainState(
          userId,
          currentPlaylist,
        );
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
          console.log("Playlist not found in playlists array!");
          // setCurrentPlaylistName("??? INSTRUMENT ???");
          // setCurrentPlaylistDescription("");
        }
      } else {
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

  const handleToggleUserTuneSetList = (
    editedPlaylistRow: IViewPlaylistJoined,
  ): void => {
    const updatedPlaylists = playlists.some(
      (playlist) => playlist.playlist_id === editedPlaylistRow.playlist_id,
    )
      ? playlists.filter(
          (playlist) => playlist.playlist_id !== editedPlaylistRow.playlist_id,
        )
      : [...playlists, editedPlaylistRow];
    setPlaylists(updatedPlaylists);
  };

  const handleSelect = (playlistObject: IViewPlaylistJoined) => {
    setCurrentPlaylist(playlistObject.playlist_id);
    setCurrentPlaylistName(playlistObject.instrument ?? "NULL INSTRUMENT");
    setCurrentPlaylistDescription(playlistObject.description ?? "");
    // export interface ITabGroupMainStateModel {
    //   user_id: number;
    //   id: number;
    //   which_tab: string;
    //   playlist_id?: number;
    //   tab_spec?: string | ITabSpec[];
    // }
    const tabGroupMainStateUpdate: Partial<ITabGroupMainStateModel> = {
      playlist_id: playlistObject.playlist_id,
    };
    const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : -1;
    void updateTabGroupMainState(userId, tabGroupMainStateUpdate);
    triggerRefresh();
  };

  const handleAddPlaylist = () => {
    setEditedPlaylists([
      ...editedPlaylists,
      {
        playlist_id: -Date.now(), // Use negative ID for new playlists
        user_ref: session?.user?.id ? Number(session.user.id) : 0,
        instrument_ref: 0,
        instrument: "",
        description: "",
        playlist_deleted: false,
        genre_default: "",
      },
    ]);
    setHasChanges(true);
  };

  const handleEditPlaylist = (
    index: number,
    field: keyof IViewPlaylistJoined,
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
      const existingPlaylistIds = playlists.map((playlist) =>
        Number(playlist.playlist_id),
      );
      const editedPlaylistIds = new Set(
        editedPlaylists.map((playlist) => Number(playlist.playlist_id)),
      );

      // Check for existing playlists with an empty "instrument" field
      for (const playlist of editedPlaylists) {
        if (playlist.playlist_id > 0 && !playlist.instrument) {
          alert("Instrument field cannot be empty for existing playlists.");
          return;
        }
      }

      // Pre-check for playlists containing tunes
      for (const playlistId of existingPlaylistIds) {
        if (!editedPlaylistIds.has(playlistId)) {
          const tunes = await getRepertoireTunesOverview(
            session?.user?.id ? Number(session.user.id) : -1,
            playlistId,
          );
          if (tunes && tunes.length > 0) {
            alert(
              "Cannot delete Repertoire that contains tunes. Please first go to the corresponding Repertoire tab and delete all its tunes first.",
            );
            // Add the playlist back to the editedPlaylists list
            const playlistToRestore: IViewPlaylistJoined | undefined =
              playlists.find((playlist) => playlist.playlist_id === playlistId);
            if (playlistToRestore) {
              setEditedPlaylists(
                (prev: IViewPlaylistJoined[]): IViewPlaylistJoined[] => {
                  return [...prev, playlistToRestore] as IViewPlaylistJoined[];
                },
              );
            }
            return;
          }
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
          ? createPlaylistJoined({
              ...playlistData,
              instrument: playlist.instrument,
              genre_default: playlist.genre_default,
            })
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

  const [genres, setGenres] = useState<IGenre[]>([]);
  const [isGenresLoading, setIsGenresLoading] = useState(true);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const genresData = await getAllGenres();
        if (Array.isArray(genresData)) {
          setGenres(genresData);
        } else {
          console.error("Error fetching genres:", genresData);
        }
      } catch (error) {
        console.error("Error fetching genres:", error);
      } finally {
        setIsGenresLoading(false);
      }
    };

    void fetchGenres();
  }, []);

  if (isGenresLoading) {
    return <div>Loading...</div>; // Render a loading indicator while fetching data
  }

  return (
    <div className="flex items-center space-x-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="px-4 py-2 border rounded bg-white dark:bg-background hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white-500 transition duration-150 ease-in-out flex items-center space-x-2"
          title={currentPlaylistDescription} // Add hover text
        >
          <span>
            Instrument: {currentPlaylistName} (id-{currentPlaylist})
          </span>
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-white dark:bg-background border border-gray-300 dark:border-gray-700 rounded shadow-lg">
          {playlists.map((playlist) => (
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* Make the dialog wider with min-w-[600px] (adjust as needed) */}
        <DialogContent className="max-w-[53rem] w-full min-w-[53rem]">
          <DialogHeader className="flex justify-between">
            {/* Left-aligned title */}
            <DialogTitle className="text-left">
              Edit Repertoire List
            </DialogTitle>
            {/* The built-in close 'x' is automatically placed here on the far right */}
          </DialogHeader>

          <div className="flex space-x-4 mt-4 font-bold">
            <span className="w-11 ml-3 mt-2">
              <ListChecksIcon className="w-5 h-5" />
            </span>
            <span className="w-12 mt-2">Id</span>
            <span className="w-48 mt-2">Instrument</span>
            <span className="w-40 mt-2">Genre Default</span>
            <span className="w-[15rem] mt-2">Description</span>
            <Button
              variant="ghost"
              className="flex items-center"
              onClick={handleAddPlaylist}
            >
              <PlusIcon className="w-5 h-5" />
            </Button>
          </div>

          {editedPlaylists.map((editedPlaylistRow, index) => (
            <div
              key={editedPlaylistRow.playlist_id}
              className="flex space-x-3 mb-2"
            >
              <Button
                variant="ghost"
                onClick={() => handleToggleUserTuneSetList(editedPlaylistRow)}
              >
                {playlists.some(
                  (playlist) =>
                    playlist.playlist_id === editedPlaylistRow.playlist_id,
                ) ? (
                  <SquareCheckBigIcon className="w-5 h-5 mt-2 text-green-500" />
                ) : (
                  <SquareIcon className="w-5 h-5 mt-2" />
                )}
              </Button>
              <Input
                value={editedPlaylistRow.playlist_id ?? "?"}
                placeholder="Id"
                disabled
                className="w-12"
              />
              {editedPlaylistRow.private_to_user === 0 ? (
                <div className="w-[14rem] pl-[1rem] mt-2 flex items-left">
                  {editedPlaylistRow.instrument ?? "??"}
                </div>
              ) : (
                <Input
                  value={editedPlaylistRow.instrument ?? ""}
                  onChange={(e) =>
                    handleEditPlaylist(index, "instrument", e.target.value)
                  }
                  placeholder="Instrument"
                  className="w-[14rem] mt-0 flex items-left"
                />
              )}
              {editedPlaylistRow.private_to_user === 0 ? (
                <div className="w-[10rem] mt-2 flex items-left">
                  {editedPlaylistRow.genre_default ?? ""}
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-[10rem] mt-0 flex items-center justify-between">
                    {editedPlaylistRow.genre_default || "(not set)"}{" "}
                    <ChevronDownIcon className="w-5 h-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-60 overflow-y-auto">
                    {genres.map((genre) => (
                      <DropdownMenuItem
                        key={genre.id}
                        onSelect={() => {
                          handleEditPlaylist(index, "genre_default", genre.id);
                        }}
                        className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <div className="text-xs">
                          <div>{genre.id}</div>
                          <div>Name: {genre.name}</div>
                          <div>Region: {genre.region}</div>
                          <div>Description: {genre.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {editedPlaylistRow.private_to_user === 0 ? (
                <div className="w-[15rem] mt-2 flex items-left">
                  {editedPlaylistRow.description ?? ""}
                </div>
              ) : (
                <Input
                  value={editedPlaylistRow.description ?? ""}
                  onChange={(e) =>
                    handleEditPlaylist(index, "description", e.target.value)
                  }
                  placeholder="Description"
                  className="w-[15rem] mt-0 flex items-left"
                />
              )}
              {editedPlaylistRow.private_to_user !== 0 && (
                <Button
                  variant="destructive"
                  className="bg-transparent"
                  onClick={() => handleDeletePlaylist(index)}
                >
                  {editedPlaylistRow.playlist_id > 0 ? (
                    <TrashIcon className="w-5 h-5" />
                  ) : (
                    <MinusIcon className="w-5 h-5" />
                  )}
                </Button>
              )}
            </div>
          ))}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => void handleSubmit()}
              disabled={!hasChanges || hasEmptyVisibleInstrument}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>{" "}
    </div>
  );
}
