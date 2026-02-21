# Issue 304: oosync Extraction & Genericization Plan

## Objective

Make `oosync/` fully generic and fully isolated from TuneTrees semantics and schema assumptions, then move it to the standalone `iss-304-repo-oosync-f2` repo and consume it from TuneTrees via `npm link`.

## Success Criteria (Definition of Done)

1. `oosync/**` contains no hardcoded TuneTrees concepts (e.g. `genre`, `repertoire`, `tune`, `user_profile`) in runtime logic.
2. App-specific sync behavior is expressed only through:
   - `oosync.codegen.config.json`, and/or
   - generated artifacts produced from DB introspection/codegen.
3. Worker and client protocol contracts are schema-agnostic.
4. TuneTrees runs against external linked package (`npm link`) instead of local in-repo `oosync/` source coupling.
5. Targeted tests/typechecks pass for both repos after cutover.

## Current Coupling Inventory (verified hotspots)

### A) Worker runtime hardcodes app concepts

- `oosync/worker/src/index.ts`
  - `SyncContext.genreFilter` and payload handling use `selectedGenreIds` / `repertoireGenreIds`.
  - RPC parameter binding hardcodes `genreIds -> p_genre_ids` behavior.
  - Pull override merge logic hardcodes `collectionsOverride.selectedGenres`.
  - `user_profile` is special-cased in push remap/upsert handling.

### B) Worker schema layer hardcodes selected genre loading

- `oosync/worker/src/sync-schema.ts`
  - `loadUserCollections()` directly queries `userGenreSelection` and populates `selectedGenres`.
  - `getConflictTarget()` has `tableName === "user_profile"` special case.

### C) Protocol types are not generic

- `oosync/src/shared/protocol/sync-types.ts`
  - Defines `SyncGenreFilter`, `collectionsOverride.selectedGenres`, and request-level `genreFilter`.

### D) Client worker bridge leaks app concepts

- `oosync/src/sync/worker-client.ts`
  - Sends `genreFilter` in request payload.

### E) Casing fast-path map encodes TuneTrees schema

- `oosync/src/sync/casing.ts`
  - `COMMON_KEYS_SNAKE_TO_CAMEL` includes many TuneTrees-specific columns/tables.

### F) Codegen contains app fallback special case

- `oosync/src/codegen-schema.ts`
  - Special handling for `tableName === "user_profile"` during owner inference.

### G) Tests/docs include TuneTrees language

- Unit tests under `oosync/src/sync/*.test.ts` currently use TuneTrees table names extensively.
- Some comments/docs still mention TuneTrees directly.

---

## Execution Plan (phased)

## Phase 0 — Guardrails & Baseline

- Add a temporary “schema-agnostic guard” checklist for this branch.
- Capture baseline typecheck/tests for:
  - TuneTrees workspace (`iss-304-oosync-f2`)
  - standalone oosync repo (`iss-304-repo-oosync-f2`) as scaffold baseline
- Add a fast grep audit script for forbidden terms in `oosync/**` runtime files.

Deliverable: baseline report in `_notes` + reproducible command list.

## Phase 1 — Protocol & Override Contract Genericization

Replace genre-specific request shape with generic override mechanisms.

Planned contract shape:
- Keep `collectionsOverride` but make it generic key/value:
  - `Record<string, string[]>`
- Remove `SyncGenreFilter` and `genreFilter` fields.
- Introduce generic per-request parameter override channel for RPC/filter use (name TBD in implementation), e.g. `filterOverrides`/`paramOverrides` with schema-agnostic keys.

Rules:
- No runtime logic should branch on domain terms like `genre`.
- Any app-specific semantics must be interpreted through generated worker config.

Deliverable: protocol types + worker-client updated, with hard-cut migration notes (no legacy `genreFilter` shim).

## Phase 2 — Worker Runtime Genericization

Refactor worker implementation to be config-driven only.

- Remove `selectedGenres` hardcoding in sync flow.
- Replace RPC argument special-casing (`genreIds`) with explicit param mapping objects from generated worker config.
- Remove `genreFilter` merge logic from request handling.
- Replace `user_profile` branches with configurable identity/ownership behavior (codegen-driven), or remove if unnecessary after normalized conflict-target behavior.

