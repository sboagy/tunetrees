/**
 * Catalog Page
 *
 * Complete database of all tunes (not just repertoire).
 * Provides full CRUD operations and search/filter functionality.
 *
 * Features:
 * - Inline search and filter controls in banner
 * - TunesGridCatalog with sticky headers and virtualization
 * - Row selection and bulk operations
 * - Column sorting and resizing
 *
 * @module routes/catalog
 */

import { useNavigate, useSearchParams } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
} from "solid-js";
import { CatalogToolbar } from "../components/catalog";
import { TunesGridCatalog } from "../components/grids";
import type { ITuneOverview } from "../components/grids/types";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../lib/context/CurrentPlaylistContext";
import { getUserPlaylists } from "../lib/db/queries/playlists";
import { getTunesForUser } from "../lib/db/queries/tunes";
import * as schema from "../lib/db/schema";
import { log } from "../lib/logger";

/**
 * Catalog Page Component
 *
 * @example
 * ```tsx
 * <Route path="/catalog" component={CatalogPage} />
 * ```
 */
const CatalogPage: Component = () => {
  const navigate = useNavigate();
  const { user, localDb, syncVersion } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Filter state from URL params
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
  const [selectedPlaylistIds, setSelectedPlaylistIds] = createSignal<number[]>(
    getParamArray(searchParams.playlists)
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => !Number.isNaN(id))
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

    if (selectedPlaylistIds().length > 0) {
      params.playlists = selectedPlaylistIds().join(",");
    }

    setSearchParams(params, { replace: true });
  });

  // Fetch all tunes for filter options
  const [allTunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = syncVersion(); // Triggers refetch when sync completes
      log.debug("CATALOG allTunes dependency:", {
        hasDb: !!db,
        userId,
        syncVersion: version,
      });
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      log.debug("CATALOG allTunes fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await getTunesForUser(params.db, params.userId);
      log.debug("CATALOG allTunes result:", result.length, "tunes");
      return result;
    }
  );

  // Fetch user playlists for filter options
  const [userPlaylists] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = syncVersion(); // Triggers refetch when sync completes
      log.debug("CATALOG userPlaylists dependency:", {
        hasDb: !!db,
        userId,
        syncVersion: version,
      });
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      log.debug("CATALOG userPlaylists fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await getUserPlaylists(params.db, params.userId);
      log.debug("CATALOG userPlaylists result:", result.length, "playlists");
      return result;
    }
  );

  // Fetch all genres for proper genre names
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = syncVersion(); // Triggers refetch when sync completes
      log.debug("CATALOG allGenres dependency:", {
        hasDb: !!db,
        syncVersion: version,
      });
      return db ? { db, version } : null;
    },
    async (params) => {
      log.debug("CATALOG allGenres fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await params.db.select().from(schema.genre).all();
      log.debug("CATALOG allGenres result:", result.length, "genres");
      return result;
    }
  );

  // Get unique types, modes, genres for filter dropdowns
  const availableTypes = createMemo(() => {
    const tunes = allTunes() || [];
    const types = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.type) types.add(tune.type);
    });
    return Array.from(types).sort();
  });

  const availableModes = createMemo(() => {
    const tunes = allTunes() || [];
    const modes = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.mode) modes.add(tune.mode);
    });
    return Array.from(modes).sort();
  });

  const availableGenres = createMemo(() => {
    const tunes = allTunes() || [];
    const genres = allGenres() || [];

    log.debug("CATALOG availableGenres:", {
      tunesCount: tunes.length,
      genresCount: genres.length,
      isLoading: allGenres.loading,
    });

    // If genres are still loading, return empty array
    if (allGenres.loading || genres.length === 0) {
      log.debug("CATALOG availableGenres: loading or no genres");
      return [];
    }

    // Get unique genre IDs from tunes
    const genreIds = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.genre) genreIds.add(tune.genre);
    });

    log.debug("CATALOG Genre IDs from tunes:", Array.from(genreIds));

    // Map genre IDs to genre names
    const genreNames: string[] = [];
    genreIds.forEach((genreId) => {
      const genre = genres.find((g) => g.id === genreId);
      if (genre?.name) {
        genreNames.push(genre.name);
        log.debug(`CATALOG Found genre: ${genreId} -> ${genre.name}`);
      } else {
        log.warn(`CATALOG Genre ID not found: "${genreId}"`, {
          availableIds: genres.map((g) => g.id),
        });
      }
    });

    log.debug("CATALOG Final genre names:", genreNames);
    return genreNames.sort();
  });

  // Handle tune selection
  const handleTuneSelect = (tune: ITuneOverview) => {
    navigate(`/tunes/${tune.id}`);
  };

  return (
    <div class="h-full flex flex-col">
      {/* Toolbar with Search and Filters */}
      <Show when={!allTunes.loading}>
        <CatalogToolbar
          searchQuery={searchQuery()}
          onSearchChange={setSearchQuery}
          selectedTypes={selectedTypes()}
          onTypesChange={setSelectedTypes}
          selectedModes={selectedModes()}
          onModesChange={setSelectedModes}
          selectedGenres={selectedGenres()}
          onGenresChange={setSelectedGenres}
          selectedPlaylistIds={selectedPlaylistIds()}
          onPlaylistIdsChange={setSelectedPlaylistIds}
          availableTypes={availableTypes()}
          availableModes={availableModes()}
          availableGenres={availableGenres()}
          availablePlaylists={userPlaylists() || []}
          selectedRowsCount={selectedRowsCount()}
          table={tableInstance() || undefined}
        />
      </Show>

      {/* Grid wrapper - overflow-hidden constrains grid height, padding provides spacing */}
      <div class="flex-1 overflow-hidden p-4 md:p-6">
        <Show when={user()}>
          <TunesGridCatalog
            userId={Number.parseInt(user()!.id)}
            playlistId={currentPlaylistId() || 0}
            tablePurpose="catalog"
            searchQuery={searchQuery()}
            selectedTypes={selectedTypes()}
            selectedModes={selectedModes()}
            selectedGenreNames={selectedGenres()}
            allGenres={allGenres() || []}
            selectedPlaylistIds={selectedPlaylistIds()}
            onTuneSelect={handleTuneSelect}
            onSelectionChange={setSelectedRowsCount}
            onTableReady={setTableInstance}
          />
        </Show>
      </div>
    </div>
  );
};

export default CatalogPage;
