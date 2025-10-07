# User ID UUID Migration Strategy

**Date:** October 5, 2025  
**Status:** Implemented in feat/pwa1 branch  
**Decision:** Use Supabase Auth UUIDs throughout the schema

## Problem Statement

Supabase Auth uses UUID strings for user IDs (e.g., `"550e8400-e29b-41d4-a716-446655440000"`), but the legacy TuneTrees database uses auto-incrementing integer IDs (e.g., `1`, `2`, `3`).

**Options Considered:**

1. **Keep integer IDs + mapping layer** - Create a mapping table between Supabase UUIDs and integer IDs
2. **Convert to UUIDs** - Migrate all user ID columns to text/UUID type ✅ **CHOSEN**
3. **Hybrid approach** - Use integers internally, UUIDs externally (creates sync complexity)

## Decision: Full UUID Migration

**Rationale:**

- ✅ **No impedance mismatch** - Auth system and database use same ID format
- ✅ **Simpler code** - No mapping layer, no translation logic
- ✅ **Supabase best practice** - Aligns with Supabase conventions
- ✅ **Future-proof** - Easier to federate with other systems
- ✅ **Security** - UUIDs don't leak sequential user counts
- ⚠️ **Migration cost** - One-time effort to remap legacy data

## Schema Changes

### Tables Modified (User ID Columns)

All `user_ref` and `private_for` columns changed from `integer` to `text`:

1. **users.id** - Primary key (was `INTEGER PRIMARY KEY`, now `TEXT PRIMARY KEY`)
2. **tunes.private_for** - Foreign key to users (nullable)
3. **playlists.user_ref** - Foreign key to users
4. **notes.user_ref** - Foreign key to users
5. **tags.user_ref** - Foreign key to users
6. **practice_records.user_ref** - Foreign key to users
7. **tune_overrides.user_ref** - Foreign key to users
8. **user_annotation_sets.user_ref** - Foreign key to users

### Before (Integer IDs)

```typescript
export const users = sqliteTable("user", {
  id: integer("id").primaryKey(), // ❌ Integer
  email: text("email").notNull().unique(),
  // ...
});

export const playlists = sqliteTable("playlist", {
  playlist_id: integer("playlist_id").primaryKey(),
  user_ref: integer("user_ref").notNull(), // ❌ Integer FK
  // ...
});
```

### After (UUID Text)

```typescript
export const users = sqliteTable("user", {
  id: text("id").primaryKey(), // ✅ UUID (text)
  email: text("email").notNull().unique(),
  // ...
});

export const playlists = sqliteTable("playlist", {
  playlist_id: integer("playlist_id").primaryKey(),
  user_ref: text("user_ref").notNull(), // ✅ UUID (text) FK
  // ...
});
```

## TypeScript Type Changes

### Input Types

```typescript
// Before
export interface CreatePlaylistInput {
  user_ref: number; // ❌
  // ...
}

// After
export interface CreatePlaylistInput {
  user_ref: string; // ✅ UUID
  // ...
}
```

### Query Functions

```typescript
// Before
export async function getTunesForUser(
  db: SqliteDatabase,
  userId: number // ❌
): Promise<Tune[]> { ... }

// After
export async function getTunesForUser(
  db: SqliteDatabase,
  userId: string // ✅ UUID
): Promise<Tune[]> { ... }
```

## Component Integration

### TuneList Component

**Before (workaround):**

```tsx
// Had to use getAllTunes() because user ID types didn't match
const [tunes] = createResource(
  () => localDb(),
  async (db) => {
    if (!db) return [];
    return await getAllTunes(db); // ❌ Shows only public tunes
  }
);
```

**After (proper filtering):**

```tsx
// Now uses user UUID directly from Supabase Auth
const [tunes] = createResource(
  () => {
    const userId = user()?.id; // ✅ UUID string from Supabase Auth
    const db = localDb();
    return userId && db ? { userId, db } : null;
  },
  async (params) => {
    if (!params) return [];
    return await getTunesForUser(params.db, params.userId); // ✅ Includes private tunes
  }
);
```

## Legacy Data Migration Plan

When migrating from the legacy SQLite database to the new Supabase schema:

### Step 1: Generate UUIDs for Existing Users

```sql
-- Option A: Use random UUIDs
UPDATE user
SET id = uuid_generate_v4()
WHERE id IS NOT NULL;

-- Option B: Use deterministic UUIDs (reproducible)
UPDATE user
SET id = uuid_generate_v5(
  'ns:tunetrees:user',
  email
)
WHERE id IS NOT NULL;
```

### Step 2: Create User ID Mapping Table (Temporary)

```sql
CREATE TABLE _migration_user_id_map (
  old_id INTEGER PRIMARY KEY,
  new_uuid TEXT NOT NULL,
  email TEXT NOT NULL
);

INSERT INTO _migration_user_id_map
SELECT id, uuid_generate_v5('ns:tunetrees:user', email), email
FROM user;
```

### Step 3: Remap Foreign Keys

