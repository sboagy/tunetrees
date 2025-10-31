/**
 * Sidebar Dock Position Menu
 *
 * Provides a click-based menu for mobile devices to select sidebar dock position.
 * Shows when clicking the drag handle on touch devices.
 *
 * @module components/layout/SidebarDockMenu
 */

import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-solid";
import { type Component, createEffect, createSignal } from "solid-js";
import { type DockPosition, useSidebarDock } from "./SidebarDockContext";

interface SidebarDockMenuProps {
  triggerRef: HTMLButtonElement | undefined;
  onClose: () => void;
}

export const SidebarDockMenu: Component<SidebarDockMenuProps> = (props) => {
  const { position, setPosition } = useSidebarDock();
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0 });

  // Calculate position based on trigger button and viewport bounds
  createEffect(() => {
    if (props.triggerRef) {
      const rect = props.triggerRef.getBoundingClientRect();
      const menuHeight = 160; // Approximate menu height
      const menuWidth = 140; // min-w-[140px]
      const padding = 8;

      const shouldOpenUpwards = position() === "bottom";

      let top = shouldOpenUpwards ? rect.top - menuHeight : rect.bottom + 4;
      let left = rect.left;

      // Ensure menu stays within viewport vertically
      if (top < padding) {
        top = padding;
      } else if (top + menuHeight > window.innerHeight - padding) {
        top = window.innerHeight - menuHeight - padding;
      }

      // Ensure menu stays within viewport horizontally
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }
      if (left < padding) {
        left = padding;
      }

      setMenuPosition({ top, left });
    }
  });

  const handlePositionChange = (newPosition: DockPosition) => {
    setPosition(newPosition);
    props.onClose();
  };

  return (
    <div
      class="fixed bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-2 min-w-[140px] z-[9999]"
      style={{
        top: `${menuPosition().top}px`,
        left: `${menuPosition().left}px`,
      }}
    >
      <div class="text-xs text-gray-600 dark:text-gray-400 mb-2 px-2">
        Dock Position
      </div>
      <div class="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => handlePositionChange("left")}
          class={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            position() === "left"
              ? "bg-blue-500 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Left</span>
        </button>
        <button
          type="button"
          onClick={() => handlePositionChange("right")}
          class={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            position() === "right"
              ? "bg-blue-500 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <ArrowRight class="w-4 h-4" />
          <span>Right</span>
        </button>
        <button
          type="button"
          onClick={() => handlePositionChange("bottom")}
          class={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            position() === "bottom"
              ? "bg-blue-500 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          <ArrowDown class="w-4 h-4" />
          <span>Bottom</span>
        </button>
      </div>
    </div>
  );
};
