# Phase 4: Main UI Layout & Tab Navigation

**Created:** October 6, 2025  
**Priority:** HIGH - Need to establish visual structure NOW  
**Dependencies:** Phase 3 (Practice basics working)  
**Duration:** 3-5 days

---

## 🎯 Goal

Build the **core UI structure** that matches the legacy app:

- Top navigation bar
- Left sidebar (References + Notes panels)
- Main content area with **4 tabs** (Practice, Repertoire, Catalog, Analysis)
- Tab state persistence
- Responsive layout

**Why This Can't Wait:**
Without proper tabs and sidebar, we can't verify the UI matches your vision. This is **foundational structure**, not polish!

---

## 📸 Reference (Legacy App Screenshots)

**Screenshot 1:** Practice tab with sidebar showing references + notes  
**Screenshot 2:** Repertoire tab with tune table + "Add To Review" button  
**Screenshot 3:** Catalog tab with full tune database

**Key UI Elements to Match:**

1. Top nav: App logo + user info + logout
2. Left sidebar: Collapsible panels for References and Notes
3. Tab bar: Practice | Repertoire | Catalog | Analysis
4. Main content: Changes based on active tab
5. Table-centric design (TanStack Solid Table already in use ✅)

---

## 🏗️ Implementation Plan

### Task 1: Main Layout Component

**File:** `src/components/layout/MainLayout.tsx` (new)

```tsx
/**
 * Main Application Layout
 *
 * Provides the core UI structure:
 * - Top navigation bar
 * - Left sidebar (collapsible)
 * - Tab navigation
 * - Main content area
 *
 * Matches legacy: legacy/frontend/app/(main)/layout.tsx
 */
import { Component, ParentComponent, createSignal, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export const MainLayout: ParentComponent = (props) => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

  return (
    <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <TopNav user={user()} />

      <div class="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed()}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed())}
        />

        {/* Main Content Area */}
        <div class="flex-1 flex flex-col">
          {/* Tab Navigation */}
          <TabBar />

          {/* Tab Content */}
          <div class="flex-1 overflow-auto p-4">{props.children}</div>
        </div>
      </div>
    </div>
  );
};
```

**Port from:**

- `legacy/frontend/app/(main)/layout.tsx` - Structure
- `legacy/frontend/components/Sidebar.tsx` - Sidebar panels

---

### Task 2: Top Navigation Component

**File:** `src/components/layout/TopNav.tsx` (new)

```tsx
/**
 * Top Navigation Bar
 * Shows app branding, user info, and logout
 */
import { Component } from "solid-js";
import { LogoutButton } from "@/components/auth";
import type { User } from "@supabase/supabase-js";

export const TopNav: Component<{ user: User | null }> = (props) => {
  return (
    <nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          {/* App Logo */}
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-blue-600 dark:text-blue-400">
              🎵 TuneTrees
            </h1>
          </div>

          {/* User Info + Logout */}
          <div class="flex items-center gap-4">
            <Show when={props.user}>
              {(u) => (
                <span class="text-sm text-gray-700 dark:text-gray-300">
                  {u().email}
                </span>
              )}
            </Show>
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
};
```

---

### Task 3: Tab Bar Component

**File:** `src/components/layout/TabBar.tsx` (new)

```tsx
/**
 * Tab Navigation Bar
 *
 * Tabs: Practice | Repertoire | Catalog | Analysis
 * Active tab persists to tab_group_main_state table
 *
 * Port from: legacy/frontend/components/TabGroup.tsx
 */
import { Component, For, createSignal, createEffect } from "solid-js";
import { useNavigate, useLocation } from "@solidjs/router";
import { useAuth } from "@/lib/auth/AuthContext";

type TabId = "practice" | "repertoire" | "catalog" | "analysis";

interface Tab {
  id: TabId;
  label: string;
  path: string;
  icon?: string;
}

const TABS: Tab[] = [
  { id: "practice", label: "Practice", path: "/practice", icon: "🎯" },
  { id: "repertoire", label: "Repertoire", path: "/repertoire", icon: "📚" },
  { id: "catalog", label: "Catalog", path: "/catalog", icon: "📖" },
  { id: "analysis", label: "Analysis", path: "/analysis", icon: "📊" },
];

export const TabBar: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb } = useAuth();

  const [activeTab, setActiveTab] = createSignal<TabId>("practice");

  // Determine active tab from URL
  createEffect(() => {
    const path = location.pathname;
    const tab = TABS.find((t) => path.startsWith(t.path));
    if (tab) {
      setActiveTab(tab.id);
      // TODO: Save to tab_group_main_state table
    }
  });

  const handleTabClick = (tab: Tab) => {
    navigate(tab.path);
  };

  return (
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <nav class="flex space-x-1 px-4" aria-label="Tabs">
        <For each={TABS}>
          {(tab) => {
            const isActive = () => activeTab() === tab.id;
            return (
              <button
                type="button"
                onClick={() => handleTabClick(tab)}
                class={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive()
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                <span class="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            );
          }}
        </For>
      </nav>
    </div>
  );
};
```

