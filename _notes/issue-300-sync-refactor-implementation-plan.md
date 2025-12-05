# Issue #300: Sync Refactor Implementation Plan

**Status:** Implementation Ready  
**Issue:** https://github.com/sboagy/tunetrees/issues/300  
**Owner:** sboagy • Collaborator: GitHub Copilot  
**Created:** 2025-11-30  
**Branch:** TBD (suggest: `feat/sync-refactor-triggers`)

---

## Executive Summary

This plan addresses the "Sync unreliable" issue by:
1. **SQL Triggers** for automatic sync queue population (eliminating manual queueSync calls)
2. **Centralized Table Metadata Registry** (single source of truth for keys, timestamps, casing)
3. **Unified Casing Utilities** (eliminates duplicated snake_case/camelCase conversions)
4. **Per-Table Adapters** (declarative, testable transform logic)

The trigger-based approach is the key architectural improvement—it decouples application code from sync concerns entirely.

---

## Problem Statement

### Current Pain Points

1. **Manual queueSync Calls** - Every insert/update/delete in application code must manually call `queueSync()`. Easy to forget, causes sync drift.

2. **Duplicated Casing Logic** - `practice-queue.ts` (lines 412-420) manually converts to snake_case before queueSync, duplicating logic in `engine.ts`.

3. **Scattered Key Metadata** - `COMPOSITE_KEY_TABLES`, `PRIMARY_KEY_COLUMNS`, and switch blocks in `syncTableDown` all hold partial key knowledge.

4. **Special-Case Proliferation** - Datetime normalization for `daily_practice_queue` (space vs `T`) is handled ad-hoc.

5. **Testability** - Transform functions are methods on `SyncEngine` class, not pure functions. Hard to unit test without full sync infrastructure.

### Files Affected

| File | Issue |
|------|-------|
| `src/lib/sync/engine.ts` | Transform methods, key maps, switch blocks |
| `src/lib/sync/queue.ts` | SyncQueue table operations |
| `src/lib/services/practice-queue.ts` | Manual snake_case conversion (lines 412-420) |
| `drizzle/schema-sqlite.ts` | Will need `sync_outbox` table |

---

## Architecture Decision: SQL Triggers

### Why Triggers?

| Approach | Pros | Cons |
|----------|------|------|
| **Manual queueSync calls** | Fine-grained control | Easy to forget, code duplication |
| **JavaScript wrapper functions** | Can add logging | Still requires discipline |
| **SQL Triggers** | ✅ Automatic, transactional, impossible to bypass | Slight SQLite overhead |
| **update_hook API** | Low-level access | Crosses WASM/JS boundary on every write |

**Decision:** SQL Triggers are the best fit because:
- Transactionally safe (trigger rollback if main insert fails)
- Works regardless of where/how SQL is executed
- No JavaScript code changes needed for future tables
- SQLite WASM fully supports triggers

### Trigger Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Code                            │
│   db.insert(tune).values({...})   // Just write normally        │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SQLite WASM                                 │
│  ┌──────────────┐    ┌──────────────────┐                       │
│  │  tune table  │───▶│  AFTER INSERT    │                       │
│  │              │    │  TRIGGER         │                       │
│  └──────────────┘    └────────┬─────────┘                       │
│                               │                                 │
│                               ▼                                 │
│                      ┌───────────────────┐                      │
│                      │   sync_outbox     │                      │
│                      │   (queue table)   │                      │
│                      └───────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Sync Worker (JS)                            │
│   - Polls sync_outbox periodically                              │
│   - Transforms via adapters (camelCase → snake_case)            │
│   - Pushes to Supabase                                          │
│   - Deletes processed items from outbox                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phased Implementation Plan

### Phase 0: Foundation (No Behavior Change)

**Goal:** Create infrastructure without changing existing sync behavior.

#### Phase 0.1: Casing Utilities

Create `src/lib/sync/casing.ts`:

```typescript
/**
 * Convert object keys from snake_case to camelCase
 */
export function camelizeKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function snakifyKeys<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// Precomputed maps for hot path optimization (Phase 7)
export const TUNE_KEYS_MAP: Record<string, string> = {
  id: 'id',
  privateFor: 'private_for',
  title: 'title',
  // ... etc
};
```

