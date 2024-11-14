"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type IScheduledTunesType, TunesTable } from "./TunesGrid";

import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState, type JSX } from "react";

import type {
  RowSelectionState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { submitPracticeFeedbacks } from "../commands";
import type { Tune } from "../types";
import NewTuneButton from "./NewTuneButton";
import { FastForward } from "lucide-react";
import { getRecentlyPracticed } from "../queries";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";

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

type RepertoireGridProps = {
  userId: number;
  playlistId: number;
};

export default function RepertoireGrid({
  userId,
  playlistId,
}: RepertoireGridProps): JSX.Element {
  const [isAddToReviewQueueEnabled, setIsAddToReviewQueueEnabled] =
    useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const selectionChangedCallback = (
    table: TanstackTable<Tune>,
    rowSelectionState: RowSelectionState,
  ): void => {
    const selectedRowsCount = Object.keys(rowSelectionState).length;
    setIsAddToReviewQueueEnabled(selectedRowsCount > 0);
  };
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFilterLoaded, setIsFilterLoaded] = useState(false);
  const [tunes, setTunes] = useState<Tune[]>([]);
  const { refreshId, triggerRefresh } = useTuneDataRefresh();

  const refreshTunes = useCallback((userId: number, playlistId: number) => {
    getRecentlyPracticed(userId, playlistId)
      .then((result: Tune[]) => {
        setTunes(result);
      })
      .catch((error) => {
        console.error("Error refreshing tunes:", error);
      });
  }, []);

  useEffect(() => {
    refreshTunes(userId, playlistId);
  }, [userId, playlistId, refreshTunes]);

  useEffect(() => {
    console.log("ScheduledTunesGrid refreshId:", refreshId);
    refreshTunes(userId, playlistId);
  }, [refreshId, userId, playlistId, refreshTunes]);

  const tunesWithFilter: IScheduledTunesType = {
    tunes,
    userId,
    playlistId,
    tablePurpose: "repertoire",
    globalFilter: globalFilter,
  };
  const table = TunesTable(tunesWithFilter);

  useEffect(() => {
    const getFilter = () => {
      fetchFilterFromDB(userId, "repertoire")
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

    // TODO: Implement addToReviewQueue logic
    // 1. Get the checkmarked tunes
    // 2. Create a TuneUpdate object for each tune
    // 3. Send the TuneUpdate objects to the server for scheduling
    // 4. Update the UI to reflect the changes

    // const updates: { [key: string]: ITuneUpdate } = {};

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
        table.resetRowSelection();
        triggerRefresh();
      })
      .catch((error) => {
        console.error("Error submit_practice_feedbacks_result:", error);
        throw error;
      });

    // const updates: { [key: string]: TuneUpdate } = {};
  };

  // const filteredData: Tune[] = tunes.tunes.filter((item: Tune) =>
  //   Object.values(item).some((value) =>
  //     value
  //       ? value.toString().toLowerCase().includes(filter.toLowerCase())
  //       : true,
  //   ),
  // );

  // table.getRowModel().rows = table
  //   .getRowModel()
  //   .rows.filter((row) =>
  //     Object.values(row.original).some((value) =>
  //       value
  //         ? value.toString().toLowerCase().includes(filter.toLowerCase())
  //         : true,
  //     ),
  //   );

  return (
    <div className="w-full h-full">
      {/* Optionally, show a loading indicator */}
      {!isFilterLoaded ? (
        <p>Loading...</p>
      ) : (
        <>
          <div
            id="tt-repertoire-tunes-header"
            className="flex items-center justify-between py-4"
          >
            <div className="flex items-center space-x-4 mb-4">
              <Button
                disabled={!isAddToReviewQueueEnabled}
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
                }}
              />
            </div>
            <div className="flex items-center space-x-4 mb-4">
              <Button
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
              </Button>
              <ColumnsMenu user_id={userId} table={table} />
              <NewTuneButton userId={userId} playlistId={playlistId} />
            </div>
          </div>
          <TunesGrid
            table={table}
            userId={userId}
            playlistId={playlistId}
            tablePurpose={"repertoire"}
          />
        </>
      )}
    </div>
  );
}
