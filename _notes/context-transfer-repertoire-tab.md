# Context Transfer: Repertoire Tab Implementation

**Date:** October 12, 2025  
**Branch:** `feat/pwa1`  
**Status:** Ready to implement Repertoire tab  
**Previous Work:** Catalog tab UI complete with sidebar, grid improvements, and filter panel  
**Next Session Location:** Share this file with new chat

---

## Executive Summary

The TuneTrees SolidJS PWA rewrite is progressing well through Phase 9 (UI Polish). The **Catalog tab is now complete** with a fully functional sidebar, advanced grid features, and modern filter UI. We're now ready to implement the **Repertoire tab**, which will be similar to Catalog but filtered to show only tunes in the user's active repertoire.

---

## What Was Just Completed (Catalog Tab)

### ✅ Major Accomplishments

1. **Enhanced Sidebar** (`src/components/layout/Sidebar.tsx`)

   - Horizontally resizable (240-600px with drag handle)
   - Touch support for mobile
   - Performance optimized (RAF throttling, local state, deferred persistence)
   - lucide-solid icons throughout (GripVertical, ChevronLeft/Right)
   - Centered collapse button
   - Smooth 60fps resize performance

2. **TuneInfoHeader Component** (`src/components/sidebar/TuneInfoHeader.tsx`)

   - Displays current tune title, type, mode, genre, structure
   - Loading and empty states
   - Reactive to CurrentTuneContext changes

3. **Grid Improvements** (`src/components/grids/TunesGridCatalog.tsx`)

   - Single-click sets current tune (updates sidebar)
   - Double-click opens tune editor
   - Footer with tune count
   - lucide-solid GripVertical icons for column drag handles
   - Column visibility menu integration
   - Touch support for mobile drag/resize

4. **Filter Panel** (`src/components/catalog/FilterPanel.tsx`)

   - Separate dropdowns for Type, Mode, Genre, Playlist
   - Filter chips for selected items
   - Mobile-responsive search integration
   - Portal-based rendering (no z-index conflicts)

5. **Dependencies**
   - `lucide-solid` v0.545.0 - Professional SVG icons
   - `loglevel` v1.9.2 - Centralized logging
   - `drizzle-kit` restored to ^0.31.5 (was accidentally downgraded)

### 📊 Current Git Status

```bash
On branch feat/pwa1
Your branch is ahead of 'origin/feat/pwa1' by 3 commits.
nothing to commit, working tree clean
```

**Recent commits:**

1. `7172c4a` - ✨ Catalog tab UI polish - sidebar resize, icons, and grid improvements
2. `42b78e0` - ⬆️ Fix drizzle-kit version regression + catalog UI polish
3. `9b06cb9` - 🧹 Remove dev-dist build artifacts

---

## Project Architecture Overview

### **Stack & Technologies**

**Frontend:**

- **SolidJS** v1.9.9 - Reactive UI framework
- **TypeScript** 5.9.3 (strict mode)
- **Vite** 7.1.7 - Build tool
- **TanStack Solid Table** v8.21.3 - Data grid
- **TanStack Solid Virtual** v3.13.12 - Virtual scrolling
- **@kobalte/core** v0.13.11 - UI primitives
- **lucide-solid** v0.545.0 - Icons
- **Tailwind CSS** 4.1.14 - Styling

**Backend & Data:**

- **Supabase** - Remote PostgreSQL + Auth + Realtime
- **SQLite WASM** (sql.js) - Local offline storage
- **Drizzle ORM** v0.44.6 - Type-safe database queries
- **Sync Engine** - Bidirectional sync (SQLite ↔ Supabase)

**Data Status:**

- ✅ 500+ tunes synced
- ✅ 1,000+ practice records
- ✅ 515 notes
- ✅ 526 references
- ✅ 9 Realtime channels active

### **File Structure (Relevant to Repertoire Tab)**

