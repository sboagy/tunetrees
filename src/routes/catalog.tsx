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
      console.log("🔍 CATALOG allTunes dependency function called:", {
        hasDb: !!db,
        userId,
        syncVersion: version,
      });
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      console.log("🔍 CATALOG allTunes fetcher called:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await getTunesForUser(params.db, params.userId);
      console.log(
        "🔍 CATALOG allTunes fetcher result:",
        result.length,
        "tunes"
      );
      return result;
    }
  );

  // Fetch user playlists for filter options
  const [userPlaylists] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = syncVersion(); // Triggers refetch when sync completes
      console.log("🔍 CATALOG userPlaylists dependency function called:", {
        hasDb: !!db,
        userId,
        syncVersion: version,
      });
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      console.log("🔍 CATALOG userPlaylists fetcher called:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await getUserPlaylists(params.db, params.userId);
      console.log(
        "🔍 CATALOG userPlaylists fetcher result:",
        result.length,
        "playlists"
      );
      return result;
    }
  );

  // Fetch all genres for proper genre names
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = syncVersion(); // Triggers refetch when sync completes
      console.log("🔍 CATALOG allGenres dependency function called:", {
        hasDb: !!db,
        syncVersion: version,
      });
      return db ? { db, version } : null;
    },
    async (params) => {
      console.log("🔍 CATALOG allGenres fetcher called:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await params.db.select().from(schema.genre).all();
      console.log(
        "🔍 CATALOG allGenres fetcher result:",
        result.length,
        "genres"
      );
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

    console.log("🔍 DEBUG availableGenres:", {
      tunesCount: tunes.length,
      genresCount: genres.length,
      isLoading: allGenres.loading,
      firstFewGenres: genres
        .slice(0, 3)
        .map((g) => ({ id: g.id, name: g.name })),
      firstFewTuneGenres: tunes
        .slice(0, 5)
        .map((t) => ({ title: t.title, genre: t.genre })),
    });

    // If genres are still loading, return empty array
    if (allGenres.loading || genres.length === 0) {
      console.log("🔍 EARLY RETURN: loading or no genres");
      return [];
    }

    // Get unique genre IDs from tunes
    const genreIds = new Set<string>();
    tunes.forEach((tune) => {
      if (tune.genre) genreIds.add(tune.genre);
    });

    console.log("🔍 Genre IDs from tunes:", Array.from(genreIds));

    // Map genre IDs to genre names
    const genreNames: string[] = [];
    genreIds.forEach((genreId) => {
      const genre = genres.find((g) => g.id === genreId);
      if (genre?.name) {
        genreNames.push(genre.name);
        console.log(`🔍 FOUND genre: ${genreId} -> ${genre.name}`);
      } else {
        console.log(`🔍 NOT FOUND genre ID: "${genreId}" (not in genre table)`);
        console.log(
          `🔍 Available genre IDs:`,
          genres.map((g) => g.id)
        );
      }
    });

    console.log("🔍 Final genre names:", genreNames);
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
        />
      </Show>

      {/* Grid */}
      <div class="flex-1 overflow-hidden">
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
          />
        </Show>
      </div>
    </div>
  );
};

export default CatalogPage;
