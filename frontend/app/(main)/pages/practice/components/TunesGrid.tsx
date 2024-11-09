"use client";

import { useRouter } from "next/navigation";

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
  Row,
  RowModel,
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
import { createOrUpdateTableState, getTableStateTable } from "../settings";
import "./TunesGrid.css";

export interface IScheduledTunesType {
  tunes: Tune[];
  user_id: string;
  playlist_id: string;
  table_purpose: TablePurpose;
  globalFilter?: string;
  refreshData: () => Promise<{
    scheduledData: Tune[];
    repertoireData: Tune[];
  }>;
  // Per these current tune states,
  // see "Important Note (1)" in app/(main)/pages/practice/components/MainPanel.tsx
  mainPanelCurrentTune: number | null;
  setMainPanelCurrentTune: (tuneId: number | null) => void;
  getCurrentTune?: () => number | null;
  // setRecentlyPracticedCallback?: (tunes: Tune[]) => void;
  // handleFilterChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

const saveTableState = (
  table: TanstackTable<Tune>,
  user_id: string,
  table_purpose: TablePurpose,
  currentTuneId: number | null,
) => {
  const tableState: TableState = table.getState();

  createOrUpdateTableState(
    Number.parseInt(user_id),
    "full",
    table_purpose,
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
    user_id,
    playlist_id,
    table_purpose,
    globalFilter = "",
    getCurrentTune,
    // setCurrentTune,
  }: IScheduledTunesType,
  selectionChangedCallback:
    | ((
        table: TanstackTable<Tune>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null = null,
  filterStringCallback?: (filter: string) => void,
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

  const columns = get_columns(
    Number.parseInt(user_id),
    Number.parseInt(playlist_id),
    table_purpose,
  );

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
      // pagination,
      globalFilter,
    },
  });

