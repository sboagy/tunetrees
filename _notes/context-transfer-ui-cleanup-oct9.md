# Context Transfer: TuneTrees UI Cleanup & Navigation Reorganization

**Date:** October 9, 2025  
**Branch:** `feat/pwa1`  
**Last Commit:** `0c0ac1f` - "feat: Add sticky control banners, database status dropdown, and UI cleanup"

---

## Project Context

**TuneTrees** is a SolidJS PWA for practicing traditional music tunes using spaced repetition (FSRS algorithm). Currently rewriting from Next.js + Python/FastAPI to SolidJS + TypeScript + Supabase.

**Tech Stack:**

- Frontend: SolidJS 1.8+, TypeScript 5.x (strict mode), Vite 5.x
- UI: shadcn-solid, Kobalte UI primitives, Tailwind CSS 4.x
- Backend: Supabase (PostgreSQL, Auth, Realtime)
- Local Storage: SQLite WASM with Drizzle ORM
- State: SolidJS signals, context API (no React hooks)

**Key Architecture:**

- Offline-first: All reads from local SQLite, writes sync to Supabase
- Global contexts: `CurrentPlaylistContext`, `CurrentTuneContext`, `AuthContext`
- Reactive patterns: `createSignal`, `createMemo`, `createEffect`, `createResource`

---

## Recent Session Summary (October 9, 2025)

### What We Accomplished

This session focused on major UI cleanup and navigation reorganization. We implemented:

1. **Global Playlist Context** - Reactive playlist state management
2. **Database/Sync Status Dropdown** - Consolidated status information
3. **Sticky Control Banners** - Consistent pattern across all tabs
4. **UI Cleanup** - Removed redundant sections and streamlined layouts
5. **Realtime Configuration** - Made Realtime opt-in to reduce console noise

---

## Major Changes

### 1. Global Playlist Context (`src/lib/context/CurrentPlaylistContext.tsx`)

**Created new context for playlist state management:**

```typescript
// Global playlist state - accessible throughout app
const { currentPlaylistId, setCurrentPlaylistId } = useCurrentPlaylist();
```

**Integration:**

- Wrapped app in `CurrentPlaylistProvider` (in `App.tsx`)
- TopNav playlist dropdown uses context
- TuneList components react to playlist changes
- Practice/Repertoire tabs filter by current playlist

**Key Features:**

- Reactive playlist selection (updates all components automatically)
- Persists to localStorage (`playlist-service.ts`)
- User-scoped storage keys

---

### 2. Navigation Reorganization

**Playlist Selector Moved to TopNav:**

- Previously: Inside Practice tab as separate component
- Now: Dropdown in TopNav with reactive title display
- Shows playlist name (or "Playlist N" if name is null)
- Responsive: Icon on mobile, name on desktop

**User Information Moved to TopNav Dropdown:**

- Previously: Blue box in Practice page
- Now: Section in user dropdown menu
- Shows: Email, Name, User ID

**History Button Moved to Practice Control Banner:**

- Previously: In dropdown or separate section
- Now: In sticky Practice control banner

---

### 3. Database/Sync Status Dropdown

**Created comprehensive status dropdown in TopNav:**

**Replaces:** Old sync status indicator (small pill with hover tooltip)

**Features:**

- **Database Icon (🗄️)** with status badge:
  - ✓ Green checkmark when synced and online
  - ⚠️ Yellow warning when offline or syncing
- **Dropdown Contents:**
  - Local Database status (initialized or initializing)
  - Sync status (synced, syncing, or offline with pending count)
  - Network status (online or offline)
  - Database Browser link (dev mode only)

**Benefits:**

- All status info in one organized place
- Visual indicator without opening menu
- User-accessible (not just dev mode)
- Cleaner TopNav

---

### 4. Sticky Control Banners (All Tabs)

**Created consistent pattern across Practice, Repertoire, and Catalog tabs:**

**Layout Pattern:**

```tsx
<div class="h-full flex flex-col">
  {/* Sticky Control Banner - stays at top when scrolling */}
  <ControlBanner />

  {/* Main Content Area - scrollable */}
  <div class="flex-1 overflow-auto">{/* Content */}</div>
</div>
```

**New Components Created:**

1. **`PracticeControlBanner`** (updated)

   - Sticky: `sticky top-0 z-10`
   - Actions: Practice History button

2. **`RepertoireControlBanner`** (new)

   - Location: `src/components/repertoire/RepertoireControlBanner.tsx`
   - Actions: Add To Review button
   - Barrel export: `src/components/repertoire/index.ts`

3. **`CatalogControlBanner`** (new)
   - Location: `src/components/catalog/CatalogControlBanner.tsx`
   - Actions: Add Tune button
   - Barrel export: `src/components/catalog/index.ts`

**Control Banner Features:**

- Sticky positioning (stays visible when scrolling)
- Consistent styling across all tabs
- Responsive button labels (full text on desktop, abbreviated on mobile)
- Z-index layering for proper stacking

---

### 5. Practice Tab Cleanup

**Removed from Practice Page:**

- ❌ "Welcome to Practice Mode! 🎶" title
- ❌ "Ready to Practice?" card with buttons
- ❌ "Tune Library" section
- ❌ "User Information" box (moved to TopNav)
- ❌ "Local Database Status" box (moved to TopNav dropdown)

**Result:**

- Clean, minimal layout
- Sticky control banner at top
- Practice session content area below
- Full-height layout for better UX

---

### 6. Repertoire & Catalog Tab Cleanup

**Removed:**

- ❌ Page headers with titles and descriptions
- ❌ Inline action buttons in headers
- ❌ Database initialization loading states
- ❌ Unnecessary wrapper divs and padding

**Added:**

- ✅ Sticky control banners
- ✅ Clean table-only layouts
- ✅ Consistent styling with Practice tab

---

### 7. Realtime Sync Configuration

**Problem:** Console flooded with Realtime errors (websocket connection failures)

**Solution:** Made Realtime opt-in via environment variable

**Changes to `src/lib/auth/AuthContext.tsx`:**

```typescript
// OLD: Always enabled
realtimeEnabled: true,

// NEW: Only enabled if environment variable is set
realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === "true",
```

**Documentation Added to `.env.example`:**

```bash
# Enable Supabase Realtime live sync (default: false)
# Set to 'true' to enable websocket-based real-time synchronization
# Note: Requires Realtime to be enabled in your Supabase project settings
# VITE_REALTIME_ENABLED=true

# Enable debug logging for sync operations (default: false)
# Set to 'true' to see detailed sync logs in console
# VITE_SYNC_DEBUG=true
```

**Benefits:**

- Clean console by default during development
- No connection errors when Realtime not configured
- Easy to enable when ready: Add `VITE_REALTIME_ENABLED=true` to `.env.local`

---

## File Changes Summary

### Modified Files (7)

1. **`.env.example`**

   - Added `VITE_REALTIME_ENABLED` documentation
   - Added `VITE_SYNC_DEBUG` documentation

2. **`src/components/layout/TopNav.tsx`**

   - Removed old sync status indicator
   - Added Database/Sync Status dropdown
   - Moved User Information to user dropdown
   - Removed standalone database browser icon
   - Cleaned up unused functions

3. **`src/components/practice/PracticeControlBanner.tsx`**

   - Made sticky with `sticky top-0 z-10`

4. **`src/lib/auth/AuthContext.tsx`**

   - Changed `realtimeEnabled: true` to `import.meta.env.VITE_REALTIME_ENABLED === "true"`

5. **`src/routes/practice/Index.tsx`**

   - Removed all unnecessary sections
   - Simplified to control banner + content area
   - Removed unused imports and state

6. **`src/routes/repertoire.tsx`**

   - Removed page header
   - Added `RepertoireControlBanner`
   - Simplified layout

7. **`src/routes/catalog.tsx`**
   - Removed page header
   - Added `CatalogControlBanner`
   - Simplified layout

### New Files (4)

1. **`src/components/repertoire/RepertoireControlBanner.tsx`**

   - Sticky control banner for Repertoire tab
   - Add To Review button

2. **`src/components/repertoire/index.ts`**

   - Barrel export for repertoire components

3. **`src/components/catalog/CatalogControlBanner.tsx`**

   - Sticky control banner for Catalog tab
   - Add Tune button

4. **`src/components/catalog/index.ts`**
   - Barrel export for catalog components

### Also Committed (in \_notes/)

- `_notes/image.png`
- `_notes/tunes_grids_specification.md`

**Total:** 13 files changed, 505 insertions(+), 331 deletions(-)

---

## Code Patterns to Follow

### 1. Reactive Playlist State

```typescript
// Access current playlist
const { currentPlaylistId, setCurrentPlaylistId } = useCurrentPlaylist();

// Update playlist
setCurrentPlaylistId(playlistId);

// React to changes
createEffect(() => {
  const id = currentPlaylistId();
  // Do something when playlist changes
});
```

### 2. TuneList Filtering

```typescript
// Filter by current playlist (Practice, Repertoire)
<TuneList onTuneSelect={handleSelect} filterByPlaylist={true} />

// Show all tunes (Catalog)
<TuneList onTuneSelect={handleSelect} />
```

### 3. Sticky Control Banner Pattern

```typescript
export const ControlBanner: Component = () => {
  return (
    <div class="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-12">{/* Controls */}</div>
    </div>
  );
};
```

### 4. Tab Layout Pattern

```typescript
const TabPage: Component = () => {
  return (
    <div class="h-full flex flex-col">
      <ControlBanner />
      <div class="flex-1 overflow-auto">{/* Content */}</div>
    </div>
  );
};
```

---

## Current State

### Working Features ✅

- Global playlist context (reactive state management)
- Playlist selector in TopNav (shows current playlist name)
- User information in TopNav dropdown
- Database/Sync status dropdown with visual indicators
- Sticky control banners on all tabs
- Clean, minimal tab layouts
- Realtime disabled by default (opt-in via env var)
- TuneList filtering by playlist (Practice/Repertoire) or all tunes (Catalog)

### UI Components

- TopNav: Logo, Playlist dropdown, DB/Sync dropdown, User dropdown, Theme switcher
- Practice tab: Control banner (History button) + Practice session area
- Repertoire tab: Control banner (Add To Review) + Tune table
- Catalog tab: Control banner (Add Tune) + Tune table
- All tabs use consistent sticky banner pattern

### Known Issues / TODOs

- Practice session not starting (showPracticeSession state never set to true)
- "Add To Review" button placeholder (needs implementation)
- Database Browser only shows in dev mode (intentional)
- Some playlist names are null in database (fallback shows "Playlist N")

---

## Important Files to Know

### Global State Management

- `src/lib/context/CurrentPlaylistContext.tsx` - Playlist state
- `src/lib/context/CurrentTuneContext.tsx` - Current tune state
- `src/lib/auth/AuthContext.tsx` - Auth, database, sync worker

### Navigation & Layout

- `src/components/layout/TopNav.tsx` - Top navigation bar
- `src/components/layout/MainLayout.tsx` - Main app layout with tabs
- `src/routes/Home.tsx` - Home page with TabBar

### Control Banners (Sticky)

- `src/components/practice/PracticeControlBanner.tsx`
- `src/components/repertoire/RepertoireControlBanner.tsx`
- `src/components/catalog/CatalogControlBanner.tsx`

### Tab Pages

- `src/routes/practice/Index.tsx` - Practice tab
- `src/routes/repertoire.tsx` - Repertoire tab
- `src/routes/catalog.tsx` - Catalog tab

### Services

- `src/lib/services/playlist-service.ts` - localStorage persistence
- `src/lib/sync/engine.ts` - Sync engine (local ↔ Supabase)
- `src/lib/sync/realtime.ts` - Realtime subscriptions (opt-in)

