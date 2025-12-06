# Drizzle Quick Start Guide

**TuneTrees Schema Management**  
**Status:** ✅ Everything configured and working!

---

## ✅ Current Setup

Your Drizzle configuration is **ready to use**:

- ✅ **drizzle.config.ts** - Configured for Supabase PostgreSQL
- ✅ **drizzle/schema-postgres.ts** - TypeScript schema (630 lines)
- ✅ **DATABASE_URL** - Connected to Supabase
- ✅ **drizzle-kit** - Installed and tested

**Test Result:**

```
npx drizzle-kit check
✓ Everything's fine 🐶🔥
```

**Schema Pull Result:**

```
✓ 19 tables fetched
✓ 214 columns fetched
✓ 28 foreign keys fetched
✓ 17 indexes fetched
✓ Your schema file is ready ➜ drizzle/migrations/postgres/schema.ts 🚀
```

---

## 🚀 Common Commands

### Which Database Are You Using?

TuneTrees has **two separate databases**:

| Database                  | Purpose                                    | Config File                | Command                                                    |
| ------------------------- | ------------------------------------------ | -------------------------- | ---------------------------------------------------------- |
| **PostgreSQL (Supabase)** | Cloud database (production data)           | `drizzle.config.ts`        | `npx drizzle-kit studio`                                   |
| **SQLite (Local)**        | Offline cache (will be created in Phase 3) | `drizzle.config.sqlite.ts` | `npx drizzle-kit studio --config=drizzle.config.sqlite.ts` |

**Default behavior:** All `drizzle-kit` commands use PostgreSQL (Supabase) unless you specify `--config=drizzle.config.sqlite.ts`.

---

### Database → Schema (Your Preferred Workflow)

**For PostgreSQL (Supabase):**

```bash
# Pull current Supabase schema into TypeScript
npx drizzle-kit pull

# This introspects your database and generates:
# - drizzle/migrations/postgres/schema.ts
# - drizzle/migrations/postgres/relations.ts
```

**For SQLite (Local):**

```bash
# Pull local SQLite schema into TypeScript
npx drizzle-kit pull --config=drizzle.config.sqlite.ts

# This introspects tunetrees_local.sqlite3 and generates:
# - drizzle/migrations/sqlite/schema.ts
# - drizzle/migrations/sqlite/relations.ts
```

**When to use:**

- ✅ After making schema changes in Supabase SQL editor
- ✅ After running manual SQL scripts
- ✅ To sync your TypeScript types with actual database
- ✅ When your schema file is out of date

---

### Schema → Database (Alternative Workflow)

**For PostgreSQL (Supabase):**

```bash
# 1. Edit drizzle/schema-postgres.ts

# 2. Generate migration SQL from schema changes
npx drizzle-kit generate

# 3. Push schema changes directly to database (no migration file)
npx drizzle-kit push

# 4. Review what would change (dry run)
npx drizzle-kit check
```

**For SQLite (Local):**

```bash
# 1. Edit drizzle/schema-sqlite.ts

# 2. Generate migration SQL
npx drizzle-kit generate --config=drizzle.config.sqlite.ts

# 3. Push schema changes directly
npx drizzle-kit push --config=drizzle.config.sqlite.ts

# 4. Check schema
npx drizzle-kit check --config=drizzle.config.sqlite.ts
```

**When to use:**

- ✅ When you edit `drizzle/schema-postgres.ts` directly
- ✅ For small, frequent changes (add column, change default)
- ✅ When you want auto-generated SQL

---

### Utilities

```bash
# Visual database browser (recommended!)
npx drizzle-kit studio
# ☝️ Connects to PostgreSQL (Supabase) by default
# Opens at http://localhost:4983
# Browse tables, run queries, see relationships

# Visual database browser for SQLite (local file)
npx drizzle-kit studio --config=drizzle.config.sqlite.ts
# ☝️ Connects to tunetrees_local.sqlite3
# Opens at http://localhost:4983

# Validate schema against database
npx drizzle-kit check

# View help
npx drizzle-kit --help
```

---

## 📖 Example Workflows

### Workflow 1: Add Column via SQL (Database-First)

```bash
# 1. Execute SQL in Supabase SQL editor or via psql
psql $DATABASE_URL << 'SQL'
ALTER TABLE practice_record
ADD COLUMN session_id uuid;
SQL

# 2. Pull changes into TypeScript
npx drizzle-kit pull

# 3. Check what changed
git diff drizzle/migrations/postgres/schema.ts

# 4. Commit
git add drizzle/migrations/postgres/schema.ts
git commit -m "Add session_id column to practice_record"
```

---

### Workflow 2: Add Column via TypeScript (Schema-First)

```typescript
// 1. Edit drizzle/schema-postgres.ts
export const practiceRecord = pgTable("practice_record", {
  // ... existing columns
  sessionId: uuid("session_id"), // Add this
});
```

```bash
# 2. Generate migration SQL
npx drizzle-kit generate

# 3. Review generated SQL
cat drizzle/migrations/postgres/0001_*.sql

# 4. Apply to database
npx drizzle-kit push

# 5. Commit schema + migration
git add drizzle/schema-postgres.ts drizzle/migrations/
git commit -m "Add session_id column"
```

---

### Workflow 3: Explore Database Visually

**PostgreSQL (Supabase) - Your migrated production data:**

```bash
# Start Drizzle Studio for Supabase
npx drizzle-kit studio

# Open browser to: http://localhost:4983

# ✨ You'll see:
# - 19 tables (user_profile, tune, practice_record, etc.)
# - 495 tunes from production
# - 1040 practice records
# - All your playlists and notes
```

