import {
  createPlaylistJoined,
  deletePlaylist,
  fetchViewPlaylistJoined,
  getAllGenres,
  getRepertoireTunesOverview,
  updatePlaylist,
} from "@/app/(main)/pages/practice/queries";
import type {
  IGenre,
  IViewPlaylistJoined,
} from "@/app/(main)/pages/practice/types";
import { deepEqualIgnoreOrder } from "@/lib/compare";
import { Dialog, DialogContent, DialogTitle } from "@radix-ui/react-dialog";
import {
  ChevronDownIcon,
  ListChecksIcon,
  PenOffIcon,
  PlusIcon,
  SquareCheckBigIcon,
  SquareIcon,
  TrashIcon,
} from "lucide-react"; // Import the TrashIcon
import { useSession } from "next-auth/react";
import { type JSX, useEffect, useState } from "react";
import styles from "./PlaylistChooser.module.css";
import { Button } from "./ui/button";
import { DialogFooter, DialogHeader } from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type IPlaylistsInMenu = {
  playlistsInMenu: IViewPlaylistJoined[];
  onOpenChange: (isOpen: boolean) => void;
};

export default function PlaylistDialog({
  playlistsInMenu,
  onOpenChange,
}: IPlaylistsInMenu): JSX.Element {
  const { data: session } = useSession();

  const [playlistsAllAvailable, setPlaylistsAllAvailable] = useState<
    IViewPlaylistJoined[]
  >([]);
  const [playlistsAllAvailableModified, setPlaylistsAllAvailableModified] =
    useState<IViewPlaylistJoined[]>([]);

  const [playlistsInMenuModified, setPlaylistsInMenuModified] = useState<
    IViewPlaylistJoined[]
  >([]);

  useEffect(() => {
    // Reset editedPlaylists whenever the dialog is opened
    const fetchAndSetEditedPlaylists = async (userId: number) => {
      const playlistsEditList = await fetchViewPlaylistJoined(
        userId,
        undefined,
        false,
        false,
        true,
      );
      setPlaylistsAllAvailable(playlistsEditList);
      setPlaylistsAllAvailableModified(structuredClone(playlistsEditList));

      // Clone a copy of the playlistsInMenu to be modified.  This could really be
      // just IDs, I think.
      setPlaylistsInMenuModified(structuredClone(playlistsInMenu));
    };

    void fetchAndSetEditedPlaylists(
      session?.user?.id ? Number(session?.user?.id) : -1,
    );
  }, [session?.user?.id, playlistsInMenu]);

  const handleToggleUserTuneSetList = (
    editedPlaylistRow: IViewPlaylistJoined,
  ): void => {
    const updatedPlaylists = playlistsInMenuModified.some(
      (p) => p.playlist_id === editedPlaylistRow.playlist_id,
    )
      ? playlistsInMenuModified.filter(
          (p) => p.playlist_id !== editedPlaylistRow.playlist_id,
        )
      : [...playlistsInMenuModified, editedPlaylistRow];
    setPlaylistsInMenuModified(updatedPlaylists);
  };

  const handleAddPlaylist = () => {
    const updatedPlaylists = [
      ...playlistsAllAvailableModified,
      {
        playlist_id: -Date.now(), // Use negative ID for new playlists
        user_ref: session?.user?.id ? Number(session.user.id) : 0,
        instrument_ref: 0,
        instrument: "",
        description: "",
        playlist_deleted: false,
        genre_default: "",
      },
    ];
    setPlaylistsAllAvailableModified(updatedPlaylists);
  };

  const handleEditPlaylist = (
    index: number,
    field: keyof IViewPlaylistJoined,
    value: string,
  ) => {
    const updatedPlaylists = [...playlistsAllAvailableModified];
    updatedPlaylists[index] = {
      ...updatedPlaylists[index],
      [field]: value,
    };
    setPlaylistsAllAvailableModified(updatedPlaylists);
  };

  const handleDeletePlaylist = (index: number) => {
    const updatedPlaylists = playlistsAllAvailableModified.filter(
      (_, i) => i !== index,
    );
    setPlaylistsAllAvailableModified(updatedPlaylists);
  };

  const handleSubmit = async () => {
    try {
      const playlistsInMenuIds = playlistsInMenu.map((playlist) =>
        Number(playlist.playlist_id),
      );
      const playlistsAllAvailableModifiedIds = new Set(
        playlistsAllAvailableModified.map((playlist) =>
          Number(playlist.playlist_id),
        ),
      );

      // Check for existing playlists with an empty "instrument" field
      for (const playlist of playlistsAllAvailableModified) {
        if (playlist.playlist_id > 0 && !playlist.instrument) {
          alert("Instrument field cannot be empty for existing playlists.");
          return;
        }
      }

      // Pre-check for playlists containing tunes
      for (const playlistId of playlistsInMenuIds) {
        if (!playlistsAllAvailableModifiedIds.has(playlistId)) {
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
              playlistsInMenu.find(
                (playlist) => playlist.playlist_id === playlistId,
              );
            if (playlistToRestore) {
              setPlaylistsAllAvailableModified(
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
      for (const playlistId of playlistsInMenuIds) {
        if (!playlistsAllAvailableModifiedIds.has(playlistId)) {
          await deletePlaylist(playlistId);
        }
      }

      // Create or update playlists
      for (const playlist of playlistsAllAvailableModified) {
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

      // const userId = session?.user?.id
      //   ? Number.parseInt(session?.user?.id)
      //   : -1;
      // const status = await fetchPlaylistsAndSetCurrent(userId);
      // console.log("fetchPlaylistsAndSetCurrent status:", status);
      // setIsDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting playlists:", error);
    }
  };

  function hasEmptyVisibleInstrument(): boolean {
    return playlistsAllAvailableModified.some((p) => p.instrument === "");
  }

  function playlistsEqual(
    label: string,
    a: Array<IViewPlaylistJoined>,
    b: Array<IViewPlaylistJoined>,
  ): boolean {
    // Wrap the deepEqualIgnoreOrder function to bottleneck the comparison
    // and log the results for diagnostic purposes.
    const isEqual = deepEqualIgnoreOrder(a, b, true);
    console.log(
      `===> PlaylistChooser.tsx:65 ~ label=${label} isEqual=${isEqual}`,
    );
    return isEqual;
  }

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
    <Dialog>
      {/* Make the dialog wider with min-w-[600px] (adjust as needed) */}
      <DialogContent className={styles.dialog_content}>
        <DialogHeader className="flex justify-between">
          {/* Left-aligned title */}
          <DialogTitle className="text-left">Edit Repertoire List</DialogTitle>
          {/* The built-in close 'x' is automatically placed here on the far right */}
          <div>
            Add or remove tune sets from your repertoire list. Preset instrument
            sets can be used, or you can create your own custom instrument which
            only you can see. You can set a default genre for each custom tune
            set. To add or modify preset instruments, contact the admin.
          </div>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow className={`${styles.dialog_table} h-10`}>
              <TableHead className={`${styles.column_include} p-0 mt-0`}>
                <Button
                  variant="ghost"
                  onClick={() => {}}
                  disabled
                  className="bg-transparent ml-[1em] mt-[-8px] text-inherit disabled:text-inherit disabled:opacity-100"
                >
                  <ListChecksIcon className="w-5 h-5" />
                </Button>
              </TableHead>
              <TableHead className={`${styles.column_id}`}>
                <div className="pl-3">Id</div>
              </TableHead>
              <TableHead className={styles.column_instrument}>
                Instrument
              </TableHead>
              <TableHead className={styles.column_genre_default}>
                Genre Default
              </TableHead>
              <TableHead className={styles.column_description}>
                Description
              </TableHead>
              <TableHead
                className={`${styles.column_change_controls} p-0 mt-2`}
              >
                <Button
                  variant="destructive"
                  className="bg-transparent hover:bg-green-400/10 ml-[1em] mt-[-8px]"
                  onClick={handleAddPlaylist}
                >
                  <PlusIcon className="w-5 h-5 text-blue-500" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {playlistsAllAvailableModified.map((editedPlaylistRow, index) => (
              <TableRow
                key={editedPlaylistRow.playlist_id}
                className={styles.dialog_table}
              >
                <TableCell className={`${styles.column_include}`}>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      handleToggleUserTuneSetList(editedPlaylistRow)
                    }
                  >
                    {playlistsInMenuModified.some(
                      (p) => p.playlist_id === editedPlaylistRow.playlist_id,
                    ) ? (
                      <SquareCheckBigIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <SquareIcon className="w-5 h-5" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className={`${styles.column_id}`}>
                  <Input
                    value={editedPlaylistRow.playlist_id ?? "?"}
                    placeholder="Id"
                    disabled
                    // className={"p-1 mt-0"}
                  />
                </TableCell>
                <TableCell className={styles.column_instrument}>
                  {editedPlaylistRow.private_to_user === 0 ? (
                    <Input
                      value={editedPlaylistRow.instrument ?? ""}
                      onChange={(e) =>
                        handleEditPlaylist(index, "instrument", e.target.value)
                      }
                      placeholder="Instrument"
                      disabled
                      className="p-0 m-0"
                    />
                  ) : (
                    <Input
                      value={editedPlaylistRow.instrument ?? ""}
                      onChange={(e) =>
                        handleEditPlaylist(index, "instrument", e.target.value)
                      }
                      placeholder="Instrument"
                      className="p-0 m-0"
                    />
                  )}
                </TableCell>
                <TableCell className={styles.column_genre_default}>
                  {editedPlaylistRow.private_to_user === 0 ? (
                    (editedPlaylistRow.genre_default ?? "")
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={`${styles.column_genre_default} flex items-center justify-between`}
                      >
                        {editedPlaylistRow.genre_default || "(not set)"}
                        <ChevronDownIcon className="w-5 h-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-60 overflow-y-auto">
                        {genres.map((genre) => (
                          <DropdownMenuItem
                            key={genre.id}
                            onSelect={() => {
                              handleEditPlaylist(
                                index,
                                "genre_default",
                                genre.id,
                              );
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
                </TableCell>
                <TableCell className={styles.column_description}>
                  {editedPlaylistRow.private_to_user === 0 ? (
                    (editedPlaylistRow.description ?? "")
                  ) : (
                    <Input
                      value={editedPlaylistRow.description ?? ""}
                      onChange={(e) =>
                        handleEditPlaylist(index, "description", e.target.value)
                      }
                      placeholder="Description"
                    />
                  )}
                </TableCell>
                <TableCell
                  className={`${styles.column_change_controls} p-4 mt-0`}
                >
                  {editedPlaylistRow.private_to_user !== 0 ? (
                    <Button
                      variant="destructive"
                      className="bg-transparent"
                      onClick={() => handleDeletePlaylist(index)}
                    >
                      <TrashIcon className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      className="bg-transparent"
                      onClick={() => handleDeletePlaylist(index)}
                      disabled
                    >
                      <PenOffIcon className="w-5 h-5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter className={`${styles.dialog_footer}`}>
          <Button
            variant="ghost"
            onClick={() => void handleSubmit()}
            disabled={
              (playlistsEqual(
                "editedPlaylists",
                playlistsAllAvailableModified,
                playlistsAllAvailable,
              ) &&
                playlistsEqual(
                  "playlists",
                  playlistsInMenu,
                  playlistsInMenuModified,
                )) ||
              hasEmptyVisibleInstrument()
            }
            className="w-full"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
