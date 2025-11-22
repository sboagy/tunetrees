SQL View Consolidation – Refined Plan

## Objective
Eliminate duplication and drift across SQLite (local/offline) and Postgres (Supabase) view definitions by: establishing canonical Postgres sources, auto‑generating SQLite variants, removing redundant scripts/pgView definitions, and adding CI drift detection. Preserve test simplifications and maintain scheduling integrity.

## Scope (7 Views)
Core: view_playlist_joined, practice_list_joined, practice_list_staged
Readable (SQLite‑only today): view_daily_practice_queue_readable, view_transient_data_readable, view_practice_record_readable, view_tune_override_readable
Test Simplified: drizzle/migrations/sqlite/test-views/practice_list_staged.sql (retain as-is)

## Current Duplication Map
Postgres sources (duplicated): supabase/migrations/*.sql, scripts/create-views.ts, scripts/create-views-direct.ts, drizzle/migrations/postgres/schema.ts (pgView), sql_scripts/view_practice_list_staged.sql
SQLite sources: src/lib/db/init-views.ts (all 7), sql_scripts/view_practice_list_staged_sqlite.sql, test simplified view file.
Readable views absent from Postgres (decision: promote or keep local-only). 

## Canonical Source Strategy
Primary canonical: One Postgres .sql file per view under sql_scripts/views/postgres/. Rationale: reflects production dialect, enables direct Supabase migration diffing, easiest to audit. SQLite derived artifacts generated into sql_scripts/views/sqlite/ via transformer.

## Transformation Rules (Deterministic)
1. STRING_AGG(x, ' ') → GROUP_CONCAT(x, ' ')
2. DISTINCT ON (a,b) ORDER BY a,b,id DESC → Subquery selecting MAX(id) per (a,b) joined back
3. Boolean literals true/false → 1/0 (retain CASE expressions)
4. Double-quoted identifiers removed unless reserved; generate unquoted snake_case.
5. Interval / timestamp unchanged (already basic usage); verify no PostgreSQL-only date functions.
6. ANY(ARRAY[...]) in check / policy expressions not in views (views avoid; skip).
7. CAST ' '::text removed → plain ' '
8. string_agg alias formatting → group_concat alias formatting consistent.

## Generator Design
Script: scripts/generate-views.ts
Input: postgres/*.sql templates
Process: line-by-line transform applying regex rules + DISTINCT ON pattern replacement.
Output: sqlite/*.sql parallel filenames.
Validation: After generation, load into ephemeral SQLite, ensure CREATE VIEW succeeds; optional row count smoke test.
Idempotency: Running twice produces no diff.

## Integration Steps
Phase A (Extraction)
- Move existing canonical Postgres definitions (all 3 core + 4 readable newly authored) into sql_scripts/views/postgres/.
- Author Postgres equivalents for readable views (port from SQLite definitions; replace GROUP_CONCAT with STRING_AGG; reintroduce DISTINCT ON if needed).

Phase B (Generation)
- Implement generator & produce sqlite/*.sql.
- Diff generated SQLite versions with existing manual ones (init-views + staged SQLite file) → align columns/order; adjust trailing commas, whitespace.

Phase C (Consumption)
- Refactor src/lib/db/init-views.ts: replace inline SQL constants with file reads of generated sqlite/*.sql; loop create.
- Remove scripts/create-views.ts & scripts/create-views-direct.ts (or mark deprecated, then delete). Provide migration playbook.
- Drop pgView definitions from drizzle/migrations/postgres/schema.ts (views managed purely by migration SQL). Document rationale in file header comment.

Phase D (Testing & Drift)
- Add npm script: "check:views" → run generator, git diff --exit-code on sqlite outputs & postgres templates.
- Unit test: simple parser confirming expected column presence for each view.
- Keep test simplified view untouched; add README comment clarifying exclusion from generator.

Phase E (CI Enforcement)
- CI job executes: npm run typecheck && npm run check:views. Fails if drift.
- Optional periodic Supabase schema dump compared to concatenated postgres canonical files (detect remote divergence).

## Postgres Promotion Decision (Readable Views)
Option A: Promote now – ensures parity & remote analytics.
Option B: Defer – local-only views reduce remote complexity.
Recommended: A (consistent mental model + future remote reporting). Mitigation: mark them as read-only and behind RLS if needed.

## Risks & Mitigations
- Column Drift: Mitigate via single source + CI diff.
- Transformation Edge Cases: Maintain unit tests for a DISTINCT ON + STRING_AGG pattern.
- Performance Regression SQLite: Validate EXPLAIN where necessary for MAX(id) subquery vs prior pattern.
- Developer Confusion: Provide README in views directory explaining flow.

## Deletions / Deprecations
Remove: scripts/create-views.ts, scripts/create-views-direct.ts after Phase C.
Remove: pgView(...) declarations for the three core views.
Inline view constants in init-views.ts eliminated.

## Deliverables Checklist
[ ] postgres templates for 7 views
[ ] generator script + tests
[ ] generated sqlite views
[ ] refactored init-views.ts loader
[ ] removed legacy creation scripts
[ ] removed pgView definitions
[ ] CI drift check command
[ ] documentation updates (README + database.instructions.md cross‑refs)

## Open Questions (Document Before Implementation)
1. Retain any pgView for typed query hints? (If yes, mark auto-generated & single import location.)
2. Need fallback if a view fails in offline mode? (Strategy: skip + warn, proceed app with reduced features.)
3. Should readable views share a naming prefix? (Consistency vs churn.)

## Next Immediate Action
Implement postgres template extraction & generator scaffolding (Phase A/B).
