# Genre-Aware Sync Optimization Plan

**Issue**: Initial sync takes 65+ seconds, downloading 6,925 records (3,006 catalog items) when user only needs ~500 records based on selected genres.

**Status**: Phase 2 (Genre Filtering) ✅ **COMPLETED** - Phase 1 (Indexes) and Phase 3 (Parallel) remain.

**Key Implementation Decisions**:
1. ✅ **Server-side RPC filtering**: Used Postgres RPC functions (`sync_get_user_notes`, `sync_get_user_references`) instead of client-side filtering for better performance
2. ✅ **Metadata pre-sync**: Added 5 tables including `genre` to prevent FK constraint failures
3. ✅ **FK deferral/retry**: Handles dependency ordering during metadata sync
4. ✅ **Orphan purge**: Added `purgeOrphanedAnnotations()` for cleanup after genre removal in settings
5. ✅ **E2E test coverage**: Comprehensive test suite validates all scenarios

**Root Causes**:
1. Missing database indexes causing 20-30s queries
2. Worker pulls ALL catalog data, client filters post-sync
3. Sequential pagination (49 pages × ~1.5s = 73s network time)
4. No genre-aware filtering in worker pull rules

---

## Phase 1: Database Index Optimization (Quick Win)

**Objective**: Reduce Supabase query time from 20-30s to <200ms per query

### 1.1 Create Missing Indexes

**Priority: CRITICAL** - This alone should cut sync time by 80%

```sql
-- Migration: Add indexes for genre-aware filtering
-- File: supabase/migrations/YYYYMMDD_add_genre_filter_indexes.sql

-- Index for filtering references by genre
CREATE INDEX IF NOT EXISTS idx_reference_genre_id 
  ON public.reference(genre_id) 
  WHERE genre_id IS NOT NULL;

-- Index for filtering tunes by genre  
CREATE INDEX IF NOT EXISTS idx_tune_genre 
  ON public.tune(genre) 
  WHERE genre IS NOT NULL;

-- Composite index for tune lookups by playlist
CREATE INDEX IF NOT EXISTS idx_playlist_tune_composite
  ON public.playlist_tune(playlist_ref, tune_ref);

-- Index for genre selection queries
CREATE INDEX IF NOT EXISTS idx_user_genre_selection_user
  ON public.user_genre_selection(user_id);

-- Index for genre selection by genre (for reverse lookups)
CREATE INDEX IF NOT EXISTS idx_user_genre_selection_genre
  ON public.user_genre_selection(genre_id);
```

**Testing**:
- Run `EXPLAIN ANALYZE` on slow queries before/after
- Expected improvement: 30s → 100-200ms per table
- Deploy to staging first, verify with Supabase query performance advisor

**Constraints**: None - standard Postgres indexes, no oosync impact

---

## Phase 2: Sync Request Overrides (Medium-term)

**Objective**: Add genre filtering to sync requests without hardcoding app logic into oosync

**Implementation Decision**: ✅ Used **server-side RPC functions** instead of client-side filtering for `note` and `reference` tables. This provides better performance by leveraging Postgres indexes and reducing data transfer.

---

### ⚠️ CRITICAL: Pre-Sync Metadata Requirement ⚠️

**Scope**: This pre-sync + genre filter sequence runs **only** when `requestOverridesProvider` is configured **and** the user is authenticated. If either is missing, run the normal sync with no genre filtering.

**Before calculating the genre filter, we MUST pre-fetch small metadata tables:**
- `user_profile` (for FK constraints)
- `user_genre_selection` (explicit genre choices)
- `playlist` (playlist metadata with genre_default)

**Then calculate genre filter** (including Postgres query for initial sync to find existing playlist_tune genres)

**Then run existing sync** with genre filter applied via `requestOverridesProvider`

**The genre filter restricts WHICH rows get synced, not the sync table ordering** (existing sync engine already handles FK constraint ordering).

See section 2.3 below for detailed implementation.

---

### 2.1 Design: SyncRequestOverrides Extension

**Strategy**: Use existing `requestOverridesProvider` callback pattern in oosync to inject genre filter at runtime.

**CRITICAL**: Genre filter calculation requires **different queries** for initial vs incremental sync:
- **Initial sync**: Must query POSTGRES via Supabase client (no local data exists)
- **Incremental sync**: Can query LOCAL SQLite (local data already exists)

