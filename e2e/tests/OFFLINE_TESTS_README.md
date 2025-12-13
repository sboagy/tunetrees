# Offline E2E Testing Implementation

This directory contains end-to-end tests for offline functionality in the TuneTrees PWA.

## Overview

The offline tests verify that the application works correctly when network connectivity is unavailable and synchronizes properly when connectivity is restored. These tests are critical for ensuring the offline-first architecture functions as designed.

## Test Structure

### Helper Utilities

- **`helpers/network-control.ts`**: Network simulation utilities
  - `goOffline(page)`: Simulate network disconnection
  - `goOnline(page)`: Restore network connectivity
  - `simulateSlowNetwork(page, delayMs)`: Add latency to all requests
  - `simulateIntermittentConnection(page, dropRate)`: Random request failures

- **`helpers/sync-verification.ts`**: Sync state verification
  - `waitForSync(page, timeout)`: Wait for sync to complete
  - `verifySyncOutboxEmpty(page)`: Confirm all changes synced
  - `verifySyncOutboxCount(page, count)`: Check pending sync items
  - `triggerManualSync(page)`: Force synchronization

- **`helpers/storage-inspection.ts`**: Storage inspection utilities
  - `getSQLiteRecord(page, table, id)`: Read from local SQLite
  - `getIndexedDBSize(page)`: Check storage usage
  - `verifyServiceWorkerActive(page)`: Confirm SW is running
  - `clearLocalStorage(page)`: Clean up between tests

### Page Object Extensions

`page-objects/TuneTreesPage.ts` has been extended with sync-related locators:
- `syncStatusIndicator`: Sync status display
- `syncButton`: Manual sync trigger
- `offlineIndicator`: Offline mode indicator
- `pendingChangesCount`: Number of pending changes
- `syncProgressIndicator`: Sync progress display

## Implemented Tests

### ✅ Category 1: Core Offline Functionality

#### `offline-001-practice-tab.spec.ts` (P0)
- Practice evaluations work offline
- Changes queue for sync
- Sync completes when online
- Rapid evaluations handled correctly
- Offline state persists across reloads

#### `offline-002-repertoire-tab.spec.ts` (P0)
- Delete tunes offline
- Sort repertoire without network
- Filter by tune type offline
- Multiple deletions sync correctly

### ✅ Category 4: Complex Offline Scenarios

#### `offline-011-extended-session.spec.ts` (P0)
- 30+ operations across all tabs
- Practice evaluations (20+)
- Repertoire management
- Note creation
- User settings updates
- Performance remains acceptable
- Full sync completes successfully

#### `offline-012-connection-interruptions.spec.ts` (P1)
- Multiple offline/online transitions
- Partial sync interruption
- Queue preservation across states
- Rapid connection switches
- State persistence across reloads

## Running Tests

### Prerequisites
```bash
# Reset database to clean state
npm run db:local:reset

# Ensure dev server is running
# (on http://localhost:5173)
```

### Run Tests

```bash
# Run all offline tests (headless)
npm run test:e2e -- offline-*

# Run specific test
npm run test:e2e -- offline-001-practice-tab.spec.ts

# Run with browser visible (headed mode)
npm run test:e2e:headed -- offline-*

# Debug specific test
npm run test:e2e:debug -- offline-001-practice-tab.spec.ts
```

### CI/CD

Tests run automatically in CI pipeline:
- Chromium (primary)
- Firefox
- WebKit
- Mobile Chrome

## Test Coverage

### Implemented (4 tests)
- ✅ Practice tab offline CRUD
- ✅ Repertoire tab offline CRUD
- ✅ Extended offline session (30+ operations)
- ✅ Connection interruptions

### Planned (18 tests)
See [issue #326](https://github.com/sboagy/tunetrees/issues/326) for full test plan:
- Catalog tab offline operations
- Analysis tab offline access
- Sidebar panels (Notes, References, Tags)
- User settings offline
- Sync edge cases
- Service worker caching
- User feedback & UX

## Implementation Notes

### Network Simulation

Playwright's `context.setOffline()` is used to simulate offline mode:
```typescript
await page.context().setOffline(true);  // Go offline
await page.context().setOffline(false); // Go online
```

### Sync Verification

Tests verify sync completion by checking:
1. `sync_outbox` table is empty
2. Local SQLite matches Supabase
3. No sync errors occurred

### Test Data

Per-worker test users (bob, alice, dave, etc.) ensure parallel test execution without conflicts. Each test creates its own repertoire to avoid interference.

### Timeouts

Extended timeouts are used for offline tests:
- Sync completion: 30-60 seconds
- Extended session: 5+ minutes
- Network state changes: 10 seconds

## Debugging

### Common Issues

1. **Sync timeout**: Increase timeout in `waitForSync()`
2. **Test flakiness**: Add `waitForTimeout()` after state changes
3. **Service worker not active**: Check PWA is enabled in vite.config

### Debug Tools

```typescript
// Log sync_outbox count
const count = await getSyncOutboxCount(page);
console.log(`Pending: ${count}`);

// Check if offline
const offline = await isOffline(page);
console.log(`Offline: ${offline}`);

// Inspect local record
const record = await getSQLiteRecord(page, 'practice_record', '123');
console.log(record);
```

## Performance Benchmarks

Target performance for offline operations:
- Practice evaluation save: < 100ms
- Sync 100 changes: < 30 seconds
- Offline app load: < 2 seconds
- SQLite read: < 50ms (p95)

## Contributing

When adding new offline tests:
1. Follow naming convention: `offline-XXX-description.spec.ts`
2. Include JSDoc header with priority and feature
3. Use helper utilities for network control
4. Verify sync completes successfully
5. Test both offline and online reconnection
6. Add meaningful console logging for debugging

## References

- [Full Test Plan](../../_notes/offline-testing-plan.md)
- [GitHub Issue #326](https://github.com/sboagy/tunetrees/issues/326)
- [Playwright Docs](https://playwright.dev/docs/network)
- [Project AGENTS file](../../e2e/AGENTS.md)

---

**Status**: In Progress (4/22 tests implemented)  
**Last Updated**: December 13, 2025
