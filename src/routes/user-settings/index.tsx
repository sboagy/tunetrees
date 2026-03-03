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
    title: "Appearance",
    href: "/user-settings/appearance",
  },
  {
    title: "Catalog & Sync",
    href: "/user-settings/catalog-sync",
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
    title: "Plugins",
    href: "/user-settings/plugins",
  },
  {
    title: "Goals",
    href: "/user-settings/goals",
  },
  {
    title: "Account",
    href: "/user-settings/account",
  },
  {
    title: "Avatar",
    href: "/user-settings/avatar",
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
 * Responsive: hamburger menu on mobile, sidebar on desktop
 */
const UserSettingsLayout: ParentComponent = (props) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = createSignal(true);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);

  const handleClose = () => {
    setIsOpen(false);
    // Navigate back to preserve tab/repertoire context
    if (typeof window !== "undefined") {
      const returnTo = window.sessionStorage.getItem("tt-settings-return");
      if (returnTo) {
        window.sessionStorage.removeItem("tt-settings-return");
        if (!returnTo.startsWith("/user-settings")) {
          navigate(returnTo, { replace: true });
          return;
        }
      }
    }

    navigate("/", { replace: true });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen());
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
        class="fixed inset-0 z-50 flex items-start justify-center pt-2 md:pt-8 pb-2 md:pb-16 pointer-events-none"
        data-testid="settings-modal-wrapper"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Event handled by backdrop */}
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-full md:max-w-6xl h-[calc(100vh-1rem)] md:max-h-[calc(100vh-8rem)] flex flex-col pointer-events-auto mx-2"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="settings-title"
          aria-modal="true"
          data-testid="settings-modal"
        >
          {/* Header */}
          <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between shrink-0">
            <div class="flex items-center gap-3">
              {/* Mobile Menu Toggle */}
              <button
                type="button"
                onClick={toggleSidebar}
                class="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                aria-label="Toggle menu"
                data-testid="settings-menu-toggle"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Menu</title>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>

              <div>
                <h2
                  id="settings-title"
                  class="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100"
                >
                  Settings
                </h2>
                <p class="hidden md:block text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage your account settings and set scheduling preferences.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
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
          <div class="flex-1 flex min-h-0 overflow-hidden relative">
            {/* Mobile Sidebar Overlay */}
            <Show when={isSidebarOpen()}>
              <button
                type="button"
                class="md:hidden fixed inset-0 bg-black/30 z-10"
                onClick={toggleSidebar}
                aria-label="Close menu"
              />
            </Show>

            {/* Sidebar */}
            <aside
              class="absolute md:relative z-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 h-full transition-transform md:transition-none"
              classList={{
                "translate-x-0 w-64": isSidebarOpen(),
                "-translate-x-full w-0 p-0": !isSidebarOpen(),
                "md:translate-x-0 md:w-64 md:p-4": true,
              }}
              data-testid="settings-sidebar"
            >
              <SidebarNav items={sidebarNavItems} />
            </aside>

            {/* Content Area - Full width on mobile, respects sidebar on desktop */}
            <main
              class="flex-1 overflow-y-auto p-4 md:p-6 w-full"
              data-testid="settings-content"
            >
              {props.children}
            </main>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default UserSettingsLayout;
