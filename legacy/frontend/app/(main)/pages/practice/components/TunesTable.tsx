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
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import { logVerbose } from "@/lib/logging";
import { createOrUpdateTableState, getTableStateTable } from "../settings";
import type { ITuneOverview, TablePurpose } from "../types";
import { usePlaylist } from "./CurrentPlaylistProvider";
import { useTune } from "./CurrentTuneContext";
import { get_columns } from "./TuneColumns";
import { tableStateCacheService } from "./table-state-cache";

export const globalFlagManualSorting = false;

// Extend TanStack TableState with column sizing and order (intersection type avoids structural conflicts)
type ITableStateExtended = TableState & {
  columnSizing?: ColumnSizingState;
  columnSizingInfo?: ColumnSizingInfoState;
  columnOrder?: string[];
  // Custom persisted scroll position for the main virtualized grid scroll container
  scrollTop?: number;
  // Monotonic per-tab version to gate hydration and stale overwrites
  clientVersion?: number;
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
  forceImmediate?: boolean,
): Promise<number> => {
  // Hydration guard: if programmatic hydration is in progress, suppress persistence
  try {
    if (typeof window !== "undefined") {
      const key = `${userId}|${tablePurpose}|${playlistId}`;
      const w = window as unknown as {
        __TT_HYDRATING__?: Record<string, boolean>;
      };
      if (w.__TT_HYDRATING__?.[key]) {
        logVerbose(
          `[HydrateGuard] Skipping saveTableState during hydration for ${key}`,
        );
        return 200;
      }
    }
  } catch {
    /* ignore */
  }
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

  // Regression fix: scrollTop was being lost on saves that did not explicitly include it (e.g., sorting/filter changes).
  // Because TanStack's table.getState() does not contain our custom scrollTop field, any save without overrides.scrollTop
  // would drop the previously persisted scrollTop, causing subsequent remounts to restore to 0.
  if (mergedState.scrollTop === undefined) {
    try {
      const w = window as unknown as {
        __ttScrollLast?: Record<string, number>;
      };
      const key = `${userId}|${tablePurpose}|${playlistId}`;
      const cached = w.__ttScrollLast?.[key];
      if (typeof cached === "number") {
        mergedState.scrollTop = cached;
        // Debug log to verify preservation path
        logVerbose(
          "[ScrollPersist] Preserving existing scrollTop=%d on state save (no explicit override)",
          cached,
        );
      }
    } catch {
      // ignore – window not available (SSR) or structure missing
    }
  }

  logVerbose(
    `LF7 saveTableState ${forceImmediate ? "(immediate)" : "(cached)"}: tablePurpose=${tablePurpose}`,
  );

  // Seed a window-scoped last-known state so immediate remounts can hydrate without waiting for server/cache
  try {
    if (typeof window !== "undefined") {
      const key = `${userId}|${tablePurpose}|${playlistId}`;
      const w = window as unknown as {
        __TT_TABLE_LAST__?: Record<string, TableState>;
      };
      w.__TT_TABLE_LAST__ = w.__TT_TABLE_LAST__ || {};
      // Important: avoid clobbering previously toggled fields (e.g., columnVisibility) with a possibly-stale
      // baseState when saving unrelated keys such as scrollTop. Prefer the existing last snapshot for any keys
      // not explicitly overridden in this save. Merge order: baseState <- existingLast <- overrides.
      const existingLast = w.__TT_TABLE_LAST__[key] as
        | (ITableStateExtended & TableState)
        | undefined;
      const mergedLastForWindow: ITableStateExtended = {
        ...baseState,
        ...(existingLast as ITableStateExtended),
        ...(overrides as ITableStateExtended),
      };
      w.__TT_TABLE_LAST__[key] = mergedLastForWindow as unknown as TableState;
    }
  } catch {
    /* ignore */
  }

  if (forceImmediate) {
    // For critical events, flush immediately via cache service so version is stamped
    return tableStateCacheService.flushImmediate(
      userId,
      tablePurpose,
      playlistId,
      mergedState as unknown as TableState,
    );
  }
  // For normal events, use cached batching
  tableStateCacheService.cacheUpdate(
    userId,
    tablePurpose,
    playlistId,
    mergedState as unknown as TableState,
  );
  return 200; // Return success immediately for cached updates
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
  logVerbose(
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

  // Guard to suppress persistence during programmatic hydration
  const isHydratingRef = React.useRef<boolean>(false);

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

    logVerbose(
      () =>
        `LF7 ==>TunesTableComponent<== (interceptedRowSelectionChange) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}, ${JSON.stringify(newRowSelectionState)}}`,
    );

    // Save with precise overrides to avoid stale persistence
    if (!isHydratingRef.current) {
      void saveTableState(
        table,
        userId,
        tablePurpose,
        playlistId,
        { rowSelection: resolvedRowSelectionState },
        true,
      );
    }

    if (selectionChangedCallback) {
      logVerbose(
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
    logVerbose(
      `LF7 TunesTableComponent (interceptedOnColumnFiltersChange) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}`,
    );
    if (!isHydratingRef.current) {
      void saveTableState(
        table,
        userId,
        tablePurpose,
        playlistId,
        { columnFilters: resolvedColumnFiltersState },
        true,
      );
    }
  };

  const interceptedSetColumnOrder = (
    newOrder: string[] | ((state: string[]) => string[]),
  ): void => {
    const resolvedOrder =
      newOrder instanceof Function ? newOrder(columnOrder) : newOrder;
    setColumnOrder(resolvedOrder);
    // Persist order change with override
    if (!isHydratingRef.current) {
      void saveTableState(
        table,
        userId,
        tablePurpose,
        playlistId,
        { columnOrder: resolvedOrder },
        true,
      );
    }
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
    if (!resolvedInfo.isResizingColumn && !isHydratingRef.current) {
      void saveTableState(
        table,
        userId,
        tablePurpose,
        playlistId,
        { columnSizingInfo: resolvedInfo, columnSizing },
        true,
      );
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

    logVerbose(
      "interceptedSetSorting ===> TunesTable.tsx:318 ~ resolvedSorting",
      resolvedSorting,
    );

    originalSetSortingRef.current(resolvedSorting);
    logVerbose(
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
    if (!isHydratingRef.current) {
      void saveTableState(
        table,
        userId,
        tablePurpose,
        playlistId,
        { sorting: resolvedSorting },
        true,
      );
    }
  };

  const interceptedSetColumnVisibility = (
    newVisibilityState:
      | VisibilityState
      | ((state: VisibilityState) => VisibilityState),
  ): void => {
    // Resolve against the table's current visibility state (not the possibly-stale React state)
    // to avoid dropping prior toggles when multiple changes occur in quick succession.
    const currentVisibility = table.getState().columnVisibility;
    const resolvedVisibilityState: VisibilityState =
      typeof newVisibilityState === "function"
        ? newVisibilityState(currentVisibility)
        : newVisibilityState;

    logVerbose(
      "LF1 interceptedSetColumnVisibility: resolvedVisibilityState=",
      resolvedVisibilityState,
    );

    originalSetColumnVisibilityRef.current(resolvedVisibilityState);
    logVerbose(
      `LF7 TunesTableComponent (interceptedSetColumnVisibility) calling saveTableState: tablePurpose=${tablePurpose} currentTune=${currentTune}`,
    );
    if (!isHydratingRef.current) {
      void saveTableState(
        table,
        userId,
        tablePurpose,
        playlistId,
        { columnVisibility: resolvedVisibilityState },
        true,
      );
      // Notify listeners (e.g., TunesGrid) to re-render headers immediately when visibility changes
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("tt-visibility-changed", {
              detail: { tablePurpose, playlistId },
            }),
          );
        }
      } catch {
        // ignore
      }
    }
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
    // Pass current playlist SR algorithm (may be null until loaded)
    usePlaylist()?.srAlgType ?? null,
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
      // Raised baseline min size (was 60) to keep headers legible with padding + sort icon
      minSize: 90,
    },
  });
  // Helper: notify listeners when visibility may have changed programmatically
  const notifyVisibilityChanged = React.useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tt-visibility-changed", {
            detail: { tablePurpose, playlistId },
          }),
        );
      }
    } catch {
      // ignore
    }
  }, [tablePurpose, playlistId]);

  // (property) getRowId?: ((originalRow: ITuneOverview, index: number, parent?: Row<ITuneOverview> | undefined) => string) | undefined

  const [isLoading, setLoading] = React.useState<boolean>(true);
  // Mount + playlist/user change loader.
  // IMPORTANT: This effect intentionally depends only on `isLoading` (and static params via closure)
  // to avoid the previous infinite/"Maximum update depth exceeded" loop that occurred when
  // it ran every render and then mutated table state (sorting / sizing / visibility) which
  // immediately triggered another render + effect. Do NOT add `table` or rapidly changing
  // state objects to this dependency list without reworking the logic to guard re-entry.
  React.useEffect(() => {
    if (!isLoading) return;
    const fetchTableState = async () => {
      try {
        logVerbose(
          `useEffect TunesTable.tsx fetchTableState userId=${userId} tablePurpose=${tablePurpose} playlistId=${playlistId}`,
        );
        // Window last-known state fallback (covers immediate remounts before cache/server reflect latest state)
        try {
          if (typeof window !== "undefined") {
            const key = `${userId}|${tablePurpose}|${playlistId}`;
            const w = window as unknown as {
              __TT_TABLE_LAST__?: Record<string, TableState>;
            };
            const last = w.__TT_TABLE_LAST__?.[key] as
              | (ITableStateExtended & TableState)
              | undefined;
            if (last) {
              setTableStateFromDb(last);
              // Apply immediately
              try {
                const hasSelection =
                  last.rowSelection &&
                  typeof last.rowSelection === "object" &&
                  Object.keys(last.rowSelection as Record<string, boolean>)
                    .length > 0;
                if (hasSelection) {
                  table.setRowSelection(last.rowSelection);
                }
              } catch {
                /* ignore */
              }
              if (last.columnVisibility)
                table.setColumnVisibility(last.columnVisibility);
              if (last.columnFilters)
                table.setColumnFilters(last.columnFilters);
              if (last.sorting) table.setSorting(last.sorting);
              if (last.columnOrder) table.setColumnOrder(last.columnOrder);
              if (last.columnSizing) table.setColumnSizing(last.columnSizing);
              if (last.columnSizingInfo)
                table.setColumnSizingInfo(last.columnSizingInfo);
              setLoading(false);
              if (onTableCreated) onTableCreated(table);
              return; // Use last-known snapshot; background refresh will reconcile later
            }
          }
        } catch {
          /* ignore */
        }
        // Cache-first hydration: if we have a cached state for this user/purpose/playlist,
        // apply it immediately to avoid a visible snap while the server request resolves.
        const cached = tableStateCacheService.getCached(
          userId,
          tablePurpose,
          playlistId,
        ) as ITableStateExtended | null;
        if (cached) {
          setTableStateFromDb(cached);
          setCurrentTablePurpose(tablePurpose);
          try {
            const hasSelection =
              cached.rowSelection &&
              typeof cached.rowSelection === "object" &&
              Object.keys(cached.rowSelection as Record<string, boolean>)
                .length > 0;
            if (hasSelection) {
              table.setRowSelection(cached.rowSelection);
            }
            // If no persisted selection, select the first row by default for consistency with tests/UI
            if (!hasSelection) {
              const firstRowId = table.getRowModel().rows?.[0]?.id;
              if (firstRowId) {
                // Briefly enter hydration guard so this programmatic selection doesn't persist immediately
                try {
                  if (typeof window !== "undefined") {
                    const key = `${userId}|${tablePurpose}|${playlistId}`;
                    const w = window as unknown as {
                      __TT_HYDRATING__?: Record<string, boolean>;
                    };
                    w.__TT_HYDRATING__ = w.__TT_HYDRATING__ || {};
                    w.__TT_HYDRATING__[key] = true;
                  }
                } catch {
                  /* ignore */
                }
                isHydratingRef.current = true;
                try {
                  table.setRowSelection({ [firstRowId]: true });
                } finally {
                  isHydratingRef.current = false;
                  try {
                    if (typeof window !== "undefined") {
                      const key = `${userId}|${tablePurpose}|${playlistId}`;
                      const w = window as unknown as {
                        __TT_HYDRATING__?: Record<string, boolean>;
                      };
                      if (w.__TT_HYDRATING__) w.__TT_HYDRATING__[key] = false;
                    }
                  } catch {
                    /* ignore */
                  }
                }
              }
            }
          } catch {
            /* ignore */
          }
          table.setColumnVisibility(cached.columnVisibility);
          notifyVisibilityChanged();
          table.setColumnFilters(cached.columnFilters);
          table.setSorting(cached.sorting);
          if (cached?.columnOrder) table.setColumnOrder(cached.columnOrder);
          if (cached?.columnSizing) table.setColumnSizing(cached.columnSizing);
          if (cached?.columnSizingInfo)
            table.setColumnSizingInfo(cached.columnSizingInfo);
          try {
            if (typeof window !== "undefined") {
              const key = `${userId}|${tablePurpose}|${playlistId}`;
              const w = window as unknown as {
                __ttScrollLast?: Record<string, number>;
                __TT_TABLE_VERSION__?: Record<string, number>;
              };
              // Preserve scroll for later restore
              w.__ttScrollLast = w.__ttScrollLast || {};
              w.__ttScrollLast[key] = cached.scrollTop ?? 0;
              // Advance local version gate from cached clientVersion if present
              w.__TT_TABLE_VERSION__ = w.__TT_TABLE_VERSION__ || {};
              const serverVersion = cached.clientVersion ?? 0;
              const localVersion = w.__TT_TABLE_VERSION__[key] ?? 0;
              w.__TT_TABLE_VERSION__[key] = Math.max(
                localVersion,
                serverVersion,
              );
              // Fire a scroll-restore event for immediate UX consistency
              window.dispatchEvent(
                new CustomEvent("tt-scroll-restore", {
                  detail: {
                    scrollTop: cached.scrollTop,
                    tablePurpose,
                    playlistId,
                  },
                }),
              );
            }
          } catch {
            /* ignore */
          }
          if (filterStringCallback) filterStringCallback(cached.globalFilter);
          table.setPagination(cached.pagination);
          // Early return: cache-first only. We'll rely on the cache service's periodic refresh
          // to reconcile if something changed elsewhere.
          setLoading(false);
          if (onTableCreated) onTableCreated(table);
          return;
        }
        const full = await tableStateCacheService.getOrFetchFull(
          userId,
          "full",
          tablePurpose,
          playlistId,
        );
        let tableStateTable = full
          ? ({
              settings: full.settings as TableState | null,
              current_tune: full.current_tune ?? -1,
            } as { settings: TableState | null; current_tune: number | null })
          : await getTableStateTable(userId, "full", tablePurpose, playlistId);
        if (!tableStateTable) {
          logVerbose("LF7 TunesTableComponent: no table state found in db");
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
          // Hydration gating: ignore stale server state if local tab has a newer version
          let allowHydration = true;
          try {
            if (typeof window !== "undefined") {
              const key = `${userId}|${tablePurpose}|${playlistId}`;
              const w = window as unknown as {
                __TT_TABLE_VERSION__?: Record<string, number>;
              };
              w.__TT_TABLE_VERSION__ = w.__TT_TABLE_VERSION__ || {};
              const localVersion = w.__TT_TABLE_VERSION__[key] ?? 0;
              const serverVersion =
                (tableStateFromDb as ITableStateExtended).clientVersion ?? 0;
              if (localVersion > 0 && serverVersion < localVersion) {
                // Stale server state: skip applying
                allowHydration = false;
                if (
                  process.env.NEXT_PUBLIC_TABLE_STATE_TRACE === "1" ||
                  process.env.NEXT_PUBLIC_TABLE_STATE_TRACE === "true"
                ) {
                  console.debug(
                    `[TableStateTrace][hydrate-skip] purpose=${tablePurpose} playlistId=${playlistId} serverVersion=${serverVersion} < localVersion=${localVersion}`,
                  );
                }
              } else {
                // Advance local epoch to at least server version
                w.__TT_TABLE_VERSION__[key] = Math.max(
                  localVersion,
                  serverVersion,
                );
              }
            }
          } catch {
            // ignore
          }

          if (allowHydration) {
            // Enter hydration mode: prevent interceptors from saving
            isHydratingRef.current = true;
            try {
              if (typeof window !== "undefined") {
                const key = `${userId}|${tablePurpose}|${playlistId}`;
                const w = window as unknown as {
                  __TT_HYDRATING__?: Record<string, boolean>;
                };
                w.__TT_HYDRATING__ = w.__TT_HYDRATING__ || {};
                w.__TT_HYDRATING__[key] = true;
              }
            } catch {
              /* ignore */
            }
            setTableStateFromDb(tableStateFromDb);
            const currentTuneState = Number(tableStateTable?.current_tune ?? 0);
            if (currentTuneState > 0) setCurrentTune(currentTuneState);
            else setCurrentTune(null);
            setCurrentTablePurpose(tablePurpose);
            try {
              const hasSelection =
                tableStateFromDb.rowSelection &&
                typeof tableStateFromDb.rowSelection === "object" &&
                Object.keys(
                  tableStateFromDb.rowSelection as Record<string, boolean>,
                ).length > 0;
              if (hasSelection) {
                table.setRowSelection(tableStateFromDb.rowSelection);
              } else {
                // Select first row by default if none persisted
                const firstRowId = table.getRowModel().rows?.[0]?.id;
                if (firstRowId) {
                  table.setRowSelection({ [firstRowId]: true });
                }
              }
            } catch {
              /* ignore */
            }
            table.setColumnVisibility(tableStateFromDb.columnVisibility);
            notifyVisibilityChanged();
            table.setColumnFilters(tableStateFromDb.columnFilters);
            table.setSorting(tableStateFromDb.sorting);
            if (tableStateFromDb?.columnOrder)
              table.setColumnOrder(tableStateFromDb.columnOrder);
            if (tableStateFromDb?.columnSizing)
              table.setColumnSizing(tableStateFromDb.columnSizing);
            if (tableStateFromDb?.columnSizingInfo)
              table.setColumnSizingInfo(tableStateFromDb.columnSizingInfo);
            // Exit guard after state has been applied
            setTimeout(() => {
              isHydratingRef.current = false;
              try {
                if (typeof window !== "undefined") {
                  const key = `${userId}|${tablePurpose}|${playlistId}`;
                  const w = window as unknown as {
                    __TT_HYDRATING__?: Record<string, boolean>;
                  };
                  if (w.__TT_HYDRATING__) w.__TT_HYDRATING__[key] = false;
                }
              } catch {
                /* ignore */
              }
            }, 0);
          }
          try {
            if (typeof window !== "undefined") {
              try {
                const key = `${userId}|${tablePurpose}|${playlistId}`;
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
          if (filterStringCallback)
            filterStringCallback(tableStateFromDb.globalFilter);
          table.setPagination(tableStateFromDb.pagination);
          try {
            const traceEnabled =
              process.env.NEXT_PUBLIC_TABLE_STATE_TRACE === "1" ||
              process.env.NEXT_PUBLIC_TABLE_STATE_TRACE === "true";
            if (traceEnabled && typeof window !== "undefined") {
              const w = window as unknown as {
                __TT_TABLE_HYDRATED__?: Record<string, number>;
              };
              w.__TT_TABLE_HYDRATED__ = w.__TT_TABLE_HYDRATED__ || {};
              w.__TT_TABLE_HYDRATED__[
                `${userId}|${tablePurpose}|${playlistId}`
              ] = Date.now();
              console.debug(
                `[TableStateTrace][hydrate] purpose=${tablePurpose} playlistId=${playlistId} keys=${Object.keys(
                  tableStateFromDb as unknown as Record<string, unknown>,
                ).join(",")}`,
              );
            }
          } catch {
            /* ignore */
          }
        } else {
          logVerbose("LF1 TunesTableComponent: no table state found in db");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
        if (onTableCreated) onTableCreated(table);
      }
    };
    if (playlistId && playlistId > 0) {
      void fetchTableState();
    } else {
      logVerbose(
        "LF1 TunesTableComponent: playlistId not set, skipping table state fetch",
      );
      setLoading(false);
      if (onTableCreated) onTableCreated(table);
    }
  }, [
    isLoading,
    userId,
    tablePurpose,
    playlistId,
    table,
    currentTune,
    setCurrentTune,
    setCurrentTablePurpose,
    onTableCreated,
    filterStringCallback,
    notifyVisibilityChanged,
  ]);

  React.useEffect(() => {
    if (onTableCreated) {
      logVerbose(
        `useEffect ===> TunesTable.tsx:388 ~ tablePurpose=${tablePurpose} [table=(table), onTableCreated=(callback)]`,
      );
      onTableCreated(table);
    }
  }, [table, onTableCreated, tablePurpose]);

  // On unmount or when switching playlist/purpose, try to flush any pending table state
  React.useEffect(() => {
    return () => {
      try {
        if (table && userId && playlistId) {
          // Best-effort: persist current state immediately to reduce chance of stale hydration in next tab
          void tableStateCacheService.flushImmediate(
            userId,
            tablePurpose,
            playlistId,
            (table.getState() as unknown as ITableStateExtended) ?? undefined,
          );
        }
      } catch {
        // ignore
      }
    };
    // Only re-register cleanup when these identifiers change
  }, [table, userId, tablePurpose, playlistId]);

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
          logVerbose(
            `useEffect ===> TunesTable.tsx:418 ~ Table created/updated with ${props.tunes.length} tunes`,
          );
          setTable(newTable);
        } else {
          logVerbose(
            `useEffect ===> TunesTable.tsx:423 ~ SKIPPING Table already created with ${props.tunes.length} tunes`,
          );
        }
      }}
    />
  );

  return [tableComponent, table];
}