Deliverable: `oosync/worker/src/index.ts` free of app-specific terms and table assumptions.

## Phase 3 — Worker Schema Layer Genericization

Refactor `createSyncSchema()` utilities:

- Remove direct `userGenreSelection` query path from `loadUserCollections()`.
- Ensure all collection loading is sourced from `workerSyncConfig.collections` only.
- Remove hardcoded conflict-target fallback by table name (`user_profile`), replacing with metadata/config rules.

Deliverable: `oosync/worker/src/sync-schema.ts` with zero app table-name branches.

## Phase 4 — Casing & Core Runtime Cleanup

- Remove or reduce TuneTrees-specific precomputed casing map in `casing.ts`.
  - Option A (preferred): purely generic regex conversion.
  - Option B: generated/per-app fast map injected from generated artifacts.
- Validate no performance regression of concern (quick benchmark or smoke timing).

Deliverable: casing utilities no longer encode app schema.

## Phase 5 — Codegen Model Alignment

Update `oosync/src/codegen-schema.ts` so app-specific behavior is inferred or configured, never hardcoded.

- Remove explicit `user_profile` special-case fallback.
- Extend generated worker config (if needed) to carry generic directives for:
  - identity-owned table behavior,
  - explicit rpc param mappings,
  - collection sources.
- Regenerate artifacts and verify no manual edits required.

Deliverable: codegen emits all required behavior for TuneTrees without custom runtime hacks.

## Phase 6 — TuneTrees Integration Update

In TuneTrees app/worker integration:

- Move any remaining app-specific sync behavior into:
  - `oosync.codegen.config.json`, and/or
  - generated files under app-owned output directories.
- Keep app behavior unchanged functionally (same user-visible sync semantics).

Deliverable: TuneTrees runs cleanly with app-specific semantics outside oosync core.

## Phase 7 — Repository Extraction & npm link

- Move finalized `oosync/` package code into `iss-304-repo-oosync-f2`.
- Ensure package exports/types/build are correct for npm consumption.
- In TuneTrees repo:
  - remove direct local-source assumptions,
  - use `npm link` to linked oosync package,
  - verify build/dev/test with linked package.

Deliverable: working multi-repo dev loop with `npm link`.

## Phase 8 — Verification & Hardening

- Run targeted checks:
  - TuneTrees unit tests touching sync
  - TuneTrees E2E sync scenarios (must pass; parity with current behavior)
  - oosync unit tests (last phase in this PR, or deferred follow-up PR)
- Run forbidden-term audit for runtime files.
- Produce final migration note + rollback plan.

Deliverable: release-ready extraction summary and evidence.

---

## Risk Register

1. **Protocol churn risk**: request shape changes can break worker/app compatibility.
  - Mitigation: coordinated hard cut on this branch (update client + worker together; no mixed-version deployment target).

2. **Generated artifact drift risk**: config/codegen mismatch may cause subtle sync behavior changes.
   - Mitigation: regenerate + drift-check + targeted sync scenario tests after each phase.

3. **Casing performance risk** if fast map is removed.
   - Mitigation: quick micro-benchmark and only reintroduce optimization via generated/injected map.

4. **Hidden table-specific assumptions** in tests/helpers.
   - Mitigation: add grep audit + incremental replacement with generic fixtures.

---

## Proposed Work Order for Next Chat Iteration

1. Implement Phase 1 contract changes (types + worker-client + worker request parsing).
2. Implement Phase 2+3 runtime/schema refactor (remove `genre` and `selectedGenres` assumptions).
3. Implement Phase 5 codegen changes and regenerate.
4. Update TuneTrees config + integration (Phase 6).
5. Run verification prioritizing TuneTrees functionality + E2E parity, then execute extraction/linking steps.
6. De-TuneTrees test fixture names/content in `oosync` as final-phase or follow-up PR work.

---

## Decisions (Locked)

1. **Protocol transition:** hard cut on this branch (no temporary backward compatibility for `genreFilter`).
2. **Generic RPC param binding:** use explicit mapping objects in generated worker config.
3. **Test refactor priority:** prioritize runtime extraction and TuneTrees functionality/E2E parity first; de-TuneTrees `oosync` test fixture cleanup is final-phase or follow-up PR work.
