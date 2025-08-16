"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RowSelectionState } from "@tanstack/react-table";
import { Upload } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { type ITuneUpdate, submitPracticeFeedbacks } from "../commands";
import { getScheduledTunesOverviewAction } from "../actions/practice-actions";
import {
  deleteTableTransientData,
  updateCurrentTuneInDb,
  updateTableStateInDb,
} from "../settings";
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

interface IScheduledTunesGridProps {
  userId: number;
}

export default function TunesGridScheduled({
  userId,
}: IScheduledTunesGridProps): JSX.Element {
  const { toast } = useToast();
  const { tunes, setTunes, setTunesRefreshId } = useScheduledTunes();
  const { triggerRefresh, refreshId } = useTuneDataRefresh();
  const { currentPlaylist: playlistId } = usePlaylist();
  const { currentTune, setCurrentTune } = useTune();
  // bucket now provided directly by scheduled overview endpoint

  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const showDeleted = false;
  const [mode, setMode] = useState<ReviewMode>("grid");

  const handleError = useCallback(
    (message: string) => {
      toast({ title: "Error", description: message });
    },
    [toast],
  );

  useEffect(() => {
    const hasNonEmptyRecallEval = tunes.some((t) => t.recall_eval);
    setIsSubmitEnabled(hasNonEmptyRecallEval);
  }, [tunes]);

  const lastFetchedRefreshId = useRef<number | null>(null);
  const lastFetchedPlaylistId = useRef<number | null>(null);
  const inFlight = useRef(false);
  const fetchSeq = useRef(0);
  useEffect(() => {
    if (playlistId <= 0) return;
    // Skip if we've already fetched for this (playlistId, refreshId) combo
    if (
      lastFetchedPlaylistId.current === playlistId &&
      lastFetchedRefreshId.current === refreshId
    ) {
      return;
    }
    if (inFlight.current) return; // avoid overlapping requests
    async function fetchData() {
      inFlight.current = true;
      const seq = ++fetchSeq.current;
      setIsLoading(true);
      try {
        const sitdownDate = getSitdownDateFromBrowser();
        console.log(
          "[ScheduledFetch] starting fetch",
          JSON.stringify({
            playlistId,
            refreshId,
            lastFetchedRefreshId: lastFetchedRefreshId.current,
            lastFetchedPlaylistId: lastFetchedPlaylistId.current,
            tunesLength: tunes.length,
            sitdownDate: sitdownDate.toISOString(),
            seq,
          }),
        );
        const overview = await getScheduledTunesOverviewAction(
          userId,
          playlistId,
          sitdownDate ? new Date(sitdownDate) : null,
          showDeleted,
        );
        setTunes(overview);
        // Immediate diagnostic after state update enqueue
        console.log(
          "[ScheduledFetch][PostSet] setTunes called with length=",
          overview.length,
        );
        // Microtask check for state visibility
        queueMicrotask(() => {
          try {
            interface IDebugWin extends Window {
              __ttScheduledTunes?: unknown[];
            }
            const w = window as unknown as IDebugWin;
            console.log(
              "[ScheduledFetch][Microtask] tunes length now=",
              w.__ttScheduledTunes?.length,
            );
          } catch {
            /* ignore */
          }
        });
        setTunesRefreshId(refreshId);
        lastFetchedRefreshId.current = refreshId;
        lastFetchedPlaylistId.current = playlistId;
        const sample = overview.slice(0, 3).map((t) => ({
          id: t.id,
          bucket: (t as unknown as { bucket?: number | null }).bucket ?? null,
        }));
        console.log(
          "[ScheduledFetch] fetched tunes",
          JSON.stringify({ length: overview.length, seq, sample }),
        );
        try {
          interface IDebugWin2 extends Window {
            __ttScheduledTunes?: typeof overview;
            dumpScheduledTunes?: () => void;
          }
          const w = window as unknown as IDebugWin2;
          w.__ttScheduledTunes = overview;
          w.dumpScheduledTunes = () => {
            console.log("[ScheduledFetch][Dump]", overview.length, overview);
          };
        } catch {
          /* ignore */
        }
      } catch (error) {
        console.error(
          "[ScheduledFetch] error (preserving previous tunes):",
          error,
        );
        handleError("Failed to load scheduled tunes.");
      } finally {
        setIsLoading(false);
        console.log(
          "[ScheduledFetch] finished",
          JSON.stringify({ seq, tunesLengthAfter: tunes.length }),
        );
        inFlight.current = false;
      }
    }
    void fetchData();
    return () => {
      const seqAtUnmount = fetchSeq.current;
      console.log(
        "[ScheduledFetch] effect cleanup (unmount or deps change)",
        JSON.stringify({ seqAtUnmount }),
      );
    };
  }, [
    playlistId,
    refreshId,
    userId,
    setTunes,
    setTunesRefreshId,
    handleError,
    tunes.length,
  ]);

  // Instrumentation: log whenever tunes array changes length
  useEffect(() => {
    console.log(
      "[ScheduledGrid][Render] tunes length=",
      tunes.length,
      "ids sample=",
      tunes.slice(0, 5).map((t) => t.id),
    );
  }, [tunes, tunes.length]);

  const handleRecallEvalChange = useCallback(
    (tuneId: number, newValue: string): void => {
      setTunes((prev) =>
        prev.map((t) =>
          t.id === tuneId ? { ...t, recall_eval: newValue } : t,
        ),
      );
    },
    [setTunes],
  );

  const handleGoalChange = useCallback(
    (tuneId: number, newValue: string | null): void => {
      setTunes((prev) =>
        prev.map((t) => (t.id === tuneId ? { ...t, goal: newValue } : t)),
      );
    },
    [setTunes],
  );

  const [tableComponent, table] = useTunesTable({
    tunes,
    userId,
    tablePurpose: "practice",
    globalFilter: "",
    onRecallEvalChange: handleRecallEvalChange,
    onGoalChange: handleGoalChange,
    setIsLoading,
    setTunesRefreshId,
  });

  const getStyleForSchedulingState = useCallback(
    (_scheduledDate: string | null, tuneId?: number): string => {
      if (!tuneId) return "";
      const tune = tunes.find((t) => t.id === tuneId) as
        | { bucket?: number | null }
        | undefined;
      const b = tune?.bucket ?? null;
      if (b === 1) return "font-extrabold";
      if (b === 2) return "underline text-amber-300";
      if (b === 3) return "underline text-gray-300";
      return "";
    },
    [tunes],
  );

  const submitPracticeFeedbacksHandler = () => {
    if (!table) return;
    const updates: Record<string, ITuneUpdate> = {};
    for (const tune of tunes) {
      if (!tune.id) continue;
      const row = table.getRow(String(tune.id));
      if (!row) continue;
      const feedback = row.original.recall_eval;
      if (feedback) {
        updates[String(tune.id)] = { feedback, goal: tune.goal || null };
        if (tune.id === currentTune) {
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
    }
    const sitdownDate = getSitdownDateFromBrowser();
    submitPracticeFeedbacks({ playlistId, updates, sitdownDate })
      .then(() => {
        triggerRefresh();
        toast({
          title: "Success",
          description: "Practice successfully submitted",
        });
      })
      .catch((error) => {
        handleError(
          "Error submit_practice_feedbacks_result. Please try again.",
        );
        console.error(error);
      });
    deleteTableTransientData(userId, -1, playlistId, "practice").catch(
      (error) => {
        handleError("Error deleting table transient data. Please try again.");
        console.error(error);
      },
    );
  };

  const handleModeChange = () =>
    setMode((m) => (m === "grid" ? "flashcard" : "grid"));

  const onRowClickCallback = (newTune: number): void => {
    if (!table) return;
    const rowSelectionState: RowSelectionState = { [String(newTune)]: true };
    table.setRowSelection(rowSelectionState);
    const tableState = table.getState();
    tableState.rowSelection = rowSelectionState;
    void updateTableStateInDb(
      userId,
      "full",
      "practice",
      playlistId,
      tableState,
    );
  };

  return (
    <div className="w-full h-full">
      {(() => {
        try {
          console.log(
            "[ScheduledGrid][RenderDecision] playlistId=%d isLoading=%s hasTable=%s tunesLength=%d refreshId=%s lastFetchedPlaylistId=%s lastFetchedRefreshId=%s",
            playlistId,
            isLoading,
            Boolean(table),
            tunes.length,
            refreshId,
            lastFetchedPlaylistId.current,
            lastFetchedRefreshId.current,
          );
          if (tunes.length > 0) {
            const firstBucket = (
              tunes[0] as unknown as { bucket?: number | null }
            ).bucket;
            console.log(
              "[ScheduledGrid][FirstTune]",
              JSON.stringify({ id: tunes[0].id, bucket: firstBucket ?? null }),
            );
          }
        } catch {
          /* ignore */
        }
        return null; // satisfy ReactNode requirement
      })()}
      {tableComponent}
      {playlistId <= 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg">No Playlist</p>
        </div>
      ) : isLoading || !table ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg">Loading...</p>
        </div>
      ) : tunes.length === 0 ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <p className="text-lg font-semibold">No scheduled tunes</p>
          <p className="text-sm text-muted-foreground">
            Add tunes or submit practice to generate scheduling.
          </p>
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
                onClick={submitPracticeFeedbacksHandler}
                disabled={!isSubmitEnabled}
                title="Submit your practiced tunes"
              >
                <Upload />
                {typeof window !== "undefined" && window.innerWidth < 768
                  ? ""
                  : " Submit Practiced Tunes"}
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
            </div>
          </div>
          {mode === "grid" ? (
            <TunesGrid
              table={table}
              userId={userId}
              playlistId={playlistId}
              tablePurpose={"practice"}
              getStyleForSchedulingState={getStyleForSchedulingState}
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