```
src/
├── components/
│   ├── grids/
│   │   ├── TunesGridCatalog.tsx      ✅ Complete (reference for Repertoire)
│   │   ├── TunesGridRepertoire.tsx   ⚠️  TODO: Implement next
│   │   ├── TunesGridScheduled.tsx    ⏸️  Future work
│   │   ├── types.ts                  ✅ Grid type definitions
│   │   └── state-persistence.ts      ✅ localStorage helpers
│   ├── catalog/
│   │   ├── CatalogToolbar.tsx        ✅ Reference for RepertoireToolbar
│   │   ├── FilterPanel.tsx           ✅ Reusable component
│   │   └── ColumnVisibilityMenu.tsx  ✅ Reusable component
│   ├── layout/
│   │   ├── MainLayout.tsx            ✅ Shared layout
│   │   ├── Sidebar.tsx               ✅ Global sidebar
│   │   └── TopNav.tsx                ✅ Navigation
│   └── sidebar/
│       ├── TuneInfoHeader.tsx        ✅ Current tune display
│       └── index.ts                  ✅ Barrel export
├── routes/
│   ├── catalog.tsx                   ✅ Complete (reference)
│   ├── repertoire.tsx                ⚠️  TODO: Enhance next
│   ├── practice.tsx                  ⏸️  Future work
│   └── analysis.tsx                  ⏸️  Future work
├── lib/
│   ├── context/
│   │   ├── CurrentTuneContext.tsx    ✅ Global tune state
│   │   └── CurrentPlaylistContext.tsx ✅ Global playlist state
│   ├── db/
│   │   ├── queries/tunes.ts          ✅ Tune queries
│   │   └── queries/playlists.ts      ✅ Playlist queries
│   └── sync/
│       └── engine.ts                 ✅ Sync engine
└── _notes/
    ├── tunes_grids_specification.md  📖 CRITICAL: Grid requirements
    ├── catalog-grid-advanced-features.md 📖 Implementation reference
    ├── session-sidebar-redesign-oct11.md 📖 Sidebar patterns
    └── context-transfer-repertoire-tab.md 📖 This file
```

---

## Repertoire Tab Requirements

### **What is the Repertoire Tab?**

The Repertoire tab shows **all tunes in the user's current playlist** (active repertoire), regardless of scheduling status. It's essentially the Catalog tab but filtered to a specific playlist.

### **Key Differences from Catalog**

