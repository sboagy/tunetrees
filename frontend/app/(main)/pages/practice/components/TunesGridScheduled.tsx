"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RowSelectionState } from "@tanstack/react-table";
import { Upload } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { type ITuneUpdate, submitPracticeFeedbacks } from "../commands";
import {
  getPracticeQueueAction,
  refillPracticeQueueAction,
} from "../actions/practice-actions";
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

// Type-only interface reflecting backend-enriched practice queue entry shape we consume.
// This does NOT introduce new columns; it mirrors existing fields we already map.
interface IPracticeQueueRowInternal {
  id: number;
  title: string | null; // backend tune_title (may be null)
  name: string | null; // legacy alias used elsewhere in table code
  type?: string | null;
  structure?: string | null;
  learned?: string | null;
  scheduled?: string | null;
  latest_practiced?: string | null;
  latest_review_date?: string | null;
  bucket: number | null;
  recall_eval: string | null; // user-entered during session (not from backend snapshot)
  goal: string | null; // user-entered (session-only for now)
  latest_quality: number | null;
  latest_easiness: number | null;
  latest_interval: number | null;
  latest_goal?: string | null;
  latest_repetitions?: number | null;
  latest_technique?: string | null;
  latest_due_date?: string | null; // reserved
  next_review_date?: string | null; // reserved
  practice_state?: string | null; // reserved
  playlist_deleted: boolean;
}

export default function TunesGridScheduled({
  userId,
}: IScheduledTunesGridProps): JSX.Element {
  const { toast } = useToast();
  const { tunes, setTunes, setTunesRefreshId } = useScheduledTunes();
  const { triggerRefresh, refreshId } = useTuneDataRefresh();
  const { currentPlaylist: playlistId } = usePlaylist();
  const { currentTune, setCurrentTune } = useTune();
  // bucket now provided by practice queue snapshot entries (mapped into tunes state)

  const [isSubmitEnabled, setIsSubmitEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [mode, setMode] = useState<ReviewMode>("grid");
  // Track IDs of tunes that received an evaluation this session (for potential future toggles)
  // Track of evaluated tune ids (reserved for future UI toggles). Currently unused directly in render.
  const [, setCompletedTuneIds] = useState<Set<number>>(new Set());
  // hasPending removed: we now permit backlog only when queue empty (button shown only then)
  const defaultMaxReviews = 10; // mirrors backend default when prefs not fetched client-side

  const handleError = useCallback(
    (message: string) => {
      toast({ title: "Error", description: message });
    },
    [toast],
  );

  useEffect(() => {
    const anyEvaluated = tunes.some((t) => t.recall_eval);
    setIsSubmitEnabled(anyEvaluated);
  }, [tunes]);

  const lastFetchedRefreshId = useRef<number | null>(null);
  const lastFetchedPlaylistId = useRef<number | null>(null);
  const inFlight = useRef(false);
  const fetchSeq = useRef(0);
  useEffect(() => {
    if (playlistId <= 0) return;
    if (
      lastFetchedPlaylistId.current === playlistId &&
      lastFetchedRefreshId.current === refreshId
    ) {
      return; // snapshot already loaded for this refresh cycle
    }
    if (inFlight.current) return;
    async function fetchSnapshot() {
      inFlight.current = true;
      ++fetchSeq.current;
      setIsLoading(true);
      try {
        const sitdownDate = getSitdownDateFromBrowser();
        const raw = await getPracticeQueueAction(
          userId,
          playlistId,
          new Date(sitdownDate),
          false,
        );
        // Backend currently returns a list (array) of rows (response_model=list[DailyPracticeQueueModel])
        // but types for action assume an object with entries. Normalize here defensively.
        type RawEntry = {
          tune_ref: number;
          tune_title?: string | null;
          bucket?: number | null;
          type?: string | null;
          structure?: string | null;
          learned?: string | null;
          scheduled?: string | null;
          latest_practiced?: string | null;
          latest_review_date?: string | null;
          latest_quality?: number | null;
          latest_easiness?: number | null;
          latest_interval?: number | null;
          latest_goal?: string | null;
          latest_repetitions?: number | null;
          latest_technique?: string | null;
        };
        function isRawEntryArray(arr: unknown[]): arr is RawEntry[] {
          return arr.every(
            (o) =>
              !!o && typeof (o as { tune_ref?: unknown }).tune_ref === "number",
          );
        }
        let snapshotEntriesUnknown: unknown[] = [];
        if (Array.isArray(raw)) snapshotEntriesUnknown = raw;
        else if (
          raw &&
          typeof raw === "object" &&
          Array.isArray((raw as { entries?: unknown[] }).entries)
        )
          snapshotEntriesUnknown = (raw as { entries: unknown[] }).entries;
        const snapshotEntries: RawEntry[] = isRawEntryArray(
          snapshotEntriesUnknown,
        )
          ? snapshotEntriesUnknown
          : [];
        // Exclude tunes already marked completed server-side so they don't reappear after tab switches
        const mapped: IPracticeQueueRowInternal[] = snapshotEntries
          .filter((e) => {
            const ce = e as unknown as { completed_at?: string | null };
            return !ce.completed_at;
          })
          .map((e) => ({
            id: e.tune_ref,
            title: e.tune_title || null,
            name: e.tune_title || null,
            type: e.type ?? null,
            structure: e.structure ?? null,
            learned: e.learned ?? null,
            scheduled: e.scheduled ?? null,
            latest_practiced: e.latest_practiced ?? null,
            latest_review_date: e.latest_review_date ?? null,
            bucket: (e.bucket as number | null) ?? null,
            // Preserve any staged recall evaluation coming from backend enrichment (transient table)
            // If backend omitted field, default to null to maintain existing behaviour.
            recall_eval:
              (e as unknown as { recall_eval?: string | null }).recall_eval ??
              null,
            goal: null,
            latest_quality: e.latest_quality ?? null,
            latest_easiness: e.latest_easiness ?? null,
            latest_interval: e.latest_interval ?? null,
            latest_goal: e.latest_goal ?? null,
            latest_repetitions: e.latest_repetitions ?? null,
            latest_technique: e.latest_technique ?? null,
            latest_due_date: null,
            next_review_date: null,
            practice_state: null,
            playlist_deleted: false,
          }));
        setTunes(mapped as unknown as never);
        setTunesRefreshId(refreshId);
        lastFetchedRefreshId.current = refreshId;
        lastFetchedPlaylistId.current = playlistId;
      } catch (error) {
        console.error("[PracticeQueueFetch] error", error);
        handleError("Failed to load practice queue.");
      } finally {
        setIsLoading(false);
        inFlight.current = false;
      }
    }
    void fetchSnapshot();
  }, [playlistId, refreshId, userId, setTunes, setTunesRefreshId, handleError]);

  // (Optional) could add lightweight debug here; removed verbose scheduled logs.

  const handleRecallEvalChange = useCallback(
    (tuneId: number, newValue: string): void => {
      setTunes((prev) =>
        prev.map((t) =>
          t.id === tuneId ? { ...t, recall_eval: newValue } : t,
        ),
      );
      if (newValue) {
        setCompletedTuneIds((prev) => new Set(prev).add(tuneId));
      } else {
        // If user clears evaluation (possible with UI changes) remove from completed set
        setCompletedTuneIds((prev) => {
          const next = new Set(prev);
          next.delete(tuneId);
          return next;
        });
      }
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
        // Remove only tunes that were actually submitted (had a recall_eval); keep others in the grid.
        // Remove only tunes that were practiced (present in updates) keeping others intact
        const practicedIds = new Set(
          Object.keys(updates).map((k) => Number(k)),
        );
        setTunes((prev) =>
          prev.filter((t) =>
            t.id !== null && t.id !== undefined
              ? !practicedIds.has(t.id)
              : true,
          ),
        );
        setCompletedTuneIds((prev) => {
          const next = new Set(prev);
          for (const id of practicedIds) {
            next.delete(id);
          }
          return next;
        });
        toast({
          title: "Success",
          description: "Submitted evaluated tunes.",
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
      {/* Diagnostic render log removed for snapshot-based grid */}
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
            Add tunes from backlog.
          </p>
          <Button
            variant="outline"
            disabled={
              playlistId <= 0 ||
              isRefilling ||
              tunes.length >= defaultMaxReviews
            }
            data-testid="practice-queue-refill"
            onClick={() => {
              const sitdownDate = getSitdownDateFromBrowser();
              setIsRefilling(true);
              refillPracticeQueueAction(
                userId,
                playlistId,
                new Date(sitdownDate),
                5,
              )
                .then((newRows) => {
                  if (newRows.length === 0) {
                    toast({
                      title: "No backlog tunes",
                      description: "There are no additional tunes to backfill.",
                    });
                  } else {
                    setTunes((prev) => {
                      return [
                        ...prev,
                        ...newRows
                          .filter((e) => {
                            const ce = e as unknown as {
                              completed_at?: string | null;
                            };
                            return !ce.completed_at;
                          })
                          .map((e) => {
                            const enriched = e as unknown as {
                              tune_ref: number;
                              tune_title?: string | null;
                              type?: string | null;
                              structure?: string | null;
                              learned?: string | null;
                              scheduled?: string | null;
                              latest_practiced?: string | null;
                              latest_review_date?: string | null;
                              latest_quality?: number | null;
                              latest_easiness?: number | null;
                              latest_interval?: number | null;
                              latest_goal?: string | null;
                              latest_repetitions?: number | null;
                              latest_technique?: string | null;
                              bucket?: number | null;
                            };
                            const row: IPracticeQueueRowInternal = {
                              id: enriched.tune_ref,
                              title: enriched.tune_title || null,
                              name: enriched.tune_title || null,
                              type: enriched.type ?? null,
                              structure: enriched.structure ?? null,
                              learned: enriched.learned ?? null,
                              scheduled: enriched.scheduled ?? null,
                              latest_practiced:
                                enriched.latest_practiced ?? null,
                              latest_review_date:
                                enriched.latest_review_date ?? null,
                              bucket:
                                (enriched.bucket as number | null) ?? null,
                              recall_eval: null,
                              goal: null,
                              latest_quality: enriched.latest_quality ?? null,
                              latest_easiness: enriched.latest_easiness ?? null,
                              latest_interval: enriched.latest_interval ?? null,
                              latest_goal: enriched.latest_goal ?? null,
                              latest_repetitions:
                                enriched.latest_repetitions ?? null,
                              latest_technique:
                                enriched.latest_technique ?? null,
                              latest_due_date: null,
                              next_review_date: null,
                              practice_state: null,
                              playlist_deleted: false,
                            };
                            return row;
                          }),
                      ] as unknown as never;
                    });
                    toast({
                      title: "Backlog refilled",
                      description: `${newRows.length} tune(s) added from backlog`,
                    });
                  }
                })
                .catch((error) => {
                  console.error("[RefillBacklog] error", error);
                  handleError("Failed to refill backlog.");
                })
                .finally(() => setIsRefilling(false));
            }}
            title="Refill backlog tunes into the practice queue"
          >
            {isRefilling ? "Adding..." : "Add from Backlog"}
          </Button>
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
              {/* Inline Add from Backlog button removed: shown only in empty-state panel now */}
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
