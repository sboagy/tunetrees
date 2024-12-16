import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  Row,
  RowSelectionState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import { updateCurrentTuneInDb, updateTableStateInDb } from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";
import { get_columns } from "./TuneColumns";
import { tableContext } from "./TunesTable";

export const getColorForEvaluation = (
  review_status: string | null,
  isTrigger = false,
): string => {
  switch (review_status) {
    case "blackout":
      return "bg-red-100 dark:bg-red-900";
    case "failed":
      return "bg-orange-100 dark:bg-orange-900";
    case "barely":
      return "bg-yellow-100 dark:bg-yellow-900";
    case "struggled":
      return "bg-blue-100 dark:bg-blue-900";
    case "trivial":
      return "bg-purple-100 dark:bg-purple-900";
    case "perfect":
      return "bg-green-100 dark:bg-green-900";
    default:
      if (isTrigger) {
        return "bg-slate-95 dark:bg-slate-800";
      }
      return "";
  }
};

type Props = {
  table: TanstackTable<ITuneOverview>;
  userId: number;
  playlistId: number;
  tablePurpose: TablePurpose;
};

const TunesGrid = ({ table, userId, playlistId, tablePurpose }: Props) => {
  const {
    currentTune,
    setCurrentTune,
    currentTablePurpose,
    setCurrentTablePurpose,
  } = useTune();
  const { setCurrentView } = useMainPaneView();
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // Invoke useEffect hook for the table state
  // useSaveTableState(table, userId, tablePurpose, playlistId);

  const tableBodyRef = useRef<HTMLDivElement>(null);

  const handleRowClick = useCallback(
    (row: Row<ITuneOverview>) => {
      const previousTune = currentTune;
      const newTune = row.original.id;

      const rowIndex = table
        .getRowModel()
        .rows.findIndex((row) => row.original.id === currentTune);

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
        if (tablePurpose === "practice") {
          console.log(
            `===> TunesGrid.tsx:100 ~ rowSelection, changing from: ${JSON.stringify(table.getState().rowSelection)}`,
          );
          const rowNumber = table
            .getRowModel()
            .rows.findIndex((row) => row.original.id === newTune);
          console.log(`Row number for newTune=${newTune} is ${rowNumber}`);
          const rowSelectionState: RowSelectionState = {
            [String(rowNumber)]: true, // use a Computed Property Name, horrible ECMAScript 2015 (ES6) syntax!
          };
          table.setRowSelection(rowSelectionState);
          const tableState = table.getState();
          tableState.rowSelection = rowSelectionState;
          console.log(
            `===> TunesGrid.tsx:113 ~ rowSelection, changing to: ${JSON.stringify(tableState.rowSelection)}`,
          );
          void updateTableStateInDb(
            userId,
            "full",
            tablePurpose,
            playlistId,
            tableState,
          );
        }
      }

      const rowIndexNew = table
        .getRowModel()
        .rows.findIndex((row) => row.original.id === newTune);

      console.log(
        `LF7 TunesGrid handleRowClick: currentTune=${currentTune} rowIndex=${rowIndex} newTune=${newTune} rowIndexNew=${rowIndexNew}`,
      );

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
      table,
      setCurrentTablePurpose,
      tablePurpose,
      userId,
      playlistId,
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
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ height: `${totalSize}px`, position: "relative" }}>
            <Table
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
                  <TableRow
                    key={headerGroup.id}
                    className="hide-scrollbar h-auto w-full flex flex-row overflow-clipped"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        // className="p-2 align-top"
                        style={{ width: header.column.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody
                style={{
                  display: "block",
                  position: "relative",
                  marginTop: "2px",
                  height: `${totalSize}px`, // Set the total height for the body
                }}
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
                      // className={`absolute h-16 cursor-pointer w-full ${
                      //   currentTune === row.original.id
                      //     ? "outline outline-2 outline-blue-500"
                      //     : ""
                      // } ${getColorForEvaluation(row.original.recall_eval || null)}`}
                      // className={`absolute h-16 cursor-pointer w-full ${getColorForEvaluation(row.original.recall_eval || null)}`}
                      className={`absolute cursor-pointer w-full ${
                        currentTune === row.original.id
                          ? "outline outline-2 outline-blue-500"
                          : ""
                      } ${getColorForEvaluation(row.original.recall_eval || null, false)}`}
                      onClick={handleRowClick.bind(null, row)}
                      onDoubleClick={() => handleRowDoubleClick(row)}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
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
          </div>
        </div>
        <Table className="hide-scrollbar ">
          <TableFooter className="sticky bottom-0 bg-white dark:bg-gray-800 z-10 hide-scrollbar">
            <TableRow id="tt-tunes-grid-footer">
              <TableCell
                colSpan={get_columns(userId, playlistId, tablePurpose).length}
                className="h-12"
              >
                <div className="flex-1 text-sm text-muted-foreground">
                  {table.getFilteredSelectedRowModel().rows.length} of{" "}
                  {table.getFilteredRowModel().rows.length} row(s) selected.
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
