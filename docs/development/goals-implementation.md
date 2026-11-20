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

## Checkpoint 3f: Recall preference conversion preparation

`scripts/lib/goal-cutover/legacy-preferences.ts` prepares validated Recall overrides from synchronized
legacy scheduling/FSRS preference rows. It reuses the built-in defaults and existing
configuration validators. Zero limits (including Unlimited), false auto-new/fuzz,
zero delinquency, fractional learning steps and empty step arrays retain their
meaning. Only `alg_type='fsrs'` contributes scheduler parameters; malformed saved
values block conversion instead of silently resetting the user's settings.
Existing override rows, including tombstones, prevent re-import. This is a pure
preparation function: the eventual server insertion must also enforce insert-if-absent.

Run `npx tsx scripts/audit-goal-cutover.mjs` against the existing local Postgres.
It uses one read-only repeatable-read transaction, reports counts/identifiers only,
and flags invalid preferences/configurations, missing built-ins, unconverted custom
goals and custom/system name collisions. The local snapshot had 203 users whose
Recall preferences converted, with no goal blockers found. This is not a production
inventory, a device-sync check, an audit of existing override contents, or a complete
cutover readiness gate. The existing local Postgres collation warning is unrelated.

No migration or backfill is applied here: legacy preferences remain editable in the
active UI, so a live import now could become stale before activation. Custom/plugin
conversion, stable reference attribution, server-side insert/backfill SQL and
selected-scheduler/UI activation remain pending. There are no generated-contract
changes, new runtime readers, database writes or schema compatibility changes.

Validation: all 1,196 unit tests passed, including ten conversion cases, plus
typecheck, lint, formatting, script Biome checks and diff checks. The local
read-only audit passed. No E2E rerun was needed for this inactive preparation code.

## Checkpoint 3g: custom definitions and server-snapshot preparation

`legacy-goals.ts` prepares missing owner-defined FSRS/interval-ladder configurations.
Custom FSRS uses shared FSRS-6 parameters, not the owner's personalized Recall values.
Custom goals start with minimum zero; generic ladder choices describe reset/back/stay/
advance directly. Choice IDs are UUIDs and valid existing configurations are retained
without regeneration. Defaults and labels live in `builtins.ts`; the existing built-in
seed output is unchanged. Malformed configurations/intervals, unsupported plugin
techniques, unknown shared legacy definitions and custom/system name collisions block
preparation instead of guessing meanings.

`cutover-plan.ts` combines proposed definition updates and absent Recall-settings
inserts with source snapshots. It returns no partial plan if conversion fails.
`npx tsx scripts/audit-goal-cutover.mjs --prepare <new-plan.json>` exports the plan
from one local read-only repeatable-read transaction. The artifact has mode 0600,
refuses overwrite and is not printed to the console. Keep these user-specific files
out of version control. The audit now distinguishes convertible legacy goals from
blocked ones; listing a goal as convertible does not mean it has been migrated.

Local preparation produced 209 Recall inserts and zero custom updates. Unit fixtures
exercise custom conversion because the local snapshot has no legacy custom goals.
This remains preparation, not an executable migration: goal-key renames/reference
attribution, timestamp-preserving server writes, stale-snapshot checks, idempotent
insertion and plugin conversion remain pending. Before applying anything, repeat
preflight against the synchronized target database and complete the coordinated
cutover procedure. Active UI/settings behavior is unchanged.

Validation: 1,213 unit tests passed, typecheck, lint, formatting, script Biome checks,
built-in seed parity and diff checks passed. A local export verified its scope/counts,
private permissions and refusal to overwrite an existing artifact. No schema or
generated artifacts changed; there are no new database writes or old-client schema
compatibility changes. No E2E rerun was needed for this inactive preparation code.

Fresh local CodeRabbit review of this uncommitted checkpoint (including untracked
files) completed with zero findings across all seven files.

## Checkpoint 3h: transactional local cutover rehearsal

The audit and rehearsal share `scripts/lib/goal-cutover-snapshot.mjs`; timestamp
snapshots now use Postgres text output so microseconds survive without JavaScript
Date truncation. Regenerate plans before rehearsing rather than reusing old exports.

`goal-cutover-transaction.mjs` validates every definition/settings entry before
writing. It rederives proposed values from source data, rejects stale snapshots,
duplicate identities and changed overrides/tombstones, and accepts identical already
applied results without writes. SHARE ROW EXCLUSIVE locks cover goals, settings,
preferences and users, including missing rows that might otherwise be inserted
concurrently. Locks have a two-second acquisition timeout; SQL statements have a
15-second timeout. An internal savepoint rolls back failures even if the caller
catches them. Existing goal timestamps are verified after updates. No triggers are
disabled: the audited ownership guards and sync change-log triggers stay active.

`npx tsx scripts/rehearse-goal-cutover.mjs <plan.json>` targets local Postgres only
and always rolls back its transaction. There is no commit mode or environment URL
override. The fresh local rehearsal validated 209 Recall inserts and rolled them
back; persisted settings counts were unchanged. These local tools are not connected
to browser startup, practice, settings or sync runtime paths.

`npm run test:db:goal-cutover` uses isolated UUID fixtures inside rolled-back
transactions. It verifies custom-goal microsecond timestamp preservation, unchanged
legacy names/intervals, exact retry behavior, stale/altered input rejection, override
tombstone preservation, competing-writer blocking and rollback of both application
rows and sync-log effects. A transient constraint forces a later SQL insert failure
after a goal update; the batch and test constraint both roll back. The command is
wired into CI's existing shard-one database checks before Playwright.

Validation: 1,213 unit tests, typecheck, lint, formatting, script Biome and diff checks
passed, as did the real Postgres integration tests and local CLI rehearsal. No E2E
rerun was needed. There are no persistent schema/generated changes or deployment
actions. The SQL writes affect only additive definition/settings fields; legacy
goal keys, scheduler preferences, practice dates and history remain unchanged.
Production migration/deployment integration, stable goal-key/reference backfills,
plugin conversion and UI activation remain pending. A successful rehearsal does
not establish that devices are synchronized or authorize production application.

Fresh local CodeRabbit review of checkpoint 3h, including untracked scripts,
completed with zero findings across all nine files.

## Checkpoint 3i: stable goal-reference backfill rehearsal

The existing pure goal-name resolver moved from `resolve.ts` to `references.ts`
without changing its rules or public re-export. Runtime and controlled backfill now
share owner-before-system precedence, deleted-goal handling and legacy-name/ID
reconciliation. `reference-backfill.ts` proposes IDs for unambiguous legacy events
without attribution and active repertoire assignments. It preserves existing
historical IDs, refuses to infer missing IDs on new-format events, and reports
unknown/ambiguous names without rewriting their raw evidence or silently assigning
them to Recall. An absent legacy name still uses the established Recall default.

The audit exports version-2 plans with reference changes and unresolved-reference
reports. Version-1 artifacts are rejected by the rehearsal; prepare a fresh snapshot.
Full row snapshots retain timestamp microseconds through Postgres JSON serialization.
`goal-reference-transaction.mjs` rechecks row contents, owner and current goal
resolution under the same transaction's locks. It writes only `goal_id`, then checks
the entire returned row against the expected result. Already-applied entries make
no further writes. Repertoire/assignment/history tables join the existing lock set,
and the batch savepoint includes definitions, settings and references together.

Local rehearsal validated 1,699 reference updates and 209 settings inserts with
zero unresolved references, then rolled all changes back. Postgres fixtures verify
unchanged raw goal names, practiced/due/manual-schedule dates, quality and
microsecond modification timestamps; stale history and forged attribution fail
before writes. A late practice-record constraint failure rolls back earlier goal,
settings and assignment writes. These checks extend the existing CI database test.

Validation: all 1,223 unit tests passed, plus typecheck, lint, formatting, script
Biome/diff checks, real Postgres integration tests and a full local CLI rehearsal.
No E2E run was performed. There are no schema/generated-artifact changes, runtime
scheduler activation or persisted database changes. Runtime impact is limited to
extracting the existing identity helper; its behavior remains covered by the same
preview/staging/Submit tests. Production application still requires the coordinated
full-download cutover. Custom-key renames, staged-work preflight, queue allocation/
displayed-event attribution, plugin integration and deployment wiring remain pending.

### CodeRabbit follow-up for checkpoint 3i

The local review covered 13 files and raised three questions. One was confirmed:
the expanded schema permits partial event metadata with null scheduler/goal IDs.
The backfill now excludes any row with populated evaluation ID/snapshot, scheduler
ID/version/state or fractional interval. Zero and empty-string values count as
populated. Both preparation and the SQL update predicate enforce this conservative
boundary; genuinely legacy rows with all these fields null remain eligible.
Parameterized unit cases cover every marker. A real Postgres regression proves the
schema accepts a partial event and that preparation, an edited plan and a direct
writer attempt leave it unattributed. Validation: all 1,230 unit tests, typecheck,
changed-file Biome checks, the database integration test and diff checks passed.

