/**
 * Tab Navigation Bar
 *
 * Provides tab-based navigation between main app sections:
 * - Practice (active practice sessions)
 * - Repertoire (tune library with practice status)
 * - Catalog (all tunes database)
 * - Analysis (practice statistics and charts)
 *
 * Active tab persists to tab_group_main_state table.
 * Port from: legacy/frontend/components/TabGroup.tsx
 *
 * @module components/layout/TabBar
 */

import { type Component, For } from "solid-js";

/**
 * Tab identifier
 */
export type TabId = "practice" | "repertoire" | "catalog" | "analysis";

/**
 * Tab configuration
 */
interface Tab {
  id: TabId;
  label: string;
  path: string;
  icon: string;
}

/**
 * Available tabs
 */
const TABS: Tab[] = [
  { id: "practice", label: "Practice", path: "#practice", icon: "🎯" },
  {
    id: "repertoire",
    label: "Repertoire",
    path: "#repertoire",
    icon: "📚",
  },
  { id: "catalog", label: "Catalog", path: "#catalog", icon: "📖" },
  { id: "analysis", label: "Analysis", path: "#analysis", icon: "📊" },
];

interface TabBarProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

/**
 * Tab Bar Component
 *
 * Features:
 * - 4 main tabs (Practice, Repertoire, Catalog, Analysis)
 * - Active tab highlights with blue underline
 * - Tab state controlled by parent (Home component)
 * - Persists active tab to database (TODO)
 * - Responsive design (icons only on mobile)
 *
 * @example
 * ```tsx
 * <TabBar activeTab={activeTab()} onTabChange={setActiveTab} />
 * ```
 */
export const TabBar: Component<TabBarProps> = (props) => {
  const handleTabClick = (tab: Tab) => {
    props.onTabChange?.(tab.id);
    // TODO: Save to tab_group_main_state table
    console.log(`Active tab: ${tab.id}`);
  };

  return (
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <nav class="flex space-x-1 px-4" aria-label="Tabs">
        <For each={TABS}>
          {(tab) => {
            const isActive = () => (props.activeTab || "practice") === tab.id;
            return (
              <button
                type="button"
                onClick={() => handleTabClick(tab)}
                class={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isActive()
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
                aria-current={isActive() ? "page" : undefined}
              >
                <span class="mr-1 sm:mr-2">{tab.icon}</span>
                <span class="hidden sm:inline">{tab.label}</span>
              </button>
            );
          }}
        </For>
      </nav>
    </div>
  );
};
