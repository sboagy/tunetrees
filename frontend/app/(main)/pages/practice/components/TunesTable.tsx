"use client";

import type {
  RowSelectionState,
  TableState,
  Table as TanstackTable,
} from "@tanstack/react-table";
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { createOrUpdateTableState, getTableStateTable } from "../settings";
import type { TablePurpose, Tune } from "../types";
import { useTune } from "./CurrentTuneContext";
import { get_columns } from "./TuneColumns";

export interface IScheduledTunesType {
  tunes: Tune[];
  userId: number;
  playlistId: number;
  tablePurpose: TablePurpose;
  globalFilter?: string;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
}

export const tableContext = React.createContext<TanstackTable<Tune> | null>(
  null,
);

export const useTableContext = () => {
  const context = React.useContext(tableContext);
  return context;
};

export const saveTableState = async (
  table: TanstackTable<Tune>,
  userId: number,
  tablePurpose: TablePurpose,
  currentTuneId: number | null,
): Promise<number> => {
  console.log("LF1 saveTableState: input variables", {
    userId,
    tablePurpose,
    currentTuneId,
  });
  const tableState: TableState = table.getState();

  const status = await createOrUpdateTableState(
    userId,
    "full",
    tablePurpose,
    tableState,
    currentTuneId,
  );
  return status;
  // .then((result) => {
  //   console.log(
  //     "LF1 saveTableState: result=",
  //     result ? "success" : "empty result",
  //   );
  //   return result;
  // })
  // .catch((error) => {
  //   console.error("LF1 saveTableState Error calling server function:", error);
  //   throw error;
  // });
};

export function TunesTableComponent({
  tunes,
  userId,
  playlistId,
  tablePurpose,
  globalFilter = "",
  onRecallEvalChange,
  onTableCreated,
  selectionChangedCallback = null,
  filterStringCallback,
}: IScheduledTunesType & {
  onTableCreated: (table: TanstackTable<Tune>) => void;
  selectionChangedCallback?:
    | ((
        table: TanstackTable<Tune>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null;
  filterStringCallback?: (filter: string) => void;
}): null {
  const { currentTune, setCurrentTune } = useTune();

  const [tableStateFromDb, setTableStateFromDb] =
    React.useState<TableState | null>(null);

  const [sorting, setSorting] = React.useState<SortingState>(
    tableStateFromDb ? tableStateFromDb.sorting : [],
  );
  const originalSetSortingRef = React.useRef(setSorting);

  React.useEffect(() => {
    originalSetSortingRef.current = setSorting;
  }, []);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    tableStateFromDb ? tableStateFromDb.columnFilters : [],
  );
  const originalColumnFiltersRef = React.useRef(setColumnFilters);

  React.useEffect(() => {
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
            genre: false,
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
    originalSetColumnVisibilityRef.current = setColumnVisibility;
  }, []);

  const [rowSelection, setRowSelection] = React.useState(
    tableStateFromDb ? tableStateFromDb.rowSelection : {},
  );
  const originalSetRowSelectionRef = React.useRef(setRowSelection);

  React.useEffect(() => {
    originalSetRowSelectionRef.current = setRowSelection;
  }, []);

  const columns = get_columns(
    userId,
    playlistId,
    tablePurpose,
    onRecallEvalChange,
  );

  const table: TanstackTable<Tune> = useReactTable({
    data: tunes,
    columns: columns,
    globalFilterFn: "auto",
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
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
    void saveTableState(table, userId, tablePurpose, currentTune);

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
    void saveTableState(table, userId, tablePurpose, currentTune);
  };

  const interceptedSetSorting = (
    newSorting: SortingState | ((state: SortingState) => SortingState),
  ): void => {
    const resolvedSorting: SortingState =
      newSorting instanceof Function ? newSorting(sorting) : newSorting;

    originalSetSortingRef.current(resolvedSorting);
    void saveTableState(table, userId, tablePurpose, currentTune);
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
    void saveTableState(table, userId, tablePurpose, currentTune);
  };

  table.setOptions((prev) => ({
    ...prev,
    onSortingChange: interceptedSetSorting,
    onColumnFiltersChange: interceptedOnColumnFiltersChange,
    onRowSelectionChange: interceptedRowSelectionChange,
    onColumnVisibilityChange: interceptedSetColumnVisibility,
  }));

  React.useEffect(() => {
    onTableCreated(table);
  }, [table, onTableCreated]);

  return null;
}

// Create a hook to use the table
export function useTunesTable(
  props: IScheduledTunesType,
): [React.JSX.Element, TanstackTable<Tune> | null] {
  const [table, setTable] = React.useState<TanstackTable<Tune> | null>(null);

  const tableComponent = (
    <TunesTableComponent
      {...props}
      onTableCreated={(newTable) => {
        console.log("Table created/updated with", props.tunes.length, "tunes");
        setTable(newTable);
      }}
    />
  );

  return [tableComponent, table];
}
