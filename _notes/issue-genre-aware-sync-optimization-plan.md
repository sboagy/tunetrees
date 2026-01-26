# Genre-Aware Sync Optimization Plan

**Issue**: Initial sync takes 65+ seconds, downloading 6,925 records (3,006 catalog items) when user only needs ~500 records based on selected genres.

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

### 2.1 Design: SyncRequestOverrides Extension

**Strategy**: Use existing `requestOverridesProvider` callback pattern in oosync to inject genre filter at runtime.

```typescript
// App-side (src/lib/sync/genre-filter.ts)
interface GenreFilterOverrides {
  selectedGenreIds: string[];
  playlistGenreIds: string[]; // From user's existing playlist_tune data
}

async function buildGenreFilterOverrides(
  db: SqliteDatabase, 
  userId: string
): Promise<SyncRequestOverrides> {
  // 1. Fetch user's selected genres from user_genre_selection
  const selectedGenres = await db
    .select({ genreId: userGenreSelection.genreId })
    .from(userGenreSelection)
    .where(eq(userGenreSelection.userId, userId));
  
  // 2. Fetch genres from user's existing playlists (for incremental sync)
  //    This solves chicken-egg: we only need to preserve genres already in local DB
  const playlistGenres = await db.execute(sql`
    SELECT DISTINCT t.genre 
    FROM playlist_tune pt
    INNER JOIN tune t ON pt.tune_ref = t.id
    WHERE pt.playlist_ref IN (
      SELECT playlist_id FROM playlist WHERE user_ref = ${userId}
    )
    AND t.genre IS NOT NULL
  `);
  
  return {
    genreFilter: {
      selectedGenreIds: selectedGenres.map(g => g.genreId),
      playlistGenreIds: playlistGenres.map(g => g.genre),
    }
  };
}
```

### 2.2 Worker Implementation (Generic)

**Location**: `oosync/worker/src/index.ts` (or new `oosync/worker/src/filters.ts`)

```typescript
// Worker receives overrides in request body
interface SyncRequest {
  // ... existing fields
  overrides?: {
    genreFilter?: {
      selectedGenreIds: string[];
      playlistGenreIds: string[];
    };
  };
}

// Apply filter to pull queries (generic pattern)
function applyGenreFilter(
  query: PostgresQuery,
  tableName: string,
  genreFilter?: { selectedGenreIds: string[], playlistGenreIds: string[] }
): PostgresQuery {
  if (!genreFilter) return query;
  
  // Genre filtering logic based on table
  if (tableName === 'tune') {
    // Filter tunes by selected genres OR genres already in user's playlists
    const allowedGenres = [
      ...genreFilter.selectedGenreIds,
      ...genreFilter.playlistGenreIds
    ];
    return query.in('genre', allowedGenres);
  }
  
  if (tableName === 'reference') {
    // Filter references by genre_id (if column exists)
    const allowedGenres = [
      ...genreFilter.selectedGenreIds,
      ...genreFilter.playlistGenreIds
    ];
    return query.in('genre_id', allowedGenres);
  }
  
  // Other tables: no filtering
  return query;
}
```

**Constraints**:
- ✅ Generic: No hardcoded table/column names in oosync core
- ✅ Optional: Falls back to full pull if no overrides provided
- ✅ App-controlled: Genre logic lives in app, oosync just applies filters

### 2.3 Chicken-Egg Resolution Strategy

**Problem**: To filter tunes by genre, we need to know genres. But genres come from:
1. `user_genre_selection` (explicit selections)
2. `playlist_tune` → `tune.genre` (implicit from existing playlists)

**Solution**: Two-phase filter

**Initial Sync (Cold Start)**:
```
1. Pull user_genre_selection first (small table, <10 rows)
2. Pull tunes filtered by selected genres only
3. Pull references filtered by selected genres only
4. Pull playlist_tune (will only reference tunes we already have)
```

**Incremental Sync (Warm)**:
```
1. Fetch genres from local playlist_tune JOIN tune (already in SQLite)
2. Combine with user_genre_selection
3. Pull only tunes/references matching combined filter
4. Preserves existing playlist data while respecting new selections
```

**Code**:
```typescript
async function getEffectiveGenreFilter(
  db: SqliteDatabase,
  userId: string,
  isInitialSync: boolean
): Promise<string[]> {
  if (isInitialSync) {
    // Cold start: only explicit selections
    const selected = await db
      .select({ genreId: userGenreSelection.genreId })
      .from(userGenreSelection)
      .where(eq(userGenreSelection.userId, userId));
    return selected.map(g => g.genreId);
  } else {
    // Incremental: explicit + implicit from playlists
    const explicit = await db
      .select({ genreId: userGenreSelection.genreId })
      .from(userGenreSelection)
      .where(eq(userGenreSelection.userId, userId));
    
    const implicit = await db.execute(sql`
      SELECT DISTINCT t.genre
      FROM playlist_tune pt
      INNER JOIN tune t ON pt.tune_ref = t.id
      INNER JOIN playlist p ON pt.playlist_ref = p.playlist_id
      WHERE p.user_ref = ${userId}
      AND t.genre IS NOT NULL
    `);
    
    return [...new Set([
      ...explicit.map(g => g.genreId),
      ...implicit.map(g => g.genre)
    ])];
  }
}
```

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

### Sprint 2: Genre Filtering (3-5 days)
**Goal**: Reduce data transfer by 75%

- [ ] Implement `buildGenreFilterOverrides()` in app
- [ ] Wire up `requestOverridesProvider` in AuthContext
- [ ] Add genre filter logic to worker (generic)
- [ ] Test with 2-genre vs 25-genre selections
- [ ] Validate no data loss on genre changes

**Expected Result**: 15s → 5-8s load time (1,500 records vs 6,925)

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
- Network: 10-15 sequential requests

**After Phase 3 (Parallel)**:
- Initial sync: 2-3 seconds
- Records pulled: 1,500
- Slow queries: 0
- Network: 3-4 parallel batches

---

## Testing Strategy

### Index Testing
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

### Phase 1 (Indexes)
- `supabase/migrations/YYYYMMDD_add_genre_filter_indexes.sql` (NEW)

### Phase 2 (Genre Filter)
- `src/lib/sync/genre-filter.ts` (NEW)
- `src/contexts/AuthContext.tsx` (wire up requestOverridesProvider)
- `oosync/worker/src/index.ts` (add generic filter logic)
- `oosync/worker/src/types.ts` (add SyncRequestOverrides interface)

### Phase 3 (Parallel)
- `oosync/worker-client.ts` (batched parallel fetching)
- `oosync/src/sync/engine.ts` (integrate parallel client)

### Phase 4 (Diagnostics)
- `oosync/src/sync/engine.ts` (add logging)
- `src/contexts/AuthContext.tsx` (expose sync metrics to UI)
