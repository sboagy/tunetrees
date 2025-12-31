=== PR #354 DESCRIPTION (copy/paste) ===

Fixes #338  
Part of epic #304  
Follow-up to #350  

## Summary
This PR defines the **runtime boundary** for the SQLite WASM ↔ Postgres sync system by introducing `oosync` as a portable library surface, plus a worker implementation that lives under `oosync/worker/*`.

Goal: make `oosync` future-standalone (own repo later), with strict dependency direction and a shared, generated contract.

## Non-goals
- No product behavior changes (refactor/wiring only).
- No UI orchestration moved into `oosync` (toasts, Solid/Auth wiring, scheduling intervals stay in app `src/`).
- No monorepo toolchain (keep single repo build).

## Proposed end-state directory structure (with dependency notes)

Note: this tree shows the *target* end-state. Some files under `oosync/src/runtime/core/*` are **Phase 2+ placeholders** and are not required for this PR (PR2 is primarily boundary + wiring).

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
          types.ts                                 # Platform interface(s)
        core/                                      # (Phase 2+ placeholder) portable logic; no Solid/UI, no localStorage/navigator
          index.ts
          engine-core.ts                           # (Phase 2+ placeholder) “pure” core engine (no browser globals)
          outbox-core.ts                           # (Phase 2+ placeholder) core outbox semantics (no SQLite binding)
          casing.ts
          invariants.ts

      client/
        index.ts
        worker-client.ts                           # client helper; may depend on `fetch`, must not depend on app `src/`

      codegen/
        index.ts
        codegen-schema.ts                          # current introspection generator
        codegen.config.ts

    worker/                                        # worker implementation owned by oosync; no imports from app `src/`
      src/                                         # Cloudflare Worker runtime code
        index.ts                                   # Worker entry (implementation)
        routes/
          sync.ts
        runtime/                                   # Cloudflare runtime specifics
          ...

  src/                                             # TuneTrees app; may import from `oosync/src/*` + `shared/generated/*`
    lib/
      sync/
        engine.ts                                  # app adapter around oosync core
        service.ts                                 # app orchestration (stays app-side)
        realtime.ts                                # likely app-side unless made portable

  worker/                                          # thin wrapper for Wrangler/build/deploy; no imports from app `src/`
    src/
      index.ts                                     # wrapper entrypoint; forwards to `oosync/worker/src/index.ts`
    wrangler.toml (or config that points at this wrapper)
