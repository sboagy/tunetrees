# Seed Data Schema Fixes

**Date:** October 5, 2025  
**Issue:** "no such table: user" error during database seeding

## Problem

The seed data was using old table/column names that don't match the current migration schema:

### Schema Mismatches Found

1. **user table → user_profile table**

   - Old: `INSERT INTO user (id, email, name)`
   - New: `INSERT INTO user_profile (supabase_user_id, email, name, ...)`
   - user_profile has auto-increment `id` and separate `supabase_user_id` field

2. **playlist.user_ref type changed**

   - Old: TEXT (UUID)
   - New: INTEGER (references user_profile.id)

3. **playlist columns changed**

   - Old: `instrument` TEXT, `genre` TEXT
   - New: `instrument_ref` INTEGER (nullable), no genre column

4. **tune table changes**

   - Old: `genre_ref` INTEGER
   - New: `genre` TEXT
   - Added: `last_modified_at` TEXT NOT NULL

5. **Missing required fields**
   - All tables now require `last_modified_at` field
   - `sync_version` defaults to 1 instead of 0

## Solution

Updated `seed-data.ts` to match the current schema:

### 1. Create user_profile Entry

```typescript
const now = new Date().toISOString();

db.run(
  `
  INSERT OR IGNORE INTO user_profile (
    supabase_user_id, 
    email, 
    name, 
    sync_version, 
    last_modified_at
  ) 
  VALUES (?, 'test@example.com', 'Test User', 1, ?)
`,
  [userId, now]
);

// Get the auto-generated ID
const userProfileResult = db.exec(
  `SELECT id FROM user_profile WHERE supabase_user_id = ?`,
  [userId]
);
const userProfileId = userProfileResult[0].values[0][0] as number;
```

### 2. Create Playlist with Correct Schema

```typescript
db.run(
  `
  INSERT OR IGNORE INTO playlist (
    playlist_id, 
    user_ref,          -- INTEGER, not UUID
    instrument_ref,    -- INTEGER, nullable
    sync_version, 
    last_modified_at
  ) 
  VALUES (1, ?, NULL, 1, ?)
`,
  [userProfileId, now]
); // Use user_profile.id, not UUID
```

### 3. Create Tunes with Updated Schema

```typescript
db.run(
  `
  INSERT OR IGNORE INTO tune (
    id, 
    title, 
    type, 
    mode, 
    structure, 
    incipit, 
    genre,              -- TEXT, not genre_ref INTEGER
    deleted, 
    sync_version,
    last_modified_at    -- Required NOT NULL
  ) 
  VALUES (?, ?, ?, ?, ?, ?, 'Irish Traditional', 0, 1, ?)
`,
  [tune.id, tune.title, tune.type, tune.mode, tune.structure, tune.incipit, now]
);
```

### 4. Create Playlist-Tune Relationships

```typescript
db.run(
  `
  INSERT OR IGNORE INTO playlist_tune (
    playlist_ref, 
    tune_ref, 
    deleted, 
    sync_version,
    last_modified_at    -- Required NOT NULL
  ) 
  VALUES (1, ?, 0, 1, ?)
`,
  [tune.id, now]
);
```

## Key Changes Summary

| What Changed         | Old                 | New                                                 |
| -------------------- | ------------------- | --------------------------------------------------- |
| User table           | `user`              | `user_profile`                                      |
| User ID field        | `id` (UUID)         | `supabase_user_id` (TEXT) + auto-inc `id` (INTEGER) |
| Playlist user_ref    | TEXT (UUID)         | INTEGER (user_profile.id)                           |
| Playlist instrument  | TEXT                | INTEGER (instrument_ref, nullable)                  |
| Tune genre           | INTEGER (genre_ref) | TEXT (genre)                                        |
| Timestamps           | Optional            | Required `last_modified_at` NOT NULL                |
| sync_version default | 0                   | 1                                                   |

## Testing

After this fix, seeding should succeed:

```
🌱 Seeding database with test data...
✅ Seeded 5 tunes
💾 Database persisted to IndexedDB
```

## Files Modified

- ✅ `src/lib/db/seed-data.ts` - Updated to match current schema

---

**Status:** ✅ FIXED - Ready to reload app
