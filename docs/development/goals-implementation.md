# Goals implementation checkpoints (#426)

PR #940 is the implementation PR for the full goals plan, not a separate
upgrade-only feature. The approved detailed plan remains in `_notes/426_goals_plan.md`.

## Completed baseline

- oosync rebuild protection, TuneTrees preservation policy, blocked-upgrade UI,
  and durable full-download recovery marker.
- Baseline CI passed quality/unit tests, all four Playwright shards, PWA offline,
  Lighthouse, CodeQL and SonarCloud. Staging deployment was skipped for the draft.

## Checkpoint 1: built-in definitions and calculation contract

`src/lib/goals/builtins.ts` is the editable source for built-in labels, intent descriptions, evaluation
IDs/actions, interval ladders and daily defaults. It retains existing goal UUIDs.
The current scheduler's legacy ladder fallback reads these intervals, preserving
its behavior. Checkpoint 2a persists these definitions without activating the new scheduler.

`config.ts` validates versioned JSON, byte limits, daily min/max, explicit actions,
and scheduler/choice consistency. Overrides merge daily properties individually
and replace scheduler/evaluation sections whole. Empty overrides restore inherited
values; display names and intent descriptions remain separate from identity.
The effective definition preserves descriptions and supports personal text overrides.
Goal descriptions now have storage; show them in goal selection
and expanded settings panels in the UI checkpoint; they do not affect scheduler state. Returned objects are copies.
The current contract covers built-in FSRS-6 and interval ladders; plugin descriptors
and compatibility decoding will be added with the plugin execution integration.

`ladder.ts` calculates a pure preview from the latest supplied submitted record.
It retains state only for the same goal, scheduler/version and interval hash.
Reset/back/stay/advance clamp at the ends. Actual timestamps are quantized to
seconds before due/interval calculation; fractional-day results remain fractional.
The legacy integer projection is returned separately and never drives the due date.
The new calculator is not yet connected to staging/Submit: that requires the new
schema and atomic predecessor/config checks first.

The pinned ts-fsrs model-specific exports supply the 21 FSRS-6 weights and
36,500-day maximum interval. The definition retains retention 0.9, false fuzz,
and the existing learning steps; regression fixtures protect these values. The migration must preserve
existing explicit Recall preferences, including a smaller saved maximum; these
new defaults do not replace stored personal values.

Validation covers developer-default inheritance, user overrides, label changes,
action remapping, isolated instances, malformed JSON/configurations, ladder
boundaries, fractional due times, changed-goal/changed-ladder resets and pure previews.

## Checkpoint 2a: goal configuration storage and ownership

The additive Postgres migration adds nullable `display_name`, `description` and
`default_config` to `goal`, plus `goal_user_settings` keyed by `(user_id, goal_id)`.
JSON TEXT preserves exact payloads; database checks require objects up to 64 KiB.
Application validators remain responsible for full scheduler/config semantics.
Legacy goal writes can omit the new fields. Old preference tables, queries and
scheduling remain in use. Recall preference copying is deferred until cutover,
so edits made while these checkpoints are developed will not be lost.

Worker ownership binding uses the Drizzle properties `privateFor` and `userId`.
Goals/settings use soft tombstones. Database triggers reject goal ownership/ID
changes, forged existing IDs, and settings pointing at another user's goal even
when writes bypass RLS. Direct authenticated access also has RLS. Shared defaults
require a trusted postgres transaction with `tunetrees.goal_seed_write = 'on'`.
Current UI deletion already uses soft deletes; normal legacy custom-goal writes
remain valid. This is intentional security tightening, not a schema contraction.

