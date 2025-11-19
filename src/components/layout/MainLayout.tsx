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

import { useNavigate } from "@solidjs/router";
import type { ParentComponent } from "solid-js";
import { createSignal, onMount, Show } from "solid-js";
import { useAuth } from "../../lib/auth/AuthContext";
import { AnonymousBanner } from "../auth/AnonymousBanner";
import { DropZoneOverlays } from "./DropZoneOverlays";
import { Sidebar } from "./Sidebar";
import { useSidebarDock } from "./SidebarDockContext";
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
  const { position: dockPosition } = useSidebarDock();
  const { isAnonymous } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [sidebarWidth, setSidebarWidth] = createSignal(320); // Default 320px
  const [isDragging, setIsDragging] = createSignal(false);

  // Track drag state globally for drop zone visibility
  const handleDragStart = () => {
    console.log("🚀 MainLayout: Drag started, showing drop zones");
    setIsDragging(true);
  };
  const handleDragEnd = () => {
    console.log("🛑 MainLayout: Drag ended, hiding drop zones");
    setIsDragging(false);
  };

  // Load sidebar state from localStorage on mount
  onMount(() => {
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed === "true") {
      setSidebarCollapsed(true);
    }

    const savedWidth = localStorage.getItem("sidebar-width");
    if (savedWidth) {
      const width = Number.parseInt(savedWidth, 10);
      if (!Number.isNaN(width) && width >= 240 && width <= 600) {
        setSidebarWidth(width);
      }
    }

    // Auto-collapse on mobile
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile && !sidebarCollapsed()) {
        setSidebarCollapsed(true);
      }
    };

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  });

  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed();
    setSidebarCollapsed(newState);
    // Save state to localStorage
    localStorage.setItem("sidebar-collapsed", String(newState));
    // TODO: Save to tab_group_main_state table
  };

  const handleSidebarWidthChangeEnd = (width: number) => {
    // Update state and save to localStorage when drag ends
    setSidebarWidth(width);
    localStorage.setItem("sidebar-width", String(width));
    // TODO: Save to tab_group_main_state table
  };

  return (
    <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <TopNav />

      {/* Anonymous User Banner */}
      <Show when={isAnonymous()}>
        <AnonymousBanner onConvert={() => navigate("/login?convert=true")} />
      </Show>

      <div
        class={`flex flex-1 overflow-hidden relative ${
          dockPosition() === "bottom"
            ? "flex-col-reverse"
            : dockPosition() === "right"
              ? "flex-row-reverse"
              : "flex-row"
        }`}
      >
        {/* Drop Zone Overlays (shown during drag) */}
        <DropZoneOverlays isDragging={isDragging()} />

        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed()}
          onToggle={handleSidebarToggle}
          width={sidebarWidth()}
          onWidthChange={() => {}} // No-op during drag
          onWidthChangeEnd={handleSidebarWidthChangeEnd}
          minWidth={240}
          maxWidth={600}
          dockPosition={dockPosition()}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />

        {/* Main Content Area */}
        <div class="flex-1 flex flex-col overflow-hidden">
          {/* Tab Navigation - only show if activeTab is provided (Home page) */}
          <Show when={props.activeTab && props.onTabChange}>
            <TabBar
              activeTab={props.activeTab}
              onTabChange={props.onTabChange!}
            />
          </Show>

          {/* Tab Content - Remove overflow-auto to let child components handle scrolling */}
          <div class="flex-1 overflow-hidden">{props.children}</div>
        </div>
      </div>
    </div>
  );
};
