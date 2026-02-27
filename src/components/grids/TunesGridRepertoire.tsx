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
import { useCurrentRepertoire } from "../../lib/context/CurrentRepertoireContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getRepertoireTunesStaged } from "../../lib/db/queries/repertoires";
import { getGoals } from "../../lib/db/queries/user-settings";
import { getViewColumnDescriptions } from "../../lib/db/queries/view-column-meta";
import * as schema from "../../lib/db/schema";
import type { Tune } from "../../lib/db/types";
import { GridStatusMessage } from "./GridStatusMessage";
import { TunesGrid } from "./TunesGrid";
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridRepertoire: Component<IGridBaseProps> = (props) => {
  const {
    localDb,
    repertoireListChanged,
    catalogListChanged,
    initialSyncComplete,
    user,
  } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();
  const { currentTuneId, setCurrentTuneId } = useCurrentTune();

  // Column visibility shared with parent; TunesGrid also persists internally
  const [columnVisibility, setColumnVisibility] = createSignal<VisibilityState>(
    props.columnVisibility || {}
  );

  createEffect(() => {
    props.onColumnVisibilityChange?.(columnVisibility());
  });

  // Fetch tunes for current repertoire (practice_list_staged view)
  const [repertoireTunesData] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const repertoireId = currentRepertoireId();
      const version = repertoireListChanged(); // Refetch when repertoire changes
      const syncComplete = initialSyncComplete();
      if (!syncComplete) return null;
      return db && userId && repertoireId
        ? { db, userId, repertoireId, version }
        : null;
    },
    async (params) => {
      if (!params) return [];
      return await getRepertoireTunesStaged(
        params.db,
        params.repertoireId,
        params.userId
      );
    }
  );

  // Fetch genres for name→id mapping
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = catalogListChanged(); // Refetch when catalog changes (genres are catalog data)
      return db ? { db, version } : null;
    },
    async (params) => {
      if (!params) return [];
      return await params.db.select().from(schema.genre).all();
    }
  );

  // Goals: load once per user for the GoalBadge dropdown.
  const [goalsData] = createResource(
    () => {
      const db = localDb();
      const uid = props.userId;
      return db && uid ? { db, uid } : null;
    },
    async (params) => {
      if (!params) return [];
      return getGoals(params.db, params.uid);
    }
  );

  // The view already returns ITuneOverview rows
  const tunes = createMemo<ITuneOverview[]>(
    () => repertoireTunesData.latest ?? repertoireTunesData() ?? []
  );

  // Client-side filter (search/type/mode/genre)
  const filteredTunes = createMemo<ITuneOverview[]>(() => {
    const base = tunes();
    const query = props.searchQuery?.trim().toLowerCase() || "";
    const types = props.selectedTypes || [];
    const modes = props.selectedModes || [];
    const genreNames = props.selectedGenreNames || [];
    const all = allGenres() || [];

    const genreById = new Map<string, string>();
    for (const g of all) {
      if (g.id && g.name) genreById.set(g.id, g.name);
    }

    return base.filter((t): boolean => {
      if (query) {
        const a = t.title?.toLowerCase().includes(query);
        const b = t.incipit?.toLowerCase().includes(query);
        const c = t.structure?.toLowerCase().includes(query);
        const d = t.composer?.toLowerCase().includes(query);
        const e = t.artist?.toLowerCase().includes(query);
        if (!a && !b && !c && !d && !e) return false;
      }
      if (types.length > 0 && t.type && !types.includes(t.type)) return false;
      if (modes.length > 0 && t.mode && !modes.includes(t.mode)) return false;
      if (genreNames.length > 0 && t.genre) {
        const tuneGenreName = genreById.get(t.genre) ?? t.genre;
        if (!genreNames.includes(tuneGenreName)) return false;
      }
      return true;
    });
  });

  // Row click: single selects, double opens editor
  const handleRowClick = (tune: Tune): void => {
    setCurrentTuneId(tune.id);
  };

  const handleRowDoubleClick = (tune: Tune): void => {
    // Double click: open tune editor via callback
    props.onTuneSelect?.(tune as unknown as ITuneOverview);
  };

  // Selection summary from inner grid
  const [selectedCount, setSelectedCount] = createSignal<number>(0);
  let innerTable: any | null = null;

  // Debug: Log selectedCount changes
  createEffect(() => {
    console.log(
      `[TunesGridRepertoire] selectedCount signal changed to: ${selectedCount()}`
    );
  });

  const loadError = createMemo(() => repertoireTunesData.error);
  const isInitialLoading = createMemo(
    () => repertoireTunesData.loading && repertoireTunesData.latest == null
  );
  const hasTunes = createMemo(() => filteredTunes().length > 0);

  const [columnDescriptions] = createResource(
    () => {
      const db = localDb();
      return db ? { db } : null;
    },
    async (params) => {
      if (!params) return {};
      return await getViewColumnDescriptions(params.db, "practice_list_staged");
    }
  );

  return (
    <div class="h-full flex flex-col">
      {/* Error */}
      <Show when={!!loadError()}>
        <GridStatusMessage
          variant="error"
          title="Unable to load repertoire"
          description="There was a problem loading your repertoire tunes."
          hint="Refresh the page. If this keeps happening, open the Sync menu and run Force Full Sync Down."
          error={loadError()}
        />
      </Show>

      {/* Loading */}
      <Show when={!loadError() && isInitialLoading()}>
        <GridStatusMessage
          variant="loading"
          title="Loading repertoire..."
          description="Syncing your repertoire tunes."
        />
      </Show>

      {/* Grid */}
      <Show when={!loadError() && !isInitialLoading() && hasTunes()}>
        <div class="flex-1 overflow-hidden">
          <TunesGrid
            tablePurpose="repertoire"
            userId={props.userId}
            repertoireId={currentRepertoireId() || undefined}
            data={filteredTunes()}
            columnDescriptions={columnDescriptions()}
            currentRowId={currentTuneId() || undefined}
            enableColumnReorder={true}
            onRowClick={(row) => handleRowClick(row as Tune)}
            onRowDoubleClick={(row) => handleRowDoubleClick(row as Tune)}
            columnVisibility={columnVisibility()}
            onColumnVisibilityChange={setColumnVisibility}
            cellCallbacks={{
              onRecallEvalChange: props.onRecallEvalChange,
              onGoalChange: props.onGoalChange,
              goals: () => goalsData() ?? [],
            }}
            onSelectionChange={(count) => {
              console.log(
                `[TunesGridRepertoire] onSelectionChange called with count: ${count}`
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
      </Show>

      {/* Empty state */}
      <Show when={!loadError() && !isInitialLoading() && !hasTunes()}>
        <GridStatusMessage
          variant="empty"
          title="No tunes in repertoire"
          description={
            tunes().length > 0
              ? "No tunes match your filters"
              : "Add tunes to your repertoire from the Catalog tab"
          }
        />
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
