# UUID Migration Plan: Integer IDs → UUIDs for Offline-First PWA

**Status:** DRAFT - Awaiting Review  
**Created:** October 31, 2025  
**Branch:** feat/pwa1

---

## Executive Summary

**Problem:** Current integer auto-increment IDs are incompatible with offline-first PWA architecture. When users create records offline, local SQLite generates IDs that conflict with Supabase IDs when syncing online.

**Solution:** Migrate all tables to use UUIDs as primary keys. This is the **standard pattern** for offline-first PWAs (Supabase, PouchDB, PowerSync all use UUIDs).

**Scope:**

- ✅ All tables with auto-increment INTEGER id → TEXT uuid
- ✅ Eliminate redundant user_profile.id, use supabase_user_id as PK
- ✅ Update all foreign key references (\_ref columns)
- ✅ Update migration scripts, seed data, tests
- ✅ Implement one-time migration flag for existing users

---

## Why UUIDs?

### Standard PWA Pattern

```typescript
// ❌ BROKEN: Integer IDs
// OFFLINE: SQLite generates id=999
// ONLINE:  Supabase generates id=1234
// Result:  ID mismatch, broken references

// ✅ CORRECT: UUIDs
// OFFLINE: Generate uuid="550e8400-e29b-41d4-a716-446655440000"
// ONLINE:  Use SAME uuid
// Result:  Perfect sync, no conflicts
```

### Benefits

- ✅ **Offline-safe:** No ID collisions between devices
- ✅ **Standard:** Used by Supabase, PouchDB, CouchDB, PowerSync
- ✅ **Simple sync:** No ID mapping/remapping needed
- ✅ **Distributed:** Multiple clients can create records simultaneously

### Tradeoffs

- ⚠️ **Storage:** UUIDs are 36 bytes vs 4 bytes for integers
- ⚠️ **Migration:** One-time cost to convert existing data
- ⚠️ **Readability:** Less human-friendly than sequential integers

**Verdict:** Standard tradeoff for offline-first apps. Worth it for architectural soundness.

---

## Tables Affected

### Core User Tables

- [x] `user_profile` - **SPECIAL:** Remove `id`, use `supabase_user_id` as PK (UUIDv7)
- [x] `playlist` - id INTEGER → id TEXT (UUIDv7)
- [x] `tune` - id INTEGER → id TEXT (UUIDv7)
- [x] `playlist_tune` - FK refs: playlist_ref, tune_ref (UUIDv7)
- [x] `practice_record` - id INTEGER → id TEXT (UUIDv7), FK refs: tune_ref, playlist_ref
- [x] `daily_practice_queue` - id INTEGER → id TEXT (UUIDv7), FK refs: user_ref, playlist_ref, tune_ref
- [x] `note` - id INTEGER → id TEXT (UUIDv7), FK refs: tune_ref, user_ref - **⚠️ ORDERS BY id DESC**
- [x] `reference` - id INTEGER → id TEXT (UUIDv7), FK refs: tune_ref - **⚠️ ORDERS BY id DESC**
- [x] `tag` - id INTEGER → id TEXT (UUIDv7)
- [x] `tune_override` - id INTEGER → id TEXT (UUIDv7), FK refs: tune_ref, user_ref

### User Preferences

- [x] `prefs_scheduling_options` - **NO CHANGE** (user_id is already PK)
- [x] `prefs_spaced_repetition` - **NO CHANGE** (composite PK: user_id + alg_type)
- [x] `table_state` - **NO CHANGE** (composite PK)
- [x] `tab_group_main_state` - id INTEGER → id TEXT (UUIDv7)
- [x] `table_transient_data` - **NO CHANGE** (composite PK: user_id + tune_id + playlist_id)

### Reference Data (User-creatable offline)

- [x] `genre` - id TEXT → id TEXT (UUIDv7) - **⚠️ BREAKING:** Change from semantic IDs to UUIDs
- [x] `tune_type` - id TEXT → id TEXT (UUIDv7) - **⚠️ BREAKING:** Change from semantic IDs to UUIDs
- [x] `genre_tune_type` - FK refs: genre_id, tune_type_id (UUIDv7)
- [x] `instrument` - id INTEGER → id TEXT (UUIDv7)

**⚠️ SPECIAL: Genre/Tune Type Migration**

Currently `genre` and `tune_type` use **semantic text IDs**:

- `genre.id = "irish"`, `"bluegrass"`, `"klezmer"`, etc.
- `tune_type.id = "reel"`, `"jig"`, `"slip jig"`, etc.

These are referenced throughout the database and in application code.

**Migration Strategy:**

1. Add `id_uuid` column (UUIDv7) to genre/tune_type
2. Generate stable UUIDs for existing reference data (deterministic from text ID)
3. Add `genre_id_uuid` and `tune_type_id_uuid` to all referencing tables
4. Populate UUID FK columns
5. Add `legacy_id` column to preserve semantic IDs ("reel", "irish", etc.)
6. Switch to UUID PKs
7. Update code to use UUIDs internally, display legacy_id to users

**Alternative:** Keep genre/tune_type as TEXT ids, only migrate user-creatable ones?

- **Decision:** NO - need consistency. All tables must support offline creation.
- User can create custom genre "Scottish" or tune type "Strathspey" offline
- Therefore must use UUIDs for conflict-free sync

**Total:** 14 tables need migration (including reference data)

**⚠️ CRITICAL: ID Ordering Dependencies**

These queries rely on chronological ID ordering (UUIDv7 maintains this):

- `references.ts:103` - `ORDER BY DESC(reference.id)` - "Newest first"
- `notes.ts:44,61` - `ORDER BY DESC(note.createdDate)` - Sorted by timestamp, not ID (OK)
- `practice.ts:228` - `MAX(window_start_utc)` - Uses timestamp, not ID (OK)
- `practice.ts:531,657,908` - `ORDER BY DESC(practiced)` - Uses timestamp, not ID (OK)

**Verdict:** Only `reference` table orders by ID directly. UUIDv7 preserves chronological ordering, so this works correctly.

---

## Migration Strategy

### Phase 1: Supabase Schema Migration

**Goal:** Add UUID columns alongside existing integer IDs, populate them, then switch PKs.

#### Step 1.1: Add UUID columns (NON-BREAKING - TEMPORARY)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_uuid_columns.sql
-- NOTE: _uuid suffix is TEMPORARY to avoid conflicts during migration
-- These will be renamed to just "id" in Step 1.3

-- Core tables: Add temporary id_uuid columns
ALTER TABLE user_profile ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE playlist ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE tune ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE practice_record ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE daily_practice_queue ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE note ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE reference ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE tag ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE tune_override ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE instrument ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
ALTER TABLE tab_group_main_state ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();

-- Populate UUIDs for existing rows
UPDATE user_profile SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE playlist SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE tune SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE practice_record SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE daily_practice_queue SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE note SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE reference SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE tag SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE tune_override SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE instrument SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;
UPDATE tab_group_main_state SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;

