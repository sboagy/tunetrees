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
import { SidebarDockMenu } from "./SidebarDockMenu";

interface SidebarDragHandleProps {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const SidebarDragHandle: Component<SidebarDragHandleProps> = (props) => {
  const [showMenu, setShowMenu] = createSignal(false);
  let buttonRef: HTMLButtonElement | undefined;
  let dragInProgress = false;

  const handleDragStart = (e: DragEvent) => {
    console.log("🎯 [SidebarDragHandle] Drag started on handle");
    dragInProgress = true;
    // Close menu if it's open
    setShowMenu(false);

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "sidebar-drag");
    }
    console.log("🎯 [SidebarDragHandle] Calling parent onDragStart");
    props.onDragStart?.();
  };

  const handleDragEnd = () => {
    console.log("🎯 [SidebarDragHandle] Drag ended on handle");
    console.log("🎯 [SidebarDragHandle] Calling parent onDragEnd");
    props.onDragEnd?.();
    // Reset drag flag after a delay to prevent click from firing
    setTimeout(() => {
      dragInProgress = false;
    }, 200);
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
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        class="cursor-move p-1 hover:bg-gray-200/30 dark:hover:bg-gray-700/30 rounded transition-colors border-0 bg-transparent touch-none select-none"
        style={{ "-webkit-user-drag": "element" }}
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
