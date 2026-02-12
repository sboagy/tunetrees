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

import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import type { Table } from "@tanstack/solid-table";
import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Match,
  on,
  Show,
  Switch,
} from "solid-js";
import { TunesGridRepertoire } from "../components/grids";
import { GRID_CONTENT_CONTAINER } from "../components/grids/shared-toolbar-styles";
import type { ITuneOverview } from "../components/grids/types";
import { PlaylistEditorDialog } from "../components/playlists/PlaylistEditorDialog";
import {
  RepertoireEmptyState,
  RepertoireToolbar,
} from "../components/repertoire";
import { useAuth } from "../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../lib/context/CurrentPlaylistContext";
import { getPlaylistTunes } from "../lib/db/queries/playlists";
import * as schema from "../lib/db/schema";
import { log } from "../lib/logger";
import { ChatFAB } from "../components/ai/ChatFAB";
import { AIChatDrawer } from "../components/ai/AIChatDrawer";

const arraysEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

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
  const location = useLocation();
  const {
    user,
    localDb,
    repertoireListChanged,
    catalogListChanged,
    incrementRepertoireListChanged,
  } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPlaylistDialog, setShowPlaylistDialog] = createSignal(false);

  // Get current user ID (supabase UUID)
  const userId = createMemo(() => user()?.id || null);

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

  // --- Filter State Signals (Initialized to empty defaults) ---
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedTypes, setSelectedTypes] = createSignal<string[]>([]);
  const [selectedModes, setSelectedModes] = createSignal<string[]>([]);
  const [selectedGenres, setSelectedGenres] = createSignal<string[]>([]);

  // --- Synchronization State Flag ---
  const [isInitialized, setIsInitialized] = createSignal(false);

  const [selectedRowsCount, setSelectedRowsCount] = createSignal(0);

  // Track AI chat drawer state
  const [isChatOpen, setIsChatOpen] = createSignal(false);

  // === EFFECT 1: HYDRATION (URL -> Signal) ===
  // Runs whenever searchParams changes. This resolves the initial race condition
  // by ensuring signals are populated before the sync effect (Effect 2) runs.
  createEffect(
    on(
      // Dependency Array: Explicitly list every parameter to watch.
      () => [
        searchParams.r_q,
        searchParams.r_types,
        searchParams.r_modes,
        searchParams.r_genres,
        searchParams.tab, // Crucial for re-hydration when switching tabs
      ],
      () => {
        // 1. Read URL params
        const q = getParam(searchParams.r_q);
        const types = getParamArray(searchParams.r_types);
        const modes = getParamArray(searchParams.r_modes);
        const genres = getParamArray(searchParams.r_genres);

        // 2. Write to signals only if different (essential to prevent infinite loops)
        if (q !== searchQuery()) setSearchQuery(q);
        if (!arraysEqual(types, selectedTypes())) setSelectedTypes(types);
        if (!arraysEqual(modes, selectedModes())) setSelectedModes(modes);
        if (!arraysEqual(genres, selectedGenres())) setSelectedGenres(genres);

        // 3. Set initialization flag *after* the initial hydration is complete
        if (!isInitialized()) {
          setIsInitialized(true);
          log.debug("REPERTOIRE: Filter state initialized from URL.");
        }
      }
    )
  );

  // === EFFECT 2: SYNCHRONIZATION (Signal -> URL) ===
  // Runs whenever internal filter signals change (user interaction). Writes to URL.
  createEffect(() => {
    if (!isInitialized()) return;

    const current = {
      q: getParam(searchParams.r_q),
      types: getParamArray(searchParams.r_types),
      modes: getParamArray(searchParams.r_modes),
      genres: getParamArray(searchParams.r_genres),
    };

    const desired = {
      q: searchQuery(),
      types: selectedTypes(),
      modes: selectedModes(),
      genres: selectedGenres(),
    };

    const needsUpdate =
      desired.q !== current.q ||
      !arraysEqual(desired.types, current.types) ||
      !arraysEqual(desired.modes, current.modes) ||
      !arraysEqual(desired.genres, current.genres);

    if (!needsUpdate) return;

    const params: Record<string, string | undefined> = {
      r_q: desired.q || undefined,
      r_types: desired.types.length > 0 ? desired.types.join(",") : undefined,
      r_modes: desired.modes.length > 0 ? desired.modes.join(",") : undefined,
      r_genres:
        desired.genres.length > 0 ? desired.genres.join(",") : undefined,
      // Proactively clear other tab's filter keys so URL doesn't perpetuate them
      c_q: undefined,
      c_types: undefined,
      c_modes: undefined,
      c_genres: undefined,
      c_playlists: undefined,
      // Clear any legacy/un-namespaced param that may linger from older builds
      playlists: undefined,
    };

    setSearchParams(params as Record<string, string>, { replace: true });
  });

  // Note: persistence is now handled centrally in Home.tsx by saving the tab's
  // full query string on tab switches. Repertoire hydrates purely from URL.

  // On mount, also clear other tab's filter keys once (in case nothing else changes)
  // onMount(() => {
  //   setSearchParams(
  //     {
  //       c_q: undefined,
  //       c_types: undefined,
  //       c_modes: undefined,
  //       r_modes: undefined,
  //       c_genres: undefined,
  //       c_playlists: undefined,
  //       // Also clear legacy/un-namespaced params on mount
  //       playlists: undefined,
  //     } as unknown as Record<string, string>,
  //     { replace: true }
  //   );
  // });

  // Fetch tunes in current playlist for filter options
  const [playlistTunes] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const playlistId = currentPlaylistId();
      const version = repertoireListChanged(); // Refetch when repertoire changes
      log.debug("REPERTOIRE playlistTunes dependency:", {
        hasDb: !!db,
        userId,
        playlistId,
        repertoireListChanged: version,
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

  const repertoireIsEmpty = createMemo(
    () => !playlistTunes.loading && (playlistTunes()?.length ?? 0) === 0
  );

  // Fetch all genres for proper genre names
  const [allGenres] = createResource(
    () => {
      const db = localDb();
      const version = catalogListChanged(); // Refetch when catalog changes (genres are catalog data)
      log.debug("REPERTOIRE allGenres dependency:", {
        hasDb: !!db,
        catalogListChanged: version,
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

    const genreNames = new Set<string>();
    const genreById = new Map<string, string>();
    for (const g of genres) {
      if (g.id && g.name) genreById.set(g.id, g.name);
    }

    for (const row of tunes) {
      const raw = row.tune.genre;
      if (!raw) continue;
      genreNames.add(genreById.get(raw) ?? raw);
    }

    const result = Array.from(genreNames).sort();
    log.debug("REPERTOIRE Final genre names:", result);
    return result;
  });

  // Handle tune selection (double-click opens editor)
  const handleTuneSelect = (tune: ITuneOverview) => {
    const fullPath = location.pathname + location.search;
    navigate(`/tunes/${tune.id}/edit`, { state: { from: fullPath } });
  };

  const [tableInstance, setTableInstance] = createSignal<Table<any> | null>(
    null
  );

  // Track filter panel expanded state
  const [filterPanelExpanded, setFilterPanelExpanded] = createSignal(false);

  createEffect(() => {
    console.log("[RepertoirePage] tableInstance updated:", !!tableInstance());
  });

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
          loading={{ genres: allGenres.loading }}
          selectedRowsCount={selectedRowsCount()}
          table={tableInstance() || undefined}
          playlistId={currentPlaylistId() || undefined}
          filterPanelExpanded={filterPanelExpanded()}
          onFilterPanelExpandedChange={setFilterPanelExpanded}
        />
      </Show>

      {/* Grid wrapper - overflow-hidden constrains grid height */}
      <div class={GRID_CONTENT_CONTAINER}>
        <Show when={userId() && currentPlaylistId()}>
          <Switch>
            <Match when={playlistTunes.loading}>
              <div class="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                Loading repertoire...
              </div>
            </Match>

            <Match when={repertoireIsEmpty()}>
              <RepertoireEmptyState
                title="This repertoire is empty"
                description="Add tunes from the Catalog tab to start practicing or import from another repertoire."
                primaryAction={{
                  label: "Browse catalog",
                  onClick: () => navigate("/?tab=catalog"),
                }}
              />
            </Match>

            <Match when={!repertoireIsEmpty()}>
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
            </Match>
          </Switch>
        </Show>

        {/* No playlist selected message */}
        <Show when={!currentPlaylistId()}>
          <RepertoireEmptyState
            title="No current repertoire"
            description={
              `Repertoires group tunes by instrument, genre, or goal. ` +
              `Create a new repertoire and add tunes from the Catalog ` +
              `tab, or select an existing repertoire, if available, from the ` +
              `Repertoire menu in the top banner.`
            }
            primaryAction={{
              label: "Create repertoire",
              onClick: () => setShowPlaylistDialog(true),
            }}
          />
        </Show>
      </div>

      <Show when={showPlaylistDialog()}>
        <PlaylistEditorDialog
          isOpen={showPlaylistDialog()}
          onClose={() => setShowPlaylistDialog(false)}
          onSaved={() => {
            incrementRepertoireListChanged();
            setShowPlaylistDialog(false);
          }}
        />
      </Show>

      {/* AI Chat FAB */}
      <ChatFAB onClick={() => setIsChatOpen(true)} />

      {/* AI Chat Drawer */}
      <AIChatDrawer
        isOpen={isChatOpen()}
        onClose={() => setIsChatOpen(false)}
        setSelectedTypes={setSelectedTypes}
        setSelectedModes={setSelectedModes}
        setSelectedGenres={setSelectedGenres}
        currentPlaylistId={currentPlaylistId() || undefined}
      />
    </div>
  );
};

export default RepertoirePage;
