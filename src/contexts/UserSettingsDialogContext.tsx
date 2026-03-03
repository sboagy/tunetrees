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

import {
  type Accessor,
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

// Matches sidebarNavItems href slugs in routes/user-settings/index.tsx
export type UserSettingsTab =
  | "appearance"
  | "catalog-sync"
  | "scheduling-options"
  | "spaced-repetition"
  | "plugins"
  | "account"
  | "avatar"
  | "goals";

interface UserSettingsDialogContextValue {
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
const DEFAULT_TAB: UserSettingsTab = "scheduling-options";

export const UserSettingsDialogProvider: ParentComponent = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [currentTab, setCurrentTab] =
    createSignal<UserSettingsTab>(DEFAULT_TAB);

  const openUserSettings = (tab?: UserSettingsTab) => {
    if (tab) setCurrentTab(tab);
    setIsOpen(true);
  };

  const closeUserSettings = () => {
    setIsOpen(false);
  };

  const navigateToTab = (tab: UserSettingsTab) => {
    setCurrentTab(tab);
  };

  return (
    <UserSettingsDialogContext.Provider
      value={{
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