The other two concerns were refuted against current code and executable checks:
an existing assignment ID with a matching legacy name remains authoritative even
after a same-name owner goal appears; and the changed audit caller passes the full
reference snapshot as its third argument. A real snapshot with one legacy history
row produced its expected attribution. No code changes were needed for those two.

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

### Fresh CodeRabbit review of `6928d04e`

A fresh committed-change review against `b0cceaa2` covered all 15 checkpoint files
and returned two findings:

- Postgres verification gap: the parity script now inspects the live local
  `practice_list_joined` definition with `pg_get_viewdef` and asserts its explicit
  practiced/modified `DESC NULLS LAST` and ID tie-breaker before checking fixtures.
  The read-only check passes, as do typecheck, script Biome and diff checks.
- Existing SQLite view refresh concern: no runtime change is needed. The oosync
  runtime awaits `onExistingDatabaseLoaded`; TuneTrees' hook calls `recreateViews`,
  which drops all seven views, including the three flagged views, before calling
  `initializeViews`. Persisted databases therefore receive current definitions.

At review completion, CI quality/unit, security, SonarCloud, Lighthouse and PWA
checks passed; the four Playwright shards were still running. This review follow-up
changes verification/documentation only and remains separate from UI activation.

### Administrative module placement

The four migration preparation modules (`legacy-preferences.ts`, `legacy-goals.ts`,
`cutover-plan.ts`, and `reference-backfill.ts`) live in
`scripts/lib/goal-cutover/`; their tests live in `tests/scripts/goal-cutover/`.
`npm run typecheck` explicitly includes these modules through `tsconfig.node.json`,
and the standard lint and format commands include the same directory. Existing
unit-test discovery covers the relocated tests. Shared runtime rules remain in
`src/lib/goals/`; browser code does not import the administrative modules.

## Checkpoint 3j: server staged-work preflight

The read-only audit now reports pending staging identities without note or
scheduler payloads and refuses plan export while any staging row remains.
The rollback rehearsal locks `table_transient_data` with the other cutover tables,
then rechecks emptiness before any conversion writes. This rejects an old plan if
new drafts arrived after preparation. Sparse, note-only and partially populated
new-format drafts all block; no age, evaluation or repertoire filter guesses that
work can be discarded. The scripts never clear or convert these drafts.

Submit or explicitly discard pending work using a compatible app and synchronize
every device before cutover. Server emptiness is not proof that device-local drafts,
failed outbox entries or local-only media work are preserved. Existing device
preflight/rebuild safeguards still apply; production integration remains pending.

Validation: typecheck, lint, formatting and changed-script Biome checks passed.
Real Postgres tests cover all three draft shapes, unchanged drafts/settings/history
and sync logs after rejection, and a concurrent staging insert blocked by the
rehearsal lock. The local read-only audit reports no server staging rows. All test
writes roll back. No browser runtime or schema changes; no E2E rerun needed.

### CodeRabbit review through `69e592b1`

A fresh local review of the 19 changed files since `c7e4bca6` raised two safety
questions and one test weakness. The preservation test now captures an independent
snapshot before preparation and checks both the input and returned evidence against
it; previously an input mutation could have escaped detection.

Both safety questions were refuted against the current implementation. A history
row with null goal/scheduler IDs and `scheduler_version=0` is excluded by preparation
and rejected by edited-plan validation; the SQL writer also requires that field to
be null. Added the exact zero-version unit case. The cutover transaction already
locks `repertoire_tune` before taking its validation snapshot and holds the lock
through completion; an added two-connection Postgres regression confirms a competing
attribution update times out. No runtime or migration behavior changed.

Validation: typecheck, all 18 reference-backfill tests, the database transaction
suite, changed-file Biome checks and diff checks passed. An executable check also
confirmed rejection of the exact zero-version edited-plan input. Review follow-ups
are test/documentation changes only; no local E2E rerun is required.

## Checkpoint 3k: custom stable-key conversion rehearsal

Version-3 review artifacts convert owner-defined goal keys to `custom:<UUID>`.
Existing friendly labels and configured evaluations remain unchanged; goals without
a display label retain their old key as the friendly label. Original goal snapshots
in the private artifact preserve the former key as migration evidence. History keeps
its recorded goal text; active assignments receive the new key and stable ID in the
same transaction. Names are resolved against the original namespace before any write.

The writer rederives proposed values under the existing locks and requires every
resolvable reference affected by a rename. Missing assignment/history entries,
new history since preparation, or an omitted goal update block the whole batch.
Occupied custom target keys (including deleted occupants) and personal goals using
system names remain blockers; this does not silently merge custom goals into system
overrides. Version-1/2 artifacts must be regenerated. Sparse/partial events remain
unattributed, and pending staging still blocks the rehearsal.

The local fixture exercises actual key/assignment changes, raw historical labels,
microsecond timestamps, unchanged existing configuration, idempotent retries, stale/
incomplete plans, occupied keys and rollback after a later SQL failure. This remains
admin-only rollback rehearsal, with no browser or generated schema changes. Applying
these semantic renames while old clients are writing would be unsafe: production
application remains restricted to the approved all-device coordinated cutover and
mandatory full download. No production apply mode or migration was added here.

Validation: **1,234 unit tests**, typecheck, lint, formatting, changed-script Biome
checks and the real Postgres transaction suite passed. Fresh version-3 export and
local rehearsal processed 1,699 reference updates and 209 Recall inserts, then
rolled them all back; this local snapshot has no custom definitions, so actual
custom-key changes are exercised by the isolated database fixtures above.

Fresh local CodeRabbit review of checkpoint 3k, including the SonarQube condition
cleanup, completed with **zero findings across all 11 changed files**. No code
changes were needed in response to this review.

## Checkpoint 3l: legacy queue completion links

Version-4 plans include conservative displayed-event link proposals. The legacy
Submit code writes the same `now` into the event's `last_modified_at` and queue's
`completed_at`. The planner uses that exact evidence with repertoire ownership,
tune identity and practice between generation/completion, without rounding fractions
or requiring submission on the original queue day. Exactly one legacy event must
match. Missing, ambiguous, corrupt or partial/new-format evidence stays unlinked
and is reported. Existing links and unfinished/inactive rows are preserved.

Queue rows join the transaction lock set. Before any write, the writer rederives
planned evidence from the current snapshot; an edited plan, new ambiguity, changed
completion or altered event is rejected. Exact retries preserve existing links,
including across goal-ID backfill in the same batch. Only the displayed-event ID
changes; full-row comparison verifies dates, allocation fields and counters remain
unchanged. A failure in this final phase rolls back earlier goal/reference/settings
writes too. Server staging must still be empty; device-local checks remain required.

This does not infer allocation goals or selection reasons from historical buckets.
Those frozen allocation snapshots remain part of first-load/new queue integration,
as planned. No browser activation, schema change, production apply mode or permanent
backfill was introduced. Regenerate older plan artifacts for version 4.

Validation: **1,250 unit tests**, typecheck, lint, formatting, targeted script Biome
checks and real Postgres transaction tests pass. Tests cover exact microseconds,
delayed submission, ownership/tune/repertoire boundaries, ambiguity, corrupt and
partial evidence, existing links, retry, unchanged queue content, stale/edited plans,
concurrent queue writes and whole-batch rollback after a final-phase failure.

Fresh local version-4 export/rehearsal completed and rolled back. This snapshot has
591 completed queue rows without a unique matching submission timestamp, so all
remain unlinked and are reported; zero completion links were guessed. Successful
link writes are verified by isolated Postgres fixtures. The rehearsal also processed
1,699 goal references and 209 Recall inserts, then rolled them back.

Fresh local CodeRabbit review of the queue-link checkpoint completed with zero
findings across all 11 changed files. Before commit, typecheck, all 16 queue-link
unit tests and the Postgres transaction suite were rerun successfully.


## Migration tooling complete

The final admin command is `npm run goals:migrate:production`, dry-run by default;
`-- --apply` commits. Shared preflight and existing writers build a fresh plan under
table locks and verify no eligible conversion remains before committing. No exported
artifact is required. The short procedure is in `docs/development/goals-cutover.md`.
This completes migration tooling, including supported definition/settings/reference
conversion and evidence-based completion links. Actual production execution waits
for the full feature release and synchronization/update of the user's devices.
No production migration was executed during implementation. Queue allocation and
UI activation remain runtime work, not further migration checkpoints.

Validation: all **1,261 unit tests**, typecheck, lint/format checks and the local
dry run pass. Real Postgres tests exercise apply, retry, dry-run rollback, pending
draft blocking and late-write failure rollback inside an enclosing rollback scope.
CodeRabbit reviewed all 14 changed files; its two findings led to blocking
incomplete new-format events and removing a fixture-only total-count assumption
with an explicit cutover-ready test prerequisite. Unknown legacy history remains
reported and preserved. No schema/generated changes or browser activation.