`npm run goals:seed:create -- supabase/migrations/<timestamp>_seed_goal_configuration.sql`
serializes `builtins.ts` into a new, non-overwritable migration and the reusable
`sql_scripts/seed_goal_configuration.sql`. Creation also updates
`config/current-goal-seed.json`; `goals:seed:check` reads that reference, so applied
historical migrations remain untouched. Both SQL outputs are generated; do not
hand-edit them. Seed upserts keep legacy technique/interval columns aligned with
`default_config` for the supported practice and settings consumers.
These initial seeds preserve existing timestamps and require the coordinated full
pull. A later release changing defaults must arrange its own incremental timestamp
update or explicit full pull. Personal override rows are never reseeded.
Staging refresh explicitly authorizes its trusted restore transaction and reapplies
this release's defaults after importing older production data; no refresh was run.

SQLite migration 0028 and database version 28 use the existing guarded rebuild
and full-download recovery path. Generated schemas/metadata put goals before
settings, register the composite key and user category, and enable incremental
sync through the server change-log trigger. The new table is deliberately not
added to the rebuild approval list yet: no app path writes it at this checkpoint;
review its write paths before permitting a later rebuild of populated settings.

Validation: real PostgreSQL tests cover privileged and RLS writes, legacy writes,
JSON bounds, goal/settings identity, soft tombstones and seed authorization.
SQLite WASM tests run the actual migration and check composite outbox entries.
Adapter tests preserve JSON TEXT and fractional numbers through casing conversion.
CI shard 1 runs the database and seed-drift checks. Full Worker/browser round-trip
coverage remains part of the next integration checkpoint.

## Checkpoint 2b: practice-event and staged-preview storage

The additive migration retains all existing fields and adds nullable goal,
evaluation and scheduler identity, bounded JSON TEXT snapshots/state, and
`interval_days` (Postgres double precision / SQLite REAL). Staging also holds a
predecessor UUID/fingerprint, configuration hash and stable prospective event UUID.
Repertoire tunes gain goal identity; queue rows gain allocation goal, selection
reason and displayed-event soft reference. Soft references will be validated by
application transactions at integration, not enforced as remote foreign keys.

New-format submitted events reject content changes, while allowing transport
metadata updates and identical retries. An advisory transaction lock serializes
inserts at the existing tune/repertoire/practiced natural key; a different UUID
cannot silently replace a new-format event through the Worker's natural-key
upsert. Legacy-only writes retain existing behavior. Goal-reference guards reject
private goals belonging to another repertoire owner, including privileged writes.
Full payload semantics remain the application's responsibility.

Generated artifacts come from the local Postgres migration and codegen configuration.
Explicit repertoire-based pull rules prevent the new goal foreign keys from changing
ownership inference for history and repertoire tunes. The unused minimal-retry
payload list was removed so it cannot later strip event metadata.

`npm run test:db:practice-goals` runs SQLite WASM persistence/outbox, the actual
Worker handler in process, and local Postgres, with isolated fixtures and an
ephemeral JWT key. It checks JSON TEXT, exact 0.1-day transport, a nontrivial
fraction within one microsecond (well inside timestamp precision), event retries,
identity/content conflicts, JSON/numeric guards and overlapping natural-key writes.
CI shard 1 runs it alongside the goal configuration checks. This is a storage
integration test; browser UI/Submit tests belong to the next checkpoint.

The active scheduler and UI still use the legacy paths. SQLite v29 uses the
existing guarded rebuild/full-pull mechanism; no production migration, data wipe,
backfill or deployment was performed. Old browser bundles continue to omit the new
nullable columns; new-format writes require the later coordinated cutover.

## Remaining checkpoints

1. Effective DB resolver, canonical history order and legacy decoder; selected
   scheduler execution, plugin contracts, staged snapshots, stale-preview checks,
   fractional event commit and idempotency/conflict enforcement.
2. Per-goal queue allocation across generation, Refresh and manual additions,
   retained work accounting and displayed-event links.
3. Consolidated settings, goal-aware evaluation/history displays, Practice again,
   desktop/mobile E2E and final documentation.

Each checkpoint should pass its local checks before push. Keep #940 a draft until
these behaviors and the coordinated cutover are reviewed. No deployment or data
wipe is implied by an implementation checkpoint.
