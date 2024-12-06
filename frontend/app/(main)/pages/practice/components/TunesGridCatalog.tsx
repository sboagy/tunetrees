"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import { useTunesTable } from "./TunesTable"; // Add this import

import { Input } from "@/components/ui/input";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";

import type {
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { BetweenHorizontalEnd } from "lucide-react";
import {
  createPlaylistTune,
  getTunesOnlyIntoOverview,
  intersectPlaylistTunes,
} from "../queries";
import { fetchFilterFromDB, updateTableStateInDb } from "../settings";
import type { IPlaylistTune, ITuneOverview } from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import DeleteTuneButton from "./DeleteTuneButton";
import NewTuneButton from "./NewTuneButton";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useAllTunes } from "./TunesContextAll";
import { useRepertoireTunes } from "./TunesContextRepertoire";
import TunesGrid from "./TunesGrid";

type AllGridProps = {
  userId: number;
};

/**
 * TunesGridAll component displays a grid of all public tunes as well as any private tunes.
 *
 * @remarks
 * - The component uses the `useTunes` and `useTuneDataRefresh` hooks to manage the tunes data and refresh state.
 * - The `refreshTunes` function fetches the recently practiced tunes and updates the state.
 * - The component includes a filter input, a button to add selected tunes to the review queue, and a grid to display the tunes.
 * - The `addToReviewQueue` function handles adding selected tunes to the review queue and submitting feedback.
 */