  React.useEffect(() => {
    const fetchTableState = async () => {
      try {
        const userIdInt = Number.parseInt(user_id);
        const tableStateTable = await getTableStateTable(
          userIdInt,
          "full",
          table_purpose,
        );
        const tableStateFromDb = tableStateTable?.settings as TableState;
        if (tableStateFromDb) {
          setTableStateFromDb(tableStateFromDb);
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
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    };

    void fetchTableState();
  }, [user_id, table_purpose, table, filterStringCallback]);

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
    saveTableState(
      table,
      user_id,
      table_purpose,
      getCurrentTune ? getCurrentTune() : -1,
    );

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
    saveTableState(
      table,
      user_id,
      table_purpose,
      getCurrentTune ? getCurrentTune() : -1,
    );
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
    saveTableState(
      table,
      user_id,
      table_purpose,
      getCurrentTune ? getCurrentTune() : -1,
    );
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
    saveTableState(
      table,
      user_id,
      table_purpose,
      getCurrentTune ? getCurrentTune() : -1,
    );
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
  purpose: TablePurpose;
  globalFilter?: string;
  setMainPanelCurrentTune: (tuneId: number | null) => void;
  getCurrentTune: () => number | null;
  setCurrentTune: (tuneId: number) => void;
  refreshData: () => Promise<{
    scheduledData: Tune[];
    repertoireData: Tune[];
  }>;
};

const TunesGrid = (props: Props) => {
  const router = useRouter();
  const table = props.table;
  const columns = get_columns(props.userId, props.playlistId, props.purpose);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const calculatePageSize = () => {
      getTableStateTable(props.userId, "full", props.purpose)
        .then((tableStateTable) => {
          const tableStateFromDb = tableStateTable?.settings as TableState;
          if (tableContainerRef.current) {
            const windowHeight = window.innerHeight;
            const mainContentHeight =
              document.querySelector("#main-content")?.clientHeight || 0;
            const headerHeight =
              document.querySelector("header")?.clientHeight || 0;
            const footerHeight =
              document.querySelector("footer")?.clientHeight || 0;
            const ttTabsHeight =
              document.querySelector("#tt-tabs")?.clientHeight || 0;
            const ttTunesGridHeader =
              document.querySelector("#tt-tunes-grid-header")?.clientHeight ||
              0;
            const ttTunesGridFooter =
              document.querySelector("#tt-tunes-grid-footer")?.clientHeight ||
              0;

            const ttToolbarSelector =
              props.purpose === "practice"
                ? "#tt-scheduled-tunes-header"
                : "#tt-repertoire-tunes-header";

            const ttGridToolbarHeight =
              document.querySelector(ttToolbarSelector)?.clientHeight || 0;

            console.log("windowHeight:", windowHeight);

            console.log("mainContentHeight:", mainContentHeight);
            console.log("headerHeight:", headerHeight);
            console.log("ttGridToolbarHeight:", ttGridToolbarHeight);
            console.log("footerHeight:", footerHeight);
            console.log("ttTabsHeight:", ttTabsHeight);
            console.log("ttTunesGridHeader:", ttTunesGridHeader);
            console.log("ttTunesGridFooter:", ttTunesGridFooter);

            const containerHeight =
              mainContentHeight -
              ttTabsHeight -
              ttTunesGridHeader -
              ttGridToolbarHeight -
              ttTunesGridFooter;
            // const containerHeight = tableContainerRef.current.clientHeight;

            console.log("containerHeight:", containerHeight);

            const rows = tableContainerRef.current.querySelectorAll("tr"); // Adjust the selector as needed
            console.log("rows.length:", rows.length);

            let totalRowHeight = 0;
            for (const row of rows) {
              totalRowHeight += row.clientHeight;
            }
            const averageRowHeight = totalRowHeight / rows.length;
            console.log("averageRowHeight:", averageRowHeight);

            let calculatedPageSize = Math.floor(
              containerHeight / averageRowHeight,
            );
            console.log("original calculatedPageSize:", calculatedPageSize);
            if (calculatedPageSize * averageRowHeight > containerHeight) {
              calculatedPageSize -= 1;
            }
            console.log("adjusted calculatedPageSize:", calculatedPageSize);
            table.setPagination({
              ...tableStateFromDb.pagination,
              pageSize: calculatedPageSize,
            });

            saveTableState(
              table,
              props.userId.toString(),
              props.purpose,
              props.getCurrentTune(),
            );

            // Force the table to recalculate its rows
            console.log("Forcing the table to recalculate its rows");
            const rowModel: RowModel<Tune> = table.getRowModel();
            console.log("rowModel.rows.length:", rowModel.rows.length);
          }
        })
        .catch((error) => {
          console.error("Error calling server function:", error);
        });
    };

    // Calculate page size on initial render
    calculatePageSize();

    // Debounce resize event
    const debounce = <T extends (...args: unknown[]) => void>(
      func: T,
      wait: number,
    ) => {
      let timeout: ReturnType<typeof setTimeout>;
      return (...args: Parameters<T>): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
      };
    };

    const handleResize = debounce(calculatePageSize, 200);

    // Recalculate page size on window resize
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    } else {
      return () => console.log("window is undefined");
    }
  }, [table, props.userId, props.purpose, props.getCurrentTune]);

  const handleRowClick = (row: Row<Tune>) => {
    const tuneId = row.original.id;
    props.setMainPanelCurrentTune(tuneId ?? null);
    props.setCurrentTune(tuneId || 0);
    console.log("handleRowClick: tuneId=", tuneId);
    saveTableState(table, props.userId.toString(), props.purpose, tuneId ?? -1);
  };

  React.useEffect(() => {
    console.log(
      `**** TunesGrid useEffect userId: ${props.userId} purpose: ${props.purpose}`,
    );
    getTableStateTable(props.userId, "full", props.purpose)
      .then((tableStateTable) => {
        const currentTuneId = tableStateTable?.current_tune as number;
        if (currentTuneId === 0 || currentTuneId === null) {
          console.log("****-> TunesGrid useEffect setCurrentTune: 0 or null");
          props.setMainPanelCurrentTune(null);
        } else {
          console.log(
            `****-> TunesGrid useEffect setCurrentTune: ${currentTuneId}`,
          );
          props.setCurrentTune(currentTuneId);
          props.setMainPanelCurrentTune(currentTuneId);
        }
      })
      .catch((error) => {
        console.error("Error calling server function:", error);
      });
  }, [
    props.userId,
    props.purpose,
    props.setCurrentTune,
    props.setMainPanelCurrentTune,
  ]);

  return (
    <>
      <div
        className="rounded-md border table-container flex-grow"
        ref={tableContainerRef}
        style={{ height: "100%", overflowY: "auto" }}
      >
        <tableContext.Provider value={table}>
          <Table className="table-auto w-full">
            <TableHeader id="tt-tunes-grid-header">
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
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={`h-auto cursor-pointer ${
                      props.getCurrentTune() === row.original.id
                        ? "outline outline-2 outline-blue-500"
                        : ""
                    } ${getColorForEvaluation(row.original.recall_eval || null)}`}
                    onClick={() => handleRowClick(row)}
                    onDoubleClick={(event) => {
                      event.preventDefault(); // Prevent default double-click action
                      event.stopPropagation(); // Stop event bubbling
                      const userId = props.userId;
                      const playlistId = props.playlistId;
                      const tuneId = row.original.id;
                      saveTableState(
                        table,
                        userId.toString(),
                        props.purpose,
                        props.getCurrentTune(),
                      );
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
          </Table>
        </tableContext.Provider>
      </div>
      <div
        className="flex items-center justify-end space-x-2 py-4"
        id="tt-tunes-grid-footer"
      >
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      </div>
    </>
  );
};

export default TunesGrid;
