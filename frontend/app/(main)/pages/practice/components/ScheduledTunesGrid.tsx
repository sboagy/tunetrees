"use client";

import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { ScheduledTunesType, TunesTable } from "./TunesGrid";
import { Button } from "@/components/ui/button";

export default function ScheduledTunesGrid({
  tunes,
}: ScheduledTunesType): JSX.Element {
  const table = TunesTable({ tunes });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        {/* <Input
          placeholder="Filter by type..."
          value={(table.getColumn("type")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("type")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        /> */}
        <div className="flex-row items-center">
          {/* <h1>Scheduled for practice:</h1> */}
          <Button type="submit" variant="outline">
            Submit Practiced Tunes
          </Button>
        </div>

        <ColumnsMenu table={table} />
      </div>
      <TunesGrid table={table} />
    </div>
  );
}
