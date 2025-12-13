# Offline Functionality E2E Testing Plan

## Overview

This test plan ensures the TuneTrees PWA operates correctly in offline mode and synchronizes data reliably when connectivity is restored. The application uses SQLite WASM for local storage with Supabase as the cloud backend, implementing an offline-first architecture.

## Test Objectives

1. **Offline Data Access**: Verify all core features work without network connectivity
2. **Local Storage Integrity**: Ensure SQLite WASM persists data correctly
3. **Sync Reliability**: Validate data synchronization when online connectivity returns
4. **Conflict Resolution**: Test handling of concurrent changes during offline periods
5. **User Experience**: Ensure appropriate feedback for sync status and errors

## Architecture Components Under Test

- **Local Storage**: SQLite WASM via IndexedDB
- **Sync Service**: `src/lib/sync/service.ts` (SyncEngine + RealtimeManager)
- **Sync Queue**: `sync_outbox` table (trigger-based)
- **UI Components**: Tabs (Practice, Repertoire, Catalog, Analysis), Sidebar, User Settings
- **PWA Service Worker**: vite-plugin-pwa + Workbox

## Test Environment Setup

### Prerequisites

- Fresh database state before each test suite
- Per-worker authenticated test users (bob, alice, dave, etc.)
- Playwright with network interception capabilities
- Service worker enabled for offline testing

### Network Simulation

Use Playwright's `context.route()` to simulate offline conditions:

```typescript
// Go offline
await page.context().setOffline(true);

// Go back online
await page.context().setOffline(false);

// Simulate slow network
await page.route('**/*', route => {
  setTimeout(() => route.continue(), 1000); // 1s delay
});
```

## Test Scenarios

### Category 1: Core Offline Functionality

#### Test 1.1: Practice Tab Offline CRUD
**Priority**: P0 (Critical)  
**File**: `e2e/tests/offline-001-practice-tab.spec.ts`

**Setup:**
1. Authenticate user with existing repertoire (5 tunes)
2. Navigate to Practice tab while online
3. Verify initial data loads correctly

**Steps:**
1. Go offline (set `context.offline = true`)
2. Rate a tune (click "Good" button)
3. Verify flashcard advances to next tune
4. Submit 3 more evaluations with mixed ratings (Again, Hard, Easy)
5. Verify practice queue updates correctly
6. Check local SQLite for practice_record entries

**Expected Results:**
- All evaluations save to local SQLite immediately
- No network errors displayed to user
- Practice queue updates based on scheduling algorithm
- sync_outbox table contains pending changes

**Offline Duration**: 30 seconds

**Online Reconnection:**
1. Go back online
2. Wait for automatic sync (or trigger manual sync)
3. Verify practice records sync to Supabase
4. Check sync_outbox is cleared for synced records

**Success Criteria:**
- All 4 practice records appear in Supabase
- No data loss
- No duplicate records

---

#### Test 1.2: Repertoire Tab Offline CRUD
**Priority**: P0 (Critical)  
**File**: `e2e/tests/offline-002-repertoire-tab.spec.ts`

**Setup:**
1. Authenticate user
2. Navigate to Repertoire tab with 10 tunes
3. Go offline

**Steps:**
1. Remove 2 tunes from repertoire (delete playlist_tune entries)
2. Verify tunes disappear from repertoire grid
3. Sort repertoire by "Last Practiced" column
4. Filter by tune type "Jig"
5. Verify filtering works correctly

**Expected Results:**
- Deletions save locally
- UI updates immediately
- Sorting and filtering work offline
- sync_outbox tracks deletions

**Online Reconnection:**
1. Restore network
2. Wait for sync
3. Verify deletions propagate to Supabase
4. Verify tunes remain removed after page reload

---

