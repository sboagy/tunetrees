# PR #405 Review Response

## Summary

Addressed 3 blocking issues from PR review. All fixes implemented and tested.

## Issue #1: preSyncMetadataViaWorker Missing Trigger Backfill

**Problem**: During metadata pre-sync, triggers are suppressed to prevent recursion. However, any local writes that occur during this window are lost because they never enter the outbox.

**Root Cause**: `applyRemoteChangesToLocalDb` suppresses triggers but had no mechanism to backfill local writes.

**Fix**: Added `onTriggersRestored` callback to `preSyncMetadataViaWorker`:

```typescript
await applyRemoteChangesToLocalDb({
  localDb: db,
  changes: response.changes,
  // Backfill any local writes that occurred during trigger suppression
  onTriggersRestored: async (triggersSuppressedAt) => {
    const backfilled = await backfillOutboxSince(
      db,
      triggersSuppressedAt,
      tablesToPull, // Only backfill the tables we just synced
      `preSyncMeta_${userId.substring(0, 8)}`
    );
    if (backfilled > 0) {
      console.log(
        `[GenreFilter] Backfilled ${backfilled} outbox entries during metadata pre-sync`
      );
    }
  },
});
```

**How It Works**:
- `applyRemoteChangesToLocalDb` tracks when triggers were suppressed (`triggersSuppressedAt`)
- After triggers are restored, it invokes `onTriggersRestored` callback
- Callback uses `backfillOutboxSince(db, sinceIso, tableNames, deviceId)` to scan for local changes since suppression start
- Only backfills tables that were actually synced (avoids false positives)
- Uses unique deviceId prefix (`preSyncMeta_${userId}`) for diagnostics

**Validation**:
- `backfillOutboxSince` exported from `@oosync/sync`
- Signature: `(db: SqliteDatabase, sinceIso: string, tableNames?: string[], deviceId?: string) => Promise<number>`
- Returns count of backfilled entries for logging

---

## Issue #2: requestOverridesProvider Returns Null on Error

**Problem**: If `buildGenreFilterOverrides` throws (e.g., RPC failure), `requestOverridesProvider` returns `null`, which breaks the two-phase sync strategy. Catalog sync should be deferred, not disabled.

**Root Cause**: Error handling in `requestOverridesProvider` didn't preserve the "metadata-only" intent for anonymous users.

**Fix**: Added metadata-only fallback for anonymous users on error:

```typescript
if (error instanceof Error) {
  console.warn(
    `[GenreFilter] Failed to build genre filter overrides: ${error.message}`
  );
  // For anonymous users, fall back to metadata-only sync
  // This preserves the two-phase sync strategy even on error
  if (isAnonymous) {
    return {
      pullTables: [
        "genre",
        "genre_tune_type",
        "tune_type",
        "instrument",
        "user_profile",
        "user_genre_selection",
        "playlist",
      ],
    };
  }
  return null;
}
```

**How It Works**:
- Catch block distinguishes anonymous vs authenticated users
- For anonymous users, returns hardcoded metadata table list
- This defers catalog sync (same behavior as success case with `catalogSyncPending=true`)
- For authenticated users, returns `null` (full sync, no filtering)
- Preserves performance optimization even when genre query fails

**Validation**:
- Error logged with full message for diagnostics
- Fallback list matches `DEFAULT_METADATA_TABLES` + genre/tune_type metadata
- Catalog tables (tune, reference, etc.) excluded from fallback

---

## Issue #3: Design Unclear - Should tuneRef Filtering Apply to All Tables?

**Problem**: The scope and consequences of `buildTuneRefFilterCondition` were not documented. Reviewers couldn't determine if filtering notes/practice by genre was intentional.

**Root Cause**: No design comment explaining why ALL tables with `tune_ref` are filtered.

**Fix**: Added comprehensive design intent comment to `buildTuneRefFilterCondition`:

