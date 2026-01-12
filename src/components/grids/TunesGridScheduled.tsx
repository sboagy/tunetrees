/**
 * Tunes Grid Scheduled Component (wrapper)
 *
 * Receives pre-fetched and filtered practice list data from parent.
 * Wrapper handles:
 * - Evaluation state staging and callbacks
 * - Data transformation for grid display
 * - Minimal stats footer
 */
import type { VisibilityState } from "@tanstack/solid-table";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { TunesGrid } from "./TunesGrid";
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridScheduled: Component<IGridBaseProps> = (props) => {
  // No direct staging here; parent handles DB side-effects.
  useAuth(); // keep hook call if auth context side-effects are desired; otherwise remove entirely.
  const { currentPlaylistId } = useCurrentPlaylist();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // Column visibility: ensure select column hidden and only valid keys propagate
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    { select: false }
  );
  createEffect(() => {
    props.onColumnVisibilityChange?.(columnVisibility());
  });

  // Use shared evaluations from parent - single source of truth
  const evaluations = () => props.evaluations ?? {};

  // No local evaluation initialization/clear callbacks; parent owns shared state

  // Transform PracticeListStagedWithQueue to match grid expectations
  // Queue provides bucket, order_index, and completed_at
  // NOTE: Filtering by showSubmitted is now done in parent (Index.tsx)
  const tunes = createMemo(() => {
    const data = props.practiceListData ?? []; // Pre-filtered and fetched by parent
    const evals = evaluations();

    console.log(
      `[TunesGridScheduled] Transforming ${data.length} tunes for display`
    );

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

    const mappedData = data.map((entry) => {
      return {
        ...entry,
        tune_id: entry.id, // PracticeListStagedRow uses 'id' field
        bucket: bucketNames[entry.bucket] || "Due Today",
        // Override recall_eval with local state if user has made a selection.
        // Otherwise, fall back to DB-staged value from the joined VIEW (table_transient_data).
        recall_eval:
          entry.id in evals ? evals[entry.id] : entry.recall_eval || "",
        // All latest_* fields already provided by VIEW via COALESCE
      };
    });

    return mappedData;
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
    // Delegate to parent (centralized logic for optimistic update + staging)
    props.onRecallEvalChange?.(tuneId, evaluation);
  };

  // Parent computes evaluationsCount; no per-child count needed

  // Row click sets current tune and bubbles selection
  const handleRowClick = (row: ReturnType<typeof tunes>[0]) => {
    setCurrentTuneId(row.tune_id);
  };

  const handleRowDoubleClick = (row: ReturnType<typeof tunes>[0]) => {
    // Double click: open tune editor via callback
    props.onTuneSelect?.(row as any);
  };

  return (
    <div class="h-full flex flex-col">
      {/* Show grid when data is available */}
      <Show
        when={tunes().length > 0}
        fallback={
          <div class="flex items-center justify-center h-full">
            <div class="text-center py-12">
              <div class="text-6xl mb-4">🎉</div>
              <h3 class="text-xl font-semibold text-green-900 dark:text-green-300 mb-2">
                All Caught Up!
              </h3>
              <p class="text-green-700 dark:text-green-400">
                No tunes are due for practice right now.
              </p>
            </div>
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
          onRowDoubleClick={(row) => handleRowDoubleClick(row as any)}
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
