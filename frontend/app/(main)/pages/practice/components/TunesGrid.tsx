"use client";

import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import type {
  Row,
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { get_columns } from "@/app/(main)/pages/practice/components/TuneColumns";
import type { TablePurpose, Tune } from "../types";
import { createOrUpdateTableState, getTableStateTable } from "../settings";
import "./TunesGrid.css";
import { useTune } from "./TuneContext";
import { useSaveTableState } from "./use-save-table-state";

export interface IScheduledTunesType {
  tunes: Tune[];
  userId: number;
  playlistId: number;
  tablePurpose: TablePurpose;
  globalFilter?: string;
}

export const tableContext = React.createContext<TanstackTable<Tune> | null>(
  null,
);

export const useTableContext = () => {
  const context = React.useContext(tableContext);
  // if (!context) {
  //   throw new Error("useTableContext must be used within a TableProvider");
  // }
  return context;
};

export const saveTableState = (
  table: TanstackTable<Tune>,
  userId: number,
  tablePurpose: TablePurpose,
  currentTuneId: number | null,
) => {
  const tableState: TableState = table.getState();

  createOrUpdateTableState(
    userId,
    "full",
    tablePurpose,
    tableState,
    currentTuneId,
  )
    .then((result) => {
      console.log(
        "saveTableState: result=",
        result ? "success" : "empty result",
      );
      return result;
    })
    .catch((error) => {
      console.error("Error calling server function:", error);
      throw error;
    });
};

export function TunesTable(
  {
    tunes,
    userId,
    playlistId,
    tablePurpose,
    globalFilter = "",
  }: IScheduledTunesType,
  selectionChangedCallback:
    | ((
        table: TanstackTable<Tune>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null = null,
  filterStringCallback?: (filter: string) => void,
): TanstackTable<Tune> {
  const { currentTune, setCurrentTune } = useTune();

  const [tableStateFromDb, setTableStateFromDb] =
    React.useState<TableState | null>(null);

  const [sorting, setSorting] = React.useState<SortingState>(
    tableStateFromDb ? tableStateFromDb.sorting : [],
  );
  const originalSetSortingRef = React.useRef(setSorting);

  React.useEffect(() => {
    // Interception logic here
    originalSetSortingRef.current = setSorting;
  }, []);

  // For the moment am not using columnFilters
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    tableStateFromDb ? tableStateFromDb.columnFilters : [],
  );
  const originalColumnFiltersRef = React.useRef(setColumnFilters);

  React.useEffect(() => {
    // Interception logic here
    originalColumnFiltersRef.current = setColumnFilters;
  }, []);

  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(
      tableStateFromDb
        ? tableStateFromDb.columnVisibility
        : {
            id: true,
            title: true,
            type: true,
            structure: true,
            mode: false,
            incipit: false,
            learned: false,
            practiced: true,
            quality: false,
            easiness: false,
            interval: false,
            repetitions: false,
            review_date: true,
            backup_practiced: false,
            external_ref: false,
            notes_private: true,
            notes_public: true,
            tags: false,
          },
    );

  const originalSetColumnVisibilityRef = React.useRef(setColumnVisibility);

  React.useEffect(() => {
    // Interception logic here
    originalSetColumnVisibilityRef.current = setColumnVisibility;
  }, []);

  const [rowSelection, setRowSelection] = React.useState(
    tableStateFromDb ? tableStateFromDb.rowSelection : {},
  );
  const originalSetRowSelectionRef = React.useRef(setRowSelection);

  React.useEffect(() => {
    // Interception logic here
    originalSetRowSelectionRef.current = setRowSelection;
  }, []);

  // const [pagination, setPaginationState] = React.useState<PaginationState>(
  //   tableStateFromDb
  //     ? tableStateFromDb.pagination
  //     : {
  //         pageIndex: 0,
  //         pageSize: 12, //optionally customize the initial pagination state.
  //       },
  // );
  // const originalSetPaginationState = React.useRef(setPaginationState);

  // React.useEffect(() => {
  //   // Interception logic here
  //   originalSetPaginationState.current = setPaginationState;
  // }, []);

  const columns = get_columns(userId, playlistId, tablePurpose);

  const table: TanstackTable<Tune> = useReactTable({
    data: tunes,
    columns: columns,
    // globalFilterFn: (
    //   value: string,
    //   row: string,
    //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //   meta: TableMeta<Tune>,
    // ): boolean => {
    //   const searchText = value.toLowerCase();
    //   const cellText = String(row).toLowerCase(); // Convert row to string
    //   return cellText.includes(searchText);
    // },
    globalFilterFn: "auto", // Use the built-in default filter
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    // getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      // pagination,
      globalFilter,
    },
  });

  React.useEffect(() => {
    const fetchTableState = async () => {
      try {
        const tableStateTable = await getTableStateTable(
          userId,
          "full",
          tablePurpose,
        );
        const tableStateFromDb = tableStateTable?.settings as TableState;
        if (tableStateFromDb) {
          setTableStateFromDb(tableStateFromDb);
          setCurrentTune(tableStateTable?.current_tune ?? null);
          // table.setPagination(tableStateFromDb.pagination);
          // const hardCodedPagination = {
          //   pageIndex: 0,
          //   pageSize: 12, //optionally customize the initial pagination state.
          // };
          // table.setPagination(hardCodedPagination);
          table.setRowSelection(tableStateFromDb.rowSelection);
          table.setColumnVisibility(tableStateFromDb.columnVisibility);
          table.setColumnFilters(tableStateFromDb.columnFilters);
          table.setSorting(tableStateFromDb.sorting);
          if (filterStringCallback) {
            filterStringCallback(tableStateFromDb.globalFilter);
          }
          table.resetPagination();
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    };

    void fetchTableState();
  }, [userId, tablePurpose, table, filterStringCallback, setCurrentTune]);

  // Intercept the state changes.  I should be able to do this in a more generic way
  // with just onStateChange, but I couldn't get that to work.  Maybe I'll try again later.
  // The functions below are just wrapping each of the change events, and then saving the
  // entire table state to the database.

  const interceptedRowSelectionChange = (
    newRowSelectionState:
      | RowSelectionState
      | ((state: RowSelectionState) => RowSelectionState),
  ): void => {
    const resolvedRowSelectionState: RowSelectionState =
      newRowSelectionState instanceof Function
        ? newRowSelectionState(rowSelection)
        : newRowSelectionState;

    originalSetRowSelectionRef.current(resolvedRowSelectionState);

    console.log(
      "=> interceptedRowSelectionChange - resolvedRowSelectionState: ",
      resolvedRowSelectionState,
    );
    saveTableState(table, userId, tablePurpose, currentTune);

    if (selectionChangedCallback) {
      selectionChangedCallback(table, resolvedRowSelectionState);
    }
  };

  const interceptedOnColumnFiltersChange = (
    newColumnFiltersState:
      | ColumnFiltersState
      | ((state: ColumnFiltersState) => ColumnFiltersState),
  ): void => {
    const resolvedColumnFiltersState: ColumnFiltersState =
      newColumnFiltersState instanceof Function
        ? newColumnFiltersState(columnFilters)
        : newColumnFiltersState;

    originalColumnFiltersRef.current(resolvedColumnFiltersState);
    console.log(
      `=> interceptedOnColumnFiltersChange - resolvedColumnFiltersState: ${JSON.stringify(resolvedColumnFiltersState)}`,
    );
    saveTableState(table, userId, tablePurpose, currentTune);
  };

  const interceptedSetSorting = (
    newSorting: SortingState | ((state: SortingState) => SortingState),
  ): void => {
    const resolvedSorting: SortingState =
      newSorting instanceof Function ? newSorting(sorting) : newSorting;

    originalSetSortingRef.current(resolvedSorting);
    // console.log(
    //   `=> interceptedSetSorting - resolvedSorting: ${JSON.stringify(newSorting)}`,
    // );
    saveTableState(table, userId, tablePurpose, currentTune);
  };

  const interceptedSetColumnVisibility = (
    newVisibilityState:
      | VisibilityState
      | ((state: VisibilityState) => VisibilityState),
  ): void => {
    const resolvedVisibilityState: VisibilityState =
      newVisibilityState instanceof Function
        ? newVisibilityState(columnVisibility)
        : newVisibilityState;

    originalSetColumnVisibilityRef.current(resolvedVisibilityState);
    console.log(
      `=> interceptedSetColumnVisibility - resolvedVisibilityState: ${JSON.stringify(resolvedVisibilityState)}`,
    );
    saveTableState(table, userId, tablePurpose, currentTune);
  };

  // const interceptedSetPagination = (
  //   newPaginationState:
  //     | PaginationState
  //     | ((state: PaginationState) => PaginationState),
  // ): void => {
  //   const resolvedPaginationState: PaginationState =
  //     newPaginationState instanceof Function
  //       ? newPaginationState(pagination)
  //       : newPaginationState;

  //   originalSetPaginationState.current(resolvedPaginationState);

  //   console.log(
  //     `=> interceptedSetPagination - resolvedPaginationState: ${JSON.stringify(resolvedPaginationState)}`,
  //   );
  //   saveTableState(
  //     table,
  //     user_id,
  //     table_purpose,
  //     getCurrentTune ? getCurrentTune() : -1,
  //   );
  // };

  table.setOptions((prev) => ({
    ...prev, //preserve any other options that we have set up above
    onSortingChange: interceptedSetSorting,
    onColumnFiltersChange: interceptedOnColumnFiltersChange,
    onRowSelectionChange: interceptedRowSelectionChange,
    onColumnVisibilityChange: interceptedSetColumnVisibility,
    // onPaginationChange: interceptedSetPagination,
  }));

  return table;
}

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
  const router = useRouter();
  const columns = get_columns(userId, playlistId, tablePurpose);
  const { currentTune, setCurrentTune } = useTune();

  useSaveTableState(table, userId, tablePurpose, currentTune);
  // const tableContainerRef = useCalculatePageSize(table, tablePurpose);

  const handleRowClick = (row: Row<Tune>) => {
    const tuneId = row.original.id;
    setCurrentTune(tuneId ?? null);
    console.log("handleRowClick: tuneId=", tuneId);
    saveTableState(table, userId, tablePurpose, tuneId ?? -1);
  };

  return (
    <>
      <tableContext.Provider value={table}>
        <Table
          className="table-auto w-full flex-grow flex flex-col"
          style={{
            minHeight: "calc(100vh - 270px)",
            maxHeight: "calc(100vh - 270px)",
          }} // Inline style for min-height and max-height
        >
          <TableHeader
            id="tt-tunes-grid-header"
            className="sticky top-0 bg-white dark:bg-gray-800 z-10"
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-auto">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="p-2 align-top">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="flex-grow overflow-y-scroll ">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`h-auto cursor-pointer ${
                    currentTune === row.original.id
                      ? "outline outline-2 outline-blue-500"
                      : ""
                  } ${getColorForEvaluation(row.original.recall_eval || null)}`}
                  onClick={() => handleRowClick(row)}
                  onDoubleClick={(event) => {
                    event.preventDefault(); // Prevent default double-click action
                    event.stopPropagation(); // Stop event bubbling
                    const tuneId = row.original.id;
                    saveTableState(table, userId, tablePurpose, currentTune);
                    console.log("double-click occurred: tuneId=", tuneId);
                    router.push(
                      `/pages/tune-edit?userId=${userId}&playlistId=${playlistId}&tuneId=${tuneId}`,
                    );
                  }}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="h-auto">
                <TableCell
                  colSpan={columns.length}
                  className="h-12 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter className="sticky bottom-0 bg-white dark:bg-gray-800 z-10">
            <TableRow id="tt-tunes-grid-footer">
              <TableCell colSpan={columns.length} className="h-12">
                <div className="flex-1 text-sm text-muted-foreground">
                  {table.getFilteredSelectedRowModel().rows.length} of{" "}
                  {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </tableContext.Provider>
    </>
  );
};

export default TunesGrid;
