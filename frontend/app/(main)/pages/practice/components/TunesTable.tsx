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
import {
  createOrUpdateTableState,
  getTableStateTable,
  updateTableStateInDb,
} from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import { useTune } from "./CurrentTuneContext";
import { get_columns } from "./TuneColumns";

export interface IScheduledTunesType {
  tunes: ITuneOverview[];
  userId: number;
  tablePurpose: TablePurpose;
  globalFilter?: string;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
  onTableCreated?: (table: TanstackTable<ITuneOverview>) => void;
  selectionChangedCallback?:
    | ((
        table: TanstackTable<ITuneOverview>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null;
  filterStringCallback?: (filter: string) => void;
  setTunesRefreshId?: (newRefreshId: number) => void;
}

export const tableContext =
  React.createContext<TanstackTable<ITuneOverview> | null>(null);

export const useTableContext = () => {
  const context = React.useContext(tableContext);
  return context;
};

export const saveTableState = async (
  table: TanstackTable<ITuneOverview>,
  userId: number,
  tablePurpose: TablePurpose,
  playlistId: number,
): Promise<number> => {
  const tableState: TableState = table.getState();

  console.log(
    `LF7 saveTableState calling updateTableStateInDb: tablePurpose=${tablePurpose}`,
  );
  const status = await updateTableStateInDb(
    userId,
    "full",
    tablePurpose,
    playlistId,
    tableState,
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
  tablePurpose,
  globalFilter = "",
  onRecallEvalChange,
  onTableCreated,
  selectionChangedCallback = null,
  filterStringCallback,
  setTunesRefreshId,
}: IScheduledTunesType): null {
  const { currentTune, setCurrentTune, setCurrentTablePurpose } = useTune();
  const { currentPlaylist: playlistId } = usePlaylist();
  console.log(
    `LF1 render TunesTableComponent: playlistId=${playlistId}, userId=${userId}`,
  );

  const [tableStateFromDb, setTableStateFromDb] =
    React.useState<TableState | null>(null);

  const [sorting, setSorting] = React.useState<SortingState>(
    tableStateFromDb ? tableStateFromDb.sorting : [],
  );
  const originalSetSortingRef = React.useRef(setSorting);

  // React.useEffect(() => {
  //   originalSetSortingRef.current = setSorting;
  // }, []);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    tableStateFromDb ? tableStateFromDb.columnFilters : [],
  );
  const originalColumnFiltersRef = React.useRef(setColumnFilters);

  // React.useEffect(() => {
  //   originalColumnFiltersRef.current = setColumnFilters;
  // }, []);

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
            deleted: false,
          },
    );

  const originalSetColumnVisibilityRef = React.useRef(setColumnVisibility);

  // React.useEffect(() => {
  //   originalSetColumnVisibilityRef.current = setColumnVisibility;
  // }, []);

  const [rowSelection, setRowSelection] = React.useState(
    tableStateFromDb ? tableStateFromDb.rowSelection : { "2": true },
  );
  const originalSetRowSelectionRef = React.useRef(setRowSelection);

  // React.useEffect(() => {
  //   originalSetRowSelectionRef.current = setRowSelection;
  // }, []);

  const columns = get_columns(
    userId,
    playlistId,
    tablePurpose,
    onRecallEvalChange,
    setTunesRefreshId,
  );

  const table: TanstackTable<ITuneOverview> = useReactTable({
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

  const [isLoading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (isLoading) {
      // On initial render effect, load table state from the database
      const fetchTableState = async () => {
        try {
          console.log(
            `LF7 TunesTableComponent: ===> calling getTableStateTable(${userId}, 'full', tablePurpose=${tablePurpose} playlistId=${playlistId}`,
          );
          let tableStateTable = await getTableStateTable(
            userId,
            "full",
            tablePurpose,
            playlistId,
          );
          if (!tableStateTable) {
            console.log("LF7 TunesTableComponent: no table state found in db");
            tableStateTable = await createOrUpdateTableState(
              userId,
              "full",
              tablePurpose,
              playlistId,
              table.getState(),
              currentTune,
            );
          }
          const tableStateFromDb = tableStateTable?.settings as TableState;
          if (tableStateFromDb) {
            setTableStateFromDb(tableStateFromDb);
            const currentTuneState = Number(tableStateTable?.current_tune ?? 0);
            console.log(
              `LF6 TunesTableComponent: currentTuneState=${currentTuneState}`,
            );
            if (currentTuneState > 0) {
              setCurrentTune(currentTuneState);
            } else {
              setCurrentTune(null);
            }
            setCurrentTablePurpose(tablePurpose);
            console.log(
              `LF7 TunesTableComponent: setting rowSelection db: ${JSON.stringify(
                tableStateFromDb.rowSelection,
              )}`,
            );
            table.setRowSelection(tableStateFromDb.rowSelection);
            table.setColumnVisibility(tableStateFromDb.columnVisibility);
            table.setColumnFilters(tableStateFromDb.columnFilters);
            table.setSorting(tableStateFromDb.sorting);
            if (filterStringCallback) {
              filterStringCallback(tableStateFromDb.globalFilter);
            }
            table.setPagination(tableStateFromDb.pagination);
          } else
            console.log("LF1 TunesTableComponent: no table state found in db");
        } catch (error) {
          console.error(error);
          throw error;
        } finally {
          setLoading(false);
        }
      };

      if (playlistId !== undefined && playlistId > 0) {
        console.log("LF1 TunesTableComponent: calling fetchTableState");
        void fetchTableState();
      } else {
        console.log(
          "LF1 TunesTableComponent: playlistId not set, skipping table state fetch",
        );
      }
    }
  }); // don't add dependencies here!

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
      `LF7 ==>TunesTableComponent<== (interceptedRowSelectionChange) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}, ${JSON.stringify(newRowSelectionState)}}`,
    );
    void saveTableState(table, userId, tablePurpose, playlistId);

    if (selectionChangedCallback) {
      console.log(
        "LF7 TunesTableComponent: calling selectionChangedCallback",
        table,
        resolvedRowSelectionState,
      );
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
      `LF7 TunesTableComponent (interceptedOnColumnFiltersChange) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}`,
    );
    void saveTableState(table, userId, tablePurpose, playlistId);
  };

  const interceptedSetSorting = (
    newSorting: SortingState | ((state: SortingState) => SortingState),
  ): void => {
    const resolvedSorting: SortingState =
      newSorting instanceof Function ? newSorting(sorting) : newSorting;

    originalSetSortingRef.current(resolvedSorting);
    console.log(
      `LF7 TunesTableComponent (interceptedSetSorting) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}`,
    );
    void saveTableState(table, userId, tablePurpose, playlistId);
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

    console.log(
      "LF1 interceptedSetColumnVisibility: resolvedVisibilityState=",
      resolvedVisibilityState,
    );

    originalSetColumnVisibilityRef.current(resolvedVisibilityState);
    console.log(
      `LF7 TunesTableComponent (interceptedSetColumnVisibility) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}`,
    );
    void saveTableState(table, userId, tablePurpose, playlistId);
  };

  table.setOptions((prev) => ({
    ...prev,
    onSortingChange: interceptedSetSorting,
    onColumnFiltersChange: interceptedOnColumnFiltersChange,
    onRowSelectionChange: interceptedRowSelectionChange,
    onColumnVisibilityChange: interceptedSetColumnVisibility,
  }));

  React.useEffect(() => {
    if (onTableCreated) {
      onTableCreated(table);
    }
  }, [table, onTableCreated]);

  return null;
}

// Create a hook to use the table
export function useTunesTable(
  props: IScheduledTunesType,
): [React.JSX.Element, TanstackTable<ITuneOverview> | null] {
  const [table, setTable] = React.useState<TanstackTable<ITuneOverview> | null>(
    null,
  );

  // React.useEffect(() => {
  //   console.log("useTunesTable: table changed", table?.getVisibleFlatColumns());
  //   return () => {
  //     console.log("useTunesTable: cleanup");
  //   };
  // }, [table]);

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
