"use client";

import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { ScheduledTunesType, TunesTable } from "./TunesGrid";

export default function RepertoireGrid({
  tunes,
}: ScheduledTunesType): JSX.Element {
  const table = TunesTable({ tunes });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <ColumnsMenu table={table} />
      </div>
      <TunesGrid table={table} />
    </div>
  );
}
