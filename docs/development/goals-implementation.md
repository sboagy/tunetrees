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

## Checkpoint 3a: uniform JSON state and selected-scheduler calculation

The approved state decision is now implemented at the pure calculation boundary.
`state.ts` validates versioned, bounded FSRS-6 and ladder payloads;
`practice-state.ts` is the shared decoder; `calculate.ts` dispatches only to the
selected scheduler. These functions do not yet replace the active staging/Submit path.

New FSRS state stores stability, difficulty, scheduledDays, learningSteps, reps,
lapses and status. `scheduledDays` is the FSRS model's scheduled-day value;
common `intervalDays` remains the actual fractional duration between event timestamps.
Ladder state contains its index and interval-definition hash. Neither scheduler
runs the other behind the scenes. Compatibility projections are separate outputs.
New JSON is authoritative: corrupt or unsupported new state cannot fall back to
old typed fields. Goal changes start fresh using only the supplied latest event;
there is no search for an older matching goal.

Unambiguous historical built-in Recall records decode into the same FSRS state
contract. Historical learning progress and model scheduled-day state were not
stored reliably; their zero initialization matches the old reader and is explicitly
reported as a limitation. Legacy plugin/ladder or unresolved goal records cannot
be inferred from FSRS-looking columns. Owner-scoped legacy goal resolution remains
part of the database integration step.

The documentation-only Postgres migration marks legacy column status and JSON
authority; generated metadata includes those descriptions. It changes no row values,
column types or constraints and preserves old app/Worker compatibility, including
old PWA bundles during deployment. No historical rewrite or physical removal occurs.

Validation includes parity with the existing FSRS service, retained same-day learning
progress, goal resets, strict payload validation and fractional intervals. The real
SQLite/Worker/Postgres test now persists and syncs a calculated JSON-only FSRS event,
retries its downloaded representation, and continues learning from that JSON without
typed FSRS projections. All 1,091 unit tests, typechecking, formatting, lint,
schema-generation and seed checks pass. UI, plugin execution and transactional
Submit are still pending.

The SonarQube follow-up uses the supported `DefaultScheduler` API with FSRS-6
selected explicitly. Model-parity tests pass below the interval cap. Unlike the
deprecated API, the current API enforces that cap during Easy graduation from
Learning/Relearning too (the regression fixture schedules 30 days instead of 36).
This follows the approved maximum-interval policy; FSRS-7 remains out of scope.
The SQL literal cleanup changes no resulting column comments or schema shape.

## Checkpoint 3b: owner-scoped preview inputs

`readGoalPracticeContext` checks repertoire ownership and active tune membership,
resolves owner-before-system legacy names, applies per-user overrides across
repertoires and counts active tunes for the effective goal. A missing/deleted or
inaccessible active goal falls back visibly to Recall; history IDs remain attributed
to the original goal, including tombstones. Raw historical rows and due dates are
not rewritten. Corrupt configuration blocks calculation. Null built-in configuration
uses typed defaults; unconverted custom/plugin definitions require an explicit
configuration before this new path can be activated. Cutover must still initialize
those definitions and copy existing Recall preferences.

`utils/practice-history.ts` normalizes UTC timestamps with six fractional digits and chooses the
latest event overall by practiced time, modified time and ID, with nulls last.
Sorting is currently scoped to the selected tune's loaded history; it preserves
microseconds that SQLite date functions would round. Existing latest/per-tune queries
and Practice History charts now share this implementation; display-only callers
retain malformed dates as missing rather than crashing. Limited per-tune history
is sorted before slicing. These reads load that tune's history (not the repertoire's
entire history); a future SQL optimization must preserve the same ordering contract.

`prepareGoalPracticePreview` now connects that database snapshot to the pure
calculator. It returns predecessor ID/fingerprint and a configuration fingerprint
including selected evaluation, effective settings, population and calculation-contract
version. New JSON state is fingerprinted canonically; transport bookkeeping and
redundant typed projections are excluded. A checked first practice has null predecessor
fields but a nonnull configuration fingerprint. No staged/event/queue rows are written.

