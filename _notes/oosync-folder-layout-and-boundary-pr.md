## oosync: Proposed Folder Layout + “Boundary-Only” First PR Plan

Context: epic #304, issue #338, PR #350 (schema codegen + sync robustness). This doc proposes (a) a concrete `oosync/` layout that fits the current repo (single repo, Vite app + Cloudflare Worker, no npm publishing required yet), and (b) a *first PR* that introduces the boundary/interfaces and canonical import paths **without moving** the existing sync implementations yet.

---

### Goals (what “oosync” should mean)

- `oosync` owns *portable sync logic* + *shared contract*.
- The app owns *UI/orchestration glue* (Solid/Auth wiring, toasts, online/offline gating, scheduling intervals, “when to sync” policy).
- The worker is a separate runtime environment and should share **contract + metadata** with `oosync`.
  - It must not depend on app code under `src/` (no UI/Auth/Solid imports).

The “unification point” is:
- shared protocol types (client ↔ worker)
- shared schema-derived metadata (syncable tables, PK shapes, conflict keys, boolean/timestamp hints)
- shared *core* algorithms that are runtime-agnostic

---

### Proposed End-State Layout (single repo, not npm-published)

This structure intentionally avoids introducing a full monorepo toolchain (pnpm workspaces, turborepo, etc.) until we actually need it.

