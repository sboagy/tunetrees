/**
 * Tunes Grid Repertoire Component
 *
 * Table-centric grid for browsing tunes in the current repertoire (playlist).
 * Features:
 * - Sticky header with frozen columns while scrolling
 * - Virtual scrolling for performance with large datasets
 * - Sortable, resizable, hideable columns
 * - Row selection
 * - State persistence (column order, sizes, scroll position)
 * - Uses practice_list_staged view data (via getPlaylistTunes)
 *
 * @module components/grids/TunesGridRepertoire
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
  onMount,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getPlaylistTunesStaged } from "../../lib/db/queries/playlists";
import * as schema from "../../lib/db/schema";
import type { Tune } from "../../lib/db/types";
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
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridRepertoire: Component<IGridBaseProps> = (props) => {
  const { localDb, syncVersion, user } = useAuth();
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
  const initialState = mergeWithDefaults(loadedState, "repertoire");

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
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    props.columnVisibility || initialState.columnVisibility || {}
  );

  // Sync column visibility changes to parent
  createEffect(() => {
    if (props.onColumnVisibilityChange) {
      props.onColumnVisibilityChange(columnVisibility());
    }
  });

  // Track dragging state for column reordering
  const [isDragging, setIsDragging] = createSignal(false);
  const [draggedColumn, setDraggedColumn] = createSignal<string | null>(null);

  // Fetch tunes in current playlist from practice_list_staged view
  const [playlistTunesData] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const playlistId = currentPlaylistId();
      const version = syncVersion(); // Triggers refetch when sync completes
      return db && userId && playlistId
        ? { db, userId, playlistId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return await getPlaylistTunesStaged(
        params.db,
        params.playlistId,
        params.userId
      );
    }
  );

  // Fetch all genres for proper genre names
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = syncVersion(); // Triggers refetch when sync completes
      return db ? { db, version } : null;
    },
    async (params) => {
      if (!params) return [];
      const result = await params.db.select().from(schema.genre).all();
      return result;
    }
  );

  // Transform practice_list_staged data to match the grid's expectations
  // The data is already in ITuneOverview format from the view
  const tunes = createMemo<ITuneOverview[]>(() => {
    return playlistTunesData() || [];
  });

  // Apply client-side filtering (no playlist filter needed - that's implicit)
  const filteredTunes = createMemo<ITuneOverview[]>(() => {
    const baseTunes = tunes();
    const query = props.searchQuery?.trim().toLowerCase() || "";
    const types = props.selectedTypes || [];
    const modes = props.selectedModes || [];
    const genreNames = props.selectedGenreNames || [];
    const allGenresList = allGenres() || [];

    // Map selected genre names to genre IDs for filtering
    const genreIds: number[] = [];
    if (genreNames.length > 0) {
      genreNames.forEach((genreName) => {
        const genre = allGenresList.find((g) => g.name === genreName);
        if (genre) {
          genreIds.push(Number(genre.id));
        }
      });
    }

    return baseTunes.filter((tune: ITuneOverview): boolean => {
      // Search filter
      if (query) {
        const matchesTitle = tune.title?.toLowerCase().includes(query);
        const matchesIncipit = tune.incipit?.toLowerCase().includes(query);
        const matchesStructure = tune.structure?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesIncipit && !matchesStructure) {
          return false;
        }
      }

      // Type filter
      if (types.length > 0 && tune.type) {
        if (!types.includes(tune.type)) {
          return false;
        }
      }

      // Mode filter
      if (modes.length > 0 && tune.mode) {
        if (!modes.includes(tune.mode)) {
          return false;
        }
      }

      // Genre filter (using mapped IDs)
      if (genreIds.length > 0 && tune.genre_ref) {
        if (!genreIds.includes(tune.genre_ref)) {
          return false;
        }
      }

      return true;
    });
  });

  // Column definitions
  const columns = createMemo(() =>
    getColumns("repertoire", {
      onRecallEvalChange: props.onRecallEvalChange,
      onGoalChange: props.onGoalChange,
    })
  );

  // Create table instance
  const table = createSolidTable({
    get data() {
      return filteredTunes();
    },
    get columns() {
      return columns();
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
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
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => String(row.id),
  });

  // Notify parent of table instance
  createEffect(() => {
    if (props.onTableReady) {
      props.onTableReady(table);
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
      estimateSize: () => 40, // Estimated row height
      overscan: 10, // Render 10 extra rows above/below viewport
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

  // Touch handlers for mobile drag-and-drop
  let touchStartX = 0;
  let touchStartY = 0;
  let hasMoved = false;

  const handleTouchStart = (e: TouchEvent, columnId: string) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    hasMoved = false;
    setDraggedColumn(columnId);
    setIsDragging(false); // Don't set dragging true until we've actually moved

    // Add document-level touch move and end listeners
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!draggedColumn()) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);

    // Only start dragging if moved more than 10px (to distinguish from scroll)
    if (!hasMoved && (deltaX > 10 || deltaY > 10)) {
      // If vertical movement is greater, it's a scroll - cancel drag
      if (deltaY > deltaX) {
        setDraggedColumn(null);
        setIsDragging(false);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
        return;
      }
      // Horizontal movement - start dragging
      hasMoved = true;
      setIsDragging(true);
    }

    // Only prevent scrolling if we're actively dragging
    if (hasMoved) {
      e.preventDefault();

      // Clear all previous hover classes
      document.querySelectorAll("th").forEach((th) => {
        th.classList.remove("bg-blue-50", "dark:bg-blue-900/20");
      });

      // Find which column we're over
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const th = element?.closest("th");
      if (th) {
        const columnId = th.getAttribute("data-column-id");
        if (columnId && columnId !== draggedColumn()) {
          // Visual feedback: add hover class
          th.classList.add("bg-blue-50", "dark:bg-blue-900/20");
        }
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!draggedColumn()) return;

    // Only perform reorder if we actually dragged
    if (hasMoved) {
      const touch = e.changedTouches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const th = element?.closest("th");

      let finalTargetId: string | undefined;
      if (th) {
        finalTargetId = th.getAttribute("data-column-id") || undefined;
      }

      if (finalTargetId && draggedColumn() !== finalTargetId) {
        const sourceColumnId = draggedColumn()!;
        const currentOrder = columnOrder();
        const allColumns = table.getAllLeafColumns().map((c) => c.id);
        const orderToUse = currentOrder.length > 0 ? currentOrder : allColumns;

        const sourceIndex = orderToUse.indexOf(sourceColumnId);
        const targetIndex = orderToUse.indexOf(finalTargetId);

        if (sourceIndex !== -1 && targetIndex !== -1) {
          const newOrder = [...orderToUse];
          newOrder.splice(sourceIndex, 1);
          newOrder.splice(targetIndex, 0, sourceColumnId);
          setColumnOrder(newOrder);
        }
      }
    }

    // Clean up
    setIsDragging(false);
    setDraggedColumn(null);
    hasMoved = false;

    // Remove hover classes from all headers
    document.querySelectorAll("th").forEach((th) => {
      th.classList.remove("bg-blue-50", "dark:bg-blue-900/20");
    });

    // Remove document-level listeners
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
  };

  // Restore scroll position
  onMount(() => {
    if (containerRef && initialState.scrollTop) {
      containerRef.scrollTop = initialState.scrollTop;
    }
  });

  // Handle row click
  let clickTimeout: ReturnType<typeof setTimeout> | null = null;
  let clickCount = 0;

  const handleRowClick = (tune: Tune): void => {
    clickCount++;

    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }

    if (clickCount === 1) {
      // Single click: wait to see if it becomes a double click
      clickTimeout = setTimeout(() => {
        // Single click confirmed: set current tune
        setCurrentTuneId(tune.id);
        clickCount = 0;
      }, 250);
    } else if (clickCount === 2) {
      // Double click: open tune editor via callback
      clickCount = 0;
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
      // Cast to ITuneOverview for compatibility with the interface
      props.onTuneSelect?.(tune as unknown as ITuneOverview);
    }
  };

  // Get selected tunes count
  const selectedCount = createMemo<number>(
    () => Object.keys(rowSelection()).length
  );

  // Notify parent of selection changes
  createEffect(() => {
    props.onSelectionChange?.(selectedCount());
  });

  return (
    <div class="h-full flex flex-col">
      {/* Selection summary */}
      <Show when={selectedCount() > 0}>
        <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <span class="text-sm text-blue-700 dark:text-blue-300">
            {selectedCount()} {selectedCount() === 1 ? "tune" : "tunes"}{" "}
            selected
          </span>
          <button
            type="button"
            class="ml-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </button>
        </div>
      </Show>

      {/* Loading state */}
      <Show when={playlistTunesData.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              Loading repertoire...
            </p>
          </div>
        </div>
      </Show>

      {/* Table container with virtualization */}
      <Show when={!playlistTunesData.loading && filteredTunes().length > 0}>
        <div
          ref={(el) => {
            containerRef = el;
          }}
          class={CONTAINER_CLASSES}
          style={{ "touch-action": "pan-x pan-y" }}
        >
          <table
            class={TABLE_CLASSES}
            style={{ width: `${table.getCenterTotalSize()}px` }}
          >
            {/* Sticky header */}
            <thead class={HEADER_CLASSES}>
              <For each={table.getHeaderGroups()}>
                {(headerGroup) => (
                  <tr>
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <th
                          data-column-id={header.column.id}
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
                          style={{ width: `${header.getSize()}px` }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, header.column.id)}
                        >
                          <div class="flex items-center gap-0 justify-between">
                            {/* Main content area */}
                            <span class="flex items-center gap-1 flex-1 min-w-0">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>

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
                                onTouchStart={(e) =>
                                  handleTouchStart(e, header.column.id)
                                }
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

                          {/* Resize handle - improved visibility and event handling */}
                          <Show when={header.column.getCanResize()}>
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
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </thead>

            {/* Virtualized body */}
            <tbody class={TBODY_CLASSES}>
              {/* Spacer for virtual scrolling offset */}
              <Show when={rowVirtualizer().getVirtualItems().length > 0}>
                <tr
                  style={{
                    height: `${
                      rowVirtualizer().getVirtualItems()[0]?.start || 0
                    }px`,
                  }}
                />
              </Show>

              {/* Render only visible rows */}
              <For each={rowVirtualizer().getVirtualItems()}>
                {(virtualRow) => {
                  const row = table.getRowModel().rows[virtualRow.index];
                  if (!row) return null;

                  return (
                    <tr
                      class={ROW_CLASSES}
                      classList={{
                        get ["border-t-2 border-b-2 border-blue-500"]() {
                          return currentTuneId() === row.original.id;
                        },
                      }}
                      onClick={() => handleRowClick(row.original)}
                      data-index={virtualRow.index}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => (
                          <td
                            class={CELL_CLASSES}
                            style={{ width: `${cell.column.getSize()}px` }}
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

              {/* Spacer for virtual scrolling after visible items */}
              <Show
                when={
                  rowVirtualizer().getVirtualItems().length > 0 &&
                  rowVirtualizer().getVirtualItems().length <
                    table.getRowModel().rows.length
                }
              >
                <tr
                  style={{
                    height: `${
                      rowVirtualizer().getTotalSize() -
                      (rowVirtualizer().getVirtualItems().at(-1)?.end || 0)
                    }px`,
                  }}
                />
              </Show>
            </tbody>
          </table>
        </div>

        {/* Footer with tune count */}
        <div class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 flex-shrink-0">
          <div class="text-sm text-gray-600 dark:text-gray-400">
            <span>
              {filteredTunes().length}{" "}
              {filteredTunes().length === 1 ? "tune" : "tunes"} in repertoire
            </span>
          </div>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!playlistTunesData.loading && filteredTunes().length === 0}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-lg text-gray-600 dark:text-gray-400">
              No tunes in repertoire
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
              {tunes().length > 0
                ? "No tunes match your filters"
                : "Add tunes to your repertoire from the Catalog tab"}
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};
