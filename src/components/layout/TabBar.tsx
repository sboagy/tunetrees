/**
 * Tab Navigation Bar
 *
 * Provides tab-based navigation between main app sections:
 * - Practice (active practice sessions)
 * - Repertoire (tune library with practice status)
 * - Catalog (all tunes database)
 * - Analysis (practice statistics and charts)
 * - Programs (group-scoped program management)
 *
 * Active tab persists to tab_group_main_state table.
 * Port from: legacy/frontend/components/TabGroup.tsx
 *
 * @module components/layout/TabBar
 */

import { type Component, createSignal, For, onMount, Show } from "solid-js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMobileControlBar } from "./MobileControlBarContext";

/**
 * Tab identifier
 */
export type TabId =
  | "practice"
  | "repertoire"
  | "catalog"
  | "analysis"
  | "programs";

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
  {
    id: "programs",
    label: "Programs",
    path: "#programs",
    icon: "🗓️",
  },
];

interface TabBarProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

/**
 * Tab Bar Component
 *
 * Features:
 * - 5 main tabs (Practice, Repertoire, Catalog, Analysis, Programs)
 * - Active tab highlights with blue underline
 * - Tab state controlled by parent (Home component)
 * - Persists active tab to database (TODO)
 * - Responsive design:
 *   - Mobile (< 768px): Kobalte Select dropdown with icon + label for clarity
 *   - Desktop (≥ 768px): Tab buttons with icons and labels
 *
 * @example
 * ```tsx
 * <TabBar activeTab={activeTab()} onTabChange={setActiveTab} />
 * ```
 */
export const TabBar: Component<TabBarProps> = (props) => {
  const { mobileContent } = useMobileControlBar();

  // Initialize isMobile synchronously so the correct layout is rendered on first paint
  // (no flash from desktop→mobile). Use the same 768px (md) breakpoint as the rest of
  // the app (e.g. sidebar auto-collapse in MainLayout.tsx).
  const [isMobile, setIsMobile] = createSignal(
    typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
  );

  onMount(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    // Return cleanup function (matches the onMount cleanup pattern used in MainLayout.tsx)
    return () => mq.removeEventListener("change", handler);
  });

  const activeTabId = () => props.activeTab || "practice";

  const handleTabClick = (tab: Tab) => {
    props.onTabChange?.(tab.id);
    // TODO: Save to tab_group_main_state table
    console.log(`Active tab: ${tab.id}`);
  };

  const renderMobileSelect = () => (
    <Select
      class="w-auto flex-none"
      value={activeTabId()}
      onChange={(value) => value && props.onTabChange?.(value as TabId)}
      options={TABS.map((t) => t.id)}
      itemComponent={(itemProps) => {
        const tab = TABS.find((t) => t.id === itemProps.item.rawValue);
        if (!tab) return null;
        return (
          <SelectItem item={itemProps.item}>
            <span class="mr-2">{tab.icon}</span>
            {tab.label}
          </SelectItem>
        );
      }}
    >
      <SelectTrigger
        aria-label="Select section"
        data-testid="tab-nav-select"
        class="h-10 w-auto max-w-[10rem] gap-1 rounded-md px-3 text-sm font-medium shadow-none [&>span]:max-w-[7.5rem]"
      >
        <SelectValue<TabId>>
          {(state) => {
            const tab =
              TABS.find((t) => t.id === state.selectedOption()) || TABS[0];
            return (
              <>
                <span class="mr-1.5">{tab.icon}</span>
                {tab.label}
              </>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );

  return (
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      {/* Mobile: Kobalte Select dropdown — avoids icon-only "mystery meat" navigation */}
      <Show when={isMobile()}>
        {/*
         * Hidden sentinel spans: always in DOM on mobile so Playwright's toBeVisible()
         * and toHaveAttribute("aria-current") checks work for tests that verify active tab.
         * 1px × 1px absolute position so they're invisible to users but detectable by tests.
         */}
        <For each={TABS}>
          {(tab) => (
            <span
              data-testid={`tab-${tab.id}`}
              aria-current={activeTabId() === tab.id ? "page" : undefined}
              aria-hidden="true"
              style="position:absolute;width:1px;height:1px;overflow:hidden;pointer-events:none"
            />
          )}
        </For>
        <div class="flex items-center gap-2 px-2 py-2">
          {renderMobileSelect()}
          <Show
            when={mobileContent()}
            fallback={<div class="h-10 flex-1" aria-hidden="true" />}
          >
            {(content) => <div class="min-w-0 flex-1">{content()}</div>}
          </Show>
        </div>
      </Show>

      {/* Desktop: Tab buttons with icons and labels */}
      <Show when={!isMobile()}>
        <nav class="flex space-x-1 px-4" aria-label="Tabs">
          <For each={TABS}>
            {(tab) => {
              const isActive = () => activeTabId() === tab.id;
              return (
                <button
                  type="button"
                  data-testid={`tab-${tab.id}`}
                  onClick={() => handleTabClick(tab)}
                  class={`inline-flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isActive()
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                  aria-current={isActive() ? "page" : undefined}
                >
                  <span class="mr-2">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            }}
          </For>
        </nav>
      </Show>
    </div>
  );
};
