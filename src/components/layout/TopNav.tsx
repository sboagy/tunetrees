/**
 * Top Navigation Bar
 *
 * Displays app branding, user information, and logout button.
 * Matches legacy: legacy/frontend/components/TopNav.tsx
 *
 * @module components/layout/TopNav
 */

import { A } from "@solidjs/router";
import { type Component, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
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
 * - Responsive design
 */
export const TopNav: Component = () => {
  const { user } = useAuth();

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
