/**
 * Left Sidebar Component
 *
 * Provides collapsible, resizable panels for:
 * - Current tune information
 * - References (external links for current tune)
 * - Notes (practice notes and annotations)
 *
 * Features:
 * - Horizontally resizable with drag handle
 * - Fully collapsible
 * - Vertically scrollable content
 * - Mobile-responsive (auto-collapse on small screens)
 * - State persists to localStorage
 *
 * Port from: legacy/frontend/components/Sidebar.tsx
 *
 * @module components/layout/Sidebar
 */

import { ChevronLeft, ChevronRight, GripVertical } from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
} from "solid-js";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ReferencesPanel } from "@/components/references/ReferencesPanel";
import { TuneInfoHeader } from "@/components/sidebar";
import type { DockPosition } from "./SidebarDockContext";
import { SidebarDragHandle } from "./SidebarDragHandle";

/**
 * Sidebar Component Props
 */
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  onWidthChangeEnd?: (width: number) => void; // Called when drag ends (for localStorage save)
  minWidth?: number;
  maxWidth?: number;
  dockPosition: DockPosition;
  onDragStart?: () => void; // Called when drag handle starts dragging
  onDragEnd?: () => void; // Called when drag handle ends dragging
}

/**
 * Sidebar Component
 *
 * Features:
 * - Collapsible left panel
 * - Resizable width with drag handle
 * - Current tune info header
 * - References section (tune-related links)
 * - Notes section (practice notes)
 * - Responsive (auto-collapse on mobile)
 * - State persists across reloads
 *
 * Note: Uses CurrentTuneContext to track which tune's data to display
 *
 * @example
 * ```tsx
 * <Sidebar
 *   collapsed={sidebarCollapsed()}
 *   onToggle={() => setSidebarCollapsed(!sidebarCollapsed())}
 *   width={sidebarWidth()}
 *   onWidthChange={setSidebarWidth}
 * />
 * ```
 */
