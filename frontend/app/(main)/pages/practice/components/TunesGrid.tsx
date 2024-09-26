"use client";

import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import type {
  PaginationState,
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { get_columns } from "@/app/(main)/pages/practice/components/TuneColumns";
import type { TablePurpose, Tune } from "../types";
import { createOrUpdateTableState, getTableState } from "../settings";

export interface IScheduledTunesType {
  tunes: Tune[];
  user_id: string;
  playlist_id: string;
  table_purpose: TablePurpose;
  // setRecentlyPracticedCallback?: (tunes: Tune[]) => void;
  handleFilterChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

export function TunesTable(
  { tunes, user_id, playlist_id, table_purpose }: IScheduledTunesType,
  selectionChangedCallback:
    | ((
        table: TanstackTable<Tune>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null = null,
) {
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

  const [pagination, setPaginationState] = React.useState<PaginationState>(
    tableStateFromDb
      ? tableStateFromDb.pagination
      : {
          pageIndex: 0,
          pageSize: 15, //optionally customize the initial pagination state.
        },
  );
  const originalSetPaginationState = React.useRef(setPaginationState);

  React.useEffect(() => {
    // Interception logic here
    originalSetPaginationState.current = setPaginationState;
  }, []);

  const columns = get_columns(
    Number.parseInt(user_id),
    Number.parseInt(playlist_id),
    table_purpose,
  );

  const table: TanstackTable<Tune> = useReactTable({
    data: tunes,
    columns: columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      pagination,
    },
  });

  React.useEffect(() => {
    const fetchTableState = async () => {
      try {
        const userIdInt = Number.parseInt(user_id);
        const tableStateFromDb = await getTableState(
          userIdInt,
          "full",
          table_purpose,
        );
        if (tableStateFromDb) {
          setTableStateFromDb(tableStateFromDb);
          table.setPagination(tableStateFromDb.pagination);
          table.setRowSelection(tableStateFromDb.rowSelection);
          table.setColumnVisibility(tableStateFromDb.columnVisibility);
          table.setColumnFilters(tableStateFromDb.columnFilters);
          table.setSorting(tableStateFromDb.sorting);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    };

    void fetchTableState();
  }, [user_id, table_purpose, table]);

  const saveTableState = async (
    table: TanstackTable<Tune>,
    user_id: string,
    table_purpose: TablePurpose,
  ) => {
    const tableState: TableState = table.getState();

    try {
      const response = await createOrUpdateTableState(
        Number.parseInt(user_id),
        "full",
        table_purpose,
        tableState,
      );
      // Handle the response as needed
      console.log("Server response:", response);
    } catch (error) {
      console.error("Error calling server function:", error);
    } finally {
      // setIsLoading(false);
    }
  };

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

    void saveTableState(table, user_id, table_purpose);
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

    void saveTableState(table, user_id, table_purpose);
  };

  const interceptedSetSorting = (
    newSorting: SortingState | ((state: SortingState) => SortingState),
  ): void => {
    const resolvedSorting: SortingState =
      newSorting instanceof Function ? newSorting(sorting) : newSorting;

    originalSetSortingRef.current(resolvedSorting);

    void saveTableState(table, user_id, table_purpose);
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

    void saveTableState(table, user_id, table_purpose);
  };

  const interceptedSetPagination = (
    newPaginationState:
      | PaginationState
      | ((state: PaginationState) => PaginationState),
  ): void => {
    const resolvedPaginationState: PaginationState =
      newPaginationState instanceof Function
        ? newPaginationState(pagination)
        : newPaginationState;

    originalSetPaginationState.current(resolvedPaginationState);

    void saveTableState(table, user_id, table_purpose);
  };

  table.setOptions((prev) => ({
    ...prev, //preserve any other options that we have set up above
    onSortingChange: interceptedSetSorting,
    onColumnFiltersChange: interceptedOnColumnFiltersChange,
    onRowSelectionChange: interceptedRowSelectionChange,
    onColumnVisibilityChange: interceptedSetColumnVisibility,
    onPaginationChange: interceptedSetPagination,
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
  purpose: TablePurpose;
};

const TunesGrid = (props: Props) => {
  const table = props.table;
  const columns = get_columns(props.userId, props.playlistId, props.purpose);

  return (
    <>
      <div className="rounded-md border">
        <tableContext.Provider value={table}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
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
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={`${getColorForEvaluation(row.original.recall_eval || null)}`}
                    // className="hover:bg-gray-100"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="max-h-1 py-0">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-12 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </tableContext.Provider>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      </div>
    </>
  );
};

export default TunesGrid;
