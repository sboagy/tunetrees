# oosync/AGENTS Instructions

Scope: code under `oosync/**` (library + worker implementation) and the **contract** that is generated/consumed by app + worker.

This file inherits global policies from `AGENTS.md`. Do not duplicate global rules here; treat this file as **oosync-specific constraints**.

## What “oosync” is

`oosync` = **Opinionated Offline Sync**:

- Opinionated PWA sync library for (Supabase, Drizzle, SQLite, Cloudflare Worker)
- Source of truth is the **local Postgres database** (typically a local Supabase instance during dev)
- Provides a code generator that produces:
  - SQLite WASM + Drizzle schemas
  - shared sync metadata infrastructure (table registry/meta)
  - worker-side schema/config artifacts
  - Postgres migration/support files as needed
- Once isolated and robust, `oosync` will be extracted into a separate repo and published to npm

## North star (constraints)

- **Minimize developer work**: changing Postgres should “just work” end-to-end with regeneration.
- **Prefer generation over hand-authoring**: when possible, infer from Postgres catalogs and defaults.
- **Defaults-first**: the first “o” is opinionated—assume common-sense defaults.
- **Overrides exist, but are the exception**: override via config/tags, not manual edits to generated artifacts.

## Dependency & boundary rules (non-negotiable)

These exist to keep `oosync` future-standalone.

- `oosync/**` MUST NOT import from app `src/**`.
- `oosync/src/**` MUST NOT import from `oosync/worker/**` (core/lib cannot depend on Worker runtime).
- Worker implementation (`oosync/worker/**`) MUST NOT import from app `src/**`.
- `shared/generated/**` is a **pure generated contract** (types/data/constants only; no app imports).

If a change forces an import direction that violates the above, stop and redesign around a generated artifact or an interface.

## Codegen is the source of truth

- Generated files are **write-only** outputs. Do not “fix” generated outputs by editing them.
- If an output is wrong, fix the generator (`oosync/src/codegen-schema.ts`) or its inputs (Postgres, config, comment tags).
- Any PR that changes schema/meta should include:
  - regenerated outputs, and
  - a drift guard passing check (`tsx oosync/src/codegen-schema.ts --check` via the repo scripts).

### Overrides (preferred mechanisms)

Use these in order:

1. **Postgres catalogs** (PKs, uniques, column types) — default inference.
2. **Postgres table comments** (lightweight tags):
   - `@oosync.exclude`
   - `@oosync.changeCategory=<value>`
   - `@oosync.normalizeDatetime=col1,col2,...`
   - `@oosync.ownerColumn=<column_name>`
3. **`oosync.codegen.config.json`** (consumer-authored):
   - Prefer `tableMeta.excludeTables` over whitelists.
   - Avoid legacy `tableMeta.syncableTables` unless absolutely required.

## Syncable tables policy (opinionated default)

- **All application tables are syncable by default** if they have a primary key.
- Tables are excluded by default if they are:
  - schema/migration infrastructure (e.g., `schema_migrations`, `drizzle_migrations`)
  - sync infrastructure/internal tables (e.g., `sync_change_log` and similar)
  - explicitly excluded via `excludeTables` or `@oosync.exclude`

If we add new internal/sync infrastructure tables in Postgres, they MUST be excluded by default (generator default or config), so consumers don’t accidentally sync them.

## Worker/runtime design constraints

- Worker code should be **artifact-injected**:
  - The worker receives `syncableTables`, `tableRegistryCore`, and worker config from generated artifacts.
  - The worker should not hard-code app table names/columns.
- Avoid introducing coupling to Vite/Solid/browser globals in `oosync/src/**`.
- Keep types strict (no `any`). If a boundary requires “unknown payload”, use `unknown` and validate/narrow.

## Portability (future npm package)

Assume `oosync` will be its own repo:

- Avoid repo-relative assumptions (paths, scripts) in runtime code.
- Keep public exports small and stable (`oosync/src/index.ts` as the primary surface).
- Prefer additive changes to the generated contract; breaking changes require an explicit migration note.

## Local dev notes

- Codegen DB selection prefers `OOSYNC_DATABASE_URL`.
- `DATABASE_URL` is only used when it clearly points at a local Supabase instance.

## “Stop signs” (when to pause and ask)

- A change would require hand-editing generated artifacts (e.g., `shared/table-meta.ts`).
- A change would make the worker import app `src/**`.
- A change would make `oosync/src/**` depend on worker runtime.
- A proposed feature adds a new manual workflow step for developers instead of an inference/default.
