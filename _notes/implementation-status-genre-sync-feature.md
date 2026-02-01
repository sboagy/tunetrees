# User-Controlled Genre Download/Sync - Implementation Summary

**Issue:** #341  
**PR:** #380  
**Status:** Core features implemented and ready for testing

---

## Implementation Overview

This feature enables users to select which genres they want to download/sync, providing both UI flexibility and data efficiency. Users make this choice during onboarding and can modify it later in Settings.

---

## What Has Been Implemented ✅

### 1. Database Layer

**Migrations Created:**
- `sql_scripts/migrations/postgres_add_user_genre_selection.sql` - Postgres migration
- `sql_scripts/migrations/sqlite_add_user_genre_selection.sql` - SQLite migration

**Table:** `user_genre_selection`
- Composite primary key: `(user_id, genre_id)`
- Includes sync columns: `sync_version`, `device_id`, `created_at`, `last_modified_at`
- Fully synced via the oosync infrastructure (auto-configured in codegen)

**Schema Generation:**
- ✅ Updated `oosync.codegen.config.json` to include `user_genre_selection` under `changeCategoryByTable` as "user"
- ✅ Regenerated Drizzle SQLite schema artifacts
- ✅ User_genre_selection table now in generated schema and will sync bidirectionally

### 2. Data Access Layer

**New File:** `src/lib/db/queries/user-genre-selection.ts`

**Functions:**
- `getUserGenreSelection(db, userId): Promise<string[]>` - Get selected genre IDs
- `getGenresWithSelection(db, userId)` - Get all genres with selection status
- `upsertUserGenreSelection(db, userId, genreIds)` - Save/update selections (replaces all)
- `clearUserGenreSelection(db, userId)` - Clear all selections
- `hasUserGenreSelection(db, userId): Promise<boolean>` - Check if user has any selection

### 3. UI Components

**New File:** `src/components/genre-selection/GenreMultiSelect.tsx`

**Features:**
- Reusable multi-select component with checkboxes
- Optional search functionality with clear button
- "Select all" / "Clear all" buttons
- Sorted genre list with regions displayed
- Fully accessible with proper ARIA labels
- Tailwind styling matching app theme (dark mode support)
- Customizable test IDs for E2E testing

**Exported:** Via `src/components/genre-selection/index.ts`

### 4. Onboarding Integration

**Modified:** `src/lib/context/OnboardingContext.tsx`
- Updated `OnboardingStep` type to include `"choose-genres"`
- Step flow now: `create-playlist` → `choose-genres` → `view-catalog` → `complete`

**Modified:** `src/components/onboarding/OnboardingOverlay.tsx`
- Added new step UI for genre selection with purple theme
- Loads genres from database on demand
- "Continue" button enabled only when at least one genre selected
- "Skip for now" button defaults to all genres
- Saves selections to database before proceeding to catalog

**Test IDs:**
- `onboarding-genre-selection` - Container
- `onboarding-genre-checkbox-{genreId}` - Individual checkboxes
- `onboarding-genre-continue` - Continue button

### 5. Settings Page

**New File:** `src/routes/user-settings/catalog-sync.tsx`

**Features:**
- New settings page at `/user-settings/catalog-sync`
- Displays genre selection UI using shared `GenreMultiSelect` component
- Shows currently selected genres
- "Save Changes" button (disabled until changes made)
- Success/error messaging
- Dirty state tracking
- Informational box explaining genre selection impact

**Modified:** `src/routes/user-settings/index.tsx`
- Added "Catalog & Sync" navigation item to settings sidebar

**Test IDs:**
- `settings-catalog-sync` - Container
- `settings-genre-checkbox-{genreId}` - Individual checkboxes
- `settings-genre-save` - Save button

### 6. Catalog Query Updates

**Modified:** `src/lib/db/queries/tunes.ts`

**Updated Function:** `getTunesForUser(db, userId, showPublic)`
- Now loads user's selected genres automatically
- Filters catalog results to only include selected genres
- Defaults to all genres if no selection exists (backward compatibility)
- Properly handles both public and user-overridden tune data via COALESCE

**Existing Function:** `searchTunes(db, options)`
- Already supports `genres` parameter for filtering
- No changes needed; ready to use with genre selection

---

## Data Flow

### Onboarding Flow:
1. User creates repertoire (existing step)
2. User reaches new "Choose genres" step
3. System loads all genres from database
4. User selects genres (at least one required)
5. Selection saved to `user_genre_selection` table
6. User continues to catalog
7. Catalog automatically filtered to show only selected genres

### Settings Flow:
1. User navigates to Settings > Catalog & Sync
2. Current selections are loaded and displayed
3. User modifies selections
4. "Save Changes" button saves to database
5. Future catalog loads will respect new selections

