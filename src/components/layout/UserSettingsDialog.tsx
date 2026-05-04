/**
 * UserSettingsDialog
 *
 * Context-driven settings overlay.  Renders the same settings panel as the
 * route-based UserSettingsLayout but WITHOUT navigating away from the current
 * page: the practice page (and its staged evaluations) stays fully mounted.
 *
 * Tab selection is managed by UserSettingsDialogContext signals rather than
 * @solidjs/router <A> links, so no inner Router is needed.
 *
 * The existing /user-settings/* routes remain functional for backward-compat
 * deep-linking, but all in-app "Settings" entry points should use
 * `openUserSettings(tab?)` from the context instead.
 *
 * @module components/layout/UserSettingsDialog
 */

import { Menu, X } from "lucide-solid";
import {
  type Component,
  createSignal,
  lazy,
  Match,
  Show,
  Suspense,
  Switch,
} from "solid-js";
import {
  type UserSettingsTab,
  useUserSettingsDialog,
} from "@/contexts/UserSettingsDialogContext";

const AppearancePage = lazy(() => import("@/routes/user-settings/appearance"));
const CatalogSyncPage = lazy(
  () => import("@/routes/user-settings/catalog-sync")
);
const SchedulingOptionsPage = lazy(
  () => import("@/routes/user-settings/scheduling-options")
);
const SpacedRepetitionPage = lazy(
  () => import("@/routes/user-settings/spaced-repetition")
);
const PluginsPage = lazy(() => import("@/routes/user-settings/plugins"));
const AccountPage = lazy(() => import("@/routes/user-settings/account"));
const AvatarPage = lazy(() => import("@/routes/user-settings/avatar"));
const GoalsPage = lazy(() => import("@/routes/user-settings/goals"));

interface NavItem {
  title: string;
  tab: UserSettingsTab;
}

const sidebarNavItems: NavItem[] = [
  { title: "Appearance", tab: "appearance" },
  { title: "Catalog & Sync", tab: "catalog-sync" },
  { title: "Scheduling Options", tab: "scheduling-options" },
  { title: "Spaced Repetition", tab: "spaced-repetition" },
  { title: "Plugins", tab: "plugins" },
  { title: "Goals", tab: "goals" },
  { title: "Account", tab: "account" },
  { title: "Avatar", tab: "avatar" },
];

const TabContent: Component<{ tab: UserSettingsTab }> = (props) => (
  <Suspense
    fallback={
      <div class="animate-pulse text-sm text-gray-400 p-4">Loading…</div>
    }
  >
    <Switch>
      <Match when={props.tab === "appearance"}>
        <AppearancePage />
      </Match>
      <Match when={props.tab === "catalog-sync"}>
        <CatalogSyncPage />
      </Match>
      <Match when={props.tab === "scheduling-options"}>
        <SchedulingOptionsPage />
      </Match>
      <Match when={props.tab === "spaced-repetition"}>
        <SpacedRepetitionPage />
      </Match>
      <Match when={props.tab === "plugins"}>
        <PluginsPage />
      </Match>
      <Match when={props.tab === "goals"}>
        <GoalsPage />
      </Match>
      <Match when={props.tab === "account"}>
        <AccountPage />
      </Match>
      <Match when={props.tab === "avatar"}>
        <AvatarPage />
      </Match>
    </Switch>
  </Suspense>
);

export const UserSettingsDialog: Component = () => {
  const { isOpen, currentTab, closeUserSettings, navigateToTab } =
    useUserSettingsDialog();
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeUserSettings();
  };

  const handleTabClick = (tab: UserSettingsTab) => {
    navigateToTab(tab);
    setIsSidebarOpen(false);
  };

  return (
    <Show when={isOpen()}>
      <button
        type="button"
        class="fixed inset-0 bg-black/50 z-40"
        onClick={closeUserSettings}
        onKeyDown={handleKeyDown}
        aria-label="Close settings"
        data-testid="settings-modal-backdrop"
      />

      <div
        class="fixed inset-0 z-50 flex items-start justify-center pt-2 md:pt-8 pb-2 md:pb-16 pointer-events-none"
        data-testid="settings-modal-wrapper"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Event handled by backdrop */}
        <div
          class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-full md:max-w-6xl h-[calc(100vh-1rem)] md:max-h-[calc(100vh-8rem)] flex flex-col pointer-events-auto mx-2"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="settings-dialog-title"
          aria-modal="true"
          data-testid="settings-modal"
        >
          <div class="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between shrink-0">
            <div class="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                class="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                aria-label="Toggle menu"
                data-testid="settings-menu-toggle"
              >
                <Menu class="w-5 h-5" aria-hidden="true" />
              </button>

              <div>
                <h2
                  id="settings-dialog-title"
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
              onClick={closeUserSettings}
              class="relative z-10 flex h-10 w-10 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 shrink-0"
              aria-label="Close settings"
              data-testid="settings-close-button"
            >
              <X class="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div class="flex-1 flex min-h-0 overflow-hidden relative">
            <Show when={isSidebarOpen()}>
              <button
                type="button"
                class="md:hidden fixed inset-0 bg-black/30 z-10"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close menu"
              />
            </Show>

            <aside
              class="absolute md:relative z-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 h-full transition-transform md:transition-none"
              classList={{
                "translate-x-0 w-64": isSidebarOpen(),
                "-translate-x-full w-0 p-0": !isSidebarOpen(),
                "md:translate-x-0 md:w-64 md:p-4": true,
              }}
              data-testid="settings-sidebar"
            >
              <nav class="flex flex-col space-y-1">
                {sidebarNavItems.map((item) => (
                  <button
                    type="button"
                    onClick={() => handleTabClick(item.tab)}
                    class="px-3 py-2 text-sm rounded-md transition-colors text-left"
                    classList={{
                      "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium":
                        currentTab() === item.tab,
                      "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700":
                        currentTab() !== item.tab,
                    }}
                    data-testid={`settings-tab-${item.tab}`}
                  >
                    {item.title}
                  </button>
                ))}
              </nav>
            </aside>

            <main
              class="flex-1 overflow-y-auto p-4 md:p-6 w-full"
              data-testid="settings-content"
            >
              <TabContent tab={currentTab()} />
            </main>
          </div>
        </div>
      </div>
    </Show>
  );
};
