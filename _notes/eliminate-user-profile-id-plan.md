# Plan: Eliminate internal user_profile.id in favor of Auth User ID

## Goal
Use the Supabase Auth user ID as the single identifier for users, removing reliance on an internal `user_profile.id`.

## Evaluation (with pushback)
- ✅ Simplifies identity: fewer joins/mappings, aligns with Supabase Auth and RLS.
- ✅ Reduces sync/conflict complexity: one canonical ID across devices.
- ✅ Anonymous/test users already use Supabase Auth IDs (no special handling needed).
- ✅ Migration is straightforward: 12 tables with FKs to user_profile.id, all backfillable via join.
- ⚠️ Pushback: internal IDs can decouple from auth provider changes; removing them makes auth ID a hard dependency.
- ⚠️ Pushback: requires careful migration for existing data (but lower risk than maintaining dual IDs long-term).
- Decision: **Proceed** - benefits outweigh risks, migration is reversible, and dual-ID pattern creates ongoing auth confusion.

## Backup instructions (before migration)
- **Production Postgres (Supabase):**
  - Create a full database backup via Supabase dashboard or `pg_dump` (schema + data).
  - Export `user_profile` table separately for quick restore if needed.
- **Local/Dev:**
  - Snapshot local SQLite/IndexedDB (e.g., browser devtools export or app-provided backup).
  - Save a copy of local Drizzle migration artifacts for rollback reference.
Scope: Tables Affected

**12 tables** have foreign keys to `user_profile.id`:
1. `tab_group_main_state.user_id`
2. `tag.user_ref`
3. `tune.private_for`
4. `tune_override.user_ref`
5. `instrument.private_to_user`
6. `note.user_ref`
7. `playlist.user_ref`
8. `prefs_scheduling_options.user_id`
9. `reference.user_ref`
10. `table_state.user_id`
11. `prefs_spaced_repetition.user_id`
12. `table_transient_data.user_id`

**Why migration is safe:**
- ✅ `user_profile.supabase_user_id` is already `NOT NULL` and `UNIQUE`
- ✅ All FKs can be backfilled via join: `UPDATE table SET user_ref_uuid = (SELECT supabase_user_id FROM user_profile WHERE id = user_ref)`
- ✅ RLS policies already use `auth.uid()` and can be simplified
- ✅ Sync/outbox not directly affected (tracks changes by table row PKs)
- ✅ Migration is reversible (can add UUID columns, validate, then cutover)

### Schema/Drizzle migrations
- Update `user_profile` primary key from `id` serial to `supabase_user_id` UUID
- Update all 12 tables: change FK columns from `integer` to `uuid`, reference `user_profile.supabase_user_id`
- Update RLS policies: simplify to use auth ID directly (no more join to user_profile for ID resolution)

### oosync/codegen
- **Before codegen**: Update Drizzle schema inputs
- **Run**: `npm run codegen:schema` to regenerate contract outputs
- **Verify**: Check that user_profile no longer has dual ID fields in generated types
- **Update adapters**: Remove any casing/mapping for `user_profile.id` ↔ `supabase_user_id`

### Worker sync engine (`oosync/worker/src/index.ts`)
- **Remove**: `userId` ↔ `authUserId` resolution logic (lines 1270-1310)
- **Simplify**: Use `authUserId` directly for all user-scoped queries
- **Remove**: Special handling for `user_profile` table in `ensureData` and filter logic
- **Update**: Context type to use single user ID field

### App code
- **Remove**: Any `user_profile.id` references, use auth user ID directly
- **Update**: Join logic in queries (no longer need to join user_profile for ID resolution)
- **Update**: Local DB initialization to use auth ID for per-user namespaces
- **Simplify**: User context/state management (single ID source)
- **Review**: UI components that display or filter by user (should already use auth ID)
   - Add UUID columns to all 12 tables (e.g., `user_ref_uuid`)
   - Backfill via joins: `UPDATE tag SET user_ref_uuid = (SELECT up.supabase_user_id FROM user_profile up WHERE up.id = tag.user_ref)`
   - Validate counts match
   - Drop old integer FKs
   - Rename UUID columns to replace integer columns
   - Alter `user_profile`: drop `id`, make `supabase_user_id` PK
3. Regenerate schema contract/codegen (`npm run codegen:schema`)
4. Reset local database and re-run seed scripts
5. Validate existing user flows in local environment

**Alternative for preserving local data:**
- Export user data before migration
- Run migration SQL
- Verify data integrity
- Re-import if needed (though local data is typically disposable)

### Production - Zero-Downtime Approach
**Recommended for production with active users:**

**Phase 1: Add UUID columns (non-breaking)**
1. Deploy migration #1:
   - Add `*_uuid` columns to all 12 tables (nullable initially)
   - Add index on new columns
2. Deploy code that writes to both old and new columns

