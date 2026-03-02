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
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../../lib/context/CurrentRepertoireContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getGoals } from "../../lib/db/queries/user-settings";
import { getViewColumnDescriptions } from "../../lib/db/queries/view-column-meta";
import { GridStatusMessage } from "./GridStatusMessage";
import { TunesGrid } from "./TunesGrid";
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridScheduled: Component<IGridBaseProps> = (props) => {
  // No direct staging here; parent handles DB side-effects.
  const { localDb } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // Goals: load once per user, used by GoalBadge dropdown in the grid.
  const [goalsData] = createResource(
    () => {
      const db = localDb();
      const uid = props.userId;
      return db && uid ? { db, uid } : null;
    },
    async (params) => {
      if (!params) return [];
      return getGoals(params.db, params.uid);
    }
  );

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

  const isLoading = createMemo(() => props.isLoading ?? false);
  const loadError = createMemo(() => props.loadError);
  const hasTunes = createMemo(() => tunes().length > 0);

  const [columnDescriptions] = createResource(
    () => {
      const db = localDb();
      return db ? { db } : null;
    },
    async (params) => {
      if (!params) return {};
      return await getViewColumnDescriptions(params.db, "practice_list_staged");
    }
  );

  return (
    <div class="h-full flex flex-col">
      {/* Show grid when data is available */}
      <Show
        when={!isLoading() && !loadError() && hasTunes()}
        fallback={
          <GridStatusMessage
            variant={
              loadError() ? "error" : isLoading() ? "loading" : "success"
            }
            title={
              loadError()
                ? "Unable to load practice queue"
                : isLoading()
                  ? "Loading practice queue..."
                  : "All Caught Up!"
            }
            description={
              loadError()
                ? "There was a problem syncing your scheduled tunes."
                : isLoading()
                  ? "Syncing your scheduled tunes."
                  : "No tunes are due for practice right now."
            }
            hint={
              loadError()
                ? "Refresh the page. If this keeps happening, open the Sync menu and run Force Full Sync Down."
                : undefined
            }
            error={loadError()}
          />
        }
      >
        <TunesGrid
          tablePurpose="scheduled"
          userId={props.userId}
          repertoireId={currentRepertoireId() || undefined}
          data={tunes()}
          columnDescriptions={columnDescriptions()}
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
            goals: () => goalsData() ?? [],
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