-- Make UUID columns NOT NULL
ALTER TABLE user_profile ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE playlist ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE tune ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE practice_record ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE daily_practice_queue ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE note ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE reference ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE tag ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE tune_override ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE instrument ALTER COLUMN id_uuid SET NOT NULL;
ALTER TABLE tab_group_main_state ALTER COLUMN id_uuid SET NOT NULL;
```

#### Step 1.2: Add UUID FK columns (NON-BREAKING - TEMPORARY)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_uuid_fk_columns.sql
-- NOTE: _uuid suffix is TEMPORARY to avoid conflicts during migration
-- These will be renamed to replace integer FK columns in Step 1.3

-- Add temporary UUID FK columns
ALTER TABLE playlist ADD COLUMN user_ref_uuid UUID;
ALTER TABLE playlist_tune ADD COLUMN playlist_ref_uuid UUID;
ALTER TABLE playlist_tune ADD COLUMN tune_ref_uuid UUID;
ALTER TABLE practice_record ADD COLUMN tune_ref_uuid UUID;
ALTER TABLE practice_record ADD COLUMN playlist_ref_uuid UUID;
ALTER TABLE daily_practice_queue ADD COLUMN user_ref_uuid UUID;
ALTER TABLE daily_practice_queue ADD COLUMN playlist_ref_uuid UUID;
ALTER TABLE daily_practice_queue ADD COLUMN tune_ref_uuid UUID;
ALTER TABLE note ADD COLUMN tune_ref_uuid UUID;
ALTER TABLE note ADD COLUMN user_ref_uuid UUID;
ALTER TABLE tune_override ADD COLUMN tune_ref_uuid UUID;
ALTER TABLE tune_override ADD COLUMN user_ref_uuid UUID;

-- Populate UUID FK columns by looking up UUIDs from integer FKs
UPDATE playlist p
SET user_ref_uuid = (SELECT id_uuid FROM user_profile WHERE id = p.user_ref);

UPDATE playlist_tune pt
SET playlist_ref_uuid = (SELECT id_uuid FROM playlist WHERE playlist_id = pt.playlist_ref),
    tune_ref_uuid = (SELECT id_uuid FROM tune WHERE id = pt.tune_ref);

UPDATE practice_record pr
SET tune_ref_uuid = (SELECT id_uuid FROM tune WHERE id = pr.tune_ref),
    playlist_ref_uuid = (SELECT id_uuid FROM playlist WHERE playlist_id = pr.playlist_ref);

UPDATE daily_practice_queue dpq
SET user_ref_uuid = (SELECT id_uuid FROM user_profile WHERE id = dpq.user_ref),
    playlist_ref_uuid = (SELECT id_uuid FROM playlist WHERE playlist_id = dpq.playlist_ref),
    tune_ref_uuid = (SELECT id_uuid FROM tune WHERE id = dpq.tune_ref);

UPDATE note n
SET tune_ref_uuid = (SELECT id_uuid FROM tune WHERE id = n.tune_ref),
    user_ref_uuid = (SELECT id_uuid FROM user_profile WHERE id = n.user_ref);

UPDATE tune_override t_o
SET tune_ref_uuid = (SELECT id_uuid FROM tune WHERE id = t_o.tune_ref),
    user_ref_uuid = (SELECT id_uuid FROM user_profile WHERE id = t_o.user_ref);

-- Make UUID FK columns NOT NULL
ALTER TABLE playlist ALTER COLUMN user_ref_uuid SET NOT NULL;
ALTER TABLE playlist_tune ALTER COLUMN playlist_ref_uuid SET NOT NULL;
ALTER TABLE playlist_tune ALTER COLUMN tune_ref_uuid SET NOT NULL;
ALTER TABLE practice_record ALTER COLUMN tune_ref_uuid SET NOT NULL;
ALTER TABLE practice_record ALTER COLUMN playlist_ref_uuid SET NOT NULL;
ALTER TABLE daily_practice_queue ALTER COLUMN user_ref_uuid SET NOT NULL;
ALTER TABLE daily_practice_queue ALTER COLUMN playlist_ref_uuid SET NOT NULL;
ALTER TABLE daily_practice_queue ALTER COLUMN tune_ref_uuid SET NOT NULL;
ALTER TABLE note ALTER COLUMN tune_ref_uuid SET NOT NULL;
ALTER TABLE note ALTER COLUMN user_ref_uuid SET NOT NULL;
ALTER TABLE tune_override ALTER COLUMN tune_ref_uuid SET NOT NULL;
ALTER TABLE tune_override ALTER COLUMN user_ref_uuid SET NOT NULL;
```

#### Step 1.3: Switch to UUIDs (BREAKING - requires app update)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_switch_to_uuid_pks.sql
-- ⚠️ BREAKING CHANGE: This migration drops integer columns and renames UUID columns
-- The final schema will have clean column names (id, user_ref, etc.) without _uuid suffix

-- Step 1: Drop old integer FK constraints
ALTER TABLE playlist DROP CONSTRAINT IF EXISTS playlist_user_ref_fkey;
ALTER TABLE playlist_tune DROP CONSTRAINT IF EXISTS playlist_tune_playlist_ref_fkey;
ALTER TABLE playlist_tune DROP CONSTRAINT IF EXISTS playlist_tune_tune_ref_fkey;
ALTER TABLE practice_record DROP CONSTRAINT IF EXISTS practice_record_tune_ref_fkey;
ALTER TABLE practice_record DROP CONSTRAINT IF EXISTS practice_record_playlist_ref_fkey;
ALTER TABLE daily_practice_queue DROP CONSTRAINT IF EXISTS daily_practice_queue_user_ref_fkey;
ALTER TABLE daily_practice_queue DROP CONSTRAINT IF EXISTS daily_practice_queue_playlist_ref_fkey;
ALTER TABLE daily_practice_queue DROP CONSTRAINT IF EXISTS daily_practice_queue_tune_ref_fkey;
ALTER TABLE note DROP CONSTRAINT IF EXISTS note_tune_ref_fkey;
ALTER TABLE note DROP CONSTRAINT IF EXISTS note_user_ref_fkey;
ALTER TABLE tune_override DROP CONSTRAINT IF EXISTS tune_override_tune_ref_fkey;
ALTER TABLE tune_override DROP CONSTRAINT IF EXISTS tune_override_user_ref_fkey;

-- Step 2: Drop old integer PK constraints
ALTER TABLE user_profile DROP CONSTRAINT IF EXISTS user_profile_pkey;
ALTER TABLE playlist DROP CONSTRAINT IF EXISTS playlist_pkey;
ALTER TABLE tune DROP CONSTRAINT IF EXISTS tune_pkey;
ALTER TABLE practice_record DROP CONSTRAINT IF EXISTS practice_record_pkey;
ALTER TABLE daily_practice_queue DROP CONSTRAINT IF EXISTS daily_practice_queue_pkey;
ALTER TABLE note DROP CONSTRAINT IF EXISTS note_pkey;
ALTER TABLE reference DROP CONSTRAINT IF EXISTS reference_pkey;
ALTER TABLE tag DROP CONSTRAINT IF EXISTS tag_pkey;
ALTER TABLE tune_override DROP CONSTRAINT IF EXISTS tune_override_pkey;
ALTER TABLE instrument DROP CONSTRAINT IF EXISTS instrument_pkey;
ALTER TABLE tab_group_main_state DROP CONSTRAINT IF EXISTS tab_group_main_state_pkey;

