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

import { useLocation, useNavigate } from "@solidjs/router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Pencil,
} from "lucide-solid";
import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ReferencesPanel } from "@/components/references/ReferencesPanel";
import { TuneInfoHeader } from "@/components/sidebar";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import type { DockPosition } from "./SidebarDockContext";
import { SidebarDragHandle } from "./SidebarDragHandle";
import { useSidebarResize } from "./SidebarResizeContext";
import {
  getSidebarResizeAction,
  getSidebarResizeStartSize,
  normalizeSidebarResizeDelta,
  SIDEBAR_COLLAPSED_SIZE,
  shouldCollapseSidebar,
} from "./sidebarResize";

/**
 * Sidebar Component Props
 */
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  onWidthChangeEnd?: (width: number) => void; // Called when drag ends (for localStorage save)
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
  const maxWidth = () => props.maxWidth ?? 600;
  const [isResizing, setIsResizing] = createSignal(false);
  const { currentTuneId } = useCurrentTune();
  const navigate = useNavigate();
  const location = useLocation();

  // Tune Info section collapsed state – persisted to localStorage so it
  // survives navigation and dialog open/cancel cycles.
  // If no saved preference exists, default to collapsed when bottom-docked
  // (to conserve vertical space) and expanded otherwise.
  const TUNE_INFO_COLLAPSED_KEY = "sidebar-tune-info-collapsed";
  const [tuneInfoCollapsed, setTuneInfoCollapsed] = createSignal(
    props.dockPosition === "bottom"
  );

  onMount(() => {
    const saved = localStorage.getItem(TUNE_INFO_COLLAPSED_KEY);
    if (saved !== null) {
      setTuneInfoCollapsed(saved === "true");
    }
    // else keep the dock-position-based default set in createSignal
  });

  // When the dock position changes, only apply the position-based default if the
  // user has no saved preference (i.e., they haven't explicitly toggled it yet).
  createEffect(() => {
    const pos = props.dockPosition;
    const hasSaved = localStorage.getItem(TUNE_INFO_COLLAPSED_KEY) !== null;
    if (!hasSaved) {
      setTuneInfoCollapsed(pos === "bottom");
    }
  });

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

  // Shared helper: finalize a resize interaction.
  // If finalWidth is at or below the collapse threshold, collapse the panel.
  // Otherwise persist the exact size the user ended on.
  const finalizeResize = (
    finalWidth: number,
    resizeState: { collapsed: boolean }
  ) => {
    if (shouldCollapseSidebar(finalWidth)) {
      setLocalWidth(SIDEBAR_COLLAPSED_SIZE);
      if (!resizeState.collapsed) {
        props.onToggle();
        resizeState.collapsed = true;
      }
    } else {
      props.onWidthChangeEnd?.(finalWidth);
    }
  };

  // Shared helper: trigger auto-collapse mid-drag when the requested size
  // drops below COLLAPSE_THRESHOLD. The caller provides the cleanup callback
  // that removes its own event listeners (mouse vs. touch differ here).
  const triggerAutoCollapse = (
    cleanup: () => void,
    resizeState: { collapsed: boolean }
  ) => {
    rafId = null;
    setIsResizing(false);
    setLocalWidth(SIDEBAR_COLLAPSED_SIZE);
    cleanup();
    if (!resizeState.collapsed) {
      props.onToggle();
      resizeState.collapsed = true;
    }
  };

  const beginResize = () => {
    setIsResizing(true);

    return {
      collapsed: props.collapsed,
      hasExpanded: false,
      startedCollapsed: props.collapsed,
      startSize: getSidebarResizeStartSize(props.collapsed, localWidth()),
    };
  };

  const applyRequestedSize = (
    requestedSize: number,
    resizeState: {
      collapsed: boolean;
      hasExpanded: boolean;
      startedCollapsed: boolean;
    },
    cleanup: () => void
  ) => {
    const action = getSidebarResizeAction({
      requestedSize,
      maxSize: maxWidth(),
      startedCollapsed: resizeState.startedCollapsed,
      hasExpanded: resizeState.hasExpanded,
    });

    if (action.type === "stay-collapsed") {
      rafId = null;
      return;
    }

    if (action.type === "collapse") {
      triggerAutoCollapse(cleanup, resizeState);
      return;
    }

    setLocalWidth(action.size);
    if (action.expand) {
      props.onToggle();
      resizeState.collapsed = false;
      resizeState.hasExpanded = true;
    }
    rafId = null;
  };

  // Handle resize drag with requestAnimationFrame throttling
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();

    const horizontal = isHorizontal();
    const startPos = horizontal ? e.clientY : e.clientX;
    const resizeState = beginResize();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Throttle updates using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        const currentPos = horizontal ? moveEvent.clientY : moveEvent.clientX;
        const delta = normalizeSidebarResizeDelta(
          currentPos - startPos,
          props.dockPosition
        );
        const requestedSize = resizeState.startSize + delta;

        applyRequestedSize(requestedSize, resizeState, () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        });
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      const finalWidth = localWidth();

      if (!resizeState.collapsed) {
        finalizeResize(finalWidth, resizeState);
      }

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

    const horizontal = isHorizontal();
    const touch = e.touches[0];
    const startPos = horizontal ? touch.clientY : touch.clientX;
    const resizeState = beginResize();

    const handleTouchMove = (moveEvent: TouchEvent) => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Throttle updates using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        const touch = moveEvent.touches[0];
        const currentPos = horizontal ? touch.clientY : touch.clientX;
        const delta = normalizeSidebarResizeDelta(
          currentPos - startPos,
          props.dockPosition
        );
        const requestedSize = resizeState.startSize + delta;

        applyRequestedSize(requestedSize, resizeState, () => {
          document.removeEventListener("touchmove", handleTouchMove);
          document.removeEventListener("touchend", handleTouchEnd);
          document.body.style.userSelect = "";
        });
      });
    };

    const handleTouchEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      const finalWidth = localWidth();

      if (!resizeState.collapsed) {
        finalizeResize(finalWidth, resizeState);
      }

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

  // Register resize handlers into the shared context so that sibling
  // components (e.g. the "N tunes due" sticky footer) can act as the resize
  // target when the sidebar is bottom-docked.
  const { registerHandlers } = useSidebarResize();
  createEffect(() => {
    if (isHorizontal()) {
      registerHandlers({
        onMouseDown: handleMouseDown,
        onTouchStart: handleTouchStart,
      });
    } else {
      registerHandlers(null);
    }
  });
  // Clean up when sidebar unmounts
  onCleanup(() => registerHandlers(null));

  const handleEdit = () => {
    const tuneId = currentTuneId();
    if (tuneId) {
      const fullPath = location.pathname + location.search;
      navigate(`/tunes/${tuneId}/edit`, { state: { from: fullPath } });
    }
  };

  return (
    <aside
      class={`relative bg-gray-50/30 dark:bg-gray-800/30 flex-shrink-0 flex flex-col ${
        isHorizontal()
          ? "border-t border-gray-200/20 dark:border-gray-700/20"
          : "border-r border-gray-200/20 dark:border-gray-700/20"
      } ${isResizing() ? "" : "transition-all duration-300"} z-10`}
      style={{
        [isHorizontal() ? "height" : "width"]: props.collapsed
          ? `${SIDEBAR_COLLAPSED_SIZE}px`
          : `${localWidth()}px`,
        "will-change": isResizing()
          ? isHorizontal()
            ? "height"
            : "width"
          : "auto",
      }}
    >
      {/* Keep a visible resize affordance on the bottom-docked sidebar even when
          the scheduled-grid footer is absent (for example in flashcard mode).
          The footer can still act as an additional resize target when present. */}
      <Show when={isHorizontal()}>
        <button
          type="button"
          class="flex-shrink-0 flex justify-center items-center py-0.5 cursor-row-resize select-none touch-none border-b border-gray-200/20 dark:border-gray-700/20 hover:bg-gray-200/20 dark:hover:bg-gray-700/20 transition-colors"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title="Drag to resize sidebar"
          aria-label="Resize sidebar"
          data-testid="sidebar-resize-handle-bottom"
        >
          <div class="w-8 h-1 rounded-full bg-gray-400 dark:bg-gray-500 opacity-70 pointer-events-none" />
        </button>
      </Show>

      {/* Drag/collapse header.
          For the bottom-docked expanded sidebar, keep these controls in a
          dedicated header row so they do not overlap the Tune Info toggle. */}
      <header
        class={`border-b border-gray-200/20 dark:border-gray-700/20 flex-shrink-0 relative z-20 ${
          isHorizontal() && !props.collapsed
            ? "flex items-center justify-between px-2 py-1"
            : "flex items-center justify-center p-1"
        }`}
      >
        <Show when={isHorizontal() && !props.collapsed}>
          <div class="flex items-center">
            <SidebarDragHandle
              onDragStart={props.onDragStart}
              onDragEnd={props.onDragEnd}
            />
          </div>
          <button
            type="button"
            onClick={props.onToggle}
            class="p-0.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            aria-expanded={true}
            data-testid="sidebar-collapse-toggle"
          >
            <ChevronRight class="w-3.5 h-3.5 rotate-90" />
          </button>
        </Show>
      </header>

      {/* Sidebar Content (conditionally rendered) */}
      <div
        class={`flex-1 overflow-auto p-2 space-y-2 ${
          props.dockPosition === "right"
            ? "pl-8 md:pl-3"
            : !isHorizontal()
              ? "pr-8 md:pr-3"
              : ""
        } ${props.collapsed ? "hidden" : ""}`}
      >
        {/* Current Tune Info Header – collapsible when sidebar is at the bottom */}
        <Show when={isHorizontal()} fallback={<TuneInfoHeader />}>
          <div class="border-b border-gray-200/30 dark:border-gray-700/30 pb-1">
            <button
              type="button"
              onClick={() => {
                const next = !tuneInfoCollapsed();
                setTuneInfoCollapsed(next);
                localStorage.setItem(TUNE_INFO_COLLAPSED_KEY, String(next));
              }}
              class="w-full flex items-center justify-between px-2 py-1 text-left hover:bg-gray-100/30 dark:hover:bg-gray-700/30 rounded transition-colors focus:outline-none"
              aria-expanded={!tuneInfoCollapsed()}
              title={tuneInfoCollapsed() ? "Show tune info" : "Hide tune info"}
              data-testid="sidebar-tune-info-toggle"
            >
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Tune Info
              </span>
              {tuneInfoCollapsed() ? (
                <ChevronDown class="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <ChevronUp class="w-3.5 h-3.5 text-gray-400" />
              )}
            </button>
            <Show when={!tuneInfoCollapsed()}>
              <div class="mt-0.5">
                <TuneInfoHeader />
              </div>
            </Show>
          </div>
        </Show>

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

      {/* Resize Handle with GripVertical indicator (only when expanded and NOT bottom-docked).
          When bottom-docked, the sticky footer in TunesGridScheduled acts as the resize
          handle via SidebarResizeContext, so this button is hidden to avoid confusion. */}
      <div class={`${isHorizontal() ? "hidden" : ""}`}>
        <button
          type="button"
          class={`absolute z-20 select-none ${
            props.dockPosition === "right"
              ? "top-0 left-0 h-full w-4 md:w-1 cursor-col-resize hover:bg-blue-500 md:hover:w-1.5"
              : "top-0 right-0 h-full w-4 md:w-1 cursor-col-resize hover:bg-blue-500 md:hover:w-1.5"
          } transition-all group border-0 bg-transparent p-0 touch-none`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title="Drag to resize sidebar"
          aria-label="Resize sidebar"
          data-testid="sidebar-resize-handle-edge"
        >
          {/* GripVertical icon - centered, always slightly visible on mobile, hover on desktop */}
          <div
            class={`absolute opacity-60 md:opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none ${
              props.dockPosition === "right"
                ? "top-1/2 -translate-y-1/2 -left-2"
                : "top-1/2 -translate-y-1/2 -right-2"
            }`}
          >
            <GripVertical class="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
          </div>
        </button>
      </div>

      {/* Edit button - only visible when collapsed and tune is selected - positioned at top (vertical) or far right (horizontal) */}
      <Show when={props.collapsed && currentTuneId()}>
        <div
          class={`absolute z-30 select-none ${
            isHorizontal()
              ? "top-4 right-3.5 flex items-center"
              : props.dockPosition === "right"
                ? "top-3.5 left-1/2 -translate-x-1/2 flex items-center"
                : "top-3.5 right-1/2 translate-x-1/2 flex items-center"
          }`}
        >
          <button
            type="button"
            onClick={handleEdit}
            class="p-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 dark:hover:bg-blue-900/30 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="Edit tune"
            aria-label="Edit tune"
            data-testid="sidebar-edit-tune-button-collapsed"
          >
            <Pencil class="w-3.5 h-3.5" />
          </button>
        </div>
      </Show>

      {/* Collapse Toggle Button and Drag Handle - positioned based on dock position */}
      <div
        class={`absolute flex items-center justify-center z-30 select-none ${
          isHorizontal() && !props.collapsed
            ? "hidden"
            : isHorizontal()
              ? "top-4 left-1/2 -translate-x-1/2 space-x-2"
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
