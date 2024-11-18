"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload } from "lucide-react";
import { type JSX, useCallback, useEffect, useState } from "react";
import { type ITuneUpdate, submitPracticeFeedbacks } from "../commands";
import { getPracticeListScheduled } from "../queries";
import { deleteTableTransientData } from "../settings";
import type { Tune } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import FlashcardPanel from "./FlashcardPanel";
import NewTuneButton from "./NewTuneButton";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import TunesGrid from "./TunesGrid";
import { type IScheduledTunesType, TunesTable } from "./tunes-table";

type ReviewMode = "grid" | "flashcard";

type ScheduledTunesGridProps = {
  userId: number;
  playlistId: number;
  onEditTune: (tuneId: number) => void;
};

export default function ScheduledTunesGrid({
  userId,
  playlistId,
  onEditTune,
}: ScheduledTunesGridProps): JSX.Element {
  // const [scheduled, setScheduled] = useState<Tune[]>([]);
  const [tunes, setTunes] = useState<Tune[]>([]);
  const { refreshId, triggerRefresh } = useTuneDataRefresh();
  const [isClient, setIsClient] = useState(false);
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const hasNonEmptyRecallEval = tunes.some((tune) => tune.recall_eval);
    setIsSubmitEnabled(hasNonEmptyRecallEval);
  }, [tunes]);

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

  const handleRecallEvalChange = (tuneId: number, newValue: string): void => {
    setTunes((prevTunes) =>
      prevTunes.map((tune) =>
        tune.id === tuneId ? { ...tune, recall_eval: newValue } : tune,
      ),
    );
  };

  const tunesWithFilter: IScheduledTunesType = {
    tunes,
    userId,
    playlistId,
    tablePurpose: "practice",
    globalFilter: "",
    onRecallEvalChange: handleRecallEvalChange,
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

  const handleRowDoubleClick = (tuneId: number) => {
    onEditTune(tuneId);
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
            disabled={!isSubmitEnabled}
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
          {/* <Button
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
          </Button> */}
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
          onRowDoubleClick={handleRowDoubleClick}
          onRecallEvalChange={handleRecallEvalChange}
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