export const Sidebar: Component<SidebarProps> = (props) => {
  const minWidth = () => props.minWidth ?? 240;
  const maxWidth = () => props.maxWidth ?? 600;
  const [isResizing, setIsResizing] = createSignal(false);

  // Local width state for smooth dragging without triggering parent updates
  const [localWidth, setLocalWidth] = createSignal(props.width);

  // Sync local width with props only on initial mount or when externally changed
  // (e.g., loading from localStorage on different tab)
  createEffect(() => {
    const propsWidth = props.width;
    const currentLocal = localWidth();

    // Only update if props changed significantly (not just from our own drag)
    // AND we're not currently resizing
    if (!isResizing() && Math.abs(propsWidth - currentLocal) > 1) {
      setLocalWidth(propsWidth);
    }
  });

  // Track RAF ID for cleanup
  let rafId: number | null = null;

  // Handle resize drag with requestAnimationFrame throttling
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const horizontal = isHorizontal();
    const startPos = horizontal ? e.clientY : e.clientX;
    const startSize = localWidth();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Throttle updates using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        const currentPos = horizontal ? moveEvent.clientY : moveEvent.clientX;
        let delta = currentPos - startPos;

        // For bottom position, we need to invert delta (dragging down = smaller)
        if (horizontal) {
          delta = -delta;
        }
        // For right position, we need to invert delta (dragging left = bigger)
        if (props.dockPosition === "right") {
          delta = -delta;
        }

        const newSize = Math.max(
          minWidth(),
          Math.min(maxWidth(), startSize + delta)
        );
        // Update local state only - fast and doesn't trigger parent re-render
        setLocalWidth(newSize);
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Notify parent of final width
      const finalWidth = localWidth();
      props.onWidthChangeEnd?.(finalWidth);

      // End resizing state
      setIsResizing(false);

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = horizontal ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
  };

  // Handle touch-based resize for mobile
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const horizontal = isHorizontal();
    const touch = e.touches[0];
    const startPos = horizontal ? touch.clientY : touch.clientX;
    const startSize = localWidth();

    const handleTouchMove = (moveEvent: TouchEvent) => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Throttle updates using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        const touch = moveEvent.touches[0];
        const currentPos = horizontal ? touch.clientY : touch.clientX;
        let delta = currentPos - startPos;

        // For bottom position, we need to invert delta (dragging down = smaller)
        if (horizontal) {
          delta = -delta;
        }
        // For right position, we need to invert delta (dragging left = bigger)
        if (props.dockPosition === "right") {
          delta = -delta;
        }

        const newSize = Math.max(
          minWidth(),
          Math.min(maxWidth(), startSize + delta)
        );
        // Update local state only - fast and doesn't trigger parent re-render
        setLocalWidth(newSize);
        rafId = null;
      });
    };

    const handleTouchEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Notify parent of final width
      const finalWidth = localWidth();
      props.onWidthChangeEnd?.(finalWidth);

      // End resizing state
      setIsResizing(false);

      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.body.style.userSelect = "";
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    document.body.style.userSelect = "none";
  };

  // Cleanup on unmount
  onCleanup(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });

  const isHorizontal = () => props.dockPosition === "bottom";

  return (
    <aside
      class={`relative bg-gray-50/30 dark:bg-gray-800/30 flex-shrink-0 flex select-none ${
        isHorizontal()
          ? "flex-row border-t border-gray-200/20 dark:border-gray-700/20"
          : "flex-col border-r border-gray-200/20 dark:border-gray-700/20"
      } ${isResizing() ? "" : "transition-all duration-300"} z-10`}
      style={{
        [isHorizontal() ? "height" : "width"]: props.collapsed
          ? "40px"
          : `${localWidth()}px`,
        "will-change": isResizing()
          ? isHorizontal()
            ? "height"
            : "width"
          : "auto",
      }}
    >
      {/* Drag Handle Header - Always visible */}
      <header
        class={`flex items-center justify-center p-1 border-b border-gray-200/20 dark:border-gray-700/20 ${
          isHorizontal() ? "border-r border-b-0" : ""
        } flex-shrink-0 relative z-20`}
      >
        {/* The drag handle has been moved next to the collapse button */}
      </header>

      {/* Sidebar Content (conditionally rendered) */}
      <div
        class={`flex-1 overflow-auto p-2 ${
          isHorizontal() ? "flex flex-row space-x-2" : "space-y-2"
        } ${props.collapsed ? "hidden" : ""}`}
      >
        {/* Current Tune Info Header */}
        <TuneInfoHeader />

        {/* References Section */}
        <section
          class="bg-white/50 dark:bg-gray-900/50 rounded p-2 border border-gray-200/30 dark:border-gray-700/30"
          aria-labelledby="references-heading"
        >
          <ReferencesPanel />
        </section>

        {/* Notes Section */}
        <section
          class="bg-white/50 dark:bg-gray-900/50 rounded p-2 border border-gray-200/30 dark:border-gray-700/30"
          aria-labelledby="notes-heading"
        >
          <NotesPanel />
        </section>
      </div>

      {/* Resize Handle with GripVertical indicator (only when expanded) */}
      <div class={`${props.collapsed ? "hidden" : ""}`}>
        <button
          type="button"
          class={`absolute z-20 ${
            isHorizontal()
              ? "top-0 left-12 right-0 h-4 md:h-1 cursor-row-resize hover:bg-blue-500 md:hover:h-1.5"
              : props.dockPosition === "right"
                ? "top-0 left-0 h-full w-4 md:w-1 cursor-col-resize hover:bg-blue-500 md:hover:w-1.5"
                : "top-0 right-0 h-full w-4 md:w-1 cursor-col-resize hover:bg-blue-500 md:hover:w-1.5"
          } transition-all group border-0 bg-transparent p-0 touch-none`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title="Drag to resize sidebar"
          aria-label="Resize sidebar"
        >
          {/* GripVertical icon - centered, always slightly visible on mobile, hover on desktop */}
          <div
            class={`absolute opacity-60 md:opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none ${
              isHorizontal()
                ? "left-1/2 -translate-x-1/2 -top-2"
                : props.dockPosition === "right"
                  ? "top-1/2 -translate-y-1/2 -left-2"
                  : "top-1/2 -translate-y-1/2 -right-2"
            }`}
          >
            <GripVertical
              class={`w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
                isHorizontal() ? "rotate-90" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Collapse Toggle Button and Drag Handle - positioned based on dock position */}
      <div
        class={`absolute flex items-center justify-center z-30 ${
          isHorizontal()
            ? "top-0.5 left-1/2 -translate-x-1/2 space-x-2"
            : props.dockPosition === "right"
              ? "top-1/2 -translate-y-1/2 left-0.5 flex-col space-y-2"
              : "top-1/2 -translate-y-1/2 right-0.5 flex-col space-y-2"
        }`}
      >
        <button
          type="button"
          onClick={props.onToggle}
          class="p-0.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
          title={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!props.collapsed}
        >
          {props.collapsed ? (
            isHorizontal() ? (
              <ChevronLeft class="w-3.5 h-3.5 rotate-90" />
            ) : props.dockPosition === "right" ? (
              <ChevronLeft class="w-3.5 h-3.5" />
            ) : (
              <ChevronRight class="w-3.5 h-3.5" />
            )
          ) : isHorizontal() ? (
            <ChevronRight class="w-3.5 h-3.5 rotate-90" />
          ) : props.dockPosition === "right" ? (
            <ChevronRight class="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft class="w-3.5 h-3.5" />
          )}
        </button>
        <div class="p-0.5">
          <SidebarDragHandle
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
          />
        </div>
      </div>
    </aside>
  );
};
