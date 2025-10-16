/**
 * Tunes Grid Scheduled Component
 *
 * Practice queue grid with embedded recall evaluation controls.
 * Features:
 * - Sticky header with frozen columns
 * - Virtual scrolling for performance
 * - Embedded RecallEvalComboBox in Evaluation column
 * - Real-time feedback staging with FSRS preview
 * - Uses getPracticeList() query (practice_list_staged VIEW)
 *
 * @module components/grids/TunesGridScheduled
 */

import {
  type ColumnOrderState,
  type ColumnSizingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/solid-table";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { GripVertical } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getPracticeList } from "../../lib/db/queries/practice";
import { stagePracticeEvaluation } from "../../lib/services/practice-staging";
import {
  CELL_CLASSES,
  CONTAINER_CLASSES,
  getHeaderCellClasses,
  HEADER_CLASSES,
  ROW_CLASSES,
  TABLE_CLASSES,
  TBODY_CLASSES,
} from "./shared-grid-styles";
import { getColumns } from "./TuneColumns";
import {
  loadTableState,
  mergeWithDefaults,
  saveTableState,
} from "./table-state-persistence";
import type { IGridBaseProps } from "./types";

export const TunesGridScheduled: Component<IGridBaseProps> = (props) => {
  const { localDb, syncVersion } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // State persistence key
  const stateKey = createMemo(() => ({
    userId: props.userId,
    tablePurpose: props.tablePurpose,
    playlistId: currentPlaylistId() || 0,
  }));

  // Load persisted state
  const loadedState = loadTableState(stateKey());
  const mergedState = mergeWithDefaults(loadedState, "scheduled");

  // Filter columnVisibility to remove invalid column IDs (e.g., latest_due from repertoire tab)
  const scheduledColumns = getColumns("scheduled");
  const validColumnIds = new Set(
    scheduledColumns
      .map((col) => {
        if (typeof col === "object" && col !== null) {
          return (
            ("id" in col && col.id) ||
            ("accessorKey" in col && (col.accessorKey as string)) ||
            undefined
          );
        }
        return undefined;
      })
      .filter((id): id is string => id !== undefined)
  );
  const filteredColumnVisibility = Object.fromEntries(
    Object.entries(mergedState.columnVisibility || {}).filter(([id]) =>
      validColumnIds.has(id)
    )
  );

  const initialState = {
    ...mergedState,
    columnVisibility: {
      ...filteredColumnVisibility,
      select: false, // Hide select/checkbox column for practice grid
    },
  };

  // Table state signals
  const [sorting, setSorting] = createSignal<SortingState>(
    initialState.sorting || []
  );
  const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = createSignal<ColumnSizingState>(
    initialState.columnSizing || {}
  );
  const [columnOrder, setColumnOrder] = createSignal<ColumnOrderState>(
    initialState.columnOrder || []
  );

  // Track dragging state for column reordering
  const [isDragging, setIsDragging] = createSignal(false);
  const [draggedColumn, setDraggedColumn] = createSignal<string | null>(null);

  // Always filter column visibility to prevent invalid column IDs
  const getFilteredVisibility = (
    visibility: VisibilityState
  ): VisibilityState => {
    return Object.fromEntries(
      Object.entries(visibility).filter(([id]) => validColumnIds.has(id))
    );
  };

  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    getFilteredVisibility(
      props.columnVisibility || initialState.columnVisibility || {}
    )
  );

  // Sync column visibility changes to parent (also filter outgoing state)
  createEffect(() => {
    if (props.onColumnVisibilityChange) {
      props.onColumnVisibilityChange(getFilteredVisibility(columnVisibility()));
    }
  });

  // Fetch practice list from practice_list_staged VIEW
  const [dueTunesData] = createResource(
    () => {
      const db = localDb();
      const playlistId = currentPlaylistId();
      const version = syncVersion(); // Triggers refetch when sync completes
      return db && props.userId && playlistId 
        ? { db, userId: props.userId, playlistId, version } 
        : null;
    },
    async (params) => {
      if (!params) return [];
      // Query practice_list_staged VIEW (complete enriched data with COALESCE)
      return await getPracticeList(
        params.db,
        params.userId,
        params.playlistId
      );
    }
  );

  // Track evaluation changes locally for UI updates
  const [evaluations, setEvaluations] = createSignal<Record<number, string>>(
    {}
  );

  // Provide clear evaluations callback to parent
  createEffect(() => {
    if (props.onClearEvaluationsReady) {
      props.onClearEvaluationsReady(() => {
        setEvaluations({});
      });
    }
  });

  // Helper function to check if a tune was practiced today
  const wasPracticedToday = (latestPracticed: string | null): boolean => {
    if (!latestPracticed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const practicedDate = new Date(latestPracticed);
    practicedDate.setHours(0, 0, 0, 0);
    return practicedDate.getTime() === today.getTime();
  };

  // Transform PracticeListStagedRow to match grid expectations
  // Add bucket classification and local evaluation state
  const tunes = createMemo(() => {
    const data = dueTunesData() || [];
    const evals = evaluations();

    // Filter out tunes practiced today if showSubmitted is false
    const filteredData =
      props.showSubmitted === false
        ? data.filter((entry) => !wasPracticedToday(entry.latest_practiced))
        : data;

    // Classify into buckets
    return filteredData.map((entry) => {
      let bucket: "Due Today" | "Lapsed" | "Backfill" = "Due Today";

      const now = new Date();
      if (entry.scheduled) {
        const dueDate = new Date(entry.scheduled);
        const diffDays = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays > 7) {
          bucket = "Lapsed";
        }
      } else if (!entry.scheduled) {
        // New tune or backfill
        bucket = "Backfill";
      }

      return {
        ...entry,
        tune_id: entry.id, // PracticeListStagedRow uses 'id' field
        bucket,
        // Override recall_eval with local state if user has made a selection
        recall_eval: evals[entry.id] || entry.recall_eval || "",
        // All latest_* fields already provided by VIEW via COALESCE
      };
    });
  });

  // Callback for recall evaluation changes
  const handleRecallEvalChange = async (tuneId: number, evaluation: string) => {
    console.log(`Tune ${tuneId} recall eval changed to: ${evaluation}`);
    
    // Update local state to trigger immediate re-render
    setEvaluations((prev) => ({ ...prev, [tuneId]: evaluation }));
    
    // Stage to table_transient_data for FSRS preview
    const db = localDb();
    const playlistId = currentPlaylistId();
    if (db && playlistId) {
      try {
        await stagePracticeEvaluation(
          db,
          playlistId,
          tuneId,
          evaluation,
          "recall", // Default goal
          "" // Default technique
        );
        // Grid will auto-refresh via syncVersion or we can manually trigger refetch
        // For now, relying on local state update for immediate feedback
        console.log(`✅ Staged FSRS preview for tune ${tuneId}`);
      } catch (error) {
        console.error(`❌ Failed to stage evaluation for tune ${tuneId}:`, error);
      }
    }
    
    // Notify parent component
    if (props.onRecallEvalChange) {
      props.onRecallEvalChange(tuneId, evaluation);
    }
  };

  // Notify parent of evaluations count changes
  createEffect(() => {
    const count = Object.keys(evaluations()).length;
    if (props.onEvaluationsCountChange) {
      props.onEvaluationsCountChange(count);
    }
  });

  // Column definitions with embedded RecallEvalComboBox
  const columns = createMemo(() =>
    getColumns("scheduled", {
      onRecallEvalChange: handleRecallEvalChange,
      onGoalChange: props.onGoalChange,
    })
  );

  // Create table instance
  const table = createSolidTable({
    get data() {
      return tunes();
    },
    get columns() {
      return columns();
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: false,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    state: {
      get sorting() {
        return sorting();
      },
      get rowSelection() {
        return rowSelection();
      },
      get columnSizing() {
        return columnSizing();
      },
      get columnOrder() {
        return columnOrder();
      },
      get columnVisibility() {
        return columnVisibility();
      },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: (updater) => {
      // Filter incoming visibility changes to prevent invalid column IDs
      setColumnVisibility((prev) => {
        const newValue =
          typeof updater === "function" ? updater(prev) : updater;
        return getFilteredVisibility(newValue);
      });
    },
    getRowId: (row) => String(row.id),
  });

  // Notify parent of table instance
  createEffect(() => {
    if (props.onTableReady) {
      props.onTableReady(table);
    }
    if (props.onTableInstanceChange) {
      props.onTableInstanceChange(table);
    }
  });

  // Container ref for virtualization
  let containerRef: HTMLDivElement | undefined;

  // Virtualizer for rows
  const rowVirtualizer = createMemo(() =>
    createVirtualizer({
      get count() {
        return table.getRowModel().rows.length;
      },
      getScrollElement: () => containerRef || null,
      estimateSize: () => 48, // Row height
      overscan: 10,
    })
  );

  // Persist state on changes
  createEffect(() => {
    const state = {
      sorting: sorting(),
      columnSizing: columnSizing(),
      columnOrder: columnOrder(),
      columnVisibility: columnVisibility(),
      scrollTop: containerRef?.scrollTop || 0,
    };
    saveTableState(stateKey(), state);
  });

  // Handle row click to set current tune
  const handleRowClick = (tune: ReturnType<typeof tunes>[0]) => {
    setCurrentTuneId(tune.tune_id);
    if (props.onTuneSelect) {
      props.onTuneSelect(tune as any);
    }
  };

  // Handle column drag and drop for reordering
  const handleDragStart = (e: DragEvent, columnId: string) => {
    setIsDragging(true);
    setDraggedColumn(columnId);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", columnId);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
  };

  const handleDrop = (e: DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const sourceColumnId = draggedColumn();

    if (sourceColumnId && sourceColumnId !== targetColumnId) {
      const currentOrder = columnOrder();
      const allColumns = table.getAllLeafColumns().map((c) => c.id);

      // Use current order if exists, otherwise use default column order
      const orderToUse = currentOrder.length > 0 ? currentOrder : allColumns;

      const sourceIndex = orderToUse.indexOf(sourceColumnId);
      const targetIndex = orderToUse.indexOf(targetColumnId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...orderToUse];
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, sourceColumnId);
        setColumnOrder(newOrder);
      }
    }

    setIsDragging(false);
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedColumn(null);
  };

  // Selected count for footer
  const selectedCount = createMemo(() => Object.keys(rowSelection()).length);

  // Notify parent of selection changes
  createEffect(() => {
    if (props.onSelectionChange) {
      props.onSelectionChange(selectedCount());
    }
  });

  return (
    <div class="h-full flex flex-col">
      {/* Selection Summary */}
      <Show when={selectedCount() > 0}>
        <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <p class="text-sm text-blue-900 dark:text-blue-300">
            {selectedCount()} tune{selectedCount() !== 1 ? "s" : ""} selected
          </p>
        </div>
      </Show>

      {/* Table Container */}
      <div
        ref={containerRef}
        class={CONTAINER_CLASSES}
        style={{ position: "relative", "touch-action": "pan-x pan-y" }}
      >
        <Show
          when={!dueTunesData.loading}
          fallback={
            <div class="flex items-center justify-center h-full">
              <p class="text-gray-500 dark:text-gray-400">
                Loading practice queue...
              </p>
            </div>
          }
        >
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
            {/* Virtual scrolling table */}
            <table
              data-testid="tunes-grid-practice"
              class={TABLE_CLASSES}
              style={{
                width: `${table.getTotalSize()}px`,
              }}
            >
              {/* Sticky Header */}
              <thead class={HEADER_CLASSES}>
                <For each={table.getHeaderGroups()}>
                  {(headerGroup) => (
                    <tr>
                      <For each={headerGroup.headers}>
                        {(header) => {
                          const canResize = header.column.getCanResize();
                          const canSort = header.column.getCanSort();

                          return (
                            <th
                              data-testid={`ch-${header.column.id}`}
                              colSpan={header.colSpan}
                              class={getHeaderCellClasses(
                                `${
                                  draggedColumn() === header.column.id
                                    ? "opacity-50"
                                    : ""
                                } ${
                                  isDragging() &&
                                  draggedColumn() !== header.column.id
                                    ? "bg-blue-50 dark:bg-blue-900/20"
                                    : ""
                                }`
                              )}
                              style={{
                                width: `${header.getSize()}px`,
                              }}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, header.column.id)}
                            >
                              {/* Column content with drag handle */}
                              <div class="flex items-center gap-0 justify-between">
                                {/* Main content area */}
                                <button
                                  type="button"
                                  class="flex items-center gap-1 flex-1 min-w-0 bg-transparent border-0 p-0 text-left"
                                  onClick={
                                    canSort
                                      ? header.column.getToggleSortingHandler()
                                      : undefined
                                  }
                                  style={{
                                    cursor: canSort ? "pointer" : "default",
                                  }}
                                  disabled={!canSort}
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                                </button>

                                {/* Drag handle - available on all columns except select/actions */}
                                <Show
                                  when={
                                    header.column.id !== "select" &&
                                    header.column.id !== "actions"
                                  }
                                >
                                  <button
                                    type="button"
                                    draggable={true}
                                    onDragStart={(e) =>
                                      handleDragStart(e, header.column.id)
                                    }
                                    onDragEnd={handleDragEnd}
                                    class="cursor-grab active:cursor-grabbing flex-shrink-0 p-0.5 border-0 bg-transparent"
                                    aria-label={`Drag to reorder ${
                                      header.column.columnDef.header as string
                                    } column`}
                                  >
                                    <GripVertical
                                      size={14}
                                      class="text-gray-400 dark:text-gray-500 opacity-50 md:opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                    />
                                  </button>
                                </Show>
                              </div>

                              {/* Resize handle - improved visibility */}
                              <Show when={canResize}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    header.getResizeHandler()(e);
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    header.getResizeHandler()(e);
                                  }}
                                  class="resize-handle absolute top-0 right-0 w-4 h-full cursor-col-resize select-none touch-none group/resize bg-transparent border-0 p-0 z-10"
                                  aria-label={`Resize ${header.id} column`}
                                >
                                  {/* Visual indicator - more prominent */}
                                  <div class="absolute top-0 right-0 w-1 h-full bg-gray-300 dark:bg-gray-600 group-hover/resize:bg-blue-500 dark:group-hover/resize:bg-blue-400 group-hover/resize:w-1.5 transition-all pointer-events-none" />
                                </button>
                              </Show>
                            </th>
                          );
                        }}
                      </For>
                    </tr>
                  )}
                </For>
              </thead>

              {/* Virtual scrolling body */}
              <tbody class={TBODY_CLASSES}>
                {/* Top spacer */}
                <Show
                  when={
                    rowVirtualizer().getVirtualItems().length > 0 &&
                    rowVirtualizer().getVirtualItems()[0].start > 0
                  }
                >
                  <tr>
                    <td
                      style={{
                        height: `${
                          rowVirtualizer().getVirtualItems()[0].start
                        }px`,
                      }}
                    />
                  </tr>
                </Show>

                {/* Virtual rows */}
                <For each={rowVirtualizer().getVirtualItems()}>
                  {(virtualRow) => {
                    const row = table.getRowModel().rows[virtualRow.index];
                    if (!row) return null;

                    const tune = row.original;
                    const isSelected = row.getIsSelected();
                    const isCurrent = tune.tune_id === currentTuneId();

                    return (
                      <tr
                        data-index={virtualRow.index}
                        ref={(el) => {
                          if (el) {
                            queueMicrotask(() =>
                              rowVirtualizer().measureElement(el)
                            );
                          }
                        }}
                        class={ROW_CLASSES}
                        classList={{
                          "bg-blue-50 dark:bg-blue-900/20": isSelected,
                          "ring-2 ring-inset ring-blue-500 dark:ring-blue-400":
                            isCurrent,
                        }}
                        onClick={() => handleRowClick(tune)}
                      >
                        <For each={row.getVisibleCells()}>
                          {(cell) => (
                            <td
                              class={CELL_CLASSES}
                              style={{
                                width: `${cell.column.getSize()}px`,
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          )}
                        </For>
                      </tr>
                    );
                  }}
                </For>

                {/* Bottom spacer */}
                <Show
                  when={
                    rowVirtualizer().getVirtualItems().length > 0 &&
                    rowVirtualizer().getTotalSize() >
                      rowVirtualizer().getVirtualItems()[
                        rowVirtualizer().getVirtualItems().length - 1
                      ].end
                  }
                >
                  <tr>
                    <td
                      style={{
                        height: `${
                          rowVirtualizer().getTotalSize() -
                          rowVirtualizer().getVirtualItems()[
                            rowVirtualizer().getVirtualItems().length - 1
                          ].end
                        }px`,
                      }}
                    />
                  </tr>
                </Show>
              </tbody>
            </table>
          </Show>
        </Show>
      </div>

      {/* Sticky Footer with Stats */}
      <div class="sticky bottom-0 z-10 bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 px-4 py-2">
        <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>
            {tunes().length} tune{tunes().length !== 1 ? "s" : ""} due
          </span>
          <Show when={selectedCount() > 0}>
            <span>{selectedCount()} selected</span>
          </Show>
        </div>
      </div>
    </div>
  );
};
