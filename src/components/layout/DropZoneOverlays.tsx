/**
 * Drop Zone Overlays Component
 *
 * Displays visual drop zones at left, right, and bottom edges during sidebar drag.
 * Highlights the active drop zone on dragover and triggers position change on drop.
 *
 * @module components/layout/DropZoneOverlays
 */

import { type Component, createSignal, Show } from "solid-js";
import { type DockPosition, useSidebarDock } from "./SidebarDockContext";

interface DropZoneOverlaysProps {
  isDragging: boolean;
}

/**
 * Drop Zone Overlays Component
 *
 * Shows three drop zones (left, right, bottom) when sidebar is being dragged.
 * Provides visual feedback and handles drop events.
 */
export const DropZoneOverlays: Component<DropZoneOverlaysProps> = (props) => {
  const { setPosition } = useSidebarDock();
  const [activeZone, setActiveZone] = createSignal<DockPosition | null>(null);

  const handleDragOver = (e: DragEvent, zone: DockPosition) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    setActiveZone(zone);
    console.log(`🎯 [DropZone] Dragover on ${zone}`);
  };

  const handleDragLeave = () => {
    setActiveZone(null);
  };

  const handleDrop = (e: DragEvent, zone: DockPosition) => {
    e.preventDefault();
    e.stopPropagation();
    console.log(`✅ [DropZone] Drop on ${zone}`);
    setPosition(zone);
    setActiveZone(null);
  };

  return (
    <Show when={props.isDragging}>
      {/* Left Drop Zone */}
      <section
        onDragOver={(e) => handleDragOver(e, "left")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "left")}
        class={`absolute left-0 top-0 bottom-0 w-24 pointer-events-auto transition-all z-50 ${
          activeZone() === "left"
            ? "bg-blue-500/50 border-4 border-blue-600"
            : "bg-gray-300/30 border-4 border-gray-500 border-dashed"
        }`}
        aria-label="Drop here to dock sidebar on left"
      >
        <div class="flex items-center justify-center h-full text-gray-900 dark:text-gray-100 font-bold text-lg">
          ← Left
        </div>
      </section>

      {/* Right Drop Zone */}
      <section
        onDragOver={(e) => handleDragOver(e, "right")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "right")}
        class={`absolute right-0 top-0 bottom-0 w-24 pointer-events-auto transition-all z-50 ${
          activeZone() === "right"
            ? "bg-blue-500/50 border-4 border-blue-600"
            : "bg-gray-300/30 border-4 border-gray-500 border-dashed"
        }`}
        aria-label="Drop here to dock sidebar on right"
      >
        <div class="flex items-center justify-center h-full text-gray-900 dark:text-gray-100 font-bold text-lg">
          Right →
        </div>
      </section>

      {/* Bottom Drop Zone - full width without gaps */}
      <section
        onDragOver={(e) => handleDragOver(e, "bottom")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "bottom")}
        class={`absolute left-0 right-0 bottom-0 h-24 pointer-events-auto transition-all z-40 ${
          activeZone() === "bottom"
            ? "bg-blue-500/50 border-4 border-blue-600"
            : "bg-gray-300/30 border-4 border-gray-500 border-dashed"
        }`}
        aria-label="Drop here to dock sidebar on bottom"
      >
        <div class="flex items-center justify-center h-full text-gray-900 dark:text-gray-100 font-bold text-lg">
          ↓ Bottom
        </div>
      </section>
    </Show>
  );
};
