# TuneTrees PWA Migration Plan

**Created:** October 4, 2025  
**Last Updated:** October 9, 2025  
**Current Phase:** Phase 9 (UI Polish & Additional Features)  
**Overall Progress:** 80% Complete (Phases 0-8 done, Phase 9 starting)

---

## 🎯 Mission

Rewrite TuneTrees from a **server-dependent Next.js/Python app** to a **fully offline-capable Progressive Web App** that works entirely in the browser.

### What's Changing

| Aspect         | Legacy      | PWA         |
| -------------- | ----------- | ----------- | ------------------------- | ------------------- | ------------------- |
| **Backend**    | 6: Advanced | ✅ Partial  | 2-3 weeks                 | 1 task done (Oct 7) |
| 7: PWA Core    | ✅ Don      | 6: Advanced | ✅ Partial                | 2-3 weeks           | 1 task done (Oct 7) |
| 7: PWA Core    | ✅ Done     | 1 week      | 1 day (Oct 7)             |
| 8: Remote Sync | ✅ Done     | 3-4 weeks   | Oct 7-9 (core complete)   |
| 9: UI Polish   | � Started  | 2-3 weeks   | Oct 9+ (ad-hoc)           |
| 10: Testing    | 📋 Planned  | 2-3 weeks   | - (PG Docker CI ready)    |
| 11: Deploy     | 📋 Planned  | 1-2 weeks   | -                         |

**Total Estimated:** 5-6 months (part-time, solo developer)  
**Progress:** ~80% (8 of 12 phases complete, Phase 9 starting) week | 1 day (Oct 7) |
| 8: Remote Sync | 🚧 80% Done | 3-4 weeks | Oct 7-8 (testing remains) |
| 9: UI Polish | 📋 Planned | 2-3 weeks | - |
| 10: Testing | 📋 Planned | 2-3 weeks | - |
| 11: Deploy | 📋 Planned | 1-2 weeks | - |

**Total Estimated:** 5-6 months (part-time, solo developer)  
**Progress:** ~75% (7 of 12 phases complete, Phase 8 nearly done)on FastAPI + SQLite | No backend (Supabase for sync only) |
| **Frontend** | Next.js (React) | SolidJS |
| **Data** | Server database | SQLite WASM (browser) + Supabase (cloud backup) |
| **Practice Logic** | Server-side | Client-side (ts-fsrs library) |
| **Offline** | None (requires internet) | Full offline support |
| **Deployment** | Digital Ocean VPS | Cloudflare Pages (static) |

### Why This Matters

- ✅ **Works offline** - Practice music anywhere, sync when online
- ✅ **Faster** - No server roundtrips, instant UI updates
- ✅ **Cheaper** - No server costs, just Cloudflare + Supabase free tiers
- ✅ **Simpler** - One codebase (browser-only), easier to maintain
- ✅ **More reliable** - Local data never lost, automatic sync

---

## 📊 Progress Overview

```
Phase 0: Setup              ✅ Done
Phase 1: Authentication     ✅ Done
Phase 2: Tune Management    ✅ Done
Phase 3: Practice Sessions  ✅ Done (90% - testing deferred)
Phase 4: UI Layout & Tabs   ✅ Done
Phase 5: Playlists          ✅ Done
Phase 6: Advanced Features  📋 Partially Done (ABC notation complete)
Phase 7: PWA Core Features  ✅ Done (deferred polish to Phase 9)
Phase 8: Remote DB Sync     ✅ Done (core sync working, testing deferred)
Phase 9: UI Polish          � IN PROGRESS ← CURRENT FOCUS
Phase 10: Testing           📋 Not Started
Phase 11: Deployment        📋 Not Started
```

**Current Phase:** Phase 9 (UI Polish & Additional Features)  
**Overall Progress:** ~80% (8 of 12 phases complete, Phase 9 starting)

---

## 🏗️ Architecture (Simple View)

### Legacy Architecture

```
User → Next.js Frontend → FastAPI Backend → SQLite Database
       (React)            (Python)           (Server file)
```

**Problem:** Requires internet. Backend needed for everything.

### PWA Architecture

```
User → SolidJS App → SQLite WASM (Browser)
                           ↓ (background sync)
                     Supabase (Cloud backup)
```

**Benefit:** Everything runs in browser. Supabase only for sync + auth.

### Key Insight for Practice Sessions

In the legacy app:

- User rates tune → POST to server → Python calculates next review → Returns result

