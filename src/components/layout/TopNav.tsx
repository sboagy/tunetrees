/**
 * Top Navigation Bar
 *
 * Displays app branding, user information, and logout button.
 * Matches legacy: legacy/frontend/components/TopNav.tsx
 *
 * @module components/layout/TopNav
 */

import { A } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { getSyncQueueStats } from "../../lib/sync/queue";
import { LogoutButton } from "../auth";
import { ThemeSwitcher } from "./ThemeSwitcher";

/**
 * Top Navigation Component
 *
 * Features:
 * - App logo and branding
 * - User email display
 * - Theme switcher
 * - Logout button
 * - Network/sync status indicator
 * - Responsive design
 */
export const TopNav: Component = () => {
  const { user, localDb } = useAuth();
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);
  const [pendingCount, setPendingCount] = createSignal(0);
  const [showDetails, setShowDetails] = createSignal(false);

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
        console.error("Failed to get sync queue stats:", error);
      }
    };

    updateSyncCount();
    const interval = setInterval(updateSyncCount, 5000);
    onCleanup(() => clearInterval(interval));
  });

  const statusColor = () => {
    if (!isOnline()) return "text-yellow-600 dark:text-yellow-400";
    if (pendingCount() > 0) return "text-blue-600 dark:text-blue-400";
    return "text-green-600 dark:text-green-400";
  };

  const statusIcon = () => {
    if (!isOnline()) return "⚠️";
    if (pendingCount() > 0) return "🔄";
    return "✓";
  };

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
              <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                TuneTrees
              </span>
            </a>

            {/* Navigation Links */}
            <div class="hidden md:flex items-center gap-1">
              <A
                href="/playlists"
                class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                activeClass="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              >
                📋 Playlists
              </A>
              <A
                href="/practice/history"
                class="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                activeClass="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
              >
                📊 History
              </A>
            </div>
          </div>

          {/* User Info + Theme + Logout */}
          <div class="flex items-center gap-4">
            {/* Network/Sync Status Indicator */}
            <div class="relative">
              <button
                type="button"
                class={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${statusColor()} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600`}
                aria-label={`Network status: ${statusText()}`}
                onMouseEnter={() => setShowDetails(true)}
                onMouseLeave={() => setShowDetails(false)}
                onFocus={() => setShowDetails(true)}
                onBlur={() => setShowDetails(false)}
              >
                <span class="text-sm">{statusIcon()}</span>
                <span class="hidden sm:inline">{statusText()}</span>
              </button>

              {/* Tooltip on hover */}
              <Show when={showDetails()}>
                <div class="absolute right-0 top-full mt-2 w-56 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <div class="space-y-2 text-xs">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-600 dark:text-gray-400">
                        Connection:
                      </span>
                      <span
                        class={`font-medium ${
                          isOnline()
                            ? "text-green-600 dark:text-green-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      >
                        {isOnline() ? "Online" : "Offline"}
                      </span>
                    </div>
                    <Show when={pendingCount() > 0}>
                      <div class="flex items-center justify-between">
                        <span class="text-gray-600 dark:text-gray-400">
                          Pending:
                        </span>
                        <span class="font-medium text-blue-600 dark:text-blue-400">
                          {pendingCount()} change
                          {pendingCount() === 1 ? "" : "s"}
                        </span>
                      </div>
                    </Show>
                    <div class="pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                      {!isOnline() && "Changes will sync when reconnected"}
                      {isOnline() &&
                        pendingCount() === 0 &&
                        "All changes synced"}
                      {isOnline() &&
                        pendingCount() > 0 &&
                        "Syncing in background..."}
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            <Show when={user()}>
              {(u) => (
                <span class="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">
                  {u().email}
                </span>
              )}
            </Show>
            <ThemeSwitcher />
            <LogoutButton
              onSuccess={() => {
                window.location.href = "/";
              }}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
