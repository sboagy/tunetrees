/**
 * UserSettingsDialogContext
 *
 * Provides a programmatic API to open/close the user-settings overlay Dialog
 * without navigating away from the current page.  This allows the practice
 * page (and its staged evaluations) to stay mounted while the user edits their
 * goals or any other setting.
 *
 * Usage:
 *   const { openUserSettings } = useUserSettingsDialog();
 *   openUserSettings("goals");          // open to a specific tab
 *   openUserSettings();                 // open to last/default tab
 *   closeUserSettings();
 *
 * @module contexts/UserSettingsDialogContext
 */

import { useBeforeLeave } from "@solidjs/router";
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  type ParentComponent,
  useContext,
} from "solid-js";

// Matches sidebarNavItems href slugs in routes/user-settings/index.tsx
export type UserSettingsTab =
  | "storage-provider"
  | "appearance"
  | "catalog-sync"
  | "scheduling-options"
  | "spaced-repetition"
  | "plugins"
  | "account"
  | "avatar"
  | "goals";

export interface SettingsDraftRegistration {
  footer: (close: () => void) => JSX.Element;
  pending: () => boolean;
  requestExit: (action: () => void) => void;
}

interface UserSettingsDialogContextValue {
  draft: Accessor<SettingsDraftRegistration | undefined>;
  registerDraft: (draft: SettingsDraftRegistration) => () => void;
  requestExit: (action: () => void) => void;
  /** Whether the settings overlay is currently visible. */
  isOpen: Accessor<boolean>;
  /** Currently selected settings tab slug. */
  currentTab: Accessor<UserSettingsTab>;
  /**
   * Open the settings overlay, optionally jumping to a specific tab.
   * If tab is omitted, the last-selected tab (or the default) is used.
   */
  openUserSettings: (tab?: UserSettingsTab) => void;
  /** Close the settings overlay. */
  closeUserSettings: () => void;
  /** Navigate to a tab without re-opening if already open. */
  navigateToTab: (tab: UserSettingsTab) => void;
}

const UserSettingsDialogContext =
  createContext<UserSettingsDialogContextValue>();

export function useUserSettingsDialog(): UserSettingsDialogContextValue {
  const ctx = useContext(UserSettingsDialogContext);
  if (!ctx) {
    throw new Error(
      "useUserSettingsDialog must be used inside <UserSettingsDialogProvider>"
    );
  }
  return ctx;
}

/** Default tab shown when no tab is specified on open. */
const DEFAULT_TAB: UserSettingsTab = "goals";

/** Old settings entry points resolve to the consolidated goal editor. */
function normalizeSettingsTab(tab: UserSettingsTab): UserSettingsTab {
  return tab === "scheduling-options" || tab === "spaced-repetition"
    ? "goals"
    : tab;
}

export const UserSettingsDialogProvider: ParentComponent = (props) => {
  const [draft, setDraft] = createSignal<SettingsDraftRegistration>();
  const registerDraft = (registration: SettingsDraftRegistration) => {
    setDraft(registration);
    return () => {
      if (draft() === registration) setDraft(undefined);
    };
  };
  const requestExit = (action: () => void) => {
    const current = draft();
    if (current) current.requestExit(action);
    else action();
  };
  const [isOpen, setIsOpen] = createSignal(false);
  const [currentTab, setCurrentTab] =
    createSignal<UserSettingsTab>(DEFAULT_TAB);

  const openUserSettings = (tab?: UserSettingsTab) => {
    const next = normalizeSettingsTab(tab ?? currentTab());
    const open = () => {
      setCurrentTab(next);
      setIsOpen(true);
    };
    if (isOpen() && next !== currentTab()) requestExit(open);
    else open();
  };

  const closeUserSettings = () => {
    requestExit(() => setIsOpen(false));
  };

  const navigateToTab = (tab: UserSettingsTab) => {
    if (normalizeSettingsTab(tab) !== currentTab())
      requestExit(() => setCurrentTab(normalizeSettingsTab(tab)));
  };

  return (
    <UserSettingsDialogContext.Provider
      value={{
        draft,
        registerDraft,
        requestExit,
        isOpen,
        currentTab,
        openUserSettings,
        closeUserSettings,
        navigateToTab,
      }}
    >
      {props.children}
    </UserSettingsDialogContext.Provider>
  );
};

/** Router hooks stay inside Router; the Settings overlay intentionally lives outside it. */
export const SettingsNavigationBoundary: ParentComponent = (props) => {
  const settings = useUserSettingsDialog();
  useBeforeLeave((event) => {
    if (!settings.draft()) return;
    event.preventDefault();
    settings.requestExit(() => event.retry(true));
  });
  return <>{props.children}</>;
};
