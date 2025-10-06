# Drizzle ORM Schema & Migrations

This directory contains the database schema definitions and migrations for the TuneTrees SolidJS PWA.

## Directory Structure

```
drizzle/
├── schema-postgres.ts      # PostgreSQL schema (Supabase cloud)
├── schema-sqlite.ts        # SQLite schema (local offline)
├── sync-columns.ts         # Shared sync column definitions
├── relations.ts            # Table relationships for type-safe queries
├── migrations/
│   ├── postgres/           # PostgreSQL migration files
│   └── sqlite/             # SQLite migration files
```

## Configuration Files

- **`drizzle.config.ts`** - PostgreSQL/Supabase configuration (default)
- **`drizzle.config.sqlite.ts`** - SQLite configuration (local dev)

## Environment Variables

Required in `.env`:

```bash
# Supabase PostgreSQL connection
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Supabase API (for client-side)
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON-KEY]
```

## Common Commands

### Generate Migrations

```bash
# PostgreSQL (Supabase)
npx drizzle-kit generate

# SQLite (local)
npx drizzle-kit generate --config=drizzle.config.sqlite.ts
```

### Push Schema (without migrations)

```bash
# Push to Supabase
npx drizzle-kit push

# Push to local SQLite
npx drizzle-kit push --config=drizzle.config.sqlite.ts
```

### View Database (Drizzle Studio)

```bash
# PostgreSQL
npx drizzle-kit studio

# SQLite
npx drizzle-kit studio --config=drizzle.config.sqlite.ts
```

### Introspect Existing Database

```bash
# Pull schema from Supabase
npx drizzle-kit introspect

# Pull schema from SQLite
npx drizzle-kit introspect --config=drizzle.config.sqlite.ts
```

## Schema Files

### schema-postgres.ts

PostgreSQL schema for Supabase cloud database:

- Uses `serial`, `uuid`, `timestamp`, `boolean` types
- Includes all indexes and constraints
- Uses `pgSyncColumns` for multi-device sync

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

### relations.ts

Defines table relationships for type-safe queries:

```typescript
// Example: Get user with playlists and tunes
const user = await db.query.userProfile.findFirst({
  where: eq(userProfile.email, "user@example.com"),
  with: {
    playlists: {
      with: {
        tunes: {
          with: { tune: true },
        },
      },
    },
  },
});
```

## Migration Workflow

### Initial Setup (Supabase)

1. Create Supabase project
2. Get connection string from Supabase dashboard
3. Add `DATABASE_URL` to `.env`
4. Generate initial migration:
   ```bash
   npx drizzle-kit generate
   ```
5. Push to Supabase:
   ```bash
   npx drizzle-kit push
   ```

### Schema Changes

1. Edit schema file (`schema-postgres.ts` or `schema-sqlite.ts`)
2. Generate migration:
   ```bash
   npx drizzle-kit generate
   ```
3. Review migration in `drizzle/migrations/`
4. Push to database:
   ```bash
   npx drizzle-kit push
   ```

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
import { db } from "./lib/db/client";
import { playlist } from "./drizzle/schema-postgres";
import { eq } from "drizzle-orm";

// Fully typed query
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
