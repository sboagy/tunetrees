# Human-Readable Views

This document describes the human-readable database views created for debugging and data inspection.

## Overview

These views provide human-readable alternatives to UUID-based tables by joining with related tables to show names instead of IDs. They are particularly useful when:

- Inspecting data in database browsers (pgAdmin, DBeaver, etc.)
- Debugging data issues
- Writing quick SQL queries for analysis
- Understanding data relationships without multiple joins

## Views

### 1. view_daily_practice_queue_readable

**Purpose**: Shows daily practice queue entries with readable names instead of UUIDs.

**Key Columns**:
- `user_name`: User's name or email (COALESCE)
- `playlist_instrument`: Instrument name (e.g., "Irish Flute")
- `tune_title`: Tune title from tune or tune_override
- Plus all original `daily_practice_queue` columns

**Use Cases**:
- Debugging practice queue generation
- Verifying queue correctness for specific users/instruments
- Analyzing queue distribution across buckets

**Example Query**:
```sql
SELECT user_name, playlist_instrument, tune_title, bucket, order_index
FROM view_daily_practice_queue_readable
WHERE queue_date = CURRENT_DATE
  AND active = true
ORDER BY bucket, order_index;
```

### 2. view_transient_data_readable

**Purpose**: Shows staged/uncommitted practice data with readable identifiers.

**Key Columns**:
- `user_name`: User's name or email
- `tune_title`: Tune title from tune or tune_override
- `playlist_instrument`: Instrument name
- Plus all original `table_transient_data` columns

**Use Cases**:
- Debugging FSRS preview calculations
- Verifying transient data before commit
- Inspecting uncommitted practice sessions

**Example Query**:
```sql
SELECT user_name, tune_title, playlist_instrument, 
       purpose, quality, stability, due
FROM view_transient_data_readable
WHERE purpose = 'fsrs_preview'
ORDER BY last_modified_at DESC;
```

### 3. view_practice_record_readable

**Purpose**: Shows practice history with readable names and decoded quality/state labels.

**Key Columns**:
- `user_name`: User's name or email
- `tune_title`: Tune title from tune or tune_override
- `playlist_instrument`: Instrument name
- `quality_label`: Human-readable quality (Again/Hard/Good/Easy)
- `state_label`: Human-readable state (New/Learning/Review/Relearning)
- Plus all original `practice_record` columns

**Use Cases**:
- Analyzing practice history
- Debugging spaced repetition calculations
- Generating practice reports

**Example Query**:
```sql
SELECT user_name, tune_title, practiced, quality_label, 
       state_label, stability, interval
FROM view_practice_record_readable
WHERE user_name = 'john@example.com'
  AND practiced >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY practiced DESC;
```

## Schema Differences: SQLite vs PostgreSQL

These views exist in both SQLite WASM (client-side) and PostgreSQL (server-side), but with important differences in foreign key relationships:

### SQLite Schema
```typescript
// drizzle/schema-sqlite.ts
tableTransientData.userId → userProfile.supabaseUserId
```

### PostgreSQL Schema
```typescript
// drizzle/schema-postgres.ts
tableTransientData.userId → userProfile.id
```

The views account for these differences:
- **SQLite views** (`src/lib/db/init-views.ts`): Join on `supabase_user_id`
- **PostgreSQL views** (this migration): Join on `id`

## Migration File

**Location**: `supabase/migrations/20250112000001_create_readable_views.sql`

**Applied By**:
- `npm run db:local:reset` - Local development database
- `npm run db:ci:reset` - CI testing database
- Supabase migration system - Production database

## Performance Considerations

These views:
- **Do NOT** add indexes (use base table indexes)
- **May be slow** on large datasets due to multiple joins
- **Are intended** for debugging/inspection, not production queries
- **Should NOT** be used in application code (use base tables instead)

If you find yourself using these views in application code, consider:
1. Creating a specialized view with only needed columns
2. Adding appropriate indexes
3. Using base table queries with specific joins

## Maintenance

When adding/modifying tables referenced by these views:

1. **Update the migration**: Add new columns to view SELECT list
2. **Test locally**: Run `supabase db reset` to verify view creation
3. **Update documentation**: Add new columns to this file
4. **Consider SQLite**: Update corresponding views in `src/lib/db/init-views.ts`

## Related Files

- **PostgreSQL Views**: `supabase/migrations/20250112000001_create_readable_views.sql`
- **SQLite Views**: `src/lib/db/init-views.ts`
- **SQLite Schema**: `drizzle/schema-sqlite.ts`
- **PostgreSQL Schema**: `drizzle/schema-postgres.ts`
- **Base Migration**: `supabase/migrations/20241101000000_initial_schema.sql`