```sql
-- Update playlists
UPDATE playlist
SET user_ref = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = playlist.user_ref
);

-- Update notes
UPDATE note
SET user_ref = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = note.user_ref
);

-- Update tags
UPDATE tag
SET user_ref = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = tag.user_ref
);

-- Update practice_records
UPDATE practice_record
SET user_ref = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = practice_record.user_ref
);

-- Update tune_overrides
UPDATE tune_override
SET user_ref = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = tune_override.user_ref
);

-- Update user_annotation_sets
UPDATE user_annotation_set
SET user_ref = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = user_annotation_set.user_ref
);

-- Update tunes.private_for (nullable)
UPDATE tune
SET private_for = (
  SELECT new_uuid
  FROM _migration_user_id_map
  WHERE old_id = tune.private_for
)
WHERE private_for IS NOT NULL;
```

### Step 4: Map to Supabase Auth Users

After migration, users will sign in with Supabase Auth. We need to link existing data to their Auth UUIDs:

```typescript
// On first login with Supabase Auth
async function linkLegacyUser(supabaseUserId: string, email: string) {
  // Find user by email in migrated data
  const legacyUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (legacyUser.length > 0) {
    // Update user ID to match Supabase Auth UUID
    await db
      .update(users)
      .set({ id: supabaseUserId })
      .where(eq(users.email, email));

    // Re-run foreign key updates with new UUID
    // ... (similar to Step 3)
  }
}
```

**Alternative:** Store mapping in `users.external_id`:

```typescript
// Keep generated UUID as primary key
// Store Supabase Auth UUID in external_id
await db
  .update(users)
  .set({
    external_source: "supabase_auth",
    external_id: supabaseUserId,
  })
  .where(eq(users.email, email));
```

## Migration Script Location

**File:** `scripts/migrate-user-ids-to-uuid.ts` (to be created)

**Usage:**

```bash
# Dry run (show what would change)
npm run migrate:user-ids -- --dry-run

# Execute migration
npm run migrate:user-ids -- --execute

# With Supabase Auth linking
npm run migrate:user-ids -- --execute --link-supabase
```

## Rollback Plan

If issues are discovered:

1. **Before deployment:** Simply revert commits on `feat/pwa1` branch
2. **After data migration:** Restore from backup, use integer → UUID mapping table

## Testing Strategy

### Unit Tests

```typescript
describe("UUID User IDs", () => {
  it("should accept UUID strings for user_ref", async () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const playlist = await createPlaylist(db, {
      user_ref: uuid,
      instrument: "fiddle",
    });
    expect(playlist.user_ref).toBe(uuid);
  });

  it("should filter tunes by user UUID", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const tunes = await getTunesForUser(db, userId);
    // Should include public + user's private tunes
  });
});
```

### Integration Tests

- ✅ Create user with Supabase Auth UUID
- ✅ Create private tune for that user
- ✅ Verify user can see their private tune
- ✅ Verify other users cannot see it
- ✅ Create playlist linked to user UUID
- ✅ Record practice session with user UUID

## Benefits Realized

### Before (Integer IDs)

```tsx
// ❌ Workaround: Show only public tunes
const [tunes] = createResource(..., getAllTunes);

// ❌ Can't create user-specific content without mapping
// User ID from Auth: "550e8400-..." (string)
// Database expects: 1 (number)
// Need translation layer
```

### After (UUID IDs)

```tsx
// ✅ Direct use of Supabase Auth user ID
const userId = user()?.id; // "550e8400-e29b-41d4-a716-446655440000"

// ✅ Works seamlessly with queries
const tunes = await getTunesForUser(db, userId);

// ✅ No mapping, no translation
await createPlaylist(db, {
  user_ref: userId, // Direct assignment
  instrument: "fiddle",
});
```

## Performance Considerations

### UUID vs Integer Trade-offs

**Storage:**

- Integer: 4 bytes
- UUID (text): 36 bytes (can be optimized to 16 bytes as binary)
- Impact: Minimal for user tables (thousands of rows)

**Indexing:**

- UUIDs: Slightly slower joins (string comparison vs integer)
- Mitigation: PostgreSQL has native UUID type (16 bytes)
- SQLite: Use `TEXT` type with proper indexes

**Recommendation:** Use PostgreSQL `UUID` type in production, `TEXT` in SQLite WASM (limited type support).

## Status

- ✅ Schema updated (all 8 tables)
- ✅ TypeScript types updated (3 interfaces)
- ✅ Query functions updated (getTunesForUser)
- ✅ TuneList component updated (user filtering)
- ✅ 0 TypeScript errors
- 🔄 Migration script (pending - Task 6: Sync layer)
- 🔄 Legacy data migration (pending - when ready to import)

## Next Steps

1. **Phase 2, Task 3-5:** Continue building features with UUID schema
2. **Phase 2, Task 6:** Build sync layer (Supabase ↔ SQLite)
3. **Data Migration:** Create migration script when ready to import legacy data
4. **Supabase Schema:** Deploy PostgreSQL schema with UUID columns
5. **Seed Data:** Create test users with real Supabase Auth UUIDs

---

**Decision Owner:** @sboagy  
**Implemented By:** GitHub Copilot  
**Review Status:** Pending user confirmation
