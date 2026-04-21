import type { DockPosition } from "./SidebarDockContext";

export const SIDEBAR_COLLAPSE_THRESHOLD = 40;
export const SIDEBAR_COLLAPSED_SIZE = SIDEBAR_COLLAPSE_THRESHOLD;

export type SidebarResizeAction =
  | { type: "stay-collapsed" }
  | { type: "collapse" }
  | { type: "resize"; size: number; expand: boolean };

interface SidebarResizeActionOptions {
  requestedSize: number;
  maxSize: number;
  startedCollapsed: boolean;
  hasExpanded: boolean;
  collapseThreshold?: number;
}

export function getSidebarResizeStartSize(
  collapsed: boolean,
  currentSize: number,
  collapsedSize = SIDEBAR_COLLAPSED_SIZE
) {
  return collapsed ? collapsedSize : currentSize;
}

export function normalizeSidebarResizeDelta(
  rawDelta: number,
  dockPosition: DockPosition
) {
  if (dockPosition === "bottom" || dockPosition === "right") {
    return -rawDelta;
  }

  return rawDelta;
}

export function shouldCollapseSidebar(
  finalSize: number,
  collapseThreshold = SIDEBAR_COLLAPSE_THRESHOLD
) {
  return finalSize <= collapseThreshold;
}

export function getSidebarResizeAction({
  requestedSize,
  maxSize,
  startedCollapsed,
  hasExpanded,
  collapseThreshold = SIDEBAR_COLLAPSE_THRESHOLD,
}: SidebarResizeActionOptions): SidebarResizeAction {
  if (requestedSize <= collapseThreshold) {
    if (startedCollapsed && !hasExpanded) {
      return { type: "stay-collapsed" };
    }

    return { type: "collapse" };
  }

  return {
    type: "resize",
    size: Math.min(maxSize, requestedSize),
    expand: startedCollapsed && !hasExpanded,
  };
}
