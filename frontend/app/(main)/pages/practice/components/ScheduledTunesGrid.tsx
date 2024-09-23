"use client";

import { Button } from "@/components/ui/button";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { useState } from "react";
import { submitPracticeFeedbacks, type TuneUpdate } from "../commands";
import type { Tune } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type ScheduledTunesType, TunesTable } from "./TunesGrid";
import { deleteTableTransientData } from "../settings";
import { getPracticeListScheduled } from "../queries";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

  const submitPracticeFeedbacksHandler = () => {
    console.log("submitPracticeFeedbacksHandler!");

    const updates: { [key: string]: TuneUpdate } = {};

    for (let i = 0; i < scheduled.length; i++) {
      const tune = scheduled[i];
      const id_string = `${tune.id}`;
      const row = table.getRow(i.toString());

      const feedback: string = row.renderValue("recall_eval");

      if (feedback) {
        updates[id_string] = { feedback: feedback };
      }
    }

    // TODO: Put up a spinner while waiting for the response

    const promise_result = submitPracticeFeedbacks({
      playlist_id,
      updates,
    });
    promise_result
      .then((result) => {
        console.log("submitPracticeFeedbacks result:", result);
      })
      .catch((error) => {
        console.error("Error submit_practice_feedbacks_result:", error);
        throw error;
      });

    const promise_result2 = deleteTableTransientData(
      Number.parseInt(user_id),
      -1,
      Number.parseInt(playlist_id),
      "practice",
    );
    promise_result2
      .then((result) => {
        console.log("deleteTableTransientData successful:", result);
      })
      .catch((error) => {
        console.error("Error submitting feedbacks:", error);
        throw error;
      });

    const getScheduled = async (user_id: string, playlist_id: string) => {
      const data: Tune[] = await getPracticeListScheduled(user_id, playlist_id);
      setScheduled(data);
    };
    // For this one, we don't need to wait for the response
    getScheduled(user_id, playlist_id);
  };

  const [mode, setMode] = useState("grid");

  const handleModeChange = () => {
    setMode(mode === "grid" ? "flashcard" : "grid");
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between py-4">
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
            onClick={submitPracticeFeedbacksHandler}
          >
            Submit Practiced Tunes
          </Button>
        </div>
        <div className="flex items-center space-x-4">
          <Label htmlFor="flashcard-mode">Flashcard Mode</Label>
          <Switch
            checked={mode === "flashcard"}
            onCheckedChange={handleModeChange}
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
          <ColumnsMenu user_id={user_id} table={table} />
        </div>
      </div>
      {mode === "grid" ? (
        <TunesGrid
          table={table}
          userId={Number.parseInt(user_id)}
          playlistId={Number.parseInt(playlist_id)}
          purpose={"practice"}
        />
      ) : (
        <div />
      )}
    </div>
  );
}