-- Step 3: Drop old integer ID columns
ALTER TABLE user_profile DROP COLUMN id; -- Will use supabase_user_id as PK
ALTER TABLE playlist DROP COLUMN playlist_id;
ALTER TABLE playlist DROP COLUMN user_ref; -- Replaced by user_ref_uuid
ALTER TABLE tune DROP COLUMN id;
ALTER TABLE playlist_tune DROP COLUMN playlist_ref;
ALTER TABLE playlist_tune DROP COLUMN tune_ref;
ALTER TABLE practice_record DROP COLUMN id;
ALTER TABLE practice_record DROP COLUMN tune_ref;
ALTER TABLE practice_record DROP COLUMN playlist_ref;
ALTER TABLE daily_practice_queue DROP COLUMN id;
ALTER TABLE daily_practice_queue DROP COLUMN user_ref;
ALTER TABLE daily_practice_queue DROP COLUMN playlist_ref;
ALTER TABLE daily_practice_queue DROP COLUMN tune_ref;
ALTER TABLE note DROP COLUMN id;
ALTER TABLE note DROP COLUMN tune_ref;
ALTER TABLE note DROP COLUMN user_ref;
ALTER TABLE reference DROP COLUMN id;
ALTER TABLE tag DROP COLUMN id;
ALTER TABLE tune_override DROP COLUMN id;
ALTER TABLE tune_override DROP COLUMN tune_ref;
ALTER TABLE tune_override DROP COLUMN user_ref;
ALTER TABLE instrument DROP COLUMN id;
ALTER TABLE tab_group_main_state DROP COLUMN id;

-- Step 4: Rename UUID columns to remove _uuid suffix
-- FINAL RESULT: Clean column names (id, user_ref, playlist_ref, etc.)
ALTER TABLE playlist RENAME COLUMN id_uuid TO id;
ALTER TABLE playlist RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE tune RENAME COLUMN id_uuid TO id;

ALTER TABLE playlist_tune RENAME COLUMN playlist_ref_uuid TO playlist_ref;
ALTER TABLE playlist_tune RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE practice_record RENAME COLUMN id_uuid TO id;
ALTER TABLE practice_record RENAME COLUMN tune_ref_uuid TO tune_ref;
ALTER TABLE practice_record RENAME COLUMN playlist_ref_uuid TO playlist_ref;

ALTER TABLE daily_practice_queue RENAME COLUMN id_uuid TO id;
ALTER TABLE daily_practice_queue RENAME COLUMN user_ref_uuid TO user_ref;
ALTER TABLE daily_practice_queue RENAME COLUMN playlist_ref_uuid TO playlist_ref;
ALTER TABLE daily_practice_queue RENAME COLUMN tune_ref_uuid TO tune_ref;

ALTER TABLE note RENAME COLUMN id_uuid TO id;
ALTER TABLE note RENAME COLUMN tune_ref_uuid TO tune_ref;
ALTER TABLE note RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE reference RENAME COLUMN id_uuid TO id;

ALTER TABLE tag RENAME COLUMN id_uuid TO id;

ALTER TABLE tune_override RENAME COLUMN id_uuid TO id;
ALTER TABLE tune_override RENAME COLUMN tune_ref_uuid TO tune_ref;
ALTER TABLE tune_override RENAME COLUMN user_ref_uuid TO user_ref;

ALTER TABLE instrument RENAME COLUMN id_uuid TO id;

ALTER TABLE tab_group_main_state RENAME COLUMN id_uuid TO id;

-- Step 5: Add UUID PKs (now with clean column names)
ALTER TABLE user_profile ADD PRIMARY KEY (supabase_user_id);
ALTER TABLE playlist ADD PRIMARY KEY (id);
ALTER TABLE tune ADD PRIMARY KEY (id);
ALTER TABLE practice_record ADD PRIMARY KEY (id);
ALTER TABLE daily_practice_queue ADD PRIMARY KEY (id);
ALTER TABLE note ADD PRIMARY KEY (id);
ALTER TABLE reference ADD PRIMARY KEY (id);
ALTER TABLE tag ADD PRIMARY KEY (id);
ALTER TABLE tune_override ADD PRIMARY KEY (id);
ALTER TABLE instrument ADD PRIMARY KEY (id);
ALTER TABLE tab_group_main_state ADD PRIMARY KEY (id);

-- Step 6: Add UUID FK constraints (with clean column names)
ALTER TABLE playlist
  ADD CONSTRAINT playlist_user_ref_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE playlist_tune
  ADD CONSTRAINT playlist_tune_playlist_ref_fkey
  FOREIGN KEY (playlist_ref) REFERENCES playlist(id);

ALTER TABLE playlist_tune
  ADD CONSTRAINT playlist_tune_tune_ref_fkey
  FOREIGN KEY (tune_ref) REFERENCES tune(id);

ALTER TABLE practice_record
  ADD CONSTRAINT practice_record_tune_ref_fkey
  FOREIGN KEY (tune_ref) REFERENCES tune(id);

ALTER TABLE practice_record
  ADD CONSTRAINT practice_record_playlist_ref_fkey
  FOREIGN KEY (playlist_ref) REFERENCES playlist(id);

ALTER TABLE daily_practice_queue
  ADD CONSTRAINT daily_practice_queue_user_ref_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE daily_practice_queue
  ADD CONSTRAINT daily_practice_queue_playlist_ref_fkey
  FOREIGN KEY (playlist_ref) REFERENCES playlist(id);

ALTER TABLE daily_practice_queue
  ADD CONSTRAINT daily_practice_queue_tune_ref_fkey
  FOREIGN KEY (tune_ref) REFERENCES tune(id);

ALTER TABLE note
  ADD CONSTRAINT note_tune_ref_fkey
  FOREIGN KEY (tune_ref) REFERENCES tune(id);

ALTER TABLE note
  ADD CONSTRAINT note_user_ref_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

ALTER TABLE tune_override
  ADD CONSTRAINT tune_override_tune_ref_fkey
  FOREIGN KEY (tune_ref) REFERENCES tune(id);

ALTER TABLE tune_override
  ADD CONSTRAINT tune_override_user_ref_fkey
  FOREIGN KEY (user_ref) REFERENCES user_profile(supabase_user_id);

-- Step 7: Recreate indexes with UUID columns
CREATE INDEX idx_playlist_user_ref ON playlist(user_ref);
CREATE INDEX idx_playlist_tune_playlist_ref ON playlist_tune(playlist_ref);
CREATE INDEX idx_playlist_tune_tune_ref ON playlist_tune(tune_ref);
CREATE INDEX idx_practice_record_tune_ref ON practice_record(tune_ref);
CREATE INDEX idx_practice_record_playlist_ref ON practice_record(playlist_ref);
CREATE INDEX idx_daily_practice_queue_user_ref ON daily_practice_queue(user_ref);
CREATE INDEX idx_daily_practice_queue_playlist_ref ON daily_practice_queue(playlist_ref);
CREATE INDEX idx_daily_practice_queue_tune_ref ON daily_practice_queue(tune_ref);
CREATE INDEX idx_note_tune_ref ON note(tune_ref);
CREATE INDEX idx_note_user_ref ON note(user_ref);

-- ✅ MIGRATION COMPLETE
-- Final schema has clean column names:
--   - id (UUID, not id_uuid)
--   - user_ref (UUID, not user_ref_uuid)
--   - playlist_ref (UUID, not playlist_ref_uuid)
--   - etc.
```

---

### Phase 2: Local SQLite Schema Migration

**Goal:** Update Drizzle schema to match new Supabase schema.

#### Step 2.1: Update `drizzle/schema-sqlite.ts`

```typescript
// BEFORE (Integer IDs)
export const userProfile = sqliteTable("user_profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supabaseUserId: text("supabase_user_id").notNull().unique(),
  // ...
});

