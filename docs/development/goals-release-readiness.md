# Goals Cleanup and Release Readiness

Audit baseline: `6cbe90f1`, 2026-11-25. This is a source/documentation audit;
it does not certify staging, production or every accessibility scenario.

## Cleanup Result

The superseded FSRS staging/recording services and
`src/lib/plugins/scheduling.ts` are removed. Searches of application, Worker and
test sources found no active callers of those removed implementations. Legacy
plugin factory names remain in rejection tests and historical fixture content;
they do not provide an alternative scheduling path.

Current execution uses `src/lib/goals/` and the explicit versioned plugin executor.
No browser/Worker source imports the operator-only goal-cutover helpers. The
remaining `src/lib/services/practice-queue.ts` reads queue windows; it is not a
parallel allocator.

These artifacts intentionally remain:

| Artifact | Why retained / removal condition |
| --- | --- |
| `practice-state.ts` legacy decoder | Reads real historical Recall records. Remove only after supported datasets no longer require it; malformed new JSON must never fall back to it. |
| Typed legacy columns and compatibility projections in calculation/commit | Preserve the existing storage contract while JSON is authoritative. Any schema removal needs a separately reviewed contract phase and old-client overlap assessment. |
| Goal-reference resolution and `queue.ts` legacy allocation freezing | Handle existing identities and freeze allocation metadata on older queues. These are data compatibility, not alternate schedulers. |
| `scripts/lib/goal-cutover/` and transaction tests | Required operator conversion and verification for staging/production; not browser code. Optional diagnostic tools are not mandatory rollout steps. |
| FSRS compatibility and rejected-factory tests | Protect numerical behavior and prevent reintroduction of the removed plugin API. Historical fixture scripts are data, not runtime entry points. |

## Documentation Corrections

- Replaced the obsolete FSRS-only scheduling reference and duplicated practice-flow
  guide with the current goal calculation, staging, Submit and queue contracts.
- Replaced the old plugin factory/implicit-fallback instructions with the versioned
  named-action API, state compatibility and explicit failure behavior.
- Corrected the architecture's fixed rating-interval illustration and absolute
  history immutability claim. Normal Submit appends; history correction remains #958.
- Marked implementation checkpoints and earlier extension proposals as historical.
- Reconciled the local plan, issue #426 and PR #940 checklists. Clarified that manual
  UI review and the practical second pass are complete, while release gates remain.
- Aligned the plan's device refresh instructions with the current cutover runbook.
  A hard refresh does not force a full download when the database version is unchanged.

## Remaining Acceptance Gates

- Finish CI for the final release SHA and retain desktop/mobile acceptance evidence.
- Verify or explicitly disposition the outstanding cases in the
  [UI review report](goals-ui-review.md): actual 200% browser zoom, physical mobile
  keyboard, screen-reader output and the full browser failure-state matrix.
- Rehearse against staging refreshed from production, compare history/settings/
  queue results, and verify device full-download and interrupted-download recovery.
- Back up production and approve the coordinated cutover before execution. Keep old
  clients closed; this audit does not establish safe concurrent old-client writes
  during semantic conversion. Follow the [cutover runbook](goals-cutover.md), including
  preserving pending and local-only work before any destructive local reset.

Deferred product work is tracked separately: history editing/deletion schedule and
sync repair (#958), calendar scheduling enforcement (#959), retention-model accuracy
(#953), and the broader whole-app design audit (#600). These are not additional
unimplemented #426 runtime paths.

## Validation Scope

This batch changes documentation only. Source-path/link checks and `git diff --check`
validate the edits; existing test results remain tied to their tested commits.
No database conversion, reset, server restart, deployment or runtime change was
performed for this audit.
