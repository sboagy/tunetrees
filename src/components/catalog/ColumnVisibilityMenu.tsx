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
  let menuRef: HTMLDivElement | undefined;

  const [dropdownStyle, setDropdownStyle] = createSignal<{
    top: string;
    left?: string;
    right?: string;
    maxHeight?: string;
  }>({ top: "0px" });

  // Calculate dropdown position based on trigger button
  const updatePosition = () => {
    if (props.triggerRef && props.isOpen) {
      const rect = props.triggerRef.getBoundingClientRect();
      const dropdownWidth = 256; // w-64 = 16rem = 256px
      const dropdownMaxHeight = 1000; // Max height we'd like, will constrain to viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 8;
      const padding = 16; // Padding from viewport edges

      // On mobile, center the dropdown
      const isMobile = viewportWidth < 640; // sm breakpoint

      if (isMobile) {
        // Center horizontally, position below button or above if no room
        const spaceBelow = viewportHeight - rect.bottom - padding;
        const spaceAbove = rect.top - padding;

        // Calculate actual max height based on available space
        const availableHeight = Math.max(spaceBelow, spaceAbove);
        const actualMaxHeight = Math.min(
          dropdownMaxHeight,
          availableHeight - gap
        );

        setDropdownStyle({
          top:
            spaceBelow > dropdownMaxHeight || spaceBelow > spaceAbove
              ? `${rect.bottom + gap}px`
              : `${Math.max(padding, rect.top - actualMaxHeight - gap)}px`,
          left: `${Math.max(padding, (viewportWidth - dropdownWidth) / 2)}px`,
          maxHeight: `${actualMaxHeight}px`,
        });
      } else {
        // Desktop: check both horizontal and vertical space
        const spaceBelow = viewportHeight - rect.bottom - padding;
        const spaceAbove = rect.top - padding;
        const wouldOverflowRight = rect.right > viewportWidth - dropdownWidth;

        // Calculate actual max height based on available space
        const availableHeight = Math.max(spaceBelow, spaceAbove);
        const actualMaxHeight = Math.min(
          dropdownMaxHeight,
          availableHeight - gap
        );

        // Determine vertical position (prefer below, but use above if more space)
        let top: string;
        if (spaceBelow >= actualMaxHeight) {
          // Enough space below
          top = `${rect.bottom + gap}px`;
        } else if (spaceAbove >= actualMaxHeight) {
          // Not enough space below, but enough above
          top = `${rect.top - actualMaxHeight - gap}px`;
        } else if (spaceBelow > spaceAbove) {
          // Not enough space either way, use below
          top = `${rect.bottom + gap}px`;
        } else {
          // Not enough space either way, use above
          top = `${Math.max(padding, rect.top - actualMaxHeight - gap)}px`;
        }

        setDropdownStyle({
          top,
          left: wouldOverflowRight
            ? undefined
            : `${Math.min(rect.right - dropdownWidth, viewportWidth - dropdownWidth - padding)}px`,
          right: wouldOverflowRight
            ? `${Math.max(padding, viewportWidth - rect.right)}px`
            : undefined,
          maxHeight: `${actualMaxHeight}px`,
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

  // Click outside to close
  createEffect(() => {
    if (props.isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;

        // Check if click is inside menu or trigger button
        const isInsideMenu = menuRef?.contains(target);
        const isInsideTrigger = props.triggerRef?.contains(target);

        // Only close if click is truly outside
        if (!isInsideMenu && !isInsideTrigger) {
          props.onClose();
        }
      };

      // Use requestAnimationFrame to wait until next frame
      // This prevents the opening click from immediately closing the menu
      const frameId = requestAnimationFrame(() => {
        document.addEventListener("click", handleClickOutside, true);
      });

      onCleanup(() => {
        cancelAnimationFrame(frameId);
        document.removeEventListener("click", handleClickOutside, true);
      });
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
      private_for: "Status",
      genre: "Genre",
      composer: "Composer",
      artist: "Artist",
      id_foreign: "External ID",
      release_year: "Year",
      learned: "Learned",
      goal: "Goal",
      scheduled: "Scheduled",
      latest_practiced: "Last Practiced",
      recall_eval: "Recall Eval",
      latest_quality: "Quality",
      latest_easiness: "Easiness",
      latest_stability: "Stability",
      latest_interval: "Interval",
      latest_due: "Due",
      tags: "Tags",
      purpose: "Purpose",
      note_private: "Private Note",
      note_public: "Public Note",
      has_override: "Override",
      has_staged: "Staged",
      notes: "Notes",
      favorite_url: "Favorite URL",
    };
    return (
      nameMap[columnId] ||
      columnId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
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
          ref={menuRef}
          class="fixed w-64 bg-white dark:bg-gray-800 border border-gray-200/30 dark:border-gray-700/30 rounded-md shadow-lg z-[100] overflow-y-auto"
          style={{
            ...dropdownStyle(),
            "max-height": dropdownStyle().maxHeight,
          }}
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
                <button
                  type="button"
                  class="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors w-full text-left"
                  on:click={(e) => {
                    // Use native event binding (on:click) to bypass SolidJS delegation
                    e.stopPropagation();
                    e.preventDefault();

                    // Toggle column visibility
                    column.toggleVisibility();
                  }}
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    readOnly
                    tabIndex={-1}
                    class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer pointer-events-none"
                  />
                  <span class="text-gray-700 dark:text-gray-300 flex-1">
                    {getColumnDisplayName(column.id)}
                  </span>
                  <Show when={!column.getIsVisible()}>
                    <span class="text-xs text-gray-400 dark:text-gray-500">
                      Hidden
                    </span>
                  </Show>
                </button>
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