```typescript
// App-side (src/lib/sync/genre-filter.ts)
interface GenreFilterOverrides {
  selectedGenreIds: string[];
  playlistGenreIds: string[]; // From user's existing playlist_tune data
}

async function buildGenreFilterOverrides(
  db: SqliteDatabase,
  supabase: SupabaseClient, // ← CRITICAL: Need Supabase client for Postgres queries
  userId: string,
  isInitialSync: boolean
): Promise<SyncRequestOverrides> {
  // PREREQUISITE: This function is called AFTER Phase 0 metadata pre-fetch
  // So user_genre_selection and playlist tables already exist in LOCAL SQLite
  
  // 1. Fetch user's selected genres from user_genre_selection (LOCAL SQLite)
  //    Available because Phase 0 synced this table
  const selectedGenres = await db
    .select({ genreId: userGenreSelection.genreId })
    .from(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));
  
  // 2. Fetch genres from playlist.genre_default (LOCAL SQLite)
  //    Available because Phase 0 synced this table
  const playlistDefaultGenres = await db
    .select({ genre: playlist.genreDefault })
    .from(playlist)
    .where(
      and(
        eq(playlist.userRef, userId),
        isNotNull(playlist.genreDefault)
      )
    );
  
  // 3. Fetch genres from playlist_tune relationships
  //    CRITICAL: Initial sync queries POSTGRES, incremental queries LOCAL SQLite
  let playlistTuneGenres: string[] = [];
  
  if (isInitialSync) {
    // INITIAL SYNC: Query POSTGRES (local playlist_tune doesn't exist yet!)
    const { data } = await supabase
      .from('playlist_tune')
      .select('tune!inner(genre)')
      .in('playlist_ref', 
        await db.select({ id: playlist.playlistId }).from(playlist).where(eq(playlist.userRef, userId))
      )
      .not('tune.genre', 'is', null);
    
    playlistTuneGenres = [...new Set(data?.map(pt => pt.tune.genre) || [])];
  } else {
    // INCREMENTAL SYNC: Query LOCAL SQLite (playlist_tune + tune already synced)
    const result = await db.execute(sql`
      SELECT DISTINCT t.genre
      FROM playlist_tune pt
      INNER JOIN tune t ON pt.tune_ref = t.id
      INNER JOIN playlist p ON pt.playlist_ref = p.playlist_id
      WHERE p.user_ref = ${userId}
      AND t.genre IS NOT NULL
    `);
    playlistTuneGenres = result.map(r => r.genre);
  }
  
  return {
    genreFilter: {
      selectedGenreIds: [
        ...selectedGenres.map(g => g.genreId),
        ...playlistDefaultGenres.map(g => g.genre),
        ...playlistTuneGenres
      ],
      playlistGenreIds: playlistTuneGenres, // For logging/debugging
    }
  };
}
```

**Key differences**:
- ✅ Initial sync: `supabase.from('playlist_tune')` (Postgres query)
- ✅ Incremental sync: `db.execute(sql...)` (SQLite query)
- ✅ Both return the same genre list, just from different sources

### 2.2 Worker Implementation (RPC-Based)

**Location**: `oosync/worker/src/index.ts` + new RPC functions in Postgres

**Actual Implementation**: Uses server-side RPC functions for `note` and `reference` tables instead of client-side filtering.

```typescript
// Worker receives genre filter in request body
interface SyncRequest {
  // ... existing fields
  overrides?: {
    genreFilter?: {
      selectedGenreIds: string[];
      playlistGenreIds: string[];
    };
  };
}
```

**Key Changes**:
1. **New table pull rule type**: `{ kind: "rpc", functionName: string, params: string[] }`
2. **Worker config changes** (in `worker-config.generated.ts`):
   - `note` table: Changed from `orNullEqUserId` to `rpc` with `sync_get_user_notes`
   - `reference` table: Changed from `orNullEqUserId` to `rpc` with `sync_get_user_references`

3. **RPC functions** (server-side in Postgres):
   ```sql
   -- sql_scripts/sync_get_user_notes.sql
   CREATE OR REPLACE FUNCTION sync_get_user_notes(
     p_user_id UUID,
     p_genre_ids TEXT[],
     p_after_timestamp TIMESTAMPTZ DEFAULT NULL,
     p_limit INTEGER DEFAULT 1000,
     p_offset INTEGER DEFAULT 0
   ) RETURNS SETOF note AS $$
     SELECT n.*
     FROM note n
     JOIN tune t ON n.tune_ref = t.id
     WHERE (
       (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
       OR t.private_for = p_user_id
     )
     AND (n.user_ref IS NULL OR n.user_ref = p_user_id)
     AND (p_after_timestamp IS NULL OR n.last_modified_at > p_after_timestamp)
     AND t.deleted = FALSE
     ORDER BY n.last_modified_at ASC, n.id ASC
     LIMIT p_limit OFFSET p_offset;
   $$;
   
   -- sync_get_user_references.sql is similar
   ```

4. **Worker RPC handling** (in `oosync/worker/src/index.ts`):
   ```typescript
   if (rule?.kind === "rpc") {
     const rpcParams = {
       p_user_id: ctx.authUserId,
       p_genre_ids: ctx.genreFilter?.selectedGenreIds ?? [],
       p_after_timestamp: lastSyncAt,
       p_limit: 1000,
       p_offset: 0
     };
     const rows = await fetchViaRPC(tx, rule.functionName, rpcParams);
   }
   ```