```
repo-root/                                         # root wiring only; avoid cross-layer imports
  shared/                                          # shared artifacts; must not import from app `src/` or `oosync/`
    generated/                                     # generated outputs; pure types/data/constants only
      sync/                                        # shared schema/meta contract consumed by app + oosync + worker
        index.ts
        table-meta.generated.ts

  oosync/                                          # portable library home (future standalone repo)
    src/                                           # oosync TypeScript sources; must not import from app `src/` or top-level `worker/`
      index.ts

      shared/
        index.ts                                   # barrel exports for shared contract (protocol, errors)
        protocol/                                  # protocol types must be runtime-agnostic
          index.ts
          sync-types.ts
          errors.ts

      runtime/
        index.ts                                   # barrel exports for runtime core
        platform/                                  # interfaces owned by oosync; implemented by app/worker adapters
          index.ts
          types.ts           # Platform interface(s)
        core/                                      # portable logic; no Solid/UI, no localStorage/navigator, no DB-specific globals
          index.ts
          engine-core.ts     # “pure” core engine (no browser globals)
          outbox-core.ts     # core outbox semantics (no SQLite binding)
          casing.ts
          invariants.ts

      client/
        index.ts
        worker-client.ts     # client helper; may depend on `fetch`, must not depend on app `src/`

      codegen/
        index.ts
        codegen-schema.ts    # current introspection generator
        codegen.config.ts

    worker/                                          # worker implementation owned by oosync; no imports from app `src/`
      src/                                           # Cloudflare Worker runtime code
        index.ts                                     # Worker entry (implementation)
        routes/
          sync.ts
        runtime/                                     # Cloudflare runtime specifics
          ...

    README.md (optional)

  src/                                             # TuneTrees app; may import from `oosync/*` + `shared/generated/*`
    lib/
      sync/
        engine.ts            # app adapter around oosync core
        service.ts           # app orchestration (stays app-side)
        realtime.ts          # likely app-side unless made portable
        ...

  worker/                                          # thin wrapper for Wrangler/build/deploy; no imports from app `src/`
    src/
      index.ts              # Thin wrapper entrypoint for Wrangler
                            # Imports/exports implementation from `oosync/worker/src/*`
    wrangler.toml (or config that points at this wrapper)
```

Notes:
- `oosync/src/shared/*` is the canonical “contract” location.
- `oosync/src/runtime/*` is the canonical “portable runtime core” location.
- `oosync/src/client/*` contains client-only helpers that are still portable (no Solid/UI), but may depend on browser `fetch`.
- `oosync/src/codegen/*` stays responsible for schema + metadata generation.
- Schema-derived/generated artifacts that both the app and `oosync` must read live in an **external shared folder** (example: `shared/generated/sync/*`).
- Recommended structure if `oosync` may become its own repo:
  - Put the **worker implementation** under `oosync/worker/*`.
  - Keep a top-level `worker/` directory as a **thin wrapper** for Wrangler/build/deploy tooling.
  - The wrapper should import from `oosync/worker/*` and should never depend on app `src/`.
  - Dependency invariant: worker implementation and wrapper import only from `oosync/*` and `shared/generated/*` (and worker runtime deps), never from app `src/`.

Clarifying note on `index.ts` files in this proposal:
- These are “barrel” modules: they re-export a curated public surface so consumers import from stable paths (e.g. `@oosync/shared` vs deep relative paths).
- They are optional, but they reduce churn during migration.

#### Allowed imports matrix

Legend:
- ✅ allowed
- ❌ not allowed

Import *from* → *to*

| From \\ To | `shared/generated/*` | `oosync/src/*` | `oosync/worker/*` | app `src/*` | top-level `worker/*` wrapper |
|---|---:|---:|---:|---:|---:|
| `shared/generated/*` | ✅ (internal only) | ❌ | ❌ | ❌ | ❌ |
| `oosync/src/*` | ✅ | ✅ (internal) | ✅ (if needed) | ❌ | ❌ |
| `oosync/worker/*` | ✅ | ✅ | ✅ (internal) | ❌ | ❌ |
| app `src/*` | ✅ | ✅ | ❌ | ✅ (internal) | ❌ |
| top-level `worker/*` wrapper | ✅ | ✅ | ✅ | ❌ | ✅ (internal) |

Notes:
- The wrapper exists only for build/deploy wiring and should be thin (re-export/forward to `oosync/worker/*`).
- “Internal” means normal same-layer imports.
- If we later publish `oosync` as its own repo, the `shared/generated/*` contract likely becomes a separate package/artifact.

---

### Import Strategy (how to avoid churn)

#### Canonical imports (end state)

- App + worker should import contract/meta from:
  - `oosync/shared` (or `oosync/src/shared` initially)
- App should import runtime core from:
  - `oosync/runtime`
- App + worker + `oosync` runtime should import generated schema/meta from a shared generated location:
  - `shared/generated/sync` (via an alias like `@shared-generated/sync`)
- App can keep its *existing* public surface stable by re-exporting **oosync** during migration:
  - `src/lib/sync/*` can re-export from `oosync/*` while consumers migrate.
  - This is intentionally **app → oosync** only; `oosync` should not import from `src/`.

#### TypeScript path aliases (recommended)

Use `tsconfig` paths to keep imports stable and readable:

- `@oosync/*` → `oosync/src/*`
- `@shared-generated/*` → `shared/generated/*`

This keeps the repo “single TS project” friendly while we are not publishing packages.

---

### Boundary Definition (core vs glue)

#### “Core runtime” (belongs in `oosync/runtime`)

Portable, testable, no Solid/UI, no localStorage/navigator assumptions.

- Push logic: outbox → worker API
- Pull/apply logic: worker changes → local apply
- Dependency ordering, delete ordering
- Generic conflict key upsert strategy (no table name branching)
- Serialization helpers (row-id, composite PK handling)

#### “App glue” (stays in `src/lib/sync`)

- When to sync (intervals, throttling, online/offline gating)
- UI notifications/toasts
- Auth/session retrieval
- “persist local DB” policy
- Any “screen state” coupling

#### Worker runtime (stays worker-side, shares contract)

- Postgres read/write
- RLS / auth validation
- Pagination/cursors
- Server-side drift checks as needed

---

### First PR (Boundary-Only) — No File Moves Yet

Purpose: create the *shape* of `oosync` so later PRs can move code with less churn.

#### Deliverables

1) Create canonical “shared contract” module
- Add `oosync/src/shared/protocol/sync-types.ts` (or re-export existing types initially)
- Ensure schema/meta needed by `oosync` runtime is exported from an **external shared generated** module (example: `shared/generated/sync/*`).

What “table meta” means here (and where it should live):
- Treat schema-derived metadata as an app-owned/generated artifact, not as `oosync` source.
- If `oosync` runtime must read it, it must be available via an **external shared generated** path (not under `oosync/`).
- The generated module must remain **pure data + types** and must not import from `src/`.
- Anything that *interprets* metadata for UI purposes stays app-side.

2) Introduce a `Platform` interface (the key dependency inversion)
- Add `oosync/src/runtime/platform/types.ts`:
  - `PlatformLogger` (info/warn/error)
  - `Clock`/`now()` provider
  - `StorageLike` interface (get/set/remove) used by engine timestamps
  - `TriggerController` interface (enable/suppress)
  - `SqliteLike` interface surface (what core needs)

3) Add an app-side platform adapter (still no code moves)
- Add `src/lib/sync/oosync-platform.ts` implementing the `Platform` interface using:
  - current SQLite WASM getters
  - current trigger enable/suppress
  - current logger
  - current localStorage

4) Add `oosync/src/index.ts` barrels
- `oosync/src/shared/index.ts`
- `oosync/src/runtime/index.ts`

5) Switch imports in *one or two* central places
- Prefer swapping shared contract imports first (low risk):
  - worker and app both import `SyncChange`/protocol types from `@oosync/shared/...`
  - app imports table registry types from `@oosync/shared/table-meta`

6) No behavioral change (acceptance criterion)
- Engine behavior should be unchanged; the PR should be wiring + types only.

#### PR checklist (Boundary-Only)

- [ ] `@oosync/*` TS path alias added and builds green
- [ ] `oosync/src/shared` exists and is the canonical protocol/meta import
- [ ] `oosync/src/runtime/platform` interface defined (minimal surface)
- [ ] App adapter implements platform interface (no behavior change)
- [ ] Worker + app import shared protocol/meta from `oosync` (at least in one place)
- [ ] No sync behavior change intended; smoke build/typecheck passes

---

### Follow-up PR Sequence (after Boundary-Only)

#### PR A: Extract “engine core” into oosync (still minimal moves)
- Create `oosync/src/runtime/core/engine-core.ts`
- Move only the platform-agnostic parts
- Keep `src/lib/sync/engine.ts` as the adapter that wires platform + app policy

#### PR B: Move outbox/backfill helpers into oosync
- Keep SQLite-specific SQL in the app until we have a stable interface
- Move the *semantics* + shared helpers first

#### PR C: Re-home worker pieces (optional)
- Only if it reduces confusion; not required for correctness
- Main win is shared protocol/meta imports

---

### Practical “Do Not Do” list (to keep PRs reviewable)

- Don’t move worker and client runtime code into the same module just to share files.
- Don’t migrate `service.ts` into oosync; keep it app glue (or split it explicitly).
- Don’t introduce a monorepo toolchain until the imports/paths prove insufficient.
- Don’t rewrite tests/E2E unless required by import/path changes.
