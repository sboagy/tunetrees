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
import { useState } from "react";

import type {
  RowSelectionState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import type { Tune } from "../types";

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

  const table = TunesTable(tunes, selectionChangedCallback);
  const [filter, setFilter] = useState("");
  const [preset, setPreset] = useState("");

  const handlePresetChange = (value: string) => {
    setPreset(value);
    // Implement preset logic here
  };

  const addToReviewQueue = () => {
    console.log("submitPracticeFeedbacksHandler!");

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
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-4 mb-4">
          <Button
            disabled={!isAddToReviewQueueEnabled}
            variant="outline"
            onClick={addToReviewQueue}
          >
            Add To Review Queue
          </Button>
          <Select value={preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Presets" />
            </SelectTrigger>
            <SelectContent>
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
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              if (tunes.handleFilterChange) {
                tunes.handleFilterChange(e);
              }
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
      />
    </div>
  );
}
