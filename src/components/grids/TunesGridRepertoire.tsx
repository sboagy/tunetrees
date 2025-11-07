/**
 * Tunes Grid Repertoire Component (wrapper)
 *
 * Refactored to use the shared <TunesGrid> component for table, virtualization,
 * scroll persistence, resizing, and column reordering. Wrapper handles data
 * fetching, client-side filtering, selection summary, and row click behavior.
 */
import type { VisibilityState } from "@tanstack/solid-table";
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
import { getPlaylistTunesStaged } from "../../lib/db/queries/playlists";
import * as schema from "../../lib/db/schema";
import type { Tune } from "../../lib/db/types";
import { TunesGrid } from "./TunesGrid";
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridRepertoire: Component<IGridBaseProps> = (props) => {
  const { localDb, syncVersion, initialSyncComplete, user } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // Column visibility shared with parent; TunesGrid also persists internally
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    props.columnVisibility || {}
  );

  createEffect(() => {
    props.onColumnVisibilityChange?.(columnVisibility());
  });

  // Fetch tunes for current playlist (practice_list_staged view)
  const [playlistTunesData] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const playlistId = currentPlaylistId();
      const version = syncVersion();
      const syncComplete = initialSyncComplete();
      if (!syncComplete) return null;
      return db && userId && playlistId
        ? { db, userId, playlistId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return await getPlaylistTunesStaged(
        params.db,
        params.playlistId,
        params.userId
      );
    }
  );

  // Fetch genres for name→id mapping
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = syncVersion();
      return db ? { db, version } : null;
    },
    async (params) => {
      if (!params) return [];
      return await params.db.select().from(schema.genre).all();
    }
  );

  // The view already returns ITuneOverview rows
  const tunes = createMemo<ITuneOverview[]>(() => playlistTunesData() || []);

  // Client-side filter (search/type/mode/genre)
  const filteredTunes = createMemo<ITuneOverview[]>(() => {
    const base = tunes();
    const query = props.searchQuery?.trim().toLowerCase() || "";
    const types = props.selectedTypes || [];
    const modes = props.selectedModes || [];
    const genreNames = props.selectedGenreNames || [];
    const all = allGenres() || [];

    const genreIds: number[] = [];
    if (genreNames.length > 0) {
      for (const name of genreNames) {
        const g = all.find((x) => x.name === name);
        if (g) genreIds.push(Number(g.id));
      }
    }

    return base.filter((t): boolean => {
      if (query) {
        const a = t.title?.toLowerCase().includes(query);
        const b = t.incipit?.toLowerCase().includes(query);
        const c = t.structure?.toLowerCase().includes(query);
        if (!a && !b && !c) return false;
      }
      if (types.length > 0 && t.type && !types.includes(t.type)) return false;
      if (modes.length > 0 && t.mode && !modes.includes(t.mode)) return false;
      if (genreIds.length > 0 && t.genre_ref && !genreIds.includes(t.genre_ref))
        return false;
      return true;
    });
  });

  // Row click: single selects, double opens editor
  let clickTimeout: ReturnType<typeof setTimeout> | null = null;
  let clickCount = 0;
  const handleRowClick = (tune: Tune): void => {
    clickCount++;
    if (clickTimeout) clearTimeout(clickTimeout);
    if (clickCount === 1) {
      clickTimeout = setTimeout(() => {
        setCurrentTuneId(tune.id);
        clickCount = 0;
      }, 250);
    } else if (clickCount === 2) {
      clickCount = 0;
      if (clickTimeout) clearTimeout(clickTimeout);
      props.onTuneSelect?.(tune as unknown as ITuneOverview);
    }
  };

  // Selection summary from inner grid
  const [selectedCount, setSelectedCount] = createSignal<number>(0);
  let innerTable: any | null = null;

  return (
    <div class="h-full flex flex-col">
      {/* Loading */}
      <Show when={playlistTunesData.loading}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              Loading repertoire...
            </p>
          </div>
        </div>
      </Show>

      {/* Grid */}
      <Show when={!playlistTunesData.loading && filteredTunes().length > 0}>
        <div class="flex-1 overflow-hidden">
          <TunesGrid
            tablePurpose="repertoire"
            userId={props.userId}
            playlistId={currentPlaylistId() || undefined}
            data={filteredTunes()}
            currentRowId={currentTuneId() || undefined}
            enableColumnReorder={true}
            onRowClick={(row) => handleRowClick(row as Tune)}
            columnVisibility={columnVisibility()}
            onColumnVisibilityChange={setColumnVisibility}
            cellCallbacks={{
              onRecallEvalChange: props.onRecallEvalChange,
              onGoalChange: props.onGoalChange,
            }}
            onSelectionChange={(count) => {
              setSelectedCount(count);
              props.onSelectionChange?.(count);
            }}
            onTableReady={(tbl) => {
              innerTable = tbl as any;
              props.onTableReady?.(tbl as any);
            }}
          />
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!playlistTunesData.loading && filteredTunes().length === 0}>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <p class="text-lg text-gray-600 dark:text-gray-400">
              No tunes in repertoire
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
              {tunes().length > 0
                ? "No tunes match your filters"
                : "Add tunes to your repertoire from the Catalog tab"}
            </p>
          </div>
        </div>
      </Show>

      {/* Footer with tune count and selection info - Always visible */}
      <div class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 flex-shrink-0">
        <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {filteredTunes().length}{" "}
            {filteredTunes().length === 1 ? "tune" : "tunes"} in repertoire
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
