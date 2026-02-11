# Genre Selection Feature - Bug Fixes & Implementation

**Date:** 2026-01-20  
**Issue:** #341  
**PR:** #380

## Bugs Fixed

### 1. ✅ Onboarding Step Not Appearing
**Problem:** Genre selection step was being skipped during onboarding.

**Root Cause:** In `handlePlaylistCreated()`, the code was calling `nextStep()` and then immediately navigating to the catalog, which caused a race condition that skipped the genre selection step.

**Fix:** [src/components/onboarding/OnboardingOverlay.tsx](src/components/onboarding/OnboardingOverlay.tsx)
- Removed the immediate navigation in `handlePlaylistCreated()`
- The navigation now only happens after user completes genre selection in `handleSaveGenres()`

```typescript
// Before (buggy):
const handlePlaylistCreated = () => {
  setShowPlaylistDialog(false);
  incrementRepertoireListChanged();
  nextStep();
  navigate("/?tab=catalog");  // ❌ Races past genre selection!
};

// After (fixed):
const handlePlaylistCreated = () => {
  setShowPlaylistDialog(false);
  incrementRepertoireListChanged();
  nextStep();  // ✅ Waits for genre selection step
};
```

### 2. ✅ Worker-Side Genre Filtering Implemented
**Problem:** Full catalog was being downloaded to local SQLite regardless of user's genre selection.

**Root Cause:** Client-side filtering was implemented, but server-side (worker) filtering was missing. This meant the worker's pull operation sent the entire catalog to the client.

**Fix:** [oosync/worker/src/sync-schema.ts](oosync/worker/src/sync-schema.ts)

**Changes Made:**

#### A. Load User's Genre Selection in `loadUserCollections()`
Added logic to query the `user_genre_selection` table and store selected genre IDs in the collections object:

```typescript
// Load user's selected genres for catalog filtering
const userGenreSelectionTable = params.tables.userGenreSelection;
if (userGenreSelectionTable) {
  const genreRows = await params.tx
    .select({ genreId: userGenreSelectionTable.genreId })
    .from(userGenreSelectionTable)
    .where(eq(userGenreSelectionTable.userId, params.userId));

  const selectedGenreIds = genreRows.map((r: any) => String(r.genreId));
  result.selectedGenres = new Set(selectedGenreIds);
}
```

#### B. Apply Genre Filtering in `buildUserFilter()`
Added catalog table filtering logic at the beginning of the function:

```typescript
// Apply genre filtering for catalog tables
const selectedGenres = params.collections.selectedGenres;
const isCatalogTable = ["genre", "tune", "tune_type", "genre_tune_type"].includes(
  params.tableName
);

if (isCatalogTable && selectedGenres && selectedGenres.size > 0) {
  const genreIds = Array.from(selectedGenres);

  if (params.tableName === "genre") {
    // Only selected genres
    conditions.push(inArray(params.table.id, genreIds));
    return conditions;
  }
  
  if (params.tableName === "tune") {
    // Tunes with selected genres, PLUS user's private tunes
    return [
      or(
        inArray(params.table.genre, genreIds),
        eq(params.table.privateFor, params.userId)
      )
    ];
  }
  
  if (params.tableName === "genre_tune_type") {
    // Junction table filtered by genre
    conditions.push(inArray(params.table.genreId, genreIds));
    return conditions;
  }
}
```

**Behavior:**
- If user has NO genre selection → all catalog data synced (backward compatible)
- If user has selected genres → only selected genres + related data synced
- User-owned data (private tunes, playlists, notes, practice history) ALWAYS synced regardless of genre

---

## Known Issues (Not Fixed Yet)

### Anonymous User Sync Error

**Error:**
```
Sync failed: 500 {"error":"[PUSH] Failed applying playlist rowId=... 
code=23503 | table=playlist | constraint=playlist_user_ref_fkey | 
detail=Key (user_ref)=(...) is not present in table 'user_profile'."}
```

**Root Cause:**  
Anonymous users create a `user_profile` entry in local SQLite, but when they create a playlist and it tries to sync to Postgres, the `user_profile` doesn't exist there yet. This causes a foreign key constraint violation.

**Why This Happens:**
1. Anonymous user logs in → local `user_profile` created in SQLite
2. User creates playlist → references local `user_profile.id`
3. Sync worker tries to push playlist to Postgres
4. Playlist references `user_ref` that doesn't exist in Postgres yet
5. FK constraint fails