**Tests:** `tests/lib/sync/casing.test.ts`

- Round-trip identity: `snakifyKeys(camelizeKeys(obj))` ≈ `obj`
- Edge cases: empty objects, nested objects (if supported), special characters

#### Phase 0.2: Table Metadata Registry

Create `src/lib/sync/table-meta.ts`:

```typescript
export interface TableMeta {
  /** Primary key column(s) in snake_case */
  primaryKey: string | string[];
  /** Unique constraint columns for UPSERT (snake_case), null if none */
  uniqueKeys: string[] | null;
  /** Timestamp columns to normalize (snake_case) */
  timestamps: string[];
  /** Boolean columns that need SQLite integer ↔ Postgres boolean conversion */
  booleanColumns: string[];
  /** Whether this table supports incremental sync (has last_modified_at) */
  supportsIncremental: boolean;
  /** Optional per-table normalization (e.g., datetime format) */
  normalize?: (row: Record<string, unknown>) => Record<string, unknown>;
}

export const TABLE_REGISTRY: Record<string, TableMeta> = {
  tune: {
    primaryKey: 'id',
    uniqueKeys: null,
    timestamps: ['last_modified_at'],
    booleanColumns: ['deleted'],
    supportsIncremental: true,
  },
  practice_record: {
    primaryKey: 'id',
    uniqueKeys: ['tune_ref', 'playlist_ref', 'practiced'],
    timestamps: ['practiced', 'last_modified_at'],
    booleanColumns: ['deleted'],
    supportsIncremental: true,
  },
  daily_practice_queue: {
    primaryKey: 'id',
    uniqueKeys: ['user_ref', 'playlist_ref', 'window_start_utc', 'tune_ref'],
    timestamps: ['window_start_utc', 'window_end_utc', 'generated_at', 'completed_at', 'last_modified_at'],
    booleanColumns: ['active'],
    supportsIncremental: true,
    normalize: normalizeDailyPracticeQueue,
  },
  playlist: {
    primaryKey: 'playlist_id',  // Non-standard PK name
    uniqueKeys: null,
    timestamps: ['last_modified_at'],
    booleanColumns: ['deleted'],
    supportsIncremental: true,
  },
  table_transient_data: {
    primaryKey: ['user_id', 'tune_id', 'playlist_id'],  // Composite PK
    uniqueKeys: ['user_id', 'tune_id', 'playlist_id'],
    timestamps: ['last_modified_at'],
    booleanColumns: [],
    supportsIncremental: true,
  },
  // ... all other tables
};

/** Normalize daily_practice_queue datetime formats (space ↔ T separator) */
function normalizeDailyPracticeQueue(row: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...row };
  const datetimeFields = ['window_start_utc', 'window_end_utc', 'generated_at', 'completed_at'];
  for (const field of datetimeFields) {
    if (typeof normalized[field] === 'string') {
      // Normalize to ISO format (with T)
      normalized[field] = (normalized[field] as string).replace(' ', 'T');
    }
  }
  return normalized;
}

// Helper functions
export function getPrimaryKey(table: string): string | string[] {
  return TABLE_REGISTRY[table]?.primaryKey ?? 'id';
}

export function getUniqueKeys(table: string): string[] | null {
  return TABLE_REGISTRY[table]?.uniqueKeys ?? null;
}
```

**Tests:** `tests/lib/sync/table-meta.test.ts`

- All tables in `SyncableTable` type are present in registry
- Composite key tables have correct uniqueKeys
- Non-standard PK tables (playlist) are correctly mapped

---

### Phase 1: Sync Outbox Table + Triggers

**Goal:** Create the trigger-based outbox that replaces manual `queueSync` calls.

#### Phase 1.1: Create Outbox Schema

Add to `drizzle/schema-sqlite.ts`:

