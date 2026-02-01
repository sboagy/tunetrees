# Implementation Plan: RPC-Based Filtering for Tune Child Tables

## Overview

Implement server-side filtering via Postgres RPCs for tables with `tune_ref` foreign keys that need genre-aware filtering: `note`, `reference`.  (We refer to these tables as "annotations" for the purpose of this plan.)

**Scope**: ONLY child tables with JOIN requirements. Tune table filtering is handled separately via compound rules (see `compound-rule-tune-filtering.md`).

**Note on `practice_record`**: Initially considered for this plan, but `practice_record` is already correctly filtered by `playlist_ref` via `inCollection` rule ([worker-config.generated.ts:89-93](worker/src/generated/worker-config.generated.ts#L89-L93)). Genre filtering is NOT needed since practice records belong to user playlists.

Combined with client-side purge **only** when user removes genres in Settings.

## Why RPCs Are Required for Child Tables

**Problem**: These tables require filtering based on their parent tune's genre, which requires a JOIN:

```sql
-- Can't express this with simple column filters
SELECT n.* 
FROM note n
JOIN tune t ON n.tune_ref = t.id
WHERE (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
   OR t.private_for = p_user_id::TEXT
```

**Why compound rules won't work here**:
- Compound rules operate on the table's own columns
- `note`, `reference`, `practice_record` don't have a `genre` column
- They only have `tune_ref` → need to JOIN to `tune` table to check genre
- JOIN logic can't be expressed in current PullTableRule system

**Why RPCs are appropriate**:
- Server-side efficiency (filter before transfer, not after)
- Portable (no hardcoded schema in oosync core)
- Extensible (can add more filter params without changing oosync)

## Implementation Scope

**In scope**:
- ✅ Create RPCs for note, reference tables (NOT practice_record - already filtered by playlist)
- ✅ Add RPC pull rule support to oosync worker
- ✅ Update worker config to use RPC rules for these 2 tables
- ✅ Add client-side purge for Settings genre removal

**Out of scope** (handled by separate plan or already working):
- ❌ Tune table filtering (use compound rules instead - see `compound-rule-tune-filtering.md`)
- ❌ Genre/tune_type catalog table filtering (already handled by two-phase sync)
- ❌ `practice_record` filtering (already correctly filtered by `playlist_ref` via `inCollection` rule)

## Implementation Steps

### Phase 1: Create Postgres RPCs for Child Tables Only

**Files to create**: 
- `sql_scripts/sync_get_user_notes.sql`
- `sql_scripts/sync_get_user_references.sql`

**RPC signatures**:
```sql
sync_get_user_notes(p_user_id UUID, p_genre_ids TEXT[], p_after_timestamp TIMESTAMPTZ DEFAULT NULL)
sync_get_user_references(p_user_id UUID, p_genre_ids TEXT[], p_after_timestamp TIMESTAMPTZ DEFAULT NULL)
```

**Note**: `p_after_timestamp` parameter supports incremental sync (see clarification below).

**Child table RPC logic** (example for note):
```sql
-- sync_get_user_notes.sql
CREATE OR REPLACE FUNCTION sync_get_user_notes(
  p_user_id UUID,
  p_genre_ids TEXT[],
  p_after_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF note
LANGUAGE sql
STABLE
AS $$
  SELECT n.*
  FROM note n
  JOIN tune t ON n.tune_ref = t.id
  WHERE (
    -- Tunes in selected genres (public or user's private)
    (t.genre = ANY(p_genre_ids) AND t.private_for IS NULL)
    OR t.private_for = p_user_id::TEXT
  )
  AND (
    -- Notes visible to user (public or user's own)
    n.user_ref IS NULL OR n.user_ref = p_user_id::TEXT
  )
  AND (
    -- Incremental sync: only rows updated after timestamp (if provided)
    p_after_timestamp IS NULL OR n.updated_at > p_after_timestamp
  );
$$;
```

**Similar logic for**:
- `sync_get_user_references.sql`: Same JOIN + filters (replace `note` with `reference`)

### Phase 2: Add RPC Pull Rule Support to oosync

**File**: [oosync/worker/src/sync-schema.ts](oosync/worker/src/sync-schema.ts#L74-L78)

**Changes**:
1. Add RPC rule type to `PullTableRule`:
   ```typescript
   export type PullTableRule =
     | { kind: "eqUserId"; column: string }
     | { kind: "orNullEqUserId"; column: string }
     | { kind: "inCollection"; column: string; collection: string }
     | { kind: "rpc"; functionName: string; params: string[] };
   ```

2. Update `buildUserFilter` to return empty array for RPC rules (SQL handled by RPC):
   ```typescript
   const rule = getPullRule(params.tableName);
   if (rule) {
     if (rule.kind === "rpc") {
       return []; // RPC handles all filtering
     }
     // ... existing eqUserId, orNullEqUserId, inCollection logic
   }
   ```

3. **Remove hardcoded tune genre filtering** from [sync-schema.ts#L264-L298](oosync/worker/src/sync-schema.ts#L264-L298):
   - Delete the `isCatalogTable` special-case logic for tune/genre/tune_type
   - This logic moves to Postgres RPCs (boundary violation fix)

**File**: [oosync/worker/src/index.ts](oosync/worker/src/index.ts)

**Changes**:
1. Export `getPullRule` function (needed for RPC detection):
   ```typescript
   let getPullRule: (tableName: string) => PullTableRule | undefined = 
     () => notInitialized("getPullRule");
   ```

2. Initialize in `initSyncWorker`:
   ```typescript
   getPullRule = schema.getPullRule;
   ```

3. Create `fetchViaRPC` helper function:
   ```typescript
   async function fetchViaRPC(params: {
     functionName: string;
     rpcParams: Record<string, unknown>;
     ctx: Context;
   }): Promise<Record<string, unknown>[]> {
     const { data, error } = await params.ctx.postgresClient
       .rpc(params.functionName, params.rpcParams);
     
     if (error) throw new Error(`RPC ${params.functionName} failed: ${error.message}`);
     return data || [];
   }
   ```

4. Modify `fetchTableForInitialSyncPage` to detect RPC rules:
   ```typescript
   async function fetchTableForInitialSyncPage(...) {
     const rule = getPullRule(tableName);
     
     if (rule?.kind === "rpc") {
       const rpcParams: Record<string, unknown> = { p_user_id: ctx.userId };
       
       // Map params: "userId" -> already in p_user_id, "genreIds" -> p_genre_ids
       if (rule.params.includes("genreIds")) {
         const genreSet = ctx.collections.selectedGenres;
         rpcParams.p_genre_ids = genreSet ? Array.from(genreSet) : [];
       }
       
       const rows = await fetchViaRPC({
         functionName: rule.functionName,
         rpcParams,
         ctx
       });
       
       return { rows, hasMore: false }; // RPCs return all matching rows
     }
     
     // ... existing SQL builder logic for non-RPC rules
   }
   ```

5. **Incremental sync**: Similar detection/handling in `fetchTableForIncrementalSyncPage`:
   ```typescript
   async function fetchTableForIncrementalSyncPage(tableName, after, ctx, ...) {
     const rule = getPullRule(tableName);
     
     if (rule?.kind === "rpc") {
       const rpcParams: Record<string, unknown> = {
         p_user_id: ctx.userId,
         p_after_timestamp: after  // Pass timestamp for incremental sync
       };
       
       if (rule.params.includes("genreIds")) {
         rpcParams.p_genre_ids = ctx.collections.selectedGenres 
           ? Array.from(ctx.collections.selectedGenres) 
           : [];
       }
       
       const rows = await fetchViaRPC({ functionName: rule.functionName, rpcParams, ctx });
       return { rows, hasMore: false };
     }
     
     // ... existing SQL builder logic
   }
   ```

6. **Genre filter change detection**: Add support for client-side flag to ignore table-level change log when genres change:
   ```typescript
   // In sync request interface
   interface SyncRequest {
     userId: string;
     // ... existing fields
     ignoreTableChangeLog?: string[];  // Tables to force full re-fetch (ignore sync_change_log)
   }
   
   // Worker uses this flag to skip table timestamp check
   if (options.ignoreTableChangeLog?.includes(tableName)) {
     // Force full RPC re-fetch by passing null timestamp
     return fetchTableForIncrementalSyncPage(tableName, null, ctx);
   }
   ```

### Phase 3: Update Worker Config

**File**: [worker/src/generated/worker-config.generated.ts](worker/src/generated/worker-config.generated.ts)

**Manual edits** (until codegen updated):
```typescript
"note": {
  "kind": "rpc",
  "functionName": "sync_get_user_notes",
  "params": ["userId", "genreIds"]
},
"reference": {
  "kind": "rpc",
  "functionName": "sync_get_user_references",
  "params": ["userId", "genreIds"]
}
```

**Note**: 
- Tune table is NOT included - it uses compound rules instead (see `compound-rule-tune-filtering.md`)
- `practice_record` is NOT included - already correctly filtered by `playlist_ref` via `inCollection` rule

**Future work**: Update [oosync.codegen.config.json](oosync.codegen.config.json) to support RPC rule specification via `tableRuleOverrides`, similar to the approach for compound rules.

### Phase 4: Client-Side Purge Logic (Settings Only)

**File**: [src/lib/sync/genre-filter.ts](src/lib/sync/genre-filter.ts)

**Add purge function**:
```typescript
/**
 * Purges orphaned records from tables with tune_ref foreign keys.
 * ONLY call when user removes genres via Settings → Catalog & Sync tab.
 * Called AFTER sync completes to clean up orphaned records.
 */
export async function purgeOrphanedAnnotations(
  db: SqliteDatabase
): Promise<{ deletedCounts: Record<string, number> }>
```

**Implementation**:
```typescript
const tables = ["note", "reference"];  // NOT practice_record - filtered by playlist
const deletedCounts: Record<string, number> = {};

for (const tableName of tables) {
  const result = await db.delete(schemaTables[tableName])
    .where(notInArray(
      schemaTables[tableName].tuneRef,
      db.select({ id: schemaTables.tune.id }).from(schemaTables.tune)
    ));
  
  deletedCounts[tableName] = result.rowsAffected;
}

return { deletedCounts };
```

**Integration point**: [src/routes/user-settings/catalog-sync.tsx:103-160](src/routes/user-settings/catalog-sync.tsx#L103-L160)

**Trigger logic** (Option B - purge AFTER sync completes):
```typescript
// When user changes genres in Settings → Catalog & Sync:
async function handleGenreChanges(newGenreSelection: string[]) {
  // 1. Update user_genre_selection in DB
  await updateUserGenreSelection(newGenreSelection);
  
  // 2. Trigger catalog sync with flag to ignore table change log for annotation tables
  const syncOptions = {
    ignoreTableChangeLog: ['note', 'reference']  // Force full re-fetch due to genre filter change
  };
  await triggerCatalogSync(syncOptions);
  
  // 3. After sync completes, purge orphaned annotations
  const { deletedCounts } = await purgeOrphanedAnnotations(db);
  
  // 4. Show user feedback
  console.log(`Purged orphaned annotations:`, deletedCounts);
}
```

**IMPORTANT**: Do NOT call purge on:
- Onboarding genre selection (server RPC handles filtering from start, no orphans)
- Automatic sync operations (server filtering is sufficient)
- Genre additions (no orphans created when adding genres)

### Phase 5: Testing & Validation

**Prerequisites**: Add test API functions to [src/test/test-api.ts](src/test/test-api.ts) for annotation validation:

```typescript
// Add to window.__ttTestApi:
async function getAnnotationCounts(options?: { tuneId?: string }) {
  const db = await ensureDb();
  const userRef = await resolveUserId(db);
  
  // Count notes (filtered by genre via tune JOIN)
  const noteQuery = options?.tuneId
    ? sql`SELECT COUNT(*) as count FROM note n WHERE n.tune_ref = ${options.tuneId}`
    : sql`
        SELECT COUNT(*) as count 
        FROM note n
        JOIN tune t ON n.tune_ref = t.id
        WHERE (n.user_ref IS NULL OR n.user_ref = ${userRef})
          AND t.deleted = 0
      `;
  
  const noteRows = await db.all<{ count: number }>(noteQuery);
  
  // Count references (same pattern)
  const refQuery = options?.tuneId
    ? sql`SELECT COUNT(*) as count FROM reference r WHERE r.tune_ref = ${options.tuneId}`
    : sql`
        SELECT COUNT(*) as count 
        FROM reference r
        JOIN tune t ON r.tune_ref = t.id
        WHERE (r.user_ref IS NULL OR r.user_ref = ${userRef})
          AND t.deleted = 0
      `;
  
  const refRows = await db.all<{ count: number }>(refQuery);
  
  return {
    notes: Number(noteRows[0]?.count ?? 0),
    references: Number(refRows[0]?.count ?? 0)
  };
}

async function getOrphanedAnnotationCounts() {
  const db = await ensureDb();
  
  // Count notes with tune_ref NOT in tune table
  const orphanedNotes = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM note n
    WHERE n.tune_ref NOT IN (SELECT id FROM tune WHERE deleted = 0)
  `);
  
  // Count references with tune_ref NOT in tune table
  const orphanedRefs = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM reference r
    WHERE r.tune_ref NOT IN (SELECT id FROM tune WHERE deleted = 0)
  `);
  
  return {
    orphanedNotes: Number(orphanedNotes[0]?.count ?? 0),
    orphanedReferences: Number(orphanedRefs[0]?.count ?? 0)
  };
}

async function seedAnnotations(input: {
  tuneId: string;
  noteCount?: number;
  referenceCount?: number;
  userId?: string;
}) {
  const db = await ensureDb();
  const userRef = input.userId ?? (await resolveUserId(db));
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  
  // Seed notes
  for (let i = 0; i < (input.noteCount ?? 0); i++) {
    await db.run(sql`
      INSERT INTO note (id, tune_ref, user_ref, measure, text, created_at, updated_at)
      VALUES (
        ${crypto.randomUUID()},
        ${input.tuneId},
        ${userRef},
        ${i + 1},
        ${"Test note " + (i + 1)},
        ${now},
        ${now}
      )
    `);
  }
  
  // Seed references
  for (let i = 0; i < (input.referenceCount ?? 0); i++) {
    await db.run(sql`
      INSERT INTO reference (id, tune_ref, user_ref, url, description, created_at, updated_at)
      VALUES (
        ${crypto.randomUUID()},
        ${input.tuneId},
        ${userRef},
        ${"https://example.com/ref" + (i + 1)},
        ${"Test reference " + (i + 1)},
        ${now},
        ${now}
      )
    `);
  }
  
  return {
    notesCreated: input.noteCount ?? 0,
    referencesCreated: input.referenceCount ?? 0
  };
}
```

1. **Local Supabase setup**:
   ```bash
   npm run db:local:reset
   # Then manually apply RPC SQL files to local Supabase
   ```

2. **Test scenarios** (using new test API functions):
   
   **A. Onboarding (new user)**:
   - Select 2 genres during onboarding
   - Call `window.__ttTestApi.getAnnotationCounts()` → verify counts match expected (notes/references for selected genres only)
   - Check network payloads (should be filtered server-side)
   - Verify NO purge happens (server filtering sufficient)
   
   **B. Settings genre addition**:
   - Record initial counts: `const before = await window.__ttTestApi.getAnnotationCounts()`
   - Add 1 new genre in Settings → Catalog & Sync
   - Record after counts: `const after = await window.__ttTestApi.getAnnotationCounts()`
   - Verify `after.notes > before.notes` and `after.references > before.references` (new genre's data synced)
   - Verify NO purge happens (no orphans created)
   
   **C. Settings genre removal**:
   - Seed test data: `await window.__ttTestApi.seedAnnotations({ tuneId: <tune-in-removed-genre>, noteCount: 3, referenceCount: 2 })`
   - Record initial: `const before = await window.__ttTestApi.getAnnotationCounts()`
   - Remove 1 genre in Settings → Catalog & Sync
   - Verify sync runs with `ignoreTableChangeLog: ['note', 'reference']` (check network request payload)
   - Record after: `const after = await window.__ttTestApi.getAnnotationCounts()`
   - Verify `after.notes < before.notes` and `after.references < before.references` (orphaned rows purged)
   - Call `window.__ttTestApi.getOrphanedAnnotationCounts()` → verify `{ orphanedNotes: 0, orphanedReferences: 0 }` (purge successful)
   - Check console logs for purge counts
   
   **D. Private tunes (edge case)**:
   - Create private tune (user's `private_for`) in genre NOT selected
   - Seed annotation: `await window.__ttTestApi.seedAnnotations({ tuneId: <private-tune-id>, noteCount: 1 })`
   - Verify private tune syncs (check `getCatalogTuneCountsForUser().filtered` includes it)
   - Call `window.__ttTestApi.getAnnotationCounts({ tuneId: <private-tune-id> })` → verify `{ notes: 1, references: 0 }`
   - Verify note synced with private tune (ignores genre filter)

3. **Verify boundary compliance**:
   ```bash
   # Search for TuneTrees schema references in oosync core
   grep -r "tune\|genre\|note\|reference\|practice" oosync/worker/src/*.ts
   # Should find ZERO hardcoded references (except in tests)
   ```

4. **Performance check**:
   - Compare network payload sizes before/after (should be smaller)
   - Measure initial sync time with 1000+ tunes across 10 genres, user selects 2 genres
   - Verify RPC execution time in Supabase logs (< 100ms expected)

## Success Criteria

- ✅ `note`, `reference` tables filtered server-side via RPC (JOIN to tune)
- ✅ `practice_record` confirmed as already filtered by `playlist_ref` (no changes needed)
- ✅ No RPC for tune table (uses compound rules instead - separate implementation)
- ✅ No hardcoded TuneTrees schema in `oosync/worker/src/*.ts` (portable library)
- ✅ Client purge runs ONLY on Settings genre removal, AFTER sync completes
- ✅ Incremental sync supports genre filter changes via `ignoreTableChangeLog` flag
- ✅ RPCs support `p_after_timestamp` parameter for incremental syncs
- ✅ Sync payload reduced (server-side filtering working)
- ✅ All TypeScript compilation passes
- ✅ E2E tests pass (may need updates for new RPC-based sync)

## Risks & Mitigations

**Risk**: RPC performance with large tune collections (10k+ tunes)
**Mitigation**: Ensure Postgres indices exist:
```sql
CREATE INDEX IF NOT EXISTS idx_note_tune_ref ON note(tune_ref);
CREATE INDEX IF NOT EXISTS idx_reference_tune_ref ON reference(tune_ref);
CREATE INDEX IF NOT EXISTS idx_tune_genre ON tune(genre);
CREATE INDEX IF NOT EXISTS idx_tune_private_for ON tune(private_for);
```
**Action**: Verify these indices exist in migrations or create if needed.

**Risk**: Purge deletes data user wants to keep
**Mitigation**: 
- Purge ONLY on explicit Settings genre removal
- Add confirmation dialog in Settings before purging
- Consider soft-delete with recovery period

**Risk**: RPC missing incremental sync support
**Mitigation**: 
- RPCs include `p_after_timestamp` parameter (see Phase 1)
- Worker passes timestamp for incremental syncs (see Phase 2, step 5)
- Genre filter changes trigger `ignoreTableChangeLog` flag to force full re-fetch

**Risk**: Two-phase sync interaction with RPC filtering
**Mitigation**:
- Phase 1 (metadata) should still use `pullTables` override to skip catalog tables
- Phase 2 (catalog) should sync tune table first (compound rules), then child tables (RPCs)
- Verify phase transition logic doesn't break with new RPC rules

## Clarifications from Review

### Question 1: Incremental sync timestamp filtering

**Answer**: Yes, `p_after_timestamp` argument must always be respected. When genre filter changes, use `ignoreTableChangeLog` flag (generic name, not app-specific) to force full re-fetch of affected tables.

**Implementation**:
- RPCs accept optional `p_after_timestamp` parameter (defaults to NULL for full fetch)
- Client sets `ignoreTableChangeLog: ['note', 'reference']` when genres change in Settings
- Worker interprets this flag as: ignore `sync_change_log` table timestamp, pass NULL to RPC for full re-fetch

### Question 2: Phase transition interaction

**Answer**: If tables are excluded via `pullTables` override, RPC for that table should not run (same as any other query logic).

**Implementation**: `pullTables` exclusion check happens before RPC detection in worker sync logic.

### Question 3: Codegen config for RPC rules

**Answer**: RPC SQL lives in migrations/sql_scripts (not extracted from DB). Config just specifies which RPC to call.

**Implementation**: This subtask includes oosync changes to support RPC rules in `tableRuleOverrides` config section.

### Question 4: Index verification

**Answer**: Indices likely already exist. Implementer should verify and create if missing.

### Question 5: Settings integration file path

**Answer**: [src/routes/user-settings/catalog-sync.tsx:103-160](src/routes/user-settings/catalog-sync.tsx#L103-L160)

**Flow**: GenreMultiSelect component → catalog-sync.tsx applies changes → trigger sync with `ignoreTableChangeLog` → purge after sync completes

### Question 6: practice_record scope change

**Answer**: `practice_record` is already correctly filtered by `playlist_ref` via `inCollection` rule ([worker-config.generated.ts:89-93](worker/src/generated/worker-config.generated.ts#L89-L93)). Removed from this plan's scope.

**Tables in scope**: Only `note` and `reference` (annotations with genre filtering needs).

---

## Implementation Questions - RESOLVED

### 1. Worker config structure for `ignoreTableChangeLog`

**Question**: Should `ignoreTableChangeLog` be part of sync request options, or a separate field in the worker payload?

**Answer**: Field in worker request payload. The client knows best when filter changes require full re-fetch vs. fast incremental sync.

**Implementation**: Add `ignoreTableChangeLog?: string[]` to the worker's `SyncRequest` interface (see Phase 2, step 6).

### 2. Purge callback integration

**Question**: In [catalog-sync.tsx](src/routes/user-settings/catalog-sync.tsx#L103-L160), how should we hook into sync completion?

**Answer**: Use existing await pattern - no new callback needed. The `forceSyncDown()` function in [AuthContext.tsx:1986-2040](src/lib/auth/AuthContext.tsx#L1986-L2040) shows the pattern: `await syncServiceInstance.syncDown()` then execute post-sync logic.

**Implementation**: In [catalog-sync.tsx handleSave](src/routes/user-settings/catalog-sync.tsx#L103-L160), after `await forceSyncDown({ full: true })` completes, call `await purgeOrphanedAnnotations(db)`.

### 3. Error handling for RPC calls

**Question**: If RPC fails (e.g., function not found), should worker fall back to normal filtering or fail the sync?

**Answer**: Fail sync with clear error. Users expect red toast and visible failure. No fallback to normal filtering - RPCs are required once configured.

**Implementation**: In `fetchViaRPC` helper (Phase 2, step 3), throw error with clear message: `throw new Error(\`RPC ${params.functionName} failed: ${error.message}\`);`. Worker will propagate to client, triggering error toast.

---

## Next Steps

**All implementation questions resolved.** Ready to proceed with Phase 1 (create RPCs).

**Please ask any further clarifying questions before starting implementation.**