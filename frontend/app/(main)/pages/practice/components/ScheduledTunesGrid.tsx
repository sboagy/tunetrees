"use client";

import { Button } from "@/components/ui/button";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { useState } from "react";
import { submitPracticeFeedbacks, type ITuneUpdate } from "../commands";
import type { Tune } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type IScheduledTunesType, TunesTable } from "./TunesGrid";
import { deleteTableTransientData } from "../settings";
import { getPracticeListScheduled } from "../queries";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import FlashcardPanel from "./FlashcardPanel";

type ReviewMode = "grid" | "flashcard";

export default function ScheduledTunesGrid({
  tunes,
  user_id,
  playlist_id,
}: IScheduledTunesType): JSX.Element {
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

    const updates: { [key: string]: ITuneUpdate } = {};

    for (let i = 0; i < scheduled.length; i++) {
      const tune = scheduled[i];
      const idString = `${tune.id}`;
      const row = table.getRow(i.toString());

      const feedback: string = row.renderValue("recall_eval");

      if (feedback) {
        updates[idString] = { feedback: feedback };
      }
    }

    // TODO: Put up a spinner while waiting for the response

    const promiseResult = submitPracticeFeedbacks({
      playlist_id,
      updates,
    });
    promiseResult
      .then((result) => {
        console.log("submitPracticeFeedbacks result:", result);
      })
      .catch((error) => {
        console.error("Error submit_practice_feedbacks_result:", error);
        throw error;
      });

    const promiseResult2 = deleteTableTransientData(
      Number.parseInt(user_id),
      -1,
      Number.parseInt(playlist_id),
      "practice",
    );
    promiseResult2
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

  const [mode, setMode] = useState<ReviewMode>("grid");

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
            style={{ visibility: mode === "flashcard" ? "hidden" : "visible" }}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={{ visibility: mode === "flashcard" ? "hidden" : "visible" }}
          >
            Next
          </Button>
          <div
            style={{ visibility: mode === "flashcard" ? "hidden" : "visible" }}
          >
            <ColumnsMenu user_id={user_id} table={table} />
          </div>
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
        <FlashcardPanel
          table={table}
          userId={Number.parseInt(user_id)}
          playlistId={Number.parseInt(playlist_id)}
          purpose={"practice"}
        />
      )}
    </div>
  );
}
