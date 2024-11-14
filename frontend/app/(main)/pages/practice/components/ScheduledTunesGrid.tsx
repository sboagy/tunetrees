"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState, type JSX } from "react";
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
import { getPracticeListScheduled } from "../queries";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";

type ReviewMode = "grid" | "flashcard";

type ScheduledTunesGridProps = {
  userId: number;
  playlistId: number;
};

export default function ScheduledTunesGrid({
  userId,
  playlistId,
}: ScheduledTunesGridProps): JSX.Element {
  // const [scheduled, setScheduled] = useState<Tune[]>([]);
  const [tunes, setTunes] = useState<Tune[]>([]);
  const { refreshId, triggerRefresh } = useTuneDataRefresh();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const refreshTunes = useCallback((userId: number, playlistId: number) => {
    getPracticeListScheduled(userId, playlistId)
      .then((result: Tune[]) => {
        setTunes(result);
      })
      .catch((error) => {
        console.error("Error refreshing tunes:", error);
      });
  }, []);

  useEffect(() => {
    if (isClient) {
      console.log("ScheduledTunesGrid refreshId:", refreshId);
      refreshTunes(userId, playlistId);
    }
  }, [refreshId, userId, playlistId, refreshTunes, isClient]);

  const tunesWithFilter: IScheduledTunesType = {
    tunes,
    userId,
    playlistId,
    tablePurpose: "practice",
    globalFilter: "",
  };
  const table = TunesTable(tunesWithFilter);

  const submitPracticeFeedbacksHandler = () => {
    console.log("submitPracticeFeedbacksHandler!");

    const updates: { [key: string]: ITuneUpdate } = {};

    for (const [i, tune] of tunes.entries()) {
      const idString = `${tune.id}`;
      const row = table.getRow(i.toString());

      const feedback: string | null | undefined = row.original.recall_eval;

      if (feedback) {
        updates[idString] = { feedback: feedback };
      }
    }

    const promiseResult = submitPracticeFeedbacks({
      playlistId,
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
      userId,
      -1,
      playlistId,
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

    triggerRefresh();

    // refreshData()
    //   .then((result) => {
    //     console.log("refreshData successful:", result);
    //     setScheduled(result.scheduledData);
    //   })
    //   .catch((error) => {
    //     console.error("Error invoking refreshData()", error);
    //     throw error;
    //   });
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
            onClick={() => submitPracticeFeedbacksHandler()}
          >
            <Upload />
            {isClient &&
              (window.innerWidth < 768 ? "" : " Submit Practiced Tunes")}
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
            <ColumnsMenu user_id={userId} table={table} />
          </div>
          <NewTuneButton userId={userId} playlistId={playlistId} />
        </div>
      </div>
      {mode === "grid" ? (
        <TunesGrid
          table={table}
          userId={userId}
          playlistId={userId}
          tablePurpose={"practice"}
        />
      ) : (
        <FlashcardPanel
          table={table}
          userId={userId}
          playlistId={playlistId}
          purpose={"practice"}
        />
      )}
    </div>
  );
}