#### Test 1.3: Catalog Tab Offline Operations
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-003-catalog-tab.spec.ts`

**Setup:**
1. Load Catalog tab with full tune list (100+ tunes)
2. Go offline

**Steps:**
1. Search for tune by title "Banish"
2. Verify search results display
3. Add tune to repertoire via "Add to Repertoire" button
4. Open tune details modal
5. View ABC notation and metadata
6. Edit tune title and tags (if allowed in modal)

**Expected Results:**
- Search works against local data
- Add to repertoire creates playlist_tune locally
- Modal displays cached data
- Edits queue for sync

**Online Reconnection:**
- New repertoire entry syncs to Supabase
- Title/tag changes sync correctly

---

#### Test 1.4: Analysis Tab Offline Access
**Priority**: P2 (Medium)  
**File**: `e2e/tests/offline-004-analysis-tab.spec.ts`

**Setup:**
1. User has 30 days of practice history
2. Navigate to Analysis tab while online
3. Go offline

**Steps:**
1. View practice statistics dashboard
2. Change date range filter (last 7 days → last 30 days)
3. Verify charts update with local data
4. Export statistics (if feature exists)

**Expected Results:**
- All analysis views render from local SQLite
- Filters work correctly
- No degradation in functionality

---

### Category 2: Sidebar Offline Functionality

#### Test 2.1: Notes Panel Offline CRUD
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-005-notes-panel.spec.ts`

**Setup:**
1. Open a tune with 2 existing notes
2. Go offline

**Steps:**
1. Create new note: "Remember to add ornaments"
2. Edit existing note
3. Delete one note
4. Verify notes list updates immediately

**Expected Results:**
- All CRUD operations succeed locally
- sync_outbox tracks changes
- Notes persist in IndexedDB

**Online Reconnection:**
- All note changes sync to Supabase
- No conflicts (last-write-wins)

---

#### Test 2.2: References Panel Offline CRUD
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-006-references-panel.spec.ts`

**Setup:**
1. Tune has 1 existing reference (YouTube link)
2. Go offline

**Steps:**
1. Add new reference: "https://thesession.org/tunes/123"
2. Edit reference description
3. Delete original reference
4. Verify reference list updates

**Expected Results:**
- Reference CRUD works offline
- sync_outbox queues changes

**Online Reconnection:**
- References sync to Supabase
- Links remain functional

---

#### Test 2.3: Tags Panel Offline Management
**Priority**: P2 (Medium)  
**File**: `e2e/tests/offline-007-tags-panel.spec.ts`

**Setup:**
1. Tune has tags: "beginner", "session"
2. Go offline

**Steps:**
1. Add tag: "favorite"
2. Remove tag: "beginner"
3. Verify tag badges update

**Expected Results:**
- Tag operations work offline
- Changes queue for sync

---

### Category 3: User Settings Offline

#### Test 3.1: User Profile Settings Offline
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-008-user-profile-settings.spec.ts`

**Setup:**
1. Navigate to User Settings → Account
2. Go offline

**Steps:**
1. Change display name
2. Update avatar selection
3. Save changes
4. Verify changes appear in top nav

**Expected Results:**
- Settings save to user_profile table locally
- UI reflects changes immediately
- sync_outbox queues update

**Online Reconnection:**
- Profile updates sync to Supabase
- Changes persist across sessions

---

#### Test 3.2: Scheduling Options Offline
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-009-scheduling-settings.spec.ts`

**Setup:**
1. Open User Settings → Scheduling Options
2. Go offline

**Steps:**
1. Change "Tunes per day limit" from 10 → 15
2. Toggle "Enable weekend practice"
3. Save changes
4. Return to Practice tab
5. Verify new settings affect practice queue

**Expected Results:**
- Settings save to prefs_scheduling_options locally
- Practice queue respects new limits
- sync_outbox tracks changes

**Online Reconnection:**
- Settings sync to Supabase

---

#### Test 3.3: Spaced Repetition Preferences Offline
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-010-spaced-repetition-settings.spec.ts`

**Setup:**
1. Navigate to User Settings → Spaced Repetition
2. Current algorithm: FSRS
3. Go offline

**Steps:**
1. Switch algorithm to SM2
2. Adjust FSRS parameters (if applicable)
3. Save changes
4. Submit practice evaluations
5. Verify new algorithm affects scheduling

**Expected Results:**
- Algorithm preference saves locally
- Practice scheduling uses new algorithm immediately
- sync_outbox queues preference change

---

### Category 4: Complex Offline Scenarios

#### Test 4.1: Extended Offline Session (5+ minutes)
**Priority**: P0 (Critical)  
**File**: `e2e/tests/offline-011-extended-session.spec.ts`