export const playlist = sqliteTable("playlist", {
  playlistId: integer("playlist_id").primaryKey({ autoIncrement: true }),
  userRef: integer("user_ref").notNull(),
  // ...
});

// AFTER (UUIDs)
export const userProfile = sqliteTable("user_profile", {
  supabaseUserId: text("supabase_user_id").primaryKey(), // Now the PK!
  email: text("email").notNull(),
  name: text("name"),
  // ... (id column removed)
});

export const playlist = sqliteTable("playlist", {
  id: text("id").primaryKey(), // UUID
  userRef: text("user_ref").notNull(), // UUID FK
  instrument: text("instrument"),
  // ...
});

export const tune = sqliteTable("tune", {
  id: text("id").primaryKey(), // UUID
  title: text("title").notNull(),
  // ...
});

export const playlistTune = sqliteTable(
  "playlist_tune",
  {
    playlistRef: text("playlist_ref").notNull(), // UUID FK
    tuneRef: text("tune_ref").notNull(), // UUID FK
    // ...
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playlistRef, table.tuneRef] }),
  })
);

export const practiceRecord = sqliteTable("practice_record", {
  id: text("id").primaryKey(), // UUID
  tuneRef: text("tune_ref").notNull(), // UUID FK
  playlistRef: text("playlist_ref").notNull(), // UUID FK
  // ...
});

export const dailyPracticeQueue = sqliteTable("daily_practice_queue", {
  id: text("id").primaryKey(), // UUID
  userRef: text("user_ref").notNull(), // UUID FK
  playlistRef: text("playlist_ref").notNull(), // UUID FK
  tuneRef: text("tune_ref").notNull(), // UUID FK
  // ...
});

// ... repeat for all tables
```

#### Step 2.2: Update Drizzle PostgreSQL schema (`drizzle/schema.ts`)

Same changes as SQLite schema, ensure they match exactly.

#### Step 2.3: Generate migrations

```bash
# Generate migration for SQLite
npm run db:generate:sqlite

# Generate migration for Supabase (if using Drizzle migrations)
npm run db:generate:supabase
```

---

### Phase 3: Code Changes

#### Step 3.1: Update INSERT operations to generate UUIDs

```typescript
// src/lib/services/practice-recording.ts

// BEFORE
const insertResult = await db
  .insert(practiceRecord)
  .values(newRecord) // SQLite auto-generates id
  .returning();

// AFTER
import { randomUUID } from "crypto"; // Node.js
// Or in browser: crypto.randomUUID()

const newRecord = {
  id: randomUUID(), // "550e8400-e29b-41d4-a716-446655440000"
  tuneRef: input.tuneRef,
  playlistRef: input.playlistRef,
  practiced: new Date().toISOString(),
  // ...
};

const insertResult = await db
  .insert(practiceRecord)
  .values(newRecord)
  .returning();
```

#### Step 3.2: Create UUIDv7 helper utility

```typescript
// src/lib/utils/uuid.ts

/**
 * Generate a new UUIDv7 (time-ordered)
 *
 * UUIDv7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
 * - First 48 bits: Unix timestamp in milliseconds
 * - Next 12 bits: Random sub-millisecond precision
 * - Version: 7 (0111)
 * - Variant: 10 (RFC 4122)
 * - Remaining: Random bits
 *
 * Benefits:
 * - Time-ordered (maintains chronological sort order)
 * - Better B-tree index performance (sequential inserts)
 * - Compatible with standard UUID APIs
 * - Recommended by Supabase for new tables
 *
 * @see https://datatracker.ietf.org/doc/draft-ietf-uuidrev-rfc4122bis/
 * @see https://supabase.com/docs/guides/database/tables#uuid-primary-keys
 */
export function generateId(): string {
  // Get current timestamp in milliseconds
  const timestamp = BigInt(Date.now());

  // Generate random bytes for the rest
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  // Build UUIDv7:
  // - 48 bits: timestamp (milliseconds since epoch)
  // - 4 bits: version (0111 = 7)
  // - 12 bits: random
  // - 2 bits: variant (10)
  // - 62 bits: random

  const timestampHex = timestamp.toString(16).padStart(12, "0");

  // Time (48 bits) + version nibble (4 bits) + random (12 bits)
  const timeLow = timestampHex.slice(0, 8);
  const timeMid = timestampHex.slice(8, 12);
  const timeHiAndVersion =
    "7" + randomBytes[0].toString(16).padStart(3, "0").slice(0, 3);

  // Variant (2 bits = 10) + random (62 bits)
  const clockSeqAndReserved = (0x80 | (randomBytes[1] & 0x3f))
    .toString(16)
    .padStart(2, "0");
  const clockSeqLow = randomBytes[2].toString(16).padStart(2, "0");

  const node = Array.from(randomBytes.slice(3, 9))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeqAndReserved}${clockSeqLow}-${node}`;
}

/**
 * Validate UUIDv7 format
 * Accepts both UUIDv4 (for migration) and UUIDv7
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[47][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Check if UUID is version 7 (time-ordered)
 */
export function isUUIDv7(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid
  );
}

/**
 * Extract timestamp from UUIDv7
 */
export function getUUIDv7Timestamp(uuid: string): Date | null {
  if (!isUUIDv7(uuid)) return null;

  const hex = uuid.replace(/-/g, "");
  const timestampHex = hex.slice(0, 12);
  const timestamp = parseInt(timestampHex, 16);

  return new Date(timestamp);
}
```

#### Step 3.3: Update all INSERT operations

Files to update:

- `src/lib/services/practice-recording.ts` - practice_record inserts
- `src/lib/db/queries/practice.ts` - queue generation
- `src/lib/db/queries/playlist.ts` - playlist creation
- `src/lib/db/queries/tune.ts` - tune creation
- `src/lib/db/queries/notes.ts` - note creation
- All other INSERT operations

**Pattern:**

```typescript
import { generateId } from "@/lib/utils/uuid";

const newRecord = {
  id: generateId(), // Always generate UUID for new records
  // ... other fields
};
```

#### Step 3.4: Update TypeScript types

```typescript
// src/lib/db/types.ts

// BEFORE
export interface User {
  id: number;
  supabaseUserId: string;
  email: string;
  name: string | null;
}

export interface Playlist {
  playlistId: number;
  userRef: number;
  instrument: string | null;
  // ...
}

// AFTER
export interface User {
  supabaseUserId: string; // Now the PK (UUID)
  email: string;
  name: string | null;
}

export interface Playlist {
  id: string; // UUID
  userRef: string; // UUID FK
  instrument: string | null;
  // ...
}

export interface PracticeRecord {
  id: string; // UUID
  tuneRef: string; // UUID FK
  playlistRef: string; // UUID FK
  practiced: string;
  // ...
}

// Update all types to use string for IDs
```

---

### Phase 4: Migration Script Updates

#### Step 4.1: Update `scripts/migrate-production-to-supabase.ts`

**Current flow:**

```
Legacy SQLite (integer IDs) → Supabase (integer IDs)
```

**New flow:**

```
Legacy SQLite (integer IDs) → Generate UUIDs → Supabase (UUID IDs)
```

**Key changes:**

