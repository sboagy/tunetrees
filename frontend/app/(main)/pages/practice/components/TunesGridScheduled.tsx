"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { type ITuneUpdate, submitPracticeFeedbacks } from "../commands";
import { getPracticeListScheduled } from "../queries";
import { deleteTableTransientData } from "../settings";
import type { Tune } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import { usePlaylist } from "./CurrentPlaylistProvider";
import FlashcardPanel from "./FlashcardPanel";
import NewTuneButton from "./NewTuneButton";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useScheduledTunes } from "./TunesContextScheduled";
import TunesGrid from "./TunesGrid";
import { useTunesTable } from "./TunesTable";

type ReviewMode = "grid" | "flashcard";

type ScheduledTunesGridProps = {
  userId: number;
};

export default function TunesGridScheduled({
  userId,
}: ScheduledTunesGridProps): JSX.Element {
  const { tunes, setTunes, tunesRefreshId, setTunesRefreshId } =
    useScheduledTunes();
  const { refreshId, triggerRefresh } = useTuneDataRefresh();
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { currentPlaylist: playlistId } = usePlaylist();

  console.log(
    `LF1 render ScheduledTunesGrid: playlistId=${playlistId}, userId=${userId}`,
  );

  useEffect(() => {
    const hasNonEmptyRecallEval = tunes.some((tune) => tune.recall_eval);
    setIsSubmitEnabled(hasNonEmptyRecallEval);
  }, [tunes]);

  const handleRecallEvalChange = useCallback(
    (tuneId: number, newValue: string): void => {
      setTunes((prevTunes) =>
        prevTunes.map((tune) =>
          tune.id === tuneId ? { ...tune, recall_eval: newValue } : tune,
        ),
      );
    },
    [setTunes],
  );

  // See comment for isRefreshing in RepertoireTunesGrid.tsx.
  const isRefreshing = useRef(false);

  const refreshTunes = useCallback(
    async (userId: number, playlistId: number, refreshId: number) => {
      try {
        const result: Tune[] = await getPracticeListScheduled(
          userId,
          playlistId,
        );
        setTunesRefreshId(refreshId);
        setTunes(result);

        return result;
      } catch (error) {
        console.error("LF1 ScheduledTunesGrid Error refreshing tunes:", error);
        throw error;
      }
    },
    [setTunes, setTunesRefreshId],
  );

  useEffect(() => {
    if (tunesRefreshId !== refreshId && !isRefreshing.current) {
      console.log(
        `LF1 ScheduledTunesGrid call refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
      isRefreshing.current = true;
      setIsLoading(true);
      refreshTunes(userId, playlistId, refreshId)
        .then((result: Tune[]) => {
          console.log(`LF1 ScheduledTunesGrid number tunes: ${result.length}`);
          console.log(
            `LF1 ScheduledTunesGrid back from refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
          );
        })
        .catch((error) => {
          isRefreshing.current = false;
          console.error(
            "LF1 ScheduledTunesGrid Error invoking refreshTunes:",
            error,
          );
        })
        .finally(() => {
          isRefreshing.current = false;
          setIsLoading(false);
        });
    } else {
      console.log(
        `LF1 ScheduledTunesGrid skipping refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
    }
  }, [refreshId, tunesRefreshId, userId, playlistId, refreshTunes]);

  // Move table creation after tunes are loaded
  const [tableComponent, table] = useTunesTable({
    tunes,
    userId,
    tablePurpose: "practice",
    globalFilter: "",
    onRecallEvalChange: handleRecallEvalChange,
  });

  const submitPracticeFeedbacksHandler = () => {
    if (table === null) {
      return;
    }
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

  // Update loading condition to only show loading when we're actually loading
  return (
    <div className="w-full h-full">
      {tableComponent}
      {isLoading || !table ? (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-lg">Loading tunes...</div>
        </div>
      ) : (
        <>
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
                title="Submit your practiced tunes"
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
              <div
                style={{
                  visibility: mode === "flashcard" ? "hidden" : "visible",
                }}
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
              onRecallEvalChange={handleRecallEvalChange}
            />
          )}
        </>
      )}
    </div>
  );
}