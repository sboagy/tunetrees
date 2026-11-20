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

import { Dialog } from "@kobalte/core/dialog";
import { Menu, X } from "lucide-solid";
import {
  type Component,
  createSignal,
  For,
  type JSX,
  lazy,
  Match,
  type ParentProps,
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
const PluginsPage = lazy(() => import("@/routes/user-settings/plugins"));
const AccountPage = lazy(() => import("@/routes/user-settings/account"));
const AvatarPage = lazy(() => import("@/routes/user-settings/avatar"));
const GoalsPage = lazy(() => import("@/routes/user-settings/goals"));
const StorageProviderPage = lazy(
  () => import("@/routes/user-settings/storage-provider")
);

interface NavItem {
  title: string;
  tab: UserSettingsTab;
}

const sidebarNavItems: NavItem[] = [
  { title: "Storage provider", tab: "storage-provider" },
  { title: "Appearance", tab: "appearance" },
  { title: "Catalog & Sync", tab: "catalog-sync" },
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
      <Match when={props.tab === "storage-provider"}>
        <StorageProviderPage />
      </Match>
      <Match when={props.tab === "appearance"}>
        <AppearancePage />
      </Match>
      <Match when={props.tab === "catalog-sync"}>
        <CatalogSyncPage />
      </Match>
      <Match when={props.tab === "scheduling-options"}>
        <SchedulingOptionsPage />
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
  const settings = useUserSettingsDialog();
  return (
    <SettingsShell
      open={settings.isOpen()}
      tab={settings.currentTab()}
      onClose={settings.closeUserSettings}
      onNavigate={settings.navigateToTab}
      pending={settings.draft()?.pending()}
      footer={settings.draft()?.footer(settings.closeUserSettings)}
    >
      <TabContent tab={settings.currentTab()} />
    </SettingsShell>
  );
};

/** Shared modal shell for overlay and route entry points (E2/E6, L2, R2). */
export function SettingsShell(
  props: ParentProps<{
    open: boolean;
    tab: UserSettingsTab;
    onClose: () => void;
    onNavigate: (tab: UserSettingsTab) => void;
    pending?: boolean;
    footer?: JSX.Element;
  }>
) {
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
  let title!: HTMLHeadingElement;
  const handleTabClick = (tab: UserSettingsTab) => {
    props.onNavigate(tab);
    setIsSidebarOpen(false);
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 bg-black/50 z-40"
          data-testid="settings-modal-backdrop"
        />
        <div
          class="fixed inset-0 z-50 flex items-start justify-center md:pt-8 md:pb-16 pointer-events-none"
          data-testid="settings-modal-wrapper"
        >
          <Dialog.Content
            class="bg-background text-foreground md:rounded-lg shadow-2xl border border-border w-full max-w-full md:max-w-6xl h-dvh md:max-h-[calc(100dvh-8rem)] flex flex-col pointer-events-auto"
            onInteractOutside={(event) => event.preventDefault()}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              title.focus();
            }}
            data-testid="settings-modal"
          >
            <div class="px-4 md:px-6 py-3 md:py-4 border-b border-border flex items-start justify-between shrink-0">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen())}
                  class="md:hidden min-h-11 min-w-11 p-2 text-foreground hover:bg-accent rounded-md"
                  aria-label="Toggle menu"
                  aria-expanded={isSidebarOpen()}
                  aria-controls="settings-sidebar"
                  data-testid="settings-menu-toggle"
                >
                  <Menu class="size-5" aria-hidden="true" />
                </button>
                <div>
                  <Dialog.Title
                    ref={title}
                    tabIndex={-1}
                    class="text-xl md:text-2xl font-semibold"
                  >
                    Settings
                  </Dialog.Title>
                  <Dialog.Description class="hidden md:block text-sm text-muted-foreground mt-1">
                    Manage your account settings and set scheduling preferences.
                  </Dialog.Description>
                </div>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                disabled={props.pending}
                class="relative z-10 flex size-11 items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent shrink-0 disabled:opacity-50"
                aria-label="Close settings"
                data-testid="settings-close-button"
              >
                <X class="size-5" aria-hidden="true" />
              </button>
            </div>
            <div class="flex-1 flex min-h-0 overflow-hidden relative">
              <Show when={isSidebarOpen()}>
                <button
                  type="button"
                  class="md:hidden absolute inset-0 bg-black/30 z-10"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-label="Close menu"
                />
              </Show>
              <aside
                id="settings-sidebar"
                class="md:block md:relative absolute z-20 bg-background border-r border-border overflow-y-auto p-4 h-full w-64 shrink-0"
                classList={{ hidden: !isSidebarOpen() }}
                data-testid="settings-sidebar"
              >
                <nav
                  class="flex flex-col space-y-1"
                  aria-label="Settings categories"
                >
                  <For each={sidebarNavItems}>
                    {(item) => (
                      <button
                        type="button"
                        onClick={() => handleTabClick(item.tab)}
                        disabled={props.pending}
                        class="min-h-11 px-3 py-2 text-sm rounded-md text-left disabled:opacity-50"
                        aria-current={
                          props.tab === item.tab ? "page" : undefined
                        }
                        classList={{
                          "bg-accent text-accent-foreground font-medium":
                            props.tab === item.tab,
                          "text-foreground hover:bg-accent":
                            props.tab !== item.tab,
                        }}
                        data-testid={`settings-tab-${item.tab}`}
                      >
                        {item.title}
                      </button>
                    )}
                  </For>
                </nav>
              </aside>
              <main
                class="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 w-full"
                data-testid="settings-content"
              >
                {props.children}
              </main>
            </div>
            <div class="shrink-0">{props.footer}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