**Setup:**
1. User starts practice session online
2. Go offline after first evaluation

**Steps:**
1. Complete 20 practice evaluations while offline
2. Navigate between tabs (Repertoire, Catalog, Analysis)
3. Create 5 notes across different tunes
4. Add 3 new tunes to repertoire
5. Update user settings
6. Verify all changes persist locally

**Expected Results:**
- All 20+ operations save to SQLite
- No data loss or corruption
- sync_outbox accumulates ~30 pending changes
- UI remains responsive

**Online Reconnection:**
1. Restore network
2. Trigger sync (automatic or manual)
3. Monitor sync progress indicator
4. Verify all changes sync successfully
5. Check for conflicts (should be none)

**Success Criteria:**
- All changes appear in Supabase
- sync_outbox clears completely
- No duplicate records
- Sync completes within 30 seconds

---

#### Test 4.2: Offline → Online → Offline Transitions
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-012-connection-interruptions.spec.ts`

**Setup:**
1. Start online with clean state

**Steps:**
1. Create 3 practice records (online)
2. Go offline
3. Create 2 more practice records
4. Go online (partial sync - interrupt after 1 record)
5. Go offline again
6. Create 1 more practice record
7. Go online and complete full sync

**Expected Results:**
- Each offline batch queues correctly
- Partial sync updates sync_outbox status
- Final sync completes all pending changes
- No data loss during transitions

---

#### Test 4.3: Concurrent Multi-Tab Offline Edits
**Priority**: P2 (Medium)  
**File**: `e2e/tests/offline-013-multi-tab-consistency.spec.ts`

**Setup:**
1. Open TuneTrees in 2 browser tabs (same user)
2. Both tabs go offline

**Steps:**
1. Tab 1: Edit tune title "Tune A" → "Tune A (version 1)"
2. Tab 2: Edit same tune title "Tune A" → "Tune A (version 2)"
3. Tab 1: Add practice record for "Tune B"
4. Tab 2: Add practice record for "Tune C"
5. Go online in both tabs
6. Wait for sync

**Expected Results:**
- Practice records for both tunes sync (no conflict)
- Tune title conflict: last-write-wins
- User notified of conflict (optional: conflict resolution UI)
- Final state consistent across tabs

---

#### Test 4.4: Offline During Initial Load
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-014-initial-load-offline.spec.ts`

**Setup:**
1. Clear all local storage (simulate first-time user)
2. Go offline before authentication

**Steps:**
1. Attempt to load app
2. Login form should display
3. Attempt to log in (should fail gracefully)

**Expected Results:**
- App displays "No internet connection" message
- Login disabled with helpful error
- App does not crash

**Recovery:**
1. Go online
2. Retry login
3. Initial sync downloads all user data
4. Verify full functionality after sync

---

### Category 5: Sync Edge Cases

#### Test 5.1: Sync Failure Handling
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-015-sync-failures.spec.ts`

**Setup:**
1. Queue 10 changes offline
2. Mock Supabase to return 500 errors

**Steps:**
1. Go online
2. Trigger sync
3. Verify sync fails gracefully
4. Check retry mechanism (should retry with exponential backoff)
5. Fix Supabase (stop mocking errors)
6. Wait for successful sync

**Expected Results:**
- Failed sync does not clear sync_outbox
- User notified of sync failure
- Retry logic attempts sync again
- Eventually succeeds when Supabase recovers

---

#### Test 5.2: Large Dataset Sync
**Priority**: P2 (Medium)  
**File**: `e2e/tests/offline-016-large-sync.spec.ts`

**Setup:**
1. User offline for extended period
2. Queue 500+ changes (mix of inserts/updates/deletes)

**Steps:**
1. Go online
2. Trigger sync
3. Monitor sync progress (should show progress indicator)
4. Verify batching (should not send all 500 at once)

**Expected Results:**
- Sync processes in batches (e.g., 100 at a time)
- Progress indicator updates
- Sync completes within 2 minutes
- No memory issues or timeouts

---

#### Test 5.3: Conflict Resolution - Last Write Wins
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-017-conflict-resolution.spec.ts`

**Setup:**
1. User A and User B both have tune "X" in repertoire
2. Both go offline