Fresh CodeRabbit follow-up: reject endpoint query overrides in the operator URL
and pin an omitted port to 5432, so the displayed target cannot be redirected by
those options or PGPORT. The runbook now explicitly uses the existing manual
Force Clean Local Reset after verified synchronization on each device, including
version-29 devices; it does not claim reopening guarantees a rebuild. This manual
reset does not use the automatic preservation guard, so its preconditions are
explicit. Scheduler-state-only partial metadata is already retained by the full
row snapshot and rejected by the shared preflight.


## Combined queue implementation batch

The new `updateGoalPracticeQueue` boundary handles daily load/generation, Refresh,
add-more and explicit selected-tune additions using one classification/allocation
policy. It shares repertoire ownership, goal identity/defaults and overrides with
practice previews, with definitions parsed once per goal rather than per tune.
Latest history selection reuses the canonical repertoire-scoped SQL helper.

Implemented together:

- Per-goal minimum/maximum, Unlimited, persisted auto-new and delinquency settings;
  due today → recent overdue → old overdue → unscheduled/future minimum top-up.
- Frozen allocation-goal attribution for previously unannotated active rows,
  preserving completed-event links/counters and not guessing historical reasons.
- Refresh retention of completion and all drafts (including note-only drafts),
  accounting against original allocation goals even after a goal/limit change.
- Same-day practiced exclusion, deterministic ordering and explicit shortfalls.
- Manual/add-more budget exceptions with accurate schedule snapshots, deduplication,
  selected older-window support and atomic row reuse/deactivation for sync.
- Persistence-error receipts: retry saving the already-applied result rather than
  repeating add-more. Callers must retain the same user/database ownership.

This replaces the need for separate review cycles for each queue primitive, but
**does not activate the new queue service in the UI yet**. The next integration
batch must replace legacy `generateOrGetPracticeQueue`, `addTunesToQueue` and
`addSpecificTunesToExistingQueue` callers together with the goal-aware settings and
practice flow, retain persistence receipts, and display selection/fallback notices.
No new database columns, generated artifacts or migration tasks are introduced.

CI follow-up: shard 1 failed before Playwright in the admin cutover test because
its restored legacy seed lacked built-in configuration. The test now runs the
existing canonical seed inside its enclosing rollback transaction, then disables
the seed-write allowance before exercising cutover. This changes test setup only;
normal migration preflight still rejects missing defaults.

Local CodeRabbit reviewed all seven changed/new files and raised one finding:
empty-day manual/add-more requests could target an older active queue. The fix
uses the requested practice day by default; an explicitly selected older window
must exist. Four SQLite regressions cover both addition modes, a stale old-window
selection, and an explicitly selected empty current day. Existing older-window
selection remains supported. The caller must pass the visible older window rather
than relying on an implicit latest-window fallback.

Final local validation: **1,299 unit tests** pass, including 30 new SQLite-backed
queue tests and the existing 54 goal-context/staging/Submit tests. Typecheck, lint,
formatting and diff checks pass. The real Postgres cutover transaction suite passes
with the canonical seed fixture. The developer subsequently reported the full
local E2E run passing before commit. No production migration was performed; the
new queue API remains outside active UI callers.


## Goal settings editor and persistence integration

Replaced the legacy technique/interval-only Goals editor with per-goal editing of
intent, display name, daily minimum/maximum (explicit Unlimited), automatic new
introductions, recent-overdue window, scheduler, evaluation labels/descriptions/actions,
interval ladders and advanced FSRS parameters. Shared validators enforce scheduler/action
compatibility and fractional ladder intervals. Changing scheduler explicitly replaces
choices with compatible defaults. Reset restores inherited defaults.

The local settings service stores only personal differences, rejects stale editor
snapshots, and keeps shared definitions unchanged. Custom creation uses a stable ID/key
and supports exact retries. Replacement-on-delete updates owned assignments in one
transaction, preserving due dates, practice history and queue allocation/display links.
Pending practice or note-only drafts block deletion with explicit guidance. Failed
persistence is visible; a persistence-only retry avoids repeating mutation. Retired the
old unguarded goal CRUD exports after checking their consumers.

Goal pickers now use personalized labels and intent descriptions while retaining stable
assignment keys. Local settings saves and synchronized updates refresh picker resources.
No schema, migration, generated artifact or Worker contract changes are needed: this is
browser-local use of the existing additive columns, compatible with old deployed clients.

**Integration boundary:** settings are editable, but new evaluation/staging/Submit and
queue services are not yet activated in the practice UI. Do not release this intermediate
state as a completed feature. Shared-calendar consolidation, removal of the old scheduling
panels, evaluation effects and queue activation remain the coordinated next step. This
batch does not claim that changing the new daily limits changes the legacy queue yet.

Validation: **1,319 unit tests** pass, including 20 new SQLite settings and Solid editor regressions. Typecheck, repository lint/format checks and diff checks pass. The regressions cover
personal overrides, reset, stable identities, owner isolation, stale editors, atomic
replacement/rollback, pending-work preservation, persistence retry, focus retention,
Unlimited, scheduler switching and invalid inputs. The existing Goals desktop/mobile
E2E scenario now exercises the new controls and replacement workflow.

Focused browser validation completed on November 18, 2026 using the running local
servers: `goals-001-settings-and-badge.spec.ts` passed on desktop Chromium and Mobile
Chrome (**4 scenario runs plus authentication setup; 5 passed**). The scenarios cover
custom-goal creation/editing/replacement-on-delete and goal-badge assignment/settings
navigation. The earlier 1Password authorization timeout is resolved. No dev/preview
servers were restarted. This is focused coverage, not a full E2E-suite rerun.

Local CodeRabbit reviewed all 15 changed/new files and returned seven findings.
Addressed the attributed-draft deletion case with a regression: a draft still linked
to goal A blocks deleting A even after the tune's current assignment moves to B.
Legacy/malformed definitions now appear as unavailable entries without blocking other
goals. Their conversion remains in the agreed admin migration; no parallel conversion
editor was added. Also improved unknown custom-key display, removed a hard-coded E2E
replacement ID, and asserted Unlimited starts unchecked. The suggested deletion
assertion was already present; validation documentation was updated during the review.
Disk-save recovery is offered only for persistence failures, and further editing is
blocked until retry/reload so retry cannot discard newer form changes.

Follow-up validation: corrected Sonar findings using Solid list iteration and
associated form labels, restored readable dark-mode text in Goals/Plugins and
shared outline buttons, and changed the Fluency test helper to select by stable
goal key rather than editable menu text. All eight desktop/mobile Fluency scenarios
pass (nine tests including authentication setup). The developer subsequently
reported the full local E2E suite passing. Final repository lint, formatting,
typecheck and diff checks pass. These follow-ups do not change scheduler behavior.

## Runtime queue and daily-settings integration — focused browser validation complete

Interactive queue load/date navigation, Refresh, Add more, Add to review and starter
repertoire initialization now use the per-goal allocator. The combined queue has
no configurable global daily cap. Refresh retains completed work and drafts;
Add to review does not manufacture an empty practice-history record. Add to review
resolves the visible/latest active session explicitly, including older sessions;
stale explicit selections remain errors rather than redirecting silently.

Commands serialize within each database session and share overlapping identical
requests while retaining all callers' ownership checks. Failed disk saves retain
receipts across navigation. Exact retries save the original result without another
allocation; a separate Retry saving action works after a date change or onboarding
completion. Other commands cannot accidentally consume the original receipt.
Date resolution and history publication discard obsolete results. Rollover publishes
the actual generated date, not a later clock reading. Explicit empty-day refreshes
retain scoped device-local navigation intent so reload does not reopen yesterday.

Goals is the default settings panel. The standalone Scheduling Options navigation
and global queue controls are removed; old links resolve to Goals. Shared practice
calendar preferences are displayed read-only in Goals with an explicit explanation
that weekly rules and exceptions are inactive; existing saved data is preserved.
Per-goal edits explain frozen queues. Settings E2E now covers daily min/max validation,
save/reset, and shared-calendar visibility; fixture cleanup isolates goal overrides.
The legacy Spaced Repetition panel remains until evaluation activation is complete.

This batch activates queue allocation only. Inspection found that new-format
calculation still lacks the existing plugin execution contract, so evaluation and
Submit must not be switched wholesale yet. Versioned plugin execution, goal-aware
evaluation choices/effects, and removal of the legacy FSRS panel remain required.
No schema migration or generated-contract changes are introduced.

