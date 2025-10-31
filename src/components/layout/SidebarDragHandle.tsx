/**
 * Sidebar Drag Handle Component
 *
 * Provides a draggable icon in the sidebar header that allows users
 * to reposition the sidebar by dragging to drop zones.
 *
 * @module components/layout/SidebarDragHandle
 */

import { GripHorizontal } from "lucide-solid";
import { type Component, createSignal, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { DockPosition } from "./SidebarDockContext";
import { useSidebarDock } from "./SidebarDockContext";
import { SidebarDockMenu } from "./SidebarDockMenu";

interface SidebarDragHandleProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const SidebarDragHandle: Component<SidebarDragHandleProps> = (props) => {
  const [showMenu, setShowMenu] = createSignal(false);
  const { setPosition } = useSidebarDock();
  let buttonRef: HTMLButtonElement | undefined;
  // Track whether a pointer-drag happened to suppress click
  let dragInProgress = false;

  // Pointer-drag state (replaces unreliable HTML5 drag for this handle)
  let pointerId: number | null = null;
  let dragStarted = false;
  let startX = 0;
  let startY = 0;
  const DRAG_THRESHOLD = 6; // px movement before we consider it a drag
  const EDGE_THRESHOLD = 96; // px from edge considered a drop zone

  const pickZoneFromPoint = (x: number, y: number): DockPosition | null => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const leftDist = x;
    const rightDist = vw - x;
    const bottomDist = vh - y;
    const min = Math.min(leftDist, rightDist, bottomDist);
    if (min > EDGE_THRESHOLD) return null;
    if (min === leftDist) return "left";
    if (min === rightDist) return "right";
    return "bottom";
  };

  const endPointerDrag = (commit: boolean, lastX: number, lastY: number) => {
    if (!dragStarted) return;
    dragStarted = false;
    dragInProgress = true;
    // Decide docking zone and apply
    if (commit) {
      const zone = pickZoneFromPoint(lastX, lastY);
      if (zone) {
        try {
          setPosition(zone);
        } catch (err) {
          console.error("SidebarDock setPosition failed", err);
        }
      }
    }
    // Notify parent (MainLayout) to hide overlays
    props.onDragEnd?.();

    // Small delay to allow click suppression and overlay cleanup
    setTimeout(() => {
      dragInProgress = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }, 120);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const movedX = Math.abs(e.clientX - startX);
    const movedY = Math.abs(e.clientY - startY);
    const moved = movedX > DRAG_THRESHOLD || movedY > DRAG_THRESHOLD;
    if (!dragStarted && moved) {
      dragStarted = true;
      dragInProgress = true;
      // Notify parent (MainLayout) to show overlays
      console.log("🎯 [SidebarDragHandle] Pointer drag started");
      props.onDragStart?.();
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    }

    // We could highlight zones based on pointer position later if desired
  };

  const onPointerUp = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    // Release capture (guard errors in case capture wasn't set)
    try {
      buttonRef?.releasePointerCapture(e.pointerId);
    } catch (_) {
      // ignore
    }
    pointerId = null;
    endPointerDrag(true, e.clientX, e.clientY);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    try {
      buttonRef?.releasePointerCapture(e.pointerId);
    } catch (_) {
      // ignore
    }
    pointerId = null;
    endPointerDrag(false, e.clientX, e.clientY);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  };

  const onPointerDown = (e: PointerEvent) => {
    // Only primary button/touch
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dragStarted = false;
    dragInProgress = false;
    // Close menu immediately when starting a potential drag
    setShowMenu(false);
    try {
      buttonRef?.setPointerCapture(e.pointerId);
    } catch (_) {
      /* ignore */
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
  };

  // Keep legacy drag handlers in case some browsers still try HTML5 DnD,
  // but they’ll just delegate to pointer logic states for consistency.
  const handleDragStart = () => {
    // No-op: pointer-based flow handles start/end
  };

  const handleDragEnd = () => {
    // No-op: pointer-based flow handles start/end
  };

  const handleClick = () => {
    // Small delay to allow drag events to set dragInProgress if this was a drag
    setTimeout(() => {
      if (!dragInProgress) {
        setShowMenu(!showMenu());
      }
    }, 50);
  };

  // Close menu when clicking outside
  const handleClickOutside = (e: MouseEvent) => {
    if (
      showMenu() &&
      !(e.target as HTMLElement).closest(".sidebar-dock-menu-container")
    ) {
      setShowMenu(false);
    }
  };

  document.addEventListener("click", handleClickOutside);

  onCleanup(() => {
    document.removeEventListener("click", handleClickOutside);
  });

  return (
    <div class="relative sidebar-dock-menu-container">
      <button
        ref={buttonRef}
        type="button"
        draggable={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onPointerDown={onPointerDown}
        onClick={handleClick}
        class="cursor-move p-1 hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded transition-colors border-0 bg-transparent touch-none select-none"
        style={{ "-webkit-user-drag": "none" }}
        title="Click to open menu or drag to reposition sidebar"
        aria-label="Drag to reposition sidebar"
      >
        <GripHorizontal class="w-4 h-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
      </button>
      <Portal>
        <Show when={showMenu()}>
          <SidebarDockMenu
            triggerRef={buttonRef}
            onClose={() => setShowMenu(false)}
          />
        </Show>
      </Portal>
    </div>
  );
};
