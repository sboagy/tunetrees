"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RowSelectionState } from "@tanstack/react-table";
import { Upload } from "lucide-react";
import { type JSX, useCallback, useEffect, useState } from "react";
import { type ITuneUpdate, submitPracticeFeedbacks } from "../commands";
import { getScheduledTunesOverview } from "../queries";
import {
  deleteTableTransientData,
  updateCurrentTuneInDb,
  updateTableStateInDb,
} from "../settings";
import type { ITuneOverview } from "../types";
import ColumnsMenu from "./ColumnsMenu";
import { usePlaylist } from "./CurrentPlaylistProvider";
import { useTune } from "./CurrentTuneContext";
import FlashcardPanel from "./FlashcardPanel";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useScheduledTunes } from "./TunesContextScheduled";
import TunesGrid from "./TunesGrid";
import { useTunesTable } from "./TunesTable";
import { useToast } from "@/hooks/use-toast";
import { getSitdownDateFromBrowser } from "./SitdownDateProvider";

type ReviewMode = "grid" | "flashcard";

type ScheduledTunesGridProps = {
  userId: number;
};

export default function TunesGridScheduled({
  userId,
}: ScheduledTunesGridProps): JSX.Element {
  // Local refreshId for client-side refresh logic
  const [refreshId, setRefreshId] = useState(0);
  const { toast } = useToast();

  const handleError = useCallback(
    (message: string) => {
      toast({
        title: "Error",
        description: message,
      });
    },
    [toast],
  );

  const { tunes, setTunes } = useScheduledTunes();
  const { triggerRefresh } = useTuneDataRefresh();
  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const { currentPlaylist: playlistId } = usePlaylist();
  const showDeleted = false; // Should become a state variable at some point
  const { currentTune, setCurrentTune } = useTune();

  console.log(
    `LF1 render ScheduledTunesGrid: playlistId=${playlistId}, userId=${userId}`,
  );

  // useEffect(() => {
  //   console.log(
  //     `LF6 ScheduledTunesGrid (useEffect[currentTune, userId]) calling updateCurrentTuneInDb, currentTune=${currentTune}`,
  //   );
  //   void updateCurrentTuneInDb(userId, "full", "practice", currentTune);
  // }, [currentTune, userId]);

  useEffect(() => {
    console.log("useEffect ===> TunesGridScheduled.tsx:52 ~ tunes");
    const hasNonEmptyRecallEval = tunes.some((tune) => tune.recall_eval);
    setIsSubmitEnabled(hasNonEmptyRecallEval);
    // setIsLoading(false);
  }, [tunes]);

  // Only fetch scheduled tunes on the client after mount or refresh
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    let cancelled = false;
    async function fetchTunes() {
      setIsLoading(true);
      try {
        const sitdownDate = getSitdownDateFromBrowser();

        const result = await getScheduledTunesOverview(
          userId,
          playlistId,
          sitdownDate,
          showDeleted,
        );
        if (!cancelled) {
          setTunes(result);
        }
      } catch {
        if (!cancelled) {
          setTunes([]); // or handle error
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void fetchTunes();
    return () => {
      cancelled = true;
    };
  }, [userId, playlistId, refreshId, setTunes]);

  const handleRecallEvalChange = useCallback(
    (tuneId: number, newValue: string): void => {
      setTunes((prevTunes: ITuneOverview[]) =>
        prevTunes.map(
          (tune): ITuneOverview =>
            tune.id === tuneId ? { ...tune, recall_eval: newValue } : tune,
        ),
      );
    },
    [setTunes],
  );

  const [isLoading, setIsLoading] = useState(true);

  // See comment for isRefreshing in RepertoireTunesGrid.tsx.
  // (not used in this component)

  // Only fetch scheduled tunes on the client after mount or refresh
  useEffect(() => {
    let cancelled = false;
    async function fetchTunes() {
      setIsLoading(true);
      try {
        const sitdownDate = getSitdownDateFromBrowser();

        const result = await getScheduledTunesOverview(
          userId,
          playlistId,
          sitdownDate,
          showDeleted,
        );
        if (!cancelled) {
          setTunes(result);
        }
      } catch {
        if (!cancelled) {
          setTunes([]); // or handle error
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void fetchTunes();
    return () => {
      cancelled = true;
    };
  }, [userId, playlistId, setTunes]);

  // Move table creation after tunes are loaded
  const [tableComponent, table] = useTunesTable({
    tunes,
    userId,
    tablePurpose: "practice",
    globalFilter: "",
    onRecallEvalChange: handleRecallEvalChange,
    setIsLoading,
  });

  const submitPracticeFeedbacksHandler = () => {
    if (table === null) {
      return;
    }
    console.log("submitPracticeFeedbacksHandler!");

    const updates: { [key: string]: ITuneUpdate } = {};

    for (const [, tune] of tunes.entries()) {
      const idString = `${tune.id}`;
      const row = table.getRow(idString);

      const feedback: string | null | undefined = row.original.recall_eval;

      if (feedback) {
        updates[idString] = { feedback: feedback };
      } else {
        continue;
      }
      if (tune.id === currentTune) {
        console.log(`LF6 setting current tune to null: ${currentTune}`);
        setCurrentTune(null);
        void updateCurrentTuneInDb(
          userId,
          "full",
          "practice",
          playlistId,
          null,
        );
      }
    }

    const sitdownDate = getSitdownDateFromBrowser();
    const promiseResult = submitPracticeFeedbacks({
      playlistId,
      updates,
      sitdownDate,
    });
    promiseResult
      .then((result) => {
        console.log("submitPracticeFeedbacks result:", result);
      })
      .catch((error) => {
        handleError(
          "Error submit_practice_feedbacks_result. Please try again.",
        );
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
        handleError("Error deleting table transient data. Please try again.");
        console.error("Error submitting feedbacks:", error);
        throw error;
      });

    // Increment local refreshId to trigger reload
    setRefreshId((id) => id + 1);

    toast({
      title: "Success",
      description: "Practice successfully submitted",
    });

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

  const onRowClickCallback = (newTune: number): void => {
    if (table !== null) {
      console.log(
        `===> TunesGrid.tsx:100 ~ rowSelection, changing from: ${JSON.stringify(table.getState().rowSelection)}`,
      );
      const rowSelectionState: RowSelectionState = {
        [String(newTune)]: true, // use a Computed Property Name, horrible ECMAScript 2015 (ES6) syntax!
      };
      table.setRowSelection(rowSelectionState);
      const tableState = table.getState();
      tableState.rowSelection = rowSelectionState;
      console.log(
        `===> TunesGrid.tsx:113 ~ rowSelection, changing to: ${JSON.stringify(tableState.rowSelection)}`,
      );
      void updateTableStateInDb(
        userId,
        "full",
        "practice",
        playlistId,
        tableState,
      );
    }
  };

  // Update loading condition to only show loading when we're actually loading
  return (
    <div className="w-full h-full">
      {tableComponent}
      {isLoading || !table || playlistId <= 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          {playlistId <= 0 ? (
            <p className="text-lg">No Playlist</p>
          ) : (
            <p className="text-lg">Loading...</p>
          )}
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
                <ColumnsMenu
                  user_id={userId}
                  tablePurpose={"practice"}
                  playlistId={playlistId}
                  table={table}
                  triggerRefresh={triggerRefresh}
                />
              </div>
              {/* <NewTuneButton userId={userId} playlistId={playlistId} /> */}
            </div>
          </div>
          {mode === "grid" ? (
            <TunesGrid
              table={table}
              userId={userId}
              playlistId={userId}
              tablePurpose={"practice"}
              onRowClickCallback={onRowClickCallback}
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
