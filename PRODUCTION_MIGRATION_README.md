# Production Data Migration: SQLite → Supabase PostgreSQL

**Status:** Ready for Testing  
**Date:** October 5, 2025  
**Script:** `scripts/migrate-production-to-supabase.ts`

---

## Overview

This migration script moves **ALL** production data from `tunetrees_production_manual.sqlite3` to your Supabase PostgreSQL database. It has been designed to handle all schema differences, preserve relationships, and create the necessary Supabase Auth users.

### Architecture Understanding

The PostgreSQL schema uses a **hybrid user ID approach**:

```
user_profile table:
├── id (serial)               ← INTEGER primary key (preserved from SQLite)
└── supabase_user_id (uuid)   ← Links to Supabase auth.users (new)

All foreign keys use user_profile.id (integer), NOT the UUID.
```

This means:

- Your SQLite `user.id = 1` becomes `user_profile.id = 1` in PostgreSQL
- Your Supabase Auth UUID (`b2b64a0a-...`) is stored in `user_profile.supabase_user_id`
- All playlists, practice records, etc. reference `user_ref = 1` (the integer ID)

---

## Prerequisites

### 1. Backup Your Databases

```bash
# Backup SQLite (source)
cp tunetrees_production_manual.sqlite3 tunetrees_production_backup_$(date +%Y%m%d).sqlite3

# Backup Supabase (target) - use Supabase dashboard:
# Settings → Database → Backups → Download Latest Backup
```

### 2. Verify Environment Variables

Create/update `.env.local` with:

```bash
VITE_SUPABASE_URL=https://pjxuonglsvouttihjven.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb... # Get from Supabase Dashboard → Settings → API
```

⚠️ **IMPORTANT:** Use the **service role key**, not the anon key. The service role key has admin privileges needed to create auth users.

### 3. Get Your Supabase User UUID

1. Log into the app (locally or deployed)
2. Go to the home page
3. Copy your **Supabase User ID** displayed on the page

Example: `b2b64a0a-18d4-4d00-aecb-27f676defe31`

This UUID will be used for your account (SQLite `user.id = 1`).

---

## What the Migration Does

### Phase 1: Users

- Creates Supabase Auth users for each SQLite user
- User ID 1 → Maps to YOUR existing Supabase UUID (provided via command line)
- Other users → Creates new Supabase auth users with random temporary passwords
- Inserts `user_profile` with:
  - `id` = original SQLite user ID (preserved)
  - `supabase_user_id` = Supabase Auth UUID
  - All other user fields (name, email, phone, etc.)

### Phase 2: Reference Data

- Migrates genres, tune types, genre-tune type relationships
- Migrates instruments (handles TEXT → INTEGER ID conversion)
- Builds instrument mapping for playlist migration

### Phase 3-4: Tunes

- Migrates all tunes with correct genre references (INT → TEXT conversion)
- Migrates tune overrides

### Phase 5-6: Playlists

- Migrates playlists (handles instrument TEXT → INTEGER FK)
- Migrates playlist-tune relationships with FSRS timestamps

### Phase 7: Practice Records

- Migrates ALL practice records
- Handles column renames:
  - `practiced_at` → `practiced`
  - `reps` → `repetitions`
- Converts TEXT timestamps → PostgreSQL timestamps

### Phase 8-10: User Data

- Migrates notes (preserves public/favorite flags)
- Migrates references (handles column rename: `reference_text` → `comment`)
- Migrates tags (handles column rename: `tag` → `tag_text`)

### Phase 11: Preferences

- Migrates spaced repetition preferences (FSRS/SM2 settings)
- Migrates scheduling preferences

### Verification

- Compares record counts: SQLite vs PostgreSQL
- Reports any mismatches

---

## Running the Migration

### Test Mode (Recommended First)

Use a **test Supabase project** for initial testing:

```bash
# 1. Create a test Supabase project
# 2. Run Drizzle migrations against test project
npx drizzle-kit push:pg

# 3. Run migration
npm run migrate:production -- --user-uuid=<your-test-uuid>
```

### Production Mode

⚠️ **WARNING:** This will **overwrite existing data** in your production Supabase database!

```bash
# Ensure you're using production Supabase credentials in .env.local
npm run migrate:production -- --user-uuid=b2b64a0a-18d4-4d00-aecb-27f676defe31
```

