# Goals implementation checkpoints (#426)

PR #940 is the implementation PR for the full goals plan, not a separate
upgrade-only feature. The approved detailed plan remains in `_notes/426_goals_plan.md`.

## Completed baseline

- oosync rebuild protection, TuneTrees preservation policy, blocked-upgrade UI,
  and durable full-download recovery marker.
- Baseline CI passed quality/unit tests, all four Playwright shards, PWA offline,
  Lighthouse, CodeQL and SonarCloud. Staging deployment was skipped for the draft.

## Checkpoint 1: built-in definitions and calculation contract

`src/lib/goals/builtins.ts` is the editable source for built-in labels, evaluation
IDs/actions, interval ladders and daily defaults. It retains existing goal UUIDs.
The current scheduler's legacy ladder fallback reads these intervals, preserving
its behavior. New definitions are not yet written to the database.

`config.ts` validates versioned JSON, byte limits, daily min/max, explicit actions,
and scheduler/choice consistency. Overrides merge daily properties individually
and replace scheduler/evaluation sections whole. Empty overrides restore inherited
values; display names remain separate from identity. Returned objects are copies.
The current contract covers built-in FSRS-6 and interval ladders; plugin descriptors
and compatibility decoding will be added with the plugin execution integration.

`ladder.ts` calculates a pure preview from the latest supplied submitted record.
It retains state only for the same goal, scheduler/version and interval hash.
Reset/back/stay/advance clamp at the ends. Actual timestamps are quantized to
seconds before due/interval calculation; fractional-day results remain fractional.
The legacy integer projection is returned separately and never drives the due date.
The new calculator is not yet connected to staging/Submit: that requires the new
schema and atomic predecessor/config checks first.

The pinned ts-fsrs compatibility API supplies FSRS-6 defaults: maximum interval
36,500 days, retention 0.9, 21 weights and false fuzz. The migration must preserve
existing explicit Recall preferences, including a smaller saved maximum; these
new defaults do not replace stored personal values.

Validation covers developer-default inheritance, user overrides, label changes,
action remapping, isolated instances, malformed JSON/configurations, ladder
boundaries, fractional due times, changed-goal/changed-ladder resets and pure previews.

## Remaining checkpoints

1. Additive schema, protected settings/goal ownership, identity and payload guards,
   generated contracts, seed migration from the definition source, and real sync
   round-trip tests. Audit legacy identity collisions before backfill.
2. Effective DB resolver, canonical history order and legacy decoder; selected
   scheduler execution, plugin contracts, staged snapshots, stale-preview checks,
   fractional event commit and idempotency/conflict enforcement.
3. Per-goal queue allocation across generation, Refresh and manual additions,
   retained work accounting and displayed-event links.
4. Consolidated settings, goal-aware evaluation/history displays, Practice again,
   desktop/mobile E2E and final documentation.

Each checkpoint should pass its local checks before push. Keep #940 a draft until
these behaviors and the coordinated cutover are reviewed. No deployment or data
wipe is implied by an implementation checkpoint.