```typescript
// scripts/migrate-production-to-supabase.ts

import { generateId } from "../src/lib/utils/uuid";

// Create ID mapping tables (legacy int → new UUID)
const idMaps = {
  user: new Map<number, string>(),
  playlist: new Map<number, string>(),
  tune: new Map<number, string>(),
  // ... all tables
};

// Step 1: Migrate users first (needed for FK references)
const legacyUsers = await legacyDb.select().from(legacyUserProfile).all();

for (const legacyUser of legacyUsers) {
  const newId = generateId(); // Generate UUID
  idMaps.user.set(legacyUser.id, newId); // Map: old int → new UUID

  await supabase.from("user_profile").insert({
    supabase_user_id: newId, // Use as PK
    email: legacyUser.email,
    name: legacyUser.name,
    // ...
  });
}

// Step 2: Migrate playlists (use mapped user UUIDs)
const legacyPlaylists = await legacyDb.select().from(legacyPlaylist).all();

for (const legacyPlaylist of legacyPlaylists) {
  const newId = generateId();
  idMaps.playlist.set(legacyPlaylist.playlistId, newId);

  const userUuid = idMaps.user.get(legacyPlaylist.userRef); // Lookup FK
  if (!userUuid) throw new Error(`User ${legacyPlaylist.userRef} not found`);

  await supabase.from("playlist").insert({
    id: newId,
    user_ref: userUuid, // Use mapped UUID FK
    instrument: legacyPlaylist.instrument,
    // ...
  });
}

// Step 3: Migrate tunes
const legacyTunes = await legacyDb.select().from(legacyTune).all();

for (const legacyTune of legacyTunes) {
  const newId = generateId();
  idMaps.tune.set(legacyTune.id, newId);

  await supabase.from("tune").insert({
    id: newId,
    title: legacyTune.title,
    type: legacyTune.type,
    // ...
  });
}

// Step 4: Migrate playlist_tune (composite FK references)
const legacyPlaylistTunes = await legacyDb
  .select()
  .from(legacyPlaylistTune)
  .all();

for (const legacyPT of legacyPlaylistTunes) {
  const playlistUuid = idMaps.playlist.get(legacyPT.playlistRef);
  const tuneUuid = idMaps.tune.get(legacyPT.tuneRef);

  if (!playlistUuid || !tuneUuid) {
    throw new Error(
      `Missing FK mapping: playlist=${legacyPT.playlistRef}, tune=${legacyPT.tuneRef}`
    );
  }

  await supabase.from("playlist_tune").insert({
    playlist_ref: playlistUuid,
    tune_ref: tuneUuid,
    added: legacyPT.added,
    // ...
  });
}

// Step 5: Migrate practice_record (with mapped FKs)
const legacyRecords = await legacyDb.select().from(legacyPracticeRecord).all();

for (const legacyRecord of legacyRecords) {
  const newId = generateId();
  const tuneUuid = idMaps.tune.get(legacyRecord.tuneRef);
  const playlistUuid = idMaps.playlist.get(legacyRecord.playlistRef);

  if (!tuneUuid || !playlistUuid) {
    throw new Error(
      `Missing FK mapping for practice_record ${legacyRecord.id}`
    );
  }

  await supabase.from("practice_record").insert({
    id: newId,
    tune_ref: tuneUuid,
    playlist_ref: playlistUuid,
    practiced: legacyRecord.practiced,
    // ...
  });
}

// Repeat for all tables with FK relationships
```

**Key pattern:**

1. Generate new UUID for each legacy record
2. Store mapping: `legacyIntId → newUuid` in Map
3. When inserting child records, lookup parent UUIDs from map
4. Maintain referential integrity through mapping

---

### Phase 5: One-Time Migration Flag

**Goal:** Users on old system (pre-UUID) need full database reset on first login after UUID migration.

#### Step 5.1: Add migration version to localStorage + URL parameter

```typescript
// src/lib/db/migration-version.ts

const CURRENT_SCHEMA_VERSION = "2.0.0-uuid"; // Bump on schema changes

export function getLocalSchemaVersion(): string | null {
  return localStorage.getItem("schema_version");
}

export function setLocalSchemaVersion(version: string): void {
  localStorage.setItem("schema_version", version);
}

/**
 * Check if migration is needed based on:
 * 1. localStorage version mismatch
 * 2. URL parameter ?reset=true
 * 3. URL parameter ?migrate=uuid (explicit UUID migration)
 */
export function needsMigration(): boolean {
  // Check URL parameters first (allows manual reset)
  const urlParams = new URLSearchParams(window.location.search);
  const resetParam = urlParams.get("reset");
  const migrateParam = urlParams.get("migrate");

  // Force migration via URL parameter
  if (resetParam === "true" || migrateParam === "uuid") {
    console.warn("🔄 Migration forced via URL parameter");
    return true;
  }

  // Check localStorage version
  const localVersion = getLocalSchemaVersion();
  return localVersion !== CURRENT_SCHEMA_VERSION;
}

/**
 * Check if this is a forced reset (user initiated via URL)
 */
export function isForcedReset(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("reset") === "true";
}

export async function clearLocalDatabaseForMigration(
  db: SqliteDatabase
): Promise<void> {
  console.log("🔄 Schema migration detected - clearing local database...");

  // Clear all user data tables (preserve reference data)
  const tablesToClear = [
    "daily_practice_queue",
    "practice_record",
    "playlist_tune",
    "note",
    "reference",
    "tag",
    "tune_override",
    "playlist",
    "tune", // Clear private tunes, will re-sync public catalog
    "table_transient_data",
    "tab_group_main_state",
  ];

  for (const tableName of tablesToClear) {
    const table = getLocalTable(tableName);
    await db.delete(table).run();
  }

  console.log("✅ Local database cleared for schema migration");
}

/**
 * Clear URL migration parameters after migration completes
 */
export function clearMigrationParams(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("reset");
  url.searchParams.delete("migrate");

  // Replace URL without reload
  window.history.replaceState({}, "", url.toString());
}
```

#### Step 5.2: Check version on app initialization

```typescript
// src/lib/db/client-sqlite.ts (initialization)

import {
  needsMigration,
  clearLocalDatabaseForMigration,
  setLocalSchemaVersion,
  isForcedReset,
  clearMigrationParams,
} from "./migration-version";

export async function initializeLocalDatabase(): Promise<SqliteDatabase> {
  const db = await createSqliteDb();

  // Check if schema migration is needed
  if (needsMigration()) {
    const forced = isForcedReset();

    if (forced) {
      console.warn(
        "🔄 FORCED RESET via URL parameter - clearing all local data"
      );
      // Show user notification
      showToast("Resetting local database...", { type: "info" });
    } else {
      console.warn("⚠️ Schema version mismatch - automatic migration required");
    }

    await clearLocalDatabaseForMigration(db);
    setLocalSchemaVersion(CURRENT_SCHEMA_VERSION);

    // Clean up URL params
    clearMigrationParams();

    if (forced) {
      showToast("Local database reset complete. Syncing from server...", {
        type: "success",
      });
    }
  }

  return db;
}
```

#### Step 5.3: Trigger full sync after migration

```typescript
// src/lib/sync/engine.ts

export async function sync(): Promise<SyncResult> {
  // Check if this is first sync after migration
  const needsFullSync = needsMigration();

  if (needsFullSync) {
    console.log("🔄 First sync after schema migration - performing full sync");
    // Skip syncUp (local data was cleared)
    // Only syncDown to pull all data from Supabase
    const downResult = await this.syncDown();
    setLocalSchemaVersion(CURRENT_SCHEMA_VERSION);
    return downResult;
  }

  // Normal bidirectional sync
  const upResult = await this.syncUp();
  const downResult = await this.syncDown();
  // ...
}
```

