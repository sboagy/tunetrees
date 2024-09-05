"use client";

import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type ScheduledTunesType, TunesTable } from "./TunesGrid";

export default function RepertoireGrid(tunes: ScheduledTunesType): JSX.Element {
  const table = TunesTable(tunes);

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <ColumnsMenu user_id={tunes.user_id} table={table} />
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
