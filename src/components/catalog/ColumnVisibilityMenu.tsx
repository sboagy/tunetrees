/**
 * Column Visibility Menu Component
 *
 * Dropdown menu for showing/hiding table columns.
 * Displays checkboxes for each toggleable column with their current visibility state.
 *
 * @module components/catalog/ColumnVisibilityMenu
 */

import type { Table } from "@tanstack/solid-table";
import {
  type Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";

export interface ColumnVisibilityMenuProps {
  /** TanStack Table instance */
  table: Table<any>;
  /** Whether menu is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Reference to the trigger button for positioning */
  triggerRef?: HTMLElement;
}

/**
 * Column Visibility Menu
 *
 * Provides checkboxes to toggle column visibility in a table.
 * Automatically excludes non-toggleable columns (select, actions, etc.)
 * Uses Portal to render outside parent containers to avoid clipping.
 */
export const ColumnVisibilityMenu: Component<ColumnVisibilityMenuProps> = (
  props
) => {
  const [dropdownStyle, setDropdownStyle] = createSignal<{
    top: string;
    left?: string;
    right?: string;
  }>({ top: "0px" });

  // Calculate dropdown position based on trigger button
  const updatePosition = () => {
    if (props.triggerRef && props.isOpen) {
      const rect = props.triggerRef.getBoundingClientRect();
      const dropdownWidth = 256; // w-64 = 16rem = 256px
      const dropdownMaxHeight = 384; // max-h-96 = 24rem = 384px
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 4;

      // On mobile, center the dropdown
      const isMobile = viewportWidth < 640; // sm breakpoint

      if (isMobile) {
        // Center horizontally, position below button or above if no room
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        setDropdownStyle({
          top:
            spaceBelow > dropdownMaxHeight || spaceBelow > spaceAbove
              ? `${rect.bottom + gap}px`
              : `${rect.top - dropdownMaxHeight - gap}px`,
          left: `${Math.max(8, (viewportWidth - dropdownWidth) / 2)}px`,
        });
      } else {
        // Desktop: align with button, favor right side
        const wouldOverflowRight = rect.right > viewportWidth - dropdownWidth;

        setDropdownStyle({
          top: `${rect.bottom + gap}px`,
          left: wouldOverflowRight
            ? undefined
            : `${rect.right - dropdownWidth}px`,
          right: wouldOverflowRight
            ? `${viewportWidth - rect.right}px`
            : undefined,
        });
      }
    }
  };

  // Update position when opened or window resizes
  createEffect(() => {
    if (props.isOpen) {
      updatePosition();
    }
  });

  onMount(() => {
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
  });

  onCleanup(() => {
    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("scroll", updatePosition, true);
  });

  // Get all toggleable columns (exclude select, actions, etc.)
  const getToggleableColumns = () => {
    return props.table.getAllLeafColumns().filter((column) => {
      // Exclude certain system columns
      const excludeIds = ["select", "actions", "_actions"];
      return !excludeIds.includes(column.id) && column.getCanHide();
    });
  };

  // Get display name for column
  const getColumnDisplayName = (columnId: string): string => {
    const nameMap: Record<string, string> = {
      id: "ID",
      title: "Title",
      type: "Type",
      mode: "Mode",
      structure: "Structure",
      incipit: "Incipit",
      genre: "Genre",
      learned: "Learned",
      scheduled: "Scheduled",
      tags: "Tags",
      notes: "Notes",
      favorite_url: "Favorite URL",
    };
    return nameMap[columnId] || columnId;
  };

  // Handle "Show All" button
  const handleShowAll = () => {
    props.table.toggleAllColumnsVisible(true);
  };

  // Handle "Hide All" button
  const handleHideAll = () => {
    props.table.toggleAllColumnsVisible(false);
    // Always keep select column visible
    const selectColumn = props.table.getColumn("select");
    if (selectColumn) {
      selectColumn.toggleVisibility(true);
    }
  };

  // Count visible columns
  const visibleCount = () => {
    return getToggleableColumns().filter((col) => col.getIsVisible()).length;
  };

  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          class="fixed w-64 bg-white dark:bg-gray-800 border border-gray-200/30 dark:border-gray-700/30 rounded-md shadow-lg z-[100] max-h-96 overflow-y-auto"
          style={dropdownStyle()}
        >
          {/* Header */}
          <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200/30 dark:border-gray-700/30 px-3 py-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Show Columns
              </span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {visibleCount()} / {getToggleableColumns().length}
              </span>
            </div>

            {/* Quick actions */}
            <div class="flex gap-2 mt-2">
              <button
                type="button"
                onClick={handleShowAll}
                class="text-xs px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              >
                Show All
              </button>
              <button
                type="button"
                onClick={handleHideAll}
                class="text-xs px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Hide All
              </button>
            </div>
          </div>

          {/* Column checkboxes */}
          <div class="p-2">
            <For each={getToggleableColumns()}>
              {(column) => (
                <label class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors">
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer"
                  />
                  <span class="text-gray-700 dark:text-gray-300 flex-1">
                    {getColumnDisplayName(column.id)}
                  </span>
                  <Show when={!column.getIsVisible()}>
                    <span class="text-xs text-gray-400 dark:text-gray-500">
                      Hidden
                    </span>
                  </Show>
                </label>
              )}
            </For>
          </div>

          {/* Footer note */}
          <div class="border-t border-gray-200/30 dark:border-gray-700/30 px-3 py-2 bg-gray-50 dark:bg-gray-900/50">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              💡 Tip: Drag column headers to reorder
            </p>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
