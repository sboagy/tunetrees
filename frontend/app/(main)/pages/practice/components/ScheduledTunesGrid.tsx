"use client";

import { Button } from "@/components/ui/button";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { useState } from "react";
import { submitPracticeFeedback } from "../commands";
import { getPracticeListScheduled } from "../queries";
import type { Tune } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type ScheduledTunesType, TunesTable } from "./TunesGrid";
import { deleteTableTransientData } from "../settings";

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
    table_purpose: "practice",
  });

  // const valuesArray = {};

  const submitPracticeFeedbackHandler = () => {
    console.log("handleClick!");

    for (let i = 0; i < scheduled.length; i++) {
      const tune = scheduled[i];
      const id: number = tune.id;
      const row = table.getRow(i.toString());

      const feedback: string = row.renderValue("recall_eval");

      if (feedback) {
        console.log("id, feedback", id, feedback);
        const results = submitPracticeFeedback({
          id,
          feedback,
          user_id,
          playlist_id,
        });
        console.log("results from submitPracticeFeedback: ", results);
        row.original.recall_eval = "";
        deleteTableTransientData(
          Number.parseInt(user_id),
          id,
          Number.parseInt(playlist_id),
          "practice",
        );
      }
      const getScheduled = async (user_id: string, playlist_id: string) => {
        const data: Tune[] = await getPracticeListScheduled(
          user_id,
          playlist_id,
        );
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

        <ColumnsMenu user_id={user_id} table={table} />
      </div>
      <TunesGrid
        table={table}
        userId={Number.parseInt(user_id)}
        playlistId={Number.parseInt(playlist_id)}
        purpose={"practice"}
      />
    </div>
  );
}
