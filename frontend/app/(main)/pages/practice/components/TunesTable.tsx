"use client";

import type {
  ColumnSizingInfoState,
  ColumnSizingState,
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

export const globalFlagManualSorting = false;

// Extend TanStack TableState with column sizing and order (intersection type avoids structural conflicts)
type ITableStateExtended = TableState & {
  columnSizing?: ColumnSizingState;
  columnSizingInfo?: ColumnSizingInfoState;
  columnOrder?: string[];
  // Custom persisted scroll position for the main virtualized grid scroll container
  scrollTop?: number;
};

export interface IScheduledTunesType {
  tunes: ITuneOverview[];
  userId: number;
  tablePurpose: TablePurpose;
  globalFilter?: string;
  onRecallEvalChange?: (tuneId: number, newValue: string) => void;
  onGoalChange?: (tuneId: number, newValue: string | null) => void;
  onTableCreated?: (table: TanstackTable<ITuneOverview>) => void;
  selectionChangedCallback?:
    | ((
        table: TanstackTable<ITuneOverview>,
        rowSelectionState: RowSelectionState,
      ) => void)
    | null;
  filterStringCallback?: (filter: string) => void;
  setTunesRefreshId?: (newRefreshId: number) => void;
  setIsLoading?: (isLoading: boolean) => void;
}

export const tableContext =
  React.createContext<TanstackTable<ITuneOverview> | null>(null);

export const useTableContext = () => {
  const context = React.useContext(tableContext);
  return context;
};

// Persist table state, with optional overrides for keys that just changed (prevents stale saves)
export const saveTableState = async (
  table: TanstackTable<ITuneOverview>,
  userId: number,
  tablePurpose: TablePurpose,
  playlistId: number,
  overrides?: Partial<ITableStateExtended>,
): Promise<number> => {
  const baseState = table.getState() as unknown as ITableStateExtended;
  // Merge only provided overrides (ignore undefined)
  const mergedState: ITableStateExtended = { ...baseState };
  if (overrides) {
    for (const [key, value] of Object.entries(overrides) as [
      keyof ITableStateExtended,
      unknown,
    ][]) {
      if (value !== undefined) {
        (mergedState as unknown as Record<string, unknown>)[key as string] =
          value;
      }
    }
  }

  console.log(
    `LF7 saveTableState calling updateTableStateInDb: tablePurpose=${tablePurpose}`,
  );
  const status = await updateTableStateInDb(
    userId,
    "full",
    tablePurpose,
    playlistId,
    mergedState as unknown as TableState,
  );
  return status;
};

export function TunesTableComponent({
  tunes,
  userId,
  tablePurpose,
  globalFilter = "",
  onRecallEvalChange,
  onGoalChange,
  onTableCreated,
  selectionChangedCallback = null,
  filterStringCallback,
  setTunesRefreshId,
  setIsLoading,
}: IScheduledTunesType): null {
  const { currentTune, setCurrentTune, setCurrentTablePurpose } = useTune();
  const { currentPlaylist: playlistId } = usePlaylist();
  console.log(
    `LF1 render TunesTableComponent: playlistId=${playlistId}, userId=${userId}`,
  );

  const [tableStateFromDb, setTableStateFromDb] =
    React.useState<ITableStateExtended | null>(null);

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
            latest_practiced: true,
            latest_quality: false,
            latest_easiness: false,
            latest_interval: false,
            latest_repetitions: false,
            scheduled: true,
            latest_backup_practiced: false,
            external_ref: false,
            notes_private: true,
            notes_public: true,
            tags: false,
            deleted: false,
            goal: true,
            latest_technique: false,
            latest_goal: false,
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

  // Column sizing + ordering state
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    tableStateFromDb?.columnSizing ?? {},
  );
  const [columnSizingInfo, setColumnSizingInfo] =
    React.useState<ColumnSizingInfoState>(
      (tableStateFromDb?.columnSizingInfo as ColumnSizingInfoState) ??
        ({} as ColumnSizingInfoState),
    );
  const [columnOrder, setColumnOrder] = React.useState<string[]>(
    Array.isArray(tableStateFromDb?.columnOrder)
      ? tableStateFromDb?.columnOrder
      : [],
  );

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

    // Save with precise overrides to avoid stale persistence
    void saveTableState(table, userId, tablePurpose, playlistId, {
      rowSelection: resolvedRowSelectionState,
    });

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
    void saveTableState(table, userId, tablePurpose, playlistId, {
      columnFilters: resolvedColumnFiltersState,
    });
  };

  const interceptedSetColumnOrder = (
    newOrder: string[] | ((state: string[]) => string[]),
  ): void => {
    const resolvedOrder =
      newOrder instanceof Function ? newOrder(columnOrder) : newOrder;
    setColumnOrder(resolvedOrder);
    // Persist order change with override
    void saveTableState(table, userId, tablePurpose, playlistId, {
      columnOrder: resolvedOrder,
    });
  };

  // Live sizing change: update local state and trigger a re-render so cells recompute positions/widths
  const interceptedSetColumnSizing = (
    newSizing:
      | ColumnSizingState
      | ((state: ColumnSizingState) => ColumnSizingState),
  ): void => {
    const resolvedSizing =
      newSizing instanceof Function ? newSizing(columnSizing) : newSizing;
    setColumnSizing(resolvedSizing);
  };

  const interceptedSetColumnSizingInfo = (
    newInfo:
      | ColumnSizingInfoState
      | ((state: ColumnSizingInfoState) => ColumnSizingInfoState),
  ): void => {
    const resolvedInfo =
      newInfo instanceof Function ? newInfo(columnSizingInfo) : newInfo;
    setColumnSizingInfo(resolvedInfo);
    // Persist only when resize interaction ends (less chatty)
    if (!resolvedInfo.isResizingColumn) {
      void saveTableState(table, userId, tablePurpose, playlistId, {
        columnSizingInfo: resolvedInfo,
        columnSizing,
      });
    }
  };

  const interceptedSetSorting = (
    newSorting: SortingState | ((state: SortingState) => SortingState),
  ): void => {
    if (setIsLoading) {
      setIsLoading(false);
    }
    const resolvedSorting: SortingState =
      newSorting instanceof Function ? newSorting(sorting) : newSorting;

    console.log(
      "interceptedSetSorting ===> TunesTable.tsx:318 ~ resolvedSorting",
      resolvedSorting,
    );

    originalSetSortingRef.current(resolvedSorting);
    console.log(
      `LF7 TunesTableComponent (interceptedSetSorting) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}`,
    );
    // Proactively notify any listeners (e.g., virtualized grid) that sorting changed
    try {
      window.dispatchEvent(
        new CustomEvent("tt-sorting-changed", {
          detail: { sorting: resolvedSorting },
        }),
      );
    } catch {
      // window may be undefined in SSR; ignore
    }
    // Persist sorting change with override to avoid stale saves
    void saveTableState(table, userId, tablePurpose, playlistId, {
      sorting: resolvedSorting,
    });
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
    void saveTableState(table, userId, tablePurpose, playlistId, {
      columnVisibility: resolvedVisibilityState,
    });
  };

  // React.useEffect(() => {
  //   originalSetRowSelectionRef.current = setRowSelection;
  // }, []);

  const columns = get_columns(
    userId,
    playlistId,
    tablePurpose,
    onRecallEvalChange,
    setTunesRefreshId,
    onGoalChange,
  );

  const table: TanstackTable<ITuneOverview> = useReactTable({
    data: tunes,
    columns: columns,
    globalFilterFn: "auto",
    manualSorting: globalFlagManualSorting,
    onSortingChange: (newSorting) => interceptedSetSorting(newSorting),
    onColumnFiltersChange: interceptedOnColumnFiltersChange,
    // Column sizing + ordering
    columnResizeMode: "onChange",
    onColumnSizingChange: interceptedSetColumnSizing,
    onColumnSizingInfoChange: interceptedSetColumnSizingInfo,
    onColumnOrderChange: interceptedSetColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: interceptedSetColumnVisibility,
    onRowSelectionChange: interceptedRowSelectionChange,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      globalFilter,
      columnSizing,
      columnSizingInfo,
      columnOrder,
    },
    getRowId: (
      originalRow: ITuneOverview,
      // index: number,
      // parent?: Row<ITuneOverview>,
    ) => (originalRow.id ?? 0).toString(),
    defaultColumn: {
      size: 140,
      minSize: 60,
    },
  });

  // (property) getRowId?: ((originalRow: ITuneOverview, index: number, parent?: Row<ITuneOverview> | undefined) => string) | undefined

  const [isLoading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (isLoading) {
      // On initial render effect, load table state from the database
      const fetchTableState = async () => {
        try {
          console.log(
            `useEffect ===> TunesTable.tsx:205 ~ (no actual dependencies) fetchTableState calling getTableStateTable(${userId}, 'full', tablePurpose=${tablePurpose} playlistId=${playlistId}`,
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
            if (tableStateFromDb?.columnOrder) {
              table.setColumnOrder(tableStateFromDb.columnOrder);
            }
            if (tableStateFromDb?.columnSizing) {
              table.setColumnSizing(tableStateFromDb.columnSizing);
            }
            if (tableStateFromDb?.columnSizingInfo) {
              table.setColumnSizingInfo(tableStateFromDb.columnSizingInfo);
            }
            // Dispatch an event so the grid can restore prior scroll position after it mounts
            try {
              if (typeof window !== "undefined") {
                // Store scroll position in a global cache to allow late subscribers (grids mounting after event) to restore
                try {
                  const key = `${tablePurpose}|${playlistId}`;
                  const w = window as unknown as {
                    __ttScrollLast?: Record<string, number>;
                  };
                  w.__ttScrollLast = w.__ttScrollLast || {};
                  w.__ttScrollLast[key] =
                    (tableStateFromDb as ITableStateExtended).scrollTop ?? 0;
                } catch {
                  // ignore
                }
                window.dispatchEvent(
                  new CustomEvent("tt-scroll-restore", {
                    detail: {
                      scrollTop: (tableStateFromDb as ITableStateExtended)
                        .scrollTop,
                      tablePurpose,
                      playlistId,
                    },
                  }),
                );
              }
            } catch {
              // ignore
            }
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
          if (onTableCreated) onTableCreated(table);
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

  React.useEffect(() => {
    if (onTableCreated) {
      console.log(
        `useEffect ===> TunesTable.tsx:388 ~ tablePurpose=${tablePurpose} [table=(table), onTableCreated=(callback)]`,
      );
      onTableCreated(table);
    }
  }, [table, onTableCreated, tablePurpose]);

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
        if (table !== newTable) {
          console.log(
            `useEffect ===> TunesTable.tsx:418 ~ Table created/updated with ${props.tunes.length} tunes`,
          );
          setTable(newTable);
        } else {
          console.log(
            `useEffect ===> TunesTable.tsx:423 ~ SKIPPING Table already created with ${props.tunes.length} tunes`,
          );
        }
      }}
    />
  );

  return [tableComponent, table];
}
