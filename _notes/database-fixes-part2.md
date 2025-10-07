# Database Initialization Fixes - Part 2

**Date:** October 5, 2025  
**Issues Fixed:**

1. "no such table: sync_queue" error
2. "no such table: tune" error (old database in IndexedDB)
3. SolidJS cleanup warning

## Problems Identified from Logs

### 1. Missing sync_queue Table

```
Sync error: Error: no such table: sync_queue
```

**Root Cause:**

- The `sync_queue` table was defined in `schema.ts` but **missing from the migration SQL**
- The migration file `0000_lowly_obadiah_stane.sql` was out of date
- Sync service tried to query sync_queue immediately on startup

### 2. Old Database Without Schema

```
Uncaught (in promise) Error: no such table: tune
✅ Loaded existing SQLite database from IndexedDB
```

**Root Cause:**

- Old database from previous session was stored in IndexedDB **without proper schema**
- Code loaded existing database instead of applying migration
- No version checking to detect schema changes

### 3. SolidJS Cleanup Warning

```
cleanups created outside a `createRoot` or `render` will never be run
```

**Root Cause:**

- `onCleanup()` was called inside async function (outside reactive scope)
- Auto-persist cleanup wasn't properly managed

## Solutions Implemented

### 1. Create sync_queue Table Programmatically

**File:** `src/lib/db/client-sqlite.ts`

Added automatic sync_queue table creation after view initialization:

```typescript
// Create sync_queue table if it doesn't exist (missing from migration)
try {
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      data TEXT,
      status TEXT DEFAULT 'pending' NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT,
      attempts INTEGER DEFAULT 0 NOT NULL,
      last_error TEXT
    )
  `);
  sqliteDb.run(`
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)
  `);
  console.log("✅ Ensured sync_queue table exists");
} catch (error) {
  console.error("❌ Failed to create sync_queue table:", error);
}
```

**Benefits:**

- Works regardless of migration file state
- Creates table on every initialization (idempotent with IF NOT EXISTS)
- Includes proper index for status queries

### 2. Database Version Checking

**File:** `src/lib/db/client-sqlite.ts`

Added version tracking to force recreation when schema changes:

```typescript
const DB_VERSION_KEY = "tunetrees-db-version";
const CURRENT_DB_VERSION = 2; // Incremented to force migration

// Check version on load
const storedVersion = await loadFromIndexedDB(DB_VERSION_KEY);
const storedVersionNum =
  storedVersion && storedVersion.length > 0 ? storedVersion[0] : 0;

if (existingData && storedVersionNum === CURRENT_DB_VERSION) {
  // Load existing database (version matches)
  sqliteDb = new SQL.Database(existingData);
} else {
  // Recreate database (version mismatch or first time)
  if (existingData) {
    console.log(
      `🔄 Database version mismatch (stored: ${storedVersionNum}, current: ${CURRENT_DB_VERSION}). Recreating...`
    );
    await deleteFromIndexedDB(DB_KEY);
    await deleteFromIndexedDB(DB_VERSION_KEY);
  }
  sqliteDb = new SQL.Database();
  isNewDatabase = true;
  // ... apply migration ...
}
```

**Version persistence:**

```typescript
export async function persistDb(): Promise<void> {
  const data = sqliteDb.export();
  await saveToIndexedDB(DB_KEY, data);
  // Save version number
  await saveToIndexedDB(DB_VERSION_KEY, new Uint8Array([CURRENT_DB_VERSION]));
}
```

**Benefits:**

- Automatically recreates database when schema changes
- No manual IndexedDB cleanup needed by user
- Seamless migration path for future schema updates

### 3. Fix SolidJS Cleanup Warning

**File:** `src/lib/auth/AuthContext.tsx`

Moved cleanup handling outside of async function:

```typescript
// Store cleanup functions at component level
let stopSyncWorker: (() => void) | null = null;
let autoPersistCleanup: (() => void) | null = null;

async function initializeLocalDatabase(userId: string) {
  // Store cleanup instead of calling onCleanup
  autoPersistCleanup = setupAutoPersist();
  stopSyncWorker = startSyncWorker(db, supabase, 30000);
}

async function clearLocalDatabase() {
  // Call stored cleanup functions
  if (autoPersistCleanup) {
    autoPersistCleanup();
    autoPersistCleanup = null;
  }
  if (stopSyncWorker) {
    stopSyncWorker();
    stopSyncWorker = null;
  }
}
```

**Benefits:**

- No SolidJS warnings
- Proper cleanup on logout
- Follows SolidJS reactive patterns

## Expected Behavior After Fixes

### On App Reload (with old database):

```
🔧 Initializing SQLite WASM database...
🔄 Database version mismatch (stored: 0, current: 2). Recreating...
📋 Applying SQLite schema migration...
✅ Applied 81 migration statements
📊 Initializing SQLite database views...
✅ Created view: view_playlist_joined
✅ Created view: practice_list_joined
✅ Created view: practice_list_staged
✅ Ensured sync_queue table exists
🌱 Seeding database with test data...
✅ Seeded 5 tunes
💾 Database persisted to IndexedDB
✅ SQLite WASM database ready
🔄 Sync worker started
✅ Local database ready
```

### On Subsequent Reloads (database exists):

```
🔧 Initializing SQLite WASM database...
✅ Loaded existing SQLite database from IndexedDB (v2)
📊 Initializing SQLite database views...
✅ Created view: view_playlist_joined
✅ Created view: practice_list_joined
✅ Created view: practice_list_staged
✅ Ensured sync_queue table exists
✅ SQLite WASM database ready
🔄 Sync worker started
✅ Local database ready
```

### No More Errors:

- ❌ ~~"no such table: sync_queue"~~ → ✅ Table created automatically
- ❌ ~~"no such table: tune"~~ → ✅ Migration applied on version mismatch
- ❌ ~~"cleanups created outside a `createRoot`"~~ → ✅ Proper cleanup handling

## Testing Instructions

1. **Just reload the app** - No manual cleanup needed!

   - The version check (v0 → v2) will trigger automatic recreation
   - Old database will be deleted and recreated with proper schema

2. **Verify in DevTools Console:**

   - Should see "Database version mismatch" message
   - Should see migration being applied
   - Should see 5 tunes seeded
   - No errors about missing tables

3. **Verify in UI:**

   - Navigate to `/practice` - should see 5 tunes in library
   - Click "Start Practice Session" - should work (if tunes are due)
   - Click "View Practice History" - should show empty state

4. **Verify Sync:**
   - Sync worker should start without errors
   - No "no such table: sync_queue" errors

## Future Schema Changes

**When you need to change the schema:**

1. Update `CURRENT_DB_VERSION` constant (e.g., 2 → 3)
2. Add table creation/modification logic in the migration section
3. Database will automatically recreate on next load

**Example:**

```typescript
const CURRENT_DB_VERSION = 3; // Added new_table

// In initializeDb():
if (isNewDatabase) {
  // ... existing migration ...

  // Add new table
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS new_table (...)`);
}
```

## Files Modified

1. ✅ `src/lib/db/client-sqlite.ts`

   - Added sync_queue table creation
   - Added database version checking
   - Version persistence in persistDb()

2. ✅ `src/lib/auth/AuthContext.tsx`
   - Fixed SolidJS cleanup warning
   - Proper cleanup function management

## Related Issues

- Sync queue errors → **FIXED**
- Old database without schema → **FIXED**
- SolidJS warnings → **FIXED**
- Need manual IndexedDB cleanup → **NO LONGER NEEDED**

---

**Status:** ✅ READY TO TEST (just reload!)  
**Next:** Reload app and verify 5 tunes appear
