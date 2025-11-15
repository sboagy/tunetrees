import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
} from "@tanstack/solid-table";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { GripVertical } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  CELL_CLASSES,
  CONTAINER_CLASSES,
  getHeaderCellClasses,
  HEADER_CLASSES,
  ROW_CLASSES,
  TABLE_CLASSES,
  TBODY_CLASSES,
} from "./shared-grid-styles";
import { getColumns as getDefaultColumns } from "./TuneColumns";
import {
  loadTableState,
  mergeWithDefaults,
  saveTableState,
} from "./table-state-persistence";
import type { ICellEditorCallbacks, TablePurpose } from "./types";

export interface ITunesGridProps<T extends { id: string | number }> {
  tablePurpose: TablePurpose; // "catalog" | "repertoire" | "scheduled"
  userId: string;
  playlistId?: string;
  data: T[];
  // Optional override: when omitted, columns are derived via getColumns(tablePurpose, cellCallbacks)
  columns?: ColumnDef<T, unknown>[];
  // Optional callbacks used by editable cells inside default column sets
  cellCallbacks?: ICellEditorCallbacks;
  currentRowId?: string | number;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onSelectionChange?: (count: number) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (vs: VisibilityState) => void;
  onTableReady?: (table: Table<T>) => void;
  // Enable drag-and-drop column reordering
  enableColumnReorder?: boolean;
  // Enable/disable row selection (default true)
  enableRowSelection?: boolean;
}

