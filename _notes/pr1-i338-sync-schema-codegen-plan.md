# PR1 Plan: Isolate Sync Engine & Automate SQLite Schema Generation (Issue #338)

Fixes #338  
Part of epic #304  
PR: Isolate Sync Engine & Automate SQLite Schema Generation

## Summary

This PR isolates the sync engine into a schema-driven core with zero table-specific hacks, establishes Postgres as the single schema source-of-truth, and automates generation of the SQLite Drizzle schema (and aligned sync metadata) from Postgres. It also introduces a generic “self-healing” strategy for when a user’s existing SQLite WASM/IndexedDB is behind the schema shipped by a newer app build, so upgrades don’t require per-table repair logic (especially not for `practice_record`).

## Motivation / Problems

- Schema drift exists because schema assumptions are effectively maintained in multiple places (Postgres schema, SQLite schema, and sync-specific metadata/assumptions).
- Current sync code contains special cases (“hacks”), notably around `practice_record`, which is not sustainable and blocks scaling.
- PWA upgrades can produce schema mismatches: users may have an older local SQLite schema in IndexedDB when the app updates. This must self-heal generically and safely.

## Goals

- Postgres is the authoritative schema source-of-truth.
- Deterministic generation of the SQLite Drizzle schema used by the PWA.
- Sync core is isolated and data-driven: no table-specific branching (no `practice_record` hacks).
- Generic self-healing when local SQLite schema is older/newer than the shipped schema.
- Worker and client stay in lock-step via shared generated metadata.

## Non-goals (for this PR)

- New sync features or UI changes beyond what’s required for the refactor/codegen.
- Complex per-table offline-preserving migrations for arbitrary schema changes (unless required for correctness). Prefer a generic, safe recovery approach.
- Broad re-architecture beyond the scope of issue #338 / PR1 of epic #304.

## Approach

### 1) Isolate the sync core (schema-driven, no table hacks)

- Define a clean boundary for core runtime sync behavior around:
  - src/lib/sync/SyncEngine.ts
  - src/lib/sync/SyncPushClient.ts
  - src/lib/sync/SyncRealtimeClient.ts
- Inventory and remove any table-specific logic from core sync paths (especially anything conditional on `practice_record`).
- If table-specific behavior is unavoidable, encode it declaratively outside core and have core consume it generically via shared metadata:
  - src/lib/sync/sync-schema.ts

Success criteria: core sync can run against any syncable table set purely via metadata, without bespoke per-table repairs.

### 2) Make Postgres the schema source-of-truth

- Document the one supported workflow for schema changes in:
  - schema-migration-strategy.md
- Clarify what is “canonical” (Postgres schema / migration files / drizzle-kit source) and what is generated (SQLite schema + sync table metadata).

Success criteria: engineers know exactly where to change schema, and what generated artifacts must be updated.

### 3) Automate SQLite schema generation (deterministic, robust)

- Replace/retire the fragile parsing workflow in:
  - scripts/generate-sqlite-schema.ts
- Implement a robust generator approach (introspection or AST-based transform) that does not rely on regex parsing of SQL dumps.
- Generated output becomes the canonical SQLite Drizzle schema used by the app:
  - src/lib/db/sqlite/schema.ts
  - Re-export via schema.ts

Success criteria: SQLite schema changes are produced by generation, not manual edits, and the generator output is stable/deterministic.

### 4) Keep sync metadata aligned with generated schema

- Ensure the shared sync table registry used by client and worker stays aligned with the generated schema:
  - src/lib/sync/sync-schema.ts
  - worker/src/sync/table-defs.ts
- Add validation checks so missing PKs, required timestamps, unsupported types, or missing tables are caught early (preferably at generation-time or startup).

Success criteria: cannot accidentally “support” a table in sync metadata that is incompatible with the actual SQLite schema.

### 5) Generic self-healing for schema mismatch (IndexedDB / SQLite WASM)

Problem: users can have a local DB created with an older schema, then load a newer build that expects a different schema.

Requirements for self-healing:
- Must be generic (no `practice_record`-specific logic).
- Must preserve safety and avoid silent corruption.
- Must not leak schema assumptions into the sync core.

Planned behavior:
- Detect schema mismatch at DB init (version/hash strategy to be documented and made deterministic).
- Preserve any pending local writes (push queue / outbox) before altering/replacing the DB.
- Rebuild or migrate the local DB to the new generated schema.
- Reinstall triggers and push-queue infrastructure as part of re-init:
  - src/lib/db/sqlite/sync-push-queue-triggers.ts
- Rehydrate local state via sync after schema correction rather than per-table “repair” routines.
- Sync core remains unaware of “why” healing happened; it only consumes the resulting schema/metadata contract.

Success criteria: upgrading the app with an older local IndexedDB does not require per-table hacks and results in a consistent local DB state.

### 6) Keep worker and client compatible

- Ensure worker remains compatible with the isolated engine + shared metadata approach:
  - worker/src/routes/sync.ts
  - worker/src/sync/table-defs.ts