#### Step 5.4: Add user-facing migration documentation

```markdown
<!-- docs/migration-guide.md -->

# UUID Migration Guide

## Automatic Migration

When you first launch the app after the UUID migration is deployed:

1. **Automatic detection:** The app detects the schema version mismatch
2. **Local data cleared:** All local offline data is cleared
3. **Full sync:** App downloads all your data from the server with new UUIDs
4. **Seamless:** This happens automatically on first load

**⚠️ Important:** Any offline changes made before the migration will be lost. Please sync before the migration is deployed!

## Manual Reset (Troubleshooting)

If you encounter sync issues after migration, you can force a reset:

### Option 1: URL Parameter

Add `?reset=true` to your URL:
```

https://tunetrees.com/?reset=true

````

This will:
- Clear all local storage
- Clear local database
- Trigger full re-sync from server
- Redirect to clean URL

### Option 2: DevTools Console
```javascript
localStorage.removeItem("schema_version");
location.reload();
````

### Option 3: Browser DevTools

1. Open DevTools (F12)
2. Go to Application → Storage
3. Clear Site Data
4. Reload page

## FAQ

**Q: Will I lose my practice data?**  
A: No! All data is safely stored in Supabase. You'll just re-download it with the new UUIDs.

**Q: What if I was offline when the migration deployed?**  
A: Any offline changes will be lost. The app will show a warning on next online sync.

**Q: Can I prevent the automatic migration?**  
A: No, but you'll see a toast notification explaining what's happening.

**Q: How do I know if migration succeeded?**  
A: Check localStorage: `localStorage.getItem("schema_version")` should be `"2.0.0-uuid"`

```

```

---

### Phase 6: Testing Updates

#### Step 6.1: Update seed data for local Docker Supabase

```sql
-- supabase/seed.sql
-- This seeds the LOCAL Docker Supabase database for development and testing

-- Use hardcoded UUIDs for predictable test data
-- NOTE: These are UUIDv4 format for simplicity in seed data
-- Application code will generate UUIDv7 for new records

DO $$
DECLARE
  -- Test users (hardcoded UUIDs for reproducibility)
  user1_uuid UUID := '00000000-0000-4000-8000-000000000001';
  user2_uuid UUID := '00000000-0000-4000-8000-000000000002';

  -- Test playlists
  playlist1_uuid UUID := '00000000-0000-4000-8000-000000000101';
  playlist2_uuid UUID := '00000000-0000-4000-8000-000000000102';

  -- Test tunes (use recognizable UUIDs for common test tunes)
  tune_kesh_uuid UUID := '00000000-0000-4000-8000-000000001001'; -- The Kesh
  tune_swallowtail_uuid UUID := '00000000-0000-4000-8000-000000001002'; -- Swallowtail Jig
  tune_wind_uuid UUID := '00000000-0000-4000-8000-000000001003'; -- Wind That Shakes The Barley

  -- Reference data UUIDs
  genre_irish_uuid UUID := '00000000-0000-4000-8000-000000010001';
  type_reel_uuid UUID := '00000000-0000-4000-8000-000000020001';
  type_jig_uuid UUID := '00000000-0000-4000-8000-000000020002';
  instrument_fiddle_uuid UUID := '00000000-0000-4000-8000-000000030001';

BEGIN
  -- Insert reference data (genres, tune types, instruments)
  INSERT INTO genre (id, genre_name) VALUES
    (genre_irish_uuid, 'Irish');

  INSERT INTO tune_type (id, tune_type_name) VALUES
    (type_reel_uuid, 'Reel'),
    (type_jig_uuid, 'Jig');

  INSERT INTO instrument (id, instrument_name) VALUES
    (instrument_fiddle_uuid, 'Fiddle');

  -- Insert test users
  INSERT INTO user_profile (supabase_user_id, email, name) VALUES
    (user1_uuid, 'test@example.com', 'Test User'),
    (user2_uuid, 'test2@example.com', 'Test User 2');

  -- Insert test playlists
  INSERT INTO playlist (id, user_ref, instrument, genre) VALUES
    (playlist1_uuid, user1_uuid, 'fiddle', 'irish'),
    (playlist2_uuid, user2_uuid, 'fiddle', 'irish');

  -- Insert test tunes
  INSERT INTO tune (id, title, type, mode, private_for, abc_notation) VALUES
    (tune_kesh_uuid, 'The Kesh', 'reel', 'G Major', NULL, 'X:1\nT:The Kesh\nM:4/4\nL:1/8\nK:Gmaj\n|:GAG...'),
    (tune_swallowtail_uuid, 'Swallowtail Jig', 'jig', 'E Minor', NULL, 'X:1\nT:Swallowtail Jig\nM:6/8\nL:1/8\nK:Emin\n|:...'),
    (tune_wind_uuid, 'The Wind That Shakes The Barley', 'reel', 'D Major', NULL, 'X:1\nT:Wind\nM:4/4\nL:1/8\nK:Dmaj\n|:...');

  -- Insert playlist_tune associations
  INSERT INTO playlist_tune (playlist_ref, tune_ref, added) VALUES
    (playlist1_uuid, tune_kesh_uuid, NOW()),
    (playlist1_uuid, tune_swallowtail_uuid, NOW()),
    (playlist1_uuid, tune_wind_uuid, NOW());

END $$;
```

#### Step 6.1b: Update test database seeding scripts

```typescript
// scripts/seed-test-db.ts
// Used by E2E tests to seed clean test data

import { generateId } from "../src/lib/utils/uuid";
import { createClient } from "@supabase/supabase-js";

// Export hardcoded test UUIDs for use in tests
export const TEST_UUIDS = {
  users: {
    user1: "00000000-0000-4000-8000-000000000001",
    user2: "00000000-0000-4000-8000-000000000002",
  },
  playlists: {
    playlist1: "00000000-0000-4000-8000-000000000101",
    playlist2: "00000000-0000-4000-8000-000000000102",
  },
  tunes: {
    kesh: "00000000-0000-4000-8000-000000001001",
    swallowtail: "00000000-0000-4000-8000-000000001002",
    wind: "00000000-0000-4000-8000-000000001003",
  },
  reference: {
    genreIrish: "00000000-0000-4000-8000-000000010001",
    typeReel: "00000000-0000-4000-8000-000000020001",
    typeJig: "00000000-0000-4000-8000-000000020002",
    instrumentFiddle: "00000000-0000-4000-8000-000000030001",
  },
};

export async function seedTestDatabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Clear existing test data
  await supabase.from("practice_record").delete().neq("id", "");
  await supabase.from("daily_practice_queue").delete().neq("id", "");
  await supabase.from("playlist_tune").delete().neq("playlist_ref", "");
  await supabase.from("tune").delete().neq("id", "");
  await supabase.from("playlist").delete().neq("id", "");
  await supabase.from("user_profile").delete().neq("supabase_user_id", "");

  // Insert test data with hardcoded UUIDs
  await supabase.from("user_profile").insert([
    {
      supabase_user_id: TEST_UUIDS.users.user1,
      email: "test@example.com",
      name: "Test User",
    },
  ]);

  await supabase.from("playlist").insert([
    {
      id: TEST_UUIDS.playlists.playlist1,
      user_ref: TEST_UUIDS.users.user1,
      instrument: "fiddle",
      genre: "irish",
    },
  ]);

  await supabase.from("tune").insert([
    {
      id: TEST_UUIDS.tunes.kesh,
      title: "The Kesh",
      type: "reel",
      mode: "G Major",
    },
  ]);

  await supabase.from("playlist_tune").insert([
    {
      playlist_ref: TEST_UUIDS.playlists.playlist1,
      tune_ref: TEST_UUIDS.tunes.kesh,
      added: new Date().toISOString(),
    },
  ]);
}
```

#### Step 6.2: Update test fixtures

```typescript
// tests/fixtures/test-data.ts
// Shared test UUIDs across all tests (E2E and unit)

