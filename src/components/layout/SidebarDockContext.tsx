/**
 * Sidebar Dock Position Context
 *
 * Manages the sidebar's dock position (left, right, or bottom).
 * Persists state to localStorage for immediate UI updates.
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

export type DockPosition = "left" | "right" | "bottom";

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
 * Loads from localStorage on mount, saves on every change.
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
  const [position, setPositionInternal] = createSignal<DockPosition>("left");

  // Load from localStorage on mount
  onMount(() => {
    const saved = localStorage.getItem("sidebar-dock-position");
    if (saved === "left" || saved === "right" || saved === "bottom") {
      setPositionInternal(saved);
    }
  });

  // Wrapper to save to localStorage on every change
  const setPosition = (newPosition: DockPosition) => {
    setPositionInternal(newPosition);
    localStorage.setItem("sidebar-dock-position", newPosition);
    // TODO: Save to database via tab_group_main_state
  };

  return (
    <SidebarDockContext.Provider value={{ position, setPosition }}>
      {props.children}
    </SidebarDockContext.Provider>
  );
};