---

## Expected Output

### Successful Migration

```
═══════════════════════════════════════════════════════════
  TUNETREES PRODUCTION DATA MIGRATION
  SQLite → Supabase PostgreSQL
═══════════════════════════════════════════════════════════

🔧 Migration Configuration:
   Source: ./tunetrees_production_manual.sqlite3
   Target: Supabase PostgreSQL
   Your UUID: b2b64a0a-18d4-4d00-aecb-27f676defe31
   Device ID: data-migration-2025-10-05

📊 Phase 1: Migrating Users
════════════════════════════════════════════════════════════
Found 12 active users in SQLite

✓ User 1 (sboagy@gmail.com) → Using existing UUID b2b64a0a-...
✓ User 2 (user2@example.com) → Created new UUID 8a3f1b...
...

✅ Migrated 12 users
   User ID mapping: 1→1, 2→2, 3→3, ...

📊 Phase 2: Migrating Reference Data
════════════════════════════════════════════════════════════

Migrating genres...
✓ Migrated 15 genres

Migrating tune types...
✓ Migrated 25 tune types

...

📊 Phase 3: Migrating Tunes
════════════════════════════════════════════════════════════
Found 1523 tunes

✓ Migrated 100/1523 tunes
✓ Migrated 200/1523 tunes
...
✓ Migrated 1523/1523 tunes

✅ Tunes migration complete

...

📊 Migration Verification
════════════════════════════════════════════════════════════

Record Counts:
────────────────────────────────────────────────────────────
✓ user                SQLite:     12  PostgreSQL:     12
✓ genre               SQLite:     15  PostgreSQL:     15
✓ tune_type           SQLite:     25  PostgreSQL:     25
✓ instrument          SQLite:      8  PostgreSQL:      8
✓ tune                SQLite:   1523  PostgreSQL:   1523
✓ tune_override       SQLite:     45  PostgreSQL:     45
✓ playlist            SQLite:     12  PostgreSQL:     12
✓ playlist_tune       SQLite:    856  PostgreSQL:    856
✓ practice_record     SQLite:   3421  PostgreSQL:   3421
✓ note                SQLite:    127  PostgreSQL:    127
✓ reference           SQLite:     83  PostgreSQL:     83
✓ tag                 SQLite:    214  PostgreSQL:    214
────────────────────────────────────────────────────────────

✅ All record counts match!

═══════════════════════════════════════════════════════════
  ✅ MIGRATION COMPLETED SUCCESSFULLY
  Elapsed time: 45.3s
═══════════════════════════════════════════════════════════
```

### If There Are Errors

Look for lines like:

```
✗ Failed to create auth user for user@example.com: { message: "...", ... }
✗ Error migrating tunes batch 200: { code: "...", message: "..." }
```

Common errors:

- **Duplicate email:** Supabase Auth user already exists → Safe to ignore if you're re-running migration
- **Foreign key violation:** Indicates missing reference data → Check previous phase completed successfully
- **Invalid UUID:** Provided user UUID is wrong format or doesn't exist

---

## Post-Migration Verification

### 1. Check User Profile

```sql
-- Supabase SQL Editor
SELECT
  id,
  supabase_user_id,
  email,
  name
FROM user_profile
WHERE supabase_user_id = 'b2b64a0a-18d4-4d00-aecb-27f676defe31';
```

Expected: 1 row with your email and name.

### 2. Check Playlists

```sql
SELECT
  p.playlist_id,
  p.user_ref,
  u.email,
  i.instrument
FROM playlist p
JOIN user_profile u ON p.user_ref = u.id
LEFT JOIN instrument i ON p.instrument_ref = i.id
WHERE u.supabase_user_id = 'b2b64a0a-18d4-4d00-aecb-27f676defe31';
```

Expected: Your playlists with correct instruments.

### 3. Check Practice Records

```sql
SELECT
  pr.id,
  pr.practiced,
  pr.quality,
  t.title,
  p.user_ref
FROM practice_record pr
JOIN tune t ON pr.tune_ref = t.id
JOIN playlist p ON pr.playlist_ref = p.playlist_id
WHERE p.user_ref = 1
ORDER BY pr.practiced DESC
LIMIT 10;
```

