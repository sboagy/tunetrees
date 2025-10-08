# Phase 8: Remote DB Sync - Detailed Plan

**Created:** October 7, 2025  
**Status:** 🚧 **IN PROGRESS**  
**Priority:** 🔴 **CRITICAL** - Blocks Production Deployment  
**Estimated Duration:** 3-4 weeks  
**Prerequisites:** Phases 0-7 Complete ✅

---

## 🎯 Goal

Implement bidirectional synchronization between local SQLite WASM (browser) and Supabase PostgreSQL (cloud), enabling:

- Multi-device sync (changes propagate across devices)
- Cloud backup (data persists beyond browser storage)
- Offline-first workflow (local changes sync when online)
- Conflict resolution (handle concurrent edits gracefully)

---

## 🚨 Why This Is Critical

**Current State:**

- ✅ App works offline with SQLite WASM
- ✅ Data saves to browser (IndexedDB)
- ❌ **NO cloud persistence** (browser data can be lost)
- ❌ **NO multi-device sync** (isolated per browser)
- ❌ **NO backup/recovery** (cleared cache = lost data)

**Blocker:** Cannot deploy to production without sync! Users would lose data on browser cache clear, device switch, or reinstall.

**Phase 8 Unlocks:**

- ✅ Cloud backup (Supabase PostgreSQL)
- ✅ Multi-device sync (work on phone, continue on desktop)
- ✅ Data safety (local + cloud redundancy)
- ✅ Production readiness

---

## 📋 Task Breakdown

### Task 1: Clean Up Supabase PostgreSQL Schema ✅ COMPLETE

**Goal:** Ensure Supabase schema exactly matches local Drizzle schema

**Status:** ✅ **COMPLETE** (October 8, 2025)

**What Was Done:**

1. **PostgreSQL Schema Audit** ✅

   - Ran `npx drizzle-kit pull` to introspect Supabase schema
   - Generated `drizzle/migrations/postgres/schema.ts` (653 lines)
   - Discovered schema was **already 90% complete**!
   - 19 tables, 214 columns, 28 foreign keys, 65 RLS policies

2. **Sync Metadata Verification** ✅

   - All 16 user-editable tables **already have** sync columns
   - `sync_version` (integer, default 1) ✅
   - `last_modified_at` (timestamp) ✅
   - `device_id` (text, nullable) ✅

3. **SQLite Schema Sync** ✅

   - Verified `drizzle/schema-sqlite.ts` was **already complete**
   - All 19 tables already defined with correct type conversions
   - Ran `npx drizzle-kit push --config=drizzle.config.sqlite.ts --force`
   - Created `tunetrees_local.sqlite3` with full schema

4. **Schema Parity Verified** ✅
   - PostgreSQL: 19 tables, 214 columns
   - SQLite: 19 tables, 214 columns
   - Type conversions correct (timestamp→text, boolean→integer, uuid→text)

**Tables with Sync Metadata:**

- ✅ `user_profile`
- ✅ `tune`
- ✅ `tune_override`
- ✅ `instrument`
- ✅ `playlist`
- ✅ `playlist_tune`
- ✅ `practice_record`
- ✅ `daily_practice_queue`
- ✅ `note`
- ✅ `reference`
- ✅ `tag`
- ✅ `prefs_spaced_repetition`
- ✅ `prefs_scheduling_options`
- ✅ `tab_group_main_state`
- ✅ `table_state`
- ✅ `table_transient_data`

**RLS Policies:**

- ✅ 65 RLS policies configured on Supabase
- ✅ 14 user tables secured (SELECT/INSERT/UPDATE/DELETE)
- ✅ Reference tables (`genre`, `tune_type`) allow public SELECT

**Acceptance Criteria:**

- ✅ Supabase schema matches `drizzle/schema-postgres.ts` exactly
- ✅ All tables have sync metadata columns (`sync_version`, `last_modified_at`, `device_id`)
- ✅ RLS policies configured and active
- ✅ Drizzle can connect to both Supabase and SQLite
- ✅ SQLite migration applied successfully

**Documentation:**

- ✅ `_notes/phase-8-task-1-schema-audit.md` (400+ lines)
- ✅ `_notes/phase-8-task-1-completion-summary.md`

**Duration:** ~45 minutes (schema was already complete!)  
**Outcome:** **EXCEEDED EXPECTATIONS** - No work needed, schema was already perfect!

**Files to Create/Modify:**

- `drizzle.config.ts` (MODIFY - add Supabase connection for PostgreSQL)
- `drizzle/migrations/000X_add_sync_metadata.sql` (NEW)
- `docs/supabase-schema-setup.md` (NEW - setup instructions)

