# Schema Change Workflow (Supabase Postgres + SQLite)

TuneTrees does **not** manage the Supabase Postgres schema via a root Drizzle schema/config.

**Source of truth:** SQL migrations in `supabase/migrations/`.

Drizzle is used for:

- SQLite (offline browser DB) runtime queries
- Local SQLite tooling (Drizzle Kit) via `drizzle.config.sqlite.ts`

Codegen derives TypeScript schema artifacts by introspecting Postgres catalogs.

---

## Recommended Workflow

### 1) Change Postgres schema

- Add/edit migrations under `supabase/migrations/`.
- If you add/modify views, keep the canonical view DDL in migrations.

### 2) Apply locally

```bash
supabase db reset
```

### 3) Regenerate schema artifacts

```bash
npm run codegen:schema
```

This generates/updates:

- `drizzle/schema-sqlite.generated.ts`
- `worker/src/generated/schema-postgres.generated.ts`
- `shared/generated/sync/table-meta.generated.ts`
- `worker/src/generated/worker-config.generated.ts`

### 4) Drift check (CI-friendly)

```bash
npm run codegen:schema:check
```

---

## SQLite Notes

- The browser reads from SQLite WASM (sql.js).
- The SQLite schema used by the app is primarily generated via `npm run codegen:schema`.
- Drizzle Kit can be used for SQLite-only debugging via `drizzle.config.sqlite.ts`.

---

## Troubleshooting

### Codegen connects to the wrong database

`npm run codegen:schema` defaults to local Supabase (`127.0.0.1:54322`).

To force a URL explicitly:

```bash
OOSYNC_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run codegen:schema
```

---

## See Also

- `drizzle/QUICKSTART.md`
- `docs/development/database.md`
- `oosync/src/codegen-schema.ts`
