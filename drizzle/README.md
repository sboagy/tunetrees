# Drizzle ORM Schema & Migrations

This directory contains the database schema definitions and migrations for the TuneTrees SolidJS PWA.

> ⚠️ Note: TuneTrees no longer maintains a hand-authored Postgres Drizzle schema/config in this folder.
> The Supabase Postgres schema is managed via `supabase/migrations/`, and the sync worker uses a generated
> Drizzle schema at `worker/src/generated/schema-postgres.generated.ts` (generated via `npm run codegen:schema`).

## Directory Structure

```
drizzle/
├── schema-sqlite.ts        # SQLite schema (local offline) wrapper
├── schema-sqlite.generated.ts # Generated SQLite schema (do not hand-edit)
├── sync-columns.ts         # Shared sync column definitions
├── migrations/
│   ├── postgres/           # Historical/legacy Drizzle migrations (not source-of-truth)
│   └── sqlite/             # SQLite migration files
```

## Configuration Files

- **`drizzle.config.sqlite.ts`** - SQLite configuration (local dev)

## Environment Variables

Required in `.env`:

```bash
# Supabase API (for client-side)
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON-KEY]
```

## Common Commands

### Generate Schema Artifacts

```bash
# Regenerate sync/DB artifacts (includes SQLite schema + worker Postgres schema)
npm run codegen:schema

# Check generated artifacts are up-to-date
npm run codegen:schema:check
```

### View SQLite (Drizzle Studio)

```bash
npx drizzle-kit studio --config=drizzle.config.sqlite.ts
```

### Manage Supabase Schema

Supabase is managed via the Supabase CLI and SQL migrations:

```bash
# Reset local Supabase stack (applies supabase/migrations + seed)
supabase db reset
```

## Schema Files

### schema-sqlite.ts

SQLite schema for local offline database:

- Uses `integer`, `text`, `real` types
- INTEGER for booleans (0/1)
- TEXT for timestamps (ISO 8601)
- TEXT for UUIDs
- Uses `sqliteSyncColumns` for sync

### sync-columns.ts

Shared sync column definitions:

- `sync_version` - Optimistic locking counter
- `last_modified_at` - Last update timestamp
- `device_id` - Device identifier for conflict resolution

## Migration Workflow

### Initial Setup (Supabase)

1. Create Supabase project
2. Use Supabase migrations in `supabase/migrations/`
3. Reset/apply locally via `supabase db reset`
4. Regenerate local artifacts via `npm run codegen:schema`

### Schema Changes

1. Make Postgres changes via Supabase migrations (`supabase/migrations/`)
2. Apply them locally (`supabase db reset`) and/or in Supabase
3. Regenerate SQLite + worker schema artifacts (`npm run codegen:schema`)

### Data Migration from Legacy SQLite

See `MIGRATION_SCRIPTS_README.md` in project root for details on migrating data from the legacy Next.js app to Supabase.

## Key Tables

### Core Data

- `user_profile` - User accounts (extends Supabase auth.users)
- `tune` - Tune metadata
- `playlist` - User playlists
- `practice_record` - Spaced repetition history
- `daily_practice_queue` - Generated practice sessions

### Reference Data

- `genre` - Music genres (Irish, Scottish, etc.)
- `tune_type` - Tune types (Jig, Reel, etc.)
- `instrument` - Instruments

### User Content

- `note` - User notes on tunes
- `reference` - External links (videos, audio)
- `tag` - User-created tags

### Preferences

- `prefs_spaced_repetition` - SR algorithm settings
- `prefs_scheduling_options` - Practice scheduling

### UI State

- `tab_group_main_state` - Active tab tracking
- `table_state` - Table settings (sort, filter)
- `table_transient_data` - Temporary practice data

## Sync Strategy

Both schemas include sync columns for offline-first architecture:

1. **Write**: Save to local SQLite immediately
2. **Queue**: Add to sync queue
3. **Sync**: Push to Supabase in background
4. **Conflict Resolution**: Last-write-wins with `sync_version`

## Type Safety

Drizzle provides full TypeScript type inference:

```typescript
import { getSqliteDb } from "@/lib/db";
import { playlist } from "@/drizzle/schema-sqlite";
import { eq } from "drizzle-orm";

// Fully typed query
const db = getSqliteDb();
const userPlaylists = await db
  .select()
  .from(playlist)
  .where(eq(playlist.userRef, userId));
// TypeScript knows: userPlaylists is Playlist[]
```

## Testing

Run type checks before committing:

```bash
npm run typecheck
```

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Drizzle Kit Docs](https://orm.drizzle.team/kit-docs/overview)
- [Supabase Docs](https://supabase.com/docs)
