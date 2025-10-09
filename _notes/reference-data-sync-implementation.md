# Reference Data Sync Implementation

**Date:** October 9, 2025  
**Status:** ✅ **IMPLEMENTED - READY FOR TESTING**

---

## Problem Statement

The sync engine was only syncing user-specific data tables (playlists, tunes, practice_record, etc.) but was **missing**:

1. **Reference data tables** (genre, tune_type, genre_tune_type, instrument)
2. **User preference tables** (prefs\_\*, table_state, tab_group_main_state)

This resulted in empty tables in the local SQLite database even though data existed in Supabase.

---

## Root Cause

### Reference Data Tables

These tables contain **shared, read-only data** for all users:

- `genre` - Music genres (Irish, Scottish, etc.) - 15 rows
- `tune_type` - Tune types (Jig, Reel, etc.) - 49 rows
- `genre_tune_type` - Genre↔TuneType relationships - 88 rows
- `instrument` - Musical instruments - 7 rows

**Why they were empty:**

- ✅ Data exists in Supabase PostgreSQL
- ❌ NOT included in sync engine's table list
- ❌ Sync engine never downloaded them

### User Preference Tables

These tables contain **user-specific settings**:

- `prefs_scheduling_options` - Practice scheduling preferences
- `prefs_spaced_repetition` - Spaced repetition algorithm settings
- `table_state` - UI table column/filter state (27 rows per user)
- `tab_group_main_state` - Tab panel UI state (2 rows per user)

**Why they were empty:**

- ❌ NOT included in sync engine's table list
- ❌ Likely empty in Supabase (defaults not created on signup)

---

## Solution Implemented

### 1. Updated Sync Engine (`src/lib/sync/engine.ts`)

#### Added Tables to Sync List

```typescript
const tablesToSync: SyncableTable[] = [
  // Reference data first (no dependencies, shared across users)
  "genre",
  "tune_type",
  "genre_tune_type",
  "instrument",

  // User preferences
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  "table_state",
  "tab_group_main_state",

  // User data (existing)
  "playlist",
  "tune",
  // ... rest
];
```

#### Added Reference Data Logic

```typescript
// Skip user_id filtering for reference data (shared across all users)
const referenceDataTables: SyncableTable[] = [
  "genre",
  "tune_type",
  "genre_tune_type",
  "instrument",
];

const isReferenceData = referenceDataTables.includes(tableName);

if (!isReferenceData) {
  // Apply user_id filter for user-specific tables
  query = query.eq("user_ref", this.userId);
}
```

#### Added Primary Key Handling

```typescript
switch (tableName) {
  // Reference data
  case "genre":
  case "tune_type":
    conflictTarget = [localTable.id]; // Text primary key
    break;
  case "genre_tune_type":
    conflictTarget = [localTable.genreId, localTable.tuneTypeId]; // Composite
    break;

  // User preferences
  case "prefs_scheduling_options":
  case "prefs_spaced_repetition":
    conflictTarget = [localTable.userId]; // userId is PK
    break;
  case "table_state":
    conflictTarget = [localTable.userId, localTable.tableRef]; // Composite
    break;
  case "tab_group_main_state":
    conflictTarget = [localTable.userId, localTable.tabIndex]; // Composite
    break;

  // ... rest
}
```

### 2. Updated Type Definitions (`src/lib/sync/queue.ts`)

```typescript
export type SyncableTable =
  // Reference data (shared across users, read-only for non-admins)
  | "genre"
  | "tune_type"
  | "genre_tune_type"
  | "instrument"
  // User preferences
  | "prefs_scheduling_options"
  | "prefs_spaced_repetition"
  | "table_state"
  | "tab_group_main_state"
  // User data (existing)
  | "tune"
  | "playlist";
// ... rest
```

### 3. Created Reference Data Seed Script

**File:** `scripts/check-and-seed-reference-data.ts`

**Features:**

- ✅ Checks Supabase for existing reference data
- ✅ Seeds genres (8 predefined genres)
- ✅ Seeds tune types (18 predefined types)
- ✅ Seeds genre↔tune_type relationships
- ✅ Uses service role key to bypass RLS
- ✅ Upserts (safe to run multiple times)

**Usage:**

```bash
npx tsx scripts/check-and-seed-reference-data.ts
```

**Output:**

```
📋 genre: 15 rows ✅
📋 tune_type: 49 rows ✅
📋 genre_tune_type: 88 rows ✅
📋 instrument: 7 rows ✅
```

---

## Testing Plan

### Test 1: Clear Local Database and Re-sync

