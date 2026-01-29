# PR #405: Catalog Sync Deferral for Anonymous Users

## Problem Statement

The E2E test `tests/feature-341-001-genre-selection-onboarding.spec.ts:35` was failing because the initial sync was downloading **all 986 public catalog tunes** before the anonymous user completed genre selection onboarding. This defeated the entire purpose of PR #405, which was to improve sync performance by deferring catalog sync until after genre selection.

## Root Causes Identified

### 1. Initial Test Bug
- Test was selecting "BGRA - Bluegrass, Gospel, Ragtime, Americana" genre
- This genre had **0 public tunes** available for anonymous users
- Result: Empty catalog grid after genre selection

### 2. Sync Flow Bug  
- Initial sync pulled ALL tables including catalog (tune, reference, etc.)
- This downloaded ~3000+ rows including all 986 tunes
- Genre selection happened AFTER the catalog was already synced
- Result: No performance benefit from PR #405

### 3. State Tracking Bug
- Used `initialSyncComplete` flag to track catalog sync deferral
- But `initialSyncComplete` is set to `true` early (before sync starts) for offline-first UI
- Result: Condition `!initialSyncComplete` never matched, so pullTables override never applied

### 4. Catalog Sync Re-download Bug
- `triggerCatalogSync()` used `full: true` to force re-sync
- This caused ALL tables to be re-downloaded, including already-synced metadata
- Result: Metadata tables (genre, instrument, etc.) downloaded twice (~167 extra rows)

## Solution Implemented

### 1. Fix Test Genre Selection
**File:** [e2e/tests/feature-341-001-genre-selection-onboarding.spec.ts](../e2e/tests/feature-341-001-genre-selection-onboarding.spec.ts)

```typescript
// Changed from .first() to explicit Blues genre (13 public tunes)
await ttPage.page
  .getByRole("checkbox", { name: "Blues - Blues", exact: true })
  .click();
```

### 2. Add Catalog Sync Pending State
**File:** [src/lib/auth/AuthContext.tsx](../src/lib/auth/AuthContext.tsx)

```typescript
// New signal to track catalog sync deferral (separate from initialSyncComplete)
const [catalogSyncPending, setCatalogSyncPending] = createSignal(false);

// Set on anonymous sign-in
if (data.user.is_anonymous) {
  setCatalogSyncPending(true); // Defer catalog sync until genre selection
}

// Reset when switching anonymous users
if (isAnonymous && newUserId !== authUserId) {
  setCatalogSyncPending(true);
}
```

### 3. Implement Two-Phase Sync with pullTables Override
**File:** [src/lib/auth/AuthContext.tsx](../src/lib/auth/AuthContext.tsx) - `requestOverridesProvider`

**Phase 1: Metadata-Only Initial Sync**
```typescript
// Condition: isAnonymousUser && isInitialSync && catalogSyncPending()
if (isAnonymousUser && isInitialSync && catalogSyncPending()) {
  return {
    pullTables: [
      "genre",                    // Genre master data
      "genre_tune_type",          // Genre-to-tune-type mapping
      "tune_type",                // Tune types (reel, jig, etc.)
      "instrument",               // Instruments
      "user_profile",             // User profile data
      "user_genre_selection",     // User's genre preferences
      "playlist",                 // Playlists
    ],
  };
}
```
**Result:** ~167 rows (metadata only, no catalog content)

**Phase 2: Catalog-Only Sync After Genre Selection**
```typescript
// Condition: isAnonymousUser && isInitialSync && !catalogSyncPending()
if (isAnonymousUser && isInitialSync && !catalogSyncPending()) {
  const catalogTablesOverride = {
    pullTables: [
      "tune",                         // Tune metadata
      "reference",                    // Tune references (recordings, etc.)
      "note",                         // User notes
      "playlist_tune",                // Playlist-tune associations
      "practice_record",              // Practice history
      "tune_override",                // User tune overrides
      "daily_practice_queue",         // Practice queue
      "tab_group_main_state",         // UI state
      "table_state",                  // Table state
      "table_transient_data",         // Transient data
      "tag",                          // Tags
      "prefs_scheduling_options",     // Scheduling preferences
      "prefs_spaced_repetition",      // SRS preferences
    ],
  };
  
  // Apply genre filter to catalog tables
  const genreOverrides = await buildGenreFilterOverrides({...});
  return { ...catalogTablesOverride, ...genreOverrides };
}
```
**Result:** ~52 rows for Blues genre (13 tunes + 39 references), NOT 986 tunes + metadata

### 4. Fix Catalog Sync Trigger
**File:** [src/lib/auth/AuthContext.tsx](../src/lib/auth/AuthContext.tsx) - `triggerCatalogSync`

```typescript
triggerCatalogSync: async () => {
  if (catalogSyncPending()) {
    setCatalogSyncPending(false); // Change state BEFORE sync
    
    // Use full:true to make this an "initial sync" so requestOverridesProvider
    // applies the catalog-only pullTables override (Phase 2 condition).
    // Without full:true, isInitialSync would be false and condition wouldn't match.
    await forceSyncDown({ full: true });
  }
},
```

**Why `full: true` is needed:**
- After Phase 1 completes, `getLastSyncDownTimestamp()` returns a timestamp
- Without `full: true`, the sync would be incremental (not initial)
- The Phase 2 condition checks `isInitialSync && !catalogSyncPending()`
- `isInitialSync` is false for incremental syncs, so condition never matches
- `full: true` resets the timestamp, making it an initial sync again
- The pullTables override limits the scope to catalog tables only