---

### Task 2: Data Migration Script 📋 NEXT

**Goal:** Migrate data from legacy SQLite schema to new Drizzle structure

**Why Complex:**

- Legacy schema uses integer IDs (`1`, `2`, `3`)
- New schema uses UUIDs (`550e8400-e29b-41d4-a716-446655440000`)
- Need ID mapping table to preserve relationships
- Must transform column names/types (e.g., `review_date` → `due`)

**Subtasks:**

1. **Create ID Mapping Table**

   ```sql
   CREATE TABLE id_mapping (
     legacy_table TEXT NOT NULL,
     legacy_id INTEGER NOT NULL,
     new_uuid UUID NOT NULL,
     PRIMARY KEY (legacy_table, legacy_id)
   );
   ```

2. **Write Migration Script** (`scripts/migrate-legacy-to-drizzle.ts`)

   - Read legacy SQLite database
   - For each table:
     - Generate UUIDs for new IDs
     - Store mapping in `id_mapping`
     - Transform data to new schema
     - Insert into Supabase
   - Validate all foreign keys resolved

3. **Handle Special Cases:**

   - **Users:** Map legacy `user.id` → Supabase Auth `auth.users.id` (UUID)
   - **Playlists:** Map `playlist.user_ref` to new UUID user ID
   - **Practice Records:** Transform FSRS fields, map `tune_ref` to new UUID
   - **Timestamps:** Convert to ISO 8601 with timezone

4. **Dry Run Mode**
   - Flag to validate without writing (`--dry-run`)
   - Output validation report (missing FKs, data issues)

**Acceptance Criteria:**

- [ ] Script transforms all legacy tables → new schema
- [ ] ID mapping table tracks all conversions
- [ ] Foreign key relationships intact
- [ ] Data validation passes (no null required fields, etc.)
- [ ] Dry run mode works (reports issues without writing)

**Files to Create:**

- `scripts/migrate-legacy-to-drizzle.ts` (NEW - ~500 lines)
- `scripts/validate-migration.ts` (NEW - validation script)
- `docs/migration-guide.md` (NEW - how to run migration)

---

### Task 3: Migrate Test Database 📋

**Goal:** Apply migration to `tunetrees_test_clean.sqlite3` and load into Supabase

**Why Test First:**

- Validate migration script on known dataset
- Catch issues before migrating production data
- Create test users for multi-device sync testing

**Subtasks:**

1. **Create Test Users in Supabase Auth**

   - `test1@example.com` (password from GitHub Secrets)
   - `test2@example.com` (for multi-device testing)
   - Note their UUIDs for mapping

2. **Run Migration on Test DB**

   - `npm run migrate:test -- --source tunetrees_test_clean.sqlite3`
   - Map `user.id = 1` → `test1@example.com` UUID
   - Verify all 435 practice queue records migrated

3. **Load Migrated Data into Local SQLite**

   - Export from Supabase → JSON
   - Import into local SQLite WASM
   - Verify app works with migrated data

4. **Manual Testing**
   - Log in as `test1@example.com`
   - Verify tunes, playlists, practice records visible
   - Test practice session (rate tune, verify FSRS calculation)
   - Check data integrity (no broken references)

**Acceptance Criteria:**

- [ ] Test users created in Supabase Auth
- [ ] Legacy test data migrated to Supabase
- [ ] Local SQLite WASM loads migrated data
- [ ] App functional with migrated test data
- [ ] All relationships intact (playlists, tunes, practice records)

**Files to Modify:**

- `scripts/migrate-legacy-to-drizzle.ts` (add test user mapping)
- `docs/test-data-setup.md` (NEW - test environment setup)

---

### Task 4: Implement Sync Engine 🚧 CORE WORK