**This is a PRE-EXISTING Issue:**  
This is NOT specific to genre selection - it affects ALL anonymous user data that references `user_profile` (playlists, notes, practice records, etc.). The genre selection feature didn't introduce this bug.

**Proper Fix Required:**  
The sync system needs to ensure `user_profile` is synced to Postgres BEFORE any dependent records. Options:
1. Sort push queue by table dependencies (user_profile first, then everything else)
2. Create user_profile on-demand in the worker when encountering missing FK
3. Handle FK violations gracefully and retry after user_profile is synced

**Workaround for Testing:**  
Use a registered (non-anonymous) user whose user_profile already exists in Postgres.

---

## Testing Recommendations

### Manual Test Cases

**Test 1: Genre Selection During Onboarding**
1. Clear local data / use incognito mode
2. Login as registered user
3. Create repertoire
4. **VERIFY:** Genre selection step appears
5. Select subset of genres (e.g., only "Irish")
6. Click Continue
7. **VERIFY:** Catalog loads with only selected genres

**Test 2: Catalog Filtering Works**
1. After onboarding with genre selection
2. Check local SQLite `tune` table
3. **VERIFY:** Only tunes with selected genres are present
4. Check `genre` table
5. **VERIFY:** Only selected genre rows exist

**Test 3: Settings Page**
1. Navigate to Settings → Catalog & Sync
2. **VERIFY:** Current selections displayed correctly
3. Change selection (add/remove genres)
4. Save changes
5. Refresh catalog
6. **VERIFY:** Catalog updates to reflect new selection

**Test 4: Sync Behavior**
1. Complete Test 1 with limited genre selection
2. Check network traffic during sync
3. **VERIFY:** Pull response only contains selected genres
4. **VERIFY:** Private user data still syncs (notes, practice history)

### E2E Tests to Add

**Priority 1:**
- `onboarding-genre-selection.spec.ts` - Full onboarding flow with genre selection
- `catalog-genre-filtering.spec.ts` - Verify catalog respects selection

**Priority 2:**
- `settings-genre-sync.spec.ts` - Change genres in settings, verify sync
- `genre-filtering-data-validation.spec.ts` - Verify only selected data in local DB

---

## Files Modified

### Core Feature
- `src/components/onboarding/OnboardingOverlay.tsx` - Fixed race condition
- `oosync/worker/src/sync-schema.ts` - Implemented worker-side filtering

### Previously Created (From Initial Implementation)
- `sql_scripts/migrations/postgres_add_user_genre_selection.sql`
- `sql_scripts/migrations/sqlite_add_user_genre_selection.sql`
- `src/lib/db/queries/user-genre-selection.ts`
- `src/components/genre-selection/GenreMultiSelect.tsx`
- `src/routes/user-settings/catalog-sync.tsx`
- `src/lib/db/queries/tunes.ts` (catalog filtering)

---

## Performance Considerations

### Network Savings
With genre filtering enabled:
- **Before:** Full catalog (~1000s of tunes across all genres)
- **After:** Only selected genres (e.g., 1 genre = ~200 tunes = 80% reduction)

### Storage Savings
- Local SQLite size reduced proportionally to genre selection
- Faster initial sync for new users
- Reduced memory footprint for catalog operations

### Sync Efficiency
- Worker pulls less data per request
- Faster incremental syncs
- Less bandwidth consumption on mobile connections

---

## Deployment Checklist

- [x] Database migrations applied (Postgres + SQLite)
- [x] Schema artifacts regenerated
- [x] Onboarding flow fixed
- [x] Worker-side filtering implemented
- [ ] Test with registered user (not anonymous)
- [ ] Verify sync network traffic reduced
- [ ] Check local SQLite contains only selected data
- [ ] E2E tests written and passing
- [ ] Anonymous user FK issue documented/tracked separately

---

## Next Steps

1. **Test manually** with a registered user (to avoid anonymous user FK issue)
2. **Verify** genre selection step appears and works
3. **Check** local SQLite only contains selected genres
4. **Monitor** sync payload sizes to confirm reduction
5. **Write E2E tests** to prevent regressions
6. **File separate issue** for anonymous user FK constraint problem
