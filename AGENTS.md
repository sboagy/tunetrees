# TuneTrees Project AGENTS Instructions

Scope: repository-specific architecture, patterns, and invariants for TuneTrees.

Global execution guardrails (loop prevention, patch hygiene, type-safety defaults) live in `.github/copilot-instructions.md`. Treat this file as the canonical source for “how TuneTrees works”.

`ARCHITECTURE.md` is the top-level cross-cutting architecture guide for agents. Read it before making changes that affect sync/codegen boundaries, runtime data flow, generated artifacts, or repository responsibilities. If those areas change, update `ARCHITECTURE.md` in the same change unless it remains accurate as written.

## Instruction Hierarchy

Root (this file) → `src/AGENTS.md` (UI) → `tests/AGENTS.md` (unit) → `e2e/AGENTS.md` (E2E) → `oosync/AGENTS.md` (sync codegen + worker boundaries) → `sql_scripts/AGENTS.md` (views/migrations).

The `legacy/` directory is reference-only. Do not modify legacy code for new work.

## Tech Stack (Actual)

- Frontend: SolidJS + TypeScript (Vite)
- Styling/UI: Tailwind + shadcn-solid + `@kobalte/core` primitives
- Data grids: `@tanstack/solid-table` + `@tanstack/solid-virtual`
- Local DB: SQLite WASM via `@sqlite.org/sqlite-wasm` with IndexedDB blob persistence (Drizzle ORM)
- Remote DB access (browser): Supabase JS wrapped by Drizzle (see `src/lib/db/client-postgres-browser.ts`)
- Remote: Supabase (Auth + Postgres + Realtime)
- Sync: outbox-driven, bidirectional sync via Cloudflare Worker + `oosync`
- Scheduling: `ts-fsrs` (FSRS)
- Music notation: `abcjs`
- PWA: `vite-plugin-pwa` + Workbox; deploy via Cloudflare Pages (`wrangler pages deploy`)
- Lint/format: Biome (`npm run lint`, `npm run format`)
- Tests: Vitest (`npm run test` / `npm run test:unit`) + Playwright (`npm run test:e2e`)

## Offline-First Data Flow

1. User action writes to local SQLite immediately.
2. Writes enqueue into outbox; sync engine pushes to Supabase via worker.
3. Remote changes flow back via worker (and/or Realtime) and are applied to local SQLite.

Default conflict policy is last-write-wins, with explicit conflict tracking in the sync layer.

## Local SQLite (sqlite-wasm) + Drizzle Patterns

- Browser SQLite client + initialization/migration logic live in `src/lib/db/client-sqlite.ts`.
- Local schema and relations come from Drizzle artifacts under `drizzle/`.
- The local DB is per-user (namespaced keys in IndexedDB/localStorage).
- Sync triggers/outbox tables are installed as part of DB initialization.
- After changing `@sqlite.org/sqlite-wasm` or `oosync/runtime/browser-sqlite`, use `npm run dev:force` for dev and rebuild before `npm run preview:local`; Vite's optimized dependency cache can otherwise serve stale WASM/runtime assets.
- Before merging TuneTrees changes that depend on oosync runtime changes, land/push oosync first, then pin TuneTrees with `npm run deps:oosync:update -- <sha-or-tag>`.

## Sync System Overview

Primary components:

- `src/lib/sync/engine.ts`: orchestrates push/pull, retries, ordering, conflict handling.
- `src/lib/sync/outbox.ts`: durable local outbox queue.
- `src/lib/sync/adapters.ts`: per-table transformation rules (camelCase local ↔ snake_case remote).
- `src/lib/sync/worker-client.ts`: client for the worker endpoint.
- `worker/`: app-facing Cloudflare Worker package that imports worker implementation from the linked `oosync` package (`@oosync-worker/*`).

### Adapter Pattern (Per-Table, Cached)

- Adapters are the single place for casing conversions and special-case normalization.
- Use `getAdapter(tableName)` from `src/lib/sync/adapters.ts` instead of re-implementing casing rules.
- Table metadata comes from `@sync-schema/table-meta` (generated contract).

### Generated Contract / Codegen

- `oosync` is an opinionated offline sync library with a code generator (`npm run codegen:schema`).
- **NEVER hand-edit generated files.** The following are generated and must only be modified by running codegen:
  - `drizzle/schema-sqlite.generated.ts`
  - `drizzle/schema-sqlite.ts` (wrapper, re-exports generated)
  - `worker/src/generated/schema-postgres.generated.ts`
  - `worker/src/generated/worker-config.generated.ts`
  - `shared/generated/sync/table-meta.generated.ts`
  - `shared/table-meta.ts`
  - `src/lib/db/client-sqlite.ts`
  - `src/lib/sync/runtime-config.ts`
  - `worker/src/index.ts`
