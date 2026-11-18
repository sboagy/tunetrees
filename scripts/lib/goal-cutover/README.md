# One-time goals migration (#426)

This directory holds the migration-only TypeScript helpers. Node entry points and
transaction helpers live under `scripts/` and `scripts/lib/`. None is imported by
browser entry points. Runtime defaults, configuration validation and goal identity
resolution remain shared in `src/lib/goals/`.

Use the [cutover runbook](../../../docs/development/goals-cutover.md) for backup,
synchronization, command invocation and device refresh. Production execution waits
for the complete #426 release. Progress and review history belong in
[implementation notes](../../../docs/development/goals-implementation.md).

## Entry points

- `scripts/migrate-goals.mjs`: normal operator command. Locks tables, prepares a
  fresh plan, applies it and verifies no eligible writes remain in one transaction.
  Rolls back by default; `--apply` commits. No exported plan is required. Ordinary
  schema promotion does not invoke it automatically.
- `scripts/audit-goal-cutover.mjs`: local read-only diagnostic using a repeatable-read
  snapshot. Optional `--prepare <new-plan.json>` exports a private review artifact,
  refuses overwrite and never applies it.
- `scripts/rehearse-goal-cutover.mjs`: local-only application of an exported plan,
  always rolled back, including sync-log effects. No remote or commit mode.

The migration and audit share `goal-cutover-preflight.mjs` and
`goal-cutover-snapshot.mjs`. `goal-migration.mjs` orchestrates the transaction;
`goal-cutover-transaction.mjs` validates source values before writes inside a
savepoint. Exact retries make no further writes. Ownership and sync triggers stay
active; existing timestamps are checked after writes.

## Conversion contracts

`legacy-preferences.ts` prepares validated personal Recall overrides from the
synchronized server snapshot. Existing settings, including tombstones, are retained.
Old global preferences do not become a continuing runtime fallback.

`legacy-goals.ts` prepares supported custom FSRS/ladder definitions and converts
owner-defined keys to `custom:<UUID>`. Existing configuration, evaluation identities
and friendly labels are preserved. Unsupported plugin configurations, system-name
collisions and occupied target keys (including tombstones) block conversion.

`cutover-plan.ts` assembles definitions, absent Recall settings, references and
completed-queue event evidence. Exported artifacts currently use version 4;
regenerate older artifacts rather than applying them.

`reference-backfill.ts` shares owner-before-system identity resolution with
`src/lib/goals/references.ts`. It attributes unambiguous legacy history and active
assignments. `goal-reference-transaction.mjs` revalidates owners, full row content
and namespace resolution. Custom keys and affected active assignments change
atomically. Historical text, dates, scheduler data and sync timestamps remain intact.
A rename requires all resolvable affected references, so edited plans or newly
arrived history cannot lose attribution. Already attributed history and new-format
metadata are not rewritten. Unknown legacy references remain reported and
unattributed; incomplete new-format events without a goal identity block preflight.

`queue-completions.ts` links active completed legacy queue rows only when there is
no existing link and one same-owner/repertoire/tune event has a modification timestamp
exactly matching completion, with practice between generation and completion.
Timestamp normalization retains microseconds and permits delayed submission.
Ambiguous, damaged or partial/new-format evidence is reported, never guessed from
the latest record. Writers rederive evidence under queue/history locks, even on
retries, and compare the complete returned queue row. Goal-ID backfills are excluded
from event evidence comparison; other content changes invalidate it. Only the
displayed-event reference changes. Allocation snapshots and selection reasons belong
to runtime queue integration, not historical inference by this migration.

Any server `table_transient_data` row blocks preparation/application, including
sparse or note-only drafts. Staging is locked before the check and never cleared by
the migration. Server checks do not certify device-local drafts or outboxes; follow
the runbook's per-device preservation and explicit refresh procedure.

## Validation

Pure helper tests live in `tests/scripts/goal-cutover/`. These TypeScript helpers
are included in `tsconfig.node.json` and the standard lint/format commands.
Real Postgres tests run through `npm run test:db:goal-cutover`, covering timestamp
preservation, exact retries, stale/tampered plans, ownership, locking, pending drafts,
partial events, and whole-batch rollback after a late write failure. Fixture and
conversion writes roll back. The local database must be migrated, seeded and
cutover-ready as described in the runbook.
