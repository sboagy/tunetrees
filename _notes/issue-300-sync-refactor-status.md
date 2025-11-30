# Issue #300: Sync Refactor - Implementation Status

**Branch:** `fix/sync`  
**Plan:** `_notes/issue-300-sync-refactor-implementation-plan.md`  
**Started:** 2025-11-30  

---

## Current Phase: Phase 4 - Migrate to Trigger-Based Queue

### Phase 0.1: Casing Utilities ✅
- [x] Create `src/lib/sync/casing.ts`
- [x] Create `tests/lib/sync/casing.test.ts`
- [x] Tests passing (27 tests)

### Phase 0.2: Table Metadata Registry ✅
- [x] Create `src/lib/sync/table-meta.ts`
- [x] Create `tests/lib/sync/table-meta.test.ts`
- [x] Tests passing (41 tests)
- [x] Validated registry covers all 19 syncable tables

---

## Phase 1: Sync Outbox + Triggers ✅
- [x] Add `syncOutbox` to `drizzle/schema-sqlite.ts`
- [x] Create `sql_scripts/sync_triggers.sql`
- [x] Create `src/lib/db/install-triggers.ts`
- [x] Create `tests/lib/db/install-triggers.test.ts`
- [x] Tests passing (20 tests)

---

## Phase 2: Table Adapters ✅
- [x] Create `src/lib/sync/adapters.ts`
- [x] Create `tests/lib/sync/adapters.test.ts`
- [x] Tests passing (49 tests)

---

## Phase 3: Integrate Adapters into SyncEngine ✅
- [x] Update `processQueueItem` to use adapters
- [x] Update `syncTableDown` to use adapters  
- [x] Remove duplicate methods from engine.ts
  - Removed `COMPOSITE_KEY_TABLES` constant
  - Removed `PRIMARY_KEY_COLUMNS` constant
  - Removed `getPrimaryKeyColumn()` function
  - Removed `getCompositeKeyFields()` function
  - Removed `transformRemoteToLocal()` method
  - Removed `transformLocalToRemote()` method
- [x] All unit tests passing (188 tests)

---

## Phase 4: Migrate to Trigger-Based Queue
- [x] Install triggers during database initialization (Phase 4.1)
- [ ] Update `syncUp` to read from `sync_outbox`
- [ ] Remove manual `queueSync` calls
- [ ] Deprecate old `sync_queue` table
- [ ] All E2E tests passing

---

## Phase 5: Testing & Validation
- [ ] Integration tests for outbox flow
- [ ] Composite key tests
- [ ] Datetime normalization tests
- [ ] All E2E tests passing

---

## Phase 6: Documentation & Cleanup
- [ ] Update `docs/DB_AND_REPLICATION_ARCHITECTURE.md`
- [ ] Create `docs/SYNC_TRIGGERS.md`
- [ ] Remove deprecated code
- [ ] Final review

---

## Log

### 2025-11-30
- Created implementation plan
- Created this status document
- Phase 0.1: Created `src/lib/sync/casing.ts` (27 tests passing)
- Phase 0.2: Created `src/lib/sync/table-meta.ts` (41 tests passing)
- Phase 1.1: Added `syncOutbox` table to `drizzle/schema-sqlite.ts`
- Phase 1.2: Created `sql_scripts/sync_triggers.sql` (trigger SQL for all 19 tables)
- Phase 1.3: Created `src/lib/db/install-triggers.ts` with tests (20 tests passing)
- Phase 2: Created `src/lib/sync/adapters.ts` with tests (49 tests passing)
- Phase 3: Integrated adapters into SyncEngine
  - Updated `processQueueItem` to use `getAdapter().toRemote()`
  - Updated `syncTableDown` to use `getAdapter().toLocal()`
  - Removed ~100 lines of duplicate transform code
  - All 188 unit tests passing
- Phase 4.1: Install triggers during database initialization
  - Modified `src/lib/db/client-sqlite.ts` to call `createSyncOutboxTable()` and `installSyncTriggers()` on init
  - All 188 unit tests passing