```typescript
/**
 * Sync Outbox Table (Local Outbox Pattern)
 * 
 * Populated automatically by SQL triggers on data tables.
 * Processed by sync worker to push changes to Supabase.
 */
export const syncOutbox = sqliteTable('sync_outbox', {
  id: text().primaryKey().notNull(),  // UUIDv7 for time-ordering
  tableName: text('table_name').notNull(),
  rowId: text('row_id').notNull(),  // PK of the modified row
  operation: text().notNull(),  // 'INSERT', 'UPDATE', 'DELETE'
  status: text().default('PENDING').notNull(),  // 'PENDING', 'SYNCING', 'FAILED'
  changedAt: integer('changed_at').notNull(),  // unixepoch('subsec')
  attempts: integer().default(0).notNull(),
  lastError: text('last_error'),
}, (table) => [
  index('idx_sync_outbox_status').on(table.status),
  index('idx_sync_outbox_changed_at').on(table.changedAt),
]);
```

#### Phase 1.2: Create Triggers

Create `sql_scripts/sync_triggers.sql`:

```sql
-- Sync Outbox Triggers
-- These triggers automatically populate sync_outbox when data tables change.
-- No application code changes needed to enable sync for new tables.

-- Helper: Generate pseudo-UUIDv7 (time-sortable)
-- Note: SQLite doesn't have native UUID support, so we use hex(randomblob(16))
-- For true UUIDv7, we'd need a UDF. This is close enough for ordering.

-- ============ TUNE TABLE ============

CREATE TRIGGER IF NOT EXISTS trg_tune_insert
AFTER INSERT ON tune
BEGIN
  INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
  VALUES (
    lower(hex(randomblob(16))),
    'tune',
    NEW.id,
    'INSERT',
    unixepoch('subsec') * 1000
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_tune_update
AFTER UPDATE ON tune
BEGIN
  INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
  VALUES (
    lower(hex(randomblob(16))),
    'tune',
    NEW.id,
    'UPDATE',
    unixepoch('subsec') * 1000
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_tune_delete
AFTER DELETE ON tune
BEGIN
  INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
  VALUES (
    lower(hex(randomblob(16))),
    'tune',
    OLD.id,
    'DELETE',
    unixepoch('subsec') * 1000
  );
END;

-- ============ PRACTICE_RECORD TABLE ============

CREATE TRIGGER IF NOT EXISTS trg_practice_record_insert
AFTER INSERT ON practice_record
BEGIN
  INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
  VALUES (
    lower(hex(randomblob(16))),
    'practice_record',
    NEW.id,
    'INSERT',
    unixepoch('subsec') * 1000
  );
END;

-- ... (similar triggers for UPDATE/DELETE)

-- ============ DAILY_PRACTICE_QUEUE TABLE ============

CREATE TRIGGER IF NOT EXISTS trg_daily_practice_queue_insert
AFTER INSERT ON daily_practice_queue
BEGIN
  INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
  VALUES (
    lower(hex(randomblob(16))),
    'daily_practice_queue',
    NEW.id,
    'INSERT',
    unixepoch('subsec') * 1000
  );
END;

-- ... (triggers for all syncable tables)
```

#### Phase 1.3: Trigger Installation Script

Create `src/lib/db/install-triggers.ts`:

