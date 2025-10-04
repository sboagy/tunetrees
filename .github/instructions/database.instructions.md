---
description: "TuneTrees database schema, invariants, and safety rules"
applyTo: "tunetrees/models/**/*.py,tunetrees/app/**/*.py,sql_scripts/**/*.sql,tests/**/*.py"
---

# TuneTrees Database Instructions

These instructions guide Copilot edits touching database models, SQL scripts, or tests that depend on schema. The project is database-first.

## Core Architecture Context

- Backend: FastAPI + SQLAlchemy 2.0 (declarative models live in `tunetrees/models/`).
- Critical table: `practice_record` with unique constraint on `(tune_ref, playlist_ref, practiced)`.
- Spaced repetition fields: `due` (next target date) on `PracticeRecord`; historical/latest rollups exposed via SQL views.
- Date handling: Use consistent format string `%Y-%m-%d %H:%M:%S` (see `TT_DATE_FORMAT`). Prefer UTC when serializing or comparing.
- SQLAlchemy 2.0 style queries are required: `select(Model).where(Model.field == value)`.

## Non-negotiable Safety Rules

1. Always back up production before any destructive change. Prefer dry runs first.
2. Never bypass model helpers that enforce uniqueness/timestamps. Do not manually reuse `practiced` timestamps.
3. Validate changes: record counts in critical tables remain consistent or have an explained delta.
4. Keep SQL views in sync with model field changes. Update both `sql_scripts/view_practice_list_joined.sql` and `sql_scripts/view_practice_list_staged.sql` when schemas change.

## PracticeRecord Invariants (must hold after any change)

- New entries must not violate unique `(tune_ref, playlist_ref, practiced)`.
- `due` represents next due time for scheduling; do not overload it for other meanings.
- Effective due used in listings is typically `COALESCE(scheduled, latest_due)` in views/queries—preserve that pattern.
- Write paths that create a new `PracticeRecord` should rely on the helper that stamps the current timestamp to ensure uniqueness.

## Data and View Consistency

When changing fields used in scheduling or history views, ensure the views and any derived fields remain semantically correct. Preserve the effective-due pattern and avoid introducing duplicate historical rows.

## When Changing the Schema

If you modify models or tables:

- Update SQLAlchemy models in `tunetrees/models/` and corresponding Pydantic schemas if any.
- Update SQL views in `sql_scripts/` that reference the changed columns.
- If persisted UI state (e.g., JSON in `table_state.settings`) is affected by renames, add a dedicated Python script under `scripts/` to migrate those keys, with a dry-run mode and backups.
- Review and update backend query code in `tunetrees/app/` that selects/serializes these fields—keep 2.0 query style and avoid N+1.
- Add or update pytest cases in `tests/` that cover the changed behaviors (including edge cases for missing/renamed columns).

## Coding Standards (DB layer)

- SQLAlchemy 2.0 only; do not introduce 1.x patterns.
- Rollback on exceptions during DB writes; log and re-raise.
- Batch queries using `in_()` where relevant; avoid N+1 in loops.
- Keep FSRS/SM2 logic changes isolated; if you add fields used by schedulers, extend enums and tests accordingly.

## Quality Gates for DB-affecting changes

Before considering changes complete:

- Ruff: `python -m ruff check tunetrees/` (no warnings); format with `python -m ruff format`.
- isort/black: If added by workflow, run them on changed Python files.
- Tests: Run `pytest tests/` for backend logic impacted by schema.
- Optional: smoke-boot the API locally to ensure tables/views load without errors.

## Checklists

Schema change checklist:

- [ ] Models updated in `tunetrees/models/`
- [ ] SQL views updated in `sql_scripts/`
- [ ] Queries/serializers updated in `tunetrees/app/`
- [ ] JSON/state migrations added in `scripts/` if needed
- [ ] Tests added/updated in `tests/`

Data consistency checklist (when schema or view definitions change):

- [ ] Existing history and scheduling rows remain valid
- [ ] Effective due computation still correct in views/queries
- [ ] No duplicate `(tune_ref, playlist_ref, practiced)` rows created by write paths

## Notes for Contributors (Copilot behavior)

- Prefer minimal, targeted changes that preserve invariants and safety steps.
- When writing scripts that touch the DB, include backup and validation steps.
- When adding new columns used by scheduling, update test data generators and any seed scripts.
- Document complex data transforms in `docs/` and reference them from commit messages.