Expected: Recent practice records with valid timestamps.

### 4. Check Foreign Key Integrity

```sql
-- All practice records should have valid tune references
SELECT COUNT(*)
FROM practice_record pr
LEFT JOIN tune t ON pr.tune_ref = t.id
WHERE t.id IS NULL;
```

Expected: `0` (no orphaned records).

### 5. Test Sync Columns

```sql
-- All migrated records should have sync_version = 1
SELECT
  sync_version,
  COUNT(*) as count
FROM practice_record
GROUP BY sync_version;
```

Expected: All records have `sync_version = 1`.

---

## Troubleshooting

### Migration Hangs

- Check network connection to Supabase
- Verify service role key is correct
- Look for console errors

### Record Counts Don't Match

- Check migration logs for failed batches
- Re-run migration (it uses `upsert`, so it's idempotent)
- Verify SQLite database isn't corrupted

### Auth User Creation Fails

- **Error:** "User already exists"
  - **Solution:** User already created from previous migration run. Safe to continue.
- **Error:** "Invalid email"
  - **Solution:** Check SQLite user.email field has valid email addresses.

### Foreign Key Violations

- **Error:** "insert or update on table X violates foreign key constraint..."
  - **Solution:** Ensure reference data (users, tunes, playlists) migrated successfully first.

### Can't Find Supabase User UUID

```bash
# Option 1: Login to app and check home page

# Option 2: Query Supabase directly (SQL Editor)
SELECT id, email FROM auth.users;
```

---

## Re-Running the Migration

The migration uses **upsert** operations, so it's **safe to re-run**:

1. **User creation:** Skips if auth user already exists (catches error)
2. **Table data:** Uses `onConflict` to update existing records

To **fully reset** and re-run:

```bash
# 1. Clear Supabase data (SQL Editor)
DELETE FROM practice_record;
DELETE FROM playlist_tune;
DELETE FROM playlist;
DELETE FROM tune_override;
DELETE FROM tune;
DELETE FROM note;
DELETE FROM reference;
DELETE FROM tag;
DELETE FROM user_profile;
# ... etc

# 2. Delete auth users (Supabase Dashboard → Authentication → Users)

# 3. Re-run migration
npm run migrate:production -- --user-uuid=<your-uuid>
```

---

## Schema Differences Handled

| SQLite Column                  | PostgreSQL Column                                           | Conversion                 |
| ------------------------------ | ----------------------------------------------------------- | -------------------------- |
| `user.id` (integer)            | `user_profile.id` (serial)                                  | Preserved                  |
| N/A                            | `user_profile.supabase_user_id` (uuid)                      | Created from Supabase Auth |
| `practice_record.practiced_at` | `practice_record.practiced`                                 | Renamed, TEXT → timestamp  |
| `practice_record.reps`         | `practice_record.repetitions`                               | Renamed                    |
| `reference.reference_text`     | `reference.comment`                                         | Renamed                    |
| `tag.tag`                      | `tag.tag_text`                                              | Renamed                    |
| `playlist.instrument` (TEXT)   | `playlist.instrument_ref` (integer FK)                      | Lookup mapping             |
| `tune.genre_ref` (integer)     | `tune.genre` (text FK)                                      | Converted                  |
| N/A                            | All tables: `sync_version`, `last_modified_at`, `device_id` | Added (sync columns)       |

---

## Next Steps After Migration

1. **Test Local App:**

   ```bash
   npm run dev
   ```

   Login and verify your data appears correctly.

2. **Test Sync Layer:**

   - Create a new practice record
   - Verify it syncs to Supabase
   - Check sync_version increments

3. **Deploy to Production:**

   ```bash
   npm run build
   # Deploy to Cloudflare Pages
   ```

4. **Monitor:**
   - Supabase Dashboard → Database → Logs
   - Check for errors, slow queries

---

## Support

If you encounter issues:

1. **Check migration logs** for specific error messages
2. **Review this README** for common troubleshooting steps
3. **Verify prerequisites** (env vars, backups, UUID)
4. **Test in a separate Supabase project** before production

**Remember:** This is a **practice run** to get the migration right!

---

**Last Updated:** October 5, 2025  
**Script Version:** 1.0.0  
**Tested:** Not yet (awaiting user testing)
