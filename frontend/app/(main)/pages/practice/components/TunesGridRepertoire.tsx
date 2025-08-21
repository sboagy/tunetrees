"use client";

import { Button } from "@/components/ui/button";
import ColumnsMenu from "./ColumnsMenu";
import {
  globalFlagManualSorting,
  saveTableState,
  useTunesTable,
} from "./TunesTable"; // Add this import

import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";

import type {
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { BetweenHorizontalEnd } from "lucide-react";
import { getRepertoireTunesOverviewAction } from "../actions/practice-actions";
import { addTunesToPracticeQueueAction } from "../actions/practice-actions";
import { updatePlaylistTunesAction } from "../actions/practice-actions";
import {
  fetchFilterFromDB,
  getTableStateTable,
  updateTableStateInDb,
} from "../settings";
import type { ITableStateTable, ITuneOverview } from "../types";
import AddTuneButtonAndDialog from "./AddTuneButtonAndDialog";
import { usePlaylist } from "./CurrentPlaylistProvider";
import DeleteTuneButton from "./DeleteTuneButton";
import {
  getSitdownDateFromBrowser,
  useSitDownDate,
} from "./SitdownDateProvider";
import { useTuneDataRefresh } from "./TuneDataRefreshContext";
import { useRepertoireTunes } from "./TunesContextRepertoire";
import TunesGrid from "./TunesGrid";
import { getSchedulingOptionsAction } from "@/app/user-settings/scheduling-options/actions/scheduling-options-actions";
import { getPracticeQueueAction } from "../actions/practice-actions";
import { logVerbose } from "@/lib/logging";

type RepertoireGridProps = {
  userId: number;
};

/**
 * RepertoireTunesGrid component displays a grid of tunes for a given user and playlist,
 * along with a toolbar for filtering, refreshing, and selecting tunes.
 *
 * @remarks
 * - The component uses the `useTunes` and `useTuneDataRefresh` hooks to manage the tunes data and refresh state.
 * - The `refreshTunes` function fetches the recently practiced tunes and updates the state.
 * - The component includes a filter input, a button to add selected tunes to the review queue, and a grid to display the tunes.
 * - The `addToReviewQueue` function handles adding selected tunes to the review queue and submitting feedback.
 */
export default function TunesGridRepertoire({
  userId,
}: RepertoireGridProps): JSX.Element {
  const [isRowsSelected, setIsRowsSelected] = useState(false);
  const selectionChangedCallback = (
    table: TanstackTable<ITuneOverview>,
    rowSelectionState: RowSelectionState,
  ): void => {
    const selectedRowsCount = Object.keys(rowSelectionState).length;
    logVerbose(
      () =>
        `LF7: selectionChangedCallback rowSelectionState=${JSON.stringify(rowSelectionState)}, selectedRowsCount:${selectedRowsCount}`,
    );
    setIsRowsSelected(selectedRowsCount > 0);
  };
  const [globalFilter, setGlobalFilter] = useState("");
  const [isFilterLoaded, setIsFilterLoaded] = useState(false);
  const { currentPlaylist: playlistId } = usePlaylist();
  const showDeleted = false; // Should become a state variable at some point

  logVerbose(
    `LF1 render RepertoireTunesGrid: playlistId=${playlistId}, userId=${userId}`,
  );

  // The tunes are persisted in a context to avoid fetching them multiple times
  // during the life of the app if they haven't changed. The tunesRefreshId,
  // which is specific to the repertoire grid, is used to track the last refresh
  // of the tunes. The refreshId, which is global to the app, is
  // used to compare to tunesRefreshId to trigger a refresh of the tunes when it changes.
  const {
    tunes,
    setTunes,
    tunesRefreshId,
    setTunesRefreshId,
    lapsedCount,
    currentCount,
    futureCount,
    newCount,
  } = useRepertoireTunes();

  const { refreshId, triggerRefresh } = useTuneDataRefresh();

  // Due to the asynchronous nature of setTunesRefreshId, the state update may not
  // complete before the useEffect hook exits. This can lead to multiple refreshes
  // being triggered before tunesRefreshId is updated. To prevent this, we use a ref
  // (isRefreshing) to track the refresh state. The useRef hook allows the value to
  // persist across renders without causing re-renders.
  const isRefreshing = useRef(false);

  // REVIEW: refreshTunes in TunesGridRepertoire.tsx
  // I tried to use refreshTunes from
  // app/[main]/pages/practice/components/TunesContextRepertoire.tsx
  // but things don't work right then.  It's possible that I may be doing
  // some double refreshs, but I'm not sure.
  const refreshTunes = useCallback(
    async (userId: number, playlistId: number, refreshId: number) => {
      try {
        // Given the sequence, since table isn't really created yet, not sure how
        // to better keep the sorting state up to date.  A bit of a chcken and egg
        // problem.  So, for now, just get the sorting state from the database every
        // time.  We'll see if this can be optimized later.  There may be some other
        // state that will have the same problem, like column filters, so, probably
        // best to wait until functionaly complete before trying to optimize.
        let sortingState = null;
        if (globalFlagManualSorting) {
          const tableStateTable: ITableStateTable | null =
            await getTableStateTable(userId, "full", "repertoire", playlistId);
          sortingState =
            (tableStateTable?.settings as TableState)?.sorting ?? null;
        }
        const result: ITuneOverview[] = await getRepertoireTunesOverviewAction(
          userId,
          playlistId,
          showDeleted,
          sortingState,
        );
        setTunesRefreshId(refreshId);
        setTunes(result);
        logVerbose(`LF1 RepertoireGrid setTunesRefreshId(${refreshId})`);
        return result;
      } catch (error) {
        console.error("LF1 Error refreshing tunes:", error);
        throw error;
      } finally {
        isRefreshing.current = false;
      }
    },
    [setTunes, setTunesRefreshId],
  );

  useEffect(() => {
    if (
      playlistId > 0 &&
      tunesRefreshId !== refreshId &&
      !isRefreshing.current
    ) {
      logVerbose(
        `useEffect ===> TunesGridRepertoire.tsx:127 ~ call refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
      isRefreshing.current = true;
      refreshTunes(userId, playlistId, refreshId)
        .then((result: ITuneOverview[]) => {
          logVerbose(`LF1 RepertoireGrid number tunes: ${result.length}`);
          logVerbose(
            `LF1 RepertoireGrid back from refreshTunes refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
          );
        })
        .catch((error) => {
          isRefreshing.current = false;
          console.error("LF1 Error invoking refreshTunes:", error);
        })
        .finally(() => {
          isRefreshing.current = false;
        });
    } else {
      logVerbose(
        `useEffect ===> TunesGridRepertoire.tsx:146 ~ SKIPPING refreshId: ${refreshId} tunesRefreshId: ${tunesRefreshId} isRefreshing: ${isRefreshing.current}`,
      );
    }
  }, [refreshId, tunesRefreshId, userId, playlistId, refreshTunes]);

  const [tableComponent, table] = useTunesTable({
    tunes,
    userId,
    tablePurpose: "repertoire",
    globalFilter: globalFilter,
    onRecallEvalChange: undefined, // not needed for repertoire
    // Persist goal edits immediately (optimistic) to PlaylistTune via PATCH /playlist_tunes
    onGoalChange: (tuneId: number, newValue: string | null) => {
      if (!playlistId || playlistId <= 0) return;
      const goalBefore = tunes.find((t) => t.id === tuneId)?.goal ?? null;
      // Optimistic update
      setTunes((prev) =>
        prev.map((t) => (t.id === tuneId ? { ...t, goal: newValue } : t)),
      );
      updatePlaylistTunesAction([tuneId], playlistId, {
        goal: newValue || undefined,
      })
        .then(() => {
          logVerbose(
            () =>
              `[GoalPersist][Repertoire] Updated goal tuneId=${tuneId} playlistId=${playlistId} value=${newValue}`,
          );
        })
        .catch((error: unknown) => {
          console.error("[GoalPersist][Repertoire] error", error);
          // Rollback on error
          setTunes((prev) =>
            prev.map((t) => (t.id === tuneId ? { ...t, goal: goalBefore } : t)),
          );
          toast({
            title: "Goal update failed",
            description: String((error as Error)?.message || error),
            variant: "destructive",
          });
        });
    },
    selectionChangedCallback,
    setTunesRefreshId,
  });

  useEffect(() => {
    const getFilter = () => {
      fetchFilterFromDB(userId, "repertoire", playlistId)
        .then((filter) => {
          setGlobalFilter(filter);
          setIsFilterLoaded(true);
        })
        .catch((error) => {
          console.error("Error fetching filter:", error);
          setIsFilterLoaded(true);
        });
    };

    logVerbose(
      `useEffect ===> TunesGridRepertoire.tsx:173 ~ [userId=${userId}, playlistId=${playlistId}]`,
    );
    getFilter();
  }, [userId, playlistId]);

  const handleGlobalFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGlobalFilter(value);
    if (table !== null) {
      logVerbose("LF7: Saving table state on filter change: ", value);
      // If I try to go through `table.setGlobalFilter(value)`, and then
      // `saveTableState(table, userId, "repertoire", playlistId)`, it doesn't work
      // so well, always being one character behind, presumably because it feeds through
      // the useState hook. So, instead directly get the state here, update it, and then
      // save it into the database.  Note that updateTableStateInDb will lock while it's
      // updating the database, so hopefully not a problem with getting ahead of the writes.
      const tableState: TableState = table.getState();
      tableState.globalFilter = value;
      void updateTableStateInDb(
        userId,
        "full",
        "repertoire",
        playlistId,
        tableState,
      );
    }
  };

  // useEffect(() => {
  //   return () => {
  //     if (table !== null) {
  //       console.log("LF7: Saving table state on filter change: ", globalFilter);
  //       table.setGlobalFilter(globalFilter);
  //       void saveTableState(table, userId, "repertoire", playlistId);
  //     }
  //   };
  // }, [globalFilter, table, userId, playlistId]);

  // const [preset, setPreset] = useState("");

  // const handlePresetChange = (value: string) => {
  //   setPreset(value);
  //   // Implement preset logic here
  // };

  interface IAddResult {
    added_tune_ids: number[];
    skipped_tune_ids: number[];
    new_entries: unknown[]; // not needed here, so keep broad
  }
  const addToReviewQueue = () => {
    logVerbose("addToReviewQueue (priority manual add) invoked");
    if (table === null) {
      logVerbose("addToReviewQueue: table is null");
      return;
    }
    const selectedTunes = table
      .getSelectedRowModel()
      .rows.map((row) => row.original)
      .filter((t) => typeof t.id === "number");
    if (selectedTunes.length === 0) return;

    const sitdownDate = getSitdownDateFromBrowser();
    const tuneIds = selectedTunes
      .map((t) => t.id)
      .filter((id): id is number => typeof id === "number");

    // Call new server action hitting /practice-queue/.../add
    addTunesToPracticeQueueAction(userId, playlistId, tuneIds, sitdownDate)
      .then((result: IAddResult) => {
        logVerbose("addTunesToPracticeQueueAction result", result);
        if (table) {
          table.resetRowSelection();
          const tableState: TableState = table.getState();
          // clear selection before persisting state
          tableState.rowSelection = {};
          table.setState(tableState);
          void saveTableState(table, userId, "repertoire", playlistId);
        }
        // Refresh snapshot styling + repertoire listing
        triggerRefresh();

        const added = result?.added_tune_ids?.length ?? 0;
        const skipped = result?.skipped_tune_ids?.length ?? 0;
        const titleParts: string[] = [];
        if (added > 0) {
          titleParts.push(`${added} ${added === 1 ? "tune" : "tunes"} added`);
        }
        if (skipped > 0) {
          titleParts.push(
            `${skipped} ${skipped === 1 ? "tune" : "tunes"} skipped`,
          );
        }
        const title =
          titleParts.length > 0
            ? titleParts.join(", ")
            : tuneIds.length > 0
              ? // We requested additions but backend reported none; likely all were missing or duplicates.
                "No eligible tunes"
              : "No changes";
        let description = "";
        if (added > 0 && result?.added_tune_ids) {
          if (added <= 10)
            description = `Added: ${result.added_tune_ids.join(", ")}`;
          else description = `Added ${added} tunes.`;
        }
        if (skipped > 0 && result?.skipped_tune_ids) {
          description += description ? " " : "";
          if (skipped <= 10)
            description += `Skipped (already in queue): ${result.skipped_tune_ids.join(", ")}`;
          else description += `Skipped ${skipped} already present.`;
        }
        toast({ title, description: description || undefined });
      })
      .catch((error: unknown) => {
        console.error("Error addTunesToPracticeQueueAction:", error);
        toast({
          title: "Add to review failed",
          description: String(error),
          variant: "destructive",
        });
      });
  };

  const { sitDownDate } = useSitDownDate();
  const [acceptableDelinquencyWindow, setAcceptableDelinquencyWindow] =
    useState<number>(21);
  // Authoritative bucket map from active practice queue snapshot (tune_ref -> bucket)
  const [bucketMap, setBucketMap] = useState<Map<number, number> | null>(null);

  useEffect(() => {
    async function loadSchedulingPrefsAndSnapshot() {
      try {
        const data = await getSchedulingOptionsAction(userId);
        if (data && typeof data.acceptable_delinquency_window === "number") {
          setAcceptableDelinquencyWindow(data.acceptable_delinquency_window);
        }
      } catch (error) {
        console.error("Error loading prefs_scheduling_options", error);
      }
      // Fetch the existing practice queue snapshot for styling parity (no force regen)
      try {
        if (sitDownDate && playlistId > 0) {
          const snapshot = await getPracticeQueueAction(
            userId,
            playlistId,
            sitDownDate,
            false,
          );
          // Normalise response shape: backend now returns raw list[list[QueueEntry]] (no entries wrapper)
          // but keep backward compatibility if an object { entries: [...] } reappears.
          type QueueEntry = { tune_ref: number; bucket?: number | null };
          let entries: QueueEntry[] = [];
          if (Array.isArray(snapshot)) {
            entries = snapshot as QueueEntry[];
          } else if (
            snapshot &&
            typeof snapshot === "object" &&
            Array.isArray((snapshot as { entries?: unknown[] }).entries)
          ) {
            entries = (snapshot as { entries: QueueEntry[] }).entries;
          } else {
            logVerbose(
              () =>
                `[RepertoireBucketStyling] Unexpected snapshot shape; no entries parsed snapshot=${JSON.stringify(snapshot)}`,
            );
          }
          const map = new Map<number, number>();
          // Populate bucket map from authoritative snapshot rows
          for (const e of entries) {
            if (
              typeof e.tune_ref === "number" &&
              typeof e.bucket === "number"
            ) {
              map.set(e.tune_ref, e.bucket);
            }
          }
          setBucketMap(map);
          console.log(
            "[RepertoireBucketStyling] Loaded practice queue snapshot entries=%d bucketMapSize=%d sample=%o",
            entries.length,
            map.size,
            [...map.entries()].slice(0, 6),
          );
        }
      } catch (error) {
        console.warn(
          "Unable to load practice queue snapshot for repertoire styling parity",
          error,
        );
      }
    }
    void loadSchedulingPrefsAndSnapshot();
  }, [userId, playlistId, sitDownDate]);

  const getStyleForSchedulingState = (
    scheduledDateString: string | null,
    tuneId?: number,
  ): string => {
    // If no snapshot yet, do not apply any styling (avoid heuristic noise until authoritative data loads)
    if (!bucketMap) return "";

    // Snapshot present: bucket-based styling for tunes included in snapshot
    if (tuneId && bucketMap.has(tuneId)) {
      const b = bucketMap.get(tuneId);
      // console.log("[RepertoireBucketStyling] tuneId=%d bucket=%d", tuneId, b);
      if (b === 1) return "font-extrabold"; // Due today (bucket 1)
      if (b === 2) return "underline text-amber-300"; // Recently lapsed (bucket 2)
      if (b === 3) return "underline text-gray-300"; // Older backfill (bucket 3)
      return ""; // Unknown bucket => no styling
    }
    // console.log(
    //   "[RepertoireBucketStyling] tuneId not found in bucketMap:",
    //   tuneId,
    // );

    // Tune not in snapshot: we can still signal future / lapsed context using date heuristics.
    if (!scheduledDateString) return ""; // New unscheduled tune: leave plain when snapshot exists

    const scheduledDate = new Date(scheduledDateString);
    if (Number.isNaN(scheduledDate.getTime())) return "";
    if (!sitDownDate) return "";

    const lowerBound = new Date(sitDownDate);
    lowerBound.setDate(sitDownDate.getDate() - acceptableDelinquencyWindow);
    const startOfSitdownDay = new Date(sitDownDate);
    startOfSitdownDay.setHours(0, 0, 0, 0);
    const startOfNextDay = new Date(startOfSitdownDay);
    startOfNextDay.setDate(startOfNextDay.getDate() + 1);

    // const sameLocalDay = (a: Date, b: Date) =>
    //   a.getFullYear() === b.getFullYear() &&
    //   a.getMonth() === b.getMonth() &&
    //   a.getDate() === b.getDate();

    // Future scheduled (not yet in snapshot) -> italic green
    if (scheduledDate >= startOfNextDay) return "italic text-green-300";

    // Not sure why this doesn't seem to be quite right...
    // if (scheduledDate >= lowerBound && scheduledDate < startOfSitdownDay)
    //   return "italic text-blue-300";

    // Older beyond window -> subtle gray underline
    if (scheduledDate < lowerBound) return "italic text-gray-300";
    // // Same day but not in snapshot (edge / just-generated) -> treat as due today
    // if (sameLocalDay(scheduledDate, sitDownDate)) return "font-extrabold";
    return "";
  };

  return (
    <div className="w-full h-full">
      {tableComponent}
      {!isFilterLoaded || !table || playlistId <= 0 ? (
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
            id="tt-repertoire-tunes-header"
            className="flex items-center justify-between py-4"
          >
            <div className="flex items-center space-x-4 mb-4">
              <Button
                disabled={!isRowsSelected}
                variant="outline"
                onClick={() => addToReviewQueue()}
                title="Add selected tunes to review queue"
              >
                <BetweenHorizontalEnd />
                {window.innerWidth < 768 ? "" : " Add To Review"}
              </Button>
              {/* <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear</SelectItem>
                  <SelectItem value="oldest">Show Oldest Not Played</SelectItem>
                  <SelectItem value="lapsed">Show Recently Lapsed</SelectItem>
                  <SelectItem value="selected">Show Only Selected</SelectItem>
                </SelectContent>
              </Select> */}
            </div>
            <div
              className="flex items-center space-x-4 mb-4"
              style={{ width: "60ch" }}
            >
              <Input
                placeholder="Filter"
                value={globalFilter}
                onChange={handleGlobalFilterChange}
              />
            </div>
            <div className="flex items-center space-x-4 mb-4">
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                {"<"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                {">"}
              </Button> */}
              {/* <NewTuneButton userId={userId} playlistId={playlistId} /> */}
              <AddTuneButtonAndDialog userId={userId} playlistId={playlistId} />
              <DeleteTuneButton
                userId={userId}
                playlistId={playlistId}
                disabled={!isRowsSelected}
                table={table}
              />
              <ColumnsMenu
                user_id={userId}
                tablePurpose="repertoire"
                playlistId={playlistId}
                table={table}
                triggerRefresh={triggerRefresh}
              />
            </div>
          </div>
          <TunesGrid
            table={table}
            userId={userId}
            playlistId={playlistId}
            tablePurpose={"repertoire"}
            getStyleForSchedulingState={getStyleForSchedulingState}
            lapsedCount={lapsedCount}
            currentCount={currentCount}
            futureCount={futureCount}
            newCount={newCount}
          />
        </>
      )}
    </div>
  );
}
