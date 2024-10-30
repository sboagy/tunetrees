"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type IScheduledTunesType, TunesTable } from "./TunesGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

import type {
  RowSelectionState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { submitPracticeFeedbacks } from "../commands";
import type { Tune } from "../types";

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

export default function RepertoireGrid(
  tunes: IScheduledTunesType,
): JSX.Element {
  const [isAddToReviewQueueEnabled, setIsAddToReviewQueueEnabled] =
    useState(false);
  const selectionChangedCallback = (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    table: TanstackTable<Tune>,
    rowSelectionState: RowSelectionState,
  ): void => {
    const selectedRowsCount = Object.keys(rowSelectionState).length;
    setIsAddToReviewQueueEnabled(selectedRowsCount > 0);
  };
  const refreshDataCallback = tunes.refreshData;

  const [globalFilter, setGlobalFilter] = useState("");
  const [isFilterLoaded, setIsFilterLoaded] = useState(false);

  useEffect(() => {
    const getFilter = () => {
      fetchFilterFromDB(
        Number.parseInt(tunes.user_id),
        String(tunes.table_purpose),
      )
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
  }, [tunes]);

  const tunesWithFilter = { ...tunes, globalFilter };
  const table = TunesTable(tunesWithFilter, selectionChangedCallback);
  const [preset, setPreset] = useState("");

  const handlePresetChange = (value: string) => {
    setPreset(value);
    // Implement preset logic here
  };

  const addToReviewQueue = (
    refreshData: () => Promise<{
      scheduledData: Tune[];
      repertoireData: Tune[];
    }>,
  ) => {
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

    const playlistId = tunes.playlist_id;

    const promiseResult = submitPracticeFeedbacks({
      playlist_id: playlistId,
      updates,
    });
    promiseResult
      .then((result) => {
        console.log("submit_practice_feedbacks_result result:", result);
        table.resetRowSelection();
        void refreshData();
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
    <div className="w-full">
      {/* Optionally, show a loading indicator */}
      {!isFilterLoaded ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4 mb-4">
              <Button
                disabled={!isAddToReviewQueueEnabled}
                variant="outline"
                onClick={() => addToReviewQueue(refreshDataCallback)}
              >
                Add To Review Queue
              </Button>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear</SelectItem>
                  <SelectItem value="oldest">Show Oldest Not Played</SelectItem>
                  <SelectItem value="lapsed">Show Recently Lapsed</SelectItem>
                  <SelectItem value="selected">Show Only Selected</SelectItem>
                </SelectContent>
              </Select>
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
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
              <ColumnsMenu user_id={tunes.user_id} table={table} />
            </div>
          </div>
          <TunesGrid
            table={table}
            userId={Number.parseInt(tunes.user_id)}
            playlistId={Number.parseInt(tunes.playlist_id)}
            purpose={tunes.table_purpose}
            globalFilter={globalFilter}
          />
        </>
      )}
    </div>
  );
}
