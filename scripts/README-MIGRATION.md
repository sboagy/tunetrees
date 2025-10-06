# Supabase Data Migration Guide

This guide explains how to migrate data from your production SQLite database to Supabase PostgreSQL.

## Prerequisites

1. **Supabase Project Setup**

   - Supabase project created
   - All tables already exist in PostgreSQL (they should match the Drizzle schema)
   - Service role key obtained from Supabase dashboard

2. **Environment Variables**

   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (NOT the anon key)

3. **Your Supabase User UUID**
   - Log into the TuneTrees app
   - Check the home page - it will display your Supabase User ID
   - Copy the UUID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Migration Steps

### 1. Get Your User UUID

```bash
# Start the dev server
npm run dev

# Navigate to http://localhost:5173
# Log in with your account
# Your UUID will be displayed on the home page
```

### 2. Set Environment Variables

Create or update `.env.local` with your Supabase service role key:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

⚠️ **Important:** The service role key has admin privileges. Never commit it to git!

### 3. Run the Migration

```bash
npm run migrate:supabase -- --user-uuid=YOUR-UUID-HERE
```

Example:

```bash
npm run migrate:supabase -- --user-uuid=123e4567-e89b-12d3-a456-426614174000
```

### 4. Verify the Migration

The script will output record counts for each table. Verify they match expectations:

```
📊 Record counts:
   Users: 1
   Tunes: 1234
   Playlists: 5
   Playlist-Tune: 456
   Practice Records: 789
   Notes: 23
   References: 12
   Tags: 45
```

## What the Script Does

### User ID Mapping

The script automatically maps old integer user IDs to UUIDs:

- **Old:** `user_id = 1` (SQLite integer)
- **New:** Your Supabase Auth UUID

All references to `user_id = 1` across all tables are updated to your UUID.

### Tables Migrated (in order)

1. **Reference Data** (no dependencies)

   - `genre`
   - `instrument`
   - `tune_type`

2. **Core Tables**
   - `user` - Your user record
   - `tune` - All tunes (maps `private_for` user IDs)
   - `playlist` - Your playlists (maps `user_ref`)
   - `playlist_tune` - Tune assignments
3. **Content Tables**
   - `practice_record` - Practice history (maps `user_ref`)
   - `note` - Tune notes (maps `user_ref`)
   - `reference` - External references
   - `tag` - User tags (maps `user_ref`)

### Conflict Handling

The script uses `UPSERT` operations:

- **First run:** Inserts all records
- **Subsequent runs:** Updates existing records with matching IDs
- This makes the script **idempotent** - safe to re-run

## Re-seeding from Fresh Production Data

If you need to refresh Supabase with new production data:

### Option A: Full Re-seed (Recommended)

```bash
# 1. Get latest production backup
scp user@your-server:/path/to/tunetrees.sqlite3 ./tunetrees_production_manual.sqlite3

# 2. Run migration (will update all records)
npm run migrate:supabase -- --user-uuid=YOUR-UUID
```

### Option B: Clear and Re-import

If you want to start completely fresh:

```bash
# 1. Clear all tables in Supabase (use Supabase Dashboard SQL Editor)
DELETE FROM practice_record;
DELETE FROM note;
DELETE FROM reference;
DELETE FROM tag;
DELETE FROM playlist_tune;
DELETE FROM playlist;
DELETE FROM tune;
DELETE FROM user_annotation_set;
DELETE FROM user;
DELETE FROM genre;
DELETE FROM instrument;
DELETE FROM tune_type;

# 2. Run migration
npm run migrate:supabase -- --user-uuid=YOUR-UUID
```

## Troubleshooting

### Error: "Missing Supabase credentials"

Make sure `.env.local` contains:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-key
```

### Error: "Invalid UUID format"

The UUID must be in format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Get it from the home page after logging in.

### Error: "violates foreign key constraint"

This means tables don't exist in Supabase or schema doesn't match.

**Solution:** Check that all tables exist in Supabase PostgreSQL and match the Drizzle schema.

### Record count mismatch

If counts don't match:

1. Check that `deleted = 0` records are being counted correctly
2. Look for migration errors in the console output
3. Re-run the migration (it's idempotent)

## Schema Verification

To verify Supabase schema matches your Drizzle schema:

```sql
-- In Supabase SQL Editor, check table exists:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Should show:

- user
- tune
- playlist
- playlist_tune
- practice_record
- note
- reference
- tag
- genre
- instrument
- tune_type
- user_annotation_set
- tune_override

## Safety Notes

1. **Backup First:** Always have a backup of your production SQLite database
2. **Test Environment:** Consider running migration on a test Supabase project first
3. **Service Role Key:** Never commit this to git. Add to `.gitignore`:
   ```
   .env.local
   .env.*.local
   ```
4. **Idempotent:** The script can be run multiple times safely (uses UPSERT)
5. **Sync Queue:** The migration does NOT populate the sync queue - that's only for local changes

## Next Steps After Migration

1. **Test Sync Layer:** Create/update/delete a tune locally and verify it syncs to Supabase
2. **Pull Changes:** Verify that changes made in Supabase appear in your local app
3. **Practice Records:** Test the practice workflow once Phase 3 is implemented
4. **Monitor:** Check Supabase logs for any sync errors

## Advanced: Multiple Users

If you have multiple users in your production database:

1. Each user needs to sign up in Supabase Auth
2. Note their UUIDs
3. Modify the `mapUserId()` function in `migrate-to-supabase.ts`:

```typescript
function mapUserId(oldUserId: number | null): string | null {
  if (oldUserId === null) return null;

  // Map each old user ID to their new UUID
  const userMap: Record<number, string> = {
    1: "uuid-for-user-1",
    2: "uuid-for-user-2",
    3: "uuid-for-user-3",
  };

  return userMap[oldUserId] || null;
}
```

4. Run the migration

---

**Last Updated:** October 5, 2025  
**Script:** `scripts/migrate-to-supabase.ts`
