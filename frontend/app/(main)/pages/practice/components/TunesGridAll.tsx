"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import { useTunesTable } from "./TunesTable"; // Add this import

import { Input } from "@/components/ui/input";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";

import type {
  RowSelectionState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { FastForward } from "lucide-react";
import { submitPracticeFeedbacks } from "../commands";
import { getRepertoireTunesOverview } from "../queries";
import type { TuneOverview } from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import DeleteTuneButton from "./DeleteTuneButton";
import NewTuneButton from "./NewTuneButton";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useAllTunes } from "./TunesContextAll";
import TunesGrid from "./TunesGrid";

async function fetchFilterFromDB(
  userId: number,
  purpose: string,
): Promise<string> {
  const response = await fetch(
    `/api/getFilter?userId=${userId}&purpose=${purpose}`,
  );
  const data = await response.json();
  return String(data.filter);
}

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
export default function TunesGridAll({ userId }: AllGridProps): JSX.Element {
  const [isRowsSelected, setIsRowsSelected] = useState(false);
  const selectionChangedCallback = (
    table: TanstackTable<TuneOverview>,
    rowSelectionState: RowSelectionState,
  ): void => {
    const selectedRowsCount = Object.keys(rowSelectionState).length;
    setIsRowsSelected(selectedRowsCount > 0);
  };
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFilterLoaded, setIsFilterLoaded] = useState(false);
  const { currentPlaylist: playlistId } = usePlaylist();

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

  // Due to the asynchronous nature of setTunesRefreshId, the state update may not
  // complete before the useEffect hook exits. This can lead to multiple refreshes
  // being triggered before tunesRefreshId is updated. To prevent this, we use a ref
  // (isRefreshing) to track the refresh state. The useRef hook allows the value to
  // persist across renders without causing re-renders.
  const isRefreshing = useRef(false);

  const refreshTunes = useCallback(
    async (userId: number, playlistId: number, refreshId: number) => {
      try {
        const result: TuneOverview[] = await getRepertoireTunesOverview(
          userId,
          playlistId,
        );
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
        .then((result: TuneOverview[]) => {
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
    tablePurpose: "all",
    globalFilter: globalFilter,
    onRecallEvalChange: undefined, // not needed for All
    selectionChangedCallback,
    setTunesRefreshId,
  });

  useEffect(() => {
    const getFilter = () => {
      fetchFilterFromDB(userId, "all")
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
  }, [userId]);

  // const [preset, setPreset] = useState("");

  // const handlePresetChange = (value: string) => {
  //   setPreset(value);
  //   // Implement preset logic here
  // };

  const addToReviewQueue = () => {
    console.log("addToReviewQueue!");
    if (table === null) {
      console.log("addToReviewQueue: table is null");
      return;
    }
    const selectedTunes = table
      .getSelectedRowModel()
      .rows.map((row) => row.original);
    const updates: { [key: string]: { feedback: string } } = {};

    for (const tune of selectedTunes) {
      const idString = `${tune.id}`;
      updates[idString] = { feedback: "rescheduled" };
    }
    console.log("updates", updates);

    const promiseResult = submitPracticeFeedbacks({
      playlistId,
      updates,
    });
    promiseResult
      .then((result) => {
        console.log("submit_practice_feedbacks_result result:", result);
        if (table !== null) {
          table.resetRowSelection();
        }
        triggerRefresh();
      })
      .catch((error) => {
        console.error("Error submit_practice_feedbacks_result:", error);
        throw error;
      });

    // const updates: { [key: string]: TuneUpdate } = {};
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
                onClick={() => addToReviewQueue()}
                title="Add selected tunes to review queue"
              >
                <FastForward />
                {window.innerWidth < 768 ? "" : " Add To Review"}
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
                onChange={(e) => {
                  setGlobalFilter(e.target.value);
                  // void handleSave();
                }}
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
            tablePurpose={"all"}
          />
        </>
      )}
    </div>
  );
}