The SQLite tests use actual SQLite WASM with the configured production migrations,
cover ownership, overrides, fallback, legacy attribution, ordering/ties/microseconds,
non-mutating preview calculation and fingerprint sensitivity. All 1,127 unit tests,
typechecking, formatting, lint and seed checks pass. No schema change or deployment
is involved. Transactional staging/Submit and browser E2E remain subsequent work.

## Checkpoint 3c: guarded preview staging

Checkpoint 3c implements the new-format staged writer in `goals/staging.ts` without
activating it in the practice UI. It persists goal/evaluation snapshots, authoritative
scheduler JSON, fractional intervals, predecessor/config hashes and a prospective
event UUID. Editing a pending evaluation retains its UUID and notes; replacing an
FSRS preview with a ladder clears incompatible typed projections. No practice event,
repertoire due date or queue row is changed.

Async calculations finish before a synchronous SQLite transaction rechecks ownership,
effective calculation inputs, caller request lifetime and the original staged row.
`preview.ts` projects the inputs once for both durable hashes and the synchronous
comparison; there is no async hash inside the transaction. Stale inputs leave the
old draft intact and return `stale`; expired requests or intervening draft edits
return `superseded`. The caller must handle those outcomes and recheck its lifetime
after persistence before displaying results. A persistence error is propagated, with
the same prospective event ID retained in the in-memory draft for recovery.

SQLite WASM tests cover initial staging, pending edits, fractional ladder results,
concurrent history/settings/goal changes, ownership loss, cancellation, newer draft
edits, persistence failure and transactional rollback. This does not satisfy the
Submit-time stale-preview/atomic event-and-queue commit requirements below. The old
staging service remains active until the complete new workflow is ready.

Validation: all 1,142 unit tests pass, including 14 new staging cases against SQLite
WASM. Typechecking, lint, formatting and diff checks pass. Browser E2E has not been
rerun for this checkpoint; the active UI is unchanged. No schema/codegen changes.
Local CodeRabbit review completed across all five changed/new files with zero findings.

### Rollover refresh follow-up

The completed-queue E2E failure exposed an existing completion/persistence race:
Refresh hid its button and advanced the selected date before IndexedDB saving
finished, allowing an immediate reload to restore yesterday's completed queue.
Refresh now advances the selected date only after successful generation/persistence
and metadata refresh. Both toolbars keep the button visible and disabled for the
entire operation, even if sync updates the queue date meanwhile. Failures show an
error and allow retry.

Final validation includes all 1,144 unit tests (two new toolbar completion regressions),
typecheck, lint, formatting and diff checks. The reported E2E scenario passed six
runs: three each on desktop Chromium and Mobile Chrome. This is focused E2E coverage,
not a full-suite rerun. The SQL-editor parser adjustment also passed the 35 focused
resolver/staging tests. No schema or generated artifacts changed.

## Checkpoint 3d: atomic goal-aware Submit boundary

`src/lib/goals/commit.ts` accepts the reviewed draft receipts and queue-row IDs for
one user/repertoire batch. Before writing, it verifies predecessor/configuration
fingerprints and recalculates the original preview at its original practiced time.
A synchronous transaction rechecks ownership, caller lifetime, queue rows, drafts
and scheduling context, then writes history, current due dates, displayed-event
links and completion counters, and removes drafts together. A failure rolls back
the whole batch. Stale previews return a status requiring renewed review.

Stable event UUIDs support exact retries, including retry after IndexedDB persistence
fails following a successful SQLite transaction. Retry does not rewrite later due
dates, consume newer drafts or increment counters again. Different content at the
same UUID and different UUIDs at the same normalized practiced time fail explicitly.
Fractional ladder intervals retain their due times; typed FSRS projections remain
empty for ladder events. Existing scheduled-override consumption logic is reused.
The staging draft selector is shared with Submit.
Backdated submissions are rejected rather than regressing the schedule behind the
latest event. Drafts containing private/public note fields are also rejected with
an explicit save/clear instruction, preserving user text. Current note editors save
through the separate notes API; the new Submit boundary does not yet transfer old
transient notes. UI integration must handle that error without deleting the draft.