**Key Features:**

- Active tab highlights with blue underline
- Tab state syncs with URL (SolidJS router)
- TODO: Persist active tab to `tab_group_main_state` table

---

### Task 4: Sidebar Component

**File:** `src/components/layout/Sidebar.tsx` (new)

```tsx
/**
 * Left Sidebar
 *
 * Contains collapsible panels:
 * - References (links for current tune)
 * - Notes (practice notes)
 *
 * Port from: legacy/frontend/components/Sidebar.tsx
 */
import { Component, createSignal, Show } from "solid-js";

export const Sidebar: Component<{
  collapsed: boolean;
  onToggle: () => void;
}> = (props) => {
  return (
    <aside
      class={`bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
        props.collapsed ? "w-12" : "w-64"
      }`}
    >
      {/* Collapse Toggle */}
      <div class="p-2 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={props.onToggle}
          class="w-full p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {props.collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Sidebar Content */}
      <Show when={!props.collapsed}>
        <div class="p-4 space-y-4">
          {/* References Panel */}
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-3">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
              📎 References
            </h3>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {/* TODO: Show tune references/links */}
              <p class="italic">No references yet</p>
            </div>
          </div>

          {/* Notes Panel */}
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow p-3">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-2">
              📝 Notes
            </h3>
            <div class="text-sm text-gray-600 dark:text-gray-400">
              {/* TODO: Show practice notes */}
              <p class="italic">No notes yet</p>
            </div>
          </div>
        </div>
      </Show>
    </aside>
  );
};
```

**Future Enhancements:**

- References: Display links from `reference` table for current tune
- Notes: Display/edit notes from `note` table
- Collapsible sections within panels
- Drag-to-resize sidebar

---

### Task 5: Tab Route Pages

Create placeholder pages for each tab:

**File:** `src/routes/practice.tsx` (already exists, needs layout wrapper)  
**File:** `src/routes/repertoire.tsx` (new)  
**File:** `src/routes/catalog.tsx` (new - can reuse existing tunes page)  
**File:** `src/routes/analysis.tsx` (new - placeholder)

**Repertoire Page Example:**

```tsx
// src/routes/repertoire.tsx
import { Component } from "solid-js";
import { TuneList } from "@/components/tunes/TuneList";

export default function RepertoirePage() {
  return (
    <div>
      <div class="mb-4 flex justify-between items-center">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          📚 Repertoire
        </h2>
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          ➕ Add To Review
        </button>
      </div>

      {/* Tune Table */}
      <TuneList />
    </div>
  );
}
```

---

### Task 6: Update Router Configuration

**File:** `src/App.tsx` or routing config

```tsx
import { Route, Routes } from "@solidjs/router";
import { MainLayout } from "@/components/layout/MainLayout";
import PracticePage from "@/routes/practice";
import RepertoirePage from "@/routes/repertoire";
import CatalogPage from "@/routes/catalog";
import AnalysisPage from "@/routes/analysis";

// Wrap all main routes in MainLayout
<Routes>
  <Route path="/" element={<MainLayout />}>
    <Route path="/practice" component={PracticePage} />
    <Route path="/repertoire" component={RepertoirePage} />
    <Route path="/catalog" component={CatalogPage} />
    <Route path="/analysis" component={AnalysisPage} />
  </Route>
</Routes>;
```

---

### Task 7: Tab State Persistence

**File:** `src/lib/db/queries/tab-state.ts` (new)