**Benefits of RPC approach**:
- ✅ Server-side filtering reduces data transfer (Postgres does the JOIN + filtering)
- ✅ Leverages Postgres indexes for optimal performance
- ✅ Supports incremental sync via `p_after_timestamp` parameter
- ✅ Generic worker implementation (table config specifies RPC function name)
- ✅ Handles private tunes correctly (bypasses genre filter for user's own tunes)

**Constraints**:
- ✅ Generic: Worker has no knowledge of "notes" or "references", just calls RPC by name
- ✅ Optional: Falls back to collection-based filtering if no genreFilter provided
- ✅ App-controlled: Genre logic lives in SQL functions, worker just passes parameters

### 2.3 Pre-Sync Metadata and Genre Filter Calculation

**Problem**: To filter tunes by genre, we need to know which genres to include. Genres come from:
1. `user_genre_selection` (explicit selections)
2. `playlist.genre_default` (playlist-level genre)
3. `playlist_tune` → `tune.genre` (implicit from existing playlists on Postgres)

**Solution**: Pre-fetch metadata, then calculate genre filter

### Step 1: Pre-Sync Metadata Fetch

**Before the main sync**, fetch small metadata tables needed to calculate the genre filter:

```typescript
// Actual implementation in src/lib/sync/genre-filter.ts
const DEFAULT_METADATA_TABLES = [
  "user_profile",      // FK parent (must be first)
  "user_genre_selection", // Explicit genre choices
  "playlist",          // Playlist metadata (including genre_default)
  "instrument",        // Referenced by playlist.instrument_ref
  "genre",             // Required for playlist.genre_default FK constraint
];

async function preSyncMetadataViaWorker(params: {
  db: SqliteDatabase;
  supabase: SupabaseClient;
  tables?: string[];
  lastSyncAt?: string | null;
}): Promise<void> {
  // 1. Pre-fetch user_profile FIRST (FK constraint parent)
  await pullTables(["user_profile"]);
  
  // 2. Then fetch remaining metadata tables
  await pullTables(["user_genre_selection", "playlist", "instrument", "genre"]);
}
```

**Why these tables**:
- `user_profile` (~1 row) - FK parent for user_genre_selection and playlist
- `user_genre_selection` (~10 rows) - explicit genre choices
- `playlist` (~5 rows) - playlist metadata (including genre_default)
- `instrument` (~5 rows) - referenced by playlist.instrument_ref FK
- **`genre` (~25 rows)** - ✅ **CRITICAL**: Required for playlist.genre_default FK constraint to succeed

**Performance**: Total ~50 rows, <100ms

**Critical Fix**: Added "genre" to metadata tables to prevent FK constraint failures when syncing playlist table. Without this, playlist inserts fail because genre_default references genre.id which doesn't exist locally yet.

**FK Deferral Logic**: The `preSyncMetadataViaWorker()` implementation includes FK deferral/retry logic to handle dependency ordering:
```typescript
// First pass: try to apply all changes
const deferredChanges = [];
await applyRemoteChangesToLocalDb({
  localDb: db,
  changes: response.changes,
  deferForeignKeyFailuresTo: deferredChanges,
});

// Second pass: retry deferred changes (FK dependencies now resolved)
if (deferredChanges.length > 0) {
  await applyRemoteChangesToLocalDb({
    localDb: db,
    changes: deferredChanges,
  });
}
```
This ensures that if instrument or genre records arrive before playlist records in the same batch, they get deferred and retried after dependencies are satisfied.

### Step 2: Calculate Effective Genre Filter

**Initial Sync (Cold Start - NO local data)**:
```typescript
async function getEffectiveGenreFilter_InitialSync(
  db: SqliteDatabase,
  postgresClient: SupabaseClient,
  userId: string
): Promise<string[]> {
  // Local SQLite has NO tune data yet, so can't query LOCAL playlist_tune
  // But we MUST query POSTGRES playlist_tune to avoid orphans!
  
  // 1. Get explicit genre selections (from local, just synced)
  const selected = await db
    .select({ genreId: userGenreSelection.genreId })
    .from(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));
  
  // 2. Get implicit genres from playlist.genre_default (from local, just synced)
  const playlistGenres = await db
    .select({ genre: playlist.genreDefault })
    .from(playlist)
    .where(
      and(
        eq(playlist.userRef, userId),
        isNotNull(playlist.genreDefault)
      )
    );
  
  // 3. Get genres from EXISTING playlist_tune relationships on POSTGRES
  //    (Critical: user may have deselected genres but still has tunes in playlists)
  const { data: playlistTuneGenres } = await postgresClient
    .from('playlist_tune')
    .select(`
      tune!inner(genre)
    `)
    .eq('playlist.user_ref', userId)
    .not('tune.genre', 'is', null);
  
  const playlistTuneGenreIds = [
    ...new Set(playlistTuneGenres?.map(pt => pt.tune.genre) || [])
  ];
  
  // 4. Combine all three sources
  return [...new Set([
    ...selected.map(g => g.genreId),
    ...playlistGenres.map(g => g.genre),
    ...playlistTuneGenreIds
  ])];
}
```

**Incremental Sync (Warm - has local data)**:
```typescript
async function getEffectiveGenreFilter_IncrementalSync(
  db: SqliteDatabase,
  userId: string
): Promise<string[]> {
  // 1. Get explicit selections (from just-synced metadata)
  const explicit = await db
    .select({ genreId: userGenreSelection.genreId })
    .from(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));
  
  // 2. Get implicit genres from LOCAL playlist_tune + tune data
  //    (This queries LOCAL SQLite, not Postgres!)
  const implicit = await db.execute(sql`
    SELECT DISTINCT t.genre
    FROM playlist_tune pt
    INNER JOIN tune t ON pt.tune_ref = t.id
    INNER JOIN playlist p ON pt.playlist_ref = p.playlist_id
    WHERE p.user_ref = ${userId}
    AND t.genre IS NOT NULL
  `);
  
  // 3. Combine both sources (prevents orphaning existing playlist data)
  return [...new Set([
    ...explicit.map(g => g.genreId),
    ...implicit.map(g => g.genre)
  ])];
}
```

---

### Critical Scenario: Why Postgres Query is Required

**Concrete Example**:

1. **Day 1**: User selects [Irish, Scottish, Folk] in genre settings
2. **Day 2**: User adds 50 Folk tunes to "My Folk Favorites" playlist
3. **Day 3**: User changes genre selection to [Irish, Scottish] (removes Folk)
4. **Day 4**: User does cold start sync (new device or cleared browser data)

**What happens without the Postgres query**:
```
❌ Calculate genre filter
   - user_genre_selection: [Irish, Scottish]
   - playlist.genre_default: [Irish, Scottish]
   - Effective filter: [Irish, Scottish]
   
❌ Main sync runs
   - Fetches only Irish and Scottish tunes
   - Folk tunes NOT synced
   
❌ When sync reaches playlist_tune
   - Tries to sync "My Folk Favorites" playlist
   - 50 playlist_tune rows reference Folk tunes
   - Folk tunes don't exist locally
   - ORPHANS! Playlist is broken
```

**What happens WITH the Postgres query**:
```
✅ Calculate genre filter
   - user_genre_selection: [Irish, Scottish]
   - playlist.genre_default: [Irish, Scottish]
   - Postgres playlist_tune query: [Irish, Scottish, Folk] ← Finds deselected genre!
   - Effective filter: [Irish, Scottish, Folk]
   
✅ Main sync runs
   - Fetches Irish, Scottish, AND Folk tunes
   - All 50 Folk tunes synced
   
✅ When sync reaches playlist_tune
   - Syncs "My Folk Favorites" playlist
   - All 50 playlist_tune rows find their tunes
   - NO ORPHANS! Playlist works correctly
```

**Key insight**: User's `playlist_tune` data represents a **stronger commitment** than `user_genre_selection`. You can deselect a genre in settings, but if you have tunes from that genre in playlists, you still need them.

---

### Step 3: Orchestrate Pre-Sync in requestOverridesProvider

**The `requestOverridesProvider` callback orchestrates the pre-fetch and filter calculation:**

**Guard**: Only run this callback for authenticated users. If there is no active session or no provider configured, skip pre-sync and run the normal sync without a genre filter.

```typescript
// In AuthContext or sync initialization
const syncEngine = new SyncEngine({
  // ... existing config
  requestOverridesProvider: async () => {
    const isInitialSync = !syncEngine.lastSyncTimestamp;
    
    // 1. Pre-fetch metadata using direct worker calls
    await preSyncMetadataViaWorker(workerClient, userId);
    
    // 2. Calculate genre filter from now-populated local state
    const genreFilter = isInitialSync
      ? await getEffectiveGenreFilter_InitialSync(db, supabase, userId)
      : await getEffectiveGenreFilter_IncrementalSync(db, userId);
    
    // 3. Return filter for main sync
    return {
      genreFilter: {
        selectedGenreIds: genreFilter,
        playlistGenreIds: genreFilter,
      }
    };
  }
});
```

**Pre-Sync Helper (Calls Worker Directly)**:

```typescript
async function preSyncMetadataViaWorker(
  workerClient: WorkerClient,
  userId: string
): Promise<void> {
  // Pull only metadata tables using pullTables override
  const response = await workerClient.sync([], undefined, {
    overrides: {
      pullTables: ['user_profile', 'user_genre_selection', 'playlist']
    }
  });
  
  // Apply changes to local DB (user_profile, user_genre_selection, playlist)
  await applyChangesToLocalDB(response.changes);
}
```

**Key Points**:
- ✅ `requestOverridesProvider` orchestrates pre-fetch before returning filter
- ✅ Uses direct worker call with `pullTables` override for metadata
- ✅ Existing sync engine runs normally after provider returns
- ✅ Genre filter restricts rows from `tune` and `reference` tables only
- ✅ Table ordering and FK constraints handled by existing engine

---

### Summary: How Genre Filtering Works

**The genre filter is just a filter, not a new sync sequence:**

**When it applies**: Only when `requestOverridesProvider` is configured and the user is authenticated. Otherwise, sync runs normally with no filter.

1. **Pre-sync step** (new): Fetch 3 small metadata tables (~20 rows, <50ms)
2. **Calculate filter** (new): Combine user_genre_selection + playlist.genre_default + Postgres playlist_tune query
3. **Run existing sync** (unchanged): Sync engine runs normally with genre filter applied via `requestOverridesProvider`

**What changes**:
- Worker applies genre filter to `tune` and `reference` queries: `.in('genre', allowedGenres)`
- Result: 1,500 records synced instead of 6,925

**What stays the same**:
- Table sync order (existing FK constraint handling)
- When `playlist_tune` syncs relative to `tune` (existing engine controls this)
- Conflict resolution, outbox, error handling (all unchanged)

**Key Invariants**:
1. ✅ Metadata pre-fetch happens before main sync (20 rows, fast)
2. ✅ Genre filter includes THREE sources: user_genre_selection + playlist.genre_default + Postgres playlist_tune genres
3. ✅ Initial sync queries POSTGRES for playlist_tune genres (local SQLite is empty)
4. ✅ Incremental sync queries LOCAL SQLite for playlist_tune genres (already synced)
5. ✅ Existing sync engine handles all table ordering and FK constraints
6. ✅ No orphans possible: filter always includes genres needed by existing playlist_tune rows
  const isInitialSync = await isFirstSync(userId);
  
  // PHASE 0: Pre-fetch metadata (ALWAYS FIRST)
  console.log('[Sync] Phase 0: Pre-fetching metadata...');
  await preSyncMetadata(userId);
  
  // PHASE 1: Calculate genre filter
  console.log('[Sync] Phase 1: Calculating genre filter...');
  const genreFilter = isInitialSync
    ? await getEffectiveGenreFilter_InitialSync(db, postgresClient, userId)
    : await getEffectiveGenreFilter_IncrementalSync(db, userId);
  
  console.log(`[Sync] Genre filter: ${genreFilter.length} genres`);
  console.log(`[Sync] Genres: ${genreFilter.join(', ')}`);
  
  // PHASE 2: Main sync with genre filter
  console.log('[Sync] Phase 2: Syncing filtered data...');
  await mainSync(userId, genreFilter);
  
  // PHASE 3: Post-sync relationships
  console.log('[Sync] Phase 3: Syncing relationship tables...');
  await postSyncRelationships(userId);
  
  console.log('[Sync] Complete!');
}
```

**Critical detail**: Initial sync requires **one Postgres query** in Phase 1 to discover genres from existing `playlist_tune` relationships. This is a small, targeted query that prevents orphans.

**Key Invariants**:
1. ✅ Metadata tables (`user_genre_selection`, `playlist`) sync FIRST, before genre filter is calculated
2. ✅ Genre filter queries LOCAL SQLite data for metadata, but POSTGRES for `playlist_tune` genres (on cold start)
3. ✅ **Initial sync** includes genres from: `user_genre_selection` + `playlist.genre_default` + **Postgres `playlist_tune` → `tune.genre`**
4. ✅ **Incremental sync** includes genres from: `user_genre_selection` + `playlist.genre_default` + **LOCAL `playlist_tune` → `tune.genre`**
5. ✅ Main data tables (`tune`, `reference`) sync with genre filter applied
6. ✅ Relationship tables (`playlist_tune`) sync LAST to avoid orphan references (all referenced tunes already exist)
7. ✅ No orphans possible: genre filter always includes all genres needed by `playlist_tune`, even if user deselected them

---

## Phase 3: Parallel Pagination (Performance)

**Objective**: Reduce network latency from 49 sequential requests to parallel batches

### 3.1 Current Bottleneck

Looking at Image 1 (Cloudflare logs), the 49 requests are sequential:
- 10:46:08.279 → 10:46:08.283 → 10:46:08.323 → ...
- Each request waits for previous to complete
- ~1.5s per request × 49 = ~73s total

**Location**: `oosync/worker-client.ts` (likely in pagination loop)

### 3.2 Proposed Solution: Batched Parallel Fetching

```typescript
// Current (sequential):
async function pullAllPages(userId: string): Promise<Row[]> {
  const allRows = [];
  let cursor = null;
  
  do {
    const response = await workerClient.syncDown(userId, cursor);
    allRows.push(...response.changes);
    cursor = response.nextCursor;
  } while (cursor);
  
  return allRows;
}