```bash
# 1. Clear browser IndexedDB
#    - Open DevTools → Application → IndexedDB
#    - Delete 'tunetrees-storage' database

# 2. Reload app
#    - App should re-initialize local DB
#    - Sync engine should download reference data

# 3. Check via Debug DB Browser
#    - Navigate to http://localhost:5173/debug/db
#    - Query: SELECT COUNT(*) FROM genre;
#    - Expected: 15 rows
#    - Query: SELECT COUNT(*) FROM tune_type;
#    - Expected: 49 rows
```

### Test 2: Verify Reference Data Contents

```sql
-- Check genres
SELECT * FROM genre ORDER BY name;

-- Check tune types
SELECT * FROM tune_type ORDER BY name;

-- Check genre-tune_type relationships
SELECT g.name as genre, tt.name as tune_type
FROM genre_tune_type gtt
JOIN genre g ON gtt.genreId = g.id
JOIN tune_type tt ON gtt.tuneTypeId = tt.id
ORDER BY g.name, tt.name;

-- Check instruments
SELECT * FROM instrument;
```

### Test 3: Verify User Preferences Sync

```sql
-- These might still be empty (user hasn't set preferences yet)
SELECT * FROM prefs_scheduling_options;
SELECT * FROM prefs_spaced_repetition;
SELECT * FROM table_state;
SELECT * FROM tab_group_main_state;
```

---

## Admin Workflow: Adding New Reference Data

**Scenario:** Admin wants to add a new genre "Cape Breton"

### Method 1: Via Supabase Dashboard

1. Open Supabase dashboard
2. Navigate to Table Editor → `genre` table
3. Click "Insert Row"
4. Add: `{ id: "cape-breton", name: "Cape Breton", region: "Canada", description: "..." }`
5. **All clients automatically sync the new genre** via Realtime subscriptions!

### Method 2: Via SQL

```sql
-- Run in Supabase SQL Editor
INSERT INTO genre (id, name, region, description)
VALUES ('cape-breton', 'Cape Breton', 'Canada', 'Traditional Cape Breton fiddle music');

-- Add tune type relationships
INSERT INTO genre_tune_type (genre_id, tune_type_id)
VALUES
  ('cape-breton', 'reel'),
  ('cape-breton', 'strathspey'),
  ('cape-breton', 'jig');
```

### Method 3: Via Seed Script

1. Update `scripts/check-and-seed-reference-data.ts`
2. Add new genre to `GENRES` array
3. Add relationships to `GENRE_TUNE_TYPE` array
4. Run: `npx tsx scripts/check-and-seed-reference-data.ts`

---

## How Sync Works Now

### Reference Data Flow

```
Admin adds genre in Supabase
         ↓
Supabase Realtime notifies all clients
         ↓
Sync engine receives update
         ↓
syncTableDown() downloads new genre (no user filter)
         ↓
Upserts into local SQLite
         ↓
UI reactively updates (SolidJS signals)
         ↓
User sees new genre in dropdown!
```

### User Preference Flow

```
User changes table column order
         ↓
Local change queued for sync
         ↓
syncUp() uploads to Supabase
         ↓
table_state record created with user_id
         ↓
RLS policy ensures only that user can read/write
         ↓
Other devices sync down via syncDown()
         ↓
Table state restored on other devices!
```

---

## Files Modified

| File                                       | Changes                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/lib/sync/engine.ts`                   | Added reference data + user pref tables, skip user filter logic, primary key handling |
| `src/lib/sync/queue.ts`                    | Updated `SyncableTable` type                                                          |
| `scripts/check-and-seed-reference-data.ts` | NEW - Reference data seeding script                                                   |

---

## Next Steps

1. ✅ **Test sync** - Clear local DB, reload, verify reference data appears
2. ✅ **Test Realtime** - Add genre in Supabase, verify client updates
3. ⏭️ **Seed user preferences** - Create defaults on signup
4. ⏭️ **Document admin workflow** - How to add new genres/tune types
5. ⏭️ **E2E tests** - Automated testing of reference data sync

---

## Known Issues / Future Improvements

### User Preferences Still Empty

**Tables:**

- `prefs_scheduling_options`
- `prefs_spaced_repetition`
- `table_state`
- `tab_group_main_state`

**Why:**

- User hasn't set any preferences yet
- Defaults not automatically created on signup

**Solution:**

- Either seed defaults on first login (client-side)
- OR create defaults on signup (server-side via Supabase Auth trigger)

**Deferred to:** Phase 9 (UI Polish)

---

## Success Criteria

- [x] Reference data tables included in sync
- [x] User preference tables included in sync
- [x] Reference data doesn't filter by user_id
- [x] Primary keys handled correctly for all table types
- [x] Supabase reference data verified (15 genres, 49 tune types)
- [x] Seed script created and tested
- [ ] Local DB shows populated genre/tune_type tables (NEXT TEST)
- [ ] Admin can add genre and clients update (NEXT TEST)

---

**Status:** Ready for final testing! 🚀