Local CodeRabbit's first review returned 15 findings/questions. Addressed valid
issues involving command size, current/stale coalesced callers, save recovery after
navigation/onboarding, active-session targeting, delayed date/history publication,
midnight rollover, empty-day reload, and future-preview additions. Regression tests
also verify already-correct preservation of completed/draft rows, normalized UTC
window identity, no double allocation after a save failure, and frozen rows after a
lower limit is saved. The proposed fallback from an explicit missing old window
is intentionally rejected, following the approved queue-selection contract.
The follow-up review returned ten findings/questions. Fixed the calendar resource
error guard, repertoire-independent save recovery, Refresh view completion after
retry, superseded Load readiness, and nonconsecutive Add-more coalescing. A stored
global manual preference is now validated against the current repertoire before
becoming an explicit command target. Once resolved, Add to review deliberately
pins the click-time window; later Refresh actions do not retarget that command.
Added regressions for fractional UTC historical Add more, superseded Load, and
three accepted additions with a different intervening count. User switches create
a new database object in the runtime, so the pending-save owner guard remains.
The empty-day marker records navigation intent only; it does not hide rows later
received through sync, and rendering still reads the database rather than the
saved allocation receipt.

Validation: all 1,337 unit tests pass across 104 files; repository typecheck,
lint, format check, and diff whitespace checks pass. Focused desktop/mobile browser
coverage includes Goals, settings forms, rollover, and Add-to-review persistence.
The initial run had 48 passed, 2 skipped, and 7 failed; all failing cases have since
passed in targeted reruns. This is not a fresh full-suite E2E pass.

Browser verification exposed test-fixture assumptions and cleanup gaps:
- Add-to-review fixtures now seed Recall minimum zero before initial sync so
  future-due tunes do not automatically fill the queue under the new policy.
- Goal-setting cleanup uses the existing owner-scoped Postgres test connection;
  authenticated runtime clients cannot hard-delete these overrides.
- Temporary-repertoire cleanup deletes dependent grid state before the repertoire,
  avoiding a foreign-key failure after mobile navigation.

All six Add-to-review cases passed on desktop/mobile after fixture cleanup was
corrected. The final repertoire-switching rerun passed on both projects (three
tests including auth setup). No runtime changes were needed for these fixes,
and no dev/preview servers were restarted. Changes remain uncommitted for review.

## Full-suite regression follow-up — affected suites verified

The developer's full desktop/mobile run on `742dae2b` reported 14 failures across
three groups. Anonymous starter onboarding omitted goal definitions/settings from
both restricted download lists; both now include the existing `goal` and
`goal_user_settings` tables. Two auth lifecycle regressions protect those download
contracts. This uses existing Worker/schema ownership rules; no migration,
generated-contract edit, or local shared-goal authoring is involved.

The older Add-to-review feedback suite now explicitly seeds Recall minimum zero,
as the persistence suite already does, so its future-due tunes remain available
for manual addition. Toast dismissal now retains the exact close-button DOM node
through its exit instead of letting a `first()` locator retarget another toast.

All 1,339 unit tests, typecheck, lint, formatting and diff checks pass. After
1Password authorization, the three affected suites passed on desktop Chromium and
Mobile Chrome: 27 tests including authentication setup, in 3.5 minutes. This covers
all 14 previously failing cases; it is not a fresh full-suite E2E run. No servers
were restarted.
No commit/push or next-stage implementation has been performed in this follow-up;
the separately identified CodeRabbit fixes remain pending.


## CodeRabbit follow-up — queue recovery and dialog accessibility

The developer subsequently confirmed the full local E2E suite passed. Those
regression fixes were committed separately as `b80a8148` before this review batch.

Addressed the three confirmed findings from the review of `742dae2b`:
- Failed manual/Latest queue loads still reject to their callers, but readiness
  refetches await a non-rejecting settlement promise. An old failure cannot poison
  a successful sync or save-only recovery. Tests also retain current-load errors.
- The queue-date selector now uses Kobalte's modal focus management, retaining
  dragging, resizing, backdrop dismissal and Escape. Its external opener regains
  focus on close; component tests cover initial focus, forward/backward Tab
  containment, Escape, backdrop dismissal and restoration.
- Settings navigation visibility assertions allow at least ten seconds.

The two repertoire-date questions did not require changes: preferred windows
already normalize to the SQL timestamp format, and refreshing an empty day clears
the manual preference. Later explicit navigation intentionally takes precedence.

Validation: all 1,345 unit tests (105 files), typecheck, lint, formatting and diff
checks pass. The next full local E2E run remains with the developer after this batch is pushed.
No servers were restarted and no next-stage feature work was started.

## CI baseline seed correction

Run 44411252996 at `561b87dd` failed eight Goals/settings cases across four
browser shards; quality, unit and PWA jobs passed. CI traces showed built-ins
rendered with legacy keys (`recall`, `session_ready`) and empty descriptions.
The post-migration baseline restore had replaced the configured goal rows.
Local databases retaining the migration's definitions did not exhibit this.

The existing goal-seed generator now also emits
`supabase/seeds/seed_goal_configuration.sql`, discovered after the baseline by
Rhizome and explicitly ordered after it in Supabase's seed configuration.
`goals:seed:check` checks this generated copy too. The database guard suite now
checks the actual seeded built-ins before creating fixtures. Existing migrations,
schema contracts, runtime code and E2E assertions are unchanged.

Validation: typecheck, focused Biome checks, seed drift check and all 29 database
guard tests pass. A rollback-only integration check reproduced missing legacy
metadata, applied the generated seed twice, and verified every built-in's display
name, description and full configuration against typed defaults. It left local
data unchanged. Remote CI validation remains pending.

CodeRabbit reviewed all six changed files and raised one ordering verification
question. The failed CI run checked out Rhizome
`94a21bf2963b11c86369a96b5ebf50dcc763748e`, matching the installed package.
Its `db-push-local.sh` expands `supabase/seeds/*.sql` in filename order and
executes that array in order. With this change the sequence is baseline, current
goal configuration, then private test tunes. The actual CI checkout script was
compared with the installed script; no Rhizome change is needed. Repo-wide lint
and format checks also pass. No actionable CodeRabbit findings remain.

## Versioned scheduler integration: execution contract

The shared QuickJS protocol now accepts `scheduleGoalV1(payload, meta)` as a
direct function, separate from the legacy numeric-review factory API. It uses
the existing sandbox, deadlines and error propagation. The real-VM tests verify
that evaluation identifiers and JSON state pass through, asynchronous results
settle, and script errors do not invoke the legacy factory. Protocol tests reject
legacy method dispatch on the new entry point.

The developer confirmed explicit per-goal plugin selection and recoverable errors
without fallback, and chose plugin-declared compatibility with earlier state.
`plugins/goal-scheduler.ts` now implements that execution boundary using the real
sandbox. It first calls `describeGoalSchedulerV1()` for `{ apiVersion: 1,
stateVersion, compatibleStateVersions, actions }`, then calls `scheduleGoalV1(input)` with
the same captured script. These are separate VM contexts: declarations must be
stable for the script and scheduling must not depend on globals set by the
description call.

The developer also selected named plugin actions for the goal editor. The
declaration includes a nonempty `actions` list of `{ id, label, description }`.
Action IDs must be nonempty and unique; labels must be nonempty. Calculation
rejects a missing selected action before invoking the scheduling function.

Scheduling input includes API version, goal ID, `evaluation: { id, actionId }`, practiced
ISO timestamp, options, target state version, and `previousState` (null or
`{ version, data }`). The plugin returns `{ due, state }`: due must be a UTC ISO
timestamp in `Date.toISOString()` format, and state must be a JSON object.
Due time is quantized to seconds, and fractional `intervalDays` is derived by the
host. The bounded state envelope records plugin identity, code version, exact
script hash, state version and plugin data. The host checks envelope validity;
the plugin owns semantic validation of its data. Invalid results propagate as
errors, without producing a replacement schedule.

Only the latest same-goal/same-plugin event is eligible for continuation. The
manifest must list the current state version as readable and may list earlier
versions; undeclared versions start fresh. Script changes alone do not reset
explicitly compatible state. Malformed matching state blocks calculation.

Validation: typecheck, lint and formatting pass; all 80 plugin tests pass,
including real-VM continuation across code/state versions, goal/plugin isolation,
script snapshot isolation, invalid dates, payload limits and error propagation.
Goal configuration, preview/staging/Submit wiring and UI activation remain
unfinished. That wiring must include exact script/metadata in configuration
fingerprints, so compatible script edits still invalidate staged previews.
No schema, live scheduling behavior or UI changed.

CodeRabbit reviewed the execution-contract changes and identified one valid DST
bug: a local millisecond setter could move a due instant into the earlier
occurrence of a repeated hour. Quantization now uses the UTC setter. A regression
test explicitly sets America/New_York and verifies the second occurrence remains
future and retains its exact interval. The named-action extension was added while
that review ran and has separate validation/removed-action tests; do not count it
as independently re-reviewed by CodeRabbit.

### Required legacy-plugin removal checkpoint (within #426 / PR #940)

`src/lib/plugins/scheduling.ts` is transitional and must be removed before this
PR is considered complete, during activation of the new evaluation/staging/Submit
flow—not deferred to an unspecified cleanup issue.

- [x] Replace its active caller in `services/practice-recording.ts` with the
  goal-aware flow, including explicit plugin selection and recoverable errors.
