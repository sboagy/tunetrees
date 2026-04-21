import { describe, expect, it } from "vitest";
import {
  getSidebarResizeAction,
  getSidebarResizeStartSize,
  normalizeSidebarResizeDelta,
  SIDEBAR_COLLAPSED_SIZE,
  shouldCollapseSidebar,
} from "../src/components/layout/sidebarResize";

describe("sidebarResize", () => {
  it("preserves the user's exact dragged size above the collapse threshold", () => {
    expect(
      getSidebarResizeAction({
        requestedSize: 118,
        maxSize: 600,
        startedCollapsed: false,
        hasExpanded: false,
      })
    ).toEqual({
      type: "resize",
      size: 118,
      expand: false,
    });
  });

  it("keeps a collapsed sidebar collapsed until the drag clears the threshold", () => {
    expect(
      getSidebarResizeAction({
        requestedSize: SIDEBAR_COLLAPSED_SIZE,
        maxSize: 600,
        startedCollapsed: true,
        hasExpanded: false,
      })
    ).toEqual({ type: "stay-collapsed" });
  });

  it("expands from the collapsed size instead of jumping to the remembered width", () => {
    expect(
      getSidebarResizeAction({
        requestedSize: 92,
        maxSize: 600,
        startedCollapsed: true,
        hasExpanded: false,
      })
    ).toEqual({
      type: "resize",
      size: 92,
      expand: true,
    });
  });

  it("collapses again when a drag-open sidebar is pulled back under the threshold", () => {
    expect(
      getSidebarResizeAction({
        requestedSize: 39,
        maxSize: 600,
        startedCollapsed: true,
        hasExpanded: true,
      })
    ).toEqual({ type: "collapse" });
  });

  it("normalizes resize deltas for each dock direction", () => {
    expect(normalizeSidebarResizeDelta(24, "left")).toBe(24);
    expect(normalizeSidebarResizeDelta(24, "right")).toBe(-24);
    expect(normalizeSidebarResizeDelta(24, "bottom")).toBe(-24);
  });

  it("starts collapsed drags from the visible collapsed size", () => {
    expect(getSidebarResizeStartSize(true, 320)).toBe(SIDEBAR_COLLAPSED_SIZE);
    expect(getSidebarResizeStartSize(false, 320)).toBe(320);
  });

  it("treats the threshold itself as collapsed", () => {
    expect(shouldCollapseSidebar(SIDEBAR_COLLAPSED_SIZE)).toBe(true);
    expect(shouldCollapseSidebar(SIDEBAR_COLLAPSED_SIZE + 1)).toBe(false);
  });
});