| Feature                    | Catalog Tab                         | Repertoire Tab                                 |
| -------------------------- | ----------------------------------- | ---------------------------------------------- |
| **Data Source**            | All tunes (public + user's private) | Tunes in current playlist only                 |
| **Filter Panel**           | Type, Mode, Genre, Playlist         | Type, Mode, Genre (no Playlist filter)         |
| **Add To Repertoire**      | Available (adds to playlist)        | ❌ Not shown (already in repertoire)           |
| **Remove From Repertoire** | ❌ Not shown                        | ✅ Available (removes from playlist)           |
| **Toolbar Actions**        | Add Tune, Delete Tunes              | Add Tune, Remove From Repertoire, Delete Tunes |
| **Footer Text**            | "X tunes in selected playlists"     | "X tunes in repertoire"                        |
| **Default State**          | No playlist filter active           | Current playlist always filtered               |

### **Database Query**

**Catalog uses:**

```typescript
// All tunes for user (public + private)
await getTunesForUser(db, userId);
```

**Repertoire should use:**

```typescript
// Only tunes in current playlist
await getPlaylistTunes(db, playlistId);
```

**Important:** Both should filter client-side by Type, Mode, Genre, Search query.

---

## Implementation Plan for Repertoire Tab

### **Phase 1: Create RepertoireToolbar Component**

**File:** `src/components/repertoire/RepertoireToolbar.tsx`

**Based on:** `src/components/catalog/CatalogToolbar.tsx`

**Changes needed:**

1. Remove "Add To Repertoire" button
2. Add "Remove From Repertoire" button (enabled when rows selected)
3. Remove Playlist filter from FilterPanel (playlist is implied)
4. Update button styling to match Catalog (green for Add, red for Delete, orange for Remove)
5. Add proper aria-labels and tooltips

**Example structure:**

```typescript
export const RepertoireToolbar: Component<RepertoireToolbarProps> = (props) => {
  return (
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200/30 dark:border-gray-700/30">
      <div class="px-2 sm:px-3 lg:px-4 py-1.5">
        <div class="flex items-center gap-1.5 sm:gap-2">
          {/* Search input (desktop) */}
          {/* FilterPanel (without Playlist filter) */}
          {/* Add Tune button */}
          {/* Remove From Repertoire button */}
          {/* Delete Tunes button */}
          {/* Columns dropdown */}
        </div>
      </div>
    </div>
  );
};
```

### **Phase 2: Create TunesGridRepertoire Component**

**File:** `src/components/grids/TunesGridRepertoire.tsx`

**Based on:** `src/components/grids/TunesGridCatalog.tsx`

**Changes needed:**

1. Use `getPlaylistTunes()` instead of `getTunesForUser()`
2. Update footer text: `{filteredTunes().length} {filteredTunes().length === 1 ? "tune" : "tunes"} in repertoire`
3. Remove playlist filtering logic (currentPlaylistId is the filter)
4. Keep all advanced features:
   - Column drag-and-drop reordering
   - Column resizing
   - Column visibility
   - Virtual scrolling
   - State persistence
   - Single-click/double-click behavior
   - Touch support

**Data loading pattern:**

```typescript
const [tunes] = createResource(
  () => {
    const db = localDb();
    const userId = user()?.id;
    const playlistId = currentPlaylistId();
    const version = syncVersion();
    return db && userId && playlistId
      ? { db, userId, playlistId, version }
      : null;
  },
  async (params) => {
    if (!params) return [];
    return await getPlaylistTunes(params.db, params.playlistId);
  }
);
```

### **Phase 3: Update repertoire.tsx Route**

**File:** `src/routes/repertoire.tsx`

**Based on:** `src/routes/catalog.tsx`

**Changes needed:**

1. Import RepertoireToolbar and TunesGridRepertoire
2. Remove playlist filter state (selectedPlaylistIds)
3. Keep Type, Mode, Genre, Search filter state
4. Update layout to use new components
5. Handle "Remove From Repertoire" action
6. Ensure CurrentPlaylistContext is being used

**Example structure:**

```typescript
const RepertoirePage: Component = () => {
  const { user, localDb, syncVersion } = useAuth();
  const { currentPlaylistId } = useCurrentPlaylist();

  // Filter state (no playlist filter)
  const [searchQuery, setSearchQuery] = createSignal(getParam(searchParams.q));
  const [selectedTypes, setSelectedTypes] = createSignal<string[]>(/*...*/);
  const [selectedModes, setSelectedModes] = createSignal<string[]>(/*...*/);
  const [selectedGenres, setSelectedGenres] = createSignal<string[]>(/*...*/);

  const [selectedRowsCount, setSelectedRowsCount] = createSignal(0);
  const [tableInstance, setTableInstance] = createSignal<Table<any> | null>(null);

  // Fetch tunes in current playlist
  const [playlistTunes] = createResource(/*...*/);

  // Available filter options
  const availableTypes = createMemo(() => /*...*/);
  const availableModes = createMemo(() => /*...*/);
  const availableGenres = createMemo(() => /*...*/);

  const handleRemoveFromRepertoire = async () => {
    // TODO: Implement removal logic
  };

  return (
    <div class="flex flex-col h-full">
      <RepertoireToolbar
        searchQuery={searchQuery()}
        onSearchChange={setSearchQuery}
        selectedTypes={selectedTypes()}
        onTypesChange={setSelectedTypes}
        selectedModes={selectedModes()}
        onModesChange={setSelectedModes}
        selectedGenres={selectedGenres()}
        onGenresChange={setSelectedGenres}
        availableTypes={availableTypes()}
        availableModes={availableModes()}
        availableGenres={availableGenres()}
        selectedRowsCount={selectedRowsCount()}
        table={tableInstance() || undefined}
        onRemoveFromRepertoire={handleRemoveFromRepertoire}
      />

      <div class="flex-1 overflow-hidden p-4 md:p-6">
        <TunesGridRepertoire
          userId={Number.parseInt(user()!.id)}
          playlistId={currentPlaylistId() || 0}
          tablePurpose="repertoire"
          searchQuery={searchQuery()}
          selectedTypes={selectedTypes()}
          selectedModes={selectedModes()}
          selectedGenres={selectedGenres()}
          onTuneSelect={handleTuneSelect}
          onSelectionChange={setSelectedRowsCount}
          onTableReady={setTableInstance}
        />
      </div>
    </div>
  );
};
```

### **Phase 4: Add RepertoireToolbar Tests**

**File:** `tests/repertoire-toolbar.spec.ts`

**Test cases:**

1. Toolbar renders with correct buttons
2. "Remove From Repertoire" button is disabled when no rows selected
3. "Remove From Repertoire" button is enabled when rows are selected
4. Filter panel opens and closes correctly
5. Search input works on desktop/mobile
6. Column visibility menu opens and closes

---

## Critical Implementation Patterns

### **1. SolidJS Reactive Patterns**

```typescript
// ✅ CORRECT - Use createSignal for local state
const [searchQuery, setSearchQuery] = createSignal("");

// ✅ CORRECT - Use createResource for async data
const [tunes] = createResource(
  () => ({ db: localDb(), playlistId: currentPlaylistId() }),
  async (params) => await getPlaylistTunes(params.db, params.playlistId)
);

// ✅ CORRECT - Use createMemo for derived state
const filteredTunes = createMemo(() => {
  return (
    tunes()?.filter((tune) => {
      // Filter logic
    }) || []
  );
});

// ✅ CORRECT - Use createEffect for side effects
createEffect(() => {
  const params = {
    /* ... */
  };
  setSearchParams(params);
});

// ❌ WRONG - Don't use React hooks
import { useState, useEffect } from "react"; // NO!
```

### **2. CurrentPlaylistContext Usage**

```typescript
import { useCurrentPlaylist } from "@/lib/context/CurrentPlaylistContext";

const { currentPlaylistId } = useCurrentPlaylist();

// Use in resource dependencies
const [tunes] = createResource(
  () => {
    const playlistId = currentPlaylistId();
    return playlistId ? { db: localDb(), playlistId } : null;
  },
  async (params) => {
    /* ... */
  }
);
```

### **3. Grid State Persistence**

```typescript
import {
  saveTableState,
  loadTableState,
} from "@/components/grids/state-persistence";

// State persistence key
const stateKey = createMemo(() => ({
  userId: props.userId,
  tablePurpose: "repertoire", // Important: use "repertoire" not "catalog"
  playlistId: currentPlaylistId() || 0,
}));

// Load persisted state
const loadedState = loadTableState(stateKey());

// Save state on changes
createEffect(() => {
  const state = {
    sorting: sorting(),
    columnSizing: columnSizing(),
    columnOrder: columnOrder(),
    columnVisibility: columnVisibility(),
    scrollTop: containerRef?.scrollTop || 0,
  };
  saveTableState(stateKey(), state);
});
```

### **4. Performance Optimization**

```typescript
// Use RAF throttling for drag operations
let rafId: number | null = null;

const handleDrag = (e: MouseEvent) => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  rafId = requestAnimationFrame(() => {
    // Update local state only (fast)
    setLocalValue(newValue);
    rafId = null;
  });
};

// Defer parent updates to drag end
const handleDragEnd = () => {
  props.onValueChangeEnd?.(localValue());
};

// Cleanup
onCleanup(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }
});
```

---

## Common Pitfalls to Avoid

### **1. Don't Mutate Signals Directly**

```typescript
// ❌ WRONG - Direct mutation
const [user, setUser] = createSignal({ name: "Alice" });
user().name = "Bob"; // DOESN'T TRIGGER REACTIVITY!

// ✅ CORRECT - Update with new object
setUser({ ...user(), name: "Bob" });
```

### **2. Don't Forget Cleanup in Effects**

```typescript
// ❌ WRONG - Memory leak
createEffect(() => {
  const interval = setInterval(() => console.log("tick"), 1000);
  // No cleanup!
});

// ✅ CORRECT - Cleanup registered
createEffect(() => {
  const interval = setInterval(() => console.log("tick"), 1000);
  onCleanup(() => clearInterval(interval));
});
```

### **3. Don't Use `any` Types**

```typescript
// ❌ WRONG - Type safety lost
const data: any = await fetchTunes();

// ✅ CORRECT - Strict typing
interface Tune {
  id: number;
  title: string;
  type: string;
}
const data: Tune[] = await fetchTunes();
```

### **4. Don't Forget Touch Support**

```typescript
// ❌ WRONG - Desktop only
<button onMouseDown={handleDragStart}>Resize</button>

// ✅ CORRECT - Desktop + mobile
<button
  onMouseDown={handleMouseDown}
  onTouchStart={handleTouchStart}
  class="touch-none"
>
  Resize
</button>
```

---

## Testing Strategy

### **Manual Testing Checklist**

- [ ] Repertoire tab loads with current playlist tunes
- [ ] Sidebar updates when clicking a tune
- [ ] Double-click opens tune editor
- [ ] Search filter works
- [ ] Type/Mode/Genre filters work
- [ ] Column drag-and-drop reordering works
- [ ] Column resizing works
- [ ] Column visibility menu works
- [ ] Remove From Repertoire button enables/disables correctly
- [ ] Footer shows correct tune count
- [ ] State persists across page reload
- [ ] Touch support works on mobile
- [ ] Responsive design works on all screen sizes

### **Playwright E2E Tests (Future)**

```typescript
test("repertoire tab shows only current playlist tunes", async ({ page }) => {
  await page.goto("/repertoire");

  // Wait for grid to load
  await page.waitForSelector('[data-grid="repertoire"]');

  // Verify tune count
  const footer = await page.textContent("[data-footer]");
  expect(footer).toContain("tunes in repertoire");

  // Verify no playlist filter in toolbar
  const playlistFilter = await page.$('[aria-label*="Playlist"]');
  expect(playlistFilter).toBeNull();
});
```

---

## Quality Gates

### **Pre-Commit Checks**

```bash
npm run typecheck  # TypeScript strict mode check
npm run lint       # ESLint
npm run format     # Prettier
npm run test       # Unit tests (when added)
```

### **Success Criteria**

- [ ] TypeScript strict mode passing (0 errors)
- [ ] No ESLint warnings
- [ ] All imports resolved correctly
- [ ] Component renders without console errors
- [ ] Sidebar updates on tune selection
- [ ] Filters work correctly
- [ ] State persists to localStorage
- [ ] Responsive design verified
- [ ] Touch support verified

---

## Key Reference Files

### **MUST READ**

1. **`_notes/tunes_grids_specification.md`**

   - Complete grid requirements
   - Data sources and views
   - Column definitions
   - Advanced features spec

2. **`_notes/catalog-grid-advanced-features.md`**

   - Implementation details for drag-drop, resize, column visibility
   - Code patterns and examples
   - Performance optimizations

3. **`_notes/session-sidebar-redesign-oct11.md`**
   - Sidebar implementation patterns
   - CurrentTuneContext integration
   - State management examples

### **Reference Implementations**

1. **`src/routes/catalog.tsx`**

   - Overall page structure
   - Filter state management
   - Resource loading patterns

2. **`src/components/catalog/CatalogToolbar.tsx`**

   - Toolbar layout and buttons
   - FilterPanel integration
   - Responsive design

3. **`src/components/grids/TunesGridCatalog.tsx`**

   - Grid implementation
   - Column definitions
   - Virtual scrolling
   - State persistence

4. **`src/components/layout/Sidebar.tsx`**
   - Resize handle implementation
   - Touch support
   - Performance optimizations

---

## Environment & Tools

### **Development Server**

```bash
npm run dev
# Runs on http://localhost:5173
```

### **Database Status**

- **Local:** SQLite WASM via IndexedDB
- **Remote:** Supabase PostgreSQL
- **Sync:** Bidirectional, real-time
- **Data:** 500+ tunes, 1000+ practice records

### **Current User**

- **Email:** sboagy@gmail.com
- **User ID:** Available via `useAuth()` hook
- **Playlists:** Multiple playlists available via `getCurrentPlaylist()`

### **Available Tools**

- **TypeScript:** Strict mode enabled
- **Biome:** Linting and formatting
- **Vite:** Fast dev server with HMR
- **Drizzle Studio:** Database visualization (optional)
- **Browser DevTools:** SolidJS devtools extension available

---

## Next Steps for New Session

### **Immediate Actions**

1. **Read Reference Files**

   - Review `_notes/tunes_grids_specification.md` for grid requirements
   - Review `src/routes/catalog.tsx` for page structure
   - Review `src/components/catalog/CatalogToolbar.tsx` for toolbar patterns

2. **Create Components**

   - Create `src/components/repertoire/` directory
   - Implement `RepertoireToolbar.tsx`
   - Implement `src/components/grids/TunesGridRepertoire.tsx`

3. **Update Route**

   - Enhance `src/routes/repertoire.tsx`
   - Integrate new components
   - Implement filter logic

4. **Test Functionality**
   - Manual testing on desktop
   - Manual testing on mobile
   - Verify state persistence
   - Verify sidebar integration

### **Success Milestones**

1. ✅ RepertoireToolbar renders with correct buttons
2. ✅ TunesGridRepertoire shows current playlist tunes
3. ✅ Filters work (Type, Mode, Genre, Search)
4. ✅ Remove From Repertoire button functions
5. ✅ Sidebar updates on tune selection
6. ✅ State persists across reload
7. ✅ Touch support works on mobile
8. ✅ TypeScript strict mode passes

### **Questions to Consider**

1. Should "Remove From Repertoire" be a single button or support bulk removal?
2. Should removal require confirmation dialog?
3. Should removed tunes be soft-deleted or hard-deleted from playlist_tune table?
4. Should we add an "Undo" feature for accidental removals?
5. Should the grid automatically refresh after removal, or rely on sync?

---

## Git Status Summary

**Current branch:** `feat/pwa1`  
**Commits ahead of origin:** 3  
**Working tree:** Clean  
**Ready to push:** Yes (but can continue local development)

**Recent commits:**

- `7172c4a` - Catalog tab UI polish (sidebar, grid, icons)
- `42b78e0` - drizzle-kit fix + documentation
- `9b06cb9` - Remove dev-dist artifacts

---

## Final Notes

### **What's Working Well**

✅ Catalog tab is fully functional and polished  
✅ Sidebar integration with CurrentTuneContext  
✅ Filter panel with separate dropdowns  
✅ Column drag-drop, resize, visibility  
✅ Touch support for mobile  
✅ Performance optimizations (60fps drag)  
✅ State persistence to localStorage  
✅ lucide-solid icons throughout

### **What to Carry Forward**

- Same component patterns (Toolbar + Grid + Route)
- Same filter architecture (FilterPanel reusable)
- Same grid features (drag, resize, visibility, virtual scrolling)
- Same sidebar integration (CurrentTuneContext)
- Same state persistence approach (localStorage)
- Same performance optimizations (RAF throttling)

### **What's Different for Repertoire**

- Data source: `getPlaylistTunes()` instead of `getTunesForUser()`
- No playlist filter (playlist is implied by current selection)
- "Remove From Repertoire" instead of "Add To Repertoire"
- Footer text: "tunes in repertoire" instead of "tunes in selected playlists"

### **Remember**

- Follow SolidJS patterns (signals, effects, memos, resources)
- Use strict TypeScript (no `any` types)
- Include touch support for all interactive elements
- Test on both desktop and mobile viewports
- Run quality gates before committing (`typecheck`, `lint`, `format`)
- Document patterns in session notes for future reference

---

**Good luck with the Repertoire tab implementation!** 🎵

The patterns from Catalog should transfer smoothly. Focus on the differences (data source, toolbar buttons, filters) and reuse everything else.

**Estimated effort:** 2-4 hours for a full implementation with testing.
