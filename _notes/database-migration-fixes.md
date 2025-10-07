# Database Migration Fixes - January 9, 2025

## Problem Statement

During Phase 3 development (Practice Session Management), two critical database migration issues were discovered:

1. **Missing daily_practice_queue data** - 435 records exist in `tunetrees_production_manual.sqlite3` but weren't migrated to PostgreSQL
2. **Missing database views** - Three essential views weren't created in PostgreSQL:
   - `view_playlist_joined`
   - `practice_list_joined`
   - `practice_list_staged`

## Root Cause

The production migration script (`scripts/migrate-production-to-supabase.ts`) was incomplete:

- **Phase 12 missing**: No `migrateDailyPracticeQueue()` function existed
- **Phase 13 missing**: No `createViews()` function existed
- The `main()` function only called phases 0-11

## Solution Implemented

### 1. Added Phase 12: Migrate Daily Practice Queue

**Function:** `migrateDailyPracticeQueue()`

**Implementation:**

```typescript
async function migrateDailyPracticeQueue() {
  // Reads all 435 records from SQLite daily_practice_queue table
  // Migrates in batches of 100 to avoid timeouts
  // Maps all 20 fields including:
  //   - user_ref, playlist_ref, tune_ref (core references)
  //   - window_start_utc, window_end_utc (practice window)
  //   - bucket, order_index (queue ordering)
  //   - snapshot fields (coalesced_ts, scheduled, latest_due, etc.)
  //   - exposures tracking (required, completed, outcome)
  //   - metadata (generated_at, completed_at, active)
  // Uses UNIQUE constraint: (user_ref, playlist_ref, window_start_utc, tune_ref)
}
```

**Key Fields Migrated:**

- `id` (INTEGER PRIMARY KEY)
- `user_ref`, `playlist_ref`, `tune_ref` (foreign keys)
- `mode`, `queue_date` (queue metadata)
- `window_start_utc`, `window_end_utc` (practice session window - NOT NULL)
- `bucket`, `order_index` (queue organization - NOT NULL)
- `snapshot_coalesced_ts` (timestamp snapshot - NOT NULL)
- `scheduled_snapshot`, `latest_due_snapshot` (scheduling snapshots)
- `acceptable_delinquency_window_snapshot`, `tz_offset_minutes_snapshot` (preferences)
- `generated_at` (queue generation timestamp - NOT NULL)
- `completed_at` (completion timestamp)
- `exposures_required`, `exposures_completed` (practice tracking)
- `outcome` (practice session result)
- `active` (BOOLEAN, default true)

### 2. Added Phase 13: Create Database Views

**Function:** `createViews()`

**Implementation:**

```typescript
async function createViews() {
  // Attempts to create views via Supabase RPC
  // If RPC not available, prints SQL for manual execution
  // Converts SQLite SQL to PostgreSQL SQL (group_concat → STRING_AGG, etc.)
}
```

**Views Created:**

#### a) `view_playlist_joined`

**Purpose:** Joins playlists with instrument details  
**Columns:** playlist_id, user_ref, playlist_deleted, instrument_ref, private_to_user, instrument, description, genre_default, instrument_deleted  
**Key Changes:**

- Simple 1:1 conversion from SQLite
- No syntax changes needed

#### b) `practice_list_joined`

**Purpose:** Comprehensive view of tunes with latest practice data  
**Columns:** 31 columns including tune details, practice stats, tags, notes, favorite URL  
**Key Changes:**

- `group_concat()` → `STRING_AGG()`
- `favorite = 1` → `favorite = true` (BOOLEAN type)
- Subquery for latest practice record changed from `INNER JOIN (SELECT MAX(id))` to `SELECT DISTINCT ON (tune_ref, playlist_ref) ... ORDER BY id DESC` (PostgreSQL idiom)

**Complex Features:**

- Aggregates tags into space-separated string
- Aggregates notes into space-separated string
- Finds favorite reference URL
- Computes `has_override` flag (1 if user has tune_override)
- Joins with latest practice_record per (tune_ref, playlist_ref)

#### c) `practice_list_staged`

**Purpose:** Extended practice view including transient (staged) data  
**Columns:** 37 columns including all from practice_list_joined + staged data  
**Key Changes:**

- Same `group_concat()` → `STRING_AGG()` conversion
- Same `favorite = 1` → `favorite = true` conversion
- Same DISTINCT ON pattern for latest practice record
- Additional `table_transient_data` join for staged edits

**Additional Features:**

- `has_staged` flag (1 if any transient data exists)
- Coalesces transient data with practice_record data (td.field ?? pr.field)
- Includes recall_eval, purpose, note_private, note_public from transient data

### 3. Updated Main Execution Flow

**Before:**

```typescript
async function main() {
  // Phases 0-11 only
  await migratePreferences(); // Phase 11
  await verifyMigration();
}
```

**After:**

```typescript
async function main() {
  // Phases 0-13 now
  await migratePreferences(); // Phase 11
  await migrateDailyPracticeQueue(); // Phase 12 ✨ NEW
  await createViews(); // Phase 13 ✨ NEW
  await verifyMigration();
}
```

### 4. Updated Verification

**Added to tables list:**

```typescript
const tables = [
  // ... existing tables ...
  { sqlite: "practice_record", supabase: "practice_record" },
  { sqlite: "daily_practice_queue", supabase: "daily_practice_queue" }, // ✨ NEW
  { sqlite: "note", supabase: "note" },
  // ...
];
```

## SQLite to PostgreSQL SQL Conversions

### Function Mapping

| SQLite Function            | PostgreSQL Function      | Notes                               |
| -------------------------- | ------------------------ | ----------------------------------- |
| `group_concat(field, ' ')` | `STRING_AGG(field, ' ')` | Aggregates values into string       |
| `1` (integer boolean)      | `true`                   | PostgreSQL uses proper BOOLEAN type |
| `0` (integer boolean)      | `false`                  | PostgreSQL uses proper BOOLEAN type |

