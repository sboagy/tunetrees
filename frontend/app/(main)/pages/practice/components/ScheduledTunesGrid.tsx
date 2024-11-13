"use client";

import { Button } from "@/components/ui/button";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { useState, type JSX } from "react";
import { submitPracticeFeedbacks, type ITuneUpdate } from "../commands";
import type { Tune } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import TunesGrid, { type IScheduledTunesType, TunesTable } from "./TunesGrid";
import { deleteTableTransientData } from "../settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import FlashcardPanel from "./FlashcardPanel";
import NewTuneButton from "./NewTuneButton";
import { Upload } from "lucide-react";

type ReviewMode = "grid" | "flashcard";

export default function ScheduledTunesGrid({
  tunes,
  user_id,
  playlist_id,
  refreshData,
}: IScheduledTunesType): JSX.Element {
  const [scheduled, setScheduled] = useState<Tune[]>(tunes);
  const refreshDataCallback = refreshData;

  const table: TanstackTable<Tune> = TunesTable({
    tunes: scheduled,
    user_id,
    playlist_id,
    table_purpose: "practice",
    globalFilter: "",
    refreshData,
  });

  const submitPracticeFeedbacksHandler = (
    refreshData: () => Promise<{
      scheduledData: Tune[];
      repertoireData: Tune[];
    }>,
  ) => {
    console.log("submitPracticeFeedbacksHandler!");

    const updates: { [key: string]: ITuneUpdate } = {};

    for (const [i, tune] of scheduled.entries()) {
      const idString = `${tune.id}`;
      const row = table.getRow(i.toString());

      const feedback: string | null | undefined = row.original.recall_eval;

      if (feedback) {
        updates[idString] = { feedback: feedback };
      }
    }

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

    refreshData()
      .then((result) => {
        console.log("refreshData successful:", result);
        setScheduled(result.scheduledData);
      })
      .catch((error) => {
        console.error("Error invoking refreshData()", error);
        throw error;
      });
  };

  const [mode, setMode] = useState<ReviewMode>("grid");

  const handleModeChange = () => {
    setMode(mode === "grid" ? "flashcard" : "grid");
  };

  return (
    <div className="w-full h-full">
      <div
        id="tt-scheduled-tunes-header"
        className="flex items-center justify-between py-4"
      >
        <div className="flex-row items-center">
          <Button
            type="submit"
            variant="outline"
            onClick={() => submitPracticeFeedbacksHandler(refreshDataCallback)}
          >
            <Upload />
            {window.innerWidth < 768 ? "" : " Submit Practiced Tunes"}
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
            {"<"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={{ visibility: mode === "flashcard" ? "hidden" : "visible" }}
          >
            {">"}
          </Button>
          <div
            style={{ visibility: mode === "flashcard" ? "hidden" : "visible" }}
          >
            <ColumnsMenu user_id={user_id} table={table} />
          </div>
          <NewTuneButton
            user_id={user_id}
            playlist_id={playlist_id}
            refreshData={refreshData}
          />
        </div>
      </div>
      {mode === "grid" ? (
        <TunesGrid
          table={table}
          userId={Number.parseInt(user_id)}
          playlistId={Number.parseInt(playlist_id)}
          purpose={"practice"}
          refreshData={refreshData}
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