- **Generated-file edits are forbidden.** If a file is listed here, or if its header says `AUTO-GENERATED`, `GENERATED`, or `DO NOT EDIT`, do not patch it directly.
- If a task appears to require a generated-file change, edit the source input instead (Supabase migration, `oosync.codegen.config.json`, codegen config, or generator code), run the appropriate generator, and keep only generator-produced diffs.
- Before editing a file that might be generated, inspect its header first. A generated banner overrides file naming conventions or path heuristics.
- **Required workflow for schema changes:**
  1. Apply Supabase migration to local Postgres (`npx supabase db push --local` or rhizome equivalent)
  2. Run `npm run codegen:schema` to regenerate all outputs from the live Postgres schema
  3. Verify: `npm run codegen:schema:check && npm run typecheck && npm run lint && npm run test:unit`
- If generated output is wrong, fix the **source** (Supabase migration, `oosync.codegen.config.json`, or the codegen generator itself) and regenerate — never patch generated files.
- Boundary rules are enforced in the standalone `oosync` repo `AGENTS.md` (core must not import app `src/**`; worker must not import app `src/**`; shared/generated is contract-only).

## Schema Compatibility Gate

Agents must treat production schema compatibility as a code-review gate for every Supabase migration, SQL view change, generated-contract change, sync table change, and browser/Worker query change.

Canonical runbook: `docs/development/schema-promotion.md`.

Default rule: every migration that can be promoted through the standard staging-to-production workflow must be backward-compatible with the currently deployed production app and Worker until the new Worker and Pages deployment completes. CI can verify that migrations apply and generated contracts match, but it cannot prove semantic compatibility; agents must reason about it explicitly when generating or reviewing changes.

When generating schema changes:

- Prefer additive, backward-compatible changes: new tables, new nullable columns, new columns with safe defaults, new indexes, new views/functions, and non-breaking triggers.
- Adding a `NOT NULL` column requires a safe default or a backfill path that keeps old code working. Otherwise split it into add nullable, backfill, then enforce.
- Adding constraints, unique indexes, foreign keys, or stricter checks requires validating/backfilling existing production data first; use low-risk patterns such as `NOT VALID` plus later validation where appropriate.
- Treat column type changes, renames, semantic changes, nullability tightening, primary-key changes, RLS changes, and trigger behavior changes as potentially breaking unless proven otherwise.
- Never delete columns, tables, views/functions used by existing code, enum values, or compatibility triggers in the same release that removes their last code use. Use expand/contract.

Expand/contract is required for potentially breaking changes:

1. Expand: add the new schema shape while the old shape still works; backfill if needed.
2. Switch: deploy app/Worker/codegen changes that use the new shape while keeping old compatibility.
3. Contract: in a later release, after old service workers/clients/workers are no longer expected to use the old shape, remove old schema and compatibility code.

When reviewing schema-related changes, agents must call out:

- whether the change is additive or potentially breaking;
- what old app/Worker/browser bundle behavior must continue to work during deployment;
- whether generated artifacts were regenerated from the source migration rather than hand-edited;
- whether synced-table changes require adapter, metadata, view, Worker, or E2E updates;
- whether the PWA/service-worker overlap makes old browser bundles a risk.

If no backward-compatible solution is obvious, do not quietly generate a destructive migration. Stop and alert the developer with the incompatibility, the likely production risk, and at least one expand/contract or manual migration option.

## UI Principles (Pointers)

- UI is table-centric and performance-oriented; see `src/AGENTS.md`.
- Visual grammar, action vocabulary, and button/icon semantics live in `docs/design/tunetrees-design-system.md`.
- Do not introduce React patterns (no React hooks, no React-only libraries in app code paths).

## Testing & Local Dev Conventions

- Prefer deterministic tests: one input state, one expected output state; no branching logic.
- Reset local Supabase + auth fixtures with `npm run db:local:reset`.
- Copilot/agents should not start the dev server unless explicitly requested; ask if you need a restart.
- Before handing off changes intended for commit or review, prefer repo-wide verification with `npm run format`, `npm run lint`, and `npm run typecheck` when the change touches broad TypeScript or shared surfaces. In CI, the corresponding gate is `npm run format:check`, `npm run lint`, and `npm run typecheck`.

## What To Read First For Changes

- Architecture / repo-boundary changes: start with `ARCHITECTURE.md`, then this file, then the relevant scoped `AGENTS.md`.
- Sync changes: start with `oosync/AGENTS.md`, then `src/lib/sync/*`, then generated artifacts.
- DB schema changes: check `drizzle/` + regenerate schema contract, then verify sync + views.
- UI changes: follow `src/AGENTS.md` and ensure E2E selectors remain stable.
