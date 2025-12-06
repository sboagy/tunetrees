# Drizzle Schema Change Workflow Guide

**TuneTrees Database Schema Management**  
**Author:** GitHub Copilot  
**Date:** October 5, 2025  
**Database:** Supabase PostgreSQL + SQLite WASM

---

## Overview

This guide explains how to manage database schema changes for TuneTrees using Drizzle ORM. Unlike Alembic (which you found to be a nightmare!), Drizzle supports **database-first workflows** and gives you full control over your schema.

---

## Table of Contents

1. [Database-First vs. Schema-First](#database-first-vs-schema-first)
2. [Recommended Workflow](#recommended-workflow)
3. [Common Operations](#common-operations)
4. [Drizzle Kit Commands](#drizzle-kit-commands)
5. [Team Collaboration](#team-collaboration)
6. [Troubleshooting](#troubleshooting)

---

## Database-First vs. Schema-First

### Database-First Approach ✅ (Your Preferred Style)

**When to Use:**

- Major schema changes (new tables, complex migrations)
- You want direct control over the SQL
- Working with existing database schema

**Workflow:**

```bash
# 1. Edit database schema directly (DBeaver, SQL file, Supabase SQL editor)
psql $DATABASE_URL -f my-schema-changes.sql

# 2. Pull changes into TypeScript schema
npx drizzle-kit pull:pg

# 3. Commit updated schema
git add drizzle/schema-postgres.ts
git commit -m "Add new column to practice_record"
```

**Pros:**

- ✅ You control the exact SQL (no ORM "magic")
- ✅ No migration files to maintain
- ✅ Direct visibility into database state
- ✅ Works great with DBeaver/pgAdmin
- ✅ TypeScript types automatically sync with reality

**Cons:**

- ⚠️ Manual tracking of schema changes
- ⚠️ Team members need to manually sync databases
- ⚠️ Deployment requires manual SQL execution

---

### Schema-First Approach (Drizzle's Default)

**When to Use:**

- Small, frequent changes (add column, change default)
- You want auto-generated migration files
- Team collaboration requires tracked migrations

**Workflow:**

```bash
# 1. Edit TypeScript schema
vim drizzle/schema-postgres.ts

# 2. Generate SQL migration file
npx drizzle-kit generate:pg

# 3. Review generated SQL
cat drizzle/migrations/0001_add_column.sql

# 4. Apply to database
npx drizzle-kit push:pg
```

**Pros:**

- ✅ Version-controlled migration history
- ✅ Automated deployment (run migrations)
- ✅ TypeScript-first (types always correct)
- ✅ Team members run migrations to sync

**Cons:**

- ⚠️ You don't write SQL directly (Drizzle generates it)
- ⚠️ Migration files accumulate over time
- ⚠️ Learning curve for Drizzle schema syntax

---

## Recommended Workflow

### Hybrid Approach ⭐ (Best of Both Worlds)

Use **database-first for major changes**, **schema-first for small changes**.

#### For Major Schema Changes

Examples: New tables, complex migrations, refactoring relationships

```bash
# 1. Write SQL directly (your comfort zone)
cat > schema-changes.sql << 'EOF'
-- Add new table for practice analytics
CREATE TABLE practice_analytics (
  id serial PRIMARY KEY,
  user_ref integer NOT NULL REFERENCES user_profile(id),
  date date NOT NULL,
  total_practice_time integer DEFAULT 0,
  tunes_practiced integer DEFAULT 0,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_practice_analytics_user_date
  ON practice_analytics(user_ref, date);
EOF

# Execute against Supabase
psql $DATABASE_URL -f schema-changes.sql

# OR use DBeaver to execute DDL

# 2. Pull changes into Drizzle TypeScript schema
npx drizzle-kit pull:pg

# 3. Review generated TypeScript
cat drizzle/schema-postgres.ts

# 4. Commit the updated schema
git add drizzle/schema-postgres.ts sql_scripts/schema-changes.sql
git commit -m "Add practice_analytics table"
```

#### For Small Changes

Examples: Add column, change default value, add index

```typescript
// 1. Edit drizzle/schema-postgres.ts
export const practiceRecord = pgTable("practice_record", {
  id: serial("id").primaryKey(),
  playlistRef: integer("playlist_ref").references(() => playlist.id),
  tuneRef: integer("tune_ref").references(() => tune.id),
  practiced: timestamp("practiced"),
  quality: integer("quality"),

  // ✨ Add new column
  lastReviewQuality: integer("last_review_quality"),

  // ... other columns
});
```

```bash
# 2. Generate migration SQL
npx drizzle-kit generate:pg

# This creates: drizzle/migrations/0001_add_last_review_quality.sql

# 3. Review the generated SQL
cat drizzle/migrations/0001_add_last_review_quality.sql
# ALTER TABLE practice_record ADD COLUMN last_review_quality integer;

# 4. Apply to database
npx drizzle-kit push:pg

# 5. Commit schema + migration
git add drizzle/schema-postgres.ts drizzle/migrations/0001_*.sql
git commit -m "Add last_review_quality column"
```

---

## Common Operations

### 1. Add a New Table

#### Database-First:

```sql
-- sql_scripts/add_user_settings.sql
CREATE TABLE user_settings (
  id serial PRIMARY KEY,
  user_ref integer NOT NULL REFERENCES user_profile(id),
  theme text DEFAULT 'light',
  notifications_enabled boolean DEFAULT true,
  sync_version integer DEFAULT 1,
  last_modified_at timestamp DEFAULT NOW(),
  device_id text
);

CREATE INDEX idx_user_settings_user_ref ON user_settings(user_ref);
```

```bash
psql $DATABASE_URL -f sql_scripts/add_user_settings.sql
npx drizzle-kit pull:pg
```

#### Schema-First:

```typescript
// drizzle/schema-postgres.ts
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userRef: integer("user_ref")
    .notNull()
    .references(() => userProfile.id),
  theme: text("theme").default("light"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  syncVersion: integer("sync_version").default(1),
  lastModifiedAt: timestamp("last_modified_at").defaultNow(),
  deviceId: text("device_id"),
});
```

```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

---

### 2. Add a Column

#### Database-First:

```sql
ALTER TABLE practice_record
ADD COLUMN session_id uuid REFERENCES practice_session(id);
```

```bash
psql $DATABASE_URL -c "ALTER TABLE practice_record ADD COLUMN session_id uuid;"
npx drizzle-kit pull:pg
```

#### Schema-First:

```typescript
export const practiceRecord = pgTable("practice_record", {
  // ... existing columns
  sessionId: uuid("session_id").references(() => practiceSession.id),
});
```

```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

---

### 3. Modify a Column

#### Database-First:

```sql
-- Change column type
ALTER TABLE practice_record
ALTER COLUMN quality TYPE smallint;

-- Change default value
ALTER TABLE practice_record
ALTER COLUMN quality SET DEFAULT 3;

-- Add NOT NULL constraint
ALTER TABLE practice_record
ALTER COLUMN quality SET NOT NULL;
```

```bash
psql $DATABASE_URL -f sql_scripts/modify_quality_column.sql
npx drizzle-kit pull:pg
```

#### Schema-First:

```typescript
export const practiceRecord = pgTable("practice_record", {
  // Before:
  // quality: integer("quality"),

  // After:
  quality: integer("quality").notNull().default(3),
});
```

```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

---

### 4. Add an Index

#### Database-First:

```sql
CREATE INDEX idx_practice_record_user_date
  ON practice_record(playlist_ref, practiced DESC);
```

```bash
psql $DATABASE_URL -c "CREATE INDEX idx_practice_record_user_date ON practice_record(playlist_ref, practiced DESC);"
npx drizzle-kit pull:pg
```

#### Schema-First:

```typescript
export const practiceRecord = pgTable(
  "practice_record",
  {
    // ... columns
  },
  (table) => ({
    userDateIdx: index("idx_practice_record_user_date").on(
      table.playlistRef,
      table.practiced.desc()
    ),
  })
);
```

```bash
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

---

### 5. Drop a Table/Column (Careful!)

#### Database-First:

```sql
-- Drop column
ALTER TABLE practice_record DROP COLUMN old_column;

-- Drop table
DROP TABLE IF EXISTS deprecated_table CASCADE;
```

```bash
psql $DATABASE_URL -f sql_scripts/cleanup_schema.sql
npx drizzle-kit pull:pg
```

#### Schema-First:

```typescript
// Remove from schema-postgres.ts
// export const deprecatedTable = pgTable(...); // DELETE THIS

// Remove column from table definition
export const practiceRecord = pgTable("practice_record", {
  // ... other columns
  // oldColumn: text("old_column"), // DELETE THIS
});
```

```bash
npx drizzle-kit generate:pg
# Review the DROP statements carefully!
npx drizzle-kit push:pg
```

---

## Drizzle Kit Commands

### Essential Commands

```bash
# DATABASE → SCHEMA (Introspect database, generate TypeScript)
npx drizzle-kit pull:pg

# SCHEMA → DATABASE (Apply schema changes)
npx drizzle-kit push:pg              # Direct push (no migration file)
npx drizzle-kit generate:pg          # Generate migration SQL file

# UTILITIES
npx drizzle-kit studio               # Visual database browser (localhost:4983)
npx drizzle-kit check:pg             # Validate schema against database
npx drizzle-kit drop                 # Drop all tables (DANGEROUS!)
```

### Configuration File

Drizzle reads from `drizzle.config.ts`:

```typescript
// drizzle.config.ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./drizzle/schema-postgres.ts",
  out: "./drizzle/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

---

## Team Collaboration

### Scenario: Teammate Adds a Column

**Developer A (You):**

```bash
# 1. Add column via SQL
psql $DATABASE_URL -c "ALTER TABLE tune ADD COLUMN difficulty integer;"

# 2. Pull changes into schema
npx drizzle-kit pull:pg

# 3. Commit
git add drizzle/schema-postgres.ts
git commit -m "Add difficulty column to tune"
git push
```

**Developer B (Teammate):**

```bash
# 1. Pull your changes
git pull

# 2. Apply to their local database (if using local Postgres)
npx drizzle-kit push:pg

# OR if using shared Supabase, they're already synced!
```

### Scenario: Using Migration Files

**Developer A:**

```bash
# 1. Edit schema
vim drizzle/schema-postgres.ts

# 2. Generate migration
npx drizzle-kit generate:pg
# Creates: drizzle/migrations/0001_add_difficulty.sql

# 3. Commit schema + migration
git add drizzle/schema-postgres.ts drizzle/migrations/0001_*.sql
git commit -m "Add difficulty column"
git push
```

**Developer B:**

```bash
# 1. Pull changes
git pull

# 2. Apply migrations
npx drizzle-kit push:pg
# OR manually run migration SQL
```

---

## Troubleshooting

### Schema Out of Sync with Database

**Symptom:** TypeScript types don't match actual database schema.

**Solution:**

```bash
# Regenerate schema from database (source of truth)
npx drizzle-kit pull:pg

# Review changes
git diff drizzle/schema-postgres.ts

# Commit if correct
git add drizzle/schema-postgres.ts
git commit -m "Sync schema with database"
```

---

### Migration File Conflicts

**Symptom:** Generated migration has unexpected changes.

**Solution:**

```bash
# Check what Drizzle thinks changed
npx drizzle-kit generate:pg

# Review the migration file
cat drizzle/migrations/0001_*.sql

# If incorrect, either:
# Option 1: Edit the migration file manually
vim drizzle/migrations/0001_*.sql

# Option 2: Delete migration, fix schema, regenerate
rm drizzle/migrations/0001_*.sql
vim drizzle/schema-postgres.ts
npx drizzle-kit generate:pg
```

---

### Database Connection Issues

**Symptom:** `Error: Connection failed`

**Solution:**

```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# If empty, load from .env.local
export $(cat .env.local | grep DATABASE_URL)

# Or use dotenv
npx dotenv -e .env.local -- npx drizzle-kit pull:pg
```

---

### Drizzle Studio Won't Start

**Symptom:** `Error: Port 4983 already in use`

**Solution:**

```bash
# Kill existing process
lsof -ti:4983 | xargs kill -9

# Or use a different port
npx drizzle-kit studio --port 5555
```

---

## Best Practices

### DO ✅

- **Keep manual SQL in `sql_scripts/`** for reference and rollback
- **Use `drizzle-kit pull:pg`** after manual schema changes
- **Run `drizzle-kit studio`** to visually inspect schema
- **Commit migration files** if using schema-first workflow
- **Test migrations** on local database before production
- **Use transactions** for multi-step schema changes

### DON'T ❌

- **Don't mix approaches** in the same change (pick database-first OR schema-first)
- **Don't skip `drizzle-kit pull`** after manual SQL (types will be wrong!)
- **Don't edit generated migration files** without understanding SQL
- **Don't run `drizzle-kit push`** on production without testing first
- **Don't drop tables** without backups

---

## Quick Reference

### Database-First Cheat Sheet

```bash
# 1. Edit database
psql $DATABASE_URL -f my-changes.sql

# 2. Sync TypeScript
npx drizzle-kit pull:pg

# 3. Commit
git add drizzle/schema-postgres.ts sql_scripts/my-changes.sql
git commit -m "Schema change description"
```

### Schema-First Cheat Sheet

```bash
# 1. Edit TypeScript
vim drizzle/schema-postgres.ts

# 2. Generate migration
npx drizzle-kit generate:pg

# 3. Apply
npx drizzle-kit push:pg

# 4. Commit
git add drizzle/schema-postgres.ts drizzle/migrations/
git commit -m "Schema change description"
```

---

## Why Drizzle > Alembic

Based on your experience with Alembic being a nightmare:

| Pain Point              | Alembic                      | Drizzle                           |
| ----------------------- | ---------------------------- | --------------------------------- |
| **Auto-detect changes** | ❌ Unreliable, misses things | ✅ Accurate SQL diff              |
| **Migration state**     | ❌ Gets out of sync          | ✅ No state to manage             |
| **Manual SQL**          | ⚠️ Awkward                   | ✅ Write SQL directly, then pull  |
| **Type safety**         | ❌ Separate from schema      | ✅ Schema IS the types            |
| **Database-first**      | ❌ Not supported             | ✅ `drizzle-kit pull:pg`          |
| **Rollback**            | ✅ Supported                 | ⚠️ Manual (write down migrations) |

**Key Advantage:** `drizzle-kit pull:pg` lets you **regenerate schema from database** anytime. If you get confused, just pull from the database (source of truth) and start fresh. No migration state hell!

---

## Example: Complete Schema Change

Let's add a `practice_session` table to track practice sessions:

### Step 1: Write SQL (Database-First)

```sql
-- sql_scripts/add_practice_session.sql
CREATE TABLE practice_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ref integer NOT NULL REFERENCES user_profile(id),
  playlist_ref integer REFERENCES playlist(id),
  started_at timestamp NOT NULL DEFAULT NOW(),
  ended_at timestamp,
  total_tunes integer DEFAULT 0,
  total_reps integer DEFAULT 0,
  notes text,

  -- Sync columns
  sync_version integer DEFAULT 1,
  last_modified_at timestamp DEFAULT NOW(),
  device_id text
);

CREATE INDEX idx_practice_session_user
  ON practice_session(user_ref, started_at DESC);

-- Link practice records to sessions
ALTER TABLE practice_record
ADD COLUMN session_id uuid REFERENCES practice_session(id);
```

### Step 2: Execute SQL

```bash
psql $DATABASE_URL -f sql_scripts/add_practice_session.sql
```

### Step 3: Pull into TypeScript

```bash
npx drizzle-kit pull:pg
```

### Step 4: Review Generated Schema

```typescript
// drizzle/schema-postgres.ts (auto-generated)
export const practiceSession = pgTable(
  "practice_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userRef: integer("user_ref")
      .notNull()
      .references(() => userProfile.id),
    playlistRef: integer("playlist_ref").references(() => playlist.id),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
    totalTunes: integer("total_tunes").default(0),
    totalReps: integer("total_reps").default(0),
    notes: text("notes"),
    syncVersion: integer("sync_version").default(1),
    lastModifiedAt: timestamp("last_modified_at").defaultNow(),
    deviceId: text("device_id"),
  },
  (table) => ({
    userIdx: index("idx_practice_session_user").on(
      table.userRef,
      table.startedAt.desc()
    ),
  })
);

export const practiceRecord = pgTable("practice_record", {
  // ... existing columns
  sessionId: uuid("session_id").references(() => practiceSession.id),
});
```

### Step 5: Commit

```bash
git add drizzle/schema-postgres.ts sql_scripts/add_practice_session.sql
git commit -m "Add practice_session table to track practice sessions"
git push
```

**Done!** TypeScript types are now in sync with database, and you have SQL on file for reference.

---

## Next Steps

1. **Set up `drizzle.config.ts`** (if not already done)
2. **Run `npx drizzle-kit pull:pg`** to get current Supabase schema
3. **Try `npx drizzle-kit studio`** to explore your database visually
4. **Make your first schema change** using the workflow above

---

## Resources

- **Drizzle Documentation:** https://orm.drizzle.team/docs/overview
- **Drizzle Kit Commands:** https://orm.drizzle.team/kit-docs/overview
- **PostgreSQL → Drizzle Mapping:** https://orm.drizzle.team/docs/column-types/pg
- **TuneTrees Schema Migration Plan:** `_notes/schema-migration-strategy.md`

---

**Questions?** This workflow is flexible—adapt it to your style!
