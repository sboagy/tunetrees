/**
 * Top Navigation Bar
 *
 * Displays app branding, user information, and logout button.
 * Matches legacy: legacy/frontend/components/TopNav.tsx
 *
 * @module components/layout/TopNav
 */

import { useNavigate } from "@solidjs/router";
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
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { getUserPlaylists } from "../../lib/db/queries/playlists";
import type { PlaylistWithSummary } from "../../lib/db/types";
import { log } from "../../lib/logger";
import {
  getSelectedPlaylistId,
  setSelectedPlaylistId,
} from "../../lib/services/playlist-service";
import { getSyncQueueStats } from "../../lib/sync/queue";
import { ThemeSwitcher } from "./ThemeSwitcher";

// Helper function to get display name for a playlist
const getPlaylistDisplayName = (playlist: PlaylistWithSummary): string => {
  // If name exists and is not empty, use it
  if (playlist.name?.trim()) {
    return playlist.name.trim();
  }

  // Otherwise use instrument + id format
  const instrument = playlist.instrumentName || "Unknown";
  return `${instrument} (${playlist.playlistId})`;
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
 * Playlist Dropdown Component
 *
 * Dropdown for selecting active playlist with "Manage Playlists..." option
 */
const PlaylistDropdown: Component = () => {
  const navigate = useNavigate();
  const { user, localDb, syncVersion } = useAuth();
  const { currentPlaylistId, setCurrentPlaylistId } = useCurrentPlaylist();
  const [showDropdown, setShowDropdown] = createSignal(false);

  // Fetch user playlists
  // Fetch immediately if data exists in SQLite, don't wait for sync
  // syncVersion is still tracked as a dependency to trigger refetch after sync
  const [playlists] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = syncVersion(); // Triggers refetch when sync completes

      console.log("🔍 [TopNav] Playlists dependency check:", {
        hasDb: !!db,
        userId,
        userObject: user(),
        syncVersion: version,
        shouldFetch: !!(db && userId),
      });
      log.debug("TOPNAV playlists dependency:", {
        hasDb: !!db,
        userId,
        syncVersion: version,
      });

      // Fetch if database and user are ready
      // Will return empty array on first login, then refetch when sync completes (version increments)
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      console.log("📋 [TopNav] Fetching playlists with params:", params);
      log.debug("TOPNAV playlists fetcher:", {
        hasParams: !!params,
        syncVersion: params?.version,
      });
      if (!params) return [];

      try {
        console.log(
          "🔄 [TopNav] Calling getUserPlaylists with userId:",
          params.userId
        );
        const result = await getUserPlaylists(params.db, params.userId);
        console.log("✅ [TopNav] Got playlists:", result.length, result);
        log.debug("TOPNAV playlists result:", result.length, "playlists");
        return result;
      } catch (error) {
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

  const handlePlaylistSelect = (playlistId: number) => {
    const userId = user()?.id;
    if (!userId) return;

    setCurrentPlaylistId(playlistId);
    setSelectedPlaylistId(userId, playlistId);
    setShowDropdown(false);
  };

  const handleManagePlaylists = () => {
    setShowDropdown(false);
    navigate("/playlists");
  };

  const selectedPlaylist = createMemo(() => {
    const id = currentPlaylistId();
    const playlistsList = playlists();
    if (!id || !playlistsList) return null;
    return playlistsList.find((p) => p.playlistId === id);
  });

  return (
    <div class="relative">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown())}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        aria-label="Select playlist"
        aria-expanded={showDropdown()}
      >
        <span class="hidden md:inline font-medium">
          {selectedPlaylist()
            ? getPlaylistDisplayName(selectedPlaylist()!)
            : "No Playlist"}
        </span>
        <span class="md:hidden">📋</span>
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
          <div class="py-2">
            {/* Playlists List */}
            <Show
              when={!playlists.loading && playlists()}
              fallback={
                <div class="px-4 py-2 text-sm text-gray-500">
                  Loading playlists...
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

            {/* Manage Playlists */}
            <button
              type="button"
              class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              onClick={handleManagePlaylists}
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
              Manage Playlists...
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export const TopNav: Component = () => {
  const { user, localDb, signOut, forceSyncDown } = useAuth();
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  const [pendingCount, setPendingCount] = createSignal(0);
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  const [showDbMenu, setShowDbMenu] = createSignal(false);

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

  // Poll for pending sync count
  createEffect(() => {
    const db = localDb();
    if (!db) return;

    const updateSyncCount = async () => {
      try {
        const stats = await getSyncQueueStats(db);
        setPendingCount(stats.pending + stats.syncing);
      } catch (error) {
        log.error("Failed to get sync queue stats:", error);
      }
    };

    updateSyncCount();
    const interval = setInterval(updateSyncCount, 5000);
    onCleanup(() => clearInterval(interval));
  });

  const statusText = () => {
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
            {/* App Logo */}
            <a
              href="/"
              class="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <img
                src="/logo4.png"
                alt="TuneTrees Logo"
                width="48"
                height="48"
                class="h-12 w-12 object-contain"
              />
              <span class="ml-[0ch] text-lg dark:text-blue-400">TuneTrees</span>
            </a>

            {/* Playlist Selector */}
            <PlaylistDropdown />
          </div>

          {/* User Info + Theme + Logout */}
          <div class="flex items-center gap-4">
            {/* User Menu Dropdown */}
            <Show when={user()}>
              {(u) => (
                <div class="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserMenu(!showUserMenu())}
                    onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                    aria-label="User menu"
                    aria-expanded={showUserMenu()}
                  >
                    <span class="hidden sm:inline font-medium">
                      {u().email}
                    </span>
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
                    <div class="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                      <div class="py-2">
                        {/* User Information */}
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
                                {u().email}
                              </dd>
                            </div>
                            <div class="flex gap-2">
                              <dt class="font-medium text-gray-600 dark:text-gray-400">
                                Name:
                              </dt>
                              <dd class="text-gray-900 dark:text-gray-100">
                                {u().user_metadata?.name || "Not set"}
                              </dd>
                            </div>
                            <div class="flex gap-2">
                              <dt class="font-medium text-gray-600 dark:text-gray-400">
                                User ID:
                              </dt>
                              <dd class="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                                {u().id}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {/* Menu Items */}
                        <button
                          type="button"
                          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                          onClick={() => {
                            setShowUserMenu(false);
                            // TODO: Open user settings modal
                            log.debug("User Settings clicked");
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
              )}
            </Show>

            {/* Database/Sync Status Dropdown */}
            <div class="relative">
              <button
                type="button"
                onClick={() => setShowDbMenu(!showDbMenu())}
                onBlur={() => setTimeout(() => setShowDbMenu(false), 200)}
                class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                aria-label="Database and sync status"
                aria-expanded={showDbMenu()}
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
                <div class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
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
                              {!isOnline() &&
                                "Changes will sync when reconnected"}
                              {isOnline() &&
                                pendingCount() === 0 &&
                                "All changes synced to Supabase"}
                              {isOnline() &&
                                pendingCount() > 0 &&
                                `${pendingCount()} change${
                                  pendingCount() === 1 ? "" : "s"
                                } syncing...`}
                            </div>
                          </div>
                        </div>

                        {/* Connection Status */}
                        <div class="flex items-start gap-2">
                          <span
                            class={`text-sm ${
                              isOnline() ? "text-green-500" : "text-yellow-500"
                            }`}
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

                    {/* Force Sync Down Button */}
                    <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={async () => {
                          console.log(
                            "🔄 [Force Sync Down] Button clicked - starting sync..."
                          );
                          try {
                            await forceSyncDown();
                            console.log(
                              "✅ [Force Sync Down] Sync completed successfully"
                            );
                          } catch (error) {
                            console.error(
                              "❌ [Force Sync Down] Sync failed:",
                              error
                            );
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
                        Force Sync Down
                        {!isOnline() && (
                          <span class="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            (Offline)
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Database Browser (Dev Mode Only) */}
                    <Show when={import.meta.env.DEV}>
                      <a
                        href="/debug/db"
                        target="_blank"
                        rel="noopener noreferrer"
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

            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
};
