"use client";

import { Button } from "@/components/ui/button";

import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { ScheduledTunesType, TunesTable } from "./TunesGrid";

export default function RepertoireGrid({
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
        <ColumnsMenu table={table} />
      </div>
      <TunesGrid table={table} />
    </div>
  );
}