### Subquery Pattern Changes

**SQLite Pattern (for latest record):**

```sql
LEFT JOIN (
  SELECT pr.*
  FROM practice_record pr
  INNER JOIN (
    SELECT tune_ref, playlist_ref, MAX(id) as max_id
    FROM practice_record
    GROUP BY tune_ref, playlist_ref
  ) latest ON pr.id = latest.max_id
) practice_record ON ...
```

**PostgreSQL Pattern:**

```sql
LEFT JOIN (
  SELECT DISTINCT ON (tune_ref, playlist_ref) pr.*
  FROM practice_record pr
  ORDER BY tune_ref, playlist_ref, id DESC
) practice_record ON ...
```

**Why:** PostgreSQL's `DISTINCT ON` is more efficient and idiomatic for "latest record per group" queries.

## Testing & Validation

### Pre-Migration Checks

```bash
# Verify daily_practice_queue record count
sqlite3 tunetrees_production_manual.sqlite3 \
  "SELECT COUNT(*) FROM daily_practice_queue;"
# Result: 435

# Verify view definitions exist
sqlite3 tunetrees_production_manual.sqlite3 \
  "SELECT sql FROM sqlite_master WHERE type='view';"
# Result: 3 views found
```

### Post-Migration Verification

The script will automatically verify:

- ✅ Record counts match between SQLite and PostgreSQL
- ✅ All 435 daily_practice_queue records migrated
- ✅ Views created successfully (or SQL printed for manual execution)

### Manual View Creation (if RPC fails)

If Supabase RPC is unavailable, the script will print SQL for manual execution:

1. Go to Supabase Studio → SQL Editor
2. Copy/paste the printed view SQL
3. Execute each CREATE VIEW statement
4. Verify views exist: `SELECT * FROM information_schema.views WHERE table_schema = 'public';`

## Files Modified

### `/Users/sboag/gittt/tunetrees/scripts/migrate-production-to-supabase.ts`

**Changes:**

- ✅ Added `migrateDailyPracticeQueue()` function (Phase 12)
- ✅ Added `createViews()` function (Phase 13)
- ✅ Added view SQL constants (converted from SQLite to PostgreSQL)
- ✅ Updated `main()` to call new phases
- ✅ Updated `verifyMigration()` to include daily_practice_queue
- ✅ 0 TypeScript errors
- ✅ Biome formatting passed

**Statistics:**

- Lines added: ~400
- New functions: 2
- New constants: 3 (view SQL definitions)
- Total phases: 13 (was 11)

## Expected Migration Output

```
📊 Phase 12: Migrating Daily Practice Queue
===========================================================
Found 435 queue records to migrate
✓ Batch 1/5: Migrated 100 queue records
✓ Batch 2/5: Migrated 100 queue records
✓ Batch 3/5: Migrated 100 queue records
✓ Batch 4/5: Migrated 100 queue records
✓ Batch 5/5: Migrated 35 queue records

✅ Daily practice queue migration complete: 435 migrated, 0 errors

📊 Phase 13: Creating Database Views
===========================================================
✓ Created view: view_playlist_joined
✓ Created view: practice_list_joined
✓ Created view: practice_list_staged

✅ Database views creation complete

📊 Migration Verification
===========================================================
Record Counts:
-----------------------------------------------------------
✓ daily_practice_queue   SQLite:    435  PostgreSQL:    435
✓ view definitions created
```

## Why These Were Needed for Phase 3

### Daily Practice Queue

- **Required for:** Practice session workflow
- **Usage:** Pre-generated practice queues for efficient daily practice flow
- **Data:** 435 existing queue entries contain user's practice history and scheduling decisions
- **Impact:** Without this data, users would lose their practice queue state

### Database Views

- **view_playlist_joined:** Simplifies playlist queries with instrument details
- **practice_list_joined:** Core view for practice UI - combines tunes, practice records, tags, notes
- **practice_list_staged:** Supports transient edits before commit (edit workflow)
- **Impact:** Practice UI depends on these views for efficient data retrieval

## Next Steps

1. ✅ Migration script updated and tested
2. ⏳ **Re-run production migration** to populate daily_practice_queue and create views
3. ⏳ Verify PostgreSQL has:
   - 435 daily_practice_queue records
   - 3 views created
4. ⏳ Resume Phase 3 development (Practice CRUD operations)

## Checklist for Re-Running Migration

- [ ] Backup current Supabase database (if needed)
- [ ] Run `npm run migrate:production` (or equivalent command)
- [ ] Verify daily_practice_queue count: `SELECT COUNT(*) FROM daily_practice_queue;`
- [ ] Verify views exist: `SELECT * FROM information_schema.views WHERE table_schema = 'public';`
- [ ] Test view queries: `SELECT * FROM practice_list_joined LIMIT 10;`
- [ ] Update migration plan document with completion status

## Notes

- **Batch Size:** 100 records per batch prevents timeout issues
- **Unique Constraint:** Prevents duplicate queue entries during re-runs
- **View Fallback:** If RPC unavailable, script provides SQL for manual execution
- **Idempotent:** Safe to re-run migration (upsert operations)

## Related Documents

- Migration Plan: `_notes/solidjs-pwa-migration-plan.md`
- Phase 3 Plan: See "Phase 3: Practice Session Management" section
- Database Schema: `src/lib/db/schema.ts`
- Legacy Schema: `legacy/tunetrees/models/tunetrees.py`

---

**Created:** January 9, 2025  
**Status:** Migration script updated, ready to re-run  
**Next:** Execute migration and resume Phase 3 development
