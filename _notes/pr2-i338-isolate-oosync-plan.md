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