### Sync Flow:
- `user_genre_selection` table is synced like any other user table
- Changes to user's genre selection sync bidirectionally
- Catalog data itself is not yet server-side filtered (see future work)

---

## Future Enhancements / Known Limitations

### Server-Side Sync Filtering (⚠️ Requires Worker Update)

The current implementation filters **client-side only**. To fully implement the requirement of "not downloading unselected genre catalog data," we need to:

1. **Worker-Side Genre Filtering:**
   - Modify the worker pull operation to filter catalog tables by user's selected genres
   - This requires careful handling within the oosync codegen boundaries
   - Tables affected: `genre`, `tune`, `tune_type`, `genre_tune_type`
   - User-owned data (playlists, notes, practice history) must remain unaffected

2. **Sync Protocol Extension:**
   - Include `genreIds` in sync request payload
   - Worker receives this and uses it for all catalog queries
   - Fallback: if no selection, return all catalog data

3. **Implementation Approach:**
   - Add optional `selectedGenreIds?: string[]` field to SyncRequest type
   - Modify worker's pull operation to apply genre filtering
   - Update client sync engine to include user's selected genres in requests

### Timing Optimization (Optional)

- Consider deferring initial catalog sync until user completes onboarding
- Currently: catalog sync happens on normal schedule; user must choose genres for filtering
- Enhancement: delay sync until genre selection complete to avoid downloading unnecessary data

---

## Testing Considerations

### Manual Testing Checklist:
- [ ] Onboarding: Verify new genre selection step appears
- [ ] Onboarding: Select subset of genres, verify saved correctly
- [ ] Catalog: After onboarding, verify only selected genres appear
- [ ] Settings: Navigate to Catalog & Sync page
- [ ] Settings: Change genre selection, verify save works
- [ ] Settings: Verify catalog updates after changing settings
- [ ] Sync: Verify `user_genre_selection` syncs to other devices

### E2E Test Recommendations:
- `test-onboarding-genre-selection.spec.ts` - Test full onboarding flow
- `test-settings-catalog-sync.spec.ts` - Test settings page
- `test-catalog-genre-filtering.spec.ts` - Test catalog respects selection

### Unit Tests Recommended:
- `getUserGenreSelection()` - Returns correct IDs
- `upsertUserGenreSelection()` - Properly updates selections
- `getTunesForUser()` - Filters correctly with no selection and with selection
- Genre component - Selection state management, search functionality

---

## Files Created/Modified

**Created:**
- `sql_scripts/migrations/postgres_add_user_genre_selection.sql`
- `sql_scripts/migrations/sqlite_add_user_genre_selection.sql`
- `src/lib/db/queries/user-genre-selection.ts`
- `src/components/genre-selection/GenreMultiSelect.tsx`
- `src/components/genre-selection/index.ts`
- `src/routes/user-settings/catalog-sync.tsx`

**Modified:**
- `oosync.codegen.config.json` - Added table to sync config
- `src/lib/context/OnboardingContext.tsx` - Added step and flow
- `src/components/onboarding/OnboardingOverlay.tsx` - Added step UI
- `src/routes/user-settings/index.tsx` - Added settings nav item
- `src/lib/db/queries/tunes.ts` - Added genre filtering to getTunesForUser
- `drizzle/schema-sqlite.generated.ts` - Auto-generated (contains userGenreSelection table)

---

## Deployment Notes

1. **Database Migrations:**
   - Run both Postgres and SQLite migrations in appropriate environments
   - Already applied to local dev (Postgres at localhost:54322)

2. **Schema Codegen:**
   - Already regenerated (npm run codegen:schema)
   - Schema artifacts are committed

3. **Backward Compatibility:**
   - Users without genre selection default to all genres
   - Existing catalog behavior preserved

4. **Feature Flags:**
   - No feature flags needed - feature is live once deployed
   - Consider if you want gradual rollout via feature flag

---

## Notes for Reviewers

1. The GenreMultiSelect component is highly reusable and can be used elsewhere if needed
2. Genre filtering respects both sync columns and override merging in catalog queries
3. All test ID naming follows existing patterns (using kebab-case with prefixes)
4. Dark mode fully supported across all new UI components
5. No breaking changes to existing APIs or functionality

---

## Next Steps

1. **Testing:** Run manual and E2E tests per checklist above
2. **Code Review:** Review implementation for any edge cases
3. **Worker Enhancement:** Plan server-side genre filtering for full implementation
4. **Documentation:** Update user-facing docs to describe genre selection feature
5. **Monitoring:** Track if users are using genre selection to validate ROI