export const TunesGrid = (<T extends { id: string | number }>(
  props: ITunesGridProps<T>
) => {
  // State persistence key
  const stateKey = createMemo(() => ({
    userId: props.userId,
    tablePurpose: props.tablePurpose,
    playlistId: props.playlistId ?? "0",
  }));

  // Load persisted state
  const loadedState = loadTableState(stateKey());
  const initialState = mergeWithDefaults(
    loadedState,
    props.tablePurpose as any
  );

  // Table state signals
  const [sorting, setSorting] = createSignal<SortingState>(
    initialState.sorting || []
  );
  const [rowSelection, setRowSelection] = createSignal<RowSelectionState>(
    initialState.rowSelection || {}
  );
  const [columnSizing, setColumnSizing] = createSignal<ColumnSizingState>(
    initialState.columnSizing || {}
  );
  const [columnOrder, setColumnOrder] = createSignal<ColumnOrderState>(
    initialState.columnOrder || []
  );
  // Initialize from persisted state first; only adopt prop-driven visibility when it contains keys.
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    initialState.columnVisibility || {}
  );

  // Restore rowSelection when userId becomes available (after initial render)
  createEffect(() => {
    const key = stateKey();
    const loaded = loadTableState(key);
    if (loaded?.rowSelection && Object.keys(loaded.rowSelection).length > 0) {
      const current = rowSelection();
      // Only restore if current state is empty (avoid overwriting user's new selections)
      if (Object.keys(current).length === 0) {
        console.log(
          `[TunesGrid ${props.tablePurpose}] Restoring ${Object.keys(loaded.rowSelection).length} row selections from localStorage`
        );
        setRowSelection(loaded.rowSelection);
      }
    }
  });

  // If parent provides a non-empty controlled visibility, adopt it; otherwise keep persisted/internal
  createEffect(() => {
    const v = props.columnVisibility;
    if (v && Object.keys(v).length > 0) {
      setColumnVisibility(v);
    }
  });

  // Sync column visibility changes to parent
  createEffect(() => {
    props.onColumnVisibilityChange?.(columnVisibility());
  });

  // Resolve columns: use provided columns or derive from shared factory
  const resolvedColumns = createMemo<ColumnDef<T, unknown>[]>(() => {
    if (props.columns && props.columns.length > 0) return props.columns;
    // Use shared column factory by purpose; cast to the generic row type
    return getDefaultColumns(
      props.tablePurpose,
      props.cellCallbacks
    ) as unknown as ColumnDef<T, unknown>[];
  });

  // Create table instance
  const table = createSolidTable<T>({
    get data() {
      return props.data;
    },
    get columns() {
      return resolvedColumns();
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: props.enableRowSelection ?? true,
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
    getRowId: (row) => String((row as any).id),
  });

  // Notify parent of table instance
  createEffect(() => {
    props.onTableReady?.(table);
  });

  // Optional column drag-and-drop reordering
  const [isDragging, setIsDragging] = createSignal(false);
  const [draggedColumnId, setDraggedColumnId] = createSignal<string | null>(
    null
  );
  const [hoverColumnId, setHoverColumnId] = createSignal<string | null>(null);
  // When resizing, suppress drag-reorder entirely
  const [isResizing, setIsResizing] = createSignal(false);

  // Clear resize state on mouseup/touchend globally
  onMount(() => {
    const up = () => setIsResizing(false);
    window.addEventListener("mouseup", up, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    onCleanup(() => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    });
  });

  const reorderColumns = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const current = columnOrder();
    const baseOrder =
      current.length > 0 ? current : table.getAllLeafColumns().map((c) => c.id);
    const srcIdx = baseOrder.indexOf(sourceId);
    const tgtIdx = baseOrder.indexOf(targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const next = [...baseOrder];
    next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, sourceId);
    setColumnOrder(next);
  };

  const handleDragStart = (e: DragEvent, columnId: string) => {
    if (!props.enableColumnReorder) return;
    if (isResizing()) return; // don't start DnD while resizing
    setIsDragging(true);
    setDraggedColumnId(columnId);
    e.dataTransfer?.setData("text/plain", columnId);
    e.dataTransfer!.effectAllowed = "move";
  };
  const handleDragOver = (e: DragEvent, targetId: string) => {
    if (!props.enableColumnReorder) return;
    e.preventDefault();
    setHoverColumnId(targetId);
    e.dataTransfer!.dropEffect = "move";
  };
  const handleDrop = (e: DragEvent, targetId: string) => {
    if (!props.enableColumnReorder) return;
    e.preventDefault();
    const sourceId = draggedColumnId();
    if (sourceId) reorderColumns(sourceId, targetId);
    setIsDragging(false);
    setDraggedColumnId(null);
    setHoverColumnId(null);
  };
  const handleDragEnd = () => {
    if (!props.enableColumnReorder) return;
    setIsDragging(false);
    setDraggedColumnId(null);
    setHoverColumnId(null);
  };

  // Container ref for virtualization
  let containerRef: HTMLDivElement | undefined;

  // Virtualizer for rows
  const rowVirtualizer = createMemo(() =>
    createVirtualizer({
      get count() {
        return table.getRowModel().rows.length;
      },
      getScrollElement: () => containerRef || null,
      estimateSize: () => 40,
      overscan: 10,
      getItemKey: (index) => {
        const row = table.getRowModel().rows[index];
        return row ? row.id : index;
      },
      useAnimationFrameWithResizeObserver: true,
      isScrollingResetDelay: 200,
    })
  );

  // Persist table state (excluding scrollTop here)
  createEffect(() => {
    const state = {
      sorting: sorting(),
      rowSelection: rowSelection(),
      columnSizing: columnSizing(),
      columnOrder: columnOrder(),
      columnVisibility: columnVisibility(),
      // Do not persist scrollTop here; handled by scroll persistence logic below
      scrollTop: loadedState?.scrollTop || 0,
    };
    saveTableState(stateKey(), state);
  });

  // Simple scroll restoration and persistence
  const scrollKey = createMemo<string | null>(() => {
    const uid = props.userId;
    if (!uid) return null;
    const suffix = props.playlistId ? `_${props.playlistId}` : "";
    return `TT_${props.tablePurpose.toUpperCase()}_SCROLL_${uid}${suffix}`;
  });

  // When the scroll storage key changes (e.g., playlist change), restore once
  const [lastScrollKey, setLastScrollKey] = createSignal<string | null>(null);
  createEffect(() => {
    const key = scrollKey();
    if (!key || key === lastScrollKey()) return;
    setLastScrollKey(key);
    if (!containerRef) return;
    const stored = localStorage.getItem(key);
    if (stored) {
      containerRef.scrollTop = Number.parseInt(stored, 10);
    }
  });

  onMount(() => {
    const waitForContainer = () => {
      if (!containerRef) {
        requestAnimationFrame(waitForContainer);
        return;
      }
      if (containerRef.scrollHeight <= containerRef.clientHeight) {
        requestAnimationFrame(waitForContainer);
        return;
      }
      const key = scrollKey();
      if (key) {
        const stored = localStorage.getItem(key);
        if (stored) {
          containerRef.scrollTop = Number.parseInt(stored, 10);
        }
      }
      let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
      const handleScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const key = scrollKey();
          if (containerRef && key) {
            localStorage.setItem(key, String(containerRef.scrollTop));
          }
          props.onSelectionChange?.(Object.keys(rowSelection()).length);
        }, 150);
      };
      containerRef.addEventListener("scroll", handleScroll, { passive: true });
      onCleanup(() => {
        if (containerRef)
          containerRef.removeEventListener("scroll", handleScroll);
        if (scrollTimeout) clearTimeout(scrollTimeout);
      });
    };
    waitForContainer();
  });

  // Notify selection count
  createEffect(() => {
    const count = Object.keys(rowSelection()).length;
    console.log(
      `[TunesGrid ${props.tablePurpose}] Selection changed: ${count} rows selected`,
      rowSelection()
    );
    props.onSelectionChange?.(count);
  });

  return (
    <div class="h-full flex flex-col">
      {/* Table container with virtualization */}
      <div
        ref={(el) => {
          containerRef = el;
        }}
        class={CONTAINER_CLASSES}
        style={{ "touch-action": "pan-x pan-y" }}
      >
        <table
          data-testid={`tunes-grid-${props.tablePurpose}`}
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
                        data-testid={`ch-${header.column.id}`}
                        class={getHeaderCellClasses(
                          `${draggedColumnId() === header.column.id ? "opacity-50" : ""} ${
                            isDragging() &&
                            hoverColumnId() === header.column.id &&
                            draggedColumnId() !== header.column.id
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : ""
                          }`
                        )}
                        style={{ width: `${header.getSize()}px` }}
                        onDragOver={(e) =>
                          handleDragOver(
                            e as unknown as DragEvent,
                            header.column.id
                          )
                        }
                        onDrop={(e) =>
                          handleDrop(
                            e as unknown as DragEvent,
                            header.column.id
                          )
                        }
                      >
                        <div class="flex items-center gap-0 justify-between">
                          <span class="flex items-center gap-1 flex-1 min-w-0">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </span>
                          <Show
                            when={
                              !!props.enableColumnReorder &&
                              header.column.id !== "select" &&
                              header.column.id !== "actions"
                            }
                          >
                            <button
                              type="button"
                              draggable={true}
                              onDragStart={(e) =>
                                handleDragStart(
                                  e as unknown as DragEvent,
                                  header.column.id
                                )
                              }
                              onDragEnd={handleDragEnd}
                              class="cursor-grab active:cursor-grabbing flex-shrink-0 p-0.5 border-0 bg-transparent"
                              aria-label={`Drag to reorder ${header.column.columnDef.header as string} column`}
                            >
                              <GripVertical
                                size={14}
                                class="text-gray-400 dark:text-gray-500 opacity-50 md:opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                              />
                            </button>
                          </Show>
                          <Show when={header.column.getCanResize()}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                setIsResizing(true);
                                header.getResizeHandler()(e);
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                setIsResizing(true);
                                header.getResizeHandler()(e);
                              }}
                              class="resize-handle absolute top-0 right-0 w-4 h-full cursor-col-resize select-none touch-none group/resize bg-transparent border-0 p-0 z-10"
                              aria-label={`Resize ${header.id} column`}
                            >
                              <div class="absolute top-0 right-0 w-1 h-full bg-gray-300 dark:bg-gray-600 group-hover/resize:bg-blue-500 dark:group-hover/resize:bg-blue-400 group-hover/resize:w-1.5 transition-all pointer-events-none" />
                            </button>
                          </Show>
                        </div>
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
                  height: `${rowVirtualizer().getVirtualItems()[0]?.start || 0}px`,
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
                      "border-t-2 border-b-2 border-blue-500":
                        props.currentRowId === (row.original as any).id,
                    }}
                    onClick={() => props.onRowClick?.(row.original)}
                    onDblClick={() => props.onRowDoubleClick?.(row.original)}
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

            {/* Spacer after visible items */}
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
    </div>
  );
}) as Component<ITunesGridProps<any>>;