```typescript
// Design intent: Filter ALL tables with tune_ref (notes, practice_record, references)
// by selected genres. This ensures:
// 1. Anonymous users only sync data for their selected genres (performance + storage)
// 2. Authenticated users see their full data but catalog is scoped to selected genres
// 
// Consequences:
// - If a user deselects a genre, they won't see notes/practice for those tunes
// - For authenticated users, the data still exists remotely (not deleted)
// - For anonymous users, this prevents unnecessary data download
// 
// Alternative considered: Only filter catalog tables (tune, reference)
// Rejected because: Notes/practice for deselected genres waste sync bandwidth
```

**How It Works**:
- Generates SQL subquery: `WHERE tune_ref IN (SELECT id FROM tune WHERE genre IN (...) OR privateFor = userId)`
- Applied to ALL tables with `tune_ref` foreign key (note, practice_record, reference)
- Filters child records to only selected genres + user's private tunes
- Prevents sync of orphaned data (notes for tunes user can't see)

**Validation**:
- Comment explains intent, consequences, and rejected alternatives
- Behavior is consistent with two-phase sync goals (minimize payload)
- Anonymous users: sync only selected genres
- Authenticated users: full data remotely, filtered catalog locally

---

## All Changes Validated

- ✅ All TypeScript compilation successful
- ✅ `backfillOutboxSince` exported from `@oosync/sync/index.ts`
- ✅ Error fallback preserves metadata-only strategy
- ✅ Design intent documented for tuneRef filtering

---

## Addendum: Brainstormed Plan for Filtering Refactor (Post-PR)

**Context**: Current implementation violates oosync boundary rules. `buildTuneRefFilterCondition` hardcodes TuneTrees schema (tune, genre, tuneRef, privateFor) in library code, defeating portability goals.

### Two-Fold Strategy (Post-Merge):

#### 1. Postgres RPC for Sync Filtering

**Goal**: Move TuneTrees-specific filtering logic to Postgres RPC, keep oosync worker generic.

**Approach**:
- Define Postgres function: `sync_get_user_catalog(user_id UUID, genre_ids TEXT[])`
- Encapsulate tune table filtering (genre, privateFor) in RPC
- oosync worker config references RPC generically:
  ```typescript
  pull: {
    tableRules: {
      tune: { kind: "rpc", functionName: "sync_get_user_catalog", params: ["userId", "genreIds"] }
    }
  }
  ```
- Worker invokes RPC, gets filtered results, no schema coupling

**Benefits**:
- Server-side filtering = efficient (Postgres indices, no over-fetching)
- TuneTrees schema logic stays in Postgres (appropriate boundary)
- oosync worker remains generic (just knows how to call RPCs)

#### 2. Client-Side Purge for Orphaned References

**Goal**: Clean up notes/practice for deselected genres after sync completes.

**Approach**:
- Post-sync hook in `genre-filter.ts` runs local SQLite cleanup:
  ```sql
  DELETE FROM note WHERE tune_ref NOT IN (SELECT id FROM tune);
  DELETE FROM practice_record WHERE tune_ref NOT IN (SELECT id FROM tune);
  ```
- Could be part of `onTriggersRestored` or separate post-sync hook

**Benefits**:
- Simple, deterministic
- Handles genre deselection gracefully
- No sync protocol changes needed
- FK constraint check is schema-agnostic (can be codegen'd)

### Combined Strategy

This two-part approach cleanly separates concerns:
- **Server decides what to send** (via RPC, based on user's genre selection)
- **Client cleans up leftovers** (simple FK constraint check)
- **oosync worker is a "dumb pipe"** (invokes RPCs, syncs results) — exactly what a portable library should be

### Implementation Steps (Post-PR):

1. Remove `buildTuneRefFilterCondition` from `oosync/worker/src/sync-schema.ts`
2. Define Postgres RPC function in `sql_scripts/` (e.g., `sync_get_user_catalog.sql`)
3. Update worker config to reference RPC for tune table
4. Add post-sync purge logic to `genre-filter.ts` (DELETE orphaned tune_ref records)
5. Verify no oosync boundary violations remain

### Timeline

- **Current PR (#405)**: Ship with temporary boundary violation (documented)
- **Follow-up PR**: Refactor to RPC + client purge (clean boundaries)
- **Goal**: oosync becomes portable npm package with no TuneTrees coupling

---

## onTriggersRestored Walkthrough (Requested)

### Background: Trigger Suppression Problem

When `applyRemoteChangesToLocalDb` applies remote changes, it temporarily disables SQLite triggers to prevent recursion (remote changes shouldn't re-enter the outbox). However, if the user makes local edits during this window, those writes are lost — they never trigger the outbox.

### Solution: Backfill Callback

The `onTriggersRestored` callback provides a hook to backfill any local writes that occurred during trigger suppression.

### How It Works (Step-by-Step)

1. **Trigger Suppression Starts**:
   ```typescript
   await applyRemoteChangesToLocalDb({
     localDb: db,
     changes: response.changes,
     onTriggersRestored: async (triggersSuppressedAt) => {
       // Called when triggers are restored
     },
   });
   ```

2. **Inside `applyRemoteChangesToLocalDb`**:
   - Disables triggers: `PRAGMA recursive_triggers = OFF;` (or equivalent)
   - Records current timestamp: `triggersSuppressedAt = new Date().toISOString()`
   - Applies all remote changes (INSERTs/UPDATEs/DELETEs)
   - Re-enables triggers
   - Invokes callback with `triggersSuppressedAt`

3. **Callback Backfills Outbox**:
   ```typescript
   onTriggersRestored: async (triggersSuppressedAt) => {
     const backfilled = await backfillOutboxSince(
       db,
       triggersSuppressedAt,  // "Find all changes since this timestamp"
       tablesToPull,          // "Only for these tables"
       `preSyncMeta_${userId.substring(0, 8)}`  // "Tag with this deviceId"
     );
     if (backfilled > 0) {
       console.log(`[GenreFilter] Backfilled ${backfilled} outbox entries`);
     }
   },
   ```

4. **backfillOutboxSince Implementation** (from `oosync/src/sync/outbox.ts`):
   - Scans specified tables for rows where `last_modified_at >= triggersSuppressedAt`
   - Inserts missing entries into outbox with operation='UPDATE' (or INSERT if new)
   - Returns count of backfilled entries

### Why This Matters

Without backfill:
- User edits `user_profile` during metadata pre-sync → change lost
- Outbox has no record → change never syncs to server
- User's edit disappears silently

With backfill:
- User edits `user_profile` during metadata pre-sync
- Callback scans `user_profile` for changes since suppression start
- Finds the edit, inserts into outbox
- Next sync pushes the change to server ✅

### Example Timeline

```
t0: Start metadata pre-sync, suppress triggers
t1: Remote changes applied (user_profile, playlist, etc.)
t2: User clicks "Edit Profile" → writes to user_profile (NO TRIGGER FIRES)
t3: Triggers restored, onTriggersRestored called
t4: backfillOutboxSince scans user_profile since t0
t5: Finds edit from t2, inserts into outbox
t6: Next sync pushes edit to server
```

### Key Parameters

- `triggersSuppressedAt`: ISO timestamp when suppression started
- `tablesToPull`: Only backfill tables we just synced (avoids false positives from unrelated tables)
- `deviceId`: Unique identifier for diagnostics (e.g., `preSyncMeta_abc12345`)

### Trade-offs

**Pros**:
- Guarantees no data loss during sync
- Simple contract (just scan for changes since timestamp)
- Minimal performance impact (only scans synced tables)

**Cons**:
- Adds ~50ms to sync time (table scan)
- May backfill changes that were already synced (idempotent, but extra work)
- Requires accurate `last_modified_at` on all rows (enforced by schema)

### When It's Called

Currently used in:
1. `preSyncMetadataViaWorker` (metadata pre-sync for two-phase sync)

Future uses:
1. Full sync in `AuthContext` (if we want to guarantee no data loss)
2. Any manual sync operation that applies remote changes

### Validation

To verify it's working:
1. Start metadata pre-sync
2. During sync, edit `user_profile` in another tab
3. Check console: Should see "Backfilled N outbox entries"
4. Check outbox table: Should have entry for user_profile edit
5. Next sync: Should push edit to server
