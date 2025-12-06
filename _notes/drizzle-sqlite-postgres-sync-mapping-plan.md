# Drizzle ↔ SQLite ↔ Postgres Sync Mapping Plan

Status: Proposal (do not implement yet)

Owner: sboagy • Collaborator: GitHub Copilot

Last updated: 2025-11-15

---

## Objectives

- Unify and simplify field-name and shape transformations across the sync path.
- Centralize table metadata (primary keys, composite unique keys, timestamps) to remove scattered logic.
- Make mappings declarative, testable, and resilient to schema evolution.
- Improve performance and correctness for both syncUp (local → remote) and syncDown (remote → local).
- Eliminate duplicated snake_case/camelCase conversion code and case drift.

## Current State (As-Is)

- Mapping logic is largely centralized in `src/lib/sync/engine.ts`:
  - `transformRemoteToLocal` (snake_case → camelCase + light type coercions)
  - `transformLocalToRemote` (camelCase → snake_case)
  - `prepareLocalRow` (schema-aware filtering and defaults)
  - Conflict target construction (uses inline switch and `COMPOSITE_KEY_TABLES`)
  - `getLocalTable` maps Supabase table names to Drizzle SQLite schema tables
- Small duplication: `src/lib/services/practice-queue.ts` manually snake-cases queue rows before calling `queueSync`.
- Composite-key and PK rules are split between `COMPOSITE_KEY_TABLES`, `PRIMARY_KEY_COLUMNS`, and switch logic inside `syncTableDown`.
- Special-case handling exists for `daily_practice_queue` datetime format normalization (space vs ISO `T`).

## Pain Points

- Scattered knowledge about keys/timestamps across multiple places (map + switch blocks).
- Ad hoc snake_case conversion in `practice-queue.ts` duplicates logic and invites drift.
- Transform functions are open-coded; not table-scoped/adaptable per-table.
- Harder to test changes to mapping without running full sync.

## Guiding Principles

- Single source of truth for:
  - Field case conversion (snake_case ↔ camelCase)
  - Table keys (PK and composite unique keys)
  - Timestamp and default semantics
- Prefer declarative metadata over imperative branching.
- Keep the hot path efficient (precomputed maps; avoid repeated regex when possible).
- Clear boundaries: “adapters” per table, pure and unit-testable.

## Proposed Architecture (To-Be)

1) Casing Utilities (Shared, Pure)
- `camelizeKeys(obj)`, `snakifyKeys(obj)` in `src/lib/sync/casing.ts`.
- Offer object-wide conversion with stable behavior; prefer precomputed per-key maps when available.

2) Table Metadata Registry
- `src/lib/sync/table-meta.ts` exporting a single registry object:
  - `primaryKey(table): string | string[]`
  - `uniqueKeys(table): string[] | null` (for UPSERT on remote)
  - `timestamps(table): string[]` (e.g., `last_modified_at`)
  - `booleanColumns(table): string[]` (if we need explicit conversion)
  - Optional static per-table transforms (e.g., normalize window start formats)
- Seed this from the current `COMPOSITE_KEY_TABLES` and `PRIMARY_KEY_COLUMNS`, plus the conflict-target switch in `syncTableDown`.

3) Table Adapters (Per-Table, Declarative)
- `getSyncAdapters(tableName)` returns an object with:
  - `toLocal(remoteRow)`: snake_case → camelCase + type coercions
  - `toRemote(localRow)`: camelCase → snake_case (+ booleans if needed)
  - `conflictKeys`: derived from metadata
- Default adapter uses casing utilities + generic rules, with optional overrides per table.

4) Unified Transform Entry Point
- Replace separate `transformRemoteToLocal`/`transformLocalToRemote` calls with adapter usage:
  - `const { toLocal, toRemote, conflictKeys } = getSyncAdapters(table)`
  - Keeps `engine.ts` small and table-agnostic.

5) Queue Handling Simplification
- Always enqueue camelCase objects in `queueSync`.
- Perform snakify centrally in `engine.processQueueItem` via `toRemote`.
- Remove manual snake_case loop in `practice-queue.ts`.

6) Validation Layer (Optional but Recommended)
- Add Zod schemas (or light validators) per table to validate adapter outputs.
- Catch drift early when schema evolves.

7) Conflict Targets and Timestamp Policy
- Derive conflict target columns from registry for both upsert paths (local and remote).
- Keep “last-write-wins” policy with explicit timestamp compare when present.
- Continue special-case normalization for `daily_practice_queue` datetime (space vs `T`) but encapsulate in the table adapter or a small helper.

