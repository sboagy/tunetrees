# Supabase Migration Setup - Complete

**Date:** October 5, 2025  
**Status:** ✅ Ready to Run Migration

## What Was Done

### 1. Fixed Home Page ✅

- Added user info display when logged in
- Shows email and **Supabase User UUID** (needed for migration)
- Added Sign Out button
- Removed auto-redirect to practice page

### 2. Created Migration Script ✅

**File:** `scripts/migrate-to-supabase.ts`

**Features:**

- ✅ Maps integer user IDs (1, 2, 3...) → Supabase UUIDs
- ✅ Migrates all tables in dependency order
- ✅ Handles foreign key relationships correctly
- ✅ Idempotent (safe to re-run with UPSERT)
- ✅ Batch processing for large tables (100 records at a time)
- ✅ Comprehensive error handling and logging
- ✅ Validates UUID format
- ✅ Reports record counts before/after

**Tables Migrated:**

1. Reference data: `genre`, `instrument`, `tune_type`
2. Core: `user`, `tune`, `playlist`, `playlist_tune`
3. Content: `practice_record`, `note`, `reference`, `tag`

### 3. Updated package.json ✅

Added script:

```json
"migrate:supabase": "tsx scripts/migrate-to-supabase.ts"
```

### 4. Installed Dependencies ✅

- `better-sqlite3` - Read production SQLite database
- `@types/better-sqlite3` - TypeScript types
- `tsx` - Run TypeScript scripts directly

### 5. Created Documentation ✅

**File:** `scripts/README-MIGRATION.md`

Complete guide covering:

- Prerequisites
- Step-by-step instructions
- User UUID mapping strategy
- Re-seeding procedures
- Troubleshooting
- Schema verification
- Multi-user scenarios

## How to Use

### Step 1: Get Your UUID

```bash
npm run dev
# Navigate to http://localhost:5173
# Log in
# Copy the UUID shown on home page
```

### Step 2: Set Service Role Key

Add to `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get this from: Supabase Dashboard → Settings → API → service_role key

### Step 3: Run Migration

```bash
npm run migrate:supabase -- --user-uuid=YOUR-UUID-HERE
```

Example:

```bash
npm run migrate:supabase -- --user-uuid=123e4567-e89b-12d3-a456-426614174000
```

### Step 4: Verify

Check console output for record counts. They should match your production database.

## Key Design Decisions

### UUID Mapping Strategy

**Problem:** SQLite uses integer user IDs (1, 2, 3...), Supabase Auth uses UUIDs

**Solution:** Migration script maps all user_id=1 references to your Supabase UUID

- All `user_ref` columns updated
- All `private_for` columns updated
- All user-specific records correctly associated

### Idempotent Design

**Why:** You'll be using Digital Ocean production instance during development

**Benefit:** Can re-seed Supabase from fresh production snapshots anytime

- First run: Inserts all records
- Subsequent runs: Updates existing records
- No manual cleanup needed

### Batch Processing

Large tables (tunes, practice_record) processed in batches of 100 to:

- Avoid memory issues
- Provide progress feedback
- Handle Supabase rate limits gracefully

## What Happens During Migration

### Data Flow

```
tunetrees_production_manual.sqlite3
    ↓
Migration Script
    ├─ Read SQLite data
    ├─ Map user IDs (1 → UUID)
    ├─ Transform to Supabase format
    └─ Upsert to PostgreSQL
        ↓
Supabase PostgreSQL Database
```

### User ID Transformation

```
SQLite:
  user.id = 1
  playlist.user_ref = 1
  practice_record.user_ref = 1

     ↓ Migration ↓

Supabase:
  user.id = "123e4567-e89b-12d3-a456-426614174000"
  playlist.user_ref = "123e4567-e89b-12d3-a456-426614174000"
  practice_record.user_ref = "123e4567-e89b-12d3-a456-426614174000"
```

## Next Steps After Migration

1. **Run Migration** - Follow steps above
2. **Verify Data** - Check Supabase dashboard
3. **Test Sync** - Create/update a tune, verify it syncs to Supabase
4. **Continue Phase 3** - Practice session management with real data
5. **Set Up Re-seeding** - Document your refresh workflow

## Files Created

```
scripts/
├── migrate-to-supabase.ts       # Migration script (560 lines)
├── README-MIGRATION.md          # Complete documentation
└── .eslintrc.json              # Disable strict linting for scripts

src/routes/
└── Home.tsx                    # Updated to show UUID

package.json                    # Added migrate:supabase script
```

## Safety Checklist

Before running migration:

- [ ] Supabase tables exist (matching Drizzle schema)
- [ ] Service role key in `.env.local` (NOT committed to git)
- [ ] Your UUID copied from home page
- [ ] Production SQLite backup exists
- [ ] UUID format validated (8-4-4-4-12 hex digits)

## Troubleshooting Reference

| Error                 | Solution                                        |
| --------------------- | ----------------------------------------------- |
| Missing credentials   | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` |
| Invalid UUID          | Get UUID from home page after login             |
| Foreign key violation | Check Supabase tables exist and match schema    |
| Record count mismatch | Re-run migration (it's idempotent)              |

## Why This Approach?

1. **Parallel Development:** You can keep using Digital Ocean while building PWA
2. **Real Data Testing:** Test sync layer with actual production data
3. **Easy Refresh:** Re-seed Supabase anytime production changes
4. **Type Safe:** Migration uses TypeScript for reliability
5. **Documented:** Clear instructions for future re-seeding
6. **Extensible:** Easy to add more users by updating `mapUserId()`

---

**Ready to migrate!** 🚀

See `scripts/README-MIGRATION.md` for complete documentation.