### 7) Isolated testing

- Add Vitest coverage for sync-core and schema/codegen invariants (focus on determinism + “no table hacks”).
- Tests must be hermetic and schema-driven: each test creates its own Postgres tables/data in the local Supabase instance, then tears them down.
- Tests must follow the project rule: one input state, one output state (avoid conditionals inside tests).
- Test categories:
  - **Sync core behavior (unit/integration hybrid):** given a declarative table definition and a small dataset, verify diffing, normalization, and push/pull apply logic works identically for any table (proves no `practice_record` special cases).
  - **Schema/codegen determinism:** generation output is stable (no diff) when Postgres schema has not changed; generator fails loudly if it can’t map a type.
  - **Metadata/schema alignment:** validate that all tables declared in the shared registry exist in generated schema and have required columns/keys (PK, updated timestamps if required, etc.).
  - **Self-healing (generic):** simulate an “old local SQLite schema” and verify the healing flow triggers without any table-specific migration logic; verify it preserves pending local changes in the push queue and reinstalls triggers.

- Harness / structure recommendations:
  - Keep tests under a dedicated folder like tests subpaths (e.g., `tests/sync/…`) with minimal shared helpers for:
    - Creating a uniquely-named Postgres test table per test run (prefix + random suffix).
    - Inserting deterministic fixtures.
    - Dropping test tables reliably in `afterEach`/`afterAll`.
  - Prefer creating temporary tables in Postgres rather than relying on existing “real” app tables, so tests remain stable as the product schema evolves.
  - For SQLite-side validation/self-healing tests, use a Node-compatible SQLite implementation to construct “old schema” vs “new schema” DBs and run the init/heal routines deterministically.

- Explicit “no hacks” assertion:
  - Add at least one test that runs the same sync-core flow against two different test tables (different column sets / keys) with identical expectations, to prove core does not branch on table names.

Success criteria: tests validate sync behavior generically (no table-specific branching), codegen is deterministic, metadata/schema drift is caught automatically, and schema mismatch self-heals without introducing `practice_record`-style special cases.

## Acceptance / Verification Checklist

- [ ] Postgres is the only authoritative schema source; SQLite schema is generated.
- [ ] Generated SQLite schema is deterministic (running generation twice yields no diff).
- [ ] Sync core contains zero table-specific branching; no `practice_record` hacks remain in core paths.
- [ ] Self-healing triggers on schema mismatch (older IndexedDB) and completes without per-table logic.
- [ ] After self-heal, triggers/push-queue infrastructure is correctly installed and sync resumes.
- [ ] Worker and client continue to share table metadata and remain compatible.

## Risks / Open Questions

- Generator strategy: DB introspection vs TS-schema AST transform vs drizzle-kit artifacts; decision must optimize correctness over convenience.
- Schema versioning: where version/hash lives (SQLite user_version vs meta table vs build/schema hash) and how it’s computed deterministically.
- Offline upgrade semantics: what must be preserved across heal (push queue, auth state, local-only drafts), and what can be safely rehydrated from server.

## Follow-ups (Epic #304)

- Add CI drift checks so generated artifacts never go stale.
- Standardize and document upgrade guarantees (strict migration vs safe rebuild + rehydrate).
- Consider moving sync-core into a more library-like package boundary once PR1 stabilizes.

### PR checklist

#### Architecture / Scope
- [ ] Sync-core boundary is explicit and documented (what’s “core” vs “app glue”).
- [ ] Sync-core contains **no table-specific branching** (no `practice_record` hacks).
- [ ] Worker and client both consume the same shared sync table metadata.

#### Schema Source-of-Truth + Codegen
- [ ] Postgres is the only schema source-of-truth.
- [ ] SQLite Drizzle schema is generated from Postgres (no manual edits).
- [ ] Codegen is deterministic (re-running yields no diff).
- [ ] Generator fails loudly on unsupported types/constraints (no silent fallbacks).
- [ ] Registry/metadata is validated against generated schema (PKs/required columns present).

#### Self-healing (Upgrade Reliability)
- [ ] App detects local SQLite schema mismatch at startup.
- [ ] Self-healing is **generic** (no per-table repair logic).
- [ ] Pending local writes (push queue/outbox) are preserved across heal.
- [ ] Triggers/push-queue infrastructure is re-installed after heal.
- [ ] After heal, sync proceeds successfully and local DB is consistent.

#### Testing
- [ ] Vitest tests cover sync-core generic behavior across ≥2 different tables.
- [ ] Tests cover schema/codegen determinism and metadata/schema alignment.
- [ ] Tests cover schema mismatch → self-heal → sync resume flow.
- [ ] Tests use local Supabase and are hermetic (create/drop their own tables/data).

#### Dev Workflow / Docs
- [ ] schema-migration-strategy.md updated with the new “change once + generate” workflow.
- [ ] README/notes mention the codegen command(s) and when to run them.
- [ ] Any legacy/outdated “sync_outbox” terminology is aligned with the actual queue/trigger implementation (or explicitly defined).