"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { RowSelectionState } from "@tanstack/react-table";
import { Plus, Upload } from "lucide-react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import {
  type ITuneUpdate,
  submitPracticeFeedbacks,
  stagePracticeFeedback,
} from "../commands";

import {
  deleteTableTransientData,
  updateCurrentTuneInDb,
  updateTableStateInDb,
  getTabGroupMainState,
  updateTabGroupMainState,
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
import type { ITuneOverviewScheduled } from "../types";
import { getSitdownDateFromBrowser } from "./SitdownDateProvider";
import {
  getPracticeQueueEntriesAction,
  refillPracticeQueueAction,
} from "../actions/practice-actions";
import { getRepertoireTunesOverviewAction } from "../actions/practice-actions";
import { useSitDownDate } from "./SitdownDateProvider";
import PracticeDateChooser from "./PracticeDateChooser";

type ReviewMode = "grid" | "flashcard";

interface IScheduledTunesGridProps {
  userId: number;
}

// Grid rows use the shared tune overview shape
type IPracticeQueueRow = ITuneOverviewScheduled;

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
  // Dedicated snapshot loading flag to avoid flicker before data arrives
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [mode, setMode] = useState<ReviewMode>("grid");
  const [showSubmitted, setShowSubmitted] = useState<boolean>(false);
  // Hydration flag for persisted Practice tab UI preferences
  const [prefsLoaded, setPrefsLoaded] = useState<boolean>(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addCount, setAddCount] = useState<number>(5);
  // Removed explicit commit action; submission finalizes staged reviews.
  // Track IDs of tunes that received an evaluation this session (for potential future toggles)
  // Track of evaluated tune ids (reserved for future UI toggles). Currently unused directly in render.
  const [, setCompletedTuneIds] = useState<Set<number>>(new Set());
  // hasPending removed: we now permit backlog only when queue empty (button shown only then)
  // const defaultMaxReviews = 10; // mirrors backend default when prefs not fetched client-side

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
  const anyStaged = tunes.some((t) => t.has_staged);

  // Footer metrics state
  const [lapsedCount, setLapsedCount] = useState<number>(0);
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [futureCount, setFutureCount] = useState<number>(0);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [reviewedTodayCount, setReviewedTodayCount] = useState<number>(0);
  const [toBePracticedCount, setToBePracticedCount] = useState<number>(0);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState<boolean>(false);
  const [reviewedCount, setReviewedCount] = useState<number>(0);

  // Maintain a full, unfiltered snapshot of the practice queue for accurate metrics
  const [fullQueueSnapshot, setFullQueueSnapshot] = useState<
    IPracticeQueueRow[]
  >([]);

  const lastFetchedRefreshId = useRef<number | null>(null);
  const lastFetchedPlaylistId = useRef<number | null>(null);
  // Track the last value of `showSubmitted` used for the most recent snapshot fetch.
  const lastFetchedShowSubmitted = useRef<boolean | null>(null);
  const inFlight = useRef(false);
  const fetchSeq = useRef(0);

  // Local sitdown date state for header controls
  const [sitdownDateLocal, setSitdownDateLocal] = useState<Date | null>(null);
  useEffect(() => {
    try {
      setSitdownDateLocal(new Date(getSitdownDateFromBrowser()));
    } catch (error_) {
      console.warn("Failed to init sitdownDateLocal", error_);
      setSitdownDateLocal(new Date());
    }
  }, []);

  const persistSitdownAndRefresh = (d: Date) => {
    try {
      const iso = d.toISOString();
      window.localStorage.setItem("TT_REVIEW_SITDOWN_DATE", iso);
      // Also update the global override used by getSitdownDateFromBrowser()
      try {
        (
          window as typeof window & {
            __TT_REVIEW_SITDOWN_DATE__?: string;
          }
        ).__TT_REVIEW_SITDOWN_DATE__ = iso;
      } catch (error_) {
        // Non-fatal if window augmentation fails
        console.warn("Failed to set __TT_REVIEW_SITDOWN_DATE__", error_);
      }
      setSitdownDateLocal(d);
      // Trigger a snapshot refetch by advancing the refresh marker
      try {
        triggerRefresh();
      } catch (error) {
        console.warn("Failed to trigger refresh after sitdown change", error);
      }
    } catch (error) {
      console.error("Persist sitdown date failed", error);
    }
  };

  // Date math helpers are now contained in PracticeDateChooser

  // Normalized action ensures we always receive IPracticeQueueEntry[]
  // Hydrate persisted Practice tab UI preferences (Display Submitted, Flashcard Mode)
  useEffect(() => {
    if (userId <= 0) return; // unauthenticated; skip persistence
    if (playlistId <= 0) {
      // Avoid blocking early app bootstrap when playlist isn't chosen yet
      setPrefsLoaded(true);
      return;
    }
    let canceled = false;
    void (async () => {
      try {
        const state = await getTabGroupMainState(userId, playlistId);
        if (!state || canceled) return;
        if (typeof state.practice_show_submitted === "boolean") {
          setShowSubmitted(state.practice_show_submitted);
        }
        if (typeof state.practice_mode_flashcard === "boolean") {
          setMode(state.practice_mode_flashcard ? "flashcard" : "grid");
        }
      } catch (error) {
        console.warn("Practice prefs hydration failed", error);
      } finally {
        if (!canceled) setPrefsLoaded(true);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [userId, playlistId]);

  useEffect(() => {
    if (playlistId <= 0 || !prefsLoaded) return;
    // If we've already fetched this playlist/refresh combo with the same showSubmitted flag, skip
    if (
      lastFetchedPlaylistId.current === playlistId &&
      lastFetchedRefreshId.current === refreshId &&
      lastFetchedShowSubmitted.current === showSubmitted
    ) {
      return; // snapshot already loaded for this refresh cycle
    }
    if (inFlight.current) return;
    async function fetchSnapshot() {
      inFlight.current = true;

      ++fetchSeq.current;
      setIsLoading(true);
      setIsSnapshotLoading(true);
      try {
        const sitdownDate = getSitdownDateFromBrowser();
        const snapshotEntries = await getPracticeQueueEntriesAction(
          userId,
          playlistId,
          new Date(sitdownDate),
          false,
        );

        const mapped: IPracticeQueueRow[] = snapshotEntries.map((e) => ({
          id: e.tune_ref,
          title: e.tune_title ?? null,
          favorite_url: null,
          type: e.type ?? null,
          structure: e.structure ?? null,
          learned: e.learned ?? null,
          scheduled: e.scheduled ?? null,
          latest_practiced: e.latest_practiced ?? null,
          latest_due: e.latest_due ?? null,
          bucket: (e.bucket as number | null) ?? null,
          recall_eval: null,
          goal: null,
          latest_quality: e.latest_quality ?? null,
          latest_easiness: e.latest_easiness ?? null,
          latest_interval: e.latest_interval ?? null,
          latest_goal: e.latest_goal ?? null,
          latest_repetitions: e.latest_repetitions ?? null,
          latest_technique: e.latest_technique ?? null,
          latest_difficulty: e.latest_difficulty ?? null,
          latest_stability: e.latest_stability ?? null,
          latest_step: e.latest_step ?? null,
          latest_backup_practiced: e.latest_backup_practiced ?? null,
          // reserved fields not present on ITuneOverviewScheduled omitted
          playlist_deleted: false,
          has_staged: e.has_staged ?? null,
          completed_at: e.completed_at ?? null,
          private_for: null,
        }));
        // Save unfiltered snapshot for metrics regardless of UI filtering
        setFullQueueSnapshot(mapped);

        const filtered = showSubmitted
          ? mapped
          : mapped.filter((row) => !row.completed_at);
        // Debug: surface snapshot vs filtered counts for quick triage
        if (process.env.NODE_ENV !== "production") {
          console.debug("[PracticeQueue][Scheduled] fetched", {
            playlistId,
            refreshId,
            showSubmitted,
            total: mapped.length,
            visible: filtered.length,
            submittedCount: mapped.filter((r) => !!r.completed_at).length,
          });
        }
        setTunes(filtered);
        setTunesRefreshId(refreshId);
        lastFetchedRefreshId.current = refreshId;
        lastFetchedPlaylistId.current = playlistId;
        lastFetchedShowSubmitted.current = showSubmitted;
      } catch (error) {
        console.error("[PracticeQueueFetch] error", error);
        handleError("Failed to load practice queue.");
      } finally {
        setIsLoading(false);
        setIsSnapshotLoading(false);
        inFlight.current = false;
      }
    }
    void fetchSnapshot();
  }, [
    playlistId,
    refreshId,
    userId,
    setTunes,
    setTunesRefreshId,
    handleError,
    showSubmitted,
    prefsLoaded,
  ]);

  // Compute repertoire-wide totals locally so Practice matches Repertoire exactly
  const { sitDownDate, acceptableDelinquencyDays } = useSitDownDate();
  useEffect(() => {
    async function computeRepertoireCounts(_refreshMarker: number | null) {
      // Touch marker to satisfy exhaustive-deps without changing logic
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      _refreshMarker;
      if (userId <= 0 || playlistId <= 0) return;
      try {
        const result = await getRepertoireTunesOverviewAction(
          userId,
          playlistId,
          false,
          null,
        );
        const effectiveSitdown =
          sitDownDate ?? new Date(getSitdownDateFromBrowser());
        const lowerBound = new Date(effectiveSitdown);
        lowerBound.setDate(
          effectiveSitdown.getDate() - acceptableDelinquencyDays,
        );

        // Safari-safe timestamp parser for DB strings like "YYYY-MM-DD HH:mm:ss"
        const parseDbTimestamp = (
          ts: string | null | undefined,
        ): Date | null => {
          if (!ts) return null;
          // Fast path
          let d = new Date(ts);
          if (!Number.isNaN(d.getTime())) return d;
          // Try replace space with T
          if (ts.includes(" ")) {
            d = new Date(ts.replace(" ", "T"));
            if (!Number.isNaN(d.getTime())) return d;
            // Assume UTC if still invalid
            d = new Date(`${ts.replace(" ", "T")}Z`);
            if (!Number.isNaN(d.getTime())) return d;
          }
          // Try appending Z for UTC if not present
          if (!ts.endsWith("Z")) {
            d = new Date(`${ts}Z`);
            if (!Number.isNaN(d.getTime())) return d;
          }
          return null;
        };

        let l = 0;
        let c = 0;
        let f = 0;
        for (const tune of result as Array<{
          scheduled?: string | null;
          latest_due?: string | null;
        }>) {
          // Coalesce: prefer scheduled, fallback to canonical snapshot next due
          const ts = tune.scheduled ?? tune.latest_due ?? null;
          const sd = parseDbTimestamp(ts);
          if (!sd) continue;
          if (sd < lowerBound) l += 1;
          else if (sd > lowerBound && sd <= effectiveSitdown) c += 1;
          else f += 1;
        }
        setLapsedCount(l);
        setCurrentCount(c);
        setFutureCount(f);
      } catch (error) {
        console.error("[PracticeFooterCounts] Failed repertoire fetch", error);
      }
    }
    void computeRepertoireCounts(refreshId);
  }, [userId, playlistId, sitDownDate, acceptableDelinquencyDays, refreshId]);

  // Derive queue-specific footer metrics whenever snapshot changes
  useEffect(() => {
    const all = fullQueueSnapshot;

    // Queue-specific metrics
    const queued = all.length;
    const submitted = all.filter((t) => !!t.completed_at).length;
    const reviewed = all.filter(
      (t) => !!t.completed_at || !!t.recall_eval,
    ).length;
    const toPractice = Math.max(0, queued - reviewed);

    setQueuedCount(queued);
    // keep the existing state variable name (reviewedTodayCount) but store submitted count
    setReviewedTodayCount(submitted);
    setReviewedCount(reviewed);
    setToBePracticedCount(toPractice);
  }, [fullQueueSnapshot]);

  // (Optional) could add lightweight debug here; removed verbose scheduled logs.

  const handleRecallEvalChange = useCallback(
    (tuneId: number, newValue: string): void => {
      setTunes((prev) =>
        prev.map((t) =>
          t.id === tuneId ? { ...t, recall_eval: newValue } : t,
        ),
      );
      // Keep full snapshot in sync for accurate metrics
      setFullQueueSnapshot((prev) =>
        prev.map((t) =>
          t.id === tuneId ? { ...t, recall_eval: newValue } : t,
        ),
      );
      if (newValue) {
        setCompletedTuneIds((prev) => new Set(prev).add(tuneId));
      } else {
        setCompletedTuneIds((prev) => {
          const next = new Set(prev);
          next.delete(tuneId);
          return next;
        });
        // Clearing value should also clear staged flag locally
        setTunes((prev) =>
          prev.map((t) => (t.id === tuneId ? { ...t, has_staged: false } : t)),
        );
        setFullQueueSnapshot((prev) =>
          prev.map((t) => (t.id === tuneId ? { ...t, has_staged: false } : t)),
        );
      }
      try {
        const sitdownDate = getSitdownDateFromBrowser();
        if (newValue) {
          void stagePracticeFeedback(
            playlistId,
            tuneId,
            newValue,
            new Date(sitdownDate),
          )
            .then((ok) => {
              if (!ok) return;
              setTunes((prev) =>
                prev.map((t) =>
                  t.id === tuneId ? { ...t, has_staged: true } : t,
                ),
              );
              // Lightweight per-row refresh: fetch snapshot silently and merge updated metrics for this tune only
              void (async () => {
                try {
                  const snapshotEntries = await getPracticeQueueEntriesAction(
                    userId,
                    playlistId,
                    new Date(sitdownDate),
                    false,
                  );
                  const updated = snapshotEntries.find(
                    (r) => r.tune_ref === tuneId,
                  );
                  if (updated) {
                    setTunes((prev) =>
                      prev.map((t) => {
                        if (t.id !== tuneId) return t;
                        return {
                          ...t,
                          latest_quality:
                            updated.latest_quality ?? t.latest_quality,
                          latest_easiness:
                            updated.latest_easiness ?? t.latest_easiness,
                          latest_interval:
                            updated.latest_interval ?? t.latest_interval,
                          latest_due: updated.latest_due ?? t.latest_due,
                          scheduled: null, //updated.scheduled ?? t.scheduled, // I think we want this null always for staging?
                          latest_difficulty:
                            updated.latest_difficulty ?? t.latest_difficulty,
                          latest_stability:
                            updated.latest_stability ?? t.latest_stability,
                          latest_step: updated.latest_step ?? t.latest_step,
                          latest_repetitions:
                            updated.latest_repetitions ?? t.latest_repetitions,
                          latest_goal: updated.latest_goal ?? t.latest_goal,
                          latest_technique:
                            updated.latest_technique ?? t.latest_technique,
                          latest_practiced:
                            updated.latest_practiced ?? t.latest_practiced,
                          latest_backup_practiced:
                            updated.latest_backup_practiced ??
                            t.latest_backup_practiced,
                        };
                      }),
                    );
                    setFullQueueSnapshot((prev) =>
                      prev.map((t) => {
                        if (t.id !== tuneId) return t;
                        return {
                          ...t,
                          latest_quality:
                            updated.latest_quality ?? t.latest_quality,
                          latest_easiness:
                            updated.latest_easiness ?? t.latest_easiness,
                          latest_interval:
                            updated.latest_interval ?? t.latest_interval,
                          latest_due: updated.latest_due ?? t.latest_due,
                          scheduled: null,
                          latest_difficulty:
                            updated.latest_difficulty ?? t.latest_difficulty,
                          latest_stability:
                            updated.latest_stability ?? t.latest_stability,
                          latest_step: updated.latest_step ?? t.latest_step,
                          latest_repetitions:
                            updated.latest_repetitions ?? t.latest_repetitions,
                          latest_goal: updated.latest_goal ?? t.latest_goal,
                          latest_technique:
                            updated.latest_technique ?? t.latest_technique,
                          latest_practiced:
                            updated.latest_practiced ?? t.latest_practiced,
                          latest_backup_practiced:
                            updated.latest_backup_practiced ??
                            t.latest_backup_practiced,
                        };
                      }),
                    );
                  }
                } catch (error) {
                  console.warn("Per-row refresh failed", error);
                }
              })();
            })
            .catch((error) => {
              console.error("stagePracticeFeedback error", error);
              handleError(
                "Failed to stage practice feedback. Please try again.",
              );
            });
        } else {
          // Clear path: attempt backend clear already triggered by combo box helper.
          // Perform lightweight per-row refresh to sync derived metrics (latest_* revert to committed values).
          void (async () => {
            try {
              const snapshotEntries = await getPracticeQueueEntriesAction(
                userId,
                playlistId,
                new Date(sitdownDate),
                false,
              );
              const updated = snapshotEntries.find(
                (r) => r.tune_ref === tuneId,
              );
              if (updated) {
                setTunes((prev) =>
                  prev.map((t) => {
                    if (t.id !== tuneId) return t;
                    return {
                      ...t,
                      latest_quality:
                        updated.latest_quality ?? t.latest_quality,
                      latest_easiness:
                        updated.latest_easiness ?? t.latest_easiness,
                      latest_interval:
                        updated.latest_interval ?? t.latest_interval,
                      latest_due: updated.latest_due ?? t.latest_due,
                      scheduled: updated.scheduled ?? t.scheduled,
                      recall_eval: null,
                      has_staged: updated.has_staged ?? false,
                      latest_difficulty:
                        updated.latest_difficulty ?? t.latest_difficulty,
                      latest_stability:
                        updated.latest_stability ?? t.latest_stability,
                      latest_step: updated.latest_step ?? t.latest_step,
                      latest_repetitions:
                        updated.latest_repetitions ?? t.latest_repetitions,
                      latest_goal: updated.latest_goal ?? t.latest_goal,
                      latest_technique:
                        updated.latest_technique ?? t.latest_technique,
                      latest_practiced:
                        updated.latest_practiced ?? t.latest_practiced,
                      latest_backup_practiced:
                        updated.latest_backup_practiced ??
                        t.latest_backup_practiced,
                    };
                  }),
                );
                setFullQueueSnapshot((prev) =>
                  prev.map((t) => {
                    if (t.id !== tuneId) return t;
                    return {
                      ...t,
                      latest_quality:
                        updated.latest_quality ?? t.latest_quality,
                      latest_easiness:
                        updated.latest_easiness ?? t.latest_easiness,
                      latest_interval:
                        updated.latest_interval ?? t.latest_interval,
                      latest_due: updated.latest_due ?? t.latest_due,
                      scheduled: updated.scheduled ?? t.scheduled,
                      recall_eval: null,
                      has_staged: updated.has_staged ?? false,
                      latest_difficulty:
                        updated.latest_difficulty ?? t.latest_difficulty,
                      latest_stability:
                        updated.latest_stability ?? t.latest_stability,
                      latest_step: updated.latest_step ?? t.latest_step,
                      latest_repetitions:
                        updated.latest_repetitions ?? t.latest_repetitions,
                      latest_goal: updated.latest_goal ?? t.latest_goal,
                      latest_technique:
                        updated.latest_technique ?? t.latest_technique,
                      latest_practiced:
                        updated.latest_practiced ?? t.latest_practiced,
                      latest_backup_practiced:
                        updated.latest_backup_practiced ??
                        t.latest_backup_practiced,
                    };
                  }),
                );
              }
            } catch (error) {
              console.warn("Per-row refresh after clear failed", error);
            }
          })();
        }
      } catch (error) {
        console.error("stage submit failed", error);
      }
    },
    [setTunes, playlistId, userId, handleError],
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
        // Visibility rule: if Display Submitted is OFF, remove submitted rows; if ON, keep them
        const practicedIds = new Set(
          Object.keys(updates).map((k) => Number(k)),
        );
        setTunes((prev) => {
          if (!showSubmitted) {
            return prev.filter((t) =>
              t.id !== null && t.id !== undefined
                ? !practicedIds.has(t.id)
                : true,
            );
          }
          // Keep rows; mark as completed via snapshot merge below
          return prev;
        });
        setCompletedTuneIds((prev) => {
          const next = new Set(prev);
          for (const id of practicedIds) {
            next.delete(id);
          }
          return next;
        });
        // Reflect submission into full snapshot so metrics include submitted items
        setFullQueueSnapshot((prev) =>
          prev.map((t) =>
            t.id !== null && t.id !== undefined && practicedIds.has(t.id)
              ? { ...t, completed_at: new Date(sitdownDate).toISOString() }
              : t,
          ),
        );
        toast({
          title: "Success",
          description: "Submitted evaluated tunes.",
        });
        // Trigger global tune data refresh so Repertoire grid reflects new practice metadata
        try {
          triggerRefresh();
        } catch (error) {
          // Non-fatal; log to console only
          console.error(
            "Failed to trigger global tune refresh after submit",
            error,
          );
        }
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

  // commitStagedHandler removed (commit via Submit Practiced Tunes only).

  const handleModeChange = (checked: boolean) => {
    setMode(checked ? "flashcard" : "grid");
  };

  // Persist Flashcard Mode changes after state updates (avoid side-effects during render)
  useEffect(() => {
    if (!prefsLoaded || userId <= 0) return;
    void updateTabGroupMainState(userId, {
      user_id: userId,
      practice_mode_flashcard: mode === "flashcard",
    });
  }, [mode, prefsLoaded, userId]);

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
      {/* Commit Staged button removed per user feedback; rely solely on submit pathway */}
      {tableComponent}
      {playlistId <= 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg">No Playlist</p>
        </div>
      ) : !table ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg">Loading...</p>
        </div>
      ) : (isLoading || isSnapshotLoading) && tunes.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-lg">Loading...</p>
        </div>
      ) : (
        <>
          <div
            id="tt-scheduled-tunes-header"
            className="flex items-center justify-between py-4"
          >
            <div className="flex-row items-center flex gap-3">
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
              {/* Show Submitted Toggle */}
              <div className="flex items-center gap-2 ml-2">
                <Label htmlFor="show-submitted">Display Submitted</Label>
                <Switch
                  id="show-submitted"
                  checked={showSubmitted}
                  onCheckedChange={(checked) => {
                    setShowSubmitted(checked);
                    void updateTabGroupMainState(userId, {
                      user_id: userId,
                      practice_show_submitted: checked,
                    });
                  }}
                  data-testid="toggle-show-submitted"
                />
              </div>
              {/* Add Tunes Dialog Trigger */}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="pl-3"
                    title="Add tunes to practice queue"
                    data-testid="practice-add-tunes-button"
                  >
                    <span className="mr-2">Add Tunes</span>
                    <Plus className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Tunes</DialogTitle>
                    <DialogDescription>
                      Choose how many tunes to add from your backlog.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-3 py-2">
                    <Label htmlFor="add-count" className="w-32">
                      Count
                    </Label>
                    <Input
                      id="add-count"
                      type="number"
                      min={1}
                      max={50}
                      value={addCount}
                      onChange={(e) => setAddCount(Number(e.target.value))}
                      data-testid="practice-add-count-input"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      disabled={playlistId <= 0 || isRefilling}
                      onClick={() => {
                        const sitdownDate = getSitdownDateFromBrowser();
                        setIsRefilling(true);
                        refillPracticeQueueAction(
                          userId,
                          playlistId,
                          new Date(sitdownDate),
                          Math.max(1, Math.min(50, addCount || 1)),
                        )
                          .then((newRows) => {
                            if (newRows.length === 0) {
                              toast({
                                title: "No backlog tunes",
                                description:
                                  "There are no additional tunes to backfill.",
                              });
                            } else {
                              // Map newRows into internal shape and prioritize due-today items
                              const mapped = newRows.map((enriched) => {
                                const row: IPracticeQueueRow = {
                                  id: enriched.tune_ref,
                                  title: enriched.tune_title ?? null,
                                  type: enriched.type ?? null,
                                  structure: enriched.structure ?? null,
                                  learned: enriched.learned ?? null,
                                  scheduled: enriched.scheduled ?? null,
                                  latest_practiced:
                                    enriched.latest_practiced ?? null,
                                  latest_due: enriched.latest_due ?? null,
                                  bucket:
                                    (enriched.bucket as number | null) ?? null,
                                  recall_eval: null,
                                  goal: null,
                                  latest_quality:
                                    enriched.latest_quality ?? null,
                                  latest_easiness:
                                    enriched.latest_easiness ?? null,
                                  latest_interval:
                                    enriched.latest_interval ?? null,
                                  latest_goal: enriched.latest_goal ?? null,
                                  latest_repetitions:
                                    enriched.latest_repetitions ?? null,
                                  latest_technique:
                                    enriched.latest_technique ?? null,
                                  latest_difficulty:
                                    enriched.latest_difficulty ?? null,
                                  latest_stability:
                                    enriched.latest_stability ?? null,
                                  latest_step: enriched.latest_step ?? null,
                                  latest_backup_practiced:
                                    enriched.latest_backup_practiced ?? null,
                                  playlist_deleted: false,
                                  has_staged: enriched.has_staged ?? null,
                                  completed_at: enriched.completed_at ?? null,
                                  private_for: null,
                                };
                                return row;
                              });
                              // Prioritize tunes due today (bucket === 1) before backfill items
                              mapped.sort((a, b) => {
                                const pa = a.bucket === 1 ? 0 : 1;
                                const pb = b.bucket === 1 ? 0 : 1;
                                return pa - pb;
                              });

                              setTunes((prev) => {
                                const combined: IPracticeQueueRow[] = [
                                  ...prev,
                                  ...mapped,
                                ];
                                return showSubmitted
                                  ? combined
                                  : combined.filter((r) => !r.completed_at);
                              });

                              // Merge added rows into full snapshot (dedupe by id)
                              setFullQueueSnapshot((prev) => {
                                const byId = new Map<
                                  number,
                                  IPracticeQueueRow
                                >();
                                for (const row of prev) {
                                  if (row.id !== null && row.id !== undefined) {
                                    byId.set(row.id, row);
                                  }
                                }
                                for (const row of mapped) {
                                  if (row.id !== null && row.id !== undefined) {
                                    byId.set(row.id, row);
                                  }
                                }
                                return [...byId.values()];
                              });

                              // Compute how many of the added rows are due today (bucket === 1)
                              let dueTodayCount = 0;
                              for (const r of mapped) {
                                if (r.bucket === 1) {
                                  dueTodayCount += 1;
                                }
                              }
                              const backfillCount =
                                mapped.length - dueTodayCount;
                              toast({
                                title: "Backlog refilled",
                                description: `${mapped.length} tune(s) added — ${dueTodayCount} due today, ${backfillCount} backfill`,
                              });
                            }
                          })
                          .catch((error) => {
                            console.error("[RefillBacklog] error", error);
                            handleError("Failed to refill backlog.");
                          })
                          .finally(() => {
                            setIsRefilling(false);
                            setIsAddDialogOpen(false);
                          });
                      }}
                      data-testid="practice-add-confirm"
                    >
                      Add
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {anyStaged && (
                <span
                  className="text-xs text-amber-500 whitespace-nowrap"
                  data-testid="staged-indicator-inline"
                >
                  Staged changes pending submit
                </span>
              )}
              {/* Date chooser (consolidated) */}
              <div className="ml-2">
                <PracticeDateChooser
                  value={sitdownDateLocal}
                  onChange={(d) => persistSitdownAndRefresh(d)}
                  allSubmittedToday={
                    fullQueueSnapshot.length > 0 &&
                    fullQueueSnapshot.every((t) => !!t.completed_at)
                  }
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Label htmlFor="flashcard-mode">Flashcard Mode</Label>
              <Switch
                checked={mode === "flashcard"}
                onCheckedChange={handleModeChange}
              />
            </div>
            {table ? (
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
            ) : null}
          </div>
          {!isSnapshotLoading && tunes.length === 0 ? (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-2"
              data-testid="scheduled-empty-state"
            >
              <p className="text-lg font-semibold">No scheduled tunes</p>
              <p className="text-sm text-muted-foreground">
                Try toggling "Display Submitted" or use Add Tunes to bring items
                into your queue.
              </p>
              {fullQueueSnapshot.length > 0 ? (
                <p
                  className="text-xs text-muted-foreground mt-1"
                  data-testid="scheduled-empty-diagnostics"
                >
                  {`Snapshot: total ${fullQueueSnapshot.length}, submitted ${fullQueueSnapshot.filter((t) => !!t.completed_at).length}`}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {mode === "grid" ? (
                <TunesGrid
                  table={table}
                  userId={userId}
                  playlistId={playlistId}
                  tablePurpose={"practice"}
                  getStyleForSchedulingState={getStyleForSchedulingState}
                  onRowClickCallback={onRowClickCallback}
                  lapsedCount={lapsedCount}
                  currentCount={currentCount}
                  futureCount={futureCount}
                  newCount={queuedCount}
                  onFooterDoubleClick={() => setMetricsDialogOpen(true)}
                  reviewedTodayCount={reviewedTodayCount}
                  toBePracticedCount={toBePracticedCount}
                  reviewedCount={reviewedCount}
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
              {/* Metrics dialog, opened via footer double-click */}
              <Dialog
                open={metricsDialogOpen}
                onOpenChange={setMetricsDialogOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Practice Queue Metrics</DialogTitle>
                    <DialogDescription>
                      Snapshot of your current session metrics.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 py-2 text-sm">
                    <div className="text-muted-foreground">Lapsed</div>
                    <div>{lapsedCount}</div>
                    <div className="text-muted-foreground">Due Today</div>
                    <div>{currentCount}</div>
                    <div className="text-muted-foreground">Future/Backfill</div>
                    <div>{futureCount}</div>
                    <div className="text-muted-foreground">Queued</div>
                    <div>{queuedCount}</div>
                    <div className="text-muted-foreground">Submitted</div>
                    <div>{reviewedTodayCount}</div>
                    <div className="text-muted-foreground">Reviewed</div>
                    <div>{reviewedCount}</div>
                    <div className="text-muted-foreground">To Be Practiced</div>
                    <div>{toBePracticedCount}</div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setMetricsDialogOpen(false)}
                      data-testid="metrics-dialog-close"
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </>
      )}
    </div>
  );
}
