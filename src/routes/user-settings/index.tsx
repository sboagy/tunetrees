/**
 * User Settings Layout Route
 *
 * Settings dialog shell with sidebar navigation and content area.
 * Matches legacy: legacy/frontend/app/user-settings/layout.tsx
 *
 * @module routes/user-settings
 */

import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  type Component,
  createSignal,
  type ParentComponent,
  Show,
} from "solid-js";

interface SidebarNavItem {
  title: string;
  href: string;
}

const sidebarNavItems: SidebarNavItem[] = [
  {
    title: "Avatar",
    href: "/user-settings/avatar",
  },
  {
    title: "Scheduling Options",
    href: "/user-settings/scheduling-options",
  },
  {
    title: "Spaced Repetition",
    href: "/user-settings/spaced-repetition",
  },
  {
    title: "Account",
    href: "/user-settings/account",
  },
];

/**
 * Sidebar Navigation Component
 */
const SidebarNav: Component<{ items: SidebarNavItem[] }> = (props) => {
  const location = useLocation();

  return (
    <nav class="flex flex-col space-y-1">
      {props.items.map((item) => {
        const isActive = () => location.pathname === item.href;
        return (
          <A
            href={item.href}
            class="px-3 py-2 text-sm rounded-md transition-colors"
            classList={{
              "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium":
                isActive(),
              "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700":
                !isActive(),
            }}
          >
            {item.title}
          </A>
        );
      })}
    </nav>
  );
};

/**
 * User Settings Layout Component
 *
 * Renders as a modal dialog with sidebar navigation
 */
const UserSettingsLayout: ParentComponent = (props) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = createSignal(true);

  const handleClose = () => {
    setIsOpen(false);
    navigate("/");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <Show when={isOpen()}>
      {/* Modal Backdrop */}
      <button
        type="button"
        class="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
        onKeyDown={handleKeyDown}
        aria-label="Close settings modal"
        data-testid="settings-modal-backdrop"
      />

      {/* Modal Dialog */}
      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-16 pointer-events-none"
        data-testid="settings-modal-wrapper"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Event handled by backdrop */}
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-6xl max-h-[calc(100vh-8rem)] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="settings-title"
          aria-modal="true"
          data-testid="settings-modal"
        >
          {/* Header */}
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
            <div>
              <h2
                id="settings-title"
                class="text-2xl font-semibold text-gray-900 dark:text-gray-100"
              >
                Settings
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage your account settings and set scheduling preferences.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close settings"
              data-testid="settings-close-button"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Close icon"
              >
                <title>Close</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div class="flex-1 flex min-h-0 overflow-hidden">
            {/* Sidebar */}
            <aside class="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
              <SidebarNav items={sidebarNavItems} />
            </aside>

            {/* Content Area */}
            <main class="flex-1 overflow-y-auto p-6">{props.children}</main>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default UserSettingsLayout;
