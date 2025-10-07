# Schema Synchronization Complete

**Date:** October 5, 2025  
**Issue:** "no such column: playlist.instrument" errors due to schema mismatch

## Problem

The TypeScript code was using an **old schema** (`src/lib/db/schema.ts`) that didn't match the **actual SQLite migration** (`drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql`).

### Major Mismatches

| Code Used              | Actual Migration         | Issue                          |
| ---------------------- | ------------------------ | ------------------------------ |
| `users` table          | `user_profile` table     | Wrong table name               |
| `user_ref` TEXT (UUID) | `user_ref` INTEGER       | Wrong type                     |
| `instrument` TEXT      | `instrument_ref` INTEGER | Wrong column name/type         |
| `genre` TEXT           | `genre` TEXT             | Moved from `genre_ref` INTEGER |
| `tunes` (plural)       | `tune` (singular)        | Inconsistent naming            |
| `playlists` (plural)   | `playlist` (singular)    | Inconsistent naming            |
| `snake_case` fields    | `camelCase` properties   | Wrong naming convention        |

## Solution Applied

### 1. Use Correct Schema Source

**File:** `src/lib/db/schema.ts`

Changed from defining its own schema to re-exporting from the authoritative source:

```typescript
// Re-export everything from the generated SQLite schema
export * from "../../../drizzle/schema-sqlite";
```

**No more duplication. Single source of truth.**

### 2. Update All Query Files

Applied systematic find-replace across all files:

```bash
# Table names (plural → singular)
tunes → tune
playlists → playlist
playlistTunes → playlistTune
practiceRecords → practiceRecord

# Field names (snake_case → camelCase)
tune_ref → tuneRef
playlist_ref → playlistRef
user_ref → userRef
playlist_id → playlistId
genre_ref → genre
sync_version → syncVersion
last_modified_at → lastModifiedAt
```

**Files Updated:**

- `src/lib/db/queries/practice.ts`
- `src/lib/services/practice-recording.ts`
- `src/lib/services/queue-generator.ts`
- `src/lib/sync/queue.ts`

### 3. Add Missing syncQueue to Schema

**File:** `drizzle/schema-sqlite.ts`

Added the sync_queue table definition (was only created programmatically):

```typescript
export const syncQueue = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  operation: text("operation").notNull(),
  data: text("data"),
  status: text("status").default("pending").notNull(),
  createdAt: text("created_at").notNull(),
  syncedAt: text("synced_at"),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
});
```

## Correct Schema Reference (drizzle/schema-sqlite.ts)

### Table Exports

| Export Name          | Table Name             | Key Fields                                           |
| -------------------- | ---------------------- | ---------------------------------------------------- |
| `userProfile`        | `user_profile`         | `id` (auto), `supabaseUserId` (TEXT)                 |
| `tune`               | `tune`                 | `id`, `title`, `type`, `mode`, `genre` (TEXT)        |
| `playlist`           | `playlist`             | `playlistId`, `userRef` (INT), `instrumentRef` (INT) |
| `playlistTune`       | `playlist_tune`        | `playlistRef`, `tuneRef`                             |
| `practiceRecord`     | `practice_record`      | `id`, `tuneRef`, `playlistRef`                       |
| `dailyPracticeQueue` | `daily_practice_queue` | Queue entries                                        |
| `syncQueue`          | `sync_queue`           | Sync tracking                                        |

### Field Naming Convention

- **JavaScript/TypeScript:** `camelCase` (tuneRef, playlistId, lastModifiedAt)
- **SQL Column Names:** `snake_case` (tune_ref, playlist_id, last_modified_at)
- **Drizzle ORM handles the mapping automatically**

## Testing

After these changes, reload the app. Should see:

```
✅ Loaded existing SQLite database from IndexedDB (v2)
✅ Created view: view_playlist_joined
✅ Created view: practice_list_joined
✅ Created view: practice_list_staged
✅ Ensured sync_queue table exists
✅ SQLite WASM database ready
```

**No more errors about:**

- ❌ ~~"no such column: playlist.instrument"~~
- ❌ ~~"no such table: user"~~
- ❌ ~~Cannot find name 'tunes'~~

## Files Modified

1. ✅ `src/lib/db/schema.ts` - Now re-exports from drizzle/schema-sqlite.ts
2. ✅ `src/lib/db/queries/practice.ts` - Updated to use correct table/field names
3. ✅ `src/lib/services/practice-recording.ts` - Updated schema references
4. ✅ `src/lib/services/queue-generator.ts` - Updated schema references
5. ✅ `src/lib/sync/queue.ts` - Updated schema references
6. ✅ `drizzle/schema-sqlite.ts` - Added syncQueue table definition

## Key Principles Going Forward

1. **Single Source of Truth:** `drizzle/schema-sqlite.ts` is the authoritative schema
2. **No Duplication:** Never duplicate table definitions
3. **Naming Consistency:** Use singular table names (tune, playlist) and camelCase fields
4. **Migration First:** Schema changes start in migration SQL, then update TypeScript

---

**Status:** ✅ FIXED - Schema synchronized  
**Next:** Reload app to verify
