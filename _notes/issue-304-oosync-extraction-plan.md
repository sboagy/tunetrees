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

---

## Status Update (2026-02-20)

### Phase 6 — Completed

- TuneTrees sync parity validated in branch workflow.
- Local E2E status (current): broad Playwright run is passing overall (`593` passed, `3` flaky, `54` skipped), with no recurrence of the prior sync runtime bootstrap failure signatures.

### Phase 7 — Completed

- Created standalone `oosync` package workspace in `iss-304-repo-oosync-f2` with:
  - mirrored `src/` + `worker/` sources,
  - package manifest (`name: "oosync"`), exports, scripts,
  - package-local dependency installation for linked execution.
- Linked package into TuneTrees via `npm link` / `npm link oosync`.
- Removed TuneTrees direct source coupling for active paths:
  - TS path aliases now resolve `@oosync/*` and `@oosync-worker/*` through `node_modules/oosync/*`.
  - Vite `@oosync` alias now resolves to `node_modules/oosync/src`.
  - Codegen scripts now execute from `node_modules/oosync/src/codegen-schema.ts`.
  - Sync tests updated to import from `@oosync/*` aliases (no direct `../../../oosync/src/...` imports).

### Validation evidence

- `npm run codegen:schema:check` ✅
- `npm run typecheck` ✅
- `npx tsc -p worker/tsconfig.json --noEmit` ✅
- `npx vitest run tests/lib/sync/casing.test.ts tests/lib/sync/table-meta.test.ts tests/lib/sync/adapters.test.ts` ✅ (`119` passed)
- `npm run test:e2e:chromium:both` ✅ (`593` passed, `3` flaky, `54` skipped)
- Standalone repo: `npm test` ✅ (`sync-core-no-table-hacks` guard)

### Remaining

- Phase 8 hardening closeout:
  - ✅ forbidden-term/runtime audit rerun completed,
  - ✅ final migration note + rollback steps captured,
  - optional follow-up to de-couple app-specific `oosync` test fixtures still intentionally deferred by decision.
- Residual flaky E2E tests remain to be triaged separately (non-blocking for extraction status).

### Phase 8 — Hardening update (2026-02-21)

- Forbidden-term runtime audit rerun in standalone `oosync` (excluding tests/manual/generated):
  - `grep -RniE "genre|repertoire|playlist|tune|practice_record|user_profile|selectedgenres|genrefilter" src worker/src --exclude='*.test.ts' --exclude='*.manual.ts' --exclude-dir='generated'`
  - Result: clean (`audit-exit-1`, no matches).
- Genericity fixes applied to standalone runtime:
  - removed app-specific project names from schema-agnostic comments,
  - replaced hardcoded RPC param cast branch (`p_genre_ids`) with generic cast inference in worker runtime.
- Standalone package compile hardening:
  - added missing dev dependency `@cloudflare/workers-types` required by `worker/tsconfig.json`.
- Fresh revalidation evidence (post-extraction CI stabilization):
  - `npm --prefix /Users/sboag/gittt/oosync.worktrees/iss-304-repo-oosync-f2 test` ✅ (`sync-core-no-table-hacks` guard)
  - `npx tsc -p /Users/sboag/gittt/oosync.worktrees/iss-304-repo-oosync-f2/worker/tsconfig.json --noEmit` ✅
  - Cross-repo CI dependency source now resolves to published branch `iss-304-repo-oosync-f2` (with branch-first matching still preferred).

### Migration note (Phase 7/8 cutover state)

- TuneTrees now consumes `oosync` through `node_modules/oosync/*` aliases and linked package scripts.
- Standalone `oosync` repo is source for package/runtime evolution; TuneTrees no longer depends on in-repo `./oosync/src` paths for active sync integration.

### Rollback plan (safe fallback)

1. Unlink standalone package in TuneTrees:
   - `npm unlink oosync`
   - `npm install`
2. Restore TuneTrees local-path integration:
   - revert `tsconfig.app.json`, `tsconfig.node.json`, `worker/tsconfig.json`, `e2e/tsconfig.json`, `vite.config.ts`, `package.json` to `./oosync/...` paths/scripts.
3. Restore direct local sync test imports where needed (if rollback includes test path rollback).
4. Validate rollback:
   - `npm run codegen:schema:check`
   - `npm run typecheck`
   - `npx tsc -p worker/tsconfig.json --noEmit`
   - `npx vitest run tests/lib/sync/casing.test.ts tests/lib/sync/table-meta.test.ts tests/lib/sync/adapters.test.ts`
5. Keep standalone repo unchanged; rollback is app-consumer-side only.

### oosync dependency plan (short / medium / long)

#### Short term (now; branch stabilization)

- **Status:** superseded by medium-term pinned dependency workflow (2026-02-22).
- **Historical note:** branch-resolution checkout logic was used temporarily for extraction stabilization and is now removed from CI.

#### Medium term (next 1–2 milestones)

- **Versioned release cadence:** tag oosync releases (`v0.x.y`) and consume immutable tags/SHAs in TuneTrees CI instead of floating branches.
- **Dependency declaration:** add explicit `oosync` dependency in TuneTrees `package.json` using git tag/SHA (or keep checkout-install path until npm publish is ready).
- **Automation:** add a small update workflow/script to propose SHA/tag bumps and run TuneTrees smoke checks (`codegen:schema:check`, typecheck, sync-focused tests).

#### Medium term implementation status (2026-02-22)

- TuneTrees now declares `oosync` as a pinned immutable tarball dependency in `package.json` (`https://codeload.github.com/sboagy/oosync/tar.gz/<sha>`).
- CI and Lighthouse workflows now rely on `npm ci` for dependency installation and no longer include custom `.deps/oosync` checkout/fallback steps.
- Added dependency bump helper script: `npm run deps:oosync:update -- <tag-or-sha>`.
- Added explicit developer workflow documentation: `docs/development/oosync-workflow.md`.

#### Long term (package maturity)

- **Publish target:** scoped npm package (for example `@sboagy/oosync`) with semver.
- **Publish automation:** GitHub Actions release workflow in `oosync` repo (triggered by tag/release) to publish to npm with provenance.
- **Consumer end-state:** TuneTrees uses regular semver dependency + plain `npm ci` in CI/deploy, removing multi-checkout install steps.
- **Safety net:** keep emergency fallback documented (pin to git SHA) for zero-day rollback if npm release introduces regressions.
