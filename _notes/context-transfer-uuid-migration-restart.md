# Context Transfer: UUIDv7 Migration - Fresh Start Required

**Date:** November 2, 2025  
**Session Type:** Migration Recovery  
**Branch:** `feat/pwa1`  
**Critical Status:** 🔴 Database wiped - schema needs reinstallation

---

## TL;DR — Immediate Situation

**What happened:**

- UUIDv7 migration was working last night (Nov 1, 2025)
- Local database was completely wiped overnight
- Migration script now fails because schema doesn't exist
- Playwright tests haven't been updated for UUID yet

**Current blocker:**

- Need to reinstall database schema before migration can run
- Tried `npm run db:push` but that script doesn't exist
- Likely need: `supabase db reset` or `npx drizzle-kit push`

**What's ready:**

- Migration script updated for UUIDv7 (`scripts/migrate-production-to-supabase.ts`)
- Test user creation script updated (`scripts/create-test-users.ts`)
- Environment configured for local Supabase
- Schema migration file exists: `supabase/migrations/20251031000003_switch_to_uuid_pks.sql`

---

## Critical Files & Commands

### Schema Installation (PRIORITY 1)

**Option 1: Supabase Reset** (Recommended)

```bash
# This will apply all migrations including the UUID one
supabase db reset
```

**Option 2: Drizzle Push**

```bash
npx drizzle-kit push --config=drizzle.config.ts
```

**Verification:**

```bash
# Check if schema is installed
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d user_profile"
```

### After Schema is Installed

**Step 1: Create test users**

```bash
tsx scripts/create-test-users.ts
```

**Step 2: Run migration**

```bash
# Local migration (default)
npm run migrate:production

# Remote migration (with 5-second safety delay)
npm run migrate:production -- --remote
```

**Step 3: Seed test data**

```bash
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/seed-test-data.sql
```

---

## UUIDv7 Migration Architecture

### What Changed from INTEGER to UUID

**Before (SQLite - INTEGER IDs):**

```sql
CREATE TABLE user (
  id INTEGER PRIMARY KEY,
  email TEXT
);

CREATE TABLE playlist (
  id INTEGER PRIMARY KEY,
  user_ref INTEGER REFERENCES user(id)
);
```

**After (Supabase - UUID IDs):**

```sql
CREATE TABLE user_profile (
  id UUID PRIMARY KEY,  -- Maps to auth.users(id)
  email TEXT
);

CREATE TABLE playlist (
  playlist_id UUID PRIMARY KEY,
  user_ref UUID REFERENCES user_profile(id)
);
```

### UUID Mapping Strategy

The migration script creates mapping tables to convert INTEGER → UUID:

```typescript
// ID mapping structures (in migrate-production-to-supabase.ts)
const userIdMapping = new Map<number, string>(); // SQLite user.id → UUID
const tuneIdMapping = new Map<number, string>(); // SQLite tune.id → UUID
const playlistIdMapping = new Map<number, string>(); // SQLite playlist.id → UUID
const instrumentIdMapping = new Map<number, string>(); // SQLite instrument.id → UUID
const instrumentNameMapping = new Map<string, string>(); // instrument.name → UUID
const practiceRecordIdMapping = new Map<number, string>(); // SQLite practice_record.id → UUID
```

### Key Changes in Migration Script

**1. Environment Safety (Lines 48-73)**

```typescript
const isRemote = process.argv.includes("--remote");
dotenv.config({ path: isRemote ? ".env.production" : ".env.local" });

if (isRemote) {
  console.log("⚠️  WARNING: Migrating to REMOTE production database!");
  console.log("This will DELETE all existing data in production Supabase.");
  await new Promise((resolve) => setTimeout(resolve, 5000)); // 5-second safety delay
}
```

**2. Instrument Migration - Now Uses UUIDs (Lines 475-528)**

```typescript
// OLD (BROKEN):
await supabase.from("instrument").insert({
  id: inst.id, // INTEGER - WRONG!
});

// NEW (FIXED):
for (const inst of instruments) {
  const instrumentUuid = generateId(); // Generate UUIDv7
  instrumentIdMapping.set(inst.id, instrumentUuid);
  instrumentNameMapping.set(inst.instrument, instrumentUuid);

  await supabase.from("instrument").insert({
    id: instrumentUuid, // UUID - CORRECT!
    // ...
  });
}
```

**3. Playlist Instrument Mapping - Fixed Foreign Keys (Lines 707-717)**

```typescript
// Map instrument_ref from INTEGER to UUID
let instrumentUuid = null;
if (p.instrument_ref !== null) {
  instrumentUuid = instrumentIdMapping.get(p.instrument_ref);
  if (!instrumentUuid) {
    console.log(`⚠️ Playlist ${p.playlist_id} references unknown instrument`);
  }
}
```

