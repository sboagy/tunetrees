import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Row, Table as TanstackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getColorForEvaluation } from "../quality-list";
import { updateCurrentTuneInDb } from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";
import { get_columns } from "./TuneColumns";
import { tableContext } from "./TunesTable";

type Props = {
  table: TanstackTable<ITuneOverview>;
  userId: number;
  playlistId: number;
  tablePurpose: TablePurpose;
  onRowClickCallback?: (newTune: number) => void;
  getStyleForSchedulingState?: (
    reviewDate: string | null,
  ) => string | undefined;
  lapsedCount?: number | null;
  currentCount?: number | null;
  futureCount?: number | null;
  newCount?: number | null;
};

const TunesGrid = ({
  table,
  userId,
  playlistId,
  tablePurpose,
  onRowClickCallback,
  getStyleForSchedulingState,
  lapsedCount,
  currentCount,
  futureCount,
  newCount,
}: Props) => {
  const {
    currentTune,
    setCurrentTune,
    currentTablePurpose,
    setCurrentTablePurpose,
  } = useTune();
  const { setCurrentView } = useMainPaneView();
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // Local tick to force re-render during active column resize without triggering data fetch
  const [, setResizeTick] = useState(0);
  // Local tick to force re-render when table state (e.g., sorting) changes
  const [tableStateTick, setTableStateTick] = useState(0);

  // Invoke useEffect hook for the table state
  // useSaveTableState(table, userId, tablePurpose, playlistId);

  const tableBodyRef = useRef<HTMLDivElement>(null);

  // Listen for explicit sorting change events to ensure the virtualizer resets consistently
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      console.warn("TunesGrid event tt-sorting-changed", detail);
      const el = tableBodyRef.current;
      if (el) el.scrollTop = 0;
      setTableStateTick((t) => t + 1);
    };
    window.addEventListener("tt-sorting-changed", handler as EventListener);
    return () => {
      window.removeEventListener(
        "tt-sorting-changed",
        handler as EventListener,
      );
    };
  }, []);

  // Subscribe to table state changes to trigger a lightweight re-render when sorting/order/filters update
  useEffect(() => {
    if (!table || typeof table.setOptions !== "function") return;

    // Preserve any existing onStateChange handler
    const previousOnStateChange = table.options.onStateChange;
    const prevSortingRef = {
      current: JSON.stringify(table.getState().sorting ?? []),
    };

    table.setOptions((opts) => ({
      ...opts,
      onStateChange: (updater) => {
        // Call through to any existing handler first
        if (previousOnStateChange) {
          previousOnStateChange(updater);
        }
        // If sorting changed, scroll to top to ensure viewport displays first rows in new order
        try {
          const curr = JSON.stringify(table.getState().sorting ?? []);
          if (curr !== prevSortingRef.current) {
            prevSortingRef.current = curr;
            // Debug visibility for tests: log sorting changes as a warning so Playwright captures it
            console.warn(`TunesGrid onStateChange sorting=${curr}`);
            // Scroll container to top; the test also does this, but keep UI consistent
            const el = tableBodyRef.current;
            if (el) el.scrollTop = 0;
          }
        } catch {
          // ignore
        }
        // Bump a tick to re-render this grid so virtual rows and headers reflect new state immediately
        setTableStateTick((t) => t + 1);
      },
    }));

    // Cleanup: restore previous handler to avoid stacking handlers across mounts
    return () => {
      try {
        table.setOptions((opts) => ({
          ...opts,
          onStateChange: previousOnStateChange,
        }));
      } catch {
        // no-op: table may be unmounted
      }
    };
  }, [table]);

  // DnD sensors for column drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const leafColumns = table.getVisibleLeafColumns();
  const columnIds = useMemo(() => leafColumns.map((c) => c.id), [leafColumns]);
  const [orderedColumnIds, setOrderedColumnIds] = useState<string[]>(columnIds);

  useEffect(() => {
    // Sync local state when table order changes elsewhere
    setOrderedColumnIds(columnIds);
  }, [columnIds]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedColumnIds.indexOf(String(active.id));
    const newIndex = orderedColumnIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(orderedColumnIds, oldIndex, newIndex);
    setOrderedColumnIds(newOrder);
    table.setColumnOrder(newOrder);
  };

  // Wrap TanStack resize handler to force lightweight re-renders during drag
  const makeEnhancedResizeHandler = (handler: (e: unknown) => void) => {
    return (e: React.MouseEvent | React.TouchEvent) => {
      handler(e);
      const onMove = () => setResizeTick((t) => t + 1);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener(
          "touchmove",
          onMove as unknown as EventListener,
        );
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchend", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("touchmove", onMove as unknown as EventListener, {
        passive: true,
      });
      window.addEventListener("mouseup", onUp, { once: true });
      window.addEventListener("touchend", onUp, { once: true });
    };
  };

  function SortableHeader({
    columnId,
    children,
  }: {
    columnId: string;
    children: React.ReactNode;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: columnId });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.6 : 1,
    } as React.CSSProperties;
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2"
        {...attributes}
        {...listeners}
      >
        <div className="flex-1 min-w-0 select-none cursor-grab active:cursor-grabbing">
          {children}
        </div>
      </div>
    );
  }

  const handleRowClick = useCallback(
    (row: Row<ITuneOverview>) => {
      const previousTune = currentTune;
      const newTune = row.original.id;

      if (newTune) {
        console.log(`LF7 TunesGrid handleRowClick: newTune=${newTune}`);
        setCurrentTune(newTune);
        setCurrentTablePurpose(tablePurpose); // probably not actually needed
        console.log(
          `LF7 TunesGrid handleRowClick calling updateCurrentTuneInDb: tablePurpose=${tablePurpose} newTune=${newTune}`,
        );

        void updateCurrentTuneInDb(
          userId,
          "full",
          tablePurpose,
          playlistId,
          newTune,
        );

        // TODO: This is a hack to get the row selection to work in
        // practice mode, but this code should be refactored into
        // TunesGridScheduled.tsx.
        if (onRowClickCallback) {
          onRowClickCallback(newTune);
        }
      }

      // Update styles of the previously selected row
      if (previousTune && rowRefs.current[previousTune]) {
        rowRefs.current[previousTune].classList.remove(
          "outline",
          "outline-2",
          "outline-blue-500",
        );
      }

      if (newTune && rowRefs.current[newTune]) {
        // Update styles of the newly selected row
        rowRefs.current[newTune].classList.add(
          "outline",
          "outline-2",
          "outline-blue-500",
        );
      }
    },
    [
      currentTune,
      setCurrentTune,
      setCurrentTablePurpose,
      tablePurpose,
      userId,
      playlistId,
      onRowClickCallback,
    ],
  );

  const handleRowDoubleClick = (row: Row<ITuneOverview>) => {
    console.log(
      "handleRowDoubleClick (current tune should already be set): tuneId=",
      row.original.id,
    );
    setCurrentView("edit");
  };

  const rowVirtualizer: Virtualizer<HTMLDivElement, HTMLTableRowElement> =
    useVirtualizer({
      count: table.getRowModel().rows.length,
      getScrollElement: () => tableBodyRef.current,
      estimateSize: () => 73, // Adjust based on your row height
      overscan: 10,
      enabled: true,
      debug: false,
      useScrollendEvent: true,
    });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // When sorting changes (detected via options.onStateChange above), also ensure virtualizer shows top
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally depend on tableStateTick to re-run after sort state changes
  useEffect(() => {
    // small debounce via requestAnimationFrame to let layout settle
    let id = 0;
    try {
      id = requestAnimationFrame(() =>
        rowVirtualizer.scrollToIndex(0, { align: "start" }),
      );
    } catch {
      // ignore
    }
    return () => {
      if (id) cancelAnimationFrame(id);
    };
  }, [tableStateTick, rowVirtualizer]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Only need or want this to execute if current tune changes.
  useEffect(() => {
    if (currentTablePurpose !== tablePurpose) {
      return;
    }

    const numberOfAttempts = 6;

    const scrollToTune = (attempt = 0) => {
      if (attempt >= numberOfAttempts) {
        console.log(
          `Failed to find row for currentTune=${currentTune} after ${numberOfAttempts} attempts`,
        );
        return;
      }

      console.log(
        `useEffect ===> TunesGrid.tsx:170 ~ in scrollToTune currentTablePurpose: ${currentTablePurpose}, currentTune: ${currentTune}`,
      );

      const rowIndex = table
        .getRowModel()
        .rows.findIndex((row) => row.original.id === currentTune);

      if (rowIndex !== -1 && currentTune !== null) {
        rowVirtualizer.scrollToIndex(rowIndex, { align: "center" });

        if (rowRefs.current[currentTune]) {
          rowRefs.current[currentTune].scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      } else {
        setTimeout(() => scrollToTune(attempt + 1), 20 + attempt * 100);
      }
    };

    if (currentTune && rowRefs.current[currentTune]) {
      // Row is already in view, no need to scroll
    } else if (currentTune) {
      scrollToTune();
    }
  }, [currentTune, currentTablePurpose, table, rowVirtualizer]);

  useEffect(() => {
    function scrollToTuneById(tuneId: number, attempt = 0) {
      const numberOfAttempts = 6;
      if (attempt >= numberOfAttempts) {
        console.log(
          `scrollToTuneById: Failed to find row for tuneId=${tuneId} after ${numberOfAttempts} attempts`,
        );
        return;
      }
      const rowIndex = table
        .getRowModel()
        .rows.findIndex((row) => row.original.id === tuneId);

      if (rowIndex !== -1 && tuneId !== null) {
        rowVirtualizer.scrollToIndex(rowIndex, { align: "center" });

        if (rowRefs.current[tuneId]) {
          rowRefs.current[tuneId].scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      } else {
        setTimeout(
          () => scrollToTuneById(tuneId, attempt + 1),
          20 + attempt * 100,
        );
      }
    }

    // Attach to window for external usage
    window.scrollToTuneById = scrollToTuneById;

    // Cleanup on unmount
    return () => {
      window.scrollToTuneById = undefined;
    };
  }, [table, rowVirtualizer]);

  return (
    <tableContext.Provider value={table}>
      <div
        className="w-full h-full flex flex-col"
        style={{
          minHeight: "calc(104vh - 270px)",
          maxHeight: "calc(104vh - 270px)",
        }}
      >
        <div
          ref={tableBodyRef}
          className="flex-grow overflow-y-auto"
          style={{
            minHeight: "calc(104vh - 270px - 50x)",
            maxHeight: "calc(104vh - 270px - 50px)",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
          data-testid="tunes-grid-scroll-container"
        >
          <div style={{ height: `${totalSize}px`, position: "relative" }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table
                data-testid="tunes-grid"
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <TableHeader
                  id="tt-tunes-grid-header"
                  className="sticky block top-0 bg-white dark:bg-gray-800 z-10"
                >
                  {table.getHeaderGroups().map((headerGroup) => (
                    <SortableContext
                      key={headerGroup.id}
                      items={orderedColumnIds}
                      strategy={horizontalListSortingStrategy}
                    >
                      <TableRow className="hide-scrollbar h-auto w-full flex flex-row overflow-clipped">
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            style={{
                              width: header.column.getSize(),
                              position: "relative",
                              userSelect: header.column.getIsResizing()
                                ? "none"
                                : undefined,
                            }}
                          >
                            {header.isPlaceholder ? null : (
                              <SortableHeader columnId={header.column.id}>
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                              </SortableHeader>
                            )}
                            {/* Resizer */}
                            {header.column.getCanResize() && (
                              <div
                                onMouseDown={makeEnhancedResizeHandler(
                                  header.getResizeHandler(),
                                )}
                                onTouchStart={makeEnhancedResizeHandler(
                                  header.getResizeHandler(),
                                )}
                                className={`absolute top-0 right-0 h-full w-1 cursor-col-resize select-none bg-transparent ${header.column.getIsResizing() ? "bg-blue-400" : "hover:bg-gray-300 dark:hover:bg-gray-600"}`}
                                data-testid={`col-${header.column.id}-resize-handle`}
                              />
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </SortableContext>
                  ))}
                </TableHeader>
                <TableBody
                  style={{
                    display: "block",
                    position: "relative",
                    marginTop: "2px",
                    height: `${totalSize}px`, // Set the total height for the body
                  }}
                  data-testid="tunes-grid-body"
                >
                  {virtualRows.map((virtualRow: VirtualItem) => {
                    const row = table.getRowModel().rows[virtualRow.index];
                    return (
                      <TableRow
                        key={row.id}
                        ref={(el) => {
                          if (row.original.id !== undefined) {
                            rowRefs.current[row.original.id] = el;
                          }
                        }}
                        style={{
                          top: `${virtualRow.start - 1}px`, // Position the row based on virtual start
                          height: `${virtualRow.size}px`, // Set the height of the row
                        }}
                        data-row-id={row.original.id}
                        // className={`absolute h-16 cursor-pointer w-full ${
                        //   currentTune === row.original.id
                        //     ? "outline outline-2 outline-blue-500"
                        //     : ""
                        // } ${getColorForEvaluation(row.original.recall_eval || null)}`}
                        // className={`absolute h-16 cursor-pointer w-full ${getColorForEvaluation(row.original.recall_eval || null)}`}
                        className={`absolute cursor-pointer w-full 
                        ${getStyleForSchedulingState ? getStyleForSchedulingState(row.original.scheduled || row.original.latest_review_date) : ""} 
                        ${
                          currentTune === row.original.id
                            ? "outline outline-blue-500"
                            : ""
                        } ${getColorForEvaluation(row.original.recall_eval || null, false)}`}
                        onClick={handleRowClick.bind(null, row)}
                        onDoubleClick={() => handleRowDoubleClick(row)}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            data-testid={`${cell.id}`}
                            data-col-id={cell.column.id}
                            style={{
                              position: "absolute",
                              top: "50%",
                              transform: "translateY(-50%)",
                              left: `${cell.column.getStart()}px`,
                              width: cell.column.getSize(),
                              // backgroundColor: "inherit",
                            }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </div>
        <Table className="hide-scrollbar ">
          <TableFooter className="sticky bottom-0 bg-white dark:bg-gray-800 z-10 hide-scrollbar">
            <TableRow id="tt-tunes-grid-footer">
              <TableCell
                colSpan={get_columns(userId, playlistId, tablePurpose).length}
                className="h-12"
              >
                <div
                  className="flex-1 text-sm text-muted-foreground"
                  data-testid="tt-table-status"
                >
                  {table.getFilteredSelectedRowModel().rows.length} of{" "}
                  {table.getFilteredRowModel().rows.length} row(s) selected.
                  {lapsedCount !== undefined && `, lapsed: ${lapsedCount}`}
                  {currentCount !== undefined && `, current: ${currentCount}`}
                  {futureCount !== undefined && `, future: ${futureCount}`}
                  {newCount !== undefined && `, new: ${newCount}`}
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </tableContext.Provider>
  );
};

export default TunesGrid;
