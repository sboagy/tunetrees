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

import type { VisibilityState } from "@tanstack/solid-table";
import { eq } from "drizzle-orm";
// import { GripVertical } from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getPlaylistTunes } from "../../lib/db/queries/playlists";
import { getTunesForUser } from "../../lib/db/queries/tunes";
import * as schema from "../../lib/db/schema";
import type { Tune } from "../../lib/db/types";
import { TunesGrid } from "./TunesGrid";
// Table state persistence is handled inside TunesGrid
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridCatalog: Component<IGridBaseProps> = (props) => {
  const { localDb, catalogListChanged, initialSyncComplete } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // Column visibility is shared with parent (TunesGrid persists internally)
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    props.columnVisibility || {}
  );

  // Sync column visibility changes to parent
  createEffect(() => {
    if (props.onColumnVisibilityChange) {
      props.onColumnVisibilityChange(columnVisibility());
    }
  });

  // (Drag state removed; reordering not handled at wrapper level)

  // Fetch tunes data
  const [tunes] = createResource(
    () => {
      const db = localDb();
      const userId = useAuth().user()?.id;
      const version = catalogListChanged(); // Refetch when catalog changes
      const syncComplete = initialSyncComplete(); // Wait for initial sync

      if (!syncComplete) {
        console.log(
          "[TunesGridCatalog] Waiting for initial sync to complete..."
        );
        return null;
      }

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
        const matchesComposer = tune.composer?.toLowerCase().includes(query);
        const matchesArtist = tune.artist?.toLowerCase().includes(query);
        if (
          !matchesTitle &&
          !matchesIncipit &&
          !matchesStructure &&
          !matchesComposer &&
          !matchesArtist
        ) {
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

  // Columns are derived inside TunesGrid via getColumns("catalog")

  // Table instance will be provided by TunesGrid via onTableReady

  // (Scroll, DnD, and virtualizer are handled inside TunesGrid)

  // Handle row click and double-click
  const handleRowClick = (tune: Tune): void => {
    setCurrentTuneId(tune.id);
  };

  const handleRowDoubleClick = (tune: Tune): void => {
    // Double click: open tune editor via callback
    props.onTuneSelect?.(tune as unknown as ITuneOverview);
  };

  // Selection count provided by TunesGrid
  const [selectedCount, setSelectedCount] = createSignal<number>(0);
  let innerTable: any | null = null;

  // Debug: Log selectedCount changes
  createEffect(() => {
    console.log(
      `[TunesGridCatalog] selectedCount signal changed to: ${selectedCount()}`
    );
  });

  return (
    <div class="h-full flex flex-col">
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
        <div class="flex-1 overflow-hidden">
          <TunesGrid
            tablePurpose="catalog"
            userId={props.userId}
            playlistId={currentPlaylistId() || undefined}
            data={filteredTunes()}
            currentRowId={currentTuneId() || undefined}
            enableColumnReorder={true}
            onRowClick={(row) => handleRowClick(row as Tune)}
            onRowDoubleClick={(row) => handleRowDoubleClick(row as Tune)}
            columnVisibility={columnVisibility()}
            onColumnVisibilityChange={setColumnVisibility}
            cellCallbacks={{
              onRecallEvalChange: props.onRecallEvalChange,
              onGoalChange: props.onGoalChange,
            }}
            onSelectionChange={(count) => {
              console.log(
                `[TunesGridCatalog] onSelectionChange called with count: ${count}`
              );
              setSelectedCount(count);
              props.onSelectionChange?.(count);
            }}
            onTableReady={(tbl) => {
              innerTable = tbl as any;
              props.onTableReady?.(tbl as any);
            }}
          />
        </div>
      </Show>{" "}
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
      {/* Footer with tune count and selection info - Always visible */}
      <div class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 flex-shrink-0">
        <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {filteredTunes().length}{" "}
            {filteredTunes().length === 1 ? "tune" : "tunes"}
            {props.selectedPlaylistIds &&
              props.selectedPlaylistIds.length > 0 && (
                <span class="ml-1 text-gray-500 dark:text-gray-500">
                  in selected{" "}
                  {props.selectedPlaylistIds.length === 1
                    ? "playlist"
                    : "playlists"}
                </span>
              )}
          </span>
          <Show when={selectedCount() > 0}>
            <span class="text-blue-700 dark:text-blue-300">
              {selectedCount()} {selectedCount() === 1 ? "tune" : "tunes"}{" "}
              selected
              <button
                type="button"
                class="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                onClick={() => innerTable?.toggleAllRowsSelected?.(false)}
              >
                Clear selection
              </button>
            </span>
          </Show>
        </div>
      </div>
    </div>
  );
};