import { generateId } from "@/lib/utils/uuid";
import type { User, Playlist, Tune } from "@/lib/db/types";

// Hardcoded UUIDs for predictable test data (matches seed.sql)
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
export const TEST_USER_2_ID = "00000000-0000-4000-8000-000000000002";
export const TEST_PLAYLIST_ID = "00000000-0000-4000-8000-000000000101";
export const TEST_PLAYLIST_2_ID = "00000000-0000-4000-8000-000000000102";

// Test tunes (use same UUIDs as seed data for consistency)
export const TEST_TUNE_KESH_ID = "00000000-0000-4000-8000-000000001001";
export const TEST_TUNE_SWALLOWTAIL_ID = "00000000-0000-4000-8000-000000001002";
export const TEST_TUNE_WIND_ID = "00000000-0000-4000-8000-000000001003";

// Reference data UUIDs
export const TEST_GENRE_IRISH_ID = "00000000-0000-4000-8000-000000010001";
export const TEST_TYPE_REEL_ID = "00000000-0000-4000-8000-000000020001";
export const TEST_TYPE_JIG_ID = "00000000-0000-4000-8000-000000020002";
export const TEST_INSTRUMENT_FIDDLE_ID = "00000000-0000-4000-8000-000000030001";

export const testUser: User = {
  supabaseUserId: TEST_USER_ID,
  email: "test@example.com",
  name: "Test User",
};

export const testPlaylist: Playlist = {
  id: TEST_PLAYLIST_ID,
  userRef: TEST_USER_ID,
  instrument: "fiddle",
  genre: "irish",
  // ...
};

export const testTuneKesh: Tune = {
  id: TEST_TUNE_KESH_ID,
  title: "The Kesh",
  type: "reel",
  mode: "G Major",
  // ...
};

export const testTuneSwallowtail: Tune = {
  id: TEST_TUNE_SWALLOWTAIL_ID,
  title: "Swallowtail Jig",
  type: "jig",
  mode: "E Minor",
  // ...
};
```

#### Step 6.3: Update Playwright E2E tests

```typescript
// tests/e2e/practice.spec.ts

import { test, expect } from "@playwright/test";
import {
  TEST_USER_ID,
  TEST_PLAYLIST_ID,
  TEST_TUNE_KESH_ID,
  TEST_TUNE_SWALLOWTAIL_ID,
} from "../fixtures/test-data";

test.describe("Practice Recording", () => {
  test.beforeEach(async ({ page }) => {
    // Seed test data uses hardcoded UUIDs from fixtures
    // Database already seeded via seed.sql or seed-test-db.ts
    await page.goto("/practice");
  });

  test("can record practice rating", async ({ page }) => {
    // Find tune by title (not ID, since UI doesn't expose UUIDs)
    await page.getByText("The Kesh").click();

    // Rate the tune
    await page.getByRole("button", { name: "Rating 3" }).click();

    // Verify rating recorded
    await expect(page.getByText("Rating recorded")).toBeVisible();

    // If test needs to verify database state, use known UUIDs:
    const practiceRecords = await db
      .select()
      .from(practiceRecord)
      .where(
        and(
          eq(practiceRecord.tuneRef, TEST_TUNE_KESH_ID), // UUID, not integer
          eq(practiceRecord.playlistRef, TEST_PLAYLIST_ID)
        )
      );

    expect(practiceRecords.length).toBe(1);
    expect(practiceRecords[0].rating).toBe(3);
  });

  test("can navigate between tunes in queue", async ({ page }) => {
    // Verify tune order using known UUIDs
    const queue = await page.locator('[data-testid="practice-queue-item"]');

    await expect(queue.first()).toContainText("The Kesh");
    await expect(queue.nth(1)).toContainText("Swallowtail Jig");

    // Internal data attributes can use UUIDs for precise targeting
    await page.click(`[data-tune-id="${TEST_TUNE_KESH_ID}"]`);
  });
});
```

**Files to update in E2E tests:**

- `tests/e2e/practice.spec.ts` - Update all tune/playlist ID references
- `tests/e2e/catalog.spec.ts` - Update tune selection by ID
- `tests/e2e/playlists.spec.ts` - Update playlist creation/editing assertions
- `tests/e2e/notes.spec.ts` - Update note creation with tune UUIDs
- `tests/e2e/auth.spec.ts` - Update user profile assertions

**Pattern for updating:**

1. Replace hardcoded integer IDs with UUID constants from `test-data.ts`
2. Update `data-*` attributes in selectors from integers to UUIDs
3. Update database assertions to use UUID FKs
4. Keep UI-facing selectors using text/labels (users don't see UUIDs)

#### Step 6.4: Update Vitest unit tests

```typescript
// src/lib/services/practice-recording.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { recordPracticeRating } from "./practice-recording";
import {
  TEST_TUNE_KESH_ID,
  TEST_PLAYLIST_ID,
  testUser,
  testPlaylist,
  testTuneKesh,
} from "@/../tests/fixtures/test-data";
import { isUUIDv7 } from "@/lib/utils/uuid";

describe("recordPracticeRating", () => {
  beforeEach(async () => {
    // Setup test data with hardcoded UUIDs
    await db.insert(userProfile).values(testUser);
    await db.insert(playlist).values(testPlaylist);
    await db.insert(tune).values(testTuneKesh);
    await db.insert(playlistTune).values({
      playlistRef: TEST_PLAYLIST_ID,
      tuneRef: TEST_TUNE_KESH_ID,
      added: new Date().toISOString(),
    });
  });

  it("should generate UUIDv7 for new practice record", async () => {
    const result = await recordPracticeRating({
      tuneRef: TEST_TUNE_KESH_ID, // UUID
      playlistRef: TEST_PLAYLIST_ID, // UUID
      rating: 3,
    });

    expect(result.success).toBe(true);
    expect(result.practiceRecord?.id).toBeDefined();

    // Verify it's a valid UUIDv7 (time-ordered)
    expect(isUUIDv7(result.practiceRecord!.id)).toBe(true);

    // Verify UUIDs are strings, not integers
    expect(typeof result.practiceRecord!.id).toBe("string");
    expect(typeof result.practiceRecord!.tuneRef).toBe("string");
    expect(typeof result.practiceRecord!.playlistRef).toBe("string");
  });

  it("should use correct UUID foreign keys", async () => {
    const result = await recordPracticeRating({
      tuneRef: TEST_TUNE_KESH_ID,
      playlistRef: TEST_PLAYLIST_ID,
      rating: 4,
    });

    // Verify FKs match our test data
    expect(result.practiceRecord?.tuneRef).toBe(TEST_TUNE_KESH_ID);
    expect(result.practiceRecord?.playlistRef).toBe(TEST_PLAYLIST_ID);
  });
});
```

**Files to update in unit tests:**

- `src/lib/services/practice-recording.test.ts` - Update all ID parameters
- `src/lib/db/queries/practice.test.ts` - Update queue generation tests
- `src/lib/db/queries/playlists.test.ts` - Update playlist queries
- `src/lib/db/queries/tunes.test.ts` - Update tune queries
- `src/lib/sync/engine.test.ts` - Update sync tests with UUIDs

#### Step 6.5: Reset and test local Docker database

```bash
# Stop current containers
docker compose down

