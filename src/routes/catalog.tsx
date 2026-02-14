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

import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  Show,
} from "solid-js";
import { CatalogToolbar } from "../components/catalog";
import { TunesGridCatalog } from "../components/grids";
import { GRID_CONTENT_CONTAINER } from "../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../components/grids/types";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentRepertoire } from "../lib/context/CurrentRepertoireContext";
import { getUserRepertoires } from "../lib/db/queries/repertoires";
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
  const location = useLocation();
  const { user, localDb, catalogListChanged } = useAuth();
  const { currentRepertoireId } = useCurrentRepertoire();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current user ID
  const userId = createMemo(() => user()?.id ?? null);

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

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  // --- Filter State Signals (Initialized to empty defaults) ---
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTypes, setSelectedTypes] = createSignal<string[]>([]);
  const [selectedModes, setSelectedModes] = createSignal<string[]>([]);
  const [selectedGenres, setSelectedGenres] = createSignal<string[]>([]);
  const [selectedRepertoireIds, setSelectedRepertoireIds] = createSignal<
    string[]
  >([]);

  // --- Synchronization State Flag ---
  const [isInitialized, setIsInitialized] = createSignal(false);

  // Track selected rows count from grid
  const [selectedRowsCount, setSelectedRowsCount] = createSignal(0);

  // Track table instance for column visibility control
  const [tableInstance, setTableInstance] = createSignal<Table<any> | null>(
    null
  );

  // Track filter panel expanded state
  const [filterPanelExpanded, setFilterPanelExpanded] = createSignal(false);

  // === EFFECT 1: HYDRATION (URL -> Signal) ===
  // Runs whenever searchParams changes. This resolves the initial race condition
  // by ensuring signals are populated before the sync effect (Effect 2) runs.
  createEffect(
    on(
      // Dependency Array: Explicitly list every parameter to watch.
      () => [
        searchParams.c_q,
        searchParams.c_types,
        searchParams.c_modes,
        searchParams.c_genres,
        searchParams.c_repertoires,
        searchParams.tab, // Crucial for re-hydration when switching tabs
      ],
      () => {
        // 1. Read URL params
        const q = getParam(searchParams.c_q);
        const types = getParamArray(searchParams.c_types);
        const modes = getParamArray(searchParams.c_modes);
        const genres = getParamArray(searchParams.c_genres);
        const repertoires = getParamArray(searchParams.c_repertoires);

        // 2. Write to signals only if different (essential to prevent infinite loops)
        if (q !== searchQuery()) setSearchQuery(q);
        if (!arraysEqual(types, selectedTypes())) setSelectedTypes(types);
        if (!arraysEqual(modes, selectedModes())) setSelectedModes(modes);
        if (!arraysEqual(genres, selectedGenres())) setSelectedGenres(genres);
        if (!arraysEqual(repertoires, selectedRepertoireIds()))
          setSelectedRepertoireIds(repertoires);

        // 3. Set initialization flag *after* the initial hydration is complete
        if (!isInitialized()) {
          setIsInitialized(true);
          log.debug("CATALOG: Filter state initialized from URL.");
        }
      }
    )
  );

  // === EFFECT 2: SYNCHRONIZATION (Signal -> URL) ===
  // Runs whenever internal filter signals change (user interaction). Writes to URL.
  createEffect(() => {
    if (!isInitialized()) return;

    const current = {
      q: getParam(searchParams.c_q),
      types: getParamArray(searchParams.c_types),
      modes: getParamArray(searchParams.c_modes),
      genres: getParamArray(searchParams.c_genres),
      repertoires: getParamArray(searchParams.c_repertoires),
    };

    const desired = {
      q: searchQuery(),
      types: selectedTypes(),
      modes: selectedModes(),
      genres: selectedGenres(),
      repertoires: selectedRepertoireIds(),
    };

    const needsUpdate =
      desired.q !== current.q ||
      !arraysEqual(desired.types, current.types) ||
      !arraysEqual(desired.modes, current.modes) ||
      !arraysEqual(desired.genres, current.genres) ||
      !arraysEqual(desired.repertoires, current.repertoires);

    if (!needsUpdate) return;

    const params: Record<string, string | undefined> = {
      // Explicitly set parameter keys, passing `undefined` if the signal is empty.
      c_q: desired.q || undefined,
      c_types: desired.types.length > 0 ? desired.types.join(",") : undefined,
      c_modes: desired.modes.length > 0 ? desired.modes.join(",") : undefined,
      c_genres:
        desired.genres.length > 0 ? desired.genres.join(",") : undefined,
      c_repertoires:
        desired.repertoires.length > 0
          ? desired.repertoires.join(",")
          : undefined,
      // Proactively clear other tab's filter keys (Repertoire)
      r_q: undefined,
      r_types: undefined,
      r_modes: undefined,
      r_genres: undefined,
      // Clear any legacy/un-namespaced param that may linger from older builds
      repertoires: undefined,
    };

    setSearchParams(params as Record<string, string>, { replace: true });
  });

  // Note: persistence is now handled centrally in Home.tsx by saving the tab's
  // full query string on tab switches. Catalog hydrates purely from URL.

  // Fetch all tunes for filter options
  const [allTunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = catalogListChanged(); // Refetch when catalog changes
      log.debug("CATALOG allTunes dependency:", {
        hasDb: !!db,
        userId,
        catalogListChanged: version,
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

  // Fetch user repertoires for filter options
  const [userRepertoires] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = catalogListChanged(); // Refetch when catalog changes (repertoires are catalog metadata)
      log.debug("CATALOG userRepertoires dependency:", {
        hasDb: !!db,
        userId,
        catalogListChanged: version,
      });
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      log.debug("CATALOG userRepertoires fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];
      const result = await getUserRepertoires(params.db, params.userId);
      log.debug(
        "CATALOG userRepertoires result:",
        result.length,
        "repertoires"
      );
      return result;
    }
  );

  // Fetch all genres for proper genre names
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = catalogListChanged(); // Refetch when catalog changes (genres are catalog data)
      log.debug("CATALOG allGenres dependency:", {
        hasDb: !!db,
        catalogListChanged: version,
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

    // IMPORTANT: `tune.genre` is historically inconsistent across datasets.
    // - In newer schema it's a FK (genre.id)
    // - In older/imported data it may already be a display name
    // Build filter options that work in both cases.
    const genreNames = new Set<string>();
    const genreById = new Map<string, string>();
    for (const g of genres) {
      if (g.id && g.name) genreById.set(g.id, g.name);
    }

    for (const tune of tunes) {
      const raw = tune.genre;
      if (!raw) continue;
      genreNames.add(genreById.get(raw) ?? raw);
    }

    const result = Array.from(genreNames).sort();
    log.debug("CATALOG Final genre names:", result);
    return result;
  });

  // Handle tune selection (double-click opens editor)
  const handleTuneSelect = (tune: ITuneOverview) => {
    const fullPath = location.pathname + location.search;
    navigate(`/tunes/${tune.id}/edit`, { state: { from: fullPath } });
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
          selectedRepertoireIds={selectedRepertoireIds()}
          onRepertoireIdsChange={setSelectedRepertoireIds}
          availableTypes={availableTypes()}
          availableModes={availableModes()}
          availableGenres={availableGenres()}
          availableRepertoires={userRepertoires() || []}
          loading={{
            genres: allGenres.loading,
            repertoires: userRepertoires.loading,
          }}
          selectedRowsCount={selectedRowsCount()}
          table={tableInstance() || undefined}
          repertoireId={currentRepertoireId() || undefined}
          filterPanelExpanded={filterPanelExpanded()}
          onFilterPanelExpandedChange={setFilterPanelExpanded}
        />
      </Show>

      {/* Grid wrapper - overflow-hidden constrains grid height */}
      <div class={GRID_CONTENT_CONTAINER}>
        <Show when={userId()}>
          <TunesGridCatalog
            userId={userId()!}
            repertoireId={currentRepertoireId() || "0"}
            tablePurpose="catalog"
            searchQuery={searchQuery()}
            selectedTypes={selectedTypes()}
            selectedModes={selectedModes()}
            selectedGenreNames={selectedGenres()}
            allGenres={allGenres() || []}
            selectedRepertoireIds={selectedRepertoireIds()}
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