- [x] Retire legacy `createScheduler` support. Goal settings require the versioned
  declaration and named actions before selection; no implicit plugin selection,
  factory adapter or fallback orchestration remains.
- [x] Move relevant behavior coverage to the new executor and remove
  obsolete `scheduling-output.test.ts` coverage with the implementation it tests.
- [ ] Validate evaluation previews, stale-input checks, Submit, plugin failures
  and persistence on desktop/mobile; then delete `plugins/scheduling.ts` and
  verify no imports remain. Keep the shared QuickJS runtime.

## Explicit plugin configuration and guarded practice-service integration

Goal configuration now accepts `{ id: "plugin", version: 1, pluginId, options }`
and evaluation actions `{ kind: "plugin", actionId }`. Built-in and plugin
actions cannot be mixed. The synchronous resolver reads only the explicitly
selected, enabled, owner-visible/public scheduling plugin from local SQLite;
it does not select the newest matching plugin. Missing/private/disabled plugins
block new calculations without changing the selected goal or substituting FSRS.

The shared calculator now invokes the validated executor. Preview fingerprints
and transaction-time comparisons include exact script, version, name and
capabilities. Script edits without a version bump still invalidate staged work.
The existing staging and Submit services persist truthful plugin identity,
fractional intervals and authoritative JSON; FSRS-only projections remain null.
The shared state reader recognizes plugin envelopes so changing back to a built-in
scheduler starts fresh. No schema or generated artifacts changed.

Exact retries of already committed events still verify repertoire ownership,
active membership, event content and completed queue attribution, but do not
require the old plugin to remain enabled. They flush persistence without running
the plugin again or duplicating events/exposures.

CodeRabbit identified a valid nondeterministic-plugin issue: replaying the script
at Submit could disagree with the reviewed preview. Plugin staging now binds the
checked event content and current input fingerprints into its calculation hash.
Submit checks this receipt and commits the exact staged result without executing
the plugin again. Built-in replay checks remain unchanged. Event canonicalization
is shared with exact-retry comparisons rather than duplicated. Tests cover random
plugin output and rejection of altered staged state. The other review concern,
switching back to a built-in scheduler, is covered for both FSRS and ladders.

Validation: all 1,389 unit tests pass (including 67 focused integration tests),
along with typecheck, lint, formatting and diff checks. Coverage includes real SQLite + QuickJS staging,
submission, continuation, script-edit races, retained drafts on failure, public/
private visibility, disabling a plugin and completed-event retries. Typecheck
passes. Settings plugin selection, save-time declaration validation, and active
practice evaluation/Submit UI activation remain pending. The existing UI still
uses the transitional orchestration; the removal gate above remains unchecked.
No local E2E, server restart, migration, deployment, commit or push performed.


## Plugin selection and named-action settings checkpoint

Based on `2a02cd29`, the Goals editor now lists enabled owner-visible/public
scheduling plugins alongside built-in schedulers. Selecting one inspects its
versioned declaration in the existing sandbox and seeds editable evaluation
labels/descriptions from its named actions. Reloading a selected plugin retains
personal labels, evaluation identities and existing options. Removed effects
remain visibly unavailable and cannot be saved without an explicit replacement.
Load errors retain the draft and expose Retry; changing scheduler supersedes
older asynchronous results.

Save/create validate the current declaration, compare the reviewed script and
manifest, and recheck plugin visibility, the goal revision and auth/DB lifetime
before the synchronous local write. No declaration/script races silently change
the reviewed choice. The same declaration parser/executor is reused by settings
and practice. No schema, generated artifacts or server configuration changed.

Active practice evaluation/Submit integration and removal of transitional
orchestration remain the next checkpoint. This settings capability alone does
not activate the new practice pipeline. Plugin-specific options retain existing
values; defining a custom options form/schema is not part of this batch.

### Feature verification record (Q1)

Tracking destination: this section. Scope: new scheduler picker, named effects,
load/retry and save validation in Settings → Goals → Edit/Add goal, on the local
uncommitted branch after `2a02cd29`. Existing desktop/mobile servers reused;
per-worker E2E fixtures supply one owned versioned scheduler.

- F1/F3/C3/R2: native labeled selects, descriptive action text, semantic classes,
  persistent errors and stable selectors implemented. Component interaction
  tests pass for selection, pending-save prevention, load retry, obsolete async
  results, retained personal choices and unavailable effects.
- E3/E4/E5: SQLite settings tests pass for script/declaration changes, visibility,
  stale goal edits and session changes; no writes on validation failure.
- Browser desktop/mobile persistence/offline coverage: passes on both projects.
  The existing CRUD and badge tests also passed in the preceding runs. Browser
  testing exposed an async native-select display bug; explicit option selection
  now preserves the stored non-first action after declaration loading. The new
  fixture uses a unique goal name and waits for Save to close the editor before
  reloading, avoiding matches against goals retained from previous runs.
- R4/R5/L2/Q2: visual contrast, both themes, 320/768/1280 widths, 200% zoom,
  assistive technology and keyboard-only flow not yet tested in this checkpoint.
- Existing Settings shell/editor gaps (E2/E6/F2): per-record save controls,
  category-wide draft/footer, shared exit guards and field-error focus remain
  pending the planned goal UI/design-system pass. This batch adds no alternate
  save surface and does not claim those existing workflows are compliant.

Validation: 1,407 unit tests passed; the 11 editor tests passed again after the
async option-selection fix. Typecheck, lint, formatting and diff checks pass.
CodeRabbit completed its uncommitted review with two findings: fixed retention
of the previous account's plugin choices during an account/DB change; the
stale-plugin-save concern was already prevented by snapshot checks before and
inside both save/create transactions, with regression coverage. No server
restarts, commits or pushes performed in this checkpoint.


## Active practice integration preparation

The settings checkpoint was committed and pushed as `80736ffc`; the developer
confirmed full local E2E passed. Issue #426 and PR #940 checklists now distinguish
completed settings/domain integration from pending active practice UI integration.

The new Submit boundary no longer imports legacy recording orchestration merely
for manual-schedule preservation: both paths use the unchanged shared policy in
`services/scheduled-override.ts`. No runtime scheduling behavior changed in this
extraction. The active picker, staging and Submit paths are still legacy. The approved UI keeps the existing in-row picker and Submit layout. A completed
evaluation retains its label and gains a dropdown indicator; its small menu offers
Practice again, which restores the existing picker. No new dialog, permanent
preview block or scope change is intended. This clarification is also recorded in
`_notes/426_goals_plan.md` section 5.


The next Submit integration now has a queue-scoped receipt reader and an
owner-checked evaluation-clear operation. Clearing retains notes/purpose while
removing scheduling state and the prospective event ID. It leaves submitted
history, completion/display links and current due dates untouched. Persistence
can be retried after an in-memory clear. Neither helper is connected to the
active legacy practice UI yet; the integration must switch picker choices,
staging and Submit together rather than send new evaluation IDs into the old
FSRS-only path.

Regression coverage includes selected queue/date and owner scope, stale captured
receipts, preserved note-only drafts, canceled request lifetimes, persistence
retry, same-day/later-day repeat event identity, exact repeat submission retries,
and cancellation restoring the prior completed state without rewriting history.


CodeRabbit completed the local review and raised one cancellation-contract
question. The caller must invalidate pending staging before clearing, even if no
draft has been written yet. This is now explicit in the clear API documentation
and covered by a first-evaluation cancellation regression. The UI integration
must retain its per-tune request-token invalidation; a database delete alone is
not cancellation. Full unit verification, typecheck, lint, formatting and diff
checks pass. No browser rerun was performed for these currently disconnected
service changes. No commit or push in this preparation batch.


## Active picker and Submit integration

Preparation was committed locally as `9e12bd68`, without pushing. The following
working-tree batch activates goal-specific choices, staging and atomic Submit
together in the grid, stacked list and flashcards. The completed evaluation label
opens the agreed small Practice again menu; no dialog or permanent preview panel
has been added. Choice descriptions stay in the menu, and the selected label stays
compact. Explicit plugin errors remain unsubmitted with a row-level Retry action.

The active Submit controller guards double activation, scopes receipts to the
selected queue, refreshes stale calculations only if the original draft still
exists unchanged, and requires another Submit afterward. A typed persistence error
retains exact receipts after an in-memory commit so Retry cannot duplicate history.
Queue completion display follows the linked event rather than an unrelated newer
record. Clearing a repeat draft preserves prior completion and notes.

Verification and remaining boundaries: focused controller/domain tests cover
request races, persistence retry, stale refresh, canceled drafts, repeat identity
and linked-event display. Browser coverage is being rerun for desktop/mobile
Fluency, explicit plugins, offline submission and Practice again. The first mobile
run exposed a stacked-row overlay intercepting evaluation taps; the evaluation
wrapper now uses the same interactive stacking layer as the other row controls.
Full visual/assistive/design-system matrix and transitional artifact removal remain
open; this batch does not claim the broader UI audit or #931 is complete.