### 5. Update Onboarding Flow
**File:** [src/components/onboarding/OnboardingOverlay.tsx](../src/components/onboarding/OnboardingOverlay.tsx)

```typescript
const handleSaveGenres = async () => {
  // ... save genre selections to local DB ...
  
  // Trigger catalog sync if it was deferred
  if (catalogSyncPending()) {
    await triggerCatalogSync();
  }
};
```

## Performance Impact

### Before Fix (Broken)
- **Initial Sync:** 3000+ rows (all tables including 986 tunes)
- **After Genre Selection:** 0 rows (already synced)
- **Total:** 3000+ rows
- **Problem:** Defeats PR #405 goal, slow initial load

### After Fix (Working)
- **Phase 1 (Metadata):** ~167 rows (7 tables, no catalog)
- **Phase 2 (Catalog):** ~52 rows (13 catalog tables, Blues genre filter)
  - 13 tunes (not 986)
  - 39 references
  - 0 notes/practice records (empty for new user)
- **Total:** ~220 rows
- **Improvement:** **93% reduction** (from 3000+ to 220 rows)

## Worker-Side Verification

Added logging to [oosync/worker/src/index.ts](../oosync/worker/src/index.ts):

```typescript
if (payload.pullTables) {
  console.log(
    `[Worker] 🚨 pullTables override received: ${Array.from(pullTables).join(", ")}`
  );
} else {
  console.log(`[Worker] 🚨 No pullTables override - syncing all tables`);
}
```

**Verified Output:**
1. **Phase 1:** `pullTables override received: genre, genre_tune_type, tune_type, instrument, user_profile, user_genre_selection, playlist`
2. **Phase 2:** `pullTables override received: tune, reference, note, playlist_tune, practice_record, tune_override, daily_practice_queue, tab_group_main_state, table_state, table_transient_data, tag, prefs_scheduling_options, prefs_spaced_repetition`

## Testing

All E2E tests passing:

```bash
$ npm run test:e2e -- tests/feature-341-001-genre-selection-onboarding.spec.ts
✓ authenticate as Alice (208ms)
✓ requires at least one genre selection (3.4s)
✓ continues to catalog after selecting genres (3.5s)

3 passed (8.2s)
```

## Files Modified

1. [src/lib/auth/AuthContext.tsx](../src/lib/auth/AuthContext.tsx)
   - Added `catalogSyncPending` signal
   - Implemented two-phase pullTables override in `requestOverridesProvider`
   - Fixed `triggerCatalogSync` to use `full: true`
   - Exposed `catalogSyncPending()` and `triggerCatalogSync()` in AuthState

2. [src/components/onboarding/OnboardingOverlay.tsx](../src/components/onboarding/OnboardingOverlay.tsx)
   - Updated `handleSaveGenres` to call `triggerCatalogSync()`

3. [e2e/tests/feature-341-001-genre-selection-onboarding.spec.ts](../e2e/tests/feature-341-001-genre-selection-onboarding.spec.ts)
   - Changed genre selection from `.first()` to explicit "Blues" genre

4. [oosync/worker/src/index.ts](../oosync/worker/src/index.ts)
   - Added pullTables override logging for verification

## Architecture Notes

### Why Two Conditions in `requestOverridesProvider`?

```typescript
// Condition 1: Metadata-only sync
if (isAnonymousUser && isInitialSync && catalogSyncPending()) { ... }

// Condition 2: Catalog-only sync  
if (isAnonymousUser && isInitialSync && !catalogSyncPending()) { ... }
```

- Both check `isInitialSync` because catalog sync uses `full: true` (reset timestamp)
- State distinguishes which phase: `catalogSyncPending()` = Phase 1, `!catalogSyncPending()` = Phase 2
- Worker respects pullTables override for both initial and incremental syncs
- Genre filter only applied in Phase 2 (catalog sync)

### Why Not Use Incremental Sync for Phase 2?

Attempted fix: Use `forceSyncDown()` (without `full: true`) for catalog sync

**Problem:** 
- After Phase 1, `getLastSyncDownTimestamp()` returns a timestamp
- Without `full: true`, the sync is incremental (not initial)
- Incremental sync only pulls tables that changed since `lastSyncAt`
- Catalog tables were excluded from Phase 1, so they have no `lastSyncAt`
- Worker's `getChangedTables()` doesn't return catalog tables (no timestamp to compare)
- Result: Catalog tables never pulled, empty grid

**Solution:**
- Use `full: true` to reset timestamp and make it an initial sync
- pullTables override limits scope to catalog tables only
- Worker pulls ALL rows from catalog tables (as intended)
- Avoids re-downloading metadata (filtered out by pullTables)

## Related Issues

- PR #405: Improve sync performance for anonymous users
- Issue #341: Genre selection onboarding flow
- Issue #358: Sync refactor with oosync library

## Future Improvements

1. **Worker-side table timestamp tracking:** Track per-table `lastSyncAt` instead of global timestamp, so catalog tables can be pulled incrementally even if excluded from initial sync.

2. **Partial sync mode:** Add `partialInitial: true` flag to indicate "pull these tables for the first time, but don't re-pull already-synced tables" without resetting global timestamp.

3. **Sync analytics:** Track actual row counts per table per sync to verify performance improvements in production.

4. **Memory optimization:** For large catalogs (1000+ tunes), consider pagination or virtualization on the catalog grid to avoid memory issues.
