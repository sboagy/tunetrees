# TuneTrees Project AGENTS Instructions

Scope: repository-specific architecture, patterns, and invariants for TuneTrees.

Global execution guardrails (loop prevention, patch hygiene, type-safety defaults) live in `.github/copilot-instructions.md`. Treat this file as the canonical source for “how TuneTrees works”.

## Instruction Hierarchy

Root (this file) → `src/AGENTS.md` (UI) → `tests/AGENTS.md` (unit) → `e2e/AGENTS.md` (E2E) → `oosync/AGENTS.md` (sync codegen + worker boundaries) → `sql_scripts/AGENTS.md` (views/migrations).

The `legacy/` directory is reference-only. Do not modify legacy code for new work.

## Tech Stack (Actual)

- Frontend: SolidJS + TypeScript (Vite)
- Styling/UI: Tailwind + shadcn-solid + `@kobalte/core` primitives
- Data grids: `@tanstack/solid-table` + `@tanstack/solid-virtual`
- Local DB: SQLite WASM via `sql.js` with IndexedDB persistence (Drizzle ORM)
- Remote DB access (browser): Supabase JS wrapped by Drizzle (see `src/lib/db/client-postgres-browser.ts`)
- Remote: Supabase (Auth + Postgres + Realtime)
- Sync: outbox-driven, bidirectional sync via Cloudflare Worker + `oosync`
- Scheduling: `ts-fsrs` (FSRS)
- Music notation: `abcjs`
- PWA: `vite-plugin-pwa` + Workbox; deploy via Cloudflare Pages (`wrangler pages deploy`)
- Lint/format: Biome (`npm run lint`, `npm run format`)
- Tests: Vitest (`npm run test` / `npm run test:unit`) + Playwright (`npm run test:e2e`)

## Offline-First Data Flow

1) User action writes to local SQLite immediately.
2) Writes enqueue into outbox; sync engine pushes to Supabase via worker.
3) Remote changes flow back via worker (and/or Realtime) and are applied to local SQLite.

Default conflict policy is last-write-wins, with explicit conflict tracking in the sync layer.

## Local SQLite (sql.js) + Drizzle Patterns

- Browser SQLite client + initialization/migration logic live in `src/lib/db/client-sqlite.ts`.
- Local schema and relations come from Drizzle artifacts under `drizzle/`.
- The local DB is per-user (namespaced keys in IndexedDB/localStorage).
- Sync triggers/outbox tables are installed as part of DB initialization.

## Sync System Overview

Primary components:

- `src/lib/sync/engine.ts`: orchestrates push/pull, retries, ordering, conflict handling.
- `src/lib/sync/outbox.ts`: durable local outbox queue.
- `src/lib/sync/adapters.ts`: per-table transformation rules (camelCase local ↔ snake_case remote).
- `src/lib/sync/worker-client.ts`: client for the worker endpoint.
- `worker/`: app-facing Cloudflare Worker package that imports worker implementation from `oosync/worker/*`.

### Adapter Pattern (Per-Table, Cached)

- Adapters are the single place for casing conversions and special-case normalization.
- Use `getAdapter(tableName)` from `src/lib/sync/adapters.ts` instead of re-implementing casing rules.
- Table metadata comes from `@sync-schema/table-meta` (generated contract).

### Generated Contract / Codegen

- `oosync` is an opinionated offline sync library with a code generator (`npm run codegen:schema`).
- Generated outputs are write-only. If generated schema/metadata is wrong, fix the generator or inputs — do not hand-edit generated files.
- Boundary rules are enforced in `oosync/AGENTS.md` (core must not import app `src/**`; worker must not import app `src/**`; shared/generated is contract-only).

## UI Principles (Pointers)

- UI is table-centric and performance-oriented; see `src/AGENTS.md`.
- Do not introduce React patterns (no React hooks, no React-only libraries in app code paths).

## Testing & Local Dev Conventions

- Prefer deterministic tests: one input state, one expected output state; no branching logic.
- Reset local Supabase + auth fixtures with `npm run db:local:reset`.
- Copilot/agents should not start the dev server unless explicitly requested; ask if you need a restart.

## What To Read First For Changes

- Sync changes: start with `oosync/AGENTS.md`, then `src/lib/sync/*`, then generated artifacts.
- DB schema changes: check `drizzle/` + regenerate schema contract, then verify sync + views.
- UI changes: follow `src/AGENTS.md` and ensure E2E selectors remain stable.
