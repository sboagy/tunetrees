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
import { useCallback, useRef } from "react";
import type { TablePurpose, Tune } from "../types";
import { useTune } from "./CurrentTuneContext";
import { useMainPaneView } from "./MainPaneViewContext";
import { get_columns } from "./TuneColumns";
import { tableContext } from "./TunesTable";
import { useSaveTableState } from "./use-save-table-state";

export const getColorForEvaluation = (review_status: string | null): string => {
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
      return "";
  }
};

type Props = {
  table: TanstackTable<Tune>;
  userId: number;
  playlistId: number;
  tablePurpose: TablePurpose;
};

const TunesGrid = ({ table, userId, playlistId, tablePurpose }: Props) => {
  const { currentTune, setCurrentTune } = useTune();
  const { setCurrentView } = useMainPaneView();
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // Invoke useEffect hook for the table state
  useSaveTableState(table, userId, tablePurpose, currentTune);

  const tableBodyRef = useRef<HTMLDivElement>(null);

  // const handleRowClick = useCallback(
  //   (row: Row<Tune>) => {
  //     const tuneId = row.original.id;
  //     setCurrentTune(tuneId ?? null);
  //     console.log("handleRowClick: tuneId=", tuneId);
  //     saveTableState(table, userId, tablePurpose, tuneId ?? -1);
  //   },
  //   [setCurrentTune, table, userId, tablePurpose],
  // );
  const handleRowClick = useCallback(
    (row: Row<Tune>) => {
      const previousTune = currentTune;
      const newTune = row.original.id;

      if (newTune) setCurrentTune(newTune);

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
    [currentTune, setCurrentTune],
  );

  const handleRowDoubleClick = (row: Row<Tune>) => {
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

  return (
    <tableContext.Provider value={table}>
      <div
        className="w-full h-full flex flex-col"
        style={{
          minHeight: "calc(100vh - 270px)",
          maxHeight: "calc(100vh - 270px)",
        }}
      >
        <Table>
          <TableHeader
            id="tt-tunes-grid-header"
            className="block top-0 bg-white dark:bg-gray-800 z-10 hide-scrollbar"
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="h-auto w-full flex flex-row"
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
        </Table>
        <div
          ref={tableBodyRef}
          className="flex-grow overflow-y-auto"
          style={{
            minHeight: "calc(100vh - 270px - 100px)", // Adjust for header/footer
            maxHeight: "calc(100vh - 270px - 100px)", // Adjust for header/footer
          }}
        >
          <div style={{ height: `${totalSize}px`, position: "relative" }}>
            <Table
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <TableBody
                style={{
                  display: "block",
                  position: "relative",
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
                        top: `${virtualRow.start + 3}px`, // Position the row based on virtual start
                      }}
                      // className={`absolute h-16 cursor-pointer w-full ${
                      //   currentTune === row.original.id
                      //     ? "outline outline-2 outline-blue-500"
                      //     : ""
                      // } ${getColorForEvaluation(row.original.recall_eval || null)}`}
                      // className={`absolute h-16 cursor-pointer w-full ${getColorForEvaluation(row.original.recall_eval || null)}`}
                      className={`absolute h-16 cursor-pointer w-full ${
                        currentTune === row.original.id
                          ? "outline outline-2 outline-blue-500"
                          : ""
                      } ${getColorForEvaluation(row.original.recall_eval || null)}`}
                      onClick={handleRowClick.bind(null, row)}
                      onDoubleClick={() => handleRowDoubleClick(row)}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            position: "absolute",
                            top: "0px",
                            left: `${cell.column.getStart()}px`,
                            width: cell.column.getSize(),
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
        <Table>
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
