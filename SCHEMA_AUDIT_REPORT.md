# Schema Consistency Audit Report

**Date:** October 8, 2025  
**PostgreSQL (Supabase) vs SQLite (WASM)**

## Summary

| Metric                           | PostgreSQL | SQLite | Status      |
| -------------------------------- | ---------- | ------ | ----------- |
| **Total Tables**                 | 19         | 20     | ⚠️ Mismatch |
| **Tables Missing in SQLite**     | 0          | -      | ✅          |
| **Tables Missing in PostgreSQL** | -          | 1      | ⚠️          |
| **Column Mismatches**            | -          | 2      | ⚠️          |

## Findings

### 1. ⚠️ Extra Table in SQLite: `sync_queue`

**Location:** `drizzle/schema-sqlite.ts` (lines 203-213)

**Purpose:** Local-only sync queue for offline-first operations

**Columns:**

- `id` - INTEGER PRIMARY KEY
- `tableName` - TEXT (NOT NULL)
- `recordId` - TEXT (NOT NULL)
- `operation` - TEXT (NOT NULL)
- `data` - TEXT
- `status` - TEXT (default: "pending")
- `createdAt` - TEXT (NOT NULL)
- `syncedAt` - TEXT
- `attempts` - INTEGER (default: 0)
- `lastError` - TEXT

**Status:** ✅ **EXPECTED DIFFERENCE**  
This is a local-only table for managing sync operations. It should NOT exist in PostgreSQL/Supabase.

---

### 2. ⚠️ Extra Columns in SQLite `playlist` Table

**Columns in SQLite but NOT in PostgreSQL:**

#### a) `name` (TEXT)

- **Location:** `drizzle/schema-sqlite.ts` line 93
- **Status:** ❌ **INCONSISTENCY**
- **Recommendation:** Either:
  - Add `name` column to PostgreSQL schema, OR
  - Remove from SQLite schema

#### b) `genreDefault` (TEXT, FK to genre.id)

- **Location:** `drizzle/schema-sqlite.ts` line 95
- **Status:** ❌ **INCONSISTENCY**
- **Recommendation:** Either:
  - Add `genre_default` column to PostgreSQL schema, OR
  - Remove from SQLite schema

---

## PostgreSQL `playlist` Schema (Current)

```typescript
export const playlist = pgTable("playlist", {
  playlistId: serial("playlist_id").primaryKey().notNull(),
  userRef: integer("user_ref").notNull(),
  instrumentRef: integer("instrument_ref"),
  srAlgType: text("sr_alg_type"),
  deleted: boolean().default(false).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: timestamp("last_modified_at").defaultNow().notNull(),
  deviceId: text("device_id"),
});
// 8 columns total
```

## SQLite `playlist` Schema (Current)

```typescript
export const playlist = sqliteTable("playlist", {
  playlistId: integer("playlist_id")
    .primaryKey({ autoIncrement: true })
    .notNull(),
  userRef: integer("user_ref")
    .notNull()
    .references(() => userProfile.id),
  name: text(), // ⚠️ EXTRA
  instrumentRef: integer("instrument_ref"),
  genreDefault: text("genre_default").references(() => genre.id), // ⚠️ EXTRA
  srAlgType: text("sr_alg_type"),
  deleted: integer().default(0).notNull(),
  syncVersion: integer("sync_version").default(1).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  deviceId: text("device_id"),
});
// 10 columns total
```

---

## Analysis: Are These Columns Used?

✅ **YES!** Both columns are actively used in the codebase:

### `name` Column Usage

- ✅ Used in PlaylistEditor component (line 50)
- ✅ Used in PlaylistSelector display (line 201)
- ✅ Used in playlist creation (routes/playlists/new.tsx)
- ✅ Used in playlist editing (routes/playlists/[id]/edit.tsx)
- ✅ Required field with validation

### `genreDefault` Column Usage

- ✅ Used in PlaylistEditor component (line 51)
- ✅ Used in PlaylistSelector display (line 206-208)
- ✅ Used in PlaylistList table (line 166)
- ✅ Used in database views (init-views.ts line 38)
- ✅ Foreign key to genre.id table

**Conclusion:** These columns MUST be added to PostgreSQL/Supabase!

---

## Recommendations

### ⚠️ REQUIRED: Add Missing Columns to PostgreSQL

**Migration Script Created:** `scripts/add-playlist-columns-to-supabase.sql`

1. **Run the SQL migration in Supabase SQL Editor:**

   ```sql
   ALTER TABLE playlist ADD COLUMN IF NOT EXISTS name TEXT;
   ALTER TABLE playlist ADD COLUMN IF NOT EXISTS genre_default TEXT REFERENCES genre(id);
   ```

2. **Then sync the schemas:**

   ```bash
   # Pull updated PostgreSQL schema
   npx drizzle-kit pull --config=drizzle.config.ts

   # Regenerate SQLite schema from local database
   npx drizzle-kit introspect --config=drizzle.config.sqlite.ts
   cp drizzle/migrations/sqlite/schema.ts drizzle/schema-sqlite.ts

   # Re-run audit
   npx tsx /tmp/audit-schemas.ts
   ```

---

## Action Items

- [ ] **CRITICAL:** Run migration script in Supabase to add `name` and `genre_default` columns
  - Script: `scripts/add-playlist-columns-to-supabase.sql`
  - Location: Supabase SQL Editor
- [x] **VERIFIED:** `sync_queue` table is local-only (expected difference)
  - ✅ Confirmed: This is intentionally only in SQLite for offline sync
- [ ] **Re-pull** PostgreSQL schema after migration
  - `npx drizzle-kit pull --config=drizzle.config.ts`
- [ ] **Re-generate** SQLite schema
  - `npx drizzle-kit introspect --config=drizzle.config.sqlite.ts`
  - `cp drizzle/migrations/sqlite/schema.ts drizzle/schema-sqlite.ts`
- [ ] **Re-audit** to confirm consistency
  - `npx tsx /tmp/audit-schemas.ts`

---

## Type Mapping Differences (Expected)

These are normal differences between PostgreSQL and SQLite:

| PostgreSQL Type | SQLite Type                                     | Example            |
| --------------- | ----------------------------------------------- | ------------------ |
| `serial()`      | `integer().primaryKey({ autoIncrement: true })` | Primary keys       |
| `boolean()`     | `integer()` (0/1)                               | `deleted` column   |
| `timestamp()`   | `text()`                                        | `lastModifiedAt`   |
| `.defaultNow()` | No default                                      | Timestamp defaults |

These differences are expected and handled by the application layer.

---

**Audit Tool:** `scripts/audit-schemas.ts`  
**Generated:** October 8, 2025