**Phase 2: Backfill (read-only or low-traffic window)**
1. Run backfill script:
   ```sql
   -- For each of 12 tables:
   UPDATE tag SET user_ref_uuid = (
     SELECT supabase_user_id FROM user_profile WHERE id = tag.user_ref
   ) WHERE user_ref_uuid IS NULL;
   ```
2. Validate: `SELECT COUNT(*) FROM tag WHERE user_ref IS NOT NULL AND user_ref_uuid IS NULL;` (should be 0)
3. Make UUID columns `NOT NULL`

**Phase 3: Add new FKs (non-breaking)**
1. Deploy migration #2:
   - Add FK constraints from `*_uuid` columns to `user_profile.supabase_user_id`
2. Deploy code that reads from UUID columns (still writes to both)

**Phase 4: Cutover (brief maintenance or transaction)**
1. Deploy migration #3:
   - Drop old integer FK constraints
   - Drop old integer columns
   - Rename `*_uuid` columns to replace original names
   - Alter `user_profile`: drop `id`, make `supabase_user_id` the new `id` (or rename appropriately)
2. Deploy final code using only auth IDs
3. Monitor logs for any issues

**Phase 5: Cleanup**
- Remove `userId` ↔ `authUserId` resolution logic from worker
- Update RLS policies to use auth ID directly
- Remove any ID mapping caches

### Production - "Big Bang" Approach (Low-Traffic Alternative)
**For staging or production with maintenance window:**

1. **Pre-migration** (15 min before):
   - Announce maintenance window
   - Create full database backup
   - Put app in read-only mode (optional: maintenance page)

2. **Migration transaction** (single atomic operation):
   ```sql
   BEGIN;
   
   -- Add UUID columns to all 12 tables
   ALTER TABLE tag ADD COLUMN user_ref_uuid UUID;
   -- ... (repeat for all 12 tables)
   
   -- Backfill
   UPDATE tag SET user_ref_uuid = (SELECT supabase_user_id FROM user_profile WHERE id = tag.user_ref);
   -- ... (repeat for all 12 tables)
   
   -- Validate
   DO $$
   BEGIN
     IF (SELECT COUNT(*) FROM tag WHERE user_ref IS NOT NULL AND user_ref_uuid IS NULL) > 0 THEN
       RAISE EXCEPTION 'Backfill validation failed for tag';
     END IF;
     -- ... (repeat for all 12 tables)
   END $$;
   
   -- Drop old FKs and columns
   ALTER TABLE tag DROP CONSTRAINT tag_user_ref_user_profile_id_fk;
   ALTER TABLE tag DROP COLUMN user_ref;
   ALTER TABLE tag RENAME COLUMN user_ref_uuid TO user_ref;
   -- ... (repeat for all 12 tables)
   
   -- Update user_profile
   ALTER TABLE user_profile DROP CONSTRAINT user_profile_pkey;
   ALTER TABLE user_profile DROP COLUMN id;
   ALTER TABLE user_profile ADD PRIMARY KEY (supabase_user_id);
   
   COMMIT;
   ```

3. **Deploy updated code** (immediately after migration)
4. **Resume traffic** and monitor
5. **Rollback plan**: Restore from backup if critical issues within 1 hour safe.
4. Resume traffic and monitor logs/sync.

## Code change plan
- **Schema/Drizzle migrations:**
  - Update `user_profile` primary key to `auth_user_id` (or equivalent).
  - Update all tables with `user_profile_id` FKs to reference auth ID.
- **oosync/codegen:**
  - Update schema inputs and regenerate contract outputs.
  - Ensure adapters map to auth ID consistently (no internal ID usage).
- **App code:**
  - Replace references to `user_profile.id` with auth user ID.
  - Update any join logic, UI selectors, and sync/outbox metadata.
  - Ensure local DB initialization uses auth ID for per-user namespaces.

## Handling anonymous/test users
- **Anonymous users**: Handled automatically via `supabase.auth.signInAnonymously()`, which provides permanent Auth UUIDs.
- **Test users**: Already created in Supabase Auth with deterministic UUIDs via `scripts/create-test-users.ts`. These Auth IDs are used consistently across test fixtures, seed data, and E2E helpers.
- **No special handling needed**: All users (production, anonymous, test) use Supabase Auth IDs as their single identifier.

## Test plan (E2E)
- Update E2E fixtures to use auth IDs.
- Run core flows:
  - Sign-in → profile load → data create → sync → reload.
  - Existing user migration: pre-migration data loads correctly post-migration.
  - Anonymous/test session handling (if supported).

## Constraints/notes
- Do not hand-edit generated schema/contract files; update inputs and rerun codegen.
- Keep API/public contracts stable where possible.
- Avoid changes in `legacy/`.
- Ensure RLS policies continue to reference auth user IDs.