// Proposed (parallel batches):
async function pullAllPagesBatched(userId: string): Promise<Row[]> {
  const PARALLEL_BATCH_SIZE = 5; // Fetch 5 pages at once
  const allRows = [];
  let cursors = [null]; // Start with initial cursor
  
  while (cursors.length > 0) {
    // Fetch up to PARALLEL_BATCH_SIZE pages in parallel
    const batch = cursors.splice(0, PARALLEL_BATCH_SIZE);
    const responses = await Promise.all(
      batch.map(cursor => workerClient.syncDown(userId, cursor))
    );
    
    // Collect rows and next cursors
    for (const response of responses) {
      allRows.push(...response.changes);
      if (response.nextCursor) {
        cursors.push(response.nextCursor);
      }
    }
  }
  
  return allRows;
}
```

**Expected Improvement**:
- 49 pages ÷ 5 parallel = 10 batches
- 10 batches × 1.5s = 15s (vs 73s sequential)
- **5x speedup** on network time

**Constraints**:
- ⚠️ Worker rate limits: Check Cloudflare concurrent request limits
- ⚠️ Database connection pool: Supabase may throttle parallel queries
- ✅ Generic: No app-specific logic needed

### 3.3 Adaptive Parallelism

```typescript
interface PullConfig {
  maxParallelPages: number; // Default: 5, can reduce if errors occur
  retryOnRateLimit: boolean; // Auto-reduce parallelism on 429
}

