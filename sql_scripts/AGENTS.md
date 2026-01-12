# sql_scripts/AGENTS Instructions

Scope: SQL view definitions & migration scripts.

Inherits global execution guardrails from `.github/copilot-instructions.md` and repository domain context from root `AGENTS.md`.

## Purpose of Views

Provide consolidated history & scheduling rollups (e.g., effective due via `COALESCE(scheduled, latest_due)`). Serve read endpoints efficiently; reduce application-side joins.

## Change Workflow

When schema fields change (added/renamed/removed):
1. Identify affected views (practice history, scheduling list, staged variants).
2. Update corresponding `.sql` files here.
3. Adjust consuming queries (see `tunetrees/app/AGENTS.md`).
4. Run tests validating counts & effective due correctness.
5. Document migration rationale in `_notes/`.

## Consistency Rules

- Preserve effective due pattern; never inline custom logic diverging from models semantics.
- Do not add business logic that belongs in application layer (e.g., complex conditional scoring).
- Maintain clear column aliasing—avoid ambiguous names.

## Safety

- Dry-run destructive alterations in staging/local before production.
- Version migration scripts separately; ensure reversible operations when feasible.

## Prohibited

- Embedding UI formatting (dates, strings) in views.
- Overloading `due` or historical timestamp meanings.
- Introducing duplicate rows through improper joins.

## Testing Hooks

Tests should validate: row counts stable (or explained), uniqueness preserved, effective due correct for sample fixtures.

## References

Models invariants: `tunetrees/models/AGENTS.md`. Query consumption: `tunetrees/app/AGENTS.md`. Global architecture & scheduling: root `AGENTS.md`.

---
Update views only with corresponding model & service changes; keep minimal & performant.
