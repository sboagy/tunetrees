"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type ScheduledTunesType, TunesTable } from "./TunesGrid";
import { submitPracticeFeedback } from "../commands";
import type { Table as TanstackTable } from "@tanstack/react-table";
import type { Tune } from "../types";
import { useState } from "react";
import { getPracticeListScheduled } from "../queries";

export default function ScheduledTunesGrid({
  tunes,
  user_id,
  playlist_id,
}: ScheduledTunesType): JSX.Element {
  const [scheduled, setScheduled] = useState<Tune[]>(tunes);

  const table: TanstackTable<Tune> = TunesTable({
    tunes: scheduled,
    user_id,
    playlist_id,
  });

  // const valuesArray = {};

  const submitPracticeFeedbackHandler = () => {
    console.log("handleClick!");

    for (let i = 0; i < scheduled.length; i++) {
      const tune = scheduled[i];
      const id: number = tune.id;
      const row = table.getRow(i.toString());

      const feedback: string = row.renderValue("recallEval");

      if (feedback) {
        console.log("id, feedback", id, feedback);
        const results = submitPracticeFeedback({
          id,
          feedback,
          user_id,
          playlist_id,
        });
        console.log("results from submitPracticeFeedback: ", results);
        row.original.recallEval = "";
      }
      const getScheduled = async (user_id: string, playlist_id: string) => {
        const data = await getPracticeListScheduled(user_id, playlist_id);
        setScheduled(data);
      };
      getScheduled(user_id, playlist_id);
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
          <Button
            type="submit"
            variant="outline"
            onClick={submitPracticeFeedbackHandler}
          >
            Submit Practiced Tunes
          </Button>
        </div>

        <ColumnsMenu table={table} />
      </div>
      <TunesGrid table={table} />
    </div>
  );
}
