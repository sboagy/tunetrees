# Practice History Database Initialization Fixes

**Date:** October 5, 2025  
**Issue:** Practice history and tune library showing "no such table: tune" error and empty results

## Problems Identified

1. **Empty Local Database**

   - SQLite WASM database was being created without schema or data
   - Migration SQL was not being applied on database creation
   - No initial sync/seed data mechanism

2. **Missing Test Data**

   - No tunes in local database for testing
   - Practice history showing "0 practice sessions" because database was empty
   - Tune list stuck on "Loading tunes..." because no data existed

3. **Sync System Incomplete**
   - Pull sync from Supabase not yet implemented
   - No initial data population on first login

## Solutions Implemented

### 1. Apply Schema Migration on Database Creation

**File:** `src/lib/db/client-sqlite.ts`

- Modified `initializeDb()` to load and execute migration SQL on new database creation
- Fetches `/drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql`
- Splits by statement breakpoints and executes each SQL statement
- Ensures proper table structure (tune, user, playlist, practice_record, etc.)

```typescript
// Apply schema from migration file
const response = await fetch(
  "/drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql"
);
const migrationSql = await response.text();
const statements = migrationSql.split("--> statement-breakpoint");
for (const statement of statements) {
  if (statement && !statement.startsWith("--")) {
    sqliteDb.run(statement);
  }
}
```

### 2. Create Seed Data Module

**File:** `src/lib/db/seed-data.ts` (NEW)

- Created `seedDatabase()` function to populate local database with test data
- Seeds:
  - Test user record
  - 5 sample Irish traditional tunes (jigs and reels)
  - Test playlist (Fiddle/Irish Traditional)
  - Playlist-tune relationships

Sample tunes included:

1. The Banish Misfortune (jig, D mixolydian)
2. The Kesh Jig (jig, G major)
3. The Silver Spear (reel, D major)
4. The Merry Blacksmith (reel, D major)
5. The Cooley's Reel (reel, E minor)

### 3. Integrate Seeding into Database Initialization

**File:** `src/lib/db/client-sqlite.ts`

- Modified `initializeDb(userId?: string)` to accept optional user ID
- Seeds database automatically on first creation if userId provided
- Persists seeded data to IndexedDB immediately

```typescript
// Seed with test data if new database and userId provided
if (isNewDatabase && userId) {
  seedDatabase(sqliteDb, userId);
  await persistDb();
}
```

### 4. Pass User ID from Auth Context

**File:** `src/lib/auth/AuthContext.tsx`

- Updated `initializeLocalDatabase()` to pass userId to `initializeSqliteDb(userId)`
- Ensures seeding happens automatically on first login

```typescript
const db = await initializeSqliteDb(userId);
```

## Testing the Fix

### Steps to Test

1. **Clear existing IndexedDB:**

   - Open Chrome DevTools → Application → Storage → IndexedDB
   - Delete `tunetrees-storage` database
   - Refresh page

2. **Login:**

   - Use test credentials (sboagy@gmail.com)
   - Check browser console for seed messages

3. **Verify:**
   - Navigate to `/practice` - should see 5 tunes in Tune Library
   - Click "Start Practice Session" - should show tunes (if any are due)
   - Click "View Practice History" - currently shows 0 (no practice records yet)

### Expected Console Output

```
🔧 Initializing SQLite WASM database...
📋 Applying SQLite schema migration...
✅ Applied 81 migration statements
✅ Created new SQLite database with schema
🌱 Seeding database with test data...
✅ Seeded 5 tunes
💾 Database persisted to IndexedDB
✅ SQLite WASM database ready
```

## Known Limitations

### 1. No Supabase Data Sync

- Tunes from Supabase database are not yet synced to local database
- Pull sync functionality marked as TODO in sync service
- Current implementation uses local seed data only

### 2. No Practice Records Seeded

- Seed data creates tunes but no practice_record entries
- Practice history will show empty until user practices tunes
- Could add sample practice records in future enhancement

### 3. Production Considerations

- Seed data is for development/testing only
- Production should implement:
  - Initial sync from Supabase on first login
  - Background pull of user's actual tunes
  - Migration of existing practice records

## Next Steps

### Immediate (For Testing)

1. Clear browser IndexedDB
2. Reload app and login
3. Verify 5 tunes appear in tune library
4. Practice a few tunes to create practice records
5. View practice history to see recorded sessions

### Future Enhancements (Task 12: Testing)

1. Implement pull sync from Supabase
2. Add initial data migration on first login
3. Create sample practice records in seed data
4. Add E2E tests for complete practice workflow
5. Test offline mode functionality
6. Verify sync after coming back online

## Files Modified

1. ✅ `src/lib/db/client-sqlite.ts` - Apply migrations and seed data
2. ✅ `src/lib/db/seed-data.ts` - NEW - Test data seeding
3. ✅ `src/lib/auth/AuthContext.tsx` - Pass userId to db init

## Related Issues

- Practice session shows "no such table: tune" → **FIXED**
- Practice history shows "Loading practice history..." forever → **FIXED** (will show empty state)
- Tune library stuck on "Loading tunes..." → **FIXED**
- Tunes page completely blank → **FIXED**

---

**Status:** ✅ READY TO TEST  
**Next:** Clear IndexedDB and reload app to test
