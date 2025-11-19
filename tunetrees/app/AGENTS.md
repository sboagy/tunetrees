# tunetrees/app/AGENTS Instructions

Scope: Backend service/query logic consuming SQLAlchemy models. Ensure correctness, performance, and invariant preservation.

## Query Style & Patterns

- SQLAlchemy 2.0 only: `stmt = select(Model).where(Model.field == value)` then `session.execute(stmt)`.
- Prefer set-based operations; avoid per-row loops causing N+1 queries.
- Use joins for related entity hydration needed in single response.

## Invariant Preservation

When writing PracticeRecord creation/update paths:
- Use helper stamping practiced timestamp; never craft duplicates.
- Preserve `due` semantics: compute/update according to scheduling logic (FSRS/SM2) without overloading.
- Effective due calculations in code must mirror view formula (see `sql_scripts/AGENTS.md`).

## View Synchronization

If a field involved in any query referencing views changes:
1. Update views under `sql_scripts/`.
2. Adjust query field list accordingly.
3. Re-run tests covering list endpoints & scheduling.

## Performance Checklist

- [ ] Combined select rather than multiple sequential selects.
- [ ] Filtering done in DB (not Python loops).
- [ ] Proper indexes exist for newly intensive filters (add migrations as needed).

## Error & Transaction Handling

Wrap write ops:
```py
try:
    session.add(obj)
    session.commit()
except Exception:
    session.rollback()
    raise
```
Log meaningful context (entity ids) on failure; do not swallow exceptions.

## Scheduling Integration

- FSRS computations isolated: if adding fields consumed by algorithm, document in `_notes/` and extend tests.
- No direct mutation of historical evaluation rows when recomputing future `due` values.

## Testing Expectations

Service changes require: targeted unit tests for new logic + integration tests ensuring model & view coherence. Edge cases: duplicate attempt prevention, invalid foreign key handling, timezone consistency.

## Prohibited

- Raw SQL bypass without comment & justification.
- Coupling UI formatting into query layer (keep responses data-centric).
- Returning large unused payloads—trim to necessary fields.

## References

Models invariants: `tunetrees/models/AGENTS.md`. Global architecture: root `AGENTS.md`. Views: `sql_scripts/AGENTS.md`.

---
Keep lean; update only for new service logic or invariants.
