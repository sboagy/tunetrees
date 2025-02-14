"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import { globalFlagManualSorting, useTunesTable } from "./TunesTable"; // Add this import

import { Input } from "@/components/ui/input";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";

import type {
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { BetweenHorizontalEnd } from "lucide-react";
import { submitPracticeFeedbacks } from "../commands";
import { getRepertoireTunesOverview } from "../queries";
import {
  fetchFilterFromDB,
  getTableStateTable,
  updateTableStateInDb,
} from "../settings";
import type { ITableStateTable, ITuneOverview } from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import DeleteTuneButton from "./DeleteTuneButton";
import NewTuneButton from "./NewTuneButton";
import { useSitDownDate } from "./SitdownDateProvider";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useRepertoireTunes } from "./TunesContextRepertoire";
import TunesGrid from "./TunesGrid";

type RepertoireGridProps = {
  userId: number;
};

/**
 * RepertoireTunesGrid component displays a grid of tunes for a given user and playlist,
 * along with a toolbar for filtering, refreshing, and selecting tunes.
 *
 * @remarks
 * - The component uses the `useTunes` and `useTuneDataRefresh` hooks to manage the tunes data and refresh state.
 * - The `refreshTunes` function fetches the recently practiced tunes and updates the state.
 * - The component includes a filter input, a button to add selected tunes to the review queue, and a grid to display the tunes.
 * - The `addToReviewQueue` function handles adding selected tunes to the review queue and submitting feedback.
 */