```typescript
import type { SqliteDatabase } from './client-sqlite';
import { SYNCABLE_TABLES } from '../sync/table-meta';

/**
 * Install sync triggers on all syncable tables.
 * Safe to call multiple times (uses CREATE TRIGGER IF NOT EXISTS).
 */
export async function installSyncTriggers(db: SqliteDatabase): Promise<void> {
  for (const tableName of SYNCABLE_TABLES) {
    const pkColumn = getPrimaryKeyColumn(tableName);
    
    // INSERT trigger
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS trg_${sql.raw(tableName)}_insert
      AFTER INSERT ON ${sql.raw(tableName)}
      BEGIN
        INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
        VALUES (
          lower(hex(randomblob(16))),
          ${tableName},
          NEW.${sql.raw(pkColumn)},
          'INSERT',
          unixepoch('subsec') * 1000
        );
      END
    `);
    
    // UPDATE trigger
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS trg_${sql.raw(tableName)}_update
      AFTER UPDATE ON ${sql.raw(tableName)}
      BEGIN
        INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
        VALUES (
          lower(hex(randomblob(16))),
          ${tableName},
          NEW.${sql.raw(pkColumn)},
          'UPDATE',
          unixepoch('subsec') * 1000
        );
      END
    `);
    
    // DELETE trigger
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS trg_${sql.raw(tableName)}_delete
      AFTER DELETE ON ${sql.raw(tableName)}
      BEGIN
        INSERT INTO sync_outbox (id, table_name, row_id, operation, changed_at)
        VALUES (
          lower(hex(randomblob(16))),
          ${tableName},
          OLD.${sql.raw(pkColumn)},
          'DELETE',
          unixepoch('subsec') * 1000
        );
      END
    `);
  }
}
```

**Note on Composite Keys:** For tables with composite PKs (like `table_transient_data`), we store a JSON representation of the composite key in `row_id`, or we add additional columns. Decision: Store JSON.

---

### Phase 2: Table Adapters

**Goal:** Create per-table adapters that encapsulate transform logic.

#### Phase 2.1: Adapter Interface

Create `src/lib/sync/adapters.ts`:

```typescript
import { camelizeKeys, snakifyKeys } from './casing';
import { TABLE_REGISTRY, type TableMeta } from './table-meta';

export interface TableAdapter {
  /** Transform Supabase row (snake_case) → local Drizzle row (camelCase) */
  toLocal(remoteRow: Record<string, unknown>): Record<string, unknown>;
  /** Transform local Drizzle row (camelCase) → Supabase row (snake_case) */
  toRemote(localRow: Record<string, unknown>): Record<string, unknown>;
  /** Conflict keys for UPSERT operations (snake_case) */
  conflictKeys: string[] | null;
  /** Primary key column(s) (snake_case) */
  primaryKey: string | string[];
}

/**
 * Get adapter for a table.
 * Uses default behavior from casing utils + table-specific normalization.
 */
export function getAdapter(tableName: string): TableAdapter {
  const meta = TABLE_REGISTRY[tableName];
  if (!meta) {
    throw new Error(`No metadata registered for table: ${tableName}`);
  }
  
  return {
    toLocal(remoteRow) {
      let row = camelizeKeys(remoteRow);
      // Apply boolean conversions
      for (const col of meta.booleanColumns) {
        const camelCol = col.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
        if (typeof row[camelCol] === 'boolean') {
          row[camelCol] = row[camelCol] ? 1 : 0;
        }
      }
      return row;
    },
    
    toRemote(localRow) {
      let row = snakifyKeys(localRow);
      // Apply table-specific normalization
      if (meta.normalize) {
        row = meta.normalize(row);
      }
      return row;
    },
    
    conflictKeys: meta.uniqueKeys,
    primaryKey: meta.primaryKey,
  };
}
```

**Tests:** `tests/lib/sync/adapters.test.ts`

- Round-trip for each table type
- Boolean conversion (SQLite integer ↔ Postgres boolean)
- Datetime normalization for `daily_practice_queue`

---

### Phase 3: Integrate Adapters into SyncEngine

**Goal:** Replace inline transform methods with adapter calls.

#### Phase 3.1: syncUp Integration

In `engine.ts` `processQueueItem`:

```typescript
// Before:
const remoteData = this.transformLocalToRemote(recordData);

// After:
const adapter = getAdapter(tableName);
const remoteData = adapter.toRemote(recordData);
const conflictKeys = adapter.conflictKeys;
```

#### Phase 3.2: syncDown Integration

In `engine.ts` `syncTableDown`:

```typescript
// Before:
const transformed = this.transformRemoteToLocal(record);

