"use client";

import { get_columns } from "@/app/(main)/pages/practice/components/TuneColumns";
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
    onRecallEvalChange,
  }: IScheduledTunesType,
  selectionChangedCallback:
    | ((
        table: TanstackTable<Tune>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null = null,
  filterStringCallback?: (filter: string) => void,
): TanstackTable<Tune> {
  console.log(
    `LF4: ScheduledTunesGrid, creating scheduled TunesTable for ${tablePurpose}`,
  );

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

  table.setOptions((prev) => ({
    ...prev,
    onSortingChange: interceptedSetSorting,
    onColumnFiltersChange: interceptedOnColumnFiltersChange,
    onRowSelectionChange: interceptedRowSelectionChange,
    onColumnVisibilityChange: interceptedSetColumnVisibility,
  }));

  return table;
}