```

## Source of truth (folder ownership)
- `oosync/src/*`: portable library code + interfaces/types owned by `oosync`.
- `oosync/worker/*`: worker implementation owned by `oosync` (Cloudflare runtime).
- `worker/*` (top-level): **thin wrapper only** for Wrangler/build/deploy; forwards into `oosync/worker/*`.
- `shared/generated/*`: shared generated artifacts (schema/meta contract) consumed by app + `oosync` + worker.

## Dependency rules (must hold at all times)
- `oosync` must not import from app `src/*`.
- `oosync/src/*` must not import from `oosync/worker/*` (core cannot depend on worker runtime).
- Worker (impl + wrapper) must not import from app `src/*`.
- `shared/generated/*` must be pure generated types/data/constants (no app imports).

Example expectations for `shared/generated/*`:
- ✅ `export const tableMeta = { ... } as const;`
- ❌ `import { something } from "@/lib/..."` (no app imports)

### Allowed imports matrix
✅ allowed, ❌ not allowed

| From \\ To | `shared/generated/*` | `oosync/src/*` | `oosync/worker/*` | app `src/*` | top-level `worker/*` wrapper |
|---|---:|---:|---:|---:|---:|
| `shared/generated/*` | ✅ (internal only) | ❌ | ❌ | ❌ | ❌ |
| `oosync/src/*` | ✅ | ✅ (internal) | ❌ | ❌ | ❌ |
| `oosync/worker/*` | ✅ | ✅ | ✅ (internal) | ❌ | ❌ |
| app `src/*` | ✅ | ✅ | ❌ | ✅ (internal) | ❌ |
| top-level `worker/*` wrapper | ❌ | ❌ | ✅ | ❌ | ✅ (internal) |

Notes:
- The wrapper exists only for build/deploy wiring and should be thin (re-export/forward to `oosync/worker/*`).
- If we later publish `oosync` as its own repo, `shared/generated/*` likely becomes a separate published artifact.

## Implementation plan (ordered)

### Phase 0: Library boundary scaffolding (no behavior change)
1) Add TypeScript path aliases
- `@oosync/*` → `oosync/src/*`
- `@shared-generated/*` → `shared/generated/*`

Where to add them:
- App/Vite typecheck: `tsconfig.app.json` (`compilerOptions.paths`)
- Worker typecheck/build: `worker/tsconfig.json` (`compilerOptions.paths`) or ensure the worker build uses a tsconfig that includes these paths
- Tooling/Node tsconfig (if any scripts import these paths): `tsconfig.node.json`

2) Create `oosync` public surfaces (barrels)
- `oosync/src/index.ts`
- `oosync/src/shared/index.ts`
- `oosync/src/runtime/index.ts`

3) Define `oosync`-owned interfaces
- Add `oosync/src/runtime/platform/types.ts` (`Platform`, logger, clock, storage abstraction, trigger controller, minimal SQLite surface).
- Add an app adapter in app code: `src/lib/sync/oosync-platform.ts` implementing those interfaces (no behavior changes).

4) Define canonical protocol types under `oosync`
- Add `oosync/src/shared/protocol/*` and make app + worker import protocol types from `@oosync/shared/protocol`.

5) Ensure schema/meta contract is external and generated
- Ensure codegen output required by `oosync` runtime is emitted to `shared/generated/sync/*`.
- Both app and worker import it from `@shared-generated/sync`.

### Phase 1: Worker “owned by oosync” with wrapper
6) Move (or introduce) worker implementation under `oosync/worker/*`
- Add `oosync/worker/src/index.ts` as the worker entrypoint.
- Keep Cloudflare-specific runtime code here.

7) Convert top-level `worker/*` into a thin wrapper
- `worker/src/index.ts` should forward to `oosync/worker/src/index.ts`.
- Wrapper should re-export the worker module’s `default` export unchanged (no extra logic).
- Wrangler points at the wrapper entrypoint.

### Phase 2+: Extract portable engine core (follow-up PRs)
8) Split sync engine into:
- `oosync` core (platform-agnostic push/pull/apply logic)
- app adapter (wires SQLite WASM + persistence + UI orchestration)

## Verification (must pass)
- `npm run typecheck`
- `npm run lint`
- `npm run build` (app)
- worker build succeeds (existing CI job)
- schema drift guard remains green (`npm run schema:sqlite:check`)

## Checklist
- [x] Path aliases added and builds green
- [x] `oosync/src/runtime/platform` interfaces defined
- [ ] App adapter compiles (planned: `src/lib/sync/oosync-platform.ts`) (not required for this PR unless we start consuming `IPlatform` in app/worker)
- [x] Protocol types have a single canonical import (`@oosync/shared/protocol`) for app code
- [x] Schema/meta contract is generated into `shared/generated/sync/*`
- [x] Schema/meta contract imported via `@shared-generated/*` for app code
- [ ] Worker-bundled code uses canonical imports (blocked by Wrangler bundling not honoring TS `paths`)
- [ ] No consumer imports protocol/meta via relative paths (currently false for worker-bundled graph due to Wrangler)
- [x] Worker implementation is in `oosync/worker/*`
- [x] Top-level `worker/*` is wrapper-only (no app imports)
- [x] No behavior changes intended; CI green

## Remainder of this PR (plan)

Goal: keep PR2 scoped to “boundary + wiring” while keeping builds green.

1) **Accept the current Wrangler constraint explicitly (documented exception)**
  - Wrangler/esbuild does not honor TypeScript `compilerOptions.paths` for module resolution when bundling.
  - Because the worker implementation lives under `oosync/worker/*` and imports `oosync/src/*`, the worker-bundled graph currently uses **relative imports** for protocol + generated contract to keep `wrangler dev/build` working.
  - This PR will document this as a known limitation/exception rather than trying to force canonical imports and risking worker regressions.

2) **Enforce canonical imports where we can (app + tooling)**
  - App code should import protocol via `@oosync/shared/protocol` and generated contract via `@shared-generated/sync`.
  - Node/tooling builds should continue to resolve the same aliases (already covered by `tsconfig.node.json`).

3) **Defer “no relative imports anywhere” to a focused follow-up (Phase 1.5 / Phase 2)**
  To truly satisfy “no relative imports” for the worker-bundled graph, we need one of these approaches:
  - **Option A (preferred): Build `oosync` as a real package** (workspace/package + build output), so worker imports resolve as normal node package imports (no TS `paths` needed at bundle time).
  - **Option B: Wrangler-compatible aliasing** (if Wrangler supports it in our version/config), so worker bundling can resolve `@oosync/*` + `@shared-generated/*`.
  - **Option C: Generate a worker-specific entry graph** where aliases are rewritten to relative paths during a prebuild step.
   
  This PR’s deliverable is the boundary + wrapper; a follow-up PR will pick one option and then flip the remaining checklist items.

4) **Platform adapter file (`src/lib/sync/oosync-platform.ts`)**
  - `IPlatform` is defined but not yet consumed in app code.
  - If we don’t consume it in this PR, we can leave the adapter as a Phase 2+ task.
  - If reviewers want the interface “proven”, add a minimal adapter and a no-op usage (still no behavior changes).

=== /PR #354 DESCRIPTION (copy/paste) ===

=== ME ===
So, now a broader question (no changes yet please):
Given for the epic https://github.com/sboagy/tunetrees/issues/304 and our 
current issue https://github.com/sboagy/tunetrees/issues/338 and our current PR
https://github.com/sboagy/tunetrees/pull/350, where our goal is to isolate 
the SQLite WASM <-> Postgres sync and schema logic into a "oosync" library, should #file:engine.ts and #file:service.ts be moved into a src folder in the `oosync` (top level) folder?  And I guess the worker would also be situated as part of oosync?

Do I have this right?  What other files would be moved? 

If I do have it right, what would be plan be for making this happen?

=== CoPilot ===
Yes, you basically have it right — with one important nuance:

- The “core sync runtime” (the thing that turns **local outbox → worker API → apply remote rows**) is a great fit for oosync.
- The “app-facing orchestration” (toasts, online/offline UI behavior, persistence hooks, Solid/Auth wiring) is *not* a great fit for oosync and should stay in the app (or be a thin wrapper around oosync).

Concretely, engine.ts is a strong candidate to move into oosync, but service.ts is mostly “app glue” today and should either remain where it is, or be split into:
- an oosync-portable core service (no UI, no browser globals), and
- an app wrapper that does the UI/persistence concerns.

## Should the worker “also be part of oosync”?
Yes — but I’d treat it as a *separate package/module* inside oosync, not literally “the same runtime library” as the client:

- Worker code has a very different environment (Cloudflare Worker runtime, Postgres, Drizzle pg-core)
- Client code is browser/PWA (SQLite WASM, IndexedDB/localStorage, Supabase auth session, `fetch`)

The right “unification” point is shared **protocol + schema/meta**, not shared runtime code.

## What else would move (based on what’s currently in src/lib/sync/)?
Right now sync is a mixed bag. If the goal of epic #304 is “isolate SQLite WASM ↔ Postgres sync + schema logic”, then the following are the typical moves:

**Likely move into oosync (runtime core)**
- engine.ts (core push/pull/apply logic)
- worker-client.ts (the sync HTTP client; make base URL configurable)
- outbox.ts (outbox read/mark-complete/backfill logic)
- adapters.ts + casing.ts (table adapters + casing conversions)
- Possibly conflicts.ts (if it’s generic and not UI-driven)

**Probably *not* move (or split first)**
- service.ts: currently references app concerns (e.g., toasts, `persistDb()`, `navigator`, scheduling of intervals, realtime wiring). That’s “application orchestration”.
- realtime.ts: depending on how coupled it is to Supabase realtime + app state. If it’s purely “given a Supabase client + tables, call syncDownTables”, it *could* move; if it touches UI/state, keep it app-side.
- queue.ts: depends on what it contains (if it’s just types, it can move; if it’s app state, keep).

**Already in oosync (codegen)**
- codegen-schema.ts and config + generated outputs are already on the “right side” of the boundary for issue #338.

**Shared “contract” should become oosync-owned (even if the files don’t immediately move)**
- sync-types.ts (worker ↔ client API contract)
- table-meta.generated.ts and table-meta.ts (shared schema-derived metadata)
- Potentially db-constants.ts

Today, these “shared” files are already shared across app + worker, which is good — the question is whether they live under oosync (library-owned) or remain top-level but treated as the “shared contract module”.

## The main blocker: current coupling in SyncEngine
Even if you “move the files”, engine.ts currently imports app-specific modules (e.g. SQLite instance getters, trigger install/suppression, logging, local DB persistence utilities). That means a straight move would just drag half the app along.

So the real architectural step is: make oosync depend only on *interfaces*, and let the app provide the platform-specific implementations.

A good mental model is:

- oosync provides: `SyncEngineCore` + `Outbox` + protocol/types + codegen
- app provides: “platform” (SQLite WASM handle, IndexedDB persistence, toast/UI, Supabase auth/session retrieval, logging)

## A practical plan to make this happen (incremental, low-risk)
Here’s a plan that aligns with #304/#338 and keeps PRs reviewable:

1) Define the package boundary and “public API”
- Decide what oosync exports (e.g., `createSyncEngine`, `WorkerClient`, `outbox` helpers, shared types)
- Define a small `Platform` interface that oosync needs (examples: `getSqliteInstance`, `suppressTriggers`, `enableTriggers`, `persistDb`, `storage` abstraction, `logger`, `now()`)

2) Move the shared contract to oosync ownership (or re-export it)
- Make worker + client import protocol/types and table-meta from one canonical place.
- This is where you also want to eliminate unsafe types like `any` in sync-types.ts eventually (it currently has `data: Record<string, any>`).

3) Extract “pure core” from the app sync engine
- Split engine.ts into:
  - core logic that is platform-agnostic (goes to oosync)
  - a thin app adapter that wires in your SQLite WASM / IndexedDB / logging behaviors

4) Split SyncService into core vs app glue (optional but recommended)
- Keep app scheduling/intervals/toasts in the app.
- If you want an oosync “service”, make it purely orchestration (no UI), and let the app decide UI responses.

5) Move worker under oosync as its own package/module
- Keep a dedicated worker build config, but import shared contract/meta from oosync.
- This keeps “client + worker lockstep” as a library guarantee.

6) Update import paths + CI
- Ensure CI builds still run `schema:sqlite:check`.
- Ensure worker and app builds pull from the new oosync shared contract.

7) Tests
- Move or duplicate tests that are truly sync-core tests (not UI tests) to live with oosync core.

If you want, I can propose a concrete target folder layout for oosync that fits how this repo already builds (single-repo, not yet publishing to npm), and a “first PR” that does only the boundary/interface extraction without moving files yet.


=== ME ===
I don't know if you answered the question of "when".  Should we do this as a next step of this PR?  Or does it make sense to have the work be new PR?

Should we have a feature branch for the epic, instead of merging to main right now for each phase with it's own PR?

==== CoPilot ====
I wouldn’t do the big “move runtime + worker under oosync” in *this* PR unless you’re already blocked on it for review/merge. This PR (#350) has a clear, valuable slice (schema/codegen + sync robustness) and it’s already reviewable; turning it into a large folder/ownership reshuffle will mostly add churn (imports, paths, build wiring) and make conflicts/review harder.

**When (this PR vs next PR)?**
- **Merge this PR as-is**, then do the “library boundary + moves” as **a new PR** immediately after.
- Exception: only fold it into this PR if there’s a **hard dependency** (e.g., reviewers won’t accept current changes unless the boundary is enforced now, or CI/packaging requires oosync to own runtime immediately). From your summary, it sounds like it’s *not* required to land the codegen improvements.

A good practical sequencing is:
- PR #350: schema/codegen + runtime fixes (low churn, easy to validate).
- PR #351 (new): introduce oosync runtime package structure + exports (no behavior change, mostly moves + wiring).
- PR #352+: move pieces over incrementally (engine/outbox first, then worker-client/protocol, then decide how to split `service.ts`).

**Epic branch vs merging phases to `main`**
For a rewrite/refactor epic, the choice is basically:

1) **Trunk-based (recommended here): merge each phase to `main` via small PRs**
- Pros: keeps `main` close to reality, reduces “mega-merge” risk, easier reviews, easier bisecting, CI stays meaningful.
- Cons: you sometimes need temporary adapters/flags while the migration is incomplete.

2) **Long-lived epic feature branch (only if you truly need it)**
- Pros: you can do breaking reorganizations without “half-migrated” states landing in `main`.
- Cons: higher merge conflict risk over time, CI results drift from `main`, review gets harder, and the eventual merge is painful.

Given what you’re doing (schema codegen + sync refactor), I’d stick with **trunk-based + phased PRs**, and use these tactics when you need safety:
- Use **Draft PRs** and/or **stacked PRs** (PR #351 targets #350’s branch, etc.) so you can keep momentum without dumping churn into one review.
- Keep incomplete migrations behind **thin compatibility re-exports** (e.g., sync re-exporting from oosync during transition), then remove later.

**Direct recommendation**
- Do **new PR** for the oosync runtime/worker move.
- Keep doing **one PR per phase merged to `main`**, unless a phase is inherently breaking and can’t be made safe with small adapters.

If you tell me whether you’re aiming for “no breaking changes on `main` ever” vs “temporary adapter layers are ok”, I can be more opinionated about whether an integration branch is worth it for the worker/client split.