In the PWA:

- User rates tune → ts-fsrs calculates in browser → Saves to local SQLite → Queues sync → Done!

**No server-side practice logic needed!**

---

## 📋 Phase Breakdown

### Phase 0: Project Setup ✅ COMPLETE

**Goal:** Get SolidJS + Supabase + Drizzle working together

**What Was Done:**

- Created SolidJS project with Vite
- Set up Supabase account and PostgreSQL database
- Installed Drizzle ORM for both SQLite WASM and PostgreSQL
- Configured development environment

**Key Decisions:**

- Using Cloudflare Pages for deployment (free tier)
- Same repo, branch `feat/pwa1` (legacy code moved to `legacy/`)
- Drizzle ORM for type-safe database queries

---

### Phase 1: Core Authentication ✅ COMPLETE

**Goal:** Users can log in and their session persists

**What Was Done:**

- Integrated Supabase Auth (email/password + OAuth)
- Created SolidJS AuthContext for session management
- Protected routes (can't access app without login)
- Login/logout UI
- Database initializes on login, clears on logout

**Replaced:**

- NextAuth v5 → Supabase Auth
- Server sessions → Client-side token management

---

### Phase 2: Tune Management ✅ COMPLETE

**Goal:** Complete tune library feature (create, edit, view, delete tunes)

**What Was Done:**

1. **Database Schema**

   - Defined tune tables in Drizzle (tune, playlist, playlist_tune, note, reference, tag)
   - Set up SQLite WASM persistence (stores in browser IndexedDB)

2. **CRUD Operations**

   - Create new tunes (form validation)
   - Read/display tunes (table view with TanStack Solid Table)
   - Update existing tunes (edit page)
   - Delete tunes (soft delete)

3. **Offline-First Sync**

   - All changes save to local SQLite immediately (instant UI)
   - Background worker syncs to Supabase every 30 seconds
   - Sync queue tracks pending changes
   - Worker starts on login, stops on logout

4. **UI Migration**
   - Changed from card grid → table-based design
   - TanStack Solid Table (replaces React Table)
   - Responsive, sortable columns
   - Row selection, virtual scrolling

**Key Achievement:** Full offline support! Users can add/edit tunes without internet, sync happens automatically later.

**Files Created:**

- `src/lib/db/schema.ts` - Database tables
- `src/lib/db/queries/tunes.ts` - Query functions
- `src/lib/sync/service.ts` - Background sync worker
- `src/routes/tunes.tsx` - Tune list page
- `src/routes/tunes/[id]/edit.tsx` - Edit page

---

### Phase 3: Practice Session Management 🚧 IN PROGRESS (65% Complete)

**Goal:** Users can practice tunes with spaced repetition scheduling

**Status:** Database + FSRS service ready, need UI + workflow

#### What's Done ✅

1. **FSRS Library Integration**

   - Installed `ts-fsrs` (v5.2.3) - client-side spaced repetition
   - Created FSRSService wrapper class

2. **Database Schema**

   - Practice record table (stores each practice session)
   - User preferences table (FSRS settings)
   - Daily practice queue table (frozen daily plan)

3. **TypeScript Types**

   - Practice record interfaces
   - FSRS state enums (New, Learning, Review, Relearning)
   - Rating enums (Again, Hard, Good, Easy)

4. **FSRS Service**

   - Calculate next review dates using FSRS algorithm
   - Support for first-time reviews
   - Support for repeat reviews with history
   - Goal-based scheduling (recall, fluency, etc.)

5. **Database Migration**
   - Migrated 435 practice queue records to Supabase
   - Created 3 database views (practice_list_joined, etc.)

#### What's Left 🚧

1. **Practice Queue Queries** (Next!)

   - Query local SQLite for due tunes
   - Build practice queue from local data
   - Get latest practice history for FSRS

2. **Practice Recording Service**

   - Handle rating submissions (Again/Hard/Good/Easy)
   - Calculate next review with FSRS
   - Save to local SQLite
   - Queue for sync

3. **Practice Session UI**

   - Display due tunes
   - Rating buttons
   - Progress tracking
   - Session summary

4. **Daily Queue Generation**

   - Build frozen daily practice plan
   - Classify tunes into buckets (Due Today, Lapsed, Backfill)

5. **Practice History View**

   - Table showing past practice sessions
   - Sortable by date, quality, tune

6. **Testing** ⏳ IN PROGRESS
   - ✅ Manual practice workflow tested
   - ⏳ Practice recording service verification
   - ⏳ Offline practice testing
   - 🔜 Unit tests for FSRS calculations
   - 🔜 E2E tests for practice workflow

**TODO:** Complete comprehensive testing before Phase 4:

- Finish Test 2-5 from `_notes/task-12-testing-guide.md`
- Create unit tests for FSRS service
- Port E2E tests from legacy

**Key Insight:** All practice logic runs in browser! No server needed. User rates tune → FSRS calculates → Saves locally → Syncs later.

**Reference Documents:**

- `_notes/phase-3-pwa-practice-plan.md` - Detailed task breakdown (with code examples)
- `_notes/task-12-testing-guide.md` - Testing guide with manual + automated tests
- `docs/practice_flow.md` - Legacy practice flow (for business logic reference)

---

### Phase 4: Main UI Layout & Navigation ✅ COMPLETE

**Goal:** Establish the core UI structure with tabs and side panel (matches legacy app layout)

**Why This Was Critical:**
User expressed concern: "I don't see the UI structure coming together." Needed visual confirmation that PWA matches legacy design **before** building more features. Moved from Phase 7 (Polish) to Phase 4 (High Priority).

**What Was Built:**

1. **Main Layout Component** (`src/components/layout/MainLayout.tsx`)

   - Top navigation bar (app logo, user email, logout button)
   - Left sidebar with collapsible panels:
     - References panel (placeholder - TODO: load from `reference` table)
     - Notes panel (placeholder - TODO: load from `note` table)
   - Main content area with tab navigation
   - Sidebar collapse state saved to localStorage (TODO: migrate to DB)
   - Responsive: sidebar auto-collapses on mobile

2. **Tab Navigation System** (`src/components/layout/TabBar.tsx`)

   - 🎯 **Practice Tab** (`/practice`) - Spaced repetition queue (existing)
   - 📚 **Repertoire Tab** (`/repertoire`) - Tune table with practice status
   - 📖 **Catalog Tab** (`/catalog`) - Full tune database with CRUD
   - 📊 **Analysis Tab** (`/analysis`) - Placeholder for charts/stats
   - Active tab detection via URL pathname
   - TODO: Persist active tab to `tab_group_main_state` table

3. **Route Pages**

   - `src/routes/repertoire.tsx` - Repertoire with "Add To Review" button (TODO: implement)
   - `src/routes/catalog.tsx` - Full catalog with "Add Tune" button
   - `src/routes/analysis.tsx` - Placeholder with feature cards (build in Phase 6)

4. **Router Configuration** (`src/App.tsx`)

   - All main routes wrapped in `<MainLayout>` wrapper
   - Added routes: `/repertoire`, `/catalog`, `/analysis`
   - Protected routes use `<ProtectedRoute>` + `<MainLayout>` pattern

5. **State Persistence Queries** (`src/lib/db/queries/tab-state.ts`)
   - `getTabState(db, userId)` - Fetch active tab from database
   - `saveActiveTab(db, userId, tabId)` - Save active tab to database
   - TODO: Integrate with TabBar component

**Ported from Legacy:**

- Layout structure from `legacy/frontend/app/(main)/layout.tsx`
- Tab navigation pattern from `legacy/frontend/components/TabGroup.tsx`
- Visual design from user-provided screenshots

**Completion Status:**

- ✅ Main layout with sidebar + content area visible
- ✅ 4 tabs (Practice, Repertoire, Catalog, Analysis) created
- ✅ Sidebar collapsible, state persists (localStorage)
- ✅ Router configuration complete
- ✅ Database queries created for tab persistence
- ⏳ Visual verification pending (load app and compare to screenshots)
- ⏳ Tab persistence integration pending (connect queries to TabBar)
- ⏳ Sidebar content loading pending (references/notes from DB)

**See:** `_notes/phase-4-completion-summary.md` for detailed documentation

---

### Phase 5: Playlist Management ✅ COMPLETE

**Goal:** Users can create and manage multiple playlists

**What Was Built:**

1. **Database Schema Updates**

   - Added `name` column to playlist table (e.g., "My Irish Tunes")
   - Added `genreDefault` column (FK to genre table)
   - Generated migration `0001_thin_chronomancer.sql`
   - Updated both SQLite and PostgreSQL schemas

2. **CRUD Operations** (`src/lib/db/queries/playlists.ts`)

   - `getUserPlaylists()` - Get all user playlists with tune counts
   - `createPlaylist()` - Create new playlist with name + genre
   - `updatePlaylist()` - Update existing playlist
   - `deletePlaylist()` - Soft delete playlist
   - Playlist-tune association queries (add/remove tunes)

3. **UI Components**

   - **PlaylistEditor** - Form with name (required), genre dropdown, SR algorithm
   - **PlaylistList** - Sortable table showing ID, Name, Genre, Instrument, Algorithm, etc.
   - **PlaylistSelector** - Dropdown for practice page (shows playlist names)

4. **Route Pages**

   - `/playlists` - Playlist list with search and create button
   - `/playlists/new` - Create new playlist page
   - `/playlists/:id/edit` - Edit existing playlist page

5. **Service Layer**
   - Default playlist creation ("My Tunes") for new users
   - Ensures every user has at least one playlist

**Key Decisions:**

- Playlists are named "repertoire lists" (not tied 1:1 with instruments)
- Instrument field disabled (deferred for future feature)
- Genre default is optional (can be null)
- Name required in UI, nullable in database (shows "Untitled" fallback)

**Bugs Fixed:**

- Missing schema columns in migration (fixed with Drizzle Kit)
- `getUserPlaylists()` not selecting `name` and `genreDefault` fields
- Used `??` instead of `||` for nullish coalescing

**Testing:**

- Playwright browser automation (navigated, filled form, verified display)
- Screenshot evidence of bug and fix
- Console log validation of data saving correctly

**See:** `_notes/phase-5-completion-summary.md` for detailed documentation

---

### Phase 6: Advanced Tune Features 📋 NEXT

**Goal:** Rich tune metadata and editing

**Planned Features:**

1. **Music Notation Rendering**

   - Integrate abcjs library for ABC notation display
   - Wrap in SolidJS component with reactive updates
   - Display on tune detail pages and practice sessions

2. **Rich Text Notes Editor**

   - Integrate jodit editor for practice notes
   - Support markdown and HTML formatting
   - Auto-save to local SQLite
   - Sync to Supabase

3. **Tags System**

   - Add/remove tags from tunes
   - Tag management UI (create, edit, delete tags)
   - Filter tunes by tags
   - Tag cloud visualization

4. **External References/Links**

   - Add URLs to external resources (YouTube, sheet music, etc.)
   - Display in sidebar "References" panel
   - Click to open in new tab
   - Track reference metadata (title, description, URL)

5. **Enhanced Search & Filtering**

   - Search by title, composer, incipit, tags
   - Multi-select filters (type, mode, genre)
   - Saved search presets
   - Search history

6. **Bulk Operations**
   - Select multiple tunes
   - Bulk add to playlist
   - Bulk tag assignment
   - Bulk delete
   - Export selected tunes (JSON, CSV)

**Technical Approach:**

- Use `createResource` for async data loading
- Wrap external libraries (abcjs, jodit) in SolidJS components
- Implement `onCleanup` for proper library disposal
- Use TanStack Table for bulk selection UI

**Why Now:** Playlists complete, practice workflow functional, time to enhance tune management experience

---

### Phase 7: PWA Features (Core Infrastructure) ✅ COMPLETE

**Status:** ✅ **COMPLETE** (October 7, 2025)  
**Completed:** 2/2 core tasks

**Completed Features:**

- ✅ **Task 1: Service Worker & Offline Support**

  - Service worker with Workbox (vite-plugin-pwa)
  - Offline support (31 files precached including WASM + SQL)
  - PWA manifest (installable app)
  - Lighthouse Best Practices: 100/100
  - SQLite WASM offline initialization

- ✅ **Task 2: Offline Indicator Component**
  - Offline indicator integrated into TopNav (status badge with hover tooltip)
  - Real-time sync status monitoring (polls every 5 seconds)
  - Network status detection (online/offline events)
  - Professional, non-intrusive design

**Deferred Tasks** (Post-MVP - Not Critical for Core Functionality):

- 📋 Task 3: Install prompt ("Add to Home Screen") - Users can still install manually
- 📋 Task 4: Sync status display enhancements (manual sync button) - Auto-sync works fine
- 📋 Task 5: Cache management UI - Advanced feature, not needed initially
- 📋 Task 6: App update notifications - Auto-update works, custom UI optional
- 📋 Task 7: Push notifications (practice reminders) - Future enhancement

**Decision:** Core PWA infrastructure is production-ready. Additional polish features deferred until post-deployment to focus on critical Path: Remote DB Sync.

**See:** `_notes/phase-7-pwa-features-plan.md` for detailed task documentation

---

### Phase 8: Remote DB Sync 📋 NEXT (HIGH PRIORITY)

**Status:** 📋 **NOT STARTED**  
**Priority:** 🔴 **CRITICAL** - Blocks deployment

**Goal:** Implement bidirectional sync between local SQLite WASM and Supabase PostgreSQL

**Why Critical:** Current app is offline-only! No data persistence to cloud, no multi-device sync, no backup. This is the missing piece for production deployment.

**Planned Tasks:**

1. **Clean up Supabase PostgreSQL schema**

   - Match Drizzle schema structure exactly
   - Add sync metadata columns (sync_version, last_modified_at)
   - Create necessary indexes for sync queries
   - Set up Row Level Security (RLS) policies

2. **Data migration script**

   - Script to migrate legacy SQLite → Supabase PostgreSQL
   - Transform legacy schema to new Drizzle structure
   - Handle ID mapping (legacy int IDs → UUIDs)
   - Validate data integrity after migration

3. **Test data migration**

   - Migrate `tunetrees_test_clean.sqlite3` to new structure
   - Create test user accounts in Supabase
   - Verify all relationships intact
   - Load migrated data into local SQLite for testing

4. **Implement sync engine**

   - Bidirectional sync service (SQLite ↔ Supabase)
   - Conflict resolution strategy (last-write-wins with user override)
   - Change tracking (detect local vs remote changes)
   - Batch sync operations (optimize network usage)
   - Error handling and retry logic
   - Sync queue processing (from existing queue table)

5. **Testing & Validation**
   - Unit tests for sync logic
   - E2E tests for multi-device scenarios
   - Conflict resolution testing
   - Offline → Online sync testing
   - Performance testing (large datasets)

**Estimated Duration:** 3-4 weeks  
**Dependencies:** Phase 7 complete ✅

**Success Criteria:**

- [ ] Supabase schema matches Drizzle SQLite schema
- [ ] Legacy data successfully migrated to Supabase
- [ ] Test database operational with migrated data
- [ ] Sync engine syncs changes bidirectionally
- [ ] Conflicts resolved without data loss
- [ ] Works offline → online seamlessly
- [ ] Multi-device sync tested and working
- [ ] All sync tests passing

**See:** `_notes/phase-8-remote-sync-plan.md` (to be created)

---

### Phase 9: UI Polish & Additional Features 📋 NOT STARTED

**Goal:** Professional look and feel (Post-Deployment Polish)

**Planned Features:**

- shadcn-solid component library (consistent UI)
- Dark mode enhancements
- Dashboard/home page improvements
- Settings pages expansion
- Navigation improvements
- Animations and transitions
- Accessibility (ARIA labels, keyboard navigation)
- PWA install prompt UI (Task 3 from Phase 7)
- Sync status enhancements (Task 4 from Phase 7)
- Cache management UI (Task 5 from Phase 7)
- App update notifications UI (Task 6 from Phase 7)

**Why After Phase 8:** Need working sync before polishing UI

---

### Phase 10: Testing & QA 📋 NOT STARTED

**Goal:** Ensure reliability and quality before production deployment

**Status:** 📋 **PLANNED** - Two-tier testing strategy with PostgreSQL Docker for CI

**Testing Strategy:**

**Tier 1: Unit Tests (Fast)**

- Vitest + Solid Testing Library
- SQLite WASM (in-memory, no Docker)
- Run on every commit (< 5 seconds)
- Focus: Sync logic, FSRS algorithm, UI components

**Tier 2: Integration Tests (Comprehensive)**

- Playwright E2E tests
- PostgreSQL Docker + SQLite WASM
- Run on PR + main branch (2-5 minutes)
- Focus: Full sync cycle, multi-device scenarios, conflict resolution

**Why PostgreSQL Docker?**

- ✅ No Supabase test instance needed (cost, cleanup, parallel test issues)
- ✅ Tests real PostgreSQL features (DISTINCT ON, etc.)
- ✅ GitHub Actions native Docker support
- ✅ Reuses existing migration script for seeding
- ✅ Easy cleanup (destroy container after tests)

**Planned Testing:**

- Unit tests (sync queue, conflict detection, FSRS calculations)
- E2E tests (Playwright with PostgreSQL Docker)
- Offline mode testing (service worker simulation)
- Sync conflict testing (last-write-wins verification)
- Multi-device sync testing (simulated with multiple browser contexts)
- Performance testing (60 FPS target, < 3s load time)
- Cross-browser testing (Chrome in CI, Safari/Firefox/Edge manual)
- Mobile responsiveness (Playwright device emulation)

**Implementation Plan:**

See detailed plan: **`_notes/phase-10-postgresql-docker-testing-plan.md`**

**Key Tasks:**

1. Create test seed script (reuse migration script)
2. Add PostgreSQL service to GitHub Actions workflow
3. Mock Supabase client for CI tests (skip Realtime)
4. Create sync integration tests (multi-device, conflicts)
5. Enhance unit tests for sync logic (100% coverage goal)
6. Add local Docker testing script for developers

**Why Before Deployment:** Need stable, tested sync before migrating users

---

### Phase 11: Migration & Deployment 📋 NOT STARTED

**Goal:** Move users from legacy app to PWA

**Planned Steps:**

1. Data migration script (SQLite → Supabase PostgreSQL)
2. User migration plan (email notifications)
3. Parallel deployment (run both versions temporarily)
4. Gradual rollout (beta users first)
5. Monitoring & error tracking
6. Rollback plan if needed

**Why Last:** Need stable app before migrating users

---

## 🎯 Current Focus (Phase 8: Remote DB Sync)

**Status:** � **80% COMPLETE** - Sync engine implemented, testing next!

**Completed This Week - Phase 8 Tasks:**

1. **✅ Clean up Supabase PostgreSQL schema**

   - Schema already matched Drizzle perfectly!
   - All sync metadata columns present
   - RLS policies configured (65 policies)

2. **✅ Data migration script**

   - Created `scripts/migrate-production-to-supabase.ts` (1470 lines)
   - Handles all schema differences (boolean→int4, etc.)
   - TRUNCATE-based cleanup for safe re-runs
   - All 19 tables + 3 views migrated

3. **✅ Migrate production database**

   - `tunetrees_production_manual.sqlite3` → Supabase ✅
   - 534 tunes, 23,896 practice records, 522 playlist-tune relationships
   - All foreign key relationships intact
   - Verification passed

4. **✅ Implement sync engine**

   - `src/lib/sync/engine.ts` (500 lines) - syncUp/syncDown
   - `src/lib/sync/conflicts.ts` (230 lines) - conflict resolution
   - `src/lib/sync/realtime.ts` (250 lines) - Supabase Realtime
   - Unit tests created (engine.test.ts, conflicts.test.ts)
   - Background worker integration complete

5. **📋 Testing** ← NEXT!
   - Multi-device sync scenarios
   - Offline → Online sync
   - Conflict resolution edge cases
   - Integration tests with real Supabase

**Detailed Plan:** `_notes/phase-8-remote-sync-plan.md`

---

## 📅 Timeline

| Phase          | Status     | Estimated | Actual                      |
| -------------- | ---------- | --------- | --------------------------- |
| 0: Setup       | ✅ Done    | 1-2 weeks | 1 day (Oct 4-5)             |
| 1: Auth        | ✅ Done    | 1-2 weeks | 1 day (Oct 5)               |
| 2: Tunes       | ✅ Done    | 2-3 weeks | 1 day (Oct 5)               |
| 3: Practice    | ✅ Done    | 2-3 weeks | In progress (started Jan 9) |
| 4: UI Layout   | ✅ Done    | 1-2 weeks | 1 day (Oct 6)               |
| 5: Playlists   | ✅ Done    | 2-3 weeks | 1 day (Oct 6)               |
| 6: Advanced    | � Partial  | 2-3 weeks | 1 task done (Oct 7)         |
| 7: PWA Core    | ✅ Done    | 1 week    | 1 day (Oct 7)               |
| 8: Remote Sync | 🚧 Current | 3-4 weeks | Starting now                |
| 9: UI Polish   | 📋 Planned | 2-3 weeks | -                           |
| 10: Testing    | 📋 Planned | 2-3 weeks | -                           |
| 11: Deploy     | 📋 Planned | 1-2 weeks | -                           |

**Total Estimated:** 5-6 months (part-time, solo developer)  
**Progress:** ~58% (7 of 12 phases complete, Phase 8 critical path)

---

## 🔑 Key Technical Decisions

### SQLite WASM Implementation

**Choice:** `sql.js` (2MB bundle, mature)  
**Why:** Stability over bundle size. Can optimize later.

### Sync Strategy

**Choice:** Optimistic UI + background worker (30-second intervals)  
**Why:** Instant UI updates, reliable eventual consistency

### Deployment

**Choice:** Cloudflare Pages  
**Why:** Free tier, fast edge network, perfect for static PWA

### Current Domain Strategy

**Choice:** Start with Cloudflare subdomain (`tunetrees-pwa.pages.dev`)  
**Why:** Keep legacy app running during beta testing

---

## 📚 Important Documents

### Core Plans

- **This file** - Overall migration roadmap
- `_notes/phase-3-pwa-practice-plan.md` - Detailed Phase 3 tasks (with code)
- `.github/copilot-instructions.md` - Coding guidelines for Copilot

### Reference (Legacy Code)

- `legacy/tunetrees/app/schedule.py` - Practice scheduling logic
- `legacy/tunetrees/app/queries.py` - Database queries
- `legacy/frontend/` - React UI patterns
- `docs/practice_flow.md` - Practice workflow documentation

### Migration Guides

- `.github/instructions/database.instructions.md` - Database rules
- `.github/instructions/ui-development.instructions.md` - UI patterns
- `.github/instructions/testing.instructions.md` - Test guidelines

---

## ✅ Success Criteria

**Phase 8 Complete When:**

- [ ] Supabase PostgreSQL schema matches Drizzle SQLite schema
- [ ] Sync metadata columns added (sync_version, last_modified_at)
- [ ] Legacy test data migrated to Supabase successfully
- [ ] Test users can log in and see their data
- [ ] Sync engine syncs local changes to Supabase
- [ ] Sync engine pulls remote changes to local SQLite
- [ ] Conflicts resolved without data loss (last-write-wins)
- [ ] Offline → Online sync tested and working
- [ ] Multi-device sync tested (changes propagate)
- [ ] All sync tests passing

**Overall Project Complete When:**

- [ ] All 11 phases done
- [ ] Feature parity with legacy app
- [ ] All users migrated
- [ ] Legacy app shut down
- [ ] Zero data loss
- [ ] Performance targets met (< 3s load, 60 FPS)
- [ ] Multi-device sync reliable and tested

---

## 🚧 Known Issues & Risks

### Current Issues

- Migration plan document header was corrupted (FIXED)
- Todo list slightly out of sync with plan (updating now)

### Technical Risks

1. **SQLite WASM Performance** - Mitigation: Benchmark early, optimize queries
2. **Sync Conflicts** - Mitigation: Clear conflict UI, last-write-wins strategy
3. **Offline Data Loss** - Mitigation: Regular Supabase backups, export functionality
4. **Bundle Size** - Mitigation: Code splitting, lazy loading

### Business Risks

1. **User Migration Friction** - Mitigation: Seamless data migration, clear communication
2. **Feature Gaps** - Mitigation: Feature checklist, beta testing
3. **Supabase Lock-in** - Mitigation: Abstract sync layer, portable PostgreSQL schema

---

## 📝 Version History

### v4.0 (October 7, 2025) - Current

- **Phase restructuring approved:** Inserted Phase 8 (Remote DB Sync) as critical path
- **Renumbered phases:** Old Phase 7 → Phase 8, Phase 8 → Phase 9, etc.
- **Deferred Phase 7 polish:** Tasks 3-7 moved to Phase 9 (post-deployment)
- **Marked Phase 7 complete:** Core PWA infrastructure done (service worker + offline indicator)
- **Updated timeline:** Phase 8 now current focus (3-4 week estimate)
- **Critical discovery documented:** No sync engine = deployment blocker

### v3.0 (January 10, 2025)

- **Major simplification:** Removed code examples, made plan more readable
- **Clarified Phase 3:** Emphasized client-side practice logic (no server)
- **Better structure:** Clear status, progress, next steps
- **Single source of truth:** This is the canonical plan

### v2.0 (October 5, 2025)

- Restructured to feature-focused approach
- Marked Phases 0-2 complete
- Updated timeline with actual progress

### v1.0 (October 4, 2025)

- Initial plan with architecture-focused approach
- 8 phases, layer-by-layer migration

---

**Maintained By:** GitHub Copilot (per user @sboagy)  
**Next Update:** After Phase 3 completion
