# Database Architecture

TuneTrees uses a dual-database architecture for offline-first functionality.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser                               │
│                                                          │
│   SQLite WASM (sql.js)  ←→  IndexedDB (persistence)     │
│         ↑                                                │
│         │ Drizzle ORM                                    │
│         │                                                │
│         ▼                                                │
│   Sync Queue ──────────────────────────────────────────┐│
└─────────────────────────────────────────────────────────┘│
                                                           ▼
                                            ┌──────────────────────┐
                                            │ Supabase PostgreSQL  │
                                            └──────────────────────┘
```

## Local Database (SQLite WASM)

### Technology

- **Engine:** sql.js (SQLite compiled to WebAssembly)
- **ORM:** Drizzle ORM
- **Persistence:** Serialized to IndexedDB blob

### Schema

Defined in `drizzle/schema-sqlite.ts`:

```typescript
export const tune = sqliteTable("tune", {
  id: text().primaryKey().notNull(),
  title: text(),
  type: text(),
  // ...
});
```

Key tables:
- `tune` - Tune metadata
- `playlist` - User playlists
- `playlist_tune` - Tunes in playlists
- `practice_record` - Practice history (no deletes)
- `daily_practice_queue` - Daily practice snapshot
- `table_transient_data` - Staging for uncommitted evaluations
- `sync_queue` - Pending sync operations

### VIEWs

Complex queries are optimized with SQL VIEWs:

- `practice_list_staged` - Merges tune data with staging and history
- `scheduled_tunes_overview` - Aggregates scheduling info

Views are created in `src/lib/db/init-views.ts`.

### Persistence

SQLite database serializes to a single blob stored in IndexedDB:

```
Database: "tunetrees-storage"
Store: "database"  
Key: "tunetrees-db" → Uint8Array (SQLite binary)
```

Persistence triggered by `persistDb()` after writes.

## Cloud Database (Supabase PostgreSQL)

### Schema

The Supabase Postgres schema is the source of truth and is managed via SQL migrations in `supabase/migrations/`.

The sync worker uses a generated Drizzle schema at `worker/src/generated/schema-postgres.generated.ts` (do not hand-edit).

Key differences:
- Uses native UUID type
- Uses native TIMESTAMP type
- Has Row Level Security (RLS) policies

### RLS Policies

Each table has policies ensuring users only access their data:

```sql
CREATE POLICY "Users can only see their own playlists"
ON playlist FOR SELECT
USING (user_ref = auth.uid());
```

## Sync Architecture

### Write Flow

1. User action triggers database write
2. Write to local SQLite immediately
3. Create sync queue entry
4. Persist SQLite to IndexedDB
5. Background: Process sync queue → Supabase

### Sync Queue

```typescript
// Queue entry structure
{
  id: "uuid",
  tableName: "practice_record",
  operation: "insert" | "update" | "delete",
  recordData: "{ JSON payload }",
  status: "pending" | "synced" | "failed",
  createdAt: "ISO timestamp"
}
```

### Field Transformation

Local (camelCase) ↔ Remote (snake_case):

```
Local:  playlistRef, lastModifiedAt
Remote: playlist_ref, last_modified_at
```

Handled by `transformLocalToRemote()` and `transformRemoteToLocal()`.

### Conflict Resolution

**Strategy:** Last-write-wins based on `last_modified_at`

When sync conflicts occur:
1. Compare timestamps
2. Keep the newer record
3. Log conflict for debugging

### Critical Rule

**Always sync UP before sync DOWN** to prevent "zombie records":

```typescript
// SyncService.syncDown() checks pending items first
if (pendingItems > 0) {
  await syncUp();  // Upload first
}
await pullRemoteChanges();  // Then download
```

## Key Invariants

1. **`practice_record` has no deletes (currently)** - Users can update their own practice records; deletes are disallowed (future: consider soft deletes)
2. **Unique constraints enforced locally** - Prevents sync conflicts
3. **All writes queue for sync** - Never write directly to Supabase
4. **Persist after every write** - Survives page refresh

## Admin: Deleting `practice_record` (Break-Glass)

Deletes are blocked at the database layer by default.

If you must delete a row (e.g., correcting a bad import), use the explicit per-session flag:

```sql
begin;
set local app.allow_practice_record_delete = 'on';
delete from public.practice_record where id = '...';
commit;
```

Shell example via `psql`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
set local app.allow_practice_record_delete = 'on';
delete from public.practice_record where id = '...';
commit;
SQL
```

## Working with the Schema

### Add a New Table

1. Create a Supabase migration under `supabase/migrations/`
2. Apply locally with `supabase db reset`
3. Regenerate schema artifacts with `npm run codegen:schema`
4. Add to sync table list in `src/lib/sync/types.ts`

### Add a New Column

1. Create/update a Supabase migration
2. Apply locally with `supabase db reset`
3. Regenerate schema artifacts with `npm run codegen:schema`
4. Update VIEW definitions if affected

---

For sync engine details, see [reference/sync.md](../reference/sync.md).
