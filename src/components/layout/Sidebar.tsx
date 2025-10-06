/**
 * Left Sidebar Component
 *
 * Provides collapsible panels for:
 * - References (external links for current tune)
 * - Notes (practice notes and annotations)
 *
 * Collapse state persists to localStorage/database.
 * Port from: legacy/frontend/components/Sidebar.tsx
 *
 * @module components/layout/Sidebar
 */

import { type Component, Show } from "solid-js";

/**
 * Sidebar Component Props
 */
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Sidebar Component
 *
 * Features:
 * - Collapsible left panel
 * - References section (tune-related links)
 * - Notes section (practice notes)
 * - Responsive (auto-collapse on mobile)
 * - State persists across reloads
 *
 * @example
 * ```tsx
 * <Sidebar
 *   collapsed={sidebarCollapsed()}
 *   onToggle={() => setSidebarCollapsed(!sidebarCollapsed())}
 * />
 * ```
 */
export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <aside
      class={`bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex-shrink-0 ${
        props.collapsed ? "w-12" : "w-64"
      }`}
    >
      {/* Collapse Toggle Button */}
      <div class="p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={props.onToggle}
          class="w-full p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!props.collapsed}
        >
          {props.collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Sidebar Content (only show when expanded) */}
      <Show when={!props.collapsed}>
        <div class="p-4 space-y-4 overflow-y-auto h-full">
          {/* References Panel */}
          <section
            class="bg-white dark:bg-gray-900 rounded-lg shadow p-3"
            aria-labelledby="references-heading"
          >
            <h3
              id="references-heading"
              class="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
            >
              <span>📎</span>
              <span>References</span>
            </h3>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {/* TODO: Load and display references for current tune */}
              <p class="italic">No references yet</p>
              <p class="text-xs mt-1 text-gray-500">
                Tune links will appear here
              </p>
            </div>
          </section>

          {/* Notes Panel */}
          <section
            class="bg-white dark:bg-gray-900 rounded-lg shadow p-3"
            aria-labelledby="notes-heading"
          >
            <h3
              id="notes-heading"
              class="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"
            >
              <span>📝</span>
              <span>Notes</span>
            </h3>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {/* TODO: Load and display notes for current practice session */}
              <p class="italic">No notes yet</p>
              <p class="text-xs mt-1 text-gray-500">
                Practice notes will appear here
              </p>
            </div>
          </section>
        </div>
      </Show>
    </aside>
  );
};
