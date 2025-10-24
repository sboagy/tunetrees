/**
 * Repertoire Page
 *
 * Displays the user's repertoire (tunes in the current playlist).
 * Features complete grid with filters, search, and sidebar integration.
 *
 * Port from: legacy/frontend/app/(main)/pages/practice/components/TunesGridRepertoire.tsx
 *
 * @module routes/repertoire
 */

import { useNavigate, useSearchParams } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import { sql } from "drizzle-orm";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { TunesGridRepertoire } from "../components/grids";
import { GRID_CONTENT_CONTAINER } from "../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../components/grids/types";
import { RepertoireToolbar } from "../components/repertoire";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../lib/context/CurrentPlaylistContext";
import { getPlaylistTunes } from "../lib/db/queries/playlists";
import * as schema from "../lib/db/schema";
import { log } from "../lib/logger";

/**
 * Repertoire Page Component
 *
 * Features:
 * - RepertoireToolbar with filters (Type, Mode, Genre, Search)
 * - TunesGridRepertoire with virtual scrolling and advanced features
 * - Sidebar integration for current tune display
 * - State persistence to localStorage
 *
 * @example
 * ```tsx
 * <Route path="/repertoire" component={RepertoirePage} />
 * ```
 */
const RepertoirePage: Component = () => {
  const navigate = useNavigate();
  const { user, localDb, syncVersion } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current user's local database ID from user_profile
  const [userId] = createResource(
    () => {
      const db = localDb();
      const currentUser = user();
      const version = syncVersion(); // Trigger refetch on sync
      return db && currentUser ? { db, userId: currentUser.id, version } : null;
    },
    async (params) => {
      if (!params) return null;
      const result = await params.db.all<{ id: number }>(
        sql`SELECT id FROM user_profile WHERE supabase_user_id = ${params.userId} LIMIT 1`
      );
      return result[0]?.id ?? null;
    }
  );

  // Helper to safely get string from searchParams
  const getParam = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] || "";
    return value || "";
  };

  // Helper to safely get array from searchParams
  const getParamArray = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    const str = Array.isArray(value) ? value[0] || "" : value;
    return str.split(",").filter(Boolean);
  };

  // Filter state from URL params (NO playlist filter - that's implied by current playlist)
  const [searchQuery, setSearchQuery] = createSignal(getParam(searchParams.q));
  const [selectedTypes, setSelectedTypes] = createSignal<string[]>(
    getParamArray(searchParams.types)
  );
  const [selectedModes, setSelectedModes] = createSignal<string[]>(
    getParamArray(searchParams.modes)
  );
  const [selectedGenres, setSelectedGenres] = createSignal<string[]>(
    getParamArray(searchParams.genres)
  );

  // Track selected rows count from grid
  const [selectedRowsCount, setSelectedRowsCount] = createSignal(0);

  // Track table instance for column visibility control
  const [tableInstance, setTableInstance] = createSignal<Table<any> | null>(
    null
  );

  // Sync filter state to URL params
  createEffect(() => {
    const params: Record<string, string> = {};

    if (searchQuery()) {
      params.q = searchQuery();
    }

    if (selectedTypes().length > 0) {
      params.types = selectedTypes().join(",");
    }

    if (selectedModes().length > 0) {
      params.modes = selectedModes().join(",");
    }

    if (selectedGenres().length > 0) {
      params.genres = selectedGenres().join(",");
    }

    setSearchParams(params, { replace: true });
  });

  // Fetch tunes in current playlist for filter options
  const [playlistTunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const playlistId = currentPlaylistId();
      const version = syncVersion(); // Triggers refetch when sync completes
      log.debug("REPERTOIRE playlistTunes dependency:", {
        hasDb: !!db,
        userId,
        playlistId,
        syncVersion: version,
      });
      return db && userId && playlistId
        ? { db, userId, playlistId, version }
        : null;
    },
    async (params) => {
      log.debug("REPERTOIRE playlistTunes fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await getPlaylistTunes(
        params.db,
        params.playlistId,
        params.userId
      );
      log.debug("REPERTOIRE playlistTunes result:", result.length, "tunes");
      return result;
    }
  );

  // Fetch all genres for proper genre names
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = syncVersion(); // Triggers refetch when sync completes
      log.debug("REPERTOIRE allGenres dependency:", {
        hasDb: !!db,
        syncVersion: version,
      });
      return db ? { db, version } : null;
    },
    async (params) => {
      log.debug("REPERTOIRE allGenres fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await params.db.select().from(schema.genre).all();
      log.debug("REPERTOIRE allGenres result:", result.length, "genres");
      return result;
    }
  );

  // Get unique types, modes, genres for filter dropdowns
  const availableTypes = createMemo(() => {
    const tunes = playlistTunes() || [];
    const types = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.tune.type) types.add(tune.tune.type);
    });
    return Array.from(types).sort();
  });

  const availableModes = createMemo(() => {
    const tunes = playlistTunes() || [];
    const modes = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.tune.mode) modes.add(tune.tune.mode);
    });
    return Array.from(modes).sort();
  });

  const availableGenres = createMemo(() => {
    const tunes = playlistTunes() || [];
    const genres = allGenres() || [];

    log.debug("REPERTOIRE availableGenres:", {
      tunesCount: tunes.length,
      genresCount: genres.length,
      isLoading: allGenres.loading,
    });

    // If genres are still loading, return empty array
    if (allGenres.loading || genres.length === 0) {
      log.debug("REPERTOIRE availableGenres: loading or no genres");
      return [];
    }

    // Get unique genre IDs from tunes
    const genreIds = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.tune.genre) genreIds.add(tune.tune.genre);
    });

    log.debug("REPERTOIRE Genre IDs from tunes:", Array.from(genreIds));

    // Map genre IDs to genre names
    const genreNames: string[] = [];
    genreIds.forEach((genreId) => {
      const genre = genres.find((g) => g.id === genreId);
      if (genre?.name) {
        genreNames.push(genre.name);
        log.debug(`REPERTOIRE Found genre: ${genreId} -> ${genre.name}`);
      } else {
        log.warn(`REPERTOIRE Genre ID not found: "${genreId}"`, {
          availableIds: genres.map((g) => g.id),
        });
      }
    });

    log.debug("REPERTOIRE Final genre names:", genreNames);
    return genreNames.sort();
  });

  // Handle tune selection
  const handleTuneSelect = (tune: ITuneOverview) => {
    navigate(`/tunes/${tune.id}`);
  };

  // Handle remove from repertoire
  const handleRemoveFromRepertoire = async () => {
    // TODO: Implement removal logic
    alert("Remove From Repertoire - Not yet implemented");
  };

  return (
    <div class="h-full flex flex-col">
      {/* Toolbar with Search and Filters */}
      <Show when={!playlistTunes.loading && currentPlaylistId()}>
        <RepertoireToolbar
          searchQuery={searchQuery()}
          onSearchChange={setSearchQuery}
          selectedTypes={selectedTypes()}
          onTypesChange={setSelectedTypes}
          selectedModes={selectedModes()}
          onModesChange={setSelectedModes}
          selectedGenres={selectedGenres()}
          onGenresChange={setSelectedGenres}
          availableTypes={availableTypes()}
          availableModes={availableModes()}
          availableGenres={availableGenres()}
          selectedRowsCount={selectedRowsCount()}
          table={tableInstance() || undefined}
          onRemoveFromRepertoire={handleRemoveFromRepertoire}
          playlistId={currentPlaylistId() || undefined}
        />
      </Show>

      {/* Grid wrapper - overflow-hidden constrains grid height */}
      <div class={GRID_CONTENT_CONTAINER}>
        <Show when={userId() && currentPlaylistId()}>
          <TunesGridRepertoire
            userId={userId()!}
            playlistId={currentPlaylistId()!}
            tablePurpose="repertoire"
            searchQuery={searchQuery()}
            selectedTypes={selectedTypes()}
            selectedModes={selectedModes()}
            selectedGenreNames={selectedGenres()}
            allGenres={allGenres() || []}
            onTuneSelect={handleTuneSelect}
            onSelectionChange={setSelectedRowsCount}
            onTableReady={setTableInstance}
          />
        </Show>

        {/* No playlist selected message */}
        <Show when={!currentPlaylistId()}>
          <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <p class="text-lg text-gray-600 dark:text-gray-400">
                No playlist selected
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Please select a playlist to view your repertoire
              </p>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default RepertoirePage;
