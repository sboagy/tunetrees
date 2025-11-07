/**
 * Tunes Grid Scheduled Component (wrapper)
 *
 * Refactored to use shared <TunesGrid> for rendering. Wrapper handles:
 * - Queue generation and data fetching
 * - Evaluation state staging and callbacks
 * - Minimal stats footer
 */
import type { VisibilityState } from "@tanstack/solid-table";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getPracticeList } from "../../lib/db/queries/practice";
import { ensureDailyQueue } from "../../lib/services/practice-queue";
import { stagePracticeEvaluation } from "../../lib/services/practice-staging";
import { getPracticeDate } from "../../lib/utils/practice-date";
import { TunesGrid } from "./TunesGrid";
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridScheduled: Component<IGridBaseProps> = (props) => {
  const { localDb, syncVersion, initialSyncComplete, incrementSyncVersion } =
    useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // Column visibility: ensure select column hidden and only valid keys propagate
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    { select: false }
  );
  createEffect(() => {
    props.onColumnVisibilityChange?.(columnVisibility());
  });

  // Generate/fetch daily practice queue (frozen snapshot)
  // This must run BEFORE getPracticeList since the query JOINs with the queue
  // CRITICAL: Must wait for initialSyncComplete to ensure data exists in SQLite
  const [queueInitialized] = createResource(
    () => {
      const db = localDb();
      const playlistId = currentPlaylistId();
      const version = syncVersion(); // Triggers refetch when sync completes
      const syncComplete = initialSyncComplete(); // Wait for initial sync to finish

      console.log(
        `[TunesGridScheduled] queueInitialized deps: db=${!!db}, userId=${
          props.userId
        }, playlist=${playlistId}, version=${version}, syncComplete=${syncComplete}`
      );

      // Don't attempt to run until initial sync completes
      if (!syncComplete) {
        console.log(
          "[TunesGridScheduled] Waiting for initial sync to complete..."
        );
        return null;
      }

      return db && props.userId && playlistId
        ? { db, userId: props.userId, playlistId, version, syncComplete }
        : null;
    },
    async (params) => {
      if (!params) return false;
      try {
        // Ensure queue exists for practice date (respects URL override)
        const practiceDate = getPracticeDate();
        const created = await ensureDailyQueue(
          params.db,
          params.userId,
          params.playlistId,
          practiceDate
        );

        if (created) {
          console.log("[TunesGridScheduled] ✅ Created new daily queue");
        } else {
          console.log("[TunesGridScheduled] ✓ Queue already exists");
        }

        return true;
      } catch (error) {
        console.error(
          "[TunesGridScheduled] Queue initialization failed:",
          error
        );
        return false;
      }
    }
  );

  // Fetch practice list from practice_list_staged VIEW (JOINed with queue)
  // CRITICAL: Must wait for queueInitialized() to complete before fetching
  // Otherwise grid queries before queue exists, gets 0 rows
  const [dueTunesData] = createResource(
    () => {
      const db = localDb();
      const playlistId = currentPlaylistId();
      const version = syncVersion(); // Triggers refetch when sync completes
      const initialized = queueInitialized(); // Wait for queue to be ready

      // Log dependencies for debugging
      console.log(
        `[TunesGridScheduled] dueTunesData deps: db=${!!db}, userId=${
          props.userId
        }, playlist=${playlistId}, version=${version}, queueInit=${initialized}`
      );

      // Only proceed if ALL dependencies are ready
      return db && props.userId && playlistId && initialized
        ? {
            db,
            userId: props.userId,
            playlistId,
            version,
            queueReady: initialized,
          }
        : null;
    },
    async (params) => {
      if (!params) {
        console.log(
          `[TunesGridScheduled] dueTunesData: params null, returning empty`
        );
        return [];
      }
      const delinquencyWindowDays = 7; // Show tunes due in last 7 days
      console.log(
        `[TunesGridScheduled] Fetching practice list with queue (queueReady=${params.queueReady})`
      );
      // Query practice_list_staged VIEW INNER JOIN daily_practice_queue
      // Queue provides frozen snapshot with bucket/order_index/completed_at
      return await getPracticeList(
        params.db,
        params.userId,
        params.playlistId,
        delinquencyWindowDays
      );
    }
  );

  // Use shared evaluations from parent - NO local state!
  const evaluations = () => props.evaluations ?? {};
  const setEvaluations = (
    evalsOrUpdater:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>)
  ) => {
    if (!props.onEvaluationsChange) {
      console.error(
        "[TunesGridScheduled] No onEvaluationsChange callback provided!"
      );
      return;
    }

    const newEvals =
      typeof evalsOrUpdater === "function"
        ? evalsOrUpdater(evaluations())
        : evalsOrUpdater;

    props.onEvaluationsChange(newEvals);
  };

  // Initialize evaluations from existing staged data in database
  createEffect(() => {
    const data = dueTunesData();
    if (data && data.length > 0) {
      const initialEvals: Record<string, string> = {};
      for (const entry of data) {
        // Only include entries that have a staged recall_eval from database
        if (entry.recall_eval && entry.recall_eval !== "") {
          initialEvals[entry.id] = entry.recall_eval;
        }
      }
      // Only update if there are staged evaluations and current state is empty
      const currentEvals = evaluations();
      if (
        Object.keys(initialEvals).length > 0 &&
        Object.keys(currentEvals).length === 0
      ) {
        console.log(
          `📊 Initializing ${
            Object.keys(initialEvals).length
          } staged evaluations from database`
        );
        setEvaluations(initialEvals);
      }
    }
  });

  // Provide clear evaluations callback to parent
  createEffect(() => {
    if (props.onClearEvaluationsReady) {
      props.onClearEvaluationsReady(() => {
        setEvaluations({});
      });
    }
  });

  // Transform PracticeListStagedWithQueue to match grid expectations
  // Queue provides bucket, order_index, and completed_at
  const tunes = createMemo(() => {
    const data = dueTunesData() || [];
    const evals = evaluations();

    // Filter by completed_at if showSubmitted is false or undefined
    // When showSubmitted is true, show all tunes including submitted ones
    // When showSubmitted is false or undefined, hide submitted tunes
    const filteredData =
      props.showSubmitted === true
        ? data
        : data.filter((entry) => !entry.completed_at);

    // Map bucket integer to string for display
    const bucketNames: Record<
      number,
      "Due Today" | "Lapsed" | "New" | "Old Lapsed"
    > = {
      1: "Due Today",
      2: "Lapsed",
      3: "New",
      4: "Old Lapsed",
    };

    return filteredData.map((entry) => {
      return {
        ...entry,
        tune_id: entry.id, // PracticeListStagedRow uses 'id' field
        bucket: bucketNames[entry.bucket] || "Due Today",
        // Override recall_eval with local state if user has made a selection
        // If tune_id is in evaluations (even if empty string), use that value
        // Otherwise fall back to database value
        recall_eval:
          entry.id in evals ? evals[entry.id] : entry.recall_eval || "",
        // All latest_* fields already provided by VIEW via COALESCE
      };
    });
  });

  // Track open state for RecallEvalComboBox per tune to preserve dropdowns across refreshes
  const [openMenus, setOpenMenus] = createSignal<Record<string, boolean>>({});
  const getRecallEvalOpen = (tuneId: string) => !!openMenus()[tuneId];
  const setRecallEvalOpen = (tuneId: string, isOpen: boolean) =>
    setOpenMenus((prev) => ({ ...prev, [tuneId]: isOpen }));

  // Notify parent when tunes change (for flashcard view)
  createEffect(() => {
    if (props.onTunesChange) {
      // Cast to ITuneOverview[] since the shape matches
      props.onTunesChange(tunes() as unknown as ITuneOverview[]);
    }
  });

  // Callback for recall evaluation changes
  const handleRecallEvalChange = async (tuneId: string, evaluation: string) => {
    console.log(`Tune ${tuneId} recall eval changed to: ${evaluation}`);

    // Update local state to trigger immediate re-render
    // Optimistic update: store value for immediate UI feedback.
    // For "(Not Set)" we now store an explicit empty string instead of deleting the key,
    // so the label updates right away even before the DB/view refresh completes.
    setEvaluations((prev) => {
      return { ...prev, [tuneId]: evaluation };
    });

    // Stage to table_transient_data for FSRS preview, or clear if "(not set)"
    const db = localDb();
    const playlistId = currentPlaylistId();
    if (db && playlistId && props.userId) {
      try {
        if (evaluation === "") {
          // Clear staged data when "(not set)" selected
          const { clearStagedEvaluation } = await import(
            "../../lib/services/practice-staging"
          );
          await clearStagedEvaluation(db, props.userId, tuneId, playlistId);
          console.log(`🗑️  Cleared staged evaluation for tune ${tuneId}`);
        } else {
          // Stage FSRS preview for actual evaluations
          await stagePracticeEvaluation(
            db,
            props.userId,
            playlistId,
            tuneId,
            evaluation,
            "recall", // Default goal
            "fsrs" // FSRS is the default technique
          );
          console.log(`✅ Staged FSRS preview for tune ${tuneId}`);
        }

        // Increment sync version to trigger grid refresh
        incrementSyncVersion();
      } catch (error) {
        console.error(
          `❌ Failed to ${
            evaluation === "" ? "clear" : "stage"
          } evaluation for tune ${tuneId}:`,
          error
        );
      }
    }

    // Notify parent component
    if (props.onRecallEvalChange) {
      props.onRecallEvalChange(tuneId, evaluation);
    }
  };

  // Notify parent of evaluations count changes
  createEffect(() => {
    // Count only non-empty evaluations (ignore "(Not Set)" which is stored as "")
    const count = Object.values(evaluations()).filter((v) => v !== "").length;
    if (props.onEvaluationsCountChange) {
      props.onEvaluationsCountChange(count);
    }
  });

  // Row click sets current tune and bubbles selection
  const handleRowClick = (row: ReturnType<typeof tunes>[0]) => {
    setCurrentTuneId(row.tune_id);
    props.onTuneSelect?.(row as any);
  };

  return (
    <div class="h-full flex flex-col">
      {/* Loading/empty states */}
      <Show when={dueTunesData.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              Loading Practice Queue...
            </p>
          </div>
        </div>
      </Show>

      <Show
        when={!dueTunesData.loading && tunes().length > 0}
        fallback={
          <div class="flex items-center justify-center h-full">
            <Show
              when={
                initialSyncComplete() &&
                !queueInitialized.loading &&
                !dueTunesData.loading &&
                queueInitialized() !== undefined &&
                dueTunesData() !== undefined
              }
              fallback={
                <div class="text-center py-12">
                  <div class="text-6xl mb-4">⏳</div>
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-300 mb-2">
                    Loading Practice Queue...
                  </h3>
                  <p class="text-gray-700 dark:text-gray-400">
                    Syncing your data from the cloud...
                  </p>
                </div>
              }
            >
              <div class="text-center py-12">
                <div class="text-6xl mb-4">🎉</div>
                <h3 class="text-xl font-semibold text-green-900 dark:text-green-300 mb-2">
                  All Caught Up!
                </h3>
                <p class="text-green-700 dark:text-green-400">
                  No tunes are due for practice right now.
                </p>
              </div>
            </Show>
          </div>
        }
      >
        <TunesGrid
          tablePurpose="scheduled"
          userId={props.userId}
          playlistId={currentPlaylistId() || undefined}
          data={tunes()}
          currentRowId={currentTuneId() || undefined}
          enableColumnReorder={true}
          enableRowSelection={false}
          onRowClick={(row) => handleRowClick(row as any)}
          columnVisibility={columnVisibility()}
          onColumnVisibilityChange={setColumnVisibility}
          cellCallbacks={{
            onRecallEvalChange: handleRecallEvalChange,
            onGoalChange: props.onGoalChange,
            getRecallEvalOpen,
            setRecallEvalOpen,
          }}
          onTableReady={(tbl) => {
            props.onTableReady?.(tbl as any);
            props.onTableInstanceChange?.(tbl as any);
          }}
        />
      </Show>

      {/* Sticky Footer with Stats */}
      <div class="sticky bottom-0 z-10 bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 px-4 py-2">
        <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>
            {tunes().length} tune{tunes().length !== 1 ? "s" : ""} due
          </span>
        </div>
      </div>
    </div>
  );
};
