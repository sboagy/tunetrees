/**
 * Sidebar Dock Position Context
 *
 * Manages the sidebar's dock position (left, right, or bottom).
 * Persists state to localStorage for immediate UI updates.
 * Mobile and desktop positions are stored separately so that
 * a user's desktop preference does not override their mobile preference.
 * TODO: Sync to database via tab_group_main_state.sidebarDockPosition
 *
 * @module components/layout/SidebarDockContext
 */

import {
  createContext,
  createSignal,
  onMount,
  type ParentComponent,
  useContext,
} from "solid-js";
import { createIsMobile } from "@/lib/hooks/useIsMobile";

export type DockPosition = "left" | "right" | "bottom";

/** localStorage key for the sidebar dock position on mobile viewports */
const MOBILE_KEY = "sidebar-dock-position-mobile";
/** localStorage key for the sidebar dock position on desktop viewports */
const DESKTOP_KEY = "sidebar-dock-position-desktop";
/** Legacy single key – migrated to DESKTOP_KEY on first load */
const LEGACY_KEY = "sidebar-dock-position";

interface SidebarDockContextValue {
  position: () => DockPosition;
  setPosition: (position: DockPosition) => void;
}

const SidebarDockContext = createContext<SidebarDockContextValue>();

export const useSidebarDock = () => {
  const context = useContext(SidebarDockContext);
  if (!context) {
    throw new Error("useSidebarDock must be used within SidebarDockProvider");
  }
  return context;
};

/**
 * Sidebar Dock Position Provider
 *
 * Wraps the app to provide sidebar dock position state.
 * Mobile and desktop positions are stored under separate localStorage keys so
 * that changing the sidebar position on a phone does not affect the desktop
 * layout and vice versa.
 *
 * Defaults:
 *  - mobile  → "bottom"
 *  - desktop → "left"
 *
 * @example
 * ```tsx
 * <SidebarDockProvider>
 *   <MainLayout>
 *     <YourContent />
 *   </MainLayout>
 * </SidebarDockProvider>
 * ```
 */
export const SidebarDockProvider: ParentComponent = (props) => {
  // Reactive viewport detection (updates on window resize via matchMedia)
  const isMobile = createIsMobile();

  // Separate position signals for mobile and desktop with appropriate defaults
  const [mobilePosition, setMobilePositionInternal] =
    createSignal<DockPosition>("bottom");
  const [desktopPosition, setDesktopPositionInternal] =
    createSignal<DockPosition>("left");

  // Load persisted positions from localStorage on mount
  onMount(() => {
    const savedMobile = localStorage.getItem(MOBILE_KEY);
    if (
      savedMobile === "left" ||
      savedMobile === "right" ||
      savedMobile === "bottom"
    ) {
      setMobilePositionInternal(savedMobile);
    }
    // else keep default "bottom" for mobile

    const savedDesktop = localStorage.getItem(DESKTOP_KEY);
    if (
      savedDesktop === "left" ||
      savedDesktop === "right" ||
      savedDesktop === "bottom"
    ) {
      setDesktopPositionInternal(savedDesktop);
    } else {
      // Migrate from legacy single key (if the user had a saved preference).
      // Only migrate "left"/"right" – "bottom" is now mobile-only, so if
      // the legacy key held "bottom" (e.g. from earlier dev/test sessions)
      // do not promote it to the desktop key; keep the "left" default instead.
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === "left" || legacy === "right") {
        setDesktopPositionInternal(legacy);
        localStorage.setItem(DESKTOP_KEY, legacy);
      }
      // else keep default "left" for desktop
    }
  });

  // Derived position: returns the correct signal based on current viewport
  const position = (): DockPosition =>
    isMobile() ? mobilePosition() : desktopPosition();

  // Wrapper that saves to the appropriate key depending on current viewport
  const setPosition = (newPosition: DockPosition) => {
    if (isMobile()) {
      setMobilePositionInternal(newPosition);
      localStorage.setItem(MOBILE_KEY, newPosition);
    } else {
      setDesktopPositionInternal(newPosition);
      localStorage.setItem(DESKTOP_KEY, newPosition);
    }
    // TODO: Save to database via tab_group_main_state
  };

  return (
    <SidebarDockContext.Provider value={{ position, setPosition }}>
      {props.children}
    </SidebarDockContext.Provider>
  );
};