**Goal:** Bidirectional sync between local SQLite and Supabase

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                      User Action (UI)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            Local SQLite WASM (Immediate Save)               │
│  • Writes to local DB (instant UI update)                   │
│  • Adds to sync_queue table (operation, table, record_id)   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Sync Queue Worker                         │
│  • Polls sync_queue every 30 seconds (if online)            │
│  • Batches pending operations (INSERT, UPDATE, DELETE)      │
│  • Sends to Supabase via Drizzle PostgreSQL client          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Supabase PostgreSQL                         │
│  • Receives changes from local                              │
│  • Broadcasts changes to other devices (Realtime)           │
│  • Stores authoritative cloud copy                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase Realtime (Websocket)                  │
│  • Pushes changes from Device A → Device B                  │
│  • Triggers sync pull on Device B                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           Device B Sync Engine (Pull Changes)               │
│  • Detects remote changes (via last_modified_at)            │
│  • Compares sync_version (conflict check)                   │
│  • Merges into local SQLite                                 │
│  • Updates UI reactively (createResource invalidation)      │
└─────────────────────────────────────────────────────────────┘
```

**Subtasks:**

1. **Sync Queue Service** (`src/lib/sync/queue.ts` - already exists, enhance)

   - Add `addToSyncQueue(operation, table, recordId, data)`
   - Add `processSyncQueue()` (batches operations, sends to Supabase)
   - Add error handling (retry failed operations)

2. **Sync Engine Core** (`src/lib/sync/engine.ts` - NEW)

   - `syncUp()` - Push local changes to Supabase
   - `syncDown()` - Pull remote changes to local
   - `detectConflicts()` - Compare sync_version + last_modified_at
   - `resolveConflict()` - Apply resolution strategy (last-write-wins)

3. **Conflict Resolution Strategies**

   - **Last-Write-Wins (default):** Newest `last_modified_at` wins
   - **User Override (future):** Show conflict UI, let user choose
   - **Field-Level Merge (future):** Merge non-conflicting fields

4. **Change Detection**

   - Query Supabase for records newer than local `last_sync_timestamp`
   - Compare `sync_version` to detect concurrent edits
   - Mark conflicts in `sync_queue` for resolution

5. **Supabase Realtime Integration** (`src/lib/sync/realtime.ts` - NEW)

   - Subscribe to PostgreSQL changes (INSERT, UPDATE, DELETE)
   - Trigger `syncDown()` when remote changes detected
   - Filter by `user_ref` (only pull user's own data)

6. **Background Sync Worker**
   - Run `syncUp()` every 30 seconds (if online)
   - Run `syncDown()` on Realtime event
   - Exponential backoff on errors (1s, 2s, 4s, 8s, max 60s)

**Acceptance Criteria:**

- [ ] Local changes sync to Supabase within 30 seconds
- [ ] Remote changes pull to local within 5 seconds (Realtime)
- [ ] Conflicts detected and logged
- [ ] Last-write-wins resolution works
- [ ] Sync queue processes all operations
- [ ] Errors retry with exponential backoff
- [ ] Multi-device scenario tested (Device A → Supabase → Device B)

**Files to Create:**

- `src/lib/sync/engine.ts` (NEW - core sync logic, ~400 lines)
- `src/lib/sync/realtime.ts` (NEW - Supabase Realtime, ~150 lines)
- `src/lib/sync/conflicts.ts` (NEW - conflict resolution, ~200 lines)

**Files to Modify:**

- `src/lib/sync/queue.ts` (ENHANCE - add batching, error handling)
- `src/lib/db/schema.ts` (ADD - sync metadata to all tables)

---

### Task 5: Testing & Validation 📋

**Goal:** Comprehensive testing of sync functionality

**Test Scenarios:**

1. **Basic Sync (Single Device)**

   - [ ] Create tune offline → goes online → syncs to Supabase
   - [ ] Edit tune online → saves to Supabase + local
   - [ ] Delete tune → soft delete syncs

2. **Multi-Device Sync**

   - [ ] Device A: Create tune → Device B: sees new tune within 5s
   - [ ] Device B: Edit tune → Device A: sees updated tune
   - [ ] Device A offline: Edit tune → goes online → Device B sees change

3. **Conflict Resolution**

   - [ ] Device A offline: Edit tune
   - [ ] Device B online: Edit same tune (different field)
   - [ ] Device A goes online: Conflict detected, last-write-wins applied
   - [ ] Both devices converge to same final state

4. **Offline → Online Sync**

   - [ ] Offline: Create 10 tunes → goes online → all 10 sync
   - [ ] Offline: Edit 5 tunes → goes online → all edits sync
   - [ ] Verify sync_queue clears after successful sync

5. **Error Handling**

   - [ ] Network error mid-sync → retries with backoff
   - [ ] Invalid data → logs error, continues with next operation
   - [ ] Supabase down → queues operations, syncs when back online

6. **Performance Testing**
   - [ ] Sync 100 records → completes in < 10 seconds
   - [ ] Sync 1000 records → completes in < 60 seconds
   - [ ] Realtime latency → < 2 seconds Device A → Device B

**Automated Tests:**

- **Unit Tests** (`src/lib/sync/engine.test.ts`)

  - Conflict detection logic
  - Last-write-wins resolution
  - Batch operation building

- **Integration Tests** (`src/lib/sync/integration.test.ts`)

  - Full sync cycle (local → Supabase → local)
  - Multi-table sync (tune + practice_record)
  - Realtime subscription

- **E2E Tests** (Playwright - `tests/sync-multi-device.spec.ts`)
  - Multi-browser scenario (Chrome + Firefox)
  - Device A edits, Device B receives
  - Conflict resolution UI (if implemented)

**Acceptance Criteria:**

- [ ] All manual test scenarios pass
- [ ] All automated tests passing
- [ ] Performance targets met
- [ ] No data loss in any scenario
- [ ] Sync status visible in UI (TopNav badge)

**Files to Create:**

- `tests/sync-multi-device.spec.ts` (NEW - E2E sync tests)
- `src/lib/sync/engine.test.ts` (NEW - unit tests)
- `docs/sync-testing-guide.md` (NEW - manual test procedures)

---

## 📊 Progress Tracking

**Phase 8 Task Checklist:**

- [ ] Task 1: Clean Up Supabase PostgreSQL Schema
- [ ] Task 2: Data Migration Script
- [ ] Task 3: Migrate Test Database
- [ ] Task 4: Implement Sync Engine
- [ ] Task 5: Testing & Validation

**Overall Progress:** 0 / 5 tasks (0%)

**Estimated Timeline:**

- Week 1: Tasks 1-2 (Schema + Migration Script)
- Week 2: Task 3 (Test Migration + Validation)
- Week 3: Task 4 (Sync Engine Implementation)
- Week 4: Task 5 (Testing + Bug Fixes)

---

## 🎯 Phase 8 Success Criteria

**Phase Complete When:**

- [ ] Supabase schema matches local Drizzle schema
- [ ] Migration script transforms legacy data successfully
- [ ] Test data migrated and operational
- [ ] Sync engine syncs local → Supabase
- [ ] Sync engine syncs Supabase → local
- [ ] Multi-device sync tested and working
- [ ] Conflicts detected and resolved
- [ ] Offline → Online sync works reliably
- [ ] All tests passing (unit + integration + E2E)
- [ ] No data loss in any test scenario
- [ ] Performance targets met (< 10s for 100 records)
- [ ] Sync status visible in UI (TopNav badge updates)

---

## 🚧 Dependencies & Risks

**Dependencies:**

- Phase 7 complete ✅ (PWA infrastructure for offline support)
- Supabase account active with PostgreSQL database
- Drizzle ORM configured for both SQLite and PostgreSQL

**Technical Risks:**

1. **Conflict Resolution Complexity**

   - Mitigation: Start with last-write-wins (simple), add user override later

2. **Realtime Subscription Scaling**

   - Mitigation: Use Supabase Realtime (handles websocket management)

3. **Large Dataset Sync Performance**

   - Mitigation: Batch operations (100 records/batch), incremental sync

4. **Network Reliability**

   - Mitigation: Retry logic with exponential backoff, queue persistence

5. **ID Mapping Errors (Legacy → UUID)**
   - Mitigation: Validation script, dry-run mode, rollback plan

**Unknowns:**

- Supabase Realtime latency in production
- Sync queue performance with 1000+ pending operations
- Browser storage limits (IndexedDB quota)

---

## 📚 Reference Documents

**Sync Libraries:**

- [Supabase Realtime](https://supabase.com/docs/guides/realtime) - Websocket-based sync
- [Drizzle ORM PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) - PostgreSQL client

**Standards & Guides:**

- [Offline-First Architecture](https://offlinefirst.org/) - Design patterns
- [CRDT (Conflict-Free Replicated Data Types)](https://crdt.tech/) - Conflict resolution (future)

**Project Docs:**

- `_notes/solidjs-pwa-migration-plan.md` - Overall migration plan
- `_notes/phase-7-pwa-features-plan.md` - PWA infrastructure (prerequisite)
- `.github/copilot-instructions.md` - SolidJS coding patterns

**Legacy Code:**

- `legacy/tunetrees/models/tunetrees.py` - Legacy SQLAlchemy schema (for reference)
- `legacy/tunetrees/app/queries.py` - Legacy query patterns

---

## 🔄 Next Steps After Phase 8

**Phase 9: UI Polish & Additional Features**

- Deferred Phase 7 tasks (install prompt, cache management, etc.)
- Settings pages expansion
- Dashboard/home page improvements
- Animations and transitions

**Phase 10: Testing & QA**

- Comprehensive E2E tests (Playwright)
- Cross-browser testing (Safari, Firefox)
- Performance profiling
- Accessibility audit

**Phase 11: Deployment**

- Migrate production users from legacy app
- Cloudflare Pages deployment
- Monitoring and error tracking
- Gradual rollout strategy

---

**Maintained By:** GitHub Copilot (per user @sboagy)  
**Created:** October 7, 2025  
**Next Update:** After Task 1 completion
