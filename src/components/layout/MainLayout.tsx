/**
 * Main Application Layout
 *
 * Provides the core UI structure matching the legacy app:
 * - Top navigation bar (app logo, user info, logout)
 * - Left sidebar (References + Notes panels, collapsible)
 * - Tab navigation (Practice, Repertoire, Catalog, Analysis)
 * - Main content area (changes based on active tab)
 *
 * Port from: legacy/frontend/app/(main)/layout.tsx
 *
 * @module components/layout/MainLayout
 */

import type { ParentComponent } from "solid-js";
import { createSignal, onMount } from "solid-js";
import { Sidebar } from "./Sidebar";
import { TabBar, type TabId } from "./TabBar";
import { TopNav } from "./TopNav";

interface MainLayoutProps {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

/**
 * Main Layout Component
 *
 * Wraps all authenticated routes with consistent navigation and layout.
 *
 * @example
 * ```tsx
 * <MainLayout activeTab={activeTab()} onTabChange={setActiveTab}>
 *   <PracticeIndex />
 * </MainLayout>
 * ```
 */
export const MainLayout: ParentComponent<MainLayoutProps> = (props) => {
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

  // TODO: Load sidebar collapse state from localStorage or DB
  onMount(() => {
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState === "true") {
      setSidebarCollapsed(true);
    }
  });

  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed();
    setSidebarCollapsed(newState);
    // Save state to localStorage
    localStorage.setItem("sidebar-collapsed", String(newState));
    // TODO: Save to tab_group_main_state table
  };

  return (
    <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <TopNav />

      <div class="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed()}
          onToggle={handleSidebarToggle}
        />

        {/* Main Content Area */}
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <TabBar activeTab={props.activeTab} onTabChange={props.onTabChange} />

          {/* Tab Content */}
          <div class="flex-1 overflow-auto p-4 md:p-6">{props.children}</div>
        </div>
      </div>
    </div>
  );
};