```typescript
/**
 * Tab State Queries
 *
 * Persist active tab and UI state to tab_group_main_state table
 */
import { eq } from "drizzle-orm";
import type { SqliteDatabase } from "../client-sqlite";
import { tabGroupMainState } from "../schema";

export async function saveActiveTab(
  db: SqliteDatabase,
  userId: string,
  tabId: string
): Promise<void> {
  await db
    .update(tabGroupMainState)
    .set({
      activeTab: tabId,
      lastModifiedAt: new Date().toISOString(),
    })
    .where(eq(tabGroupMainState.userId, userId));
}

export async function getActiveTab(
  db: SqliteDatabase,
  userId: string
): Promise<string | null> {
  const result = await db
    .select({ activeTab: tabGroupMainState.activeTab })
    .from(tabGroupMainState)
    .where(eq(tabGroupMainState.userId, userId))
    .limit(1);

  return result[0]?.activeTab ?? null;
}
```

**Integration:** Call these from `TabBar.tsx` to persist tab switches.

---

## 🎯 Acceptance Criteria

**Phase 4 is complete when:**

- [x] MainLayout component created with top nav + sidebar + content area
- [x] TopNav shows app logo, user email, logout button
- [x] Sidebar collapsible, shows References + Notes panels (placeholder content)
- [x] TabBar shows 4 tabs (Practice, Repertoire, Catalog, Analysis)
- [x] Active tab highlights with blue underline
- [x] Tab clicks navigate to correct routes
- [x] Active tab persists across page reloads (saved to DB)
- [x] Sidebar collapse state persists (saved to DB or localStorage)
- [x] Responsive: sidebar auto-collapses on mobile (<768px)
- [x] **Visual structure matches legacy app screenshots**

---

## 🔄 Port Reference (Legacy Files)

**Copy structure/patterns from:**

1. **Layout:**

   - `legacy/frontend/app/(main)/layout.tsx` - Main layout wrapper
   - `legacy/frontend/components/Sidebar.tsx` - Sidebar panels

2. **Tabs:**

   - `legacy/frontend/components/TabGroup.tsx` - Tab switching logic
   - `legacy/frontend/app/(main)/pages/practice/page.tsx` - Tab structure

3. **State Persistence:**

   - `legacy/frontend/lib/actions/tab-state.ts` - Save/load tab state
   - `legacy/tunetrees/models/tunetrees.py` - `TabGroupMainState` model

4. **Styling:**
   - Tailwind classes from legacy components
   - Dark mode support already in place

---

## 📝 Notes

### Why This Is Priority NOW

**User's Concern (Valid!):**

> "I don't see the UI structure coming together. I was hoping to see the basic structure of tabs and side panel so I could have a better feeling we're on the same track."

**Response:** You're absolutely right. This is **foundational UI structure**, not polish. We need:

- Tab navigation to organize features
- Sidebar for References/Notes (core to practice workflow)
- Visual confirmation that PWA matches legacy design

**Phase 7 (UI Polish)** is about:

- Animations
- Dark mode refinement
- shadcn-solid component library
- Accessibility improvements

**Phase 4 (This)** is about:

- Basic layout structure
- Tab navigation
- Sidebar panels
- Routing architecture

### Schema Note

The `tab_group_main_state` table already exists in the schema:

- `userId` - User reference
- `activeTab` - Currently active tab ID
- `showSubmitted` - "Display Submitted" toggle state
- `practiceModeFlashcard` - "Flashcard Mode" toggle state
- `sidebarCollapsed` - Sidebar collapse state (if we add this column)

**TODO:** Verify schema has all needed columns, add migration if needed.

---

## ⏱️ Timeline

| Task                    | Duration  | Dependencies    |
| ----------------------- | --------- | --------------- |
| 1. MainLayout component | 1-2 hours | None            |
| 2. TopNav component     | 30 min    | None            |
| 3. TabBar component     | 1-2 hours | None            |
| 4. Sidebar component    | 1-2 hours | None            |
| 5. Tab route pages      | 2-3 hours | TabBar          |
| 6. Router config        | 30 min    | All pages       |
| 7. State persistence    | 1-2 hours | TabBar, Sidebar |

**Total:** 1-2 days (focused work)

---

## 🚀 Next Steps (After Phase 4)

Once UI layout is in place:

1. **Phase 5:** Playlist Management (playlist selector, CRUD)
2. **Phase 6:** Advanced Tune Features (abcjs notation, rich notes)
3. **Phase 3 Testing:** Complete Phase 3 testing in parallel

**Priority:** Get visual structure right FIRST, then add features.

---

**Document Status:** Ready for Implementation  
**Next Action:** Start with Task 1 (MainLayout component)  
**Review With:** @sboagy (verify against legacy screenshots)