Validation: 15 new SQLite-backed Submit cases cover success, whole-batch rollback,
stale inputs, lifetime cancellation, exact retries, persistence retry, conflicting
identities/times, fractional ladder timing, newer drafts/schedules, pending notes
and backdated events. Local CodeRabbit reviewed the three code files and found the
note-loss and backdated-schedule cases above; both now have guards and regressions.
All 1,168 unit tests, typecheck, lint, formatting and diff checks pass. Browser E2E
was not rerun for this inactive boundary.


This boundary remains disconnected from the active practice UI. It completes one
explicit exposure per selected queue row; Practice again reopening, per-goal queue
allocation, legacy conversion and UI integration remain subsequent work. There are
no schema/generated-artifact changes or deployment actions in this checkpoint.

## Checkpoint 3e: canonical SQL history selection

`db/practice-history-sql.ts` shares timestamp normalization/order and latest-row
selection across the limited repertoire history query, queue candidate subquery,
SQLite joined/staged/readable practice views and analysis queries. UTC whole seconds
and microsecond fractions are handled separately; SQLite date rounding cannot turn
`.999999` into the following second. SQL limits and per-tune selection remain in the
database rather than transferring entire repertoire histories into JavaScript.

Analysis now selects the latest event before filtering stability or overdue dates.
This prevents an old overdue event from surviving a newer future-due review, and
prevents old FSRS stability resurfacing after a newer event without stability.
The retention formula and compatibility-column projections are unchanged; goal-aware
metrics and authoritative JSON presentation remain part of the later UI work.

Shared fixtures cover UTC offsets, legacy timestamp forms, microseconds, missing
values and deterministic modification/ID ties. `npx tsx scripts/test-practice-history-order.mjs`
checks the same expected order against local Postgres without writing schema or
fixtures. SQLite view integration tests cover both joined and staged consumers.
The existing Postgres practice-list view already has the canonical tie-breakers.

Compatibility: local view columns and common scheduling meanings are unchanged;
there is no server migration, generated artifact or sync metadata change. Old
browser/Worker bundles remain compatible during deployment. This checkpoint changes
active read selection, but does not activate the new goal staging/Submit workflow.

CodeRabbit follow-up: analysis now filters repertoire before ranking; the legacy
queue candidate reader explicitly rejects malformed non-null timestamps before
selection. Display queries retain their as-missing policy. Analysis comments now
state that the latest event is selected first. The parity script uses the documented
`tsx` runner and the declared `postgres` dependency; its tied text fixture IDs are
lowercase with identical structure (production IDs are UUIDs), so the review's
mixed-case/punctuation collation concern does not apply to this fixture.

A SQLite WASM benchmark with 50,000 UTC history events across ten repertoires
measured joined/staged view counts at roughly 340–350 ms after adding the UTC fast
path, compared with roughly 820 ms for the general parser and 140 ms for old raw
ordering. Analysis over one repertoire's 5,000 events took about 40 ms. These are
local synthetic measurements, not mobile performance guarantees; full-history view
ranking still costs more than incorrect raw-string ordering. No persisted timestamp
columns or indexes were added.

Validation: **1,185 unit tests passed**, plus typecheck, lint, formatting, script
Biome checks and diff checks. The focused Playwright run passed **15 tests** across
desktop Chromium and Mobile Chrome (analysis charts and scheduling interval order,
plus setup); this is not a full-suite E2E run. The read-only local Postgres parity
check passed. The final legacy-generator guard-order adjustment is covered by a
SQLite regression proving a rejected regeneration leaves the existing queue active.



## Remaining checkpoints

1. Initialize legacy goal definitions/preferences at cutover; selected-scheduler activation, plugin
   contracts and UI integration of the staged-preview/atomic Submit boundaries.
2. Per-goal queue allocation across generation, Refresh and manual additions,
   retained work accounting and displayed-event links.
3. Consolidated settings, goal-aware evaluation/history displays, Practice again,
   desktop/mobile E2E and final documentation.

