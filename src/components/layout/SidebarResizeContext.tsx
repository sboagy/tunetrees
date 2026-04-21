/**
 * Sidebar Resize Context
 *
 * Exposes the Sidebar's resize event handlers so that sibling or descendant
 * components can act as the resize drag target without prop drilling.
 *
 * Typical use: when the sidebar is bottom-docked, the "N tunes due" sticky
 * footer in TunesGridScheduled reads from this context and becomes the resize
 * handle instead of relying on the thin strip at the top of the sidebar.
 *
 * Usage:
 *   - Wrap the app (or MainLayout) with <SidebarResizeProvider>.
 *   - Sidebar calls `registerHandlers()` when it is bottom-docked and
 *     `registerHandlers(null)` when it switches away from bottom-dock.
 *   - Consumers call `handlers()` to get the current handlers (null = not
 *     bottom-docked or sidebar is collapsed).
 *
 * @module components/layout/SidebarResizeContext
 */
import {
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from "solid-js";

export interface ResizeHandlers {
  onMouseDown: (e: MouseEvent) => void;
  onTouchStart: (e: TouchEvent) => void;
}

interface SidebarResizeContextValue {
  /** Resize handlers registered by the Sidebar. Null when sidebar is not bottom-docked. */
  handlers: () => ResizeHandlers | null;
  /** Called by Sidebar to register or clear resize handlers. */
  registerHandlers: (h: ResizeHandlers | null) => void;
}

const SidebarResizeContext = createContext<SidebarResizeContextValue>();

export const useSidebarResize = () => {
  const context = useContext(SidebarResizeContext);
  if (!context) {
    throw new Error(
      "useSidebarResize must be used within SidebarResizeProvider"
    );
  }
  return context;
};

export const SidebarResizeProvider: ParentComponent = (props) => {
  const [handlers, setHandlers] = createSignal<ResizeHandlers | null>(null);

  return (
    <SidebarResizeContext.Provider
      value={{
        handlers,
        registerHandlers: setHandlers,
      }}
    >
      {props.children}
    </SidebarResizeContext.Provider>
  );
};