export default function TunesGridRepertoire({
  userId,
}: RepertoireGridProps): JSX.Element {
  const [isRowsSelected, setIsRowsSelected] = useState(false);
  const selectionChangedCallback = (
    table: TanstackTable<ITuneOverview>,
    rowSelectionState: RowSelectionState,
  ): void => {
    const selectedRowsCount = Object.keys(rowSelectionState).length;
    console.log(
      `LF7: selectionChangedCallback rowSelectionState=${JSON.stringify(rowSelectionState)}, selectedRowsCount:${selectedRowsCount}`,
    );
    setIsRowsSelected(selectedRowsCount > 0);
  };
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFilterLoaded, setIsFilterLoaded] = useState(false);
  const { currentPlaylist: playlistId } = usePlaylist();
  const showDeleted = false; // Should become a state variable at some point

  console.log(
    `LF1 render RepertoireTunesGrid: playlistId=${playlistId}, userId=${userId}`,
  );

  // The tunes are persisted in a context to avoid fetching them multiple times
  // during the life of the app if they haven't changed. The tunesRefreshId,
  // which is specific to the repertoire grid, is used to track the last refresh
  // of the tunes. The refreshId, which is global to the app, is
  // used to compare to tunesRefreshId to trigger a refresh of the tunes when it changes.
  const {
    tunes,
    setTunes,
    tunesRefreshId,
    setTunesRefreshId,
    lapsedCount,
    currentCount,
    futureCount,
    newCount,
  } = useRepertoireTunes();

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
        // Given the sequence, since table isn't really created yet, not sure how
        // to better keep the sorting state up to date.  A bit of a chcken and egg
        // problem.  So, for now, just get the sorting state from the database every
        // time.  We'll see if this can be optimized later.  There may be some other
        // state that will have the same problem, like column filters, so, probably
        // best to wait until functionaly complete before trying to optimize.
        let sortingState = null;
        if (globalFlagManualSorting) {
          const tableStateTable: ITableStateTable | null =
            await getTableStateTable(userId, "full", "repertoire", playlistId);
          sortingState =
            (tableStateTable?.settings as TableState)?.sorting ?? null;
        }
        const result: ITuneOverview[] = await getRepertoireTunesOverview(
          userId,
          playlistId,
          showDeleted,
          sortingState,
        );
        setTunesRefreshId(refreshId);
        setTunes(result);
        console.log(`LF1 RepertoireGrid setTunesRefreshId(${refreshId})`);
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
    if (
      playlistId > 0 &&
      tunesRefreshId !== refreshId &&
      !isRefreshing.current
    ) {
      console.log(
        `useEffect ===> TunesGridRepertoire.tsx:127 ~ call refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
      isRefreshing.current = true;
      refreshTunes(userId, playlistId, refreshId)
        .then((result: ITuneOverview[]) => {
          console.log(`LF1 RepertoireGrid number tunes: ${result.length}`);
          console.log(
            `LF1 RepertoireGrid back from refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
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
        `useEffect ===> TunesGridRepertoire.tsx:146 ~ SKIPPING refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
    }
  }, [refreshId, tunesRefreshId, userId, playlistId, refreshTunes]);

  const [tableComponent, table] = useTunesTable({
    tunes,
    userId,
    tablePurpose: "repertoire",
    globalFilter: globalFilter,
    onRecallEvalChange: undefined, // not needed for repertoire
    selectionChangedCallback,
    setTunesRefreshId,
  });

  useEffect(() => {
    const getFilter = () => {
      fetchFilterFromDB(userId, "repertoire", playlistId)
        .then((filter) => {
          setGlobalFilter(filter);
          setIsFilterLoaded(true);
        })
        .catch((error) => {
          console.error("Error fetching filter:", error);
          setIsFilterLoaded(true);
        });
    };

    console.log(
      `useEffect ===> TunesGridRepertoire.tsx:173 ~ [userId=${userId}, playlistId=${playlistId}]`,
    );
    getFilter();
  }, [userId, playlistId]);

  const handleGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilter(value);
    if (table !== null) {
      console.log("LF7: Saving table state on filter change: ", value);
      // If I try to go through `table.setGlobalFilter(value)`, and then
      // `saveTableState(table, userId, "repertoire", playlistId)`, it doesn't work
      // so well, always being one character behind, presumably because it feeds through
      // the useState hook. So, instead directly get the state here, update it, and then
      // save it into the database.  Note that updateTableStateInDb will lock while it's
      // updating the database, so hopefully not a problem with getting ahead of the writes.
      const tableState: TableState = table.getState();
      tableState.globalFilter = value;
      void updateTableStateInDb(
        userId,
        "full",
        "repertoire",
        playlistId,
        tableState,
      );
    }
  };

  // useEffect(() => {
  //   return () => {
  //     if (table !== null) {
  //       console.log("LF7: Saving table state on filter change: ", globalFilter);
  //       table.setGlobalFilter(globalFilter);
  //       void saveTableState(table, userId, "repertoire", playlistId);
  //     }
  //   };
  // }, [globalFilter, table, userId, playlistId]);

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

  const { sitDownDate } = useSitDownDate();

  const getStyleForSchedulingState = (
    scheduledDateString: string | null,
  ): string => {
    if (!scheduledDateString) {
      return "underline"; // Return underline to signify new tune, has not been scheduled
    }

    const scheduledDate = new Date(scheduledDateString);
    if (Number.isNaN(scheduledDate.getTime())) {
      return "outline-red-500"; // Outline in red to show date is invalid (i.e. error state)
    }

    // reviewSitdownDateNoHours has to go to the server, thus is set by useEffect.
    if (sitDownDate) {
      const lowerBoundReviewSitdownDate = new Date(sitDownDate);
      lowerBoundReviewSitdownDate.setDate(sitDownDate.getDate() - 7);
      if (scheduledDate < lowerBoundReviewSitdownDate) {
        return "underline text-gray-300";
      }
      if (
        scheduledDate > lowerBoundReviewSitdownDate &&
        scheduledDate <= sitDownDate
      ) {
        return "font-extrabold";
      }
      return "italic text-green-300";
    }
    return "";
  };

  return (
    <div className="w-full h-full">
      {tableComponent}
      {!isFilterLoaded || !table || playlistId <= 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          {playlistId <= 0 ? (
            <p className="text-lg">No Playlist</p>
          ) : (
            <p className="text-lg">Loading...</p>
          )}
        </div>
      ) : (
        <>
          <div
            id="tt-repertoire-tunes-header"
            className="flex items-center justify-between py-4"
          >
            <div className="flex items-center space-x-4 mb-4">
              <Button
                disabled={!isRowsSelected}
                variant="outline"
                onClick={() => addToReviewQueue()}
                title="Add selected tunes to review queue"
              >
                <BetweenHorizontalEnd />
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
                tablePurpose="repertoire"
                playlistId={playlistId}
                table={table}
                triggerRefresh={triggerRefresh}
              />
              <NewTuneButton userId={userId} playlistId={playlistId} />
              <DeleteTuneButton
                userId={userId}
                playlistId={playlistId}
                disabled={!isRowsSelected}
                table={table}
              />
            </div>
          </div>
          <TunesGrid
            table={table}
            userId={userId}
            playlistId={playlistId}
            tablePurpose={"repertoire"}
            getStyleForSchedulingState={getStyleForSchedulingState}
            lapsedCount={lapsedCount}
            currentCount={currentCount}
            futureCount={futureCount}
            newCount={newCount}
          />
        </>
      )}
    </div>
  );
}