// After:
const adapter = getAdapter(tableName);
const transformed = adapter.toLocal(record);
```

#### Phase 3.3: Remove Duplicate Methods

- Delete `transformRemoteToLocal` method
- Delete `transformLocalToRemote` method
- Delete `COMPOSITE_KEY_TABLES` constant
- Delete `PRIMARY_KEY_COLUMNS` constant
- Delete `getPrimaryKeyColumn` function (use `TABLE_REGISTRY`)
- Delete `getCompositeKeyFields` function (use `TABLE_REGISTRY`)

---

### Phase 4: Migrate to Trigger-Based Queue

**Goal:** Switch from manual `queueSync` calls to trigger-based outbox.

#### Phase 4.1: Update Sync Worker

Modify `engine.ts` `syncUp` to read from `sync_outbox` instead of `sync_queue`:

```typescript
async syncUp(): Promise<SyncResult> {
  // Get pending items from trigger-populated outbox
  const pending = await db.select()
    .from(syncOutbox)
    .where(eq(syncOutbox.status, 'PENDING'))
    .orderBy(syncOutbox.changedAt)
    .limit(this.config.batchSize);
  
  for (const item of pending) {
    // Mark as syncing
    await db.update(syncOutbox)
      .set({ status: 'SYNCING' })
      .where(eq(syncOutbox.id, item.id));
    
    try {
      // Fetch full row data for the sync
      const adapter = getAdapter(item.tableName);
      const localTable = this.getLocalTable(item.tableName);
      const pk = adapter.primaryKey;
      
      // Handle composite keys
      const rowId = item.rowId.startsWith('{') ? JSON.parse(item.rowId) : item.rowId;
      
      if (item.operation === 'DELETE') {
        // For deletes, we don't need the full row
        await this.processDelete(item.tableName, rowId, adapter);
      } else {
        // For insert/update, fetch current row
        const row = await this.fetchLocalRow(item.tableName, rowId);
        if (row) {
          const remoteData = adapter.toRemote(row);
          await this.pushToSupabase(item.tableName, item.operation, remoteData, adapter);
        }
      }
      
      // Success - remove from outbox
      await db.delete(syncOutbox).where(eq(syncOutbox.id, item.id));
    } catch (error) {
      // Mark as failed (will retry later)
      await db.update(syncOutbox)
        .set({ 
          status: 'PENDING',  // Back to pending for retry
          attempts: sql`attempts + 1`,
          lastError: error.message,
        })
        .where(eq(syncOutbox.id, item.id));
    }
  }
}
```

#### Phase 4.2: Remove Manual queueSync Calls

Search and remove all manual `queueSync` calls from:

- `src/lib/services/practice-queue.ts` (lines 412-427)
- Any other service files calling `queueSync`

The triggers now handle this automatically.

#### Phase 4.3: Deprecate Old sync_queue Table

- Rename `sync_queue` to `sync_queue_legacy`
- Add migration to move any pending items to `sync_outbox`
- Schedule removal in future version

---

### Phase 5: Testing & Validation

**Goal:** Comprehensive test coverage for new sync architecture.

#### Phase 5.1: Unit Tests

| Test File | Coverage |
|-----------|----------|
| `tests/lib/sync/casing.test.ts` | Casing utilities |
| `tests/lib/sync/table-meta.test.ts` | Registry completeness |
| `tests/lib/sync/adapters.test.ts` | Per-table transforms |
| `tests/lib/sync/triggers.test.ts` | Trigger installation |

#### Phase 5.2: Integration Tests

| Test File | Coverage |
|-----------|----------|
| `tests/lib/sync/outbox-flow.test.ts` | Insert → Outbox → Supabase round-trip |
| `tests/lib/sync/composite-keys.test.ts` | Tables with composite PKs |
| `tests/lib/sync/datetime-normalization.test.ts` | daily_practice_queue edge cases |

#### Phase 5.3: E2E Tests

Keep existing Playwright tests green:
- Practice queue generation
- Tune editing
- Playlist operations
- Note CRUD

---

### Phase 6: Documentation & Cleanup

**Goal:** Update docs, remove dead code.

#### Phase 6.1: Documentation Updates

- Update `docs/DB_AND_REPLICATION_ARCHITECTURE.md`
- Create `docs/SYNC_TRIGGERS.md` explaining the outbox pattern
- Add "How to Add a New Syncable Table" checklist

#### Phase 6.2: Code Cleanup

- Remove old `sync_queue` table and related code
- Remove deprecated transform methods
- Remove manual snake_case loops in service files

---

## Decisions (Resolved)

### Decision 1: Composite Key Storage in Outbox

**Context:** Tables like `table_transient_data` have composite primary keys `(user_id, tune_id, playlist_id)`. When a trigger fires, we need to store enough info in `sync_outbox.row_id` to identify the row for later sync processing.

**Decision:** Store as JSON string: `{"user_id": "...", "tune_id": "...", "playlist_id": "..."}`

For simple PK tables, just store the ID directly: `"abc-123-uuid"`

### Decision 2: Outbox ID Generation

**Context:** SQLite triggers cannot call JavaScript functions directly. The outbox needs a unique ID.

**Decision:** Use `lower(hex(randomblob(16)))` in triggers for the outbox ID. This is unique (not time-sorted, but that's fine—we order by `changed_at` timestamp instead). The actual data rows already use proper UUIDv7 from `generateId()`.

### Decision 3: Trigger Scope

**Decision:** Install triggers on **ALL** syncable tables, including reference data:
- `genre`
- `tune_type`  
- `genre_tune_type`

Rationale: These will be editable via playlist editor (now or future). Triggers ensure any local edits sync properly.

### Decision 4: Zod Validation

**Decision:** Tests/CI only. No production overhead.

The table metadata registry (`table-meta.ts`) is the single source of truth for structure. Zod is optional validation in tests to catch drift—not a new layer to maintain.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Triggers add SQLite overhead | Benchmark; triggers are fast for single-row ops |
| Migration breaks existing queue | Feature flag; keep old sync path until stable |
| Composite key JSON parsing fails | Validate JSON structure in tests |
| Missing trigger for new table | CI check: ensure all SyncableTable entries have triggers |

---

## Success Criteria

1. ✅ Zero manual `queueSync` calls in application code
2. ✅ All sync transforms go through adapter layer
3. ✅ Single source of truth for table metadata
4. ✅ All existing E2E tests pass
5. ✅ No performance regression (< 5% sync time increase)
6. ✅ "Add new table" process is documented and requires < 10 lines of code

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 0 (Foundation) | 1-2 days | None |
| Phase 1 (Triggers) | 2-3 days | Phase 0 |
| Phase 2 (Adapters) | 1-2 days | Phase 0 |
| Phase 3 (Integration) | 2-3 days | Phase 1, 2 |
| Phase 4 (Migration) | 2-3 days | Phase 3 |
| Phase 5 (Testing) | 2-3 days | Phase 4 |
| Phase 6 (Cleanup) | 1 day | Phase 5 |

**Total:** ~12-17 days of focused work

---

## Appendix A: Full Table Registry (All Get Triggers)

```typescript
// All syncable tables - ALL get triggers installed
const SYNCABLE_TABLES = [
  // Reference data (editable via playlist editor)
  'genre',
  'tune_type',
  'genre_tune_type',
  
  // User data
  'tune',
  'playlist',
  'playlist_tune',
  'note',
  'reference',
  'tag',
  'practice_record',
  'daily_practice_queue',
  'table_transient_data',
  'tune_override',
  'user_profile',
  'instrument',
  'table_state',
  'tab_group_main_state',
  'prefs_scheduling_options',
  'prefs_spaced_repetition',
];

// Tables with composite keys (need JSON row_id in outbox)
const COMPOSITE_KEY_TABLES = [
  'table_transient_data',   // (user_id, tune_id, playlist_id)
  'playlist_tune',          // (playlist_ref, tune_ref)
  'genre_tune_type',        // (genre_id, tune_type_id)
  'prefs_spaced_repetition', // (user_id, alg_type)
  'table_state',            // (user_id, screen_size, purpose, playlist_id)
];

// Tables with non-standard primary key column names
const NON_STANDARD_PK = {
  'playlist': 'playlist_id',  // Not 'id'
};
```

---

## Appendix B: Example Trigger SQL (Complete)

See `sql_scripts/sync_triggers.sql` for full implementation (to be created in Phase 1).

---

**Next Steps:**
1. Review this plan and provide feedback
2. Create branch `feat/sync-refactor-triggers`
3. Begin Phase 0 implementation