---

## Test User Configuration

### Test Users Defined

**Location:** `tests/fixtures/test-data.ts`

**10 Test Users with UUIDs:**

```typescript
const TEST_USERS = [
  { id: "00000000-0000-4000-8000-000000000001", email: "test@example.com" },
  { id: "00000000-0000-4000-8000-000000000002", email: "test2@example.com" },
  {
    id: "00000000-0000-4000-8000-000000009001",
    email: "alice.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009002",
    email: "bob.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009003",
    email: "dave.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009004",
    email: "eve.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009005",
    email: "frank.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009006",
    email: "grace.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009007",
    email: "henry.test@tunetrees.test",
  },
  {
    id: "00000000-0000-4000-8000-000000009008",
    email: "iris.test@tunetrees.test",
  },
];
```

**Password:** `TestPassword123!` (safe for local/CI)

### Test File UUID Fixes

**File:** `src/lib/services/practice-queue.test.ts`

**Status:** ✅ All hard-coded INTEGER IDs replaced with `tuneId()` helper

**Changes made:**

- ~60+ replacements of integer IDs with UUID calls
- `insertTune(db, 1)` → `insertTune(db, tuneId(1))`
- `const TUNE_A = 1` → `const TUNE_A = tuneId(1)`
- `tuneRef: 43` → `tuneRef: tuneId(43)`

**Helper function:**

```typescript
// Converts integer ID to catalog tune UUID
tuneId(n: number): string {
  return getCatalogTuneUuid(n);
}
```

---

## Environment Configuration

### Local Development (.env.local)

```bash
# LOCAL Supabase (default)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# Database URL (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Service Role Key (local - auto-fetched by migration script)
# SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz

# Test credentials
ALICE_EMAIL=alice.test@tunetrees.test
ALICE_TEST_PASSWORD=TestPassword123!
```

### Remote Production (.env.production)

```bash
# REMOTE Supabase (use --remote flag)
VITE_SUPABASE_URL=https://pjxuonglsvouttihjven.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database URL (remote)
DATABASE_URL=postgresql://postgres:password@db.pjxuonglsvouttihjven.supabase.co:5432/postgres

# Service Role Key (remote)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Migration Script Details

### File: `scripts/migrate-production-to-supabase.ts`

**Purpose:** Migrate ALL data from SQLite to Supabase PostgreSQL with UUID conversion

**Safety Features:**

1. ✅ Default to `.env.local` (prevents accidental remote wipe)
2. ✅ `--remote` flag required for production migration
3. ✅ 5-second countdown before remote migration
4. ✅ Clear console output showing target (LOCAL vs REMOTE)

**Migration Phases:**

```
Phase 0: CLEANUP - Delete all existing Supabase data
Phase 1: Users - Create auth users + user_profile records
Phase 2: Genres - Copy genre reference data
Phase 3: Tune Types - Copy tune_type reference data
Phase 4: Tunes - Copy catalog tunes with UUID mapping
Phase 5: Notes - Copy tune notes with UUID references
Phase 6: References - Copy tune references with UUID mapping
Phase 7: Instruments - Generate UUIDs for instruments
Phase 8: Playlists - Map instrument_ref to UUIDs
Phase 9: Playlist Tunes - Map tune and playlist UUIDs
Phase 10: Practice Records - Map tune, playlist, and user UUIDs
Phase 11: Tune Overrides - Map tune and user UUIDs
```

**Expected Output (Last Successful Run):**

```
✅ 11 users migrated
✅ 15 genres migrated
✅ 49 tune types migrated
✅ 495 catalog tunes migrated
✅ 8 instruments migrated (with UUIDs)
✅ 7 playlists migrated (with UUID references)
✅ 522 playlist_tune records migrated
✅ 1166 practice_record records migrated
```

---

## Database Schema Status

### Schema Files

**PostgreSQL Schema:**

- `drizzle/schema-postgres.ts` (630 lines)
- `supabase/migrations/20251031000003_switch_to_uuid_pks.sql` (UUID migration)

**SQLite Schema:**

- `drizzle/schema.ts` (for local offline database)

**Configuration:**

- `drizzle.config.ts` → Points to PostgreSQL/Supabase
- `drizzle.config.sqlite.ts` → Points to SQLite WASM

### Current State

**❌ Problem:** Schema not installed in empty database

**Verification Commands:**

```bash
# Check if tables exist
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\dt"

# Check user_profile table structure
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d user_profile"
```

**Expected result after schema installation:**

```
                    Table "public.user_profile"
     Column      |           Type           | Nullable