# Reset local Supabase database (applies UUID migrations)
supabase db reset --local

# This will:
# 1. Drop all tables
# 2. Run all migrations (including UUID migration)
# 3. Run seed.sql with UUID test data

# Verify seed data
supabase db diff --local

# Run E2E tests against local Docker database
npm run test:e2e

# Run unit tests
npm run test:unit
```

---

## Implementation Checklist

### Pre-Migration

- [ ] Review and approve this plan
- [ ] Create feature branch: `feat/uuid-migration`
- [ ] Backup production database
- [ ] Document rollback procedure

### Phase 1: Supabase Schema

- [ ] Write migration: Add UUID columns (non-breaking)
- [ ] Write migration: Populate UUID columns
- [ ] Write migration: Add UUID FK columns
- [ ] Write migration: Populate UUID FK columns
- [ ] Test migrations on local Supabase
- [ ] Deploy migrations to remote Supabase (NON-BREAKING)

### Phase 2: Code Changes

- [ ] Create UUID utility (`src/lib/utils/uuid.ts`)
- [ ] Update Drizzle schema: `drizzle/schema-sqlite.ts`
- [ ] Update Drizzle schema: `drizzle/schema.ts`
- [ ] Update TypeScript types: `src/lib/db/types.ts`
- [ ] Update all INSERT operations to use `generateId()`
- [ ] Update sync engine: Remove UUID-specific handling (it's now standard)
- [ ] Update migration script: `scripts/migrate-production-to-supabase.ts`
- [ ] Add migration version tracking: `src/lib/db/migration-version.ts`
- [ ] Update database initialization to check version
- [ ] Test locally with UUID schema

### Phase 3: Testing

- [ ] Update local Docker Supabase seed data: `supabase/seed.sql`
- [ ] Update test database seeding scripts: `scripts/seed-*.ts`
- [ ] Update test fixtures: `tests/fixtures/test-data.ts`
- [ ] Update Playwright E2E tests: `tests/**/*.spec.ts`
  - [ ] Update tune reference IDs (hardcoded UUIDs)
  - [ ] Update playlist/user IDs in test setup
  - [ ] Update assertions that check IDs
- [ ] Update Vitest unit tests: `src/**/*.test.ts`
- [ ] Update any test helper utilities that generate test data
- [ ] Reset local Docker database: `supabase db reset --local`
- [ ] Run seed scripts on local Docker database
- [ ] Run full test suite (E2E + unit) against local Docker
- [ ] Verify offline → online sync works with UUIDs

### Phase 4: Final Migration (BREAKING)

- [ ] Write migration: Switch to UUID PKs (drop integer columns)
- [ ] Deploy to Supabase
- [ ] Deploy frontend with UUID support
- [ ] Run production migration script (legacy → Supabase with UUIDs)
- [ ] Verify all data migrated correctly
- [ ] Test live app: offline creation → online sync

### Post-Migration

- [ ] Monitor error logs for UUID-related issues
- [ ] Document UUID patterns for future contributors
- [ ] Update README with offline-first architecture notes
- [ ] Close related issues/tickets

---

## Rollback Plan

If migration fails:

1. **Code rollback:**

   ```bash
   git revert <uuid-migration-commits>
   npm run build
   npm run deploy
   ```

2. **Database rollback:**

   ```sql
   -- Restore integer ID columns
   ALTER TABLE user_profile ADD COLUMN id INTEGER;
   ALTER TABLE playlist ADD COLUMN id INTEGER;
   -- ... restore all integer columns

   -- Drop UUID columns
   ALTER TABLE user_profile DROP COLUMN id_uuid;
   -- ... drop all UUID columns
   ```

3. **User data:** Users on old version will continue working. New users must wait for fix.

---

## Open Questions

1. **User profile PK:** Confirm removing `user_profile.id` and using `supabase_user_id` as PK is acceptable?

   - **Decision:** ✅ YES - eliminates redundancy, simplifies auth integration

2. **Reference data UUIDs:** Should `genre` and `tune_type` (currently TEXT IDs like "reel") switch to UUIDs?

   - **Decision:** ✅ **YES - UUIDs** (users may create custom genres/types offline)

3. **Instrument table:** Currently INTEGER id, should migrate to UUID or TEXT id (like genre)?

   - **Decision:** ✅ **UUID** - instruments can be user-created offline

4. **Migration downtime:** Can we do zero-downtime migration with dual-column approach?

   - **Decision:** YES - Phase 1 is non-breaking, Phase 2 requires brief downtime for final switch

5. **UUID version:** Use UUIDv4 (random) or UUIDv7 (time-ordered)?

   - **Decision:** ✅ **UUIDv7** (time-ordered, Supabase recommendation)
   - **Rationale:**
     - Maintains chronological ordering (critical for `ORDER BY id` queries)
     - Better index performance (sequential inserts)
     - Supabase's official recommendation for new tables
     - Code relies on ID ordering in several places (see below)

6. **Timeline pressure:** Can we do this in 5-6 days without shortcuts?
   - **Decision:** ✅ YES - Focus on correctness, not speed. Rushing = technical debt.

**✅ ALL DECISIONS FINALIZED - READY TO PROCEED**

---

## Timeline Estimate

**Target:** Move quickly but correctly. No shortcuts.

- **Phase 1 (Supabase schema):** 1 day
  - Write migrations (dual-column approach)
  - Test locally
  - Deploy non-breaking changes
- **Phase 2 (Code changes):** 2 days
  - UUIDv7 utility
  - Schema updates (Drizzle)
  - Update all INSERT operations
  - Update migration script
- **Phase 3 (Testing):** 1-2 days
  - Update test data (seed, fixtures)
  - Update E2E tests
  - Update unit tests
  - Full test suite run
- **Phase 4 (Final migration):** 1 day
  - Breaking schema change (switch to UUIDs)
  - Deploy code + schema
  - Run production migration
  - Verify
- **Total:** 5-6 days (aggressive but achievable if focused)

---

## Success Criteria

- ✅ All tables use UUIDs for offline-safe record creation
- ✅ No ID conflicts during offline → online sync
- ✅ All tests passing (E2E + unit)
- ✅ Production data migrated successfully (legacy → Supabase)
- ✅ Users can create records offline and sync online without errors
- ✅ Migration flag prevents destructive sync for existing users

---

## References

- [Supabase UUID Primary Keys](https://supabase.com/docs/guides/database/tables#uuid-primary-keys)
- [PouchDB Conflict Resolution](https://pouchdb.com/guides/conflicts.html)
- [PowerSync Offline-First Patterns](https://docs.powersync.com/usage/installation/client-side-setup)
- [CouchDB Document IDs](https://docs.couchdb.org/en/stable/best-practices/documents.html#document-ids)

---

**NEXT STEPS:**

1. Review this plan
2. Raise any concerns or questions
3. Approve to proceed with implementation