Validation update for the active integration batch: all 1,426 unit tests,
typecheck, lint, format check and diff check pass. Desktop and Mobile Chrome
FSRS progression passed. The Fluency suite passed all five scenarios on both
platforms after correcting its record-query projection and using the existing
responsive Show Submitted helper (the mobile repeat scenario passed its targeted
rerun). Explicit plugin offline sync, error and timeout behavior are covered.
The new-plugin editor now seeds the goal scheduler contract, with a real QuickJS
execution test. The legacy template remains only for transitional service tests.

UI matrix for this batch (C3/E5/F3/R2): desktop/mobile picker, submission,
repeat/cancel and plugin failure/offline flows pass browser checks. Dark/light,
320/768 widths, zoom, screen-reader announcements and exhaustive keyboard/focus
checks remain not tested in this batch and belong to the planned design-system
pass. No blanket UI-compliance claim is made. CodeRabbit completed with ten findings/questions. Fixed the stacked-list tap
layer, stale evaluation errors after a successful goal change, and refresh after
partial restaging failure. The scheduled-grid and flashcard entry points now
require the effective-goal model, avoiding a silent optional-model path. Existing
consumers all supply it; legacy Recall choices are deliberately not substituted.

The remaining review questions were checked against the implementation and tests:
clear's result is intentionally ignored (request lifetime controls cancellation);
exact persistence retries reuse already committed event IDs; non-persistence
errors do not retain retry receipts; built-in Fluency selection resolves by name
and passes browser coverage; owner-private name resolution has domain coverage;
and the narrow hook tests pass with their existing fakes. Added focused tests for
failed-goal recovery and partial-refresh visibility. No changes were pushed.


## Regression follow-up after the full E2E run

The 61 reported failures were largely cascading evaluation-picker failures: the
active integration had removed the existing selected `label: description` text.
That presentation is restored using each goal's labels/descriptions. Flashcard
shortcuts now work when the mode switch or navigation button retains focus,
without intercepting text editing, open menus, or Space activation on a control.
The rapid rating-change test waits for the asynchronous picker to be enabled.

Scheduling fixtures now use real per-goal settings instead of obsolete global
FSRS test overrides, and the explicit plugin contract instead of automatic plugin
matching. The repeated-Easy growth assertions and plugin's exact 17-day result
remain intact. The Again test verifies the exact 25-hour due-date floor plus the
new integer ceiling projection, rather than mistaking the compatibility column
for the actual duration.

Approved during this regression review: each FSRS goal exposes **Allow reviews
later the same day** in Advanced settings, off by default. The optional
`scheduler.allowSameDayReviews` field uses existing configuration JSON; absent is
off, with no schema migration. Off applies the existing shared next-day helper;
on preserves short FSRS intervals. Model state is unchanged, and same-day repeats
remain manual Practice again actions. Ladder/plugin sub-day outcomes are unchanged.
This decision is also recorded in `_notes/426_goals_plan.md`.

Validation: 1,437 unit tests pass, including both timing policies and missing-field
configuration support. Typecheck and lint pass. Desktop/mobile settings tests
verify the unchecked default and persistence after enabling/reloading. Earlier
reruns passed 122 affected/serial-descendant tests, then 27 targeted scheduling and
keyboard tests (two existing skips), and six offline/PWA tests. The broader
scheduling run passed 50 tests with two existing skips and one plugin-timeout
failure after a page reload discarded the in-flight request. With source files
left unchanged during the final rerun, all 33 keyboard/Fluency tests passed
(two existing skips), including that timeout on both platforms and the new
Settings keyboard-isolation regression. All six offline/PWA tests passed again
against the final rebuilt preview bundle. A fresh complete E2E suite remains for
the developer's confirmation; these results are focused reruns, not a claim that
the entire suite ran clean in one pass. The broader visual/assistive UI matrix
remains unverified.

CodeRabbit's first review raised two questions: explicit plugin selection and the
repeated-Easy cap. The seed helper saves the plugin selection via goal settings;
the test now passes on both platforms. A daily maximum of one allows a 150-day cap
and the required growth; obsolete global-override/fuzz test branches were removed.
No commits or pushes have been made in this follow-up.

CodeRabbit's second review found background flashcard shortcuts could operate
while Settings was open. The guard now checks the shared Settings context and
ignores dialog targets, with desktop/mobile browser coverage. Its three other
questions are covered: configuration accepts missing/boolean values and rejects
non-booleans; editor changes preserve the scheduler object via spreads; calculation
tests verify 25-hour versus ten-minute results for the same first Good evaluation.


## Mixed-goal Practice History batch (2026-11-19, uncommitted)

Scope: the existing tune Practice History page and its Add Practice Entry form.
The agreed selector controls the whole view. All goals retains chronological common
columns and session counts; selecting a goal exposes its supported columns and
analysis. Stored labels and JSON state are authoritative. FSRS graph continuity is
split before filtering, so hiding intervening goals does not join separate histories.
Unsupported events remain visible, with unavailable details rather than false zeros.

The existing +Add form now selects a goal and its evaluations. It defaults to the
filtered goal or the tune's current goal. Manual entry shares goal resolution and
calculation, uses the preceding event at the entered date, and leaves later events
and current scheduling unchanged when backdated. The user approved rejecting future
dates because future records become canonical predecessors and block normal practice.
No history replay, revision table, schema migration or deletion-sync repair was added.
Deletion still has the existing local-only limitation, now stated in confirmation.

Validation: 1,477 unit tests, typecheck, lint and format checks pass. Twelve new SQLite
manual-entry regressions cover future dates, backdated preservation, predecessor
selection, ladder entry, changed inputs, ownership, obsolete callers, persistence
retries, displayed-settings changes, queue/draft preservation, undated legacy rows
and time collisions. Ten history-reader tests cover snapshot authority,
unknown/malformed data, mixed-goal metrics, resets, legacy decoding, missing intervals,
same-day events and filtered graph breaks. CodeRabbit completed with 12 findings;
all actionable findings are addressed, including stronger assertions, linear-sized
chart datasets, stale form/delete scope guards, resource-error recovery and the
existing Good default for FSRS. After retrying 1Password authorization, the focused
desktop Chromium/Mobile Chrome run passed all 15 tests (including auth setup) in
35.9 seconds. This is focused workflow validation, not full-suite E2E or complete
design-system acceptance.

### UI verification tracking (design-system Q1–Q3)

Report scope: tune sidebar → Practice History, goal selector/table/details/charts,
Add Practice Entry and deletion confirmation. Baseline 8ee1464d plus this working
tree; local SQLite fixtures and existing desktop/mobile dev servers. Servers were
not restarted. Rules: T1 common table, T/B filter/data states, V2 semantic styling,
A3 deletion action, E/F manual form, R dialog/access/layout behavior.

- Data correctness: unit tests pass for supported and unavailable event states.
- Browser workflows: pass on desktop/mobile for empty history, Recall entry and
  analytics, Fluency entry and goal-scoped rows/columns/charts, future-date rejection,
  read-only saved rows, confirmed deletion and return navigation.
- Grammar/layout: semantic tokens used for new content; light/dark screenshots,
  320/390/768/1280 widths, 200% zoom and long-label checks not yet tested.
- Access: primitive confirmation and labeled controls used; keyboard-only,
  screen-reader, focus-return and reduced-motion checks not yet tested.
- Editing/exit paths: save, future-date validation, confirmed deletion and return
  navigation pass. Existing route departure/dirty-form protections require
  follow-up; this batch is not a whole-app UI audit.
- Persistence/error recovery: SQLite retry/ownership tests pass; browser offline,
  failure/retry and navigation during save remain unverified.

### Follow-up CodeRabbit review (2026-11-19)

All seven findings were addressed. Manual-entry form state and pending persistence
receipts are isolated by database/user/repertoire/tune for the lifetime of the page:
changing repertoire leaves the new view usable, returning restores a pending retry,
and late results do not display errors in a different view. A receipt remembers a
successful SQLite insert so retrying persistence cannot recreate an entry deleted
in the meantime. Supported scheduler columns remain visible when another event has
unavailable state; deleting the selected goal's last event resets the filter to All
goals. Save now shows progress and a device-save success toast, and failed history
loads show Retry without a perpetual loading indicator.

Validation after these fixes: 1,482 unit tests across 111 files pass, including four
new component recovery tests and a thirteenth SQLite manual-entry regression for
deletion between persistence attempts. Typecheck, repository lint and format checks
pass. The focused desktop Chromium/Mobile Chrome History suite passes all 15 tests
(including auth setup) in 39.0 seconds, with additional coverage for filter reset
after deleting the last event for a goal. Servers were not restarted. Component
coverage verifies navigation during save and query retry; actual browser offline
persistence recovery and the visual/accessibility matrix above remain unverified.
Changes remain uncommitted and unpushed.

## Legacy completed-queue display investigation (2026-11-19)

