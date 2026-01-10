# Database Clients

This directory contains database client modules for TuneTrees' offline-first architecture.

## Overview

TuneTrees uses a **dual-database architecture**:

1. **PostgreSQL (Supabase)** - Cloud storage with real-time sync
2. **SQLite WASM** - Local offline storage in the browser

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (SolidJS)                    │
├─────────────────────────────────────────────────────────┤
│  UI Layer (Components)                                  │
│         ↕                                               │
│  SQLite WASM (client-sqlite.ts) ←──────┐              │
│         ↕                                │              │
│  Sync Layer (background)                │              │
└──────────────────────────────────────────┼──────────────┘
                                           │
                                           ↓
                               ┌───────────────────────┐
                               │   Supabase Cloud      │
                               ├───────────────────────┤
                               │ PostgreSQL            │
                               │ Auth + Realtime       │
                               └───────────────────────┘
```

## Files

### Cloud Database Access

There is no Postgres Drizzle client in `src/lib/db/`.

- **Browser → Supabase:** Use `@/lib/supabase/client` for network access.
- **Server-side Postgres:** The sync worker talks to Supabase Postgres and uses its own generated Drizzle schema.

### `client-sqlite.ts`

SQLite WASM client for local offline storage.

**Features:**

- Runs entirely in the browser
- Persisted to IndexedDB
- Auto-save on visibility change and page unload
- Same schema as PostgreSQL (via Drizzle)

**Usage:**

```typescript
import { initializeSqliteDb, getSqliteDb, persistSqliteDb } from "@/lib/db";

// Initialize (once, usually in AuthContext)
await initializeSqliteDb();

// Get database instance
const db = getSqliteDb();

// Query data
const tunes = await db.select().from(tune).all();

// Persist changes to IndexedDB
await persistSqliteDb();
```

**Auto-Persistence:**

```typescript
import { setupAutoPersist } from "@/lib/db";

// Set up automatic persistence
const cleanup = setupAutoPersist();

// Later, cleanup when no longer needed
cleanup();
```

### `index.ts`

Convenient re-exports of both clients.

## Data Flow

### Read Operations (Offline-First)

1. UI requests data
2. **Read from SQLite WASM** (instant, always available)
3. Display data to user

### Write Operations (Sync to Cloud)

1. UI submits data
2. **Write to SQLite WASM** (instant, optimistic update)
3. **Auto-persist to IndexedDB**
4. **Queue for sync** to Supabase
5. **Background sync** pushes to PostgreSQL
6. **Supabase Realtime** broadcasts to other devices

### Initial Sync (Login)

1. User logs in via Supabase Auth
2. Fetch user's data from PostgreSQL
3. Bulk insert into SQLite WASM
4. Persist to IndexedDB
5. User can now work offline

## Type Safety

The browser uses the SQLite Drizzle schema definitions:

- **SQLite:** `drizzle/schema-sqlite.ts`

The sync worker uses a generated Postgres schema at `worker/src/generated/schema-postgres.generated.ts`.

## Schema Differences

The schemas are nearly identical, with these adaptations:

| Feature      | PostgreSQL  | SQLite WASM             |
| ------------ | ----------- | ----------------------- |
| Primary Keys | `SERIAL`    | `INTEGER AUTOINCREMENT` |
| UUIDs        | `UUID`      | `TEXT`                  |
| Timestamps   | `TIMESTAMP` | `TEXT` (ISO 8601)       |
| Booleans     | `BOOLEAN`   | `INTEGER` (0/1)         |
| Floats       | `REAL`      | `REAL`                  |

Drizzle ORM handles these differences automatically.

## Testing

### SQLite WASM Client

```typescript
import { initializeSqliteDb, getSqliteDb, clearSqliteDb } from "@/lib/db";

// Initialize
await initializeSqliteDb();

// Run queries
const db = getSqliteDb();
const result = await db.select().from(userProfile).limit(1);

// Clean up
await clearSqliteDb();
```

## Troubleshooting

### "Supabase env vars missing"

**Solution:** Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.

### "SQLite database not initialized"

**Solution:** Call `initializeSqliteDb()` before using `getSqliteDb()`:

```typescript
await initializeSqliteDb();
const db = getSqliteDb(); // Now safe to use
```

### "sql-wasm.wasm not found"

**Solution:** Ensure WASM files are in `public/sql-wasm/`:

```bash
mkdir -p public/sql-wasm
cp node_modules/sql.js/dist/sql-wasm.* public/sql-wasm/
```

### IndexedDB quota exceeded

**Solution:** Clear old data or implement selective sync:

```typescript
import { clearSqliteDb } from "@/lib/db";

// Clear local database
await clearSqliteDb();

// Re-sync from Supabase
await initializeSqliteDb();
```

## Performance Tips

1. **Use indexes** - Both PostgreSQL and SQLite support indexes for faster queries
2. **Batch operations** - Use Drizzle's batch insert/update for multiple records
3. **Selective sync** - Only sync data the user needs (e.g., last 90 days of practice records)
4. **Lazy loading** - Initialize SQLite WASM only when needed

## Migration Guide

See `_notes/schema-migration-strategy.md` for full migration details.

## References

- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [sql.js Docs](https://sql.js.org/)
- [Supabase Docs](https://supabase.com/docs)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
