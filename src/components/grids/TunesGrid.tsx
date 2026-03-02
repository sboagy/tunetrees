import {
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
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
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
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
import type {
  ICellEditorCallbacks,
  ITableStateExtended,
  TablePurpose,
} from "./types";

export interface ITunesGridProps<T extends { id: string | number }> {
  tablePurpose: TablePurpose; // "catalog" | "repertoire" | "scheduled"
  userId: string;
  repertoireId?: string;
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
  // Optional map of column descriptions to show in header popovers
  columnDescriptions?: Partial<Record<string, string>>;
}

export const TunesGrid = (<T extends { id: string | number }>(
  props: ITunesGridProps<T>
) => {
  const [openPopover, setOpenPopover] = createSignal<string | null>(null);
  let popoverRef: HTMLDivElement | undefined;
  useClickOutside(
    () => popoverRef,
    () => setOpenPopover(null)
  );
  const collectColumnIds = (
    cols: ColumnDef<T, unknown>[]
  ): ReadonlySet<string> => {
    const ids = new Set<string>();

    const visit = (col: ColumnDef<T, unknown>) => {
      const anyCol = col as unknown as {
        id?: string;
        accessorKey?: unknown;
        columns?: ColumnDef<T, unknown>[];
      };

      if (Array.isArray(anyCol.columns)) {
        for (const child of anyCol.columns) visit(child);
        return;
      }

      const inferredId =
        anyCol.id ??
        (typeof anyCol.accessorKey === "string" ? anyCol.accessorKey : null);
      if (typeof inferredId === "string" && inferredId.length > 0) {
        ids.add(inferredId);
      }
    };

    for (const c of cols) visit(c);
    return ids;
  };

  const sanitizeInitialTableState = (
    state: ITableStateExtended,
    allowedColumnIds: ReadonlySet<string>
  ): ITableStateExtended => {
    // Migrate old/deprecated column IDs to current ones where possible.
    const mapColumnId = (id: string): string => {
      if (
        id === "evaluation" &&
        !allowedColumnIds.has("evaluation") &&
        allowedColumnIds.has("recall_eval")
      ) {
        return "recall_eval";
      }
      return id;
    };

    function filterByAllowed<TValue>(
      record: Record<string, TValue> | undefined
    ): Record<string, TValue> | undefined {
      if (!record) return record;
      const out: Record<string, TValue> = {};
      for (const [key, value] of Object.entries(record)) {
        const mapped = mapColumnId(key);
        if (allowedColumnIds.has(mapped)) out[mapped] = value;
      }
      return out;
    }

    const sanitizeOrder = (
      order: string[] | undefined
    ): string[] | undefined => {
      if (!order) return order;
      const seen = new Set<string>();
      const out: string[] = [];
      for (const id of order) {
        const mapped = mapColumnId(id);
        if (!allowedColumnIds.has(mapped)) continue;
        if (seen.has(mapped)) continue;
        seen.add(mapped);
        out.push(mapped);
      }
      return out;
    };

    const sanitizeSorting = (
      sorting: ITableStateExtended["sorting"]
    ): ITableStateExtended["sorting"] => {
      if (!sorting) return sorting;
      const out: Array<{ id: string; desc: boolean }> = [];
      for (const s of sorting) {
        const mapped = mapColumnId(s.id);
        if (!allowedColumnIds.has(mapped)) continue;
        out.push({ ...s, id: mapped });
      }
      return out;
    };

    return {
      ...state,
      columnVisibility: filterByAllowed(state.columnVisibility),
      columnSizing: filterByAllowed(state.columnSizing),
      columnOrder: sanitizeOrder(state.columnOrder),
      sorting: sanitizeSorting(state.sorting),
      columnPinning: {
        left: (state.columnPinning?.left ?? []).filter((id) =>
          allowedColumnIds.has(mapColumnId(id))
        ),
        right: (state.columnPinning?.right ?? []).filter((id) =>
          allowedColumnIds.has(mapColumnId(id))
        ),
      },
    };
  };

  const activeRepertoireId = createMemo(() => props.repertoireId ?? "0");

  // State persistence key
  const stateKey = createMemo(() => ({
    userId: props.userId,
    tablePurpose: props.tablePurpose,
    repertoireId: activeRepertoireId(),
  }));

  // Resolve columns early (used to sanitize persisted state before initializing TanStack)
  const initialColumns: ColumnDef<T, unknown>[] =
    props.columns && props.columns.length > 0
      ? props.columns
      : (getDefaultColumns(
          props.tablePurpose,
          props.cellCallbacks
        ) as unknown as ColumnDef<T, unknown>[]);
  const allowedColumnIds = collectColumnIds(initialColumns);

  // Load persisted state
  const loadedState = loadTableState(stateKey());
  const initialState = sanitizeInitialTableState(
    mergeWithDefaults(loadedState, props.tablePurpose as any),
    allowedColumnIds
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
  const [columnPinning, setColumnPinning] = createSignal<ColumnPinningState>(
    initialState.columnPinning || { left: [], right: [] }
  );

  const [lastSelectionKey, setLastSelectionKey] = createSignal<string | null>(
    null
  );

  // Restore rowSelection when the storage key changes (user/repertoire/tab changes)
  createEffect(() => {
    const key = stateKey();
    const keySignature = `${key.userId}:${key.tablePurpose}:${key.repertoireId}`;
    if (keySignature === lastSelectionKey()) return;
    setLastSelectionKey(keySignature);

    const loaded = loadTableState(key);
    if (loaded?.rowSelection) {
      if (Object.keys(loaded.rowSelection).length > 0) {
        console.log(
          `[TunesGrid ${props.tablePurpose}] Restoring ${Object.keys(loaded.rowSelection).length} row selections from localStorage`
        );
      }
      setRowSelection(loaded.rowSelection);
    } else if (Object.keys(rowSelection()).length > 0) {
      setRowSelection({});
    }
  });

  // If parent provides a non-empty controlled visibility, adopt it; otherwise keep persisted/internal
  createEffect(() => {
    const v = props.columnVisibility;
    if (v && Object.keys(v).length > 0) {
      // Treat parent-provided visibility as a PATCH, not a full replacement.
      // Preserve existing hidden defaults unless parent explicitly overrides.
      // Use untrack to prevent circular dependency since parent syncs from child changes.
      setColumnVisibility((prev) => {
        const merged = { ...prev, ...v };
        // Only update if actually different to prevent infinite loop
        const prevKeys = Object.keys(prev).sort();
        const mergedKeys = Object.keys(merged).sort();
        if (
          prevKeys.length !== mergedKeys.length ||
          prevKeys.some((k, i) => k !== mergedKeys[i]) ||
          prevKeys.some((k) => prev[k] !== merged[k])
        ) {
          return merged;
        }
        return prev;
      });
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

  const filterVisibility = (
    vs: VisibilityState,
    allowed: ReadonlySet<string>
  ) => {
    const out: VisibilityState = {};
    for (const [key, val] of Object.entries(vs)) {
      if (allowed.has(key)) out[key] = val;
    }
    return out;
  };
  const filterSizing = (
    cs: ColumnSizingState,
    allowed: ReadonlySet<string>
  ) => {
    const out: ColumnSizingState = {};
    for (const [key, val] of Object.entries(cs)) {
      if (allowed.has(key)) out[key] = val;
    }
    return out;
  };
  const filterOrder = (
    order: ColumnOrderState,
    allowed: ReadonlySet<string>
  ) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of order) {
      if (!allowed.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  };
  const filterSorting = (s: SortingState, allowed: ReadonlySet<string>) => {
    return s.filter((x) => allowed.has(x.id));
  };

  // If the column set changes (rare), prune state to valid column IDs to avoid TanStack warnings.
  createEffect(() => {
    const allowed = collectColumnIds(resolvedColumns());
    setColumnVisibility((prev) => filterVisibility(prev, allowed));
    setColumnSizing((prev) => filterSizing(prev, allowed));
    setColumnOrder((prev) => filterOrder(prev, allowed));
    setSorting((prev) => filterSorting(prev, allowed));
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
      get columnPinning() {
        return columnPinning();
      },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    getRowId: (row) => String((row as any).id),
  });

  // Notify parent of table instance
  createEffect(() => {
    console.log("[TunesGrid] onTableReady called with table instance");
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
      columnPinning: columnPinning(),
      // Do not persist scrollTop here; handled by scroll persistence logic below
      scrollTop: loadedState?.scrollTop || 0,
    };
    saveTableState(stateKey(), state);
  });

  // Simple scroll restoration and persistence
  const scrollKey = createMemo<string | null>(() => {
    const uid = props.userId;
    if (!uid) return null;
    const repertoireId = activeRepertoireId();
    const suffix = repertoireId !== "0" ? `_${repertoireId}` : "";
    return `TT_${props.tablePurpose.toUpperCase()}_SCROLL_${uid}${suffix}`;
  });

  // When the scroll storage key changes (e.g., repertoire change), restore once
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

  // Reactive state for stabilization tracking
  const [targetScroll, setTargetScroll] = createSignal(0);
  const [isStabilizing, setIsStabilizing] = createSignal(false);
  const [lastRowCount, setLastRowCount] = createSignal(0);
  let stabilizeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Watch for row count changes at component level (proper reactive scope)
  createEffect(() => {
    const rowCount = table.getRowModel().rows.length;
    const previous = lastRowCount();

    if (rowCount !== previous && previous >= 0) {
      console.log(
        `[TunesGrid ${props.tablePurpose}] Row count changed: ${previous} → ${rowCount}`
      );
      setIsStabilizing(true);

      // Re-apply target scroll if we're supposed to be scrolled
      const target = targetScroll();
      if (target > 0 && containerRef) {
        containerRef.scrollTop = target;
        console.log(
          `[TunesGrid ${props.tablePurpose}] Re-applying target scroll: ${target}px`
        );
      }

      // Clear any existing stabilization timeout
      if (stabilizeTimeout) clearTimeout(stabilizeTimeout);

      // Mark as stable after 300ms of no changes
      stabilizeTimeout = setTimeout(() => {
        setIsStabilizing(false);
        console.log(
          `[TunesGrid ${props.tablePurpose}] Data stabilized at ${rowCount} rows`
        );
      }, 300);
    }

    setLastRowCount(rowCount);
  });

  onMount(() => {
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let cleanupScrollListener: (() => void) | null = null;

    const waitForContainer = () => {
      if (!containerRef) {
        requestAnimationFrame(waitForContainer);
        return;
      }
      if (containerRef.scrollHeight <= containerRef.clientHeight) {
        requestAnimationFrame(waitForContainer);
        return;
      }

      // Load target scroll from storage
      const key = scrollKey();
      const storedScroll = key
        ? Number.parseInt(localStorage.getItem(key) || "0", 10)
        : 0;
      setTargetScroll(storedScroll);
      setLastRowCount(table.getRowModel().rows.length);

      // Apply initial scroll - let row count effect handle stabilization
      if (storedScroll > 0) {
        setIsStabilizing(true); // Start in stabilizing mode
        containerRef.scrollTop = storedScroll;
        console.log(
          `[TunesGrid ${props.tablePurpose}] Applied initial scroll: ${storedScroll}px, entering stabilization mode`
        );
      }

      const handleScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);

        // During stabilization, if scroll is wrong, re-apply target instead of saving
        const target = targetScroll();
        const stabilizing = isStabilizing();

        if (stabilizing && containerRef && target > 0) {
          const currentScroll = containerRef.scrollTop;
          // If scroll is significantly below target (more than 10% off), re-apply
          if (currentScroll < target * 0.9) {
            console.log(
              `[TunesGrid ${props.tablePurpose}] Scroll during stabilization: ${currentScroll}px, re-applying ${target}px`
            );
            containerRef.scrollTop = target;
            return; // Don't save during stabilization
          }
        }

        scrollTimeout = setTimeout(() => {
          const key = scrollKey();
          if (containerRef && key && !isStabilizing()) {
            const scrollPos = containerRef.scrollTop;
            console.log(
              `[TunesGrid ${props.tablePurpose}] Saving scroll position: ${scrollPos}px`
            );
            localStorage.setItem(key, String(scrollPos));
            setTargetScroll(scrollPos); // Update target to current position
          }
        }, 150);
      };

      containerRef.addEventListener("scroll", handleScroll, { passive: true });

      // Store cleanup function to be called on component unmount
      cleanupScrollListener = () => {
        if (containerRef) {
          containerRef.removeEventListener("scroll", handleScroll);
        }
      };
    };

    // Register cleanup at onMount level (synchronous, in reactive scope)
    onCleanup(() => {
      if (cleanupScrollListener) cleanupScrollListener();
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (stabilizeTimeout) clearTimeout(stabilizeTimeout);
    });

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

  // Helpers for pinned column styling
  const getPinnedBorderClass = (column: Column<T, unknown>): string => {
    if (
      column.getIsPinned() === "left" &&
      column.getPinnedIndex() === table.getLeftLeafColumns().length - 1
    ) {
      return " border-r-2 border-blue-300 dark:border-blue-600";
    }
    if (column.getIsPinned() === "right" && column.getPinnedIndex() === 0) {
      return " border-l-2 border-blue-300 dark:border-blue-600";
    }
    return "";
  };

  const getPinnedHeaderStyle = (column: Column<T, unknown>, width: number) => {
    const isPinned = column.getIsPinned();
    if (!isPinned) return { width: `${width}px` };
    return {
      width: `${width}px`,
      position: "sticky" as const,
      ...(isPinned === "left"
        ? { left: `${column.getStart("left")}px` }
        : { right: `${column.getAfter("right")}px` }),
      "z-index": 20,
    };
  };

  const getPinnedCellStyle = (column: Column<T, unknown>, width: number) => {
    const isPinned = column.getIsPinned();
    if (!isPinned) return { width: `${width}px` };
    return {
      width: `${width}px`,
      position: "sticky" as const,
      ...(isPinned === "left"
        ? { left: `${column.getStart("left")}px` }
        : { right: `${column.getAfter("right")}px` }),
      "z-index": 1,
    };
  };

  return (
    <div class="h-full flex flex-col">
      {/* Table container with virtualization */}
      <div
        ref={(el) => {
          containerRef = el;
        }}
        class={`${CONTAINER_CLASSES} ${
          props.tablePurpose === "scheduled" ? "pb-16 scroll-pb-16" : ""
        }`}
        style={{ "touch-action": "pan-x pan-y" }}
      >
        <table
          data-testid={`tunes-grid-${props.tablePurpose}`}
          class={TABLE_CLASSES}
          style={{ width: `${table.getTotalSize()}px` }}
        >
          {/* Sticky header */}
          <thead class={HEADER_CLASSES}>
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => {
                      const headerLabelText =
                        typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : header.column.id;
                      const columnMeta = header.column.columnDef.meta as
                        | { description?: string }
                        | undefined;
                      const columnDescription =
                        props.columnDescriptions?.[header.column.id] ??
                        columnMeta?.description;
                      const canSort = () => header.column.getCanSort();
                      const sortState = () => header.column.getIsSorted();
                      const sortLabel = () =>
                        sortState() === "asc"
                          ? "Sorted ascending - click to sort descending"
                          : sortState() === "desc"
                            ? "Sorted descending - click to clear sort"
                            : "Not sorted - click to sort ascending";
                      const headerContent = flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      );

                      return (
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
                            }${header.column.getIsPinned() ? " bg-gray-100 dark:bg-gray-800" : ""}${getPinnedBorderClass(header.column)}`
                          )}
                          style={getPinnedHeaderStyle(
                            header.column,
                            header.getSize()
                          )}
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
                          <div class="flex items-center gap-1">
                            <div class="flex items-center gap-1 min-w-0 flex-1">
                              <Show
                                when={!!columnDescription}
                                fallback={
                                  <Show
                                    when={canSort()}
                                    fallback={
                                      <span class="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                                        {headerContent}
                                      </span>
                                    }
                                  >
                                    <button
                                      type="button"
                                      class="flex items-center gap-1 min-w-0 flex-1 text-left hover:text-blue-600 dark:hover:text-blue-400"
                                      aria-label={sortLabel()}
                                      title={sortLabel()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        header.column.toggleSorting();
                                      }}
                                    >
                                      <span class="min-w-0 flex-1 overflow-hidden">
                                        {headerContent}
                                      </span>
                                    </button>
                                  </Show>
                                }
                              >
                                <Popover
                                  open={openPopover() === header.column.id}
                                  onOpenChange={(isOpen) =>
                                    setOpenPopover(
                                      isOpen ? header.column.id : null
                                    )
                                  }
                                >
                                  <PopoverTrigger
                                    as="button"
                                    type="button"
                                    class="flex items-center gap-1 min-w-0 flex-1 text-left hover:text-blue-600 dark:hover:text-blue-400"
                                    aria-label={`About ${headerLabelText}`}
                                  >
                                    <span class="min-w-0 flex-1 overflow-hidden">
                                      {headerContent}
                                    </span>
                                    <span class="sr-only">
                                      {`About ${headerLabelText}`}
                                    </span>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    ref={(el: HTMLDivElement) => {
                                      popoverRef = el;
                                    }}
                                    onClick={(event: MouseEvent) =>
                                      event.stopPropagation()
                                    }
                                    data-testid={`column-info-${header.column.id}`}
                                  >
                                    {columnDescription}
                                  </PopoverContent>
                                </Popover>
                              </Show>
                            </div>
                            <Show when={canSort()}>
                              <button
                                type="button"
                                class="flex-shrink-0 inline-flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                                aria-label={sortLabel()}
                                title={sortLabel()}
                                data-testid={`column-sort-${header.column.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  header.column.toggleSorting();
                                }}
                              >
                                <span aria-hidden="true">
                                  {sortState() === "asc"
                                    ? "↑"
                                    : sortState() === "desc"
                                      ? "↓"
                                      : "↕"}
                                </span>
                                <span class="sr-only">{sortLabel()}</span>
                              </button>
                            </Show>
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
                                onClick={(event) => event.stopPropagation()}
                                class="cursor-grab active:cursor-grabbing flex-shrink-0 p-0.5 border-0 bg-transparent"
                                aria-label={`Drag to reorder ${headerLabelText} column`}
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
                                onClick={(event) => event.stopPropagation()}
                                class="resize-handle absolute top-0 right-0 w-4 h-full cursor-col-resize select-none touch-none group/resize bg-transparent border-0 p-0 z-10"
                                aria-label={`Resize ${header.id} column`}
                              >
                                <div class="absolute top-0 right-0 w-1 h-full bg-gray-300 dark:bg-gray-600 group-hover/resize:bg-blue-500 dark:group-hover/resize:bg-blue-400 group-hover/resize:w-1.5 transition-all pointer-events-none" />
                              </button>
                            </Show>
                          </div>
                        </th>
                      );
                    }}
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
                    class={
                      props.currentRowId === (row.original as any).id
                        ? "cursor-pointer transition-colors dark:bg-blue-900/25 bg-blue-50 hover:bg-blue-100 dark:hover:bg-gray-800/50 border-t-2 border-b-2 border-blue-200 dark:border-blue-600/25"
                        : ROW_CLASSES
                    }
                    onClick={() => props.onRowClick?.(row.original)}
                    onDblClick={() => props.onRowDoubleClick?.(row.original)}
                    data-index={virtualRow.index}
                  >
                    <For each={row.getVisibleCells()}>
                      {(cell) => (
                        <td
                          class={`${CELL_CLASSES}${cell.column.getIsPinned() ? " bg-white dark:bg-gray-900" : ""}${getPinnedBorderClass(cell.column)}`}
                          style={getPinnedCellStyle(
                            cell.column,
                            cell.column.getSize()
                          )}
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
