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
import { useAuth } from "../../lib/auth/AuthContext";
import { useCurrentPlaylist } from "../../lib/context/CurrentPlaylistContext";
import { getUserPlaylists } from "../../lib/db/queries/playlists";
import type { PlaylistWithSummary } from "../../lib/db/types";
import { useClickOutside } from "../../lib/hooks/useClickOutside";
import { log } from "../../lib/logger";
import {
  getSelectedPlaylistId,
  setSelectedPlaylistId,
} from "../../lib/services/playlist-service";
import { getSyncQueueStats } from "../../lib/sync/queue";
import { PlaylistManagerDialog } from "../playlists/PlaylistManagerDialog";
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
 * Playlist Dropdown Component
 *
 * Dropdown for selecting active playlist with "Manage Playlists..." option
 */
const PlaylistDropdown: Component<{
  onOpenPlaylistManager: () => void;
}> = (props) => {
  const { user, localDb, repertoireListChanged } = useAuth();
  const { currentPlaylistId, setCurrentPlaylistId } = useCurrentPlaylist();
  const [showDropdown, setShowDropdown] = createSignal(false);
  let dropdownContainerRef: HTMLDivElement | undefined;
  const { initialSyncComplete } = useAuth();

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
  const [playlists] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = repertoireListChanged(); // Triggers refetch when playlists change
      const syncComplete = initialSyncComplete();
      if (!syncComplete) return null;

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

      // Fetch if database and user are ready
      // Will return empty array on first login, then refetch when repertoire changes (version increments)
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      console.log("📋 [TopNav] Fetching playlists with params:", params);
      log.debug("TOPNAV playlists fetcher:", {
        hasParams: !!params,
        repertoireListChanged: params?.version,
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
          <div class="py-2" data-testid="top-nav-manage-playlists-panel">
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
  let userMenuContainerRef: HTMLDivElement | undefined;
  let dbMenuContainerRef: HTMLDivElement | undefined;

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
    if (!db || isAnonymous()) {
      setPendingCount(0); // Reset count for anonymous users
      return;
    }

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
            <PlaylistDropdown
              onOpenPlaylistManager={() => setShowPlaylistManager(true)}
            />
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
                          {u().email}
                        </span>
                        {/* User Avatar */}
                        <Show
                          when={userAvatar()}
                          fallback={
                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                              {u().email?.charAt(0).toUpperCase()}
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
                      {/* User Information - only for authenticated users */}
                      <Show when={user()}>
                        {(u) => (
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
                        )}
                      </Show>

                      {/* Anonymous User Info */}
                      <Show when={!user() && isAnonymous()}>
                        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            Device-Only Mode
                          </h3>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            Your data is stored locally on this device only.
                          </p>
                        </div>
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
                            await forceSyncUp();
                            console.log(
                              "✅ [Force Sync Up] Sync completed successfully"
                            );
                            toast.success("Local changes uploaded to server");
                            setShowDbMenu(false); // Close menu after successful sync
                          } catch (error) {
                            console.error(
                              "❌ [Force Sync Up] Sync failed:",
                              error
                            );
                            toast.error("Failed to upload changes");
                            setShowDbMenu(false); // Close menu even on error
                          }
                        }}
                        class="w-full px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-2 rounded-md font-medium"
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
                    <Show when={true}>
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
          </div>
        </div>
      </div>

      {/* Playlist Manager Dialog */}
      <PlaylistManagerDialog
        isOpen={showPlaylistManager()}
        onClose={() => setShowPlaylistManager(false)}
      />
    </nav>
  );
};