**SQLite (Local) - Your local offline cache:**

```bash
# Start Drizzle Studio for local SQLite
npx drizzle-kit studio --config=drizzle.config.sqlite.ts

# Open browser to: http://localhost:4983

# ℹ️ Note: tunetrees_local.sqlite3 doesn't exist yet!
# This database will be created in Phase 3 when users log in
# and sync their data for offline use.
```

**Common Features:**

- Browse all tables
- View table relationships
- Run SQL queries
- Edit data (careful!)
- Export to CSV

---

## 🔧 Configuration Files

### drizzle.config.ts (Main Config)

```typescript
export default defineConfig({
  schema: "./drizzle/schema-postgres.ts",
  out: "./drizzle/migrations/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
```

**What it does:**

- Tells Drizzle where to find your schema
- Sets output directory for migrations
- Configures database connection
- Loads env vars from `.env.local`

---

### Environment Variables (.env.local)

```bash
# PostgreSQL connection string
DATABASE_URL=postgresql://postgres:password@db.pjxuonglsvouttihjven.supabase.co:5432/postgres

# Supabase config (for client SDK)
VITE_SUPABASE_URL=https://pjxuonglsvouttihjven.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Required for:**

- ✅ Drizzle Kit commands
- ✅ Migration scripts
- ✅ Supabase client connection

---

## 📁 File Structure

```
drizzle/
├── schema-postgres.ts          # PostgreSQL (Supabase) schema (630 lines)
├── schema-sqlite.ts            # SQLite WASM schema (for offline)
├── sync-columns.ts             # Shared sync column definitions
├── migrations/
│   ├── postgres/               # PostgreSQL migrations & schema
│   │   ├── schema.ts           # Auto-generated from `pull`
│   │   ├── relations.ts        # Auto-generated relationships
│   │   └── 0001_*.sql          # Migration files (from `generate`)
│   └── sqlite/                 # SQLite migrations & schema
│       ├── schema.ts           # Auto-generated from `pull --config=...`
│       └── 0001_*.sql          # Migration files
├── README_SCHEMA_CHANGE_WORKFLOW.md  # Full workflow guide
└── QUICKSTART.md               # This file!

# Configuration files (root directory)
drizzle.config.ts               # PostgreSQL (Supabase) config - DEFAULT
drizzle.config.sqlite.ts        # SQLite (local) config
```

**Key Point:** When you run `npx drizzle-kit [command]` without `--config=`, it uses `drizzle.config.ts` (PostgreSQL/Supabase).

---

## 🎯 Your Workflow (Recommended)

Based on your database-first preference:

### For Day-to-Day Changes

```bash
# 1. Make schema changes in Supabase SQL editor
#    (You're comfortable with SQL, this is fastest)

# 2. Pull changes into TypeScript
npx drizzle-kit pull

# 3. Commit
git add drizzle/migrations/postgres/schema.ts
git commit -m "Schema changes"
```

### For Small, Frequent Changes

```bash
# 1. Edit drizzle/schema-postgres.ts
#    (Add column, change default, etc.)

# 2. Push to database
npx drizzle-kit push

# 3. Commit
git add drizzle/schema-postgres.ts
git commit -m "Add column"
```

---

## 🆘 Troubleshooting

### "Connection failed" Error

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# If empty, load from .env.local
export $(cat .env.local | grep DATABASE_URL)

# Or use dotenv
npx dotenv -e .env.local -- npx drizzle-kit pull
```

---

### Schema Out of Sync

```bash
# Your database is the source of truth
# Regenerate TypeScript schema from database:
npx drizzle-kit pull

# This overwrites drizzle/migrations/postgres/schema.ts
# Review changes before committing
git diff drizzle/migrations/postgres/schema.ts
```

---

### Port Already in Use (Studio)

```bash
# Kill existing process
lsof -ti:4983 | xargs kill -9

# Or use different port
npx drizzle-kit studio --port 5555
```

---

## 📚 Full Documentation

For detailed workflows and examples:

- **Full Guide:** `drizzle/README_SCHEMA_CHANGE_WORKFLOW.md`
- **Migration Strategy:** `_notes/schema-migration-strategy.md`
- **Drizzle Docs:** https://orm.drizzle.team/docs/overview

**Database Config Files:**

- **PostgreSQL (Supabase):** `drizzle.config.ts` - DEFAULT for all commands
- **SQLite (Local):** `drizzle.config.sqlite.ts` - Use `--config=drizzle.config.sqlite.ts`

---

## 🎉 You're All Set!

Your Drizzle setup is **ready to use**. Try these commands:

```bash
# Visual database browser for Supabase (PostgreSQL)
npx drizzle-kit studio
# ☝️ See your migrated production data (495 tunes, 1040 practice records)

# Visual database browser for local SQLite
npx drizzle-kit studio --config=drizzle.config.sqlite.ts
# ☝️ This won't work yet - tunetrees_local.sqlite3 will be created in Phase 3

# Pull latest schema from Supabase
npx drizzle-kit pull

# Check configuration
npx drizzle-kit check
```

**Next Steps:**

1. Explore your migrated data with `npx drizzle-kit studio` (PostgreSQL)
2. Try making a small schema change in Supabase SQL editor
3. Use `npx drizzle-kit pull` to sync it back to TypeScript

**Remember:**

- **Default = PostgreSQL (Supabase)** - Your production cloud database
- **Add `--config=drizzle.config.sqlite.ts`** - For local SQLite database (Phase 3)

**Questions?** See `README_SCHEMA_CHANGE_WORKFLOW.md` for detailed examples!