History checkpoint: local commit `b73a8573`, not pushed. Read-only inspection of
local Supabase found older completed rows for Ballydesmond Polka, Tobin's Favorite
and Young Tom Ennis without `displayed_practice_record_id`. In the latest sampled
queue (November 2, 2025), completion is 03:26:57; the corresponding latest practice
rows have practiced 08:26:57 and modified November 3 at 04:57:13.050. These are
candidate associations, not verified links. The current migration's exact
modification-time rule cannot establish them. The offsets may reflect historical
timezone/import behavior; this investigation has not established their cause or
data corruption. No application data was changed and no migration was run.

The main-branch grid used `latest_quality` for completed rows, which explains how
it could display a rating without this event link. The new queue instead requires
an identified event; that semantic change was not sufficiently covered by tests.
Browser access was unavailable (browser host unavailable and native Chrome access
timed out), so the exact browser SQLite rows and screenshot state remain unverified.

An independent compatibility fix now reuses `readHistoryEvent` for linked queue
evaluation labels, including supported legacy Recall ratings. It does not use the
current assigned goal to reinterpret a historical rating or guess an event for an
unlinked queue. Added SQLite regressions cover linked legacy Recall after a goal
switch, unlinked legacy completion, and unsupported legacy goal semantics; the
existing new-format linked-event test also checks the displayed label. All 109
focused tests pass, along with typecheck and scoped Biome checks. This fix is
uncommitted. How to present unlinked old completions remains a user decision;
do not silently substitute the latest rating as the original completion evaluation.

### Correction: excluded historical database evidence (2026-11-19)

The earlier investigation used an old, git-ignored SQLite file outside this
worktree without establishing its relevance. The developer has explicitly excluded
that file. Claims that it verified the three example associations, established the
import timezone, or reconstructed all 344 remaining completions are withdrawn.
The derived mapping is not a migration input or a test oracle. Original integer
record ordering, source batch partitions and counts from that file are not evidence
for this conversion.

The uncommitted America/New_York matching branch and its synthetic unit/transaction
tests have been removed. The worktree importer calls `new Date(sqliteTs)` without
pinning a timezone; its device marker does not prove the environment in which it
ran. The existing exact modification-time matcher remains unchanged.

Independent runtime fixes remain: linked legacy Recall events use the shared
history reader for labels; missing legacy lapse counts use the existing zero
initialization policy with an explicit limitation. New-format JSON remains strict,
and no runtime latest/nearest fallback has been added.

Fresh read-only inspection of local Supabase finds 591 active imported completed
queue rows with no displayed-event links, plus three linked non-imported rows.
These are current local counts, not proof that records are missing. Further
association analysis is restricted to this worktree's seed data, local Supabase
and relevant versioned code. No static ID mapping, retained database conversion,
reset, staging/production access, commit or push is part of this correction.

### Reassessment from worktree seed and current local Supabase

Compared the checked-in `supabase/seeds/baseline_local_20260217.sql` with
local Postgres using temporary tables in a rolled-back transaction:

- All 1,169 seeded practice records exist locally, with every seeded column
  identical. This comparison uses record IDs, not tune titles.
- The seed contains 591 active imported completed queue rows, matching the local
  imported completed count. All 614 imported queue rows exist locally; 611 have
  identical seeded columns. Two additional non-imported seed rows are absent.
  Local test activity therefore means the whole database is not an untouched seed.
- All 591 unlinked completed rows have same-owner/repertoire/tune history. None
  has an exact practiced/completed or modified/completed timestamp match. Only
  34 have exactly one practice timestamp within generation/completion, which
  is not sufficient evidence of association.
- The imported practice rows have just ten distinct modification timestamps,
  spanning 2025-11-03 04:57:13.040–04:57:13.050. These timestamps cannot recover
  individual submission times.
- Grouping completed tunes by owner/repertoire/completion and practice tunes by
  owner/repertoire/practiced, then comparing distinct tune sets without adjusting
  timestamps, yields 65 unique candidate batches covering 488 queue rows; four
  ambiguous batches covering six rows; and 21 unmatched batches covering 97 rows.
  These are candidate-set counts, not verified links. No integer source ordering
  or archived database was consulted in this reassessment.

The remaining problem is historical association, not absent practice history or
missing schema columns. The database does not directly record the old submission
relationship. A dynamic reconstruction still needs a justified matching policy;
uniqueness of a tune set alone is not proof. Automatic post-seed conversion and
retained link writes remain pending. Do not replace this gap with hard-coded IDs,
a timezone assumption, or a runtime latest-record fallback.

Validation of the correction: typecheck passed; all 150 focused tests across
queue completion, history presentation, state decoding and goal resolution passed;
scoped Biome checks passed. No application rows were modified, and no reset,
commit, push or staging/production operation was performed.

### Latest-queue recovery decision and window check (2026-11-19)

The developer accepts incomplete historical queue attribution and asks to prioritize
the latest queue, with shorter unavailable labels. Checking the actual queue window
(start inclusive, end exclusive) yields one candidate for 507 imported completions,
none for 82, and two for two. This differs from checking generation-to-completion.
The latest imported window contains one candidate each for Ballydesmond Polka,
Tobin's Favorite and Young Tom Ennis, with ratings Good, Hard and Hard.

The migration now permits this best-effort recovery only for the latest active
window per owner/repertoire, for legacy events with matching import provenance,
when exact modification-time evidence is absent. It never chooses between multiple
events, changes timestamps, or uses archived data. Writers recheck the full queue
context under locks, including newer active windows. Existing exact matching remains.
A rollback rehearsal recovers three links, reports 588 unresolved completions and
makes no retained changes. The UI label for an unlinked completion is now “Not
available” (design-system C2); Practice again remains available. Browser appearance
and accessibility were not rechecked for this text-only change.

`snapshot_coalesced_ts` captures the scheduling date used for queue classification:
manual scheduled date, otherwise latest due date, otherwise the queue window start.
It is not the practice timestamp and must not be used as submission identity.

### Applied local reset/seed/conversion rehearsal (2026-11-19)

With explicit developer authorization, `npm run db:local:reset` completed (auth
setup passed, then baseline and genre/rhythm seeds loaded). The current reset npm
command omits the generated goal configuration seed, so it was reapplied separately
using psql with ON_ERROR_STOP before conversion. This is a manual local rehearsal;
post-seed conversion is not yet wired automatically into reset or CI.

`goals:migrate -- --local` passed, followed by `--local --apply`: three queue links,
1,709 goal references and 20 personal Recall settings were committed. All 1,169
seeded practice records remain; a deterministic full-row checksum excluding only
`goal_id` is identical before and after conversion. All now have goal attribution.
The three linked events match their queue repertoire/tune and retain Good, Hard,
Hard. The other 588 completed historical rows remain unlinked by design. A second
dry run reports zero writes in every category and zero unresolved goal references.

The target was only 127.0.0.1:54322/postgres. Staging and production were untouched.
No browser access/storage changes or server restarts were performed in completing
this rehearsal. The developer will refresh the browser mirror separately; browser
verification and a full post-conversion E2E run remain pending. No commit or push.

### Extended recovery to historical imported windows (2026-11-19)

At the developer's request, removed the newest-window restriction. Every active,
completed, unlinked imported row is eligible for the same unique-in-window rule.
Same owner/repertoire/tune and import provenance remain required; zero or multiple
candidates remain unresolved. No latest-event fallback or timezone adjustment was
added. Existing links are untouched. Tests cover recovery despite a newer queue,
selection of the in-window event despite later practice, and ambiguity rejection.

After unit/transaction checks and a successful sequential dry run, local apply
added 504 links (507 total), leaving 84 unavailable. A whole-practice-table checksum
before/after matches exactly; repeat dry run reports zero writes. The initial dry
run overlapped the transaction test's table locks and failed; the sequential run
passed. Migration commands and DB transaction tests must run sequentially.

The October 30 screenshot's four rows remain unresolved: their windows end at
October 31 00:00 UTC, while the next practice records are October 31 03:27:55.
Those events are not in-window, and this recovery intentionally does not infer a
timezone correction. Browser mirror refresh remains a manual developer action;
no system browser access, reset, production/staging changes, commit or push occurred.

### CodeRabbit review before full local E2E (2026-11-19)

CodeRabbit CLI 0.9.5 reviewed all 13 uncommitted files and returned one conditional
finding against the imported-window test: whether changing `row.scheduler_id`
actually makes the event ineligible when the top-level `schedulerId` stays null.
The concern is refuted by `hasNewEventMetadata`: it checks both the top-level
identity and `newEventFields`, which explicitly includes `scheduler_id`. The fixture
intentionally covers partial new-format metadata and correctly remains unlinked.
No code changes were warranted by this review.

Validation: all 1,498 unit tests pass, along with repository typecheck, lint,
format:check and diff whitespace checks. The preceding database transaction tests
also passed. Full local E2E is left for the developer's next run. This review made
no database/browser changes and no commit or push.

