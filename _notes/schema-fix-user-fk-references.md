# Schema Fix: User FK References (2025-01-16)

## Problem

**tune_override records were created in SQLite but not syncing to Postgres.**

### Root Cause

Systematic schema mismatch between SQLite and Postgres user FK references:

**SQLite (BEFORE FIX):**
- All `userRef` FK columns referenced `userProfile.supabaseUserId` (auth UUID)
- `userProfile` table structure:
  - Primary Key: `supabase_user_id` (UUID from auth.users)
  - Non-unique field: `id` (internal UUID)

**Postgres:**
- All `userRef` FK columns referenced `userProfile.id` (internal UUID)
- `userProfile` table structure:
  - Primary Key: `id` (internal UUID)
  - Unique field: `supabase_user_id` (UUID from auth.users)

### Impact

When creating/updating records with user references (e.g., `tune_override`):

1. ✅ **SQLite:** Worked correctly - FKs matched `supabaseUserId` PK
2. ❌ **Postgres:** Silent FK constraint violation - received `supabaseUserId` value but expected `id` value
3. ⚠️ **Sync logs:** Showed "success" because SQLite operation succeeded, but Postgres insert/update failed silently

### Affected Tables

All tables with user FK references (12 total):
- `tune.privateFor`
- `tune_override.userRef`
- `instrument.privateToUser`
- `playlist.userRef`
- `playlist_tune` (no direct userRef, but related)
- `note.userRef`
- `reference.userRef`
- `table_state.userId`
- `table_transient_data.userId`
- `tab_group_main_state.userId`
- `prefs_scheduling_options.userId`
- `prefs_spaced_repetition.userId`
- `tag.userRef`

## Solution

### 1. Updated SQLite Schema (`drizzle/schema-sqlite.ts`)

**Changed ALL user FK references to use `userProfile.id` instead of `userProfile.supabaseUserId`:**

```typescript
// BEFORE
userRef: text("user_ref").references(() => userProfile.supabaseUserId)

// AFTER  
userRef: text("user_ref").references(() => userProfile.id)
```

**Added unique index on `userProfile.id`** to allow FK references:

```typescript
export const userProfile = sqliteTable(
  "user_profile",
  {
    id: text().notNull(), // UUID (internal ID, now unique)
    supabaseUserId: text("supabase_user_id").primaryKey().notNull(), // UUID PK (auth ID)
    // ... other fields
  },
  (table) => [
    uniqueIndex("user_profile_id_unique").on(table.id), // ✅ NEW
    uniqueIndex("user_profile_supabase_user_id_unique").on(table.supabaseUserId),
  ]
);
```

### 2. Updated Auth Context (`src/lib/auth/AuthContext.tsx`)

**Fetch BOTH IDs from Supabase and use internal ID for FK relationships:**

```typescript
// BEFORE
const { data: userProfile, error } = await supabase
  .from("user_profile")
  .select("supabase_user_id")
  .eq("supabase_user_id", userId)
  .single();
const userUuid = userProfile.supabase_user_id;
setUserIdInt(userUuid); // ❌ Using auth UUID

// AFTER
const { data: userProfile, error } = await supabase
  .from("user_profile")
  .select("id, supabase_user_id")
  .eq("supabase_user_id", userId)
  .single();
const userInternalId = userProfile.id; // Internal UUID (PK in Postgres)
const userUuid = userProfile.supabase_user_id; // Auth UUID
setUserIdInt(userInternalId); // ✅ Using internal ID for FK relationships
```

### 3. Created Migration Script

**`sql_scripts/migrations/sqlite_add_user_profile_id_unique.sql`:**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS user_profile_id_unique ON user_profile(id);
```

This migration ensures existing local SQLite databases get the unique index.

## Verification Steps

1. ✅ TypeScript compilation passes
2. ✅ Biome format passes
3. ⏳ Test tune_override sync after changes (pending user test)

### Test Plan

1. User logs in → Auth context fetches both `id` and `supabase_user_id`
2. User edits public tune (e.g., "Abby Reel" → "Yappy Reel")
3. Code creates `tune_override` with `userRef = userInternalId` (from `userProfile.id`)
4. SQLite: Record created with FK to `user_profile.id` (now unique) ✅
5. Sync: Sends `userRef = userInternalId` to Postgres
6. Postgres: FK constraint validates against `user_profile.id` ✅
7. Result: tune_override appears in Supabase Postgres ✅

## Breaking Changes

**None for end users** - This is a bug fix that makes SQLite match Postgres.

**For developers:**
- `userIdInt()` from auth context now returns `user_profile.id` (internal UUID)
- Previously returned `user_profile.supabase_user_id` (auth UUID)
- Both are UUIDs, just different values
- Sync worker still uses `supabaseUserId` for authentication/realtime
- All FK relationships now correctly use internal ID

## Related Issues

- tune_override not syncing to Postgres (reported 2025-01-16)
- Editing public tunes creating local records but not syncing

## Files Changed

1. `drizzle/schema-sqlite.ts` - Fixed ALL user FK references
2. `src/lib/auth/AuthContext.tsx` - Fetch and use internal ID
3. `sql_scripts/migrations/sqlite_add_user_profile_id_unique.sql` - Migration for existing DBs

## Notes

- ⚠️ **Critical:** Despite the name, `userIdInt()` has ALWAYS returned a UUID string, never an integer. The name is misleading but changing it is out of scope for this fix.
- ✅ Postgres schema was correct all along - no Supabase migration needed
- ✅ SQLite schema now matches Postgres FK structure
- ✅ Both databases use `user_profile.id` (internal UUID) as the canonical user FK target
