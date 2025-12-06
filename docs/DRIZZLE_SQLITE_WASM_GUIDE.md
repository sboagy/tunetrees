# Drizzle ORM + SQLite WASM Integration Guide

**Status:** ✅ Complete and Functional  
**Last Updated:** November 7, 2025

## Overview

TuneTrees uses Drizzle ORM with SQLite WASM for offline-first, client-side data storage. This guide explains how the integration works and how to use it effectively.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Browser (SolidJS App)                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Interface (Components)                            │
│         ↓                                               │
│  Query Layer (src/lib/db/queries/)                      │
│         ↓                                               │
│  Drizzle ORM Client (client-sqlite.ts)                  │
│         ↓                                               │
│  SQLite WASM (sql.js)                                   │
│         ↓                                               │
│  IndexedDB (Persistence Layer)                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        ↕ Sync
┌─────────────────────────────────────────────────────────┐
│             Supabase Cloud (PostgreSQL)                 │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Schema Definition

**Location:** `drizzle/schema-sqlite.ts`

Defines all tables with strict TypeScript types:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const tune = sqliteTable("tune", {
  id: text().primaryKey().notNull(), // UUID
  title: text(),
  type: text(),
  mode: text(),
  structure: text(),
  deleted: integer().default(0).notNull(),
  lastModifiedAt: text("last_modified_at").notNull(),
  // ... more fields
});
```

Key characteristics:
- Uses TEXT for UUIDs (SQLite doesn't have native UUID type)
- Uses INTEGER for booleans (0/1)
- Uses TEXT for timestamps (ISO 8601 format)
- Includes sync columns (`sync_version`, `last_modified_at`, `device_id`)

### 2. Database Client

**Location:** `src/lib/db/client-sqlite.ts`

Core functionality:
- Initializes SQLite WASM with sql.js
- Loads migrations from `/drizzle/migrations/sqlite/*.sql`
- Persists to IndexedDB for offline access
- Manages schema versioning (current: v3)

**Usage:**

```typescript
import { initializeDb, getDb, persistDb } from "@/lib/db/client-sqlite";

// Initialize database (once, usually in AuthContext)
await initializeDb();

// Get database instance
const db = getDb();

// Query data
const tunes = await db.select().from(tune).all();

// Persist changes
await persistDb();
```

### 3. Query Layer

**Location:** `src/lib/db/queries/`

Type-safe query functions organized by entity:

- `tunes.ts` - Tune CRUD operations
- `playlists.ts` - Playlist operations
- `practice.ts` - Practice record operations
- `notes.ts` - Note operations
- `references.ts` - Reference (link) operations
- `tags.ts` - Tag operations
- `tab-state.ts` - UI state persistence

**Example:**

```typescript
import { createTune, getTuneById } from "@/lib/db/queries/tunes";

// Create a tune
const newTune = await createTune(db, {
  title: "The Banish Misfortune",
  type: "jig",
  mode: "Dmixolydian",
});

// Retrieve it
const tune = await getTuneById(db, newTune.id);
```

### 4. Migration System

**Location:** `drizzle/migrations/sqlite/`

Current migrations:
1. `0000_lowly_obadiah_stane.sql` - Initial schema
2. `0001_thin_chronomancer.sql` - Schema updates
3. `0002_nappy_roland_deschain.sql` - More updates
4. `0003_friendly_cerebro.sql` - Latest changes

Migrations are automatically applied on first load:

```typescript
// In client-sqlite.ts
const migrations = [
  "/drizzle/migrations/sqlite/0000_lowly_obadiah_stane.sql",
  "/drizzle/migrations/sqlite/0001_thin_chronomancer.sql",
  "/drizzle/migrations/sqlite/0002_nappy_roland_deschain.sql",
  "/drizzle/migrations/sqlite/0003_friendly_cerebro.sql",
];

for (const migrationPath of migrations) {
  const response = await fetch(migrationPath, { cache: "no-store" });
  const migrationSql = await response.text();
  // Apply migration...
}
```

## Data Flow

### Reading Data (Offline-First)

```
User Action → Query Layer → Drizzle → SQLite WASM → Return Data
```

No network required! All reads are instant from local database.

### Writing Data (Sync to Cloud)

```
User Action → Query Layer → Drizzle → SQLite WASM → Persist to IndexedDB
                                                   → Queue for Sync → Supabase
```

Writes are optimistic: saved locally first, then synced in background.

### Initial Sync (Login)

```
User Logs In → Fetch from Supabase → Bulk Insert to SQLite → Persist to IndexedDB
```

User's data is downloaded once, then available offline.

## Seeding Local Database

### Option 1: From Supabase (Recommended)

The app automatically syncs data from Supabase on first login:

```typescript
// In AuthContext or sync layer
await syncFromSupabase(userId);
```

### Option 2: Test Data (Development)

**Location:** `src/lib/db/seed-data.ts`

For development and testing:

```typescript
import { seedDatabase } from "@/lib/db/seed-data";

const userId = "test-user-uuid";
seedDatabase(sqliteDb, userId);
```

This creates:
- Test user profile
- Sample genres and tune types
- Sample tunes
- Test playlist
- Playlist-tune relationships

### Option 3: Migration from Legacy SQLite

**Location:** `scripts/migrate-production-to-supabase.ts`

To migrate data from the old Next.js/FastAPI app:

```bash
# Step 1: Migrate legacy data to Supabase
npm run db:local:migrate-legacy

# Step 2: App will auto-sync from Supabase to local SQLite WASM
```

See `scripts/README-MIGRATION.md` for full details.

## Testing

### Unit Tests

**Location:** `tests/db/`

Tests use in-memory SQLite with better-sqlite3:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { applyMigrations } from "@/lib/services/test-schema-loader";

let db: BetterSQLite3Database;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  applyMigrations(db); // Load production schema
});

it("should create a tune", async () => {
  const tune = await createTune(db, { title: "Test Tune" });
  expect(tune).toBeDefined();
});
```

Current test coverage:
- ✅ Tune CRUD operations (17 tests)
- ✅ Practice queue generation (32 tests)
- ⚠️ TODO: Playlist operations
- ⚠️ TODO: Note operations
- ⚠️ TODO: Practice record operations

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test tests/db/tunes.test.ts

# Watch mode
npm run test -- --watch
```

## Schema Management

### Viewing Current Schema

```bash
# Open Drizzle Studio
npx drizzle-kit studio --config=drizzle.config.sqlite.ts

# Opens at http://localhost:4983
```

### Generating New Migrations

```bash
# 1. Edit drizzle/schema-sqlite.ts
vim drizzle/schema-sqlite.ts

# 2. Generate migration
npx drizzle-kit generate --config=drizzle.config.sqlite.ts

# 3. Review generated SQL
cat drizzle/migrations/sqlite/0004_*.sql

# 4. Increment CURRENT_DB_VERSION in client-sqlite.ts
```

**Important:** After adding migrations:
1. Copy migration SQL files to `public/drizzle/migrations/sqlite/`
2. Update migrations array in `client-sqlite.ts`
3. Increment `CURRENT_DB_VERSION` to trigger re-initialization

### Schema Versioning

The client tracks schema versions to trigger migrations:

```typescript
// In client-sqlite.ts
const CURRENT_DB_VERSION = 3; // Increment on schema change

// On initialization
const storedVersion = await loadFromIndexedDB(DB_VERSION_KEY);
if (storedVersionNum !== CURRENT_DB_VERSION) {
  // Recreate database with new schema
  sqliteDb = new SQL.Database();
  applyMigrations(sqliteDb);
  saveToIndexedDB(DB_VERSION_KEY, CURRENT_DB_VERSION);
}
```

## Type Safety

Drizzle provides full TypeScript inference:

```typescript
import type { Tune } from "@/lib/db/types";

// Type inferred from schema
const tunes: Tune[] = await db.select().from(tune).all();

// TypeScript knows all fields:
tunes[0].id;    // string (UUID)
tunes[0].title; // string | null
tunes[0].deleted; // number (0 or 1)
```

### Creating New Types

```typescript
// In src/lib/db/types.ts
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

// For reading from DB
export type Tune = InferSelectModel<typeof schema.tune>;

// For inserting to DB
export type NewTune = InferInsertModel<typeof schema.tune>;

// Custom view models
export interface TuneWithDetails extends Tune {
  noteCount: number;
  lastPracticed?: string;
}
```

## Performance Tips

### 1. Batch Operations

```typescript
// ❌ Slow: Individual inserts
for (const tune of tunes) {
  await db.insert(schema.tune).values(tune);
}

// ✅ Fast: Batch insert
await db.insert(schema.tune).values(tunes);
```

### 2. Use Indexes

Schema already includes indexes for common queries:

```typescript
export const tune = sqliteTable("tune", {
  // ... columns
}, (table) => [
  index("idx_tune_title").on(table.title),
  index("idx_tune_deleted").on(table.deleted),
]);
```

### 3. Persist Strategically

```typescript
// Persist after batch of changes, not every change
await createTune(db, tune1);
await createTune(db, tune2);
await createTune(db, tune3);
await persistDb(); // Once after all changes
```

### 4. Use Prepared Statements

Drizzle automatically uses prepared statements for better performance.

## Common Patterns

### Creating with Generated ID

```typescript
import { generateId } from "@/lib/utils/uuid";

const tune = await createTune(db, {
  id: generateId(), // Generate UUID
  title: "New Tune",
});
```

### Soft Delete

```typescript
// Don't actually delete, just mark as deleted
await db
  .update(schema.tune)
  .set({ deleted: 1 })
  .where(eq(schema.tune.id, tuneId));
```

### Querying with Joins

```typescript
const playlistsWithTunes = await db.query.playlist.findMany({
  with: {
    tunes: {
      with: {
        tune: true
      }
    }
  }
});
```

### Filtering and Sorting

```typescript
import { and, eq, like, asc } from "drizzle-orm";

const tunes = await db
  .select()
  .from(schema.tune)
  .where(
    and(
      eq(schema.tune.deleted, 0),
      like(schema.tune.title, "%Jig%")
    )
  )
  .orderBy(asc(schema.tune.title));
```

## Troubleshooting

### Database Not Initialized

**Error:** `SQLite database not initialized`

**Solution:** Call `initializeDb()` before `getDb()`:

```typescript
await initializeDb();
const db = getDb(); // Now safe
```

### Foreign Key Constraint Failed

**Error:** `FOREIGN KEY constraint failed`

**Solution:** Ensure referenced records exist before creating:

```typescript
// Create user first
await db.insert(userProfile).values({ id: userId, ... });

// Then create tune with reference
await createTune(db, { 
  title: "Private Tune",
  privateFor: userId  // FK to user_profile
});
```

### Schema Version Mismatch

**Error:** Old data after schema change

**Solution:** Force reset by incrementing version:

```typescript
// In client-sqlite.ts
const CURRENT_DB_VERSION = 4; // Was 3, now 4
```

Or use URL parameter: `?reset=true`

### IndexedDB Quota Exceeded

**Error:** `QuotaExceededError`

**Solution:** Clear old data or request more storage:

```typescript
// Clear database
await clearSqliteDb();

// Request persistent storage
await navigator.storage.persist();
```

## Best Practices

### ✅ DO

- Use type-safe query functions from `queries/` directory
- Persist after batch operations, not individual changes
- Use soft deletes (`deleted = 1`) instead of hard deletes
- Test with in-memory SQLite using `better-sqlite3`
- Keep migrations in version control
- Use prepared statements (Drizzle does this automatically)

### ❌ DON'T

- Don't write raw SQL queries (use Drizzle query builder)
- Don't persist after every single write (batching is faster)
- Don't hard delete records (breaks foreign keys)
- Don't skip schema versioning when changing schema
- Don't commit `.env.local` with Supabase keys

## Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [sql.js Documentation](https://sql.js.org/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Migration Roadmap

### ✅ Completed

- Drizzle schema definition (PostgreSQL + SQLite)
- SQLite WASM client with IndexedDB persistence
- Migration system with versioning
- Type-safe query layer
- Unit tests for CRUD operations
- Seed data for development
- Migration from legacy SQLite to Supabase

### 🔄 In Progress

- Browser-based integration tests
- Performance benchmarking
- Sync conflict resolution

### 📅 Future

- Selective sync (only recent data)
- Compression for large datasets
- Background sync worker
- Offline queue with retry logic

## Support

For issues or questions:
1. Check this guide first
2. Review test files in `tests/db/` for examples
3. Consult Drizzle ORM docs
4. Check GitHub issues
