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
  Show,
} from "solid-js";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { ReferencesPanel } from "@/components/references/ReferencesPanel";
import { TuneInfoHeader } from "@/components/sidebar";

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

    const startX = e.clientX;
    const startWidth = localWidth();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Throttle updates using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(
          minWidth(),
          Math.min(maxWidth(), startWidth + delta)
        );
        // Update local state only - fast and doesn't trigger parent re-render
        setLocalWidth(newWidth);
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
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Handle touch-based resize for mobile
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startWidth = localWidth();

    const handleTouchMove = (moveEvent: TouchEvent) => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      // Throttle updates using requestAnimationFrame
      rafId = requestAnimationFrame(() => {
        const touch = moveEvent.touches[0];
        const delta = touch.clientX - startX;
        const newWidth = Math.max(
          minWidth(),
          Math.min(maxWidth(), startWidth + delta)
        );
        // Update local state only - fast and doesn't trigger parent re-render
        setLocalWidth(newWidth);
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

  return (
    <aside
      class={`relative bg-gray-50/30 dark:bg-gray-800/30 border-r border-gray-200/20 dark:border-gray-700/20 flex-shrink-0 flex flex-col select-none ${
        isResizing() ? "" : "transition-all duration-300"
      }`}
      style={{
        width: props.collapsed ? "20px" : `${localWidth()}px`,
        "will-change": isResizing() ? "width" : "auto",
      }}
    >
      {/* Sidebar Content (only show when expanded) */}
      <Show when={!props.collapsed}>
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
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
      </Show>

      {/* Resize Handle with GripVertical indicator (only when expanded) */}
      <Show when={!props.collapsed}>
        <button
          type="button"
          class="absolute top-0 right-0 w-4 md:w-1 h-full cursor-col-resize hover:bg-blue-500 md:hover:w-1.5 transition-all group border-0 bg-transparent p-0 touch-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title="Drag to resize sidebar"
          aria-label="Resize sidebar"
        >
          {/* GripVertical icon - centered vertically, always slightly visible on mobile, hover on desktop */}
          <div class="absolute top-1/2 -translate-y-1/2 -right-2 opacity-60 md:opacity-30 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical class="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
          </div>
        </button>
      </Show>

      {/* Collapse Toggle Button - centered vertically */}
      <button
        type="button"
        onClick={props.onToggle}
        class="absolute top-1/2 -translate-y-1/2 right-0.5 p-0.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-center z-10"
        title={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!props.collapsed}
      >
        {props.collapsed ? (
          <ChevronRight class="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft class="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
};