-----------------+--------------------------+----------
 id              | uuid                     | not null
 email           | text                     | not null
 name            | text                     |
 sync_version    | integer                  | not null
 last_modified_at| timestamp with time zone | not null
 device_id       | text                     |
Indexes:
    "user_profile_pkey" PRIMARY KEY, btree (id)
```

---

## Playwright Tests - Not Yet Updated

### Current Status

**⚠️ WARNING:** Playwright tests still expect INTEGER IDs

**Files Needing Updates:**

- All E2E tests in `e2e/tests/*.spec.ts`
- Fixtures in `tests/fixtures/test-data.ts` (already updated)
- Setup files in `e2e/setup/*.setup.ts`

**What Needs Changing:**

```typescript
// OLD (will fail with UUID schema):
await page.locator('[data-tune-id="1"]').click();
expect(tune.id).toBe(1);

// NEW (UUID-compatible):
await page.locator(`[data-tune-id="${tuneId(1)}"]`).click();
expect(tune.id).toBe(tuneId(1));
```

**Recommended Approach:**

1. Install schema first
2. Run migration successfully
3. Run Playwright suite to see which tests fail
4. Update tests one-by-one with UUID helpers

---

## Recent Git History

```
29b7051 🚧 ♻️ Migration to UUIDv7 for table IDs and refs.. WIP.
d0c6c17 ✨ full-page layout for SQLite WASM Browser
0968115 🐛 fix(sidebar): reliable drag-to-dock when collapsed
2f56020 feat: Add drag-and-dock sidebar with position menu
fe13172 ✨ UI polish: Toolbar alignment, modal z-index
94b0ca4 fix(practice): keep recall eval dropdown open across sync
```

**Latest commit:** `29b7051` - Migration to UUIDv7 (WIP)

---

## Known Issues & Solutions

### Issue 1: Migration Fails - No Schema

**Error:**

```
relation "user_profile" does not exist
```

**Cause:** Database was wiped, schema not installed

**Solution:**

```bash
supabase db reset
```

### Issue 2: Missing Service Role Key

**Error:**

```
Missing Supabase credentials!
```

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` commented out in `.env.local`

**Solution:** Uncomment line 8 in `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
```

### Issue 3: Instrument INTEGER IDs

**Error:**

```
invalid input syntax for type uuid: "1"
```

**Cause:** Old code using INTEGER IDs for instruments

**Status:** ✅ FIXED in commit `29b7051`

**Fix Applied:**

- Lines 475-528: Generate UUIDs for instruments
- Lines 707-717: Map instrument_ref from INTEGER → UUID

---

## Next Steps (Prioritized)

### 🔴 CRITICAL (Do First)

1. **Install database schema**

   ```bash
   supabase db reset
   ```

2. **Verify schema installed**

   ```bash
   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "\d user_profile"
   ```

3. **Create test users**

   ```bash
   tsx scripts/create-test-users.ts
   ```

4. **Run migration**
   ```bash
   npm run migrate:production
   ```

### 🟡 HIGH (After Migration Works)

5. **Verify migration results**

   ```bash
   # Check record counts
   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
     SELECT 'user_profile' as table, COUNT(*) FROM user_profile
     UNION ALL
     SELECT 'tune', COUNT(*) FROM tune
     UNION ALL
     SELECT 'instrument', COUNT(*) FROM instrument
     UNION ALL
     SELECT 'playlist', COUNT(*) FROM playlist
     UNION ALL
     SELECT 'practice_record', COUNT(*) FROM practice_record;
   "
   ```

6. **Test sync in browser**
   - Open http://localhost:5173/
   - Login as alice.test@tunetrees.test / TestPassword123!
   - Check Network status (should show "Synced")
   - Verify data appears in grids

### 🟢 MEDIUM (After Sync Verified)

7. **Update Playwright tests for UUID**

   - Start with simplest tests first
   - Add UUID helper functions
   - Update assertions

8. **Run E2E test suite**

   ```bash
   npm run test:e2e
   ```

9. **Fix failing tests one-by-one**

---

## Available NPM Scripts

### Database Management

```bash
npm run db:local:reset      # Reset local DB + generate auth states
npm run db:ci:reset         # Reset + setup test environment
npm run migrate:production  # Run migration (local by default)
```

### Testing

```bash
npm run test                # Run all Vitest unit tests
npm run test:unit           # Run unit tests only
npm run test:e2e            # Run all Playwright E2E tests
npm run test:e2e:chromium   # Run E2E tests in Chromium only
npm run test:e2e:headed     # Run E2E tests with browser visible
npm run test:e2e:ui         # Open Playwright UI
```

### Code Quality

```bash
npm run typecheck           # TypeScript strict mode check
npm run lint                # Biome linter
npm run format              # Biome formatter
npm run check               # Biome check (lint + format)
npm run fix                 # Biome auto-fix
```

---

## Important Guiding Documents

### Read These Before Making Changes

1. **`.github/copilot-instructions.md`**

   - SolidJS patterns (no React hooks!)
   - Strict TypeScript rules
   - Offline-first architecture
   - Quality gates (zero warnings)

2. **`.github/instructions/database.instructions.md`**

   - Database schema invariants
   - Migration safety rules
   - Foreign key constraints

3. **`.github/instructions/ui-development.instructions.md`**

   - UI component patterns
   - shadcn-solid + Kobalte usage
   - Table-centric design

4. **`.github/instructions/testing.instructions.md`**

   - Playwright test conventions
   - One input/output state per test
   - No conditionals in tests

5. **`_notes/solidjs-pwa-migration-plan.md`**
   - Full migration roadmap
   - Phase completion status
   - Architecture decisions

---

## Key Architectural Decisions

### Why UUIDv7?

1. **Time-ordered:** UUIDs sort chronologically (unlike UUIDv4)
2. **No collisions:** Can generate client-side without server coordination
3. **Supabase native:** auth.users(id) uses UUIDs, easier to reference
4. **Offline-first:** Generate IDs in browser before sync

### Why Preserve INTEGER → UUID Mapping?

1. **Legacy compatibility:** Catalog tunes have stable integer IDs
2. **Test helpers:** `tuneId(1)` easier than remembering UUID
3. **Human-readable:** Debug logs can reference "Tune 43" not "uuid123..."

### Why Two Environment Files?

1. **Safety:** Default to local, require explicit `--remote` flag
2. **Accident prevention:** Can't wipe production by mistake
3. **Different credentials:** Local has different keys than remote

---

## Danger Zones (Avoid These)

### ❌ Don't Use React Patterns

```typescript
// ❌ WRONG
import { useState, useEffect } from "react";

// ✅ CORRECT
import { createSignal, createEffect } from "solid-js";
```

### ❌ Don't Commit/Push Without Permission

```bash
# ALWAYS ask before:
git push
```

### ❌ Don't Run Remote Migration Without Confirmation

```bash
# DANGEROUS - requires explicit user permission:
npm run migrate:production -- --remote
```

### ❌ Don't Use `any` Types

```typescript
// ❌ WRONG
const data: any = await fetchTunes();

// ✅ CORRECT
interface ITune {
  id: string;
  title: string;
}
const data: ITune[] = await fetchTunes();
```

---

## Quick Reference: UUID Helpers

### Generate New UUID

```typescript
import { generateId } from "@/lib/utils/uuid";
const newId = generateId(); // UUIDv7
```

### Get Catalog Tune UUID

```typescript
import { getCatalogTuneUuid } from "@/lib/db/catalog-tune-ids";
const tuneUuid = getCatalogTuneUuid(43); // Integer → UUID
```

### Test Helper

```typescript
import { tuneId } from "@/lib/test-helpers"; // (if exists)
const id = tuneId(1); // Converts 1 → UUID for test fixtures
```

---

## Success Criteria

### Migration is successful when:

✅ Schema installed (`\d user_profile` shows UUID columns)  
✅ Test users created (10 users in auth.users)  
✅ Migration runs without errors  
✅ Record counts match SQLite exactly  
✅ All foreign keys reference UUIDs  
✅ Sync engine works (local ↔ Supabase)  
✅ UI loads data correctly  
✅ Playwright tests updated and passing

### Current Status:

- [x] Migration script updated for UUIDs
- [x] Test user creation script updated
- [x] Environment configuration correct
- [x] Test files updated (practice-queue.test.ts)
- [ ] **❌ Schema not installed (BLOCKER)**
- [ ] Migration not tested
- [ ] Playwright tests not updated
- [ ] E2E suite not passing

---

## Copy-Paste "First Message" for New Chat

> "I'm continuing UUIDv7 migration work on the tunetrees repo (branch `feat/pwa1`). The migration script is ready but the local database was wiped overnight. Schema needs to be reinstalled before migration can run. Tried `npm run db:push` but that script doesn't exist. Likely need `supabase db reset` or `npx drizzle-kit push`. See `_notes/context-transfer-uuid-migration-restart.md` for complete context. Priority: Install schema, run migration, verify UUID mapping works."

---

**Last Updated:** November 2, 2025  
**Status:** 🔴 Blocked - Schema installation required  
**Next Action:** Install database schema with `supabase db reset`