**Steps:**
1. User A: Edits tune title at 10:00 AM
2. User B: Edits same tune title at 10:05 AM
3. User A syncs at 10:10 AM
4. User B syncs at 10:15 AM

**Expected Results:**
- User B's change overwrites User A's (last-write-wins)
- Both users see User B's version after sync
- Optional: User A notified of overwrite

---

### Category 6: Service Worker & Caching

#### Test 6.1: App Shell Caching
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-018-app-shell-cache.spec.ts`

**Setup:**
1. Load app online (primes service worker cache)
2. Go offline

**Steps:**
1. Reload page (hard refresh)
2. Verify app loads from cache
3. Verify UI skeleton renders
4. Verify cached data displays

**Expected Results:**
- Page loads within 2 seconds
- No network errors
- Service worker serves cached assets
- App remains functional

---

#### Test 6.2: Static Asset Caching
**Priority**: P2 (Medium)  
**File**: `e2e/tests/offline-019-static-assets.spec.ts`

**Setup:**
1. Load app online
2. Go offline

**Steps:**
1. Navigate to different routes
2. Verify icons, fonts, styles load
3. Open modals and dialogs
4. Verify all assets cached

**Expected Results:**
- No broken images or missing fonts
- CSS styles apply correctly
- Icons render properly

---

### Category 7: User Feedback & UX

#### Test 7.1: Offline Indicator
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-020-status-indicator.spec.ts`

**Setup:**
1. Start online

**Steps:**
1. Verify online indicator (green badge or checkmark)
2. Go offline
3. Verify offline indicator appears (yellow/orange badge)
4. Queue 5 changes
5. Verify "X changes pending sync" message
6. Go online
7. Verify sync progress indicator
8. Verify "Synced successfully" message

**Expected Results:**
- Clear visual feedback for network status
- Pending change count accurate
- Sync progress visible
- Success/error messages appropriate

---

#### Test 7.2: Sync Button Manual Trigger
**Priority**: P2 (Medium)  
**File**: `e2e/tests/offline-021-manual-sync.spec.ts`

**Setup:**
1. Disable automatic sync
2. Queue 10 changes offline

**Steps:**
1. Go online
2. Click "Sync Now" button (if exists)
3. Monitor sync progress
4. Verify changes sync

**Expected Results:**
- Manual sync button enabled when changes pending
- Sync executes on click
- Button disabled during sync (shows spinner)
- Success message on completion

---

#### Test 7.3: Error Handling & Toast Notifications
**Priority**: P1 (High)  
**File**: `e2e/tests/offline-022-error-notifications.spec.ts`

**Setup:**
1. Various error scenarios

**Steps:**
1. Go offline during sync → verify graceful degradation
2. Simulate Supabase auth token expiry → verify re-auth prompt
3. Simulate quota exceeded (IndexedDB full) → verify error message
4. Simulate network timeout → verify retry mechanism

**Expected Results:**
- Appropriate error messages for each scenario
- No cryptic technical errors shown to user
- Clear recovery instructions
- App remains stable (no crashes)

---

## Test Data Requirements

### User Accounts (Per-Worker)
- bob: Fresh user with minimal data (5 tunes)
- alice: Medium dataset (50 tunes, 20 days practice history)
- dave: Large dataset (200 tunes, 90 days practice history)
- eve: Power user (500+ tunes, extensive practice history)

### Tune Data
- Mix of tune types: Reels, Jigs, Hornpipes, Polkas
- Mix of modes: Major, Minor, Dorian, Mixolydian
- Varying difficulty levels
- Some with notes, references, tags; some without

### Practice History
- Distributed across recent days
- Mix of evaluation types (Again, Hard, Good, Easy)
- Varying intervals

## Test Execution Strategy

### Phase 1: Core Offline (Tests 1.1 - 1.4)
Run first to validate basic offline functionality. All tests must pass before proceeding.

### Phase 2: Component-Level (Tests 2.1 - 3.3)
Test individual features (sidebar panels, settings). Can run in parallel.

### Phase 3: Complex Scenarios (Tests 4.1 - 4.4)
Longer-running tests simulating realistic offline usage. Run serially to avoid interference.

### Phase 4: Edge Cases (Tests 5.1 - 5.3)
Stress testing sync reliability. May require custom Supabase mocks.

