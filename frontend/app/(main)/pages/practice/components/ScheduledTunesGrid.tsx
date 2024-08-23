"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type ScheduledTunesType, TunesTable } from "./TunesGrid";
import { submitPracticeFeedback } from "../commands";
import type { Table as TanstackTable } from "@tanstack/react-table";
import type { Tune } from "../types";

export default function ScheduledTunesGrid({
  tunes,
}: ScheduledTunesType): JSX.Element {
  const table: TanstackTable<Tune> = TunesTable({ tunes });

  // const valuesArray = {};

  const handleClick = () => {
    console.log("handleClick!");

    for (let i = 0; i < tunes.length; i++) {
      const tune = tunes[i];
      const id: number = tune.id;
      const row = table.getRow(i.toString());

      const feedback: string = row.renderValue("recallEval");

      if (feedback) {
        console.log("id, feedback", id, feedback);
        const results = submitPracticeFeedback({ id, feedback });
        console.log("results from submitPracticeFeedback: ", results);
      }
      // router.reload()
    }
  };

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
          <Button type="submit" variant="outline" onClick={handleClick}>
            Submit Practiced Tunes
          </Button>
        </div>

        <ColumnsMenu table={table} />
      </div>
      <TunesGrid table={table} />
    </div>
  );
}