The developer subsequently confirmed the full local E2E run passed after this
review and authorized committing/pushing this checkpoint. Remote CI for the new
commit remains pending.

## Transitional scheduling orchestration removal (2026-11-19)

Removed `services/practice-recording.ts`, `services/practice-staging.ts` and
`plugins/scheduling.ts`. Repository-wide caller searches showed the active UI
already uses goal-aware staging/Submit. Only unused `stageEvaluation` and
`commitStaged` test-API methods retained the old path; both declarations and
implementations were removed rather than creating another compatibility adapter.
The obsolete hydration mock and implicit-plugin output tests were removed too.
The named-action plugin executor's validation/error/no-fallback coverage remains.

Moved the old mocked commit-race regression into the real SQLite goal Submit
suite: a same-rating draft staged while an earlier submission awaits device
persistence survives, and the original event/queue link remains correct. Existing
stale-input, failure/retry, plugin and repeat-practice tests remain. No application
UI, schema, generated contract, backend data or browser storage changed.

This completes removal of the parallel staging/recording/plugin orchestration,
not the entire transitional-artifact merge gate. Remaining cleanup includes the
old FSRS service/constants/comparison tests, legacy queue helpers, the Spaced
Repetition panel, and remaining legacy plugin APIs in the developer test runner.
The shared QuickJS runtime and legacy *data decoder* are still required.
Production migration execution and broader UI review remain separate.

Validation: repository typecheck, lint, format:check and all 1,491 remaining unit
tests pass. The count decreased by seven: eight obsolete tests were removed and
one real-SQLite race regression was added. CodeRabbit reviewed the nine changed
code/test files with zero findings. Architecture/checkpoint documentation was
updated separately. No E2E run was performed for this cleanup batch, and nothing
has been committed or pushed.

## Retire global FSRS settings UI (2026-11-19)

The preceding orchestration cleanup is committed locally as `98137cf6`, without
pushing. This follow-on batch removes the obsolete Spaced Repetition form and
its sidebar entry from both Settings shells. Existing route and programmatic
entry points open Goals, where each FSRS goal already owns its Advanced settings.
No schema, saved preference, scheduler calculation or migration behavior changes.
Legacy preference storage remains available to the coordinated cutover.

Replaced tests of the removed global form with a legacy-link regression that
opens Recall's Advanced controls. Navigation coverage now checks that the obsolete
tab is absent. The Advanced disclosure has a stable test ID and page-object
locator, also used by the existing same-day option persistence test.

CodeRabbit raised three items. Applied the selector improvement. The retention
question is covered by `prepareLegacyRecallSettings` and its existing regression
preserving `0.85`; removal of the unused form does not change active scheduler
inputs. The missing-Recall question is covered by the shared generated goal seed
(retained by per-user cleanup), full local resync, and passing desktop/mobile
legacy-link checks; no extra per-test copy of shared goals was introduced.

Validation: typecheck, lint, formatting, and all 1,491 unit tests pass. The focused
Settings suite passed all 23 tests (including setup) on desktop/mobile. The targeted
post-review rerun passed after 1Password authorization: all five tests (four
desktop/mobile cases plus setup) passed, covering the new selector and existing
same-day option persistence. Changes remain uncommitted and unpushed.

UI verification scope: navigation consolidation and old entry points (G3/C1),
reusing existing Goals/Advanced controls (F4/R2). Desktop/mobile navigation and
entry-point behavior passed automated checks. Theme, keyboard/focus, zoom and
broader design-system acceptance are not tested in this batch and remain part of
the separately planned goals UI review; this is not a whole-UI compliance claim.


## Remaining legacy-code cleanup (2026-11-19)

The Settings batch above is committed locally as `bbda1df8`, without pushing.
This cleanup removes the obsolete FSRS service/interface, parallel queue allocator,
legacy plugin factory and host FSRS bridge. The shared QuickJS runtime remains;
its supported entry points are import and the two versioned goal-scheduler calls.
The developer Test Runner now offers those same calls and a matching example
payload. Goal settings already inspect the versioned declaration before saving a
plugin selection; old factory-only scripts require replacement, not silent fallback.

Queue navigation remains in `services/practice-queue.ts`; all queue mutations use
the active goal service. History rating constants moved unchanged to
`goals/ratings.ts`. Legacy data decoding, migration inputs and compatibility
columns remain necessary and are not removed by this runtime cleanup. No schema,
generated artifact, saved data or migration behavior changed.

The old numerical FSRS snapshots were renamed without changing their contents.
They now run against the active FSRS calculator, preserving numerical comparison
coverage without keeping a second production implementation. Removed duplicate
parity checks, obsolete compatibility-field writer tests and old allocator tests;
the active JSON commit and goal queue suites retain persistence, race, allocation,
ownership, stale-input and retry coverage.

The bucket E2E fixture was still using the old allocator through an unused
add-to-review seed API. It now uses the active Refresh boundary, with an explicit
minimum/maximum of nine to include all nine fixture tunes. Classification and
count assertions remain; ordering asserts due/recent overdue/old overdue/new,
as required by the agreed backlog-before-new policy. No synthetic practice
history is inserted by the replacement helper.

CodeRabbit's first review raised four checks. The rating map remains exactly
1=Again, 2=Hard, 3=Good, 4=Easy. Versioned plugin selection is already mandatory.
The obsolete seed helper was removed; the replacement Refresh uses explicit
scheduled dates before historical due dates, as specified by the active allocator.
Added a real-VM test of the developer runner's default goal payload without a host
bridge. Full browser verification of this batch is reserved for the user's local
E2E run before pushing. Final validation/review results are recorded below.

Validation: all 1,435 unit tests, repository typecheck, lint, format:check and
diff whitespace checks pass. The FSRS snapshot contents are byte-for-byte
unchanged. The unit count decreased by 56 after removing obsolete/duplicate
coverage and adding the direct template invocation regression. This cleanup is
uncommitted; both earlier local commits remain unpushed. No E2E tests or server
restarts were performed in this batch.

Final CodeRabbit pass included the revised bucket fixture and raised six checks.
Applied its bridge-test improvement: reject any query other than the expected
history request. Traced the runner's parsed JSON payload through direct invocation
and JSON result display; it matches the tested template contract. Queue allocation
uses one increasing order index across buckets, Refresh rebuilds incomplete rows
from explicit scheduled dates, and normalized window matching preserves completed
rows. Existing goal selection requires the versioned declaration; this batch
removes the leftover developer/runtime factory API, not an active goal executor.
Those checks did not require production changes. The E2E bridge assertion is
typechecked but awaits the user's browser run along with the rest of this batch.

2026-11-20 handoff: the user reports that the full local E2E run passed.
Subsequent SonarQube fixes nest the three Practice History filter controls inside
 their labels (retaining IDs and layout); Biome sorted the starter-repertoire test
imports. Typecheck and focused Biome checks pass after those changes. Browser
checks were not repeated for the label/import-only follow-up. The user authorized
committing and pushing this cleanup together with the two preceding local commits.


## Lighthouse startup follow-up (2026-11-20)

CI on `727fe0d0` failed the unchanged 2,000 ms FCP budget twice: the best
samples were 2,244 and 2,246 ms. The preceding passing report measured 1,873 ms.
Runner CPU benchmarks differed, but the repeat failure ruled out treating this
as a single noisy run. Total bundle transfer was similar; entry dependencies
and preload fragmentation changed during cleanup. This investigation does not
attribute the entire timing difference to one removed module.

Measured a targeted improvement: secondary history, tune-editor/detail, group
and debug route imports now use the existing Solid lazy-route pattern. Providers,
guards, route paths and page implementations remain unchanged. On an isolated
preview server at port 4187, with the same placeholder build environment, bundled
Playwright Chromium and LHCI 0.13.0 desktop configuration, three baseline runs
measured FCP 2,157 / 2,138 / 2,141 ms; three candidate runs measured
1,927 / 1,911 / 1,887 ms. All candidate Lighthouse assertions pass. Entry gzip
size decreased from 630,188 to 541,149 bytes and module preloads from 45 to 36.
These are local measurements, not a guarantee of the next hosted-runner result.

The workflow also stops supplying the normal GitHub token as an LHCI App token
(the unrelated 422 occurred in both passing and failing runs), uploads the hidden
`.lighthouseci` reports directory, and prints the actual configured targets in
PR comments. The Actions job remains the pass/fail check. Performance budgets
and number of runs are unchanged.

Validation: 1,435 unit tests, typecheck, production build, focused Biome and YAML
parsing pass. Generated Workbox precache includes application JavaScript chunks;
only the two already-excluded unused SQLite worker/OPFS helper assets are omitted.
Authenticated route navigation and offline E2E have not been rerun for this change.
The existing dev/preview servers were left untouched. No commit/push yet.

CodeRabbit reviewed all four Lighthouse follow-up files and reported zero
findings. No post-review code changes were needed. The local performance and
static/unit results above still apply; authenticated/offline E2E and remote CI
remain pending.
