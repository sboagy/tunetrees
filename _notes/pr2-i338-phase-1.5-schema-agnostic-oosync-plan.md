# Phase 1.5 — Make `oosync` Schema-Agnostic + Independently Testable

**Context:** PR #354 is an approved stepping stone: it isolates the runtime boundary and moves the worker implementation under `oosync/worker/*`.

**Goal (Phase 1.5):** Make `oosync` buildable and testable **without any TuneTrees app code** *and without any TuneTrees database-schema-specific tables/constants baked into `oosync`.*

This is **not** “open source it now.” It is “prepare it so extraction is purely infrastructure later.”

---

## Why this phase exists

Today, `oosync` still references TuneTrees schema-derived artifacts (table names/meta/constants). That prevents:
- validating sync logic against alternate schemas,
- hardening schema/sync logic in isolation,
- confidence that `oosync` can be extracted later.

Phase 1.5 makes schema knowledge an **injected dependency**, not a compiled-in dependency.

---

## Design principles

- `oosync` must have **zero** imports from app `src/*`.
- `oosync` must have **zero** imports from TuneTrees-generated schema/meta.
- `oosync` may define interfaces/types for “syncable schema description”, but not provide a TuneTrees implementation.
- Any generated schema/meta (from Postgres introspection) lives outside `oosync` (repo-local for now), and is passed into `oosync` via well-typed inputs.

---

## Proposed architecture changes

### 1) Define an `oosync` schema description interface
Add an `oosync`-owned type that fully describes what sync needs to know.

Examples of likely fields (illustrative; keep minimal):
- syncable table names
- per-table primary/composite key columns
- boolean/date/timestamp column sets
- casing rules (or column name mapping strategy)

This becomes something like:
- `oosync/src/shared/schema/types.ts` (or `oosync/src/shared/protocol/schema.ts`)

### 2) Convert hardcoded TuneTrees schema references into injected inputs
Replace any `oosync` code that imports:
- TuneTrees table-name unions / constants
- table metadata registries
- generated contract modules

…with a parameter, e.g. `schema: ISyncSchemaDescription`.

**Key outcome:** the runtime only talks to `ISyncSchemaDescription`.

### 3) Move TuneTrees schema implementation out of `oosync`
Create a TuneTrees-specific “schema package/module” that implements the `ISyncSchemaDescription` contract.

This should:
- be buildable independently,
- remain generated-from-DB (as you stated),
- be imported by app + worker, not by `oosync`.

Location options (pick one; simplest wins):
- keep under `shared/generated/sync/*` (TuneTrees contract), OR
- move to `src/lib/sync/schema/*` (still not in `oosync`), OR
- create `sync-schema/` package folder (repo-local, future-extractable).

### 4) Make the worker accept a schema description
Worker code currently assumes a fixed schema. Change it to:
- import the TuneTrees schema description, and
- pass it into `oosync` runtime functions.

### 5) Add an “alternate schema” test harness
Add a minimal test-only schema description that differs from TuneTrees.

This enables unit tests like:
- “composite keys work for table X”,
- “boolean normalization works for table Y”,
- “unknown table is rejected”,
- “infra tables are ignored”,

…without depending on the TuneTrees schema.

---

## Work items (implementation checklist)

1. Identify all TuneTrees schema/table references inside `oosync/`.
2. Introduce `ISyncSchemaDescription` in `oosync`.
3. Refactor `oosync` runtime/protocol helpers to take `schema: ISyncSchemaDescription`.
4. Move TuneTrees-specific schema meta/constants out of `oosync` into a TuneTrees-owned module.
5. Update app and worker wiring to provide the TuneTrees schema description.
6. Add unit tests in `tests/` that:
   - import `oosync` (only),
   - pass a small “test schema description”,
   - validate core behavior with no TuneTrees schema dependencies.
7. Verification:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npx wrangler build --cwd worker`

---

## Definition of done

- `oosync` contains **no references** to TuneTrees tables or TuneTrees-generated schema/meta.
- `oosync` can be imported and unit-tested using a non-TuneTrees schema description.
- App + worker continue to work by providing the TuneTrees schema description.

---

## Notes / sequencing

This phase should happen **before** the worker-import cleanup/packaging plan currently described in `_notes/pr2-i338-phase-1.5-option-a-plan.md`.

Once schema is injected, the later packaging work can decide how to ship:
- `@tunetrees/oosync` (runtime), and
- `@tunetrees/sync-schema` (TuneTrees schema description),

as separate publishable artifacts.