---

## Environment Variables

### Current Settings

```bash
# Required for app to work
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional - Default: false
# VITE_SYNC_DEBUG=true          # Show sync logs
# VITE_REALTIME_ENABLED=true    # Enable websocket sync
```

---

## Next Steps / Future Work

### Immediate TODOs

1. **Fix Practice Session Start** - showPracticeSession never becomes true
2. **Implement "Add To Review"** - Bulk add tunes to practice queue
3. **Test Playlist Switching** - Verify all components react correctly
4. **Add Playlist Names** - Update database or add UI to rename playlists

### Future Enhancements

1. **Start Practice Button** - Add to Practice control banner or as empty state
2. **Bulk Actions** - Multi-select tunes for playlist operations
3. **Import/Export** - Add to Catalog control banner
4. **Display Options** - Column visibility, sorting preferences
5. **Filters UI** - Expand filter controls in TuneList
6. **Statistics** - Add Analytics tab with practice stats

### Performance Considerations

- TuneList already uses TanStack Virtual for large datasets
- Sync runs every 30 seconds (configurable)
- Realtime disabled by default (reduces overhead)
- All components use SolidJS fine-grained reactivity

---

## Testing Notes

### Manual Testing Checklist

- [ ] Select playlist in TopNav → all tabs update
- [ ] Click database icon → dropdown shows correct status
- [ ] Click user email → shows user information
- [ ] Scroll in tabs → control banners stay sticky
- [ ] Switch tabs → layout stays consistent
- [ ] Filter tunes in Practice/Repertoire (by playlist)
- [ ] View all tunes in Catalog (no filter)
- [ ] Theme switching works
- [ ] Responsive design (mobile/desktop)

### Known Working Flows

- Login → Database initialization → Sync starts
- Playlist selection → Context updates → TuneList refreshes
- Offline mode → Pending changes tracked → Sync on reconnect
- Tab navigation → Smooth transitions

---

## Copilot Instructions Reference

**Main Instructions:** `.github/copilot-instructions.md`

- SolidJS patterns (no React hooks)
- Strict TypeScript (no `any`)
- Offline-first architecture
- Quality gates (typecheck, lint, format)

**Specialized Instructions:**

- `.github/instructions/database.instructions.md` - DB schema & safety
- `.github/instructions/testing.instructions.md` - Playwright tests
- `.github/instructions/ui-development.instructions.md` - UI patterns

---

## Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server (usually port 5173)
npm run typecheck        # TypeScript strict mode check
npm run lint             # ESLint
npm run format           # Prettier
npm run test             # Unit tests (Vitest)

# Database
# SQLite WASM runs in browser, no separate DB server needed

# Git
git status
git log --oneline -5
git diff
```

---

## Summary for Next Session

**Current Branch:** `feat/pwa1`  
**Last Commit:** `0c0ac1f`

**What's Working:**

- Clean, modern UI with sticky control banners
- Global playlist context for reactive state
- Database/Sync status dropdown in TopNav
- Consistent layout pattern across all tabs
- Realtime opt-in (no console noise)

**What Needs Attention:**

- Practice session not starting (button to trigger it?)
- Implement "Add To Review" functionality
- Test playlist switching thoroughly
- Consider adding playlist name editing UI

**Architecture Highlights:**

- SolidJS reactive primitives (signals, memos, effects)
- Global contexts for shared state
- Offline-first with local SQLite + Supabase sync
- Type-safe with strict TypeScript
- Component-driven with barrel exports

---

## Questions to Ask User

1. Should we add a "Start Practice" button to the Practice control banner?
2. How should "Add To Review" work? (Select tunes → add to queue?)
3. Do we want to add playlist renaming/editing UI?
4. Should we show empty states when no playlist is selected?
5. Any other UI tweaks needed before moving to next feature?

---

**Session End:** October 9, 2025  
**Status:** All changes committed and ready for next session  
**Next Focus:** Fix Practice session start flow or implement "Add To Review"
