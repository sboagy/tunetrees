# tunetrees/models/AGENTS Instructions

Scope: SQLAlchemy 2.0 declarative models & related Pydantic schemas. Maintain data integrity and scheduling semantics.

## Core Model Principles

- SQLAlchemy 2.0 style only (`select(Model)`, `session.execute(stmt)`).
- PracticeRecord uniqueness: `(tune_ref, playlist_ref, practiced)` must never duplicate. Timestamp uniqueness enforced via helper—never manually reuse practiced timestamps.
- `due` field purpose: next scheduled review time ONLY. Do not overload for last practiced or override states.
- Views depend on stable semantics (effective due = `COALESCE(scheduled, latest_due)`). Keep this pattern intact across changes.

## Safety & Change Process

Before altering models:
1. Backup production DB (external process) or run dry-run migration locally.
2. Update model classes + any Pydantic schemas.
3. Synchronize SQL views (see `sql_scripts/AGENTS.md`).
4. Run affected tests (practice, scheduling, history). Add edge cases for new/renamed columns.
5. Verify counts of critical tables unchanged or explain deltas.

## PracticeRecord Invariants

- Unique composite key holds post-change.
- New rows stamp current practiced timestamp via helper (do not hand craft collisions).
- History rows remain stable—no retroactive mutation of historical evaluations.
- FSRS/SM2 related fields additions require scheduling tests update.

## Adding Columns

Checklist:
- [ ] Column added to model.
- [ ] Migration/seed logic updated (if applicable).
- [ ] Views referencing column updated.
- [ ] Query layer adjusted (app services).
- [ ] Tests extended (creation, retrieval, edge cases).

## Removing / Renaming Columns

- Provide migration script; maintain backward compatibility where feasible.
- Update JSON state keys (e.g., stored table settings) via dedicated script in `scripts/` with dry-run & backup.

## Query Efficiency

- Use bulk operations / `in_()` lists for multi-row fetch.
- Avoid N+1: prefer joined eager loads when multiple related rows needed.
- Serialize minimal field sets for API responses.

## Error Handling

- Rollback session on exception; propagate error upward.
- Wrap critical write blocks with try/except ensuring atomicity for multi-row operations.

## Tests Interaction

Tests under `tests/` rely on invariants here; supply factories/fixtures centrally—do not duplicate creation logic inside test modules.

## Prohibited

- Raw connection SQL bypass unless explicitly justified.
- Silent mutation of historical data.
- Reassigning `due` semantics for unrelated business logic.

## References

Global architecture: root `AGENTS.md`. Scheduling interpretation: legacy references allowed for logic only (NOT frameworks). View maintenance: `sql_scripts/AGENTS.md`.

---
Maintain strict minimalism. Update only when schema semantics change.