async function pullWithAdaptiveParallelism(
  userId: string,
  config: PullConfig
): Promise<Row[]> {
  let parallelism = config.maxParallelPages;
  
  // ... existing logic, but catch rate limit errors
  try {
    const responses = await Promise.all(/* ... */);
  } catch (error) {
    if (isRateLimitError(error) && parallelism > 1) {
      console.warn(`[Sync] Rate limited, reducing parallelism: ${parallelism} → ${parallelism - 1}`);
      parallelism -= 1;
      // Retry with lower parallelism
    }
  }
}
```

---

## Phase 4: Sync Engine Changes

### 4.1 Integrate requestOverridesProvider

**File**: `oosync/src/sync/engine.ts`

**Current**: `requestOverridesProvider` exists but may not be fully wired

**Changes**:
```typescript
// In syncWithWorker method (around line 330)
const requestOverrides =
  options?.requestOverrides ??
  (this.config.requestOverridesProvider
    ? await this.config.requestOverridesProvider()
    : undefined);

// Pass to worker client
const workerRequest = {
  userId: this.userId,
  lastSyncTimestamp: this.lastSyncTimestamp,
  pendingChanges: sortedItems,
  overrides: requestOverrides, // ← Add this
};
```

### 4.2 Add Diagnostic Logging

**File**: `oosync/src/sync/engine.ts`

```typescript
if (SYNC_DIAGNOSTICS) {
  console.log(`[SyncDiag] begin`, {
    user: this.userId.substring(0, 8),
    type: isInitialSync ? 'INITIAL' : 'INCREMENTAL',
    lastSync: this.lastSyncTimestamp,
    pendingOutbox: sortedItems.length,
    genreFilter: requestOverrides?.genreFilter ? {
      selected: requestOverrides.genreFilter.selectedGenreIds.length,
      playlist: requestOverrides.genreFilter.playlistGenreIds.length,
    } : null,
  });
}
```

---

## Implementation Roadmap

### Sprint 1: Quick Wins (1-2 days)
**Goal**: 80% improvement with minimal code changes

- [ ] Create Postgres index migration
- [ ] Deploy indexes to staging
- [ ] Test with Supabase query performance advisor
- [ ] Verify 20-30s queries → <200ms
- [ ] Deploy to production

**Expected Result**: 65s → 15-20s load time

### Sprint 2: Genre Filtering (3-5 days) — **COMPLETED**
**Goal**: Reduce data transfer by 75%

**Implementation Status**: ✅ **DONE**

- [x] Implement metadata pre-sync sequence:
  - [x] Phase 0: Pre-sync metadata fetch (`user_profile`, `user_genre_selection`, `playlist`, `instrument`, `genre`)
  - [x] Phase 1: Calculate effective genre filter from LOCAL SQLite (uses Postgres RPC for initial sync playlist_tune genres)
  - [x] Phase 2: Main sync with genre filter applied
- [x] Implement `preSyncMetadataViaWorker()` with FK deferral/retry logic (`src/lib/sync/genre-filter.ts`)
- [x] Implement `getEffectiveGenreFilterInitialSync()` for cold start (queries Postgres for playlist_tune genres)
- [x] Implement `getEffectiveGenreFilterIncrementalSync()` for warm sync (queries local SQLite)
- [x] Wire up `requestOverridesProvider` in AuthContext to orchestrate pre-sync + filter calculation
- [x] **NEW: Create RPC functions for server-side filtering**:
  - [x] `sync_get_user_notes(p_user_id, p_genre_ids, p_after_timestamp, p_limit, p_offset)`
  - [x] `sync_get_user_references(p_user_id, p_genre_ids, p_after_timestamp, p_limit, p_offset)`
  - [x] Migration: `supabase/migrations/20260130000000_add_sync_rpc_functions.sql`
- [x] **NEW: Update worker config** (`worker/src/generated/worker-config.generated.ts`):
  - [x] Changed `note` table from `orNullEqUserId` to `rpc` (uses `sync_get_user_notes`)
  - [x] Changed `reference` table from `orNullEqUserId` to `rpc` (uses `sync_get_user_references`)
- [x] Add RPC handling to worker (`oosync/worker/src/index.ts`)
- [x] **NEW: Add orphan purge logic** (`src/lib/sync/genre-filter.ts`):
  - [x] `purgeOrphanedAnnotations()` - removes notes/references for deselected genres
  - [x] Called from Settings → Catalog & Sync after genre removal
- [x] **NEW: Add E2E test coverage** (`e2e/tests/annotations-filter-001-rpc-genre-sync.spec.ts`):
  - [x] Test A: Onboarding filters annotations server-side
  - [x] Test B: Settings genre addition syncs new annotations
  - [x] Test C: Settings genre removal purges orphaned annotations
  - [x] Test D: Private tunes sync regardless of genre filter
- [x] Test with 2-genre vs 25-genre selections
- [x] Validate no data loss on genre changes (orphan prevention via Postgres query + purge)
- [x] Verify existing sync engine handles table ordering correctly (no engine changes needed)

**Actual Result**: 
- Server-side filtering via RPC functions (more efficient than client-side)
- Orphan prevention: Initial sync queries Postgres playlist_tune genres, incremental uses local
- Orphan cleanup: purgeOrphanedAnnotations() runs after genre removal in settings
- E2E tests validate all scenarios
- Expected improvement: 1,500 records vs 6,925 (75% reduction when using selective genre filter)

### Sprint 3: Parallel Pagination (2-3 days)
**Goal**: Reduce network latency by 5x

- [ ] Implement batched parallel fetching in worker-client
- [ ] Add rate limit handling
- [ ] Test with Cloudflare concurrent limits
- [ ] Add adaptive parallelism
- [ ] Monitor Supabase connection pool

**Expected Result**: 5-8s → 2-3s load time

---

## Success Metrics

**Before Optimization**:
- Initial sync: 65 seconds
- Records pulled: 6,925
- Slow queries: 3-4 queries at 20-30s each
- Network: 49 sequential requests

**After Phase 1 (Indexes)**:
- Initial sync: 15-20 seconds
- Records pulled: 6,925 (same)
- Slow queries: 0 (all <200ms)
- Network: 49 sequential requests (same)

**After Phase 2 (Genre Filter)**:
- Initial sync: 5-8 seconds  
- Records pulled: 1,500 (75% reduction)
- Slow queries: 0
- [ ] Implement `preSyncMetadataViaWorker()` helper (direct worker call for user_profile, user_genre_selection, playlist)
- [ ] Implement `applyChangesToLocalDB()` helper (apply metadata changes to SQLite)
- [ ] Implement `getEffectiveGenreFilter_InitialSync()` (queries Postgres for playlist_tune genres)
- [ ] Implement `getEffectiveGenreFilter_IncrementalSync()` (queries local SQLite for playlist_tune genres)
- [ ] Wire up `requestOverridesProvider` in AuthContext to orchestrate pre-sync + filter calculation
- [ ] Add `pullTables` support to worker if not already present
- [ ] Add genre filter logic to worker (`oosync/worker/src/index.ts`)
- [ ] Test with 2-genre vs 25-genre selections
- [ ] Validate no data loss on genre changes (orphan prevention via Postgres query)
- [ ] Verify existing sync engine handles table ordering correctly (no engine changes needed)
```sql
-- Before index
EXPLAIN ANALYZE 
SELECT * FROM public.reference 
WHERE genre_id IN ('genre-1', 'genre-2')
AND (user_ref IS NULL OR user_ref = 'user-123');