Each checkpoint should pass its local checks before push. Keep #940 a draft until
these behaviors and the coordinated cutover are reviewed. No deployment or data
wipe is implied by an implementation checkpoint.

## CodeRabbit checkpoint review (2026-11-16)

A manual full review of `ca331abf` inspected 43 files (generated artifacts and the
lockfile were excluded by CodeRabbit's filters). Three actionable findings were
confirmed and addressed locally: retain recovery metadata across both engine calls
in one service operation; restore lifetime-safe local test-user initialization;
and reject NUL/unpaired Unicode surrogates before storing configuration JSON.
The catalog-purge test now records deletion count at the ownership-change microtask,
so it detects yielding midway through the batch.

The linked-issue check correctly observes that the goal-aware evaluation picker
is still missing. It remains part of this draft PR's planned UI integration, not
an accepted omission or a separate follow-up. The state review in plan section 6.3
is resolved in favor of authoritative JSON for all new scheduler results; checkpoint
3a implements that calculation boundary before activating it in the application.


## CodeRabbit checkpoint follow-up for `1b538e9b`

The five findings from the second full review are addressed locally: serialize
injected-test initialization before real sign-in; reject a reset whose ownership
changed during teardown; deny rebuild approval while recovery remains pending;
retain the explanation for unavailable legacy Recall state; and validate evaluation
snapshot bytes in configuration/overrides and the resolved goal definition.
Settings and practice use the same snapshot serializer, including goal-name bytes,
Unicode and JSON escaping. Regressions exercise the shared runtime promise,
replacement-user reset protection, recovery completion and exact size boundaries.
These changes do not activate the new scheduler or change schema contracts.


### DRY audit and remaining integration boundaries

- `hashCanonicalJson` in `goals/config.ts` is the sole canonical JSON/SHA-256
  implementation for interval ladders and preview fingerprints. Each caller retains
  its own byte budget; existing ladder hashes do not change.
- `utils/practice-history.ts` owns timestamp normalization and canonical ordering.
  `readPracticeRecordsForTune` is the shared synchronous database read used by the
  resolver, `getLatestPracticeRecord` and `getPracticeRecordsForTune`.
  `getPracticeHistory` applies the same ordering to its enriched rows, before limiting;
  Practice History charts and streaks use its reverse for chronological display.
- `db/practice-history-sql.ts` now supplies canonical SQL selection for
  `getPracticeRecords`, analysis, the queue-generator latest-record subquery and
  SQLite practice views. Cross-engine fixtures cover the ordering contract; the
  Postgres practice-list view already has the required order. Goal-aware analysis
  projections/metrics remain part of scheduler/UI integration.
- Queue window/date-only utilities and scheduled-override second-precision comparisons
  have separate contracts; they are not interchangeable with event ordering. OAuth
  PKCE hashes raw verifier bytes to base64url, not canonical JSON to hexadecimal.
  Those implementations intentionally remain separate.

This checkpoint changes active history query/chart ordering in tied or differently
formatted timestamps. It does not activate goal-based staging/Submit. The developer
reported local browser E2E passing before this checkpoint was committed.

Local CodeRabbit review identified inconsistent timestamp parsing in chart labels.
Chart labels and table dates now use the shared UTC normalizer, retaining damaged-date
fallbacks. All seven history utility tests pass with `TZ=America/Los_Angeles`, including
the offset-free timestamp regression; typechecking, lint and formatting also pass.

### Catalog refresh follow-up (SCHEDULING-008)

The reported mobile timeout occurred while clicking New in the Add Tune dialog,
before interval assertions. A background catalog refresh unmounted the toolbar
that owns the dialog. The catalog now retains that toolbar once data has loaded,
preserving open dialogs and unsaved input during subsequent refreshes. A route
regression test holds a refresh pending and verifies that dialog state survives.
No E2E timeout or interval assertion was relaxed.

Validation: all 1,186 unit tests, typecheck, lint, formatting and diff checks passed.
SCHEDULING-008 passed four focused runs (twice desktop Chromium and twice Mobile
Chrome), plus auth setup, using the existing servers. This is not a full E2E rerun.
