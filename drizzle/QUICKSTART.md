# Drizzle Quick Start Guide

TuneTrees uses Drizzle **for SQLite (offline browser DB) and local SQLite tooling**.

PostgreSQL (Supabase) schema is managed via **SQL migrations** in `supabase/migrations/`, and then **codegen** produces the TypeScript schema artifacts used by the app/worker.

---

## What’s the Source of Truth?

- **PostgreSQL (Supabase) schema:** `supabase/migrations/`
- **Generated artifacts (do not hand-edit):**
  - `drizzle/schema-sqlite.generated.ts`
  - `worker/src/generated/schema-postgres.generated.ts`
  - `shared/generated/sync/table-meta.generated.ts`
  - `worker/src/generated/worker-config.generated.ts`

---

## Common Commands

### Postgres schema changes (recommended workflow)

```bash
# 1) Create/edit SQL migrations
#    supabase/migrations/....sql

# 2) Apply to local Supabase (updates local Postgres)
supabase db reset

# 3) Regenerate TypeScript schema artifacts from Postgres catalogs
npm run codegen:schema

# 4) (Optional) Drift check without rewriting outputs
npm run codegen:schema:check
```

### SQLite tooling (Drizzle Kit)

TuneTrees ships **only** the SQLite Drizzle Kit config:

- Config: `drizzle.config.sqlite.ts`

```bash
# Open Drizzle Studio for local SQLite file
npx drizzle-kit studio --config=drizzle.config.sqlite.ts

# Sanity check config + schema
npx drizzle-kit check --config=drizzle.config.sqlite.ts
```

Notes:

- These commands are for **local SQLite** workflows and debugging.
- The SQLite schema used by the app is primarily generated via `npm run codegen:schema`.

---

## Files You’ll Touch Most

- `supabase/migrations/` (Postgres schema source of truth)
- `oosync/src/codegen-schema.ts` (schema codegen)
- `drizzle/schema-sqlite.ts` (SQLite schema wrapper)
- `drizzle/schema-sqlite.generated.ts` (generated)
- `drizzle.config.sqlite.ts` (SQLite Drizzle Kit tooling)

For the full workflow, see `drizzle/README_SCHEMA_CHANGE_WORKFLOW.md`.