export default function TunesGridCatalog({
  userId,
}: AllGridProps): JSX.Element {
  const [isRowsSelected, setIsRowsSelected] = useState(false);
  const selectionChangedCallback = (
    table: TanstackTable<ITuneOverview>,
    rowSelectionState: RowSelectionState,
  ): void => {
    const selectedRowsCount = Object.keys(rowSelectionState).length;
    setIsRowsSelected(selectedRowsCount > 0);
  };
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFilterLoaded, setIsFilterLoaded] = useState(false);
  const { currentPlaylist: playlistId } = usePlaylist();
  const { setTunesRefreshId: setRepertoireTunesRefreshId } =
    useRepertoireTunes();

  console.log(
    `LF1 render TunesGridAll: playlistId=${playlistId}, userId=${userId}`,
  );

  // The tunes are persisted in a context to avoid fetching them multiple times
  // during the life of the app if they haven't changed. The tunesRefreshId,
  // which is specific to the All grid, is used to track the last refresh
  // of the tunes. The refreshId, which is global to the app, is
  // used to compare to tunesRefreshId to trigger a refresh of the tunes when it changes.
  const { tunes, setTunes, tunesRefreshId, setTunesRefreshId } = useAllTunes();
  const { refreshId, triggerRefresh } = useTuneDataRefresh();
  // const { currentTune } = useTune();

  // Due to the asynchronous nature of setTunesRefreshId, the state update may not
  // complete before the useEffect hook exits. This can lead to multiple refreshes
  // being triggered before tunesRefreshId is updated. To prevent this, we use a ref
  // (isRefreshing) to track the refresh state. The useRef hook allows the value to
  // persist across renders without causing re-renders.
  const isRefreshing = useRef(false);

  const showDeleted = false; // Should become a state variable at some point

  const refreshTunes = useCallback(
    async (userId: number, playlistId: number, refreshId: number) => {
      try {
        const result: ITuneOverview[] =
          await getTunesOnlyIntoOverview(showDeleted);
        setTunesRefreshId(refreshId);
        setTunes(result);
        isRefreshing.current = false;
        console.log(`LF1 AllGrid setTunesRefreshId(${refreshId})`);
        return result;
      } catch (error) {
        console.error("LF1 Error refreshing tunes:", error);
        throw error;
      }
    },
    [setTunes, setTunesRefreshId],
  );

  useEffect(() => {
    if (
      playlistId > 0 &&
      tunesRefreshId !== refreshId &&
      !isRefreshing.current
    ) {
      console.log(
        `LF1 AllGrid call refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
      isRefreshing.current = true;
      refreshTunes(userId, playlistId, refreshId)
        .then((result: ITuneOverview[]) => {
          console.log(`LF1 AllGrid number tunes: ${result.length}`);
          console.log(
            `LF1 AllGrid back from refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
          );
        })
        .catch((error) => {
          isRefreshing.current = false;
          console.error("LF1 Error invoking refreshTunes:", error);
        })
        .finally(() => {
          isRefreshing.current = false;
        });
    } else {
      console.log(
        `LF1 AllGrid skipping refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
    }
  }, [refreshId, tunesRefreshId, userId, playlistId, refreshTunes]);

  const [tableComponent, table] = useTunesTable({
    tunes,
    userId,
    tablePurpose: "catalog",
    globalFilter: globalFilter,
    onRecallEvalChange: undefined, // not needed for All
    selectionChangedCallback,
    setTunesRefreshId,
  });

  useEffect(() => {
    const getFilter = () => {
      fetchFilterFromDB(userId, "catalog", playlistId)
        .then((filter) => {
          setGlobalFilter(filter);
          setIsFilterLoaded(true);
        })
        .catch((error) => {
          console.error("Error fetching filter:", error);
          setIsFilterLoaded(true);
        });
    };

    getFilter();
  }, [userId, playlistId]);

  const handleGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilter(value);
    if (table !== null) {
      console.log("LF7: Saving table state on filter change: ", value);
      // (See comment in TunesGridRepertoire.tsx handleGlobalFilterChange)
      const tableState: TableState = table.getState();
      tableState.globalFilter = value;
      void updateTableStateInDb(
        userId,
        "full",
        "catalog",
        playlistId,
        tableState,
      );
    }
  };

  // const [preset, setPreset] = useState("");

  // const handlePresetChange = (value: string) => {
  //   setPreset(value);
  //   // Implement preset logic here
  // };

  const addToRepertoire = async () => {
    console.log("addToRepertoire!");
    if (table === null) {
      console.log("addToRepertoire: table is null");
      return;
    }
    const selectedTunes = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);

    const selectedTuneIds = selectedTunes.map((tune) => tune.id ?? -1);
    console.log("Selected tune IDs:", selectedTuneIds);

    const alreadyInRepertoire = await intersectPlaylistTunes(
      selectedTuneIds,
      playlistId,
    );

    const tunesToAddToPlaylist: number[] = selectedTuneIds.filter(
      (id) => !alreadyInRepertoire.includes(id),
    );

    let userConfirmed = true;

    if (alreadyInRepertoire.length > 0) {
      if (tunesToAddToPlaylist.length > 0) {
        userConfirmed = window.confirm(
          `The following tunes are already in the current repertoir: ${alreadyInRepertoire.join(",")}. Do you want to add tunes with ids ${tunesToAddToPlaylist.join(",")} to your repertoire?`,
        );
      } else {
        window.alert(
          `All the selected tunes are already in the current repertoir: ${alreadyInRepertoire.join(",")}.`,
        );
        return;
      }
    } else if (tunesToAddToPlaylist.length > 10) {
      userConfirmed = window.confirm(
        `You are about to add ${tunesToAddToPlaylist.length} tunes to your repertoire. Are you sure?`,
      );
    }

    if (!userConfirmed) {
      console.log("User canceled adding tunes to repertoire.");
      return;
    }

    for (const tuneId of tunesToAddToPlaylist) {
      const playlistTune: IPlaylistTune = {
        tune_ref: tuneId,
        playlist_ref: playlistId,
        current: "T",
        learned: new Date().toISOString().replace("T", " ").slice(0, 19),
        deleted: false,
      };
      createPlaylistTune(playlistTune)
        .then((result) => {
          console.log("Added tune to repertoire:", result);
        })
        .catch((error) => {
          console.error("Error adding tune to repertoire:", error);
        });
    }
    const rows = table.getSelectedRowModel().rows;
    for (const row of rows) {
      console.log("Selected row:", row.original);
      row.toggleSelected();
    }
    setRepertoireTunesRefreshId(0);

    // const rowSelectionCopy = { ...table.getState().rowSelection };
    // for (const tuneId of tunesToAddToPlaylist) {
    //   delete rowSelectionCopy[tuneId];
    // }
    // table.setState({ ...table.getState(), rowSelection: rowSelectionCopy });
    // const status = await saveTableState(table, userId, "catalog");
    // console.log("saveTableState status:", status);
    // triggerRefresh();
  };

  return (
    <div className="w-full h-full">
      {tableComponent}
      {!isFilterLoaded || !table || playlistId <= 0 ? (
        <p>Loading...</p>
      ) : (
        <>
          <div
            id="tt-all-tunes-header"
            className="flex items-center justify-between py-4"
          >
            <div className="flex items-center space-x-4 mb-4">
              <Button
                disabled={!isRowsSelected}
                variant="outline"
                onClick={() => void addToRepertoire()}
                title="Add selected tunes to review queue"
              >
                <BetweenHorizontalEnd />
                {window.innerWidth < 768 ? "" : " Add To Repertoire"}
              </Button>
              {/* <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear</SelectItem>
                  <SelectItem value="oldest">Show Oldest Not Played</SelectItem>
                  <SelectItem value="lapsed">Show Recently Lapsed</SelectItem>
                  <SelectItem value="selected">Show Only Selected</SelectItem>
                </SelectContent>
              </Select> */}
            </div>
            <div
              className="flex items-center space-x-4 mb-4"
              style={{ width: "60ch" }}
            >
              <Input
                placeholder="Filter"
                value={globalFilter}
                onChange={handleGlobalFilterChange}
              />
            </div>
            <div className="flex items-center space-x-4 mb-4">
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {"<"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {">"}
              </Button> */}
              <ColumnsMenu
                user_id={userId}
                tablePurpose="catalog"
                playlistId={playlistId}
                table={table}
                triggerRefresh={triggerRefresh}
              />
              <NewTuneButton userId={userId} playlistId={playlistId} />
              <DeleteTuneButton
                userId={userId}
                disabled={!isRowsSelected}
                table={table}
              />
            </div>
          </div>
          <TunesGrid
            table={table}
            userId={userId}
            playlistId={playlistId}
            tablePurpose={"catalog"}
          />
        </>
      )}
    </div>
  );
}
