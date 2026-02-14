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
import { useCurrentRepertoire } from "../../lib/context/CurrentRepertoireContext";
import { useCurrentTune } from "../../lib/context/CurrentTuneContext";
import { getRepertoireTunes } from "../../lib/db/queries/repertoires";
import { getTunesForUser } from "../../lib/db/queries/tunes";
import { getViewColumnDescriptions } from "../../lib/db/queries/view-column-meta";
import * as schema from "../../lib/db/schema";
import type { Tune } from "../../lib/db/types";
import { GridStatusMessage } from "./GridStatusMessage";
import { TunesGrid } from "./TunesGrid";
// Table state persistence is handled inside TunesGrid
import type { IGridBaseProps, ITuneOverview } from "./types";

export const TunesGridCatalog: Component<IGridBaseProps> = (props) => {
  const { localDb, catalogListChanged, initialSyncComplete, user } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();
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
  // CRITICAL: Must wait for initialSyncComplete before fetching tunes.
  // user_genre_selection data is needed to filter genres, and it's only
  // available after sync completes. Without this check, getTunesForUser
  // returns ALL tunes (unfiltered) because selectedGenreIds is empty.
  const [tunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = catalogListChanged(); // Refetch when catalog changes
      const syncComplete = initialSyncComplete();

      // MUST wait for sync to complete so user_genre_selection is loaded
      if (!syncComplete) {
        return null;
      }

      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (!params) return [];
      return await getTunesForUser(params.db, params.userId);
    }
  );

  const selectedRepertoireIds = createMemo(
    () => props.selectedRepertoireIds ?? []
  );

  // Fetch tunes from selected repertoires (when repertoire filter is active)
  const [repertoireTunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const repertoireIds = selectedRepertoireIds();
      return db && userId && repertoireIds.length > 0
        ? { db, userId, repertoireIds }
        : null;
    },
    async (params) => {
      if (!params) return [];

      // Fetch tunes from all selected repertoires
      const allRepertoireTunes: Tune[] = [];
      for (const repertoireId of params.repertoireIds) {
        try {
          const repertoireData = await getRepertoireTunes(
            params.db,
            repertoireId,
            params.userId
          );
          // getRepertoireTunes returns RepertoireTuneWithDetails[], but we need the tune data
          // Let's extract the tune IDs and fetch them separately
          const tuneIds = repertoireData.map((pt) => pt.tuneRef);
          const repertoireTuneData = await Promise.all(
            tuneIds.map(async (tuneId) => {
              const result = await params.db
                .select()
                .from(schema.tune)
                .where(eq(schema.tune.id, tuneId))
                .limit(1);
              return result[0];
            })
          );
          allRepertoireTunes.push(...repertoireTuneData.filter(Boolean));
        } catch (error) {
          console.warn(
            `Failed to fetch tunes for repertoire ${repertoireId}:`,
            error
          );
        }
      }

      // Remove duplicates (same tune could be in multiple selected repertoires)
      const uniqueTunes = allRepertoireTunes.filter(
        (tune, index, arr) => arr.findIndex((t) => t.id === tune.id) === index
      );

      return uniqueTunes;
    }
  );

  // Apply client-side filtering
  // Type Contract: Input is Tune[], Output is Tune[], filtered by search/type/mode/genre/repertoire
  const filteredTunes = createMemo<Tune[]>(() => {
    // Determine base tune set: if repertoire filter is active, use repertoire tunes, otherwise all tunes
    const baseTunes: Tune[] =
      selectedRepertoireIds().length > 0
        ? repertoireTunes() || []
        : tunes() || [];

    const query = props.searchQuery?.trim().toLowerCase() || "";
    const types = props.selectedTypes || [];
    const modes = props.selectedModes || [];
    const genreNames = props.selectedGenreNames || [];
    const allGenres = props.allGenres || [];

    const genreById = new Map<string, string>();
    for (const g of allGenres) {
      if (g.id && g.name) genreById.set(g.id, g.name);
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
      if (genreNames.length > 0 && tune.genre) {
        const tuneGenreName = genreById.get(tune.genre) ?? tune.genre;
        if (!genreNames.includes(tuneGenreName)) return false;
      }

      return true;
    });
  });

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

  const isRepertoireFilterActive = createMemo(
    () => selectedRepertoireIds().length > 0
  );
  const isLoading = createMemo(
    () => tunes.loading || (isRepertoireFilterActive() && repertoireTunes.loading)
  );
  const loadError = createMemo(() => tunes.error || repertoireTunes.error);
  const hasTunes = createMemo(() => filteredTunes().length > 0);

  return (
    <div class="h-full flex flex-col">
      {/* Error */}
      <Show when={!!loadError()}>
        <GridStatusMessage
          variant="error"
          title="Unable to load catalog"
          description="There was a problem loading your catalog tunes."
          hint="Refresh the page. If this keeps happening, open the Sync menu and run Force Full Sync Down."
          error={loadError()}
        />
      </Show>
      {/* Loading state */}
      <Show when={!loadError() && isLoading()}>
        <GridStatusMessage
          variant="loading"
          title="Loading catalog..."
          description="Syncing your catalog tunes."
        />
      </Show>
      {/* Table container with virtualization */}
      <Show when={!loadError() && !isLoading() && hasTunes()}>
        <div class="flex-1 overflow-hidden">
          <TunesGrid
            tablePurpose="catalog"
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
      <Show when={!loadError() && !isLoading() && !hasTunes()}>
        <GridStatusMessage
          variant="empty"
          title="No tunes found"
          description={
            isRepertoireFilterActive()
              ? "No tunes in selected repertoires match your filters"
              : "The catalog is empty"
          }
        />
      </Show>
      {/* Footer with tune count and selection info - Always visible */}
      <div class="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2 flex-shrink-0">
        <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {filteredTunes().length}{" "}
            {filteredTunes().length === 1 ? "tune" : "tunes"}
            {selectedRepertoireIds().length > 0 && (
              <span class="ml-1 text-gray-500 dark:text-gray-500">
                in selected{" "}
                {selectedRepertoireIds().length === 1
                  ? "repertoire"
                  : "repertoires"}
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