## Phased Plan (No Code Changes Yet)

Phase 0 — Design & Sign-off (you are here)
- Document goals, scope, and design (this doc).
- Identify all affected tables (already covered in `engine.ts`).
- Q&A to align on decisions and naming.

Phase 1 — Utilities + Registry Skeleton
- Add `casing.ts` with `camelizeKeys`/`snakifyKeys` and tests.
- Add `table-meta.ts` with the initial metadata extracted from `engine.ts`.
- No behavior change yet; just utilities + tests.

Phase 2 — Adapters API + Defaults
- Implement `getSyncAdapters(table)` with default behavior using casing utils.
- Provide minimal unit tests that prove identity for a couple tables.

Phase 3 — Adopt Adapters for syncUp
- In `engine.processQueueItem`, replace direct `transformLocalToRemote` with adapter `toRemote`.
- Keep existing logic otherwise; add unit tests for upsert/delete shapes per table.

Phase 4 — Adopt Adapters for syncDown
- In `syncTableDown`, replace `transformRemoteToLocal` with adapter `toLocal`.
- Move conflictTarget derivation to table metadata; update `prepareLocalRow` if needed to pull defaults from metadata.

Phase 5 — Remove Duplication
- Replace manual snake_case loop in `practice-queue.ts` with enqueuing camelCase only.
- Ensure `queueSync` consumers don’t rely on ad hoc casing.

Phase 6 — Validation (Optional)
- Introduce Zod (or similar) for adapter outputs in CI/unit tests.
- Validate presence of conflict keys and timestamp fields when applicable.

Phase 7 — Performance Pass
- Precompute per-table key maps to avoid repeated regex for casing conversions.
- Micro-bench adapter hot paths if needed.

Phase 8 — Migration Hygiene
- Encapsulate `daily_practice_queue` datetime normalization (space vs `T`) as a table-specific normalization helper.
- Add one-time cleanup utilities if we need to reconcile legacy rows.

Phase 9 — Documentation & Hand-off
- Update repo docs to describe mapping flow and table metadata registry.
- Add “How to add a new table to sync” checklist.

## Acceptance Criteria (Per Phase)

- Phase 1: Utilities and registry compile; unit tests pass; no runtime behavior change.
- Phase 3–4: All integration/e2e tests green; sync behavior unchanged; casing handled centrally.
- Phase 5: No manual snakify logic remains outside adapters/engine.
- Phase 7: No measurable performance regression; ideally improved.
- Phase 9: Clear onboarding doc for adding a new table.

## Risks & Mitigations

- Schema drift: Mitigate with metadata registry as single source of truth + adapter tests.
- Mixed datetime formats: Keep targeted normalization for `daily_practice_queue` in one place.
- Over-generalization: Start with pragmatic defaults; allow per-table overrides.

## Open Questions

1) Validation scope: Do we want strict Zod enforcement in production or only in tests/CI?
2) Boolean handling: Are there any columns where SQLite integer ↔ Postgres boolean causes friction today?
3) Incremental sync: When we introduce timestamp-based incremental fetch, should adapter stamp normalization also standardize to UTC ISO only?
4) Registry source of truth: Should we generate metadata from Drizzle schemas or maintain a hand-authored registry for clarity?

## Out of Scope (for this plan)

- Implementing incremental (timestamp-based) sync windows.
- Changing conflict policy (still last-write-wins).
- Any RLS or Supabase policy changes.

## Adjacent Considerations

- Drizzle `COALESCE(...)` parsing limitations: when composing view-like queries in SQLite, prefer `sql`` tagged templates or post-process in adapters where appropriate.
- E2E confidence: Keep Playwright coverage for critical flows (practice queue, playlist edit, tune edit) during rollout phases.

## Rollback Plan

- Adapters are additive; we can feature-flag adapter usage for syncUp/syncDown separately.
- Keep original transform functions available until full confidence; toggles allow quick rollback.

## Review Checklist

- Does the metadata registry capture all composite keys and non-standard PKs used today?
- Are any tables missing timestamp fields for last-write-wins?
- Do adapters cover known special cases (e.g., `daily_practice_queue` window formats)?
- Are all manual casing conversions removed outside of adapters/engine?

---

Please review and leave comments. Once we agree on the approach and phases, we can create issues for each phase and implement incrementally with tests.
