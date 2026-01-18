/**
 * Top Navigation Bar
 *
 * Displays app branding, user information, and logout button.
 * Matches legacy: legacy/frontend/components/TopNav.tsx
 *
 * @module components/layout/TopNav
 */

import {
  type Component,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { toast } from "solid-sonner";
import { getOutboxStats } from "@/lib/sync";
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { getSqliteInstance } from "../../lib/db/client-sqlite";
import { getUserPlaylists } from "../../lib/db/queries/playlists";
import type { PlaylistWithSummary } from "../../lib/db/types";
import { useClickOutside } from "../../lib/hooks/useClickOutside";
import { log } from "../../lib/logger";
import {
  getSelectedPlaylistId,
  setSelectedPlaylistId,
} from "../../lib/services/playlist-service";
import { PlaylistManagerDialog } from "../playlists/PlaylistManagerDialog";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { AboutDialog } from "./AboutDialog";
import { ThemeSwitcher } from "./ThemeSwitcher";

// Helper: format relative time (e.g., 2m, 3h, 5d)
function formatRelativeTime(isoTs: string): string {
  const then = new Date(isoTs).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo`;
  const year = Math.floor(month / 12);
  return `${year}y`;
}

// Helper function to get display name for a playlist
const getPlaylistDisplayName = (playlist: PlaylistWithSummary): string => {
  // If name exists and is not empty, use it
  if (playlist.name?.trim()) {
    return playlist.name.trim();
  }

  // Otherwise just use instrument name
  const instrument = playlist.instrumentName || "Unknown Instrument";
  return instrument;
};

/**
 * Top Navigation Component
 *
 * Features:
 * - App logo and branding
 * - Playlist selector dropdown
 * - User menu dropdown
 * - Theme switcher
 * - Network/sync status indicator
 * - Responsive design
 */

/**
 * Logo Dropdown Component
 *
 * Dropdown menu for app-level navigation and information
 */
const LogoDropdown: Component<{
  onOpenAbout: () => void;
}> = (props) => {
  const [showDropdown, setShowDropdown] = createSignal(false);
  let dropdownContainerRef: HTMLDivElement | undefined;

  // Close dropdown when clicking outside
  useClickOutside(
    () => dropdownContainerRef,
    () => {
      if (showDropdown()) {
        setShowDropdown(false);
      }
    }
  );

  const handleAboutClick = () => {
    setShowDropdown(false);
    props.onOpenAbout();
  };

  return (
    <div
      class="relative"
      data-testid="logo-dropdown"
      ref={dropdownContainerRef}
    >
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown())}
        class="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="App menu"
        aria-expanded={showDropdown()}
        data-testid="logo-dropdown-button"
      >
        <img
          src="/logo4.png"
          alt="TuneTrees Logo"
          width="48"
          height="48"
          class="h-12 w-12 object-contain"
        />
        <span class="hidden sm:inline ml-[0ch] text-lg dark:text-blue-400">
          TuneTrees
        </span>
        <svg
          class="w-4 h-4 transition-transform"
          classList={{ "rotate-180": showDropdown() }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <Show when={showDropdown()}>
        <div class="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div class="py-2" data-testid="logo-dropdown-panel">
            {/* Home */}
            <a
              href="/"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Home
            </a>

            {/* Divider */}
            <div class="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* About TuneTrees */}
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={handleAboutClick}
              data-testid="logo-dropdown-about-button"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              About TuneTrees...
            </button>

            {/* What's New */}
            <a
              href="https://github.com/sboagy/tunetrees/releases"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
              data-testid="logo-dropdown-whats-new-link"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              What's New
            </a>

            {/* Divider */}
            <div class="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Privacy Policy */}
            <a
              href="/privacy"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
              data-testid="logo-dropdown-privacy-link"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 11c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm7 6a7 7 0 10-14 0v1h14v-1z"
                />
              </svg>
              Privacy Policy
            </a>

            {/* Terms of Service */}
            <a
              href="/terms"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={() => setShowDropdown(false)}
              data-testid="logo-dropdown-terms-link"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V4a2 2 0 012-2h6l4 4v12a2 2 0 01-2 2z"
                />
              </svg>
              Terms of Service
            </a>
          </div>
        </div>
      </Show>
    </div>
  );
};

/**
 * Playlist Dropdown Component
 *
 * Dropdown for selecting active playlist with "Manage Repertoires..." option
 */
const PlaylistDropdown: Component<{
  onOpenPlaylistManager: () => void;
}> = (props) => {
  const {
    user,
    localDb,
    repertoireListChanged,
    remoteSyncDownCompletionVersion,
  } = useAuth();
  const { currentPlaylistId, setCurrentPlaylistId } = useCurrentPlaylist();
  const [showDropdown, setShowDropdown] = createSignal(false);
  let dropdownContainerRef: HTMLDivElement | undefined;

  const shouldTopNavDiag = import.meta.env.VITE_SYNC_DIAGNOSTICS === "true";

  // Close dropdown when clicking outside
  useClickOutside(
    () => dropdownContainerRef,
    () => {
      if (showDropdown()) {
        setShowDropdown(false);
      }
    }
  );

  // Fetch user playlists
  // Fetch immediately if data exists in SQLite, don't wait for sync
  // repertoireListChanged is tracked as a dependency to trigger refetch after playlist changes
  let lastTopNavDiagKey: string | null = null;
  const [playlists] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = `${repertoireListChanged()}:${remoteSyncDownCompletionVersion()}`; // Triggers refetch when playlists change or sync completes

      if (shouldTopNavDiag) {
        console.log("🔍 [TopNav] Playlists dependency check:", {
          hasDb: !!db,
          userId,
          userObject: user(),
          repertoireListChanged: version,
          shouldFetch: !!(db && userId),
        });
        log.debug("TOPNAV playlists dependency:", {
          hasDb: !!db,
          userId,
          repertoireListChanged: version,
        });
      }

      // Fetch if database and user are ready
      // Don't wait for sync - playlists exist in local DB
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (shouldTopNavDiag) {
        console.log("📋 [TopNav] Fetching playlists with params:", params);
        log.debug("TOPNAV playlists fetcher:", {
          hasParams: !!params,
          repertoireListChanged: params?.version,
        });
      }
      if (!params) return [];

      const shouldTopNavDump = shouldTopNavDiag;

      const userShort = params.userId.slice(0, 8);
      const diagKey = `${params.userId}:${params.version}`;

      type ITopNavDbSnapshot = {
        phase: "before" | "after" | "afterError";
        user: string;
        version: string;
        at: string;
        hasSqliteInstance?: boolean;
        jsHeap?: {
          usedBytes: number;
          totalBytes: number;
          limitBytes: number;
        };
        wasmHeapBytes?: number;
        dbApproxBytes?: number;
        pageCount?: number;
        pageSize?: number;
        freelistCount?: number;
        tableCounts?: Record<string, number>;
        errors?: string[];
      };

      const collectTopNavDbSnapshot = async (
        phase: ITopNavDbSnapshot["phase"],
        opts?: { always?: boolean; error?: unknown }
      ): Promise<ITopNavDbSnapshot | null> => {
        if (!shouldTopNavDump) return null;
        if (!opts?.always && lastTopNavDiagKey === diagKey) return null;

        const snapshot: ITopNavDbSnapshot = {
          phase,
          user: userShort,
          version: params.version,
          at: new Date().toISOString(),
        };

        const errors: string[] = [];
        try {
          const perfAny = performance as any;
          if (perfAny?.memory) {
            snapshot.jsHeap = {
              usedBytes: Number(perfAny.memory.usedJSHeapSize ?? 0),
              totalBytes: Number(perfAny.memory.totalJSHeapSize ?? 0),
              limitBytes: Number(perfAny.memory.jsHeapSizeLimit ?? 0),
            };
          }
        } catch (e) {
          errors.push(`jsHeap: ${e instanceof Error ? e.message : String(e)}`);
        }

        try {
          const sqliteDb = await getSqliteInstance();
          snapshot.hasSqliteInstance = !!sqliteDb;
          if (!sqliteDb) {
            errors.push(
              "sqliteInstance: null (db not initialized yet or init failed)"
            );
          }
          if (sqliteDb) {
            // WASM heap size is per sql.js Module, not per Database.
            try {
              const { getSqlJsDebugInfo } = await import(
                "../../lib/db/client-sqlite"
              );
              const dbg = getSqlJsDebugInfo();
              if (dbg.wasmHeapBytes) snapshot.wasmHeapBytes = dbg.wasmHeapBytes;
            } catch (e) {
              errors.push(
                `wasmHeap: ${e instanceof Error ? e.message : String(e)}`
              );
            }

            // DB size approximation + free pages (cheap pragmas).
            try {
              const pageSizeRes = sqliteDb.exec("PRAGMA page_size;");
              const pageCountRes = sqliteDb.exec("PRAGMA page_count;");
              const freelistRes = sqliteDb.exec("PRAGMA freelist_count;");

              const pageSize = Number(pageSizeRes?.[0]?.values?.[0]?.[0] ?? 0);
              const pageCount = Number(
                pageCountRes?.[0]?.values?.[0]?.[0] ?? 0
              );
              const freelistCount = Number(
                freelistRes?.[0]?.values?.[0]?.[0] ?? 0
              );

              if (pageSize > 0) snapshot.pageSize = pageSize;
              if (pageCount > 0) snapshot.pageCount = pageCount;
              snapshot.freelistCount = freelistCount;
              if (pageSize > 0 && pageCount > 0) {
                snapshot.dbApproxBytes = pageSize * pageCount;
              }
            } catch (e) {
              errors.push(
                `pragma: ${e instanceof Error ? e.message : String(e)}`
              );
            }

            // Complete table row counts (tables only; excludes views).
            try {
              const master = sqliteDb.exec(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
              );
              const names: string[] = (master?.[0]?.values ?? []).map(
                (row: unknown) => String((row as any)[0])
              );

              const counts: Record<string, number> = {};
              for (const name of names) {
                try {
                  const res = sqliteDb.exec(
                    `SELECT COUNT(*) as c FROM "${name.replaceAll('"', '""')}";`
                  );
                  counts[name] = Number(res?.[0]?.values?.[0]?.[0] ?? 0);
                } catch (e) {
                  // Keep going; don't hide the failure.
                  counts[name] = -1;
                  errors.push(
                    `count:${name}: ${e instanceof Error ? e.message : String(e)}`
                  );
                }
              }
              snapshot.tableCounts = counts;
            } catch (e) {
              errors.push(
                `sqlite_master: ${e instanceof Error ? e.message : String(e)}`
              );
            }
          }
        } catch (e) {
          errors.push(`sqlite: ${e instanceof Error ? e.message : String(e)}`);
        }

        if (opts?.error) {
          const msg =
            opts.error instanceof Error
              ? opts.error.message
              : String(opts.error);
          errors.push(`error: ${msg}`);
        }

        if (errors.length > 0) snapshot.errors = errors;

        // Emit as two lines: header + optional tableCounts payload.
        try {
          const header = {
            phase: snapshot.phase,
            user: snapshot.user,
            version: snapshot.version,
            at: snapshot.at,
            hasSqliteInstance: snapshot.hasSqliteInstance,
            jsHeap: snapshot.jsHeap,
            wasmHeapBytes: snapshot.wasmHeapBytes,
            pageSize: snapshot.pageSize,
            pageCount: snapshot.pageCount,
            freelistCount: snapshot.freelistCount,
            dbApproxBytes: snapshot.dbApproxBytes,
            errors: snapshot.errors,
          };
          console.log(`[TopNavDiag] ${JSON.stringify(header)}`);

          if (snapshot.tableCounts) {
            console.log(
              `[TopNavDiag] tables user=${snapshot.user} ${JSON.stringify(snapshot.tableCounts)}`
            );
          }
        } catch (e) {
          console.log(
            `[TopNavDiag] failed to emit snapshot: ${e instanceof Error ? e.message : String(e)}`
          );
        }

        lastTopNavDiagKey = diagKey;
        return snapshot;
      };

      try {
        if (shouldTopNavDump) {
          await collectTopNavDbSnapshot("before");
        }

        if (shouldTopNavDiag) {
          console.log(
            "🔄 [TopNav] Calling getUserPlaylists with userId:",
            params.userId
          );
        }
        const result = await getUserPlaylists(params.db, params.userId);

        if (shouldTopNavDiag) {
          console.log("✅ [TopNav] Got playlists:", result.length, result);
        }
        if (shouldTopNavDump) {
          await collectTopNavDbSnapshot("after");
        }
        if (shouldTopNavDiag) {
          log.debug("TOPNAV playlists result:", result.length, "playlists");
        }
        return result;
      } catch (error) {
        if (shouldTopNavDump) {
          await collectTopNavDbSnapshot("afterError", { always: true, error });
        }
        console.error("❌ [TopNav] Playlist fetch error:", error);
        log.error("TOPNAV playlists fetch error:", error);
        return [];
      }
    }
  );

  // Additional debug effect to track playlists changes
  createEffect(() => {
    const playlistsList = playlists();
    const loading = playlists.loading;
    log.debug("TOPNAV playlists changed:", {
      loading,
      count: playlistsList?.length || 0,
      playlists:
        playlistsList?.map((p) => ({ id: p.playlistId, name: p.name })) || [],
    });
  });

  // Load selected playlist from localStorage on mount
  createEffect(() => {
    const userId = user()?.id;
    const playlistsList = playlists();
    if (!userId || !playlistsList) return;

    const storedId = getSelectedPlaylistId(userId);

    if (storedId) {
      setCurrentPlaylistId(storedId);
    } else if (playlistsList.length > 0) {
      // Default to first playlist
      const firstId = playlistsList[0].playlistId;
      setCurrentPlaylistId(firstId);
      setSelectedPlaylistId(userId, firstId);
    }
  });

  const handlePlaylistSelect = (playlistId: string) => {
    const userId = user()?.id;
    if (!userId) return;

    setCurrentPlaylistId(playlistId);
    setSelectedPlaylistId(userId, playlistId);
    setShowDropdown(false);
  };

  const handleManagePlaylists = () => {
    setShowDropdown(false);
    props.onOpenPlaylistManager();
  };

  const selectedPlaylist = createMemo(() => {
    const id = currentPlaylistId();
    const playlistsList = playlists();
    if (!id || !playlistsList) return null;
    return playlistsList.find((p) => p.playlistId === id);
  });

  return (
    <div
      class="relative"
      data-testid="playlist-dropdown"
      ref={dropdownContainerRef}
    >
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown())}
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        aria-label="Select playlist"
        aria-expanded={showDropdown()}
        data-testid="playlist-dropdown-button"
      >
        <span class="hidden md:inline font-medium">
          {selectedPlaylist()
            ? getPlaylistDisplayName(selectedPlaylist()!)
            : "No Repertoire"}
        </span>
        <span class="md:hidden inline-block max-w-[8ch] min-w-0 truncate font-medium">
          {selectedPlaylist()
            ? getPlaylistDisplayName(selectedPlaylist()!)
            : "No Repertoire"}
        </span>
        <svg
          class="w-4 h-4 transition-transform"
          classList={{ "rotate-180": showDropdown() }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <Show when={showDropdown()}>
        <div class="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div class="py-2" data-testid="top-nav-manage-playlists-panel">
            {/* Repertoires List */}
            <Show
              when={!playlists.loading && playlists()}
              fallback={
                <div class="px-4 py-2 text-sm text-gray-500">
                  Loading repertoires...
                </div>
              }
            >
              <For each={playlists()}>
                {(playlist) => (
                  <button
                    type="button"
                    class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                    classList={{
                      "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300":
                        currentPlaylistId() === playlist.playlistId,
                    }}
                    onClick={() => handlePlaylistSelect(playlist.playlistId)}
                  >
                    <div class="flex-1">
                      <div class="font-medium">
                        {getPlaylistDisplayName(playlist)}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">
                        {playlist.tuneCount} tune
                        {playlist.tuneCount !== 1 ? "s" : ""}
                        {playlist.genreDefault && ` • ${playlist.genreDefault}`}
                      </div>
                    </div>
                    <Show when={currentPlaylistId() === playlist.playlistId}>
                      <svg
                        class="w-4 h-4 text-blue-600 dark:text-blue-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </Show>
                  </button>
                )}
              </For>
            </Show>

            {/* Divider */}
            <div class="border-t border-gray-200 dark:border-gray-700 my-2" />

            {/* Manage Repertoires */}
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={handleManagePlaylists}
              data-testid="manage-repertoires-button"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Configure Repertoires...
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export const TopNav: Component = () => {
  const {
    user,
    localDb,
    signOut,
    forceSyncDown,
    forceSyncUp,
    remoteSyncDownCompletionVersion,
    isAnonymous,
    lastSyncTimestamp,
    lastSyncMode,
  } = useAuth();
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  const [pendingCount, setPendingCount] = createSignal(0);
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  const [showDbMenu, setShowDbMenu] = createSignal(false);
  const [showPlaylistManager, setShowPlaylistManager] = createSignal(false);
  const [showAboutDialog, setShowAboutDialog] = createSignal(false);
  const [showForceSyncUpConfirm, setShowForceSyncUpConfirm] =
    createSignal(false);
  const [pendingDeleteCount, setPendingDeleteCount] = createSignal(0);
  const [forceSyncUpBusy, setForceSyncUpBusy] = createSignal(false);
  let userMenuContainerRef: HTMLDivElement | undefined;
  let dbMenuContainerRef: HTMLDivElement | undefined;

  const getPendingDeleteCount = async (): Promise<number> => {
    const db = localDb();
    if (!db) return 0;
    const rows = await db.all<{ count: number }>(
      "SELECT COUNT(*) as count FROM sync_push_queue WHERE status IN ('pending','in_progress') AND lower(operation) = 'delete';"
    );
    return Number(rows[0]?.count ?? 0);
  };

  const runForceSyncUp = async (opts?: { allowDeletes?: boolean }) => {
    setForceSyncUpBusy(true);
    try {
      await forceSyncUp(opts);
      toast.success(
        opts?.allowDeletes === false
          ? "Uploaded local changes (deletions skipped)"
          : "Local changes uploaded to server"
      );
    } catch (error) {
      console.error("❌ [Force Sync Up] Sync failed:", error);
      toast.error("Failed to upload changes");
    } finally {
      setForceSyncUpBusy(false);
      setShowDbMenu(false);
    }
  };

  // Fetch user avatar (refetch when remote sync completes)
  const [userAvatar] = createResource(
    () => ({
      db: localDb(),
      userId: user()?.id,
      version: remoteSyncDownCompletionVersion(),
    }),
    async ({ db, userId }) => {
      if (!db || !userId) return null;

      try {
        const { userProfile } = await import("@/../drizzle/schema-sqlite");
        const { eq } = await import("drizzle-orm");

        const result = await db
          .select({ avatarUrl: userProfile.avatarUrl })
          .from(userProfile)
          .where(eq(userProfile.supabaseUserId, userId))
          .limit(1);

        return result[0]?.avatarUrl || null;
      } catch (error) {
        console.error("Failed to load user avatar:", error);
        return null;
      }
    }
  );

  // Close user menu when clicking outside
  useClickOutside(
    () => userMenuContainerRef,
    () => {
      if (showUserMenu()) {
        setShowUserMenu(false);
      }
    }
  );

  // Close database menu when clicking outside
  useClickOutside(
    () => dbMenuContainerRef,
    () => {
      if (showDbMenu()) {
        setShowDbMenu(false);
      }
    }
  );

  // Monitor online/offline status
  createEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  });

  // Poll for pending sync count (skip for anonymous users - they don't sync)
  createEffect(() => {
    const db = localDb();
    // In Playwright E2E runs, avoid polling SQLite WASM in the UI.
    // This has caused browser OOMs under heavy parallelism.
    const isE2E =
      typeof window !== "undefined" && !!(window as any).__ttTestApi;

    if (!db || isAnonymous() || isE2E) {
      setPendingCount(0); // Reset count for anonymous users
      return;
    }

    const updateSyncCount = async () => {
      try {
        const stats = await getOutboxStats(db);
        setPendingCount(stats.pending + stats.inProgress);
      } catch (error) {
        log.error("Failed to get sync outbox stats:", error);
      }
    };

    updateSyncCount();
    const interval = setInterval(updateSyncCount, 5000);
    onCleanup(() => clearInterval(interval));
  });

  const statusText = () => {
    // Anonymous users don't sync - show "Local Only"
    if (isAnonymous()) return "Local Only";
    if (!isOnline() && pendingCount() > 0) {
      return `Offline - ${pendingCount()} pending`;
    }
    if (!isOnline()) return "Offline";
    if (pendingCount() > 0) return `Syncing ${pendingCount()}`;
    return "Synced";
  };

  return (
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-6">
            {/* App Logo Dropdown */}
            <LogoDropdown onOpenAbout={() => setShowAboutDialog(true)} />
            {/* Playlist Selector */}
            <div class="flex items-center gap--1">
              <span class="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Repertoire:
              </span>
              <PlaylistDropdown
                onOpenPlaylistManager={() => setShowPlaylistManager(true)}
              />
            </div>
          </div>

          {/* User Info + Theme + Logout */}
          <div class="flex items-center gap-4">
            {/* User Menu Dropdown - show for both authenticated and anonymous users */}
            <Show when={user() || isAnonymous()}>
              <div
                class="relative"
                data-testid="user-menu-dropdown"
                ref={userMenuContainerRef}
              >
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu())}
                  class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  aria-label="User menu"
                  aria-expanded={showUserMenu()}
                  data-testid="user-menu-button"
                >
                  <Show
                    when={user()}
                    fallback={
                      <>
                        <span class="hidden sm:inline font-medium">
                          Device Only
                        </span>
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                          ?
                        </div>
                      </>
                    }
                  >
                    {(u) => (
                      <>
                        <span class="hidden sm:inline font-medium">
                          {isAnonymous() ? "Anonymous" : u().email}
                        </span>
                        {/* User Avatar */}
                        <Show
                          when={!isAnonymous() && userAvatar()}
                          fallback={
                            <div
                              class={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                isAnonymous()
                                  ? "bg-gradient-to-br from-gray-400 to-gray-600"
                                  : "bg-gradient-to-br from-blue-500 to-purple-600"
                              }`}
                            >
                              {isAnonymous()
                                ? "?"
                                : u().email?.charAt(0).toUpperCase()}
                            </div>
                          }
                        >
                          {(avatarUrl) => (
                            <img
                              src={avatarUrl()}
                              alt="User avatar"
                              class="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                            />
                          )}
                        </Show>
                      </>
                    )}
                  </Show>
                  <svg
                    class="w-4 h-4 transition-transform"
                    classList={{ "rotate-180": showUserMenu() }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                <Show when={showUserMenu()}>
                  <div
                    class="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                    data-testid="user-menu-panel"
                  >
                    <div class="py-2">
                      {/* User Information - for authenticated non-anonymous users */}
                      <Show when={user() && !isAnonymous()}>
                        {(_) => {
                          const u = user()!;
                          return (
                            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                User Information
                              </h3>
                              <dl class="space-y-1.5 text-sm">
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Email:
                                  </dt>
                                  <dd class="text-gray-900 dark:text-gray-100 break-all">
                                    {u.email}
                                  </dd>
                                </div>
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Name:
                                  </dt>
                                  <dd class="text-gray-900 dark:text-gray-100">
                                    {u.user_metadata?.name || "Not set"}
                                  </dd>
                                </div>
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    User ID:
                                  </dt>
                                  <dd class="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                                    {u.id}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          );
                        }}
                      </Show>

                      {/* Anonymous User Info - for users in device-only mode */}
                      <Show when={isAnonymous()}>
                        {(_) => {
                          const u = user();
                          return (
                            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                Device-Only Mode
                              </h3>
                              <dl class="space-y-1.5 text-sm">
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Email:
                                  </dt>
                                  <dd class="text-gray-500 dark:text-gray-400 italic">
                                    Anonymous
                                  </dd>
                                </div>
                                <div class="flex gap-2">
                                  <dt class="font-medium text-gray-600 dark:text-gray-400">
                                    Name:
                                  </dt>
                                  <dd class="text-gray-500 dark:text-gray-400 italic">
                                    Anonymous
                                  </dd>
                                </div>
                                <Show when={u}>
                                  <div class="flex gap-2">
                                    <dt class="font-medium text-gray-600 dark:text-gray-400">
                                      User ID:
                                    </dt>
                                    <dd class="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                                      {u!.id}
                                    </dd>
                                  </div>
                                </Show>
                              </dl>
                              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Your data is stored locally on this device only.
                              </p>
                            </div>
                          );
                        }}
                      </Show>

                      {/* Create Account button for anonymous users */}
                      <Show when={isAnonymous()}>
                        <button
                          type="button"
                          class="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 font-medium"
                          onClick={() => {
                            setShowUserMenu(false);
                            window.location.href = "/login?convert=true";
                          }}
                          data-testid="create-account-button"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                            />
                          </svg>
                          Create Account
                        </button>
                      </Show>

                      {/* Menu Items */}
                      <button
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={() => {
                          setShowUserMenu(false);
                          window.location.href =
                            "/user-settings/scheduling-options";
                        }}
                        data-testid="user-settings-button"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        User Settings
                      </button>

                      {/* Theme Switcher */}
                      <div class="w-full">
                        <ThemeSwitcher showLabel={true} />
                      </div>

                      <button
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={async () => {
                          setShowUserMenu(false);
                          await signOut();
                          window.location.href = "/login";
                        }}
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Database/Sync Status Dropdown */}
            <div
              class="relative"
              data-testid="database-status-dropdown"
              ref={dbMenuContainerRef}
            >
              <button
                type="button"
                onClick={() => setShowDbMenu(!showDbMenu())}
                class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="Database and sync status"
                aria-expanded={showDbMenu()}
                data-testid="database-status-button"
              >
                {/* Database Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                </svg>

                {/* Status indicator badge */}
                <Show
                  when={isOnline() && pendingCount() === 0}
                  fallback={
                    <span class="text-yellow-500" title="Warning">
                      ⚠️
                    </span>
                  }
                >
                  <span class="text-green-500" title="Synced">
                    ✓
                  </span>
                </Show>
              </button>

              {/* Dropdown Menu */}
              <Show when={showDbMenu()}>
                <div
                  class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
                  data-testid="database-dropdown-panel"
                >
                  <div class="py-2">
                    {/* Database Status Section */}
                    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Database Status
                      </h3>
                      <div class="space-y-2">
                        {/* Local DB Status */}
                        <div class="flex items-start gap-2">
                          <Show
                            when={localDb()}
                            fallback={
                              <span class="text-yellow-500 text-sm">⏳</span>
                            }
                          >
                            <span class="text-green-500 text-sm">✓</span>
                          </Show>
                          <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Local Database
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {localDb()
                                ? "Initialized and ready"
                                : "Initializing..."}
                            </div>
                          </div>
                        </div>

                        {/* Sync Status */}
                        <div class="flex items-start gap-2">
                          <Show
                            when={isOnline() && pendingCount() === 0}
                            fallback={
                              <span class="text-yellow-500 text-sm">
                                {isOnline() ? "🔄" : "⚠️"}
                              </span>
                            }
                          >
                            <span class="text-green-500 text-sm">✓</span>
                          </Show>
                          <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {statusText()}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {isAnonymous() &&
                                "Data stored on this device only"}
                              {!isAnonymous() &&
                                !isOnline() &&
                                "Changes will sync when reconnected"}
                              {!isAnonymous() &&
                                isOnline() &&
                                pendingCount() === 0 &&
                                "All changes synced to Supabase"}
                              {!isAnonymous() &&
                                isOnline() &&
                                pendingCount() > 0 &&
                                `${pendingCount()} change${pendingCount() === 1 ? "" : "s"} syncing...`}
                            </div>
                            <div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
                              <span class="font-medium text-gray-600 dark:text-gray-300">
                                Last Sync:
                              </span>{" "}
                              {lastSyncTimestamp()
                                ? `${new Date(lastSyncTimestamp()!).toLocaleString()} (${formatRelativeTime(lastSyncTimestamp()!)} ago, ${lastSyncMode() || "n/a"})`
                                : "Not yet"}
                            </div>
                          </div>
                        </div>

                        {/* Connection Status */}
                        <div class="flex items-start gap-2">
                          <span
                            class={`text-sm ${isOnline() ? "text-green-500" : "text-yellow-500"}`}
                          >
                            {isOnline() ? "🌐" : "📴"}
                          </span>
                          <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Network
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                              {isOnline() ? "Online" : "Offline"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Force Sync Up Button */}
                    <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={async () => {
                          console.log(
                            "🔄 [Force Sync Up] Button clicked - starting sync..."
                          );
                          try {
                            const deletes = await getPendingDeleteCount();
                            setPendingDeleteCount(deletes);

                            if (deletes > 0) {
                              setShowForceSyncUpConfirm(true);
                              return;
                            }

                            await runForceSyncUp();
                          } catch (error) {
                            console.error(
                              "❌ [Force Sync Up] Preflight failed:",
                              error
                            );
                            toast.error("Failed to check pending deletes");
                            setShowDbMenu(false);
                          }
                        }}
                        class="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2 rounded-md font-medium"
                        disabled={!isOnline() || forceSyncUpBusy()}
                        classList={{
                          "opacity-50 cursor-not-allowed":
                            !isOnline() || forceSyncUpBusy(),
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Force Sync Up
                        {!isOnline() && (
                          <span class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            (Offline)
                          </span>
                        )}
                      </button>
                    </div>

                    <AlertDialog
                      open={showForceSyncUpConfirm()}
                      onOpenChange={setShowForceSyncUpConfirm}
                    >
                      <AlertDialogContent>
                        <AlertDialogCloseButton />
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Allow record deletions?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {pendingDeleteCount()} pending delete operation(s)
                            are queued for upload. You can upload changes
                            without deletions, or allow deletions to be applied
                            on Supabase.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <button
                            type="button"
                            class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => setShowForceSyncUpConfirm(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                            onClick={async () => {
                              setShowForceSyncUpConfirm(false);
                              await runForceSyncUp({ allowDeletes: false });
                            }}
                          >
                            Upload (no deletions)
                          </button>
                          <button
                            type="button"
                            class="px-4 py-2 rounded-md bg-red-600 text-white text-sm hover:bg-red-700"
                            onClick={async () => {
                              setShowForceSyncUpConfirm(false);
                              await runForceSyncUp({ allowDeletes: true });
                            }}
                          >
                            Upload (allow deletions)
                          </button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Force Sync Down Button */}
                    <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={async () => {
                          console.log(
                            "🔄 [Force FULL Sync Down] Button clicked - starting FULL sync..."
                          );
                          try {
                            await forceSyncDown({ full: true });
                            console.log(
                              "✅ [Force FULL Sync Down] Full sync completed successfully"
                            );
                            toast.success("Remote data downloaded");
                            setShowDbMenu(false); // Close menu after successful sync
                          } catch (error) {
                            console.error(
                              "❌ [Force FULL Sync Down] Full sync failed:",
                              error
                            );
                            toast.error("Failed to perform full download");
                            setShowDbMenu(false); // Close menu even on error
                          }
                        }}
                        class="w-full px-4 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2 rounded-md font-medium"
                        disabled={!isOnline()}
                        classList={{
                          "opacity-50 cursor-not-allowed": !isOnline(),
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Force Full Sync Down
                        {!isOnline() && (
                          <span class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            (Offline)
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Database Browser (Temporarily enabled for production) */}
                    {/* TODO: Restore dev-only condition: <Show when={import.meta.env.DEV}> */}
                    {/* TODO: Switch back to target="_blank" after https://github.com/sboagy/tunetrees/issues/321 is resolved */}
                    <Show when={true}>
                      <a
                        href="/debug/db"
                        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                        onClick={() => setShowDbMenu(false)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Database Browser (Dev)
                      </a>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </div>

      {/* Playlist Manager Dialog */}
      <PlaylistManagerDialog
        isOpen={showPlaylistManager()}
        onClose={() => setShowPlaylistManager(false)}
      />

      {/* About Dialog */}
      <AboutDialog
        isOpen={showAboutDialog()}
        onClose={() => setShowAboutDialog(false)}
      />
    </nav>
  );
};