### Phase 5: PWA & UX (Tests 6.1 - 7.3)
Service worker caching and user feedback. Requires service worker enabled.

## CI/CD Integration

### Pre-Merge Requirements
- All P0 tests pass (100%)
- At least 90% of P1 tests pass
- P2 tests run but don't block merge

### Nightly Full Suite
- Run all tests across all browsers (Chromium, Firefox, WebKit)
- Run on mobile viewports (Mobile Chrome, Mobile Safari)
- Generate coverage report

### Performance Benchmarks
- Sync time for 100 changes: < 30 seconds
- App load time offline: < 2 seconds
- Practice evaluation save time: < 100ms

## Metrics & Success Criteria

### Reliability
- 99% of offline operations succeed
- 95% of syncs complete without retry
- Zero data loss in all scenarios

### Performance
- SQLite WASM read latency: < 50ms (p95)
- Sync throughput: > 20 operations/second
- IndexedDB write latency: < 100ms (p95)

### User Experience
- Offline indicator appears within 500ms of connection loss
- Sync status updates within 1 second
- Error messages clear and actionable

## Implementation Notes

### Test Utilities to Create
1. **Network Control Helper** (`e2e/helpers/network-control.ts`)
   - `goOffline(page)` 
   - `goOnline(page)`
   - `simulateSlowNetwork(page, delayMs)`
   - `simulateIntermittentConnection(page, dropRate)`

2. **Sync Verification Helper** (`e2e/helpers/sync-verification.ts`)
   - `waitForSync(page, timeoutMs)`
   - `verifySyncOutboxEmpty(page)`
   - `verifySyncOutboxCount(page, expectedCount)`
   - `verifySupabaseRecord(table, recordId, expectedData)`

3. **Storage Inspection Helper** (`e2e/helpers/storage-inspection.ts`)
   - `getSQLiteRecord(page, table, id)`
   - `getIndexedDBSize(page)`
   - `clearLocalStorage(page)`
   - `verifyServiceWorkerActive(page)`

### Page Object Extensions
Add to `e2e/page-objects/TuneTreesPage.ts`:
- `syncStatusIndicator` locator
- `syncButton` locator
- `offlineIndicator` locator
- `pendingChangesCount` locator

### Mock Service
Consider creating a mock Supabase service for controlled testing:
- `e2e/fixtures/mock-supabase.ts`
- Simulate various error conditions
- Control sync timing
- Inject conflicts

## Maintenance

### When to Update Tests
- After sync service changes (`src/lib/sync/service.ts`)
- After schema migrations affecting syncable tables
- After PWA configuration changes (`vite.config.ts`)
- After adding new offline-capable features

### Test Review Cadence
- Weekly: Review failing tests, update flaky tests
- Monthly: Review coverage, add tests for new features
- Quarterly: Performance benchmark review

## References

### Codebase
- Sync Service: [`src/lib/sync/service.ts`](src/lib/sync/service.ts)
- Sync Engine: [`src/lib/sync/engine.ts`](src/lib/sync/engine.ts)
- SQLite Client: [`src/lib/db/client-sqlite.ts`](src/lib/db/client-sqlite.ts)
- PWA Config: [`vite.config.ts`](vite.config.ts)

### Documentation
- Architecture: [`AGENTS.md`](AGENTS.md)
- E2E Testing: [`e2e/AGENTS.md`](e2e/AGENTS.md)
- Sync Implementation: [`_notes/issue-300-sync-refactor-implementation-plan.md`](_notes/issue-300-sync-refactor-implementation-plan.md)

### External Resources
- [Playwright Network Interception](https://playwright.dev/docs/network)
- [Learn PWA - Service Workers & Caching](https://web.dev/learn/pwa/service-workers/)
- [Workbox Testing & Debugging](https://developer.chrome.com/docs/workbox/troubleshooting-and-logging)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)
- [IndexedDB Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Chrome DevTools: Test PWAs](https://developer.chrome.com/docs/devtools/progressive-web-apps/)

---

**Plan Version**: 1.0  
**Last Updated**: December 13, 2025  
**Estimated Implementation Time**: 2-3 weeks (one developer)  
**Estimated Test Execution Time**: 45-60 minutes (full suite, all browsers)
