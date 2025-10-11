/**
 * Tunes Grid Catalog Component
 *
 * Table-centric grid for browsing the entire tune catalog.
 * Features:
 * - Sticky header with frozen columns while scrolling
 * - Virtual scrolling for performance with large datasets
 * - Sortable, resizable, hideable columns
 * - Row selection
 * - State persistence (column order, sizes, scroll position)
 *
 * @module components/grids/TunesGridCatalog
 */

import {
  type ColumnOrderState,
  type ColumnSizingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/solid-table";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { eq } from "drizzle-orm";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { getPlaylistTunes } from "../../lib/db/queries/playlists";
import { getTunesForUser } from "../../lib/db/queries/tunes";
import * as schema from "../../lib/db/schema";
import type { Tune } from "../../lib/db/types";
import { getColumns } from "./TuneColumns";
import {
  loadTableState,
  mergeWithDefaults,
  saveTableState,
} from "./table-state-persistence";
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridCatalog: Component<IGridBaseProps> = (props) => {
  const { localDb, syncVersion } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // State persistence key
  const stateKey = createMemo(() => ({
    userId: props.userId,
    tablePurpose: props.tablePurpose,
    playlistId: currentPlaylistId() || 0,
  }));

  // Load persisted state
  const loadedState = loadTableState(stateKey());
  const initialState = mergeWithDefaults(loadedState, "catalog");

  // Table state signals
  const [sorting, setSorting] = createSignal<SortingState>(
    initialState.sorting || []
  );
  const [rowSelection, setRowSelection] = createSignal<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = createSignal<ColumnSizingState>(
    initialState.columnSizing || {}
  );
  const [columnOrder, setColumnOrder] = createSignal<ColumnOrderState>(
    initialState.columnOrder || []
  );

  // Fetch tunes data
  const [tunes] = createResource(
    () => {
      const db = localDb();
      const userId = useAuth().user()?.id;
      const version = syncVersion(); // Triggers refetch when sync completes
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (!params) return [];
      return await getTunesForUser(params.db, params.userId);
    }
  );

  // Fetch tunes from selected playlists (when playlist filter is active)
  const [playlistTunes] = createResource(
    () => {
      const db = localDb();
      const userId = useAuth().user()?.id;
      const playlistIds = props.selectedPlaylistIds || [];
      return db && userId && playlistIds.length > 0
        ? { db, userId, playlistIds }
        : null;
    },
    async (params) => {
      if (!params) return [];

      // Fetch tunes from all selected playlists
      const allPlaylistTunes: Tune[] = [];
      for (const playlistId of params.playlistIds) {
        try {
          const playlistData = await getPlaylistTunes(
            params.db,
            playlistId,
            params.userId
          );
          // getPlaylistTunes returns PlaylistTuneWithDetails[], but we need the tune data
          // Let's extract the tune IDs and fetch them separately
          const tuneIds = playlistData.map((pt) => pt.tuneRef);
          const playlistTuneData = await Promise.all(
            tuneIds.map(async (tuneId) => {
              const result = await params.db
                .select()
                .from(schema.tune)
                .where(eq(schema.tune.id, tuneId))
                .limit(1);
              return result[0];
            })
          );
          allPlaylistTunes.push(...playlistTuneData.filter(Boolean));
        } catch (error) {
          console.warn(
            `Failed to fetch tunes for playlist ${playlistId}:`,
            error
          );
        }
      }

      // Remove duplicates (same tune could be in multiple selected playlists)
      const uniqueTunes = allPlaylistTunes.filter(
        (tune, index, arr) => arr.findIndex((t) => t.id === tune.id) === index
      );

      return uniqueTunes;
    }
  );

  // Apply client-side filtering
  // Type Contract: Input is Tune[], Output is Tune[], filtered by search/type/mode/genre/playlist
  const filteredTunes = createMemo<Tune[]>(() => {
    // Determine base tune set: if playlist filter is active, use playlist tunes, otherwise all tunes
    const baseTunes: Tune[] =
      props.selectedPlaylistIds && props.selectedPlaylistIds.length > 0
        ? playlistTunes() || []
        : tunes() || [];

    const query = props.searchQuery?.trim().toLowerCase() || "";
    const types = props.selectedTypes || [];
    const modes = props.selectedModes || [];
    const genreNames = props.selectedGenreNames || [];
    const allGenres = props.allGenres || [];

    // Map selected genre names to genre IDs for filtering
    const genreIds: string[] = [];
    if (genreNames.length > 0) {
      genreNames.forEach((genreName) => {
        const genre = allGenres.find((g) => g.name === genreName);
        if (genre) {
          genreIds.push(genre.id);
        }
      });
    }

    return baseTunes.filter((tune: Tune): boolean => {
      // Search filter
      if (query) {
        const matchesTitle = tune.title?.toLowerCase().includes(query);
        const matchesIncipit = tune.incipit?.toLowerCase().includes(query);
        const matchesStructure = tune.structure?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesIncipit && !matchesStructure) {
          return false;
        }
      }

      // Type filter
      if (types.length > 0 && tune.type) {
        if (!types.includes(tune.type)) {
          return false;
        }
      }

      // Mode filter
      if (modes.length > 0 && tune.mode) {
        if (!modes.includes(tune.mode)) {
          return false;
        }
      }

      // Genre filter (using mapped IDs)
      if (genreIds.length > 0 && tune.genre) {
        if (!genreIds.includes(tune.genre)) {
          return false;
        }
      }

      return true;
    });
  });

  // Column definitions
  const columns = createMemo(() =>
    getColumns("catalog", {
      onRecallEvalChange: props.onRecallEvalChange,
      onGoalChange: props.onGoalChange,
    })
  );

  // Create table instance
  const table = createSolidTable({
    get data() {
      return filteredTunes();
    },
    get columns() {
      return columns();
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    state: {
      get sorting() {
        return sorting();
      },
      get rowSelection() {
        return rowSelection();
      },
      get columnSizing() {
        return columnSizing();
      },
      get columnOrder() {
        return columnOrder();
      },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    getRowId: (row) => String(row.id),
  });

  // Container ref for virtualization
  let containerRef: HTMLDivElement | undefined;

  // Virtualizer for rows
  const rowVirtualizer = createMemo(() =>
    createVirtualizer({
      get count() {
        return table.getRowModel().rows.length;
      },
      getScrollElement: () => containerRef || null,
      estimateSize: () => 40, // Estimated row height
      overscan: 10, // Render 10 extra rows above/below viewport
    })
  );

  // Persist state on changes
  createEffect(() => {
    const state = {
      sorting: sorting(),
      columnSizing: columnSizing(),
      columnOrder: columnOrder(),
      scrollTop: containerRef?.scrollTop || 0,
    };
    saveTableState(stateKey(), state);
  });

  // Restore scroll position
  onMount(() => {
    if (containerRef && initialState.scrollTop) {
      containerRef.scrollTop = initialState.scrollTop;
    }
  });

  // Handle row click
  const handleRowClick = (tune: Tune): void => {
    // Cast to ITuneOverview for compatibility with the interface
    // This is safe because the callback only uses the 'id' field
    props.onTuneSelect?.(tune as unknown as ITuneOverview);
  };

  // Get selected tunes count
  const selectedCount = createMemo<number>(
    () => Object.keys(rowSelection()).length
  );

  // Notify parent of selection changes
  createEffect(() => {
    props.onSelectionChange?.(selectedCount());
  });

  return (
    <div class="h-full flex flex-col">
      {/* Selection summary */}
      <Show when={selectedCount() > 0}>
        <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <span class="text-sm text-blue-700 dark:text-blue-300">
            {selectedCount()} {selectedCount() === 1 ? "tune" : "tunes"}{" "}
            selected
          </span>
          <button
            type="button"
            class="ml-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </button>
        </div>
      </Show>

      {/* Loading state */}
      <Show
        when={
          tunes.loading ||
          (props.selectedPlaylistIds &&
            props.selectedPlaylistIds.length > 0 &&
            playlistTunes.loading)
        }
      >
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              Loading catalog...
            </p>
          </div>
        </div>
      </Show>

      {/* Table container with virtualization */}
      <Show
        when={
          !tunes.loading &&
          (!props.selectedPlaylistIds ||
            props.selectedPlaylistIds.length === 0 ||
            !playlistTunes.loading) &&
          filteredTunes().length > 0
        }
      >
        <div
          ref={containerRef}
          class="flex-1 overflow-auto relative"
          style={{ height: "100%" }}
        >
          <table
            class="w-full border-collapse"
            style={{ width: `${table.getCenterTotalSize()}px` }}
          >
            {/* Sticky header */}
            <thead class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600">
              <For each={table.getHeaderGroups()}>
                {(headerGroup) => (
                  <tr>
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <th
                          class="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 relative"
                          style={{ width: `${header.getSize()}px` }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}

                          {/* Resize handle */}
                          <Show when={header.column.getCanResize()}>
                            <button
                              type="button"
                              class="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-blue-500 opacity-0 hover:opacity-100"
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              aria-label={`Resize ${header.id} column`}
                            />
                          </Show>
                        </th>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </thead>

            {/* Virtualized body */}
            <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {/* Spacer for virtual scrolling offset */}
              <Show when={rowVirtualizer().getVirtualItems().length > 0}>
                <tr
                  style={{
                    height: `${
                      rowVirtualizer().getVirtualItems()[0]?.start || 0
                    }px`,
                  }}
                />
              </Show>

              {/* Render only visible rows */}
              <For each={rowVirtualizer().getVirtualItems()}>
                {(virtualRow) => {
                  const row = table.getRowModel().rows[virtualRow.index];
                  if (!row) return null;

                  return (
                    <tr
                      class="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(row.original)}
                      data-index={virtualRow.index}
                    >
                      <For each={row.getVisibleCells()}>
                        {(cell) => (
                          <td
                            class="px-3 py-2 text-sm border-r border-gray-100 dark:border-gray-800"
                            style={{ width: `${cell.column.getSize()}px` }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        )}
                      </For>
                    </tr>
                  );
                }}
              </For>

              {/* Spacer for virtual scrolling after visible items */}
              <Show
                when={
                  rowVirtualizer().getVirtualItems().length > 0 &&
                  rowVirtualizer().getVirtualItems().length <
                    table.getRowModel().rows.length
                }
              >
                <tr
                  style={{
                    height: `${
                      rowVirtualizer().getTotalSize() -
                      (rowVirtualizer().getVirtualItems().at(-1)?.end || 0)
                    }px`,
                  }}
                />
              </Show>
            </tbody>
          </table>
        </div>
      </Show>

      {/* Empty state */}
      <Show
        when={
          !tunes.loading &&
          (!props.selectedPlaylistIds ||
            props.selectedPlaylistIds.length === 0 ||
            !playlistTunes.loading) &&
          filteredTunes().length === 0
        }
      >
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-lg text-gray-600 dark:text-gray-400">
              No tunes found
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
              {props.selectedPlaylistIds && props.selectedPlaylistIds.length > 0
                ? "No tunes in selected playlists match your filters"
                : "The catalog is empty"}
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
};
