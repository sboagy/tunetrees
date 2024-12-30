import {
  createInstrument,
  createPlaylist,
  deletePlaylist,
  getAllGenres,
  getInstruments,
  getPlaylists,
  updateInstrument,
  updatePlaylist,
} from "@/app/(main)/pages/practice/queries";
import type {
  IGenre,
  IInstrument,
  IPlaylist,
  IViewPlaylistJoined,
} from "@/app/(main)/pages/practice/types";
import { deepEqualIgnoreOrder } from "@/lib/compare";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@radix-ui/react-dialog";
import {
  ChevronDownIcon,
  ListChecksIcon,
  PenOffIcon,
  PlusIcon,
  SquareCheckBigIcon,
  SquareIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  type JSX,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./PlaylistChooser.module.css";
import SaveChangesOrNotDialog from "./SaveChangesOrNotDialog";
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
  onClose: () => void;
  fetchPlaylistsAndSetCurrent: (userId: number) => Promise<number>;
};

export default function PlaylistDialog({
  playlistsInMenu,
  onClose,
  fetchPlaylistsAndSetCurrent,
}: IPlaylistsInMenu): JSX.Element {
  const { data: session } = useSession();

  const [instrumentsAllAvailable, setInstrumentsAllAvailable] = useState<
    IInstrument[]
  >([]);
  const [instrumentsAllAvailableModified, setInstrumentsAllAvailableModified] =
    useState<IInstrument[]>([]);

  const [playlistsInMenuModified, setPlaylistsInMenuModified] = useState<
    IViewPlaylistJoined[]
  >([]);

  const newInstrumentRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusSet = useRef(false);

  useEffect(() => {
    const fetchAndSetEditedPlaylists = async (userId: number) => {
      const instruments = await getInstruments(userId, true);
      setInstrumentsAllAvailable(instruments);
      setInstrumentsAllAvailableModified(structuredClone(instruments));

      // Reset the modified playlists to the original playlists
      setPlaylistsInMenuModified(structuredClone(playlistsInMenu));
    };

    void fetchAndSetEditedPlaylists(
      session?.user?.id ? Number(session?.user?.id) : -1,
    );
  }, [session?.user?.id, playlistsInMenu]);

  useEffect(() => {
    if (!focusSet.current) {
      setTimeout(() => {
        if (dialogRef.current) {
          dialogRef.current?.focus();
          focusSet.current = true;
        }
      }, 0);
    }
  });

  async function matchOrCreateUnMenuedPlaylist(
    instrument: IInstrument,
  ): Promise<IViewPlaylistJoined> {
    let playlistId = -Date.now();
    try {
      const playlists: IPlaylist[] | { detail: string } = await getPlaylists(
        getUserId(),
        true,
      );
      if (playlists && "detail" in playlists) {
        console.log(`createPlaylist reports: ${playlists.detail}`);
      } else {
        const matchingPlaylist = playlists.find(
          (p) => p.instrument_ref === instrument.id,
        );
        playlistId = matchingPlaylist?.playlist_id ?? -Date.now();
      }
    } catch (error) {
      console.error("Error fetching playlists:", error);
    }
    const matchingPlaylistJoined: IViewPlaylistJoined = {
      playlist_id: playlistId,
      instrument_ref: instrument.id,
      user_ref: getUserId(),
      playlist_deleted: false,
      instrument_deleted: instrument.deleted,
    } as IViewPlaylistJoined;

    return matchingPlaylistJoined;
  }

  const handleToggleUserTuneSetList = async (
    instrument: IInstrument,
  ): Promise<void> => {
    const matchingPlaylistModified: IViewPlaylistJoined | undefined =
      playlistsInMenuModified.find((p) => p.instrument_ref === instrument.id);

    const matchingPlaylistInMenu: IViewPlaylistJoined | undefined =
      playlistsInMenu.find((p) => p.instrument_ref === instrument.id);

    const updatedPlaylists: IViewPlaylistJoined[] = matchingPlaylistModified
      ? // If the playlist is already in the modified list, remove it
        playlistsInMenuModified.filter(
          (p) => p.instrument_ref !== instrument.id,
        )
      : // else if the playlist is in the original list, add it back the modified list
        matchingPlaylistInMenu
        ? [...playlistsInMenuModified, matchingPlaylistInMenu]
        : // else search in the db for a matching playlist, or create a new one with temporary ID
          [
            ...playlistsInMenuModified,
            await matchOrCreateUnMenuedPlaylist(instrument),
          ];
    setPlaylistsInMenuModified(updatedPlaylists);
  };

  const handleAddInstrument = () => {
    setInstrumentsAllAvailableModified((prevInstruments) => {
      const updatedInstruments = [
        {
          id: -Date.now(), // Temporary ID, replace with actual ID from the database
          private_to_user: getUserId(),
          instrument: "",
          description: "",
          genre_default: "",
        },
        ...prevInstruments,
      ];
      return updatedInstruments;
    });
    setTimeout(() => {
      newInstrumentRef.current?.focus();
    }, 1);
  };

  const handleEditInstrument = (
    instrumentId: number,
    field: keyof IInstrument,
    value: string,
  ) => {
    const updatedInstruments = [...instrumentsAllAvailableModified];
    const instrumentIndex = updatedInstruments.findIndex(
      (p) => p.id === instrumentId,
    );
    if (instrumentIndex !== -1) {
      updatedInstruments[instrumentIndex] = {
        ...updatedInstruments[instrumentIndex],
        [field]: value,
      };
    }
    setInstrumentsAllAvailableModified(updatedInstruments);
  };

  const handleDeleteInstrument = (instrumentId: number) => {
    const updatedInstruments = instrumentsAllAvailableModified.filter(
      (p) => p.id !== instrumentId,
    );
    setInstrumentsAllAvailableModified(updatedInstruments);
  };

  const getUserId = useMemo(() => {
    return () => {
      return session?.user?.id ? Number(session.user.id) : -1;
    };
  }, [session?.user?.id]);

  const hasEmptyVisibleInstrument = useCallback((): boolean => {
    return instrumentsAllAvailableModified.some((p) => p.instrument === "");
  }, [instrumentsAllAvailableModified]);

  const instrumentListsEqual = useCallback(
    (label: string, a: Array<IInstrument>, b: Array<IInstrument>): boolean => {
      const isEqual = deepEqualIgnoreOrder(a, b, true);
      console.log(
        `instrumentListsEqual ===> PlaylistDialog.tsx:280 ~ label=${label} isEqual=${isEqual}`,
      );
      return isEqual;
    },
    [],
  );

  const playlistsEqual = useCallback(
    (
      label: string,
      a: Array<IViewPlaylistJoined>,
      b: Array<IViewPlaylistJoined>,
    ): boolean => {
      const isEqual = deepEqualIgnoreOrder(a, b, true);
      console.log(
        `playlistsEqual ===> PlaylistDialog.tsx:292 ~ label=${label} isEqual=${isEqual}`,
      );
      return isEqual;
    },
    [],
  );

  const hasNoChanges = useCallback((): boolean => {
    const noChanges =
      (instrumentListsEqual(
        "editedPlaylists",
        instrumentsAllAvailableModified,
        instrumentsAllAvailable,
      ) &&
        playlistsEqual(
          "playlists",
          playlistsInMenu,
          playlistsInMenuModified,
        )) ||
      hasEmptyVisibleInstrument();
    return noChanges;
  }, [
    instrumentsAllAvailableModified,
    instrumentsAllAvailable,
    playlistsInMenu,
    playlistsInMenuModified,
    hasEmptyVisibleInstrument,
    instrumentListsEqual,
    playlistsEqual,
  ]);

  const [showSaveChangesOrNotDialog, setShowSaveChangesOrNotDialog] =
    useState(false);

  const handleSaveOnClose = () => {
    void handleSubmit();
    setShowSaveChangesOrNotDialog(false);
  };

  const handleDiscardOnClose = () => {
    setShowSaveChangesOrNotDialog(false);
    onClose();
  };

  const handleCancelOnClose = () => {
    setShowSaveChangesOrNotDialog(false);
  };

  const checkAndClose = useCallback(() => {
    const hasChanges = !hasNoChanges();
    if (hasChanges) {
      setShowSaveChangesOrNotDialog(true);
    } else {
      onClose();
    }
  }, [onClose, hasNoChanges]);

  const handleSubmit: () => Promise<void> =
    useCallback(async (): Promise<void> => {
      try {
        for (const instrument of instrumentsAllAvailableModified) {
          if (instrument.id > 0 && !instrument.instrument) {
            alert("Instrument field cannot be empty for existing playlists.");
            return;
          }
        }

        // First DELETE all instruments in the instrument table that are in the original
        // instrumentsAllAvailable list, but NOT in the instrumentsAllAvailableModified list.
        for (const instrument of instrumentsAllAvailable) {
          if (
            !instrumentsAllAvailableModified.some(
              (p) => p.id === instrument.id,
            ) &&
            instrument.id > 0
          ) {
            const updatedInstrument = await updateInstrument(instrument.id, {
              deleted: true,
            });
            if (updatedInstrument && "detail" in updatedInstrument) {
              console.log(
                `updateInstrument reports: ${updatedInstrument.detail}`,
              );
            } else {
              console.log(
                `Deleted instrument: ${instrument.id}, ${instrument.deleted}`,
              );
              // Ok, now the instrument has been deleted, so how does that effect the
              // playlist lists?
            }
          } else if (instrument.id > 0) {
            const instrumentModified: IInstrument | undefined =
              instrumentsAllAvailableModified.find(
                (p) => p.id === instrument.id,
              );

            if (
              instrumentModified !== undefined &&
              !deepEqualIgnoreOrder(instrument, instrumentModified)
            ) {
              const updatedInstrument = await updateInstrument(
                instrument.id,
                instrumentModified,
              );
              if (updatedInstrument && "detail" in updatedInstrument) {
                console.log(
                  `updateInstrument (modify) reports: ${updatedInstrument.detail}`,
                );
              } else {
                console.log(
                  `Updated instrument  (modify): ${instrument.id}, ${instrument.instrument}`,
                );
              }
            }
          }
        }

        // Next, ADD any instrument to the instrument table in instrumentsAllAvailableModified
        // that's NOT in instrumentsAllAvailable.
        for (const instrument of instrumentsAllAvailableModified) {
          if (!instrumentsAllAvailable.some((p) => p.id === instrument.id)) {
            const newInstrument: Partial<IInstrument> = {
              private_to_user: getUserId(),
              instrument: instrument.instrument,
              description: instrument.description,
              genre_default: instrument.genre_default,
            };
            const updatedInstrument = await createInstrument(newInstrument);
            if (updatedInstrument && "detail" in updatedInstrument) {
              console.log(
                `createInstrument reports: ${updatedInstrument.detail}`,
              );
            } else {
              console.log(
                `Created instrument: ${instrument.id}, ${instrument.instrument}`,
              );
              for (const playlist of playlistsInMenuModified) {
                if (playlist.instrument_ref === instrument.id) {
                  playlist.instrument_ref = updatedInstrument.id;
                }
              }
            }
          }
        }

        // Next, for any playlist that's in original playlistsInMenu, but NOT in
        // playlistsInMenuModified, DELETE it from the playlist table.
        for (const playlist of playlistsInMenu) {
          if (
            !playlistsInMenuModified.some(
              (p) => p.playlist_id === playlist.playlist_id,
            )
          ) {
            const deletedPlaylist = await deletePlaylist(playlist.playlist_id);
            if (deletedPlaylist && "detail" in deletedPlaylist) {
              console.log(`deletePlaylist reports: ${deletedPlaylist.detail}`);
            } else {
              console.log(
                `Deleted playlist: ${deletedPlaylist.playlist_id}, instrument_ref: ${deletedPlaylist.instrument_ref}`,
              );
            }
          }
        }

        // Next, for any playlist that's in playlistsInMenuModified, but NOT in
        // playlistsInMenu, ADD it from the playlist table.
        for (const playlist of playlistsInMenuModified) {
          if (
            !playlistsInMenu.some((p) => p.playlist_id === playlist.playlist_id)
          ) {
            if (playlist.playlist_id < 0) {
              // This is a temporary playlist_id, so we need to create a new playlist
              const newPlaylist: Partial<IPlaylist> = {
                user_ref: getUserId(),
                instrument_ref: playlist.instrument_ref,
                deleted: false,
              };
              const createdPlaylist = await createPlaylist(newPlaylist);
              if (createdPlaylist && "detail" in createdPlaylist) {
                console.log(
                  `createPlaylist reports: ${createdPlaylist.detail}`,
                );
              } else {
                console.log(
                  `Created playlist: ${createdPlaylist.playlist_id}, instrument_ref: ${createdPlaylist.instrument_ref}`,
                );
                playlist.playlist_id = createdPlaylist.playlist_id;
              }
            } else {
              // This is an existing playlist_id, so we need to update the existing playlist
              // with the new instrument_ref.
              const newPlaylist: Partial<IPlaylist> = {
                user_ref: getUserId(),
                instrument_ref: playlist.instrument_ref,
                deleted: false,
              };

              const updatedPlaylist = await updatePlaylist(
                playlist.playlist_id,
                newPlaylist,
              );
              if (updatedPlaylist && "detail" in updatedPlaylist) {
                console.log(
                  `updatePlaylist reports: ${updatedPlaylist.detail}`,
                );
              } else {
                console.log(
                  `Updated playlist: ${updatedPlaylist.playlist_id}, instrument_ref: ${updatedPlaylist.instrument_ref}`,
                );
              }
            }
          }
        }

        // Question: how do the two sets interact?  Let's say instruments is marked green,
        // then I delete it, is the playlist also deleted in this case?

        await fetchPlaylistsAndSetCurrent(getUserId());
        onClose();
      } catch (error) {
        console.error("Error submitting playlists:", error);
      }
    }, [
      instrumentsAllAvailableModified,
      instrumentsAllAvailable,
      playlistsInMenu,
      playlistsInMenuModified,
      fetchPlaylistsAndSetCurrent,
      getUserId,
      onClose,
    ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        checkAndClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [checkAndClose]);

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
    return <div>Loading...</div>;
  }

  return (
    <>
      {showSaveChangesOrNotDialog && (
        <SaveChangesOrNotDialog
          onSave={handleSaveOnClose}
          onDiscard={handleDiscardOnClose}
          onCancel={handleCancelOnClose}
          message="You have unsaved changes. Do you want to save them before closing? Press Save to save, Discard to discard changes, or Cancel to continue editing."
        />
      )}

      <Dialog open={true} modal={true}>
        <DialogPortal>
          <DialogOverlay className="bg-black/50 fixed inset-0" />
          <DialogContent
            ref={dialogRef}
            tabIndex={-1}
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[60rem] p-6 bg-white dark:bg-background rounded-md shadow-2xl border-2 border-gray-400 dark:border-gray-600 focus:outline-none focus:ring-0"
          >
            <DialogHeader className="flex justify-between">
              <DialogTitle className="text-left">
                Edit Repertoire List
              </DialogTitle>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  className="absolute top-0 right-4"
                  onClick={checkAndClose}
                >
                  <XIcon className="w-5 h-5" />
                </Button>
              </DialogClose>
            </DialogHeader>
            <div className="mb-6 mt-4 text-sm text-gray-300 italic">
              Add or remove tune sets from your repertoire list. Preset
              instrument sets can be used, or you can create your own custom
              instrument which only you can see. New custom instruments can be
              created by pressing the blue "
              <span className="text-blue-500 text-1xl">+</span>" (plus) icon.
              You can set a default genre for each custom tune set. To add or
              modify preset instruments, contact the admin.
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thumb-gray-400 scrollbar-track-gray-200">
              <Table>
                <TableHeader>
                  <TableRow
                    className={`${styles.dialog_table} h-10 bg-gray-200 dark:bg-gray-800 sticky top-[-1px] z-40`}
                  >
                    <TableHead className={`${styles.column_include} p-0 mt-0`}>
                      <Button
                        variant="ghost"
                        onClick={() => {}}
                        disabled
                        className="bg-transparent ml-[1em] text-inherit disabled:text-inherit disabled:opacity-100"
                      >
                        <ListChecksIcon className="w-5 h-5" />
                      </Button>
                    </TableHead>
                    <TableHead className={`${styles.column_id}`}>
                      <div className="pl-0">Id</div>
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
                        className="bg-transparent hover:bg-green-400/10 ml-[1em] mt-[-2px]"
                        onClick={handleAddInstrument}
                      >
                        <PlusIcon className="w-5 h-5 text-blue-500" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...instrumentsAllAvailableModified]
                    .sort((a, b) => Math.abs(b.id) - Math.abs(a.id))
                    .map((editedInstrumentRow, index) => (
                      <TableRow
                        key={editedInstrumentRow.id}
                        className={styles.dialog_table}
                      >
                        <TableCell className={`${styles.column_include}`}>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void handleToggleUserTuneSetList(
                                editedInstrumentRow,
                              )
                            }
                          >
                            {playlistsInMenuModified.some(
                              (p) =>
                                p.instrument_ref === editedInstrumentRow.id,
                            ) ? (
                              <SquareCheckBigIcon className="w-5 h-5 text-green-500" />
                            ) : (
                              <SquareIcon className="w-5 h-5" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className={`${styles.column_id}`}>
                          <Input
                            value={editedInstrumentRow.id ?? "?"}
                            placeholder="Id"
                            disabled
                            className="p-0 m-0 w-[3em]"
                          />
                        </TableCell>
                        <TableCell className={styles.column_instrument}>
                          <Input
                            ref={index === 0 ? newInstrumentRef : null}
                            value={editedInstrumentRow.instrument ?? ""}
                            onChange={(e) =>
                              handleEditInstrument(
                                editedInstrumentRow.id,
                                "instrument",
                                e.target.value,
                              )
                            }
                            placeholder="Instrument"
                            disabled={editedInstrumentRow.private_to_user === 0}
                            className="p-0 m-0"
                          />
                        </TableCell>
                        <TableCell className={styles.column_genre_default}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={`${styles.column_genre_default} flex items-center justify-between ${editedInstrumentRow.private_to_user === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                              disabled={
                                editedInstrumentRow.private_to_user === 0
                              }
                            >
                              {editedInstrumentRow.genre_default || "(not set)"}
                              {editedInstrumentRow.private_to_user !== 0 && (
                                <ChevronDownIcon className="w-5 h-5" />
                              )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-60 overflow-y-auto">
                              {genres.map((genre) => (
                                <DropdownMenuItem
                                  key={genre.id}
                                  onSelect={() => {
                                    handleEditInstrument(
                                      editedInstrumentRow.id,
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
                        </TableCell>
                        <TableCell className={styles.column_description}>
                          <Input
                            value={`${editedInstrumentRow.description}`}
                            onChange={(e) =>
                              handleEditInstrument(
                                editedInstrumentRow.id,
                                "description",
                                e.target.value,
                              )
                            }
                            disabled={editedInstrumentRow.private_to_user === 0}
                            placeholder="Description"
                          />
                        </TableCell>
                        <TableCell
                          className={`${styles.column_change_controls} p-4 mt-0`}
                        >
                          {editedInstrumentRow.private_to_user !== 0 ? (
                            <Button
                              variant="destructive"
                              className="bg-transparent"
                              onClick={() =>
                                handleDeleteInstrument(editedInstrumentRow.id)
                              }
                            >
                              <TrashIcon className="w-5 h-5" />
                            </Button>
                          ) : (
                            <Button
                              variant="destructive"
                              className="bg-transparent"
                              onClick={() => handleDeleteInstrument(index)}
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
            </div>

            <DialogFooter className={`${styles.dialog_footer}`}>
              <Button
                variant="ghost"
                onClick={() => void handleSubmit()}
                disabled={hasNoChanges()}
                className="w-full mt-6 border border-gray-300"
              >
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