-- Expected: Seq Scan, 20-30s
-- After index: Index Scan, <200ms
```

### Genre Filter Testing
1. User with 2 genres selected → expect ~500 records
2. User with 25 genres selected → expect ~6,925 records
3. User changes genre selection → verify orphan cleanup
4. User creates playlist with new genre → verify genre added to filter

### Parallel Testing
1. Monitor Cloudflare worker logs for concurrent requests
2. Verify no rate limit errors (429)
3. Check Supabase connection pool metrics
4. Measure end-to-end latency with parallelism 1, 3, 5, 10

---

## Risks & Mitigations

### Risk 1: Orphaned Data After Genre Deselection
**Problem**: User deselects genre → tunes deleted locally → breaks playlist_tune references

**Mitigation**: Two-phase filter keeps playlist genres even if deselected
```typescript
// Always include genres from existing playlists
const effectiveGenres = [
  ...selectedGenres,
  ...playlistGenres, // ← Prevents orphaning
];
```

### Risk 2: Worker Rate Limits
**Problem**: Parallel requests may hit Cloudflare/Supabase limits

**Mitigation**: 
- Start conservative (parallelism = 3)
- Add adaptive backoff on 429
- Monitor error rates in production

### Risk 3: Index Bloat
**Problem**: New indexes increase write cost and storage

**Mitigation**:
- Use partial indexes (`WHERE genre_id IS NOT NULL`)
- Monitor index size in Supabase
- Expected overhead: <5% on write operations

### Risk 4: Breaking oosync Genericity
**Problem**: Genre filtering is app-specific

**Mitigation**:
- All app logic in `src/lib/sync/genre-filter.ts`
- Worker only applies generic filters from overrides
- oosync has no knowledge of "genres" or "playlists"

---

## Open Questions

1. **Supabase Index Advisor**: How to interpret results? Need team training?
2. **Cloudflare Rate Limits**: What's the actual concurrent request limit?
3. **Postgres Connection Pool**: Can Supabase handle 5 concurrent queries from same user?
4. **Reference Table Genre Column**: Is `reference.genre_id` always set? Or do some references lack genre?
5. **Migration Strategy**: Deploy indexes during maintenance window or can be done live?

---

## Next Steps

1. **Validate Plan**: Review with team, adjust roadmap
2. **Create Issue**: Transfer plan to GitHub issue with checklist
3. **Branch**: `feat/genre-aware-sync-optimization`
4. **Sprint 1**: Start with index migration (quick win)
5. **Measure**: Baseline metrics before each phase

---

## Files to Modify

### Phase 1 (Indexes) - NOT YET IMPLEMENTED
- `supabase/migrations/YYYYMMDD_add_genre_filter_indexes.sql` (NEW)

### Phase 2 (Genre Filter) - ✅ **COMPLETED**
**App-side**:
- ✅ `src/lib/sync/genre-filter.ts` - Created with:
  - `preSyncMetadataViaWorker()` - Pre-fetches metadata with FK deferral logic
  - `getEffectiveGenreFilterInitialSync()` - Cold start filter (queries Postgres RPC)
  - `getEffectiveGenreFilterIncrementalSync()` - Warm filter (queries local SQLite)
  - `buildGenreFilterOverrides()` - Main entry point for genre filter calculation
  - `purgeOrphanedAnnotations()` - Cleanup for removed genres
- ✅ `src/lib/auth/AuthContext.tsx` - Wired up `requestOverridesProvider` callback
- ✅ `src/lib/db/queries/user-genre-selection.ts` - Helper functions for genre queries
- ✅ `src/routes/user-settings/catalog-sync.tsx` - Added purgeOrphanedAnnotations call after genre removal

**Worker-side**:
- ✅ `oosync/worker/src/index.ts` - Added RPC handling for genre-filtered tables
- ✅ `oosync/worker/src/sync-schema.ts` - Added `rpc` pull rule type
- ✅ `worker/src/generated/worker-config.generated.ts` - Changed note/reference to use RPC

**Database**:
- ✅ `sql_scripts/sync_get_user_notes.sql` - RPC for genre-filtered note sync
- ✅ `sql_scripts/sync_get_user_references.sql` - RPC for genre-filtered reference sync
- ✅ `supabase/migrations/20260130000000_add_sync_rpc_functions.sql` - Migration for RPCs
- ✅ `supabase/migrations/20260127000000_add_playlist_tune_genre_rpc.sql` - Fixed redundant auth check

**Testing**:
- ✅ `e2e/tests/annotations-filter-001-rpc-genre-sync.spec.ts` - Comprehensive E2E test suite
- ✅ `src/test/test-api.ts` - Added test helpers for annotation testing

### Phase 3 (Parallel) - NOT YET IMPLEMENTED
- `oosync/worker-client.ts` (batched parallel fetching)
- `oosync/src/sync/engine.ts` (integrate parallel client)

### Phase 4 (Diagnostics) - NOT YET IMPLEMENTED
- `oosync/src/sync/engine.ts` (add logging)
- `src/contexts/AuthContext.tsx` (expose sync metrics to UI)
