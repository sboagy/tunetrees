# ts-fsrs 6 package upgrade (#899)

## Model and API boundary

TuneTrees pins `ts-fsrs` to 6.0.0 and continues to use the FSRS-6 model.
Package v5 already used FSRS-6; upgrading the package is separate from adopting
FSRS-7. Node 24 is required, matching the supported app runtime.

The scheduling service deliberately retains the deprecated, still-supported
`fsrs()` compatibility API in this focused upgrade. It preserves the synchronous
constructor, snake-case card mapping, stored 17/19/21-element weight handling,
and existing plugin fallback. The new default scheduler selects FSRS-7, whose
34 weights and additional fast-memory state cannot be populated from the current
record by renaming fields. A future move to the new scheduler API should explicitly
select FSRS-6 first; adoption of FSRS-7 needs a separate history-replay design.

Sources: [v6 release notes](https://github.com/open-spaced-repetition/ts-fsrs/releases/tag/v6.0.0)
and [migration guide](https://open-spaced-repetition.github.io/ts-fsrs/guide/migration).
The guide recommends the new scheduler API for a full API migration; this PR
upgrades the package through its compatibility surface instead.

## Data and scheduling compatibility

- v6 removes `Card.elapsed_days`. TuneTrees still writes its existing
  `practice_record.elapsed_days` and returns `NextReviewSchedule.elapsed_days` to
  plugins, calculating it from the previous and current actual review timestamps.
  UTC calendar-day boundaries preserve v5 semantics, including a midnight crossing
  shorter than 24 hours. New/reset cards retain zero elapsed days.
- Rating/state numeric values remain unchanged. Rating index types now use `Grade`;
  persisted states are narrowed explicitly rather than asserted into a library type.
- Existing practice history, due dates, weights, stability, difficulty, repetition
  counts and lapse counts are not rewritten. No database migration, code generation,
  sync adapter change, or Worker query change is needed. Old PWA bundles and the new
  bundle read/write the same record format and use the same model.
- v6 keeps second precision in learning steps: with the default 1m/10m steps,
  Hard schedules 5m30s instead of v5's rounded 6m. This affects future reviews only.
- The upstream change from Alea to FNV-1a/Mulberry32 changes fuzzed interval
  sequences. Fuzz remains deterministic for identical inputs and respects the
  repertoire-derived cap; exact v5 fuzzed dates are not promised.
- Existing learning-step reconstruction (`learning_steps: 0`) and legacy
  `practice_record.step: 0` behavior are preserved. Improving learning-progress
  persistence is a separate behavior change, not silently bundled here.

## Related packages

Neither the installed Rhizome/oosync packages nor their adjacent source checkouts
declare or import ts-fsrs. No changes to either library are required. The Worker
transports practice records without running the scheduling algorithm.
`@open-spaced-repetition/srs-kit@1.0.0` is the new upstream transitive dependency.
TuneTrees' custom scheduler interface and FSRS fallback remain unchanged.

## Regression coverage

`tests/lib/fsrs-service.test.ts` captures all four ratings for new, learning,
review and relearning cards, persisted history, 17/19/21-element stored weights,
custom learning/relearning steps, UTC elapsed-day behavior, and fuzz determinism
and caps. The 19 snapshots were captured against 5.4.2 before the upgrade; only
the two Hard learning due dates were updated for the reviewed precision change.

The basic scheduling progression Playwright suite passes against the local app
and Worker. The plugin scheduler suite also passes, but its QuickJS invocation
logs an empty-origin rejection and times out before successfully falling back
to FSRS. This validates fallback, not successful custom-plugin execution; the
plugin-origin issue is outside this package upgrade. The multi-tune queue case
is already marked skipped in the repository, so it supplies no coverage.

All six `practice-004-evaluation-scheduling` cases and all three
`scheduling-007-new-tune-workflow` cases pass, covering persisted submissions,
queue removal, and New-to-Learning/Review transitions. In total, 11 application
E2E cases pass (plus the auth setup runs), with the one existing queue skip noted
above. The dev server was restarted on the correct worktree: the old #898 server
had occupied port 5173 while this branch's original server was on 5174.

## Audit snapshot

On November 6, 2026, the full root audit reports four moderate findings in the
existing `drizzle-kit` / `@esbuild-kit/esm-loader` / `@esbuild-kit/core-utils` /
`esbuild` chain. Root production-only and both Worker audits report zero findings.
These unrelated tooling findings remain tracked by #534; they are not dismissed
solely because they are development dependencies.

Clean `npm ci --ignore-scripts`, formatting, lint, typecheck, all 808 unit tests,
and the production build including WASM asset verification pass on Node 24.22.2.
