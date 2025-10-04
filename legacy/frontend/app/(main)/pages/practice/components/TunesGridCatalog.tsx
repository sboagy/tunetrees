"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import { useTunesTable, saveTableState } from "./TunesTable"; // Add this import

import { Input } from "@/components/ui/input";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { logVerbose } from "@/lib/logging";

import type {
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { BetweenHorizontalEnd } from "lucide-react";
import {
  createPlaylistTuneAction,
  getTunesOnlyIntoOverviewAction,
  intersectPlaylistTunesAction,
} from "../actions/practice-actions";
import { fetchFilterFromDB, updateTableStateInDb } from "../settings";
import type { IPlaylistTune, ITuneOverview } from "../types";
import AddTuneButtonAndDialog from "./AddTuneButtonAndDialog";
import { usePlaylist } from "./CurrentPlaylistProvider";
import DeleteTuneButton from "./DeleteTuneButton";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useCatalogTunes } from "./TunesContextCatalog";
import { useRepertoireTunes } from "./TunesContextRepertoire";
import TunesGrid from "./TunesGrid";

type CatalogGridProps = {
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
}: CatalogGridProps): JSX.Element {
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

  logVerbose(
    `LF1 render TunesGridAll: playlistId=${playlistId}, userId=${userId}`,
  );

  // The tunes are persisted in a context to avoid fetching them multiple times
  // during the life of the app if they haven't changed. The tunesRefreshId,
  // which is specific to the All grid, is used to track the last refresh
  // of the tunes. The refreshId, which is global to the app, is
  // used to compare to tunesRefreshId to trigger a refresh of the tunes when it changes.
  const { tunes, setTunes, tunesRefreshId, setTunesRefreshId } =
    useCatalogTunes();
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
          await getTunesOnlyIntoOverviewAction(showDeleted);
        setTunes(result);
        setTunesRefreshId(refreshId);
        logVerbose(`LF1 AllGrid setTunesRefreshId(${refreshId})`);
        return result;
      } catch (error) {
        console.error("LF1 Error refreshing tunes:", error);
        throw error;
      } finally {
        isRefreshing.current = false;
      }
    },
    [setTunes, setTunesRefreshId],
  );

  useEffect(() => {
    if (tunesRefreshId !== refreshId && !isRefreshing.current) {
      logVerbose(
        `useEffect ===> TunesGridCatalog.tsx:108 ~ [refreshId=${refreshId}, tunesRefreshId=${tunesRefreshId}, userId=${userId}, playlist=${playlistId}, refreshTunes(callback)]`,
      );
      isRefreshing.current = true;
      refreshTunes(userId, playlistId, refreshId)
        .then((result: ITuneOverview[]) => {
          logVerbose(`LF1 TunesGridCatalog number tunes: ${result.length}`);
          logVerbose(
            `LF1 TunesGridCatalog back from refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
          );
        })
        .catch((error) => {
          console.error("LF1 Error invoking refreshTunes:", error);
        })
        .finally(() => {
          isRefreshing.current = false;
        });
    } else {
      logVerbose(
        `useEffect ===> TunesGridCatalog.tsx:127 ~ SKIPPING [refreshId=${refreshId}, tunesRefreshId=${tunesRefreshId}, userId=${userId}, playlist=${playlistId}, refreshTunes(callback)]`,
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

    logVerbose(
      `useEffect ===> TunesGridCatalog.tsx:156 ~ [userId=${userId}}, playlistId=${playlistId}]`,
    );
    getFilter();
  }, [userId, playlistId]);

  const handleGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilter(value);
    if (table !== null) {
      logVerbose("LF7: Saving table state on filter change: ", value);
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
    logVerbose("addToRepertoire!");
    if (table === null) {
      logVerbose("addToRepertoire: table is null");
      return;
    }
    const selectedTunes = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);

    const selectedTuneIds = selectedTunes.map((tune) => tune.id ?? -1);
    logVerbose("Selected tune IDs:", selectedTuneIds);

    const alreadyInRepertoire = await intersectPlaylistTunesAction(
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
          `The following tunes are already in the current repertoire: ${alreadyInRepertoire.join(",")}. Do you want to add tunes with ids ${tunesToAddToPlaylist.join(",")} to your repertoire?`,
        );
      } else {
        window.alert(
          `All the selected tunes are already in the current repertoire: ${alreadyInRepertoire.join(",")}.`,
        );
        return;
      }
    } else if (tunesToAddToPlaylist.length > 10) {
      userConfirmed = window.confirm(
        `You are about to add ${tunesToAddToPlaylist.length} tunes to your repertoire. Are you sure?`,
      );
    }

    if (!userConfirmed) {
      logVerbose("User canceled adding tunes to repertoire.");
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
      createPlaylistTuneAction(playlistTune)
        .then((result) => {
          logVerbose("Added tune to repertoire:", result);
        })
        .catch((error) => {
          console.error("Error adding tune to repertoire:", error);
        });
    }

    // Clear all row selections - the original logic was incorrect
    // Row selection keys are row indices as strings, not tune IDs
    table.setRowSelection({});

    // Wait a moment for the table state to update
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Save the table state with cleared selections
    try {
      const status = await saveTableState(table, userId, "catalog", playlistId);
      logVerbose("saveTableState status:", status);

      // Check for HTTP success status codes (200-299)
      if (status >= 200 && status < 300) {
        logVerbose("Table state saved successfully with cleared selections");
      } else {
        console.warn(
          `Table state save returned status: ${status}, but continuing...`,
        );
      }
    } catch (error) {
      console.error("Error saving table state with cleared selections:", error);
      // Don't fail the operation - the selections are cleared in memory
    }

    setRepertoireTunesRefreshId(0);
    triggerRefresh();
  };

  return (
    <div className="w-full h-full">
      {tableComponent}
      {!isFilterLoaded || !table ? (
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
              {/* <NewTuneButton userId={userId} playlistId={playlistId} /> */}
              <AddTuneButtonAndDialog userId={userId} playlistId={playlistId} />
              <DeleteTuneButton
                userId={userId}
                disabled={!isRowsSelected}
                table={table}
              />
              <ColumnsMenu
                user_id={userId}
                tablePurpose="catalog"
                playlistId={playlistId}
                table={table}
                triggerRefresh={triggerRefresh}
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
