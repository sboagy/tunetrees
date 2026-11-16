# Preserving local work during database upgrades

A database-version change rebuilds the per-user SQLite mirror. A schema-version
change can clear tables. Both paths use the oosync guard before destructive work.

| Persisted data | Upgrade policy |
| --- | --- |
| Existing audited synced application tables | Approve only during authenticated initialization, with a prior successful sync and all three old tracking triggers. The runtime separately requires an empty outbox and no unreplayed backup. |
| `view_column_meta` | Regenerated from app view descriptions. |
| `sync_change_log` | Derived local change notification metadata; full pull rebuilds data. |
| `table_transient_data` | Block while populated. Staged practice can be written while tracking is suppressed and is not proven remotely preserved. |
| `media_draft_outbox` | Block while populated. These upload tasks are not synchronized; their SQLite records are required even though the blobs live elsewhere. |
| Unknown, renamed or removed tables | Block until a reviewed preservation path is supplied. |
| Anonymous application data | Block; anonymous sync is pull-only. A download timestamp does not demonstrate preservation of local practice. |
| Runtime outbox and backup | oosync blocks outstanding rows regardless of status, and nonempty/unsupported/unreadable backups. Consumer approval cannot waive this. |
| SQLite internal tables and trigger-control metadata | Managed by the runtime. |
| Media vault, BYOS drafts, OAuth secrets, localStorage preferences | Separate stores; this operation does not delete them. |

The exact reviewed application-table list lives in `upgrade-policy.ts`. It includes
the daily queue, preferences, goals,
plugins, catalog and repertoire/history data, as well as groups, sets and media
metadata, under their existing synchronization contract. New sync metadata alone
never extends the list. Existing triggers are additional historical evidence, not
proof of remote preservation: direct writes made with tracking suppressed must
be separately audited before a cutover. Do not approve arbitrary plugin-created
tables or local-only data merely because their names appear in generated metadata.

The staging audit found that `stagePracticeEvaluation` writes without a device ID
and rounds `last_modified_at` to seconds. The oosync remote-apply path suppresses
tracking across awaited writes; its backfill filters by this device ID and the
suppression start timestamp. A concurrent staging write can therefore escape both
tracking and backfill. A full download cannot recover that local-only evaluation.
Genre-selection cleanup also deletes staging rows with tracking suppressed, but
those are intentional local cache removals for tunes outside the repertoire.
Populated staging tables are excluded from rebuild approval until a separate,
verified export/restore path exists; finish and synchronize staged practice using
a compatible app before upgrading. Triggers alone do not waive this block.

Trigger coverage was verified by reconstructing database version 27 from commit
`f980a876` and running the pinned oosync installer against its historical metadata.
All 30 currently approved tables have `trg_<table>_insert`, `trg_<table>_update`,
and `trg_<table>_delete` (90 matching triggers). The earlier count of 31 included
staging, which is now excluded. The guard therefore keeps its exact-name check.
The upgrade cursor helper derives its prefix from `oosync.codegen.config.json`,
the same source used to generate the SQLite storage configuration.

Before cutover, synchronize each device using a compatible app, finish pending
uploads, and close old tabs. If blocked, retain site storage. Use the previous
compatible version on the same browser origin/profile to finish synchronization,
or arrange a verified export/recovery with the developer. Another device's sync
cannot preserve this device's local writes. There is no automatic export/restore
or bypass button in this change.

Rebuilds retain a per-user full-download marker until downloaded SQLite data is
persisted successfully. On restart with the marker, the old sync cursor is cleared
before constructing the sync engine, so interrupted downloads repeat safely.
Ordering was checked against the pinned oosync browser runtime: creation clears
the cursor, runs `onDatabaseReady` (which writes the marker), then sets `dbReady`.
`persistDb` refuses to export before `dbReady`. Migration clearing writes the marker
synchronously before deleting any rows. A crash before creation writes the marker
leaves either the old snapshot or no snapshot; the latter repeats creation and
cursor clearing. There is no path that persists a rebuilt/cleared snapshot before
the marker. Both load hooks finish inside `initializeDb`, which TTAuthProvider
awaits before starting the sync service and its cursor-reading engine.

The completion callback records the pull mode when request overrides are prepared,
before the watermark advances, and only finishes recovery for a successful full
pull with no errors and completed catalog setup. The marker generation is captured at pull start: a stale callback cannot persist
or finish a newer recovery request, and a generation change during persistence
also prevents clearing the newer marker. Completion additionally requires the same
active user, database instance and service instance. Stop/reset invalidates ownership
before awaiting destruction, including pending startups; unmount permanently
invalidates the provider. Service creation and publication occur in one synchronous
turn. Callback continuations and deferred catalog reconciliation recheck ownership
after asynchronous work, and sync retries stay bound to their original service.
SQLite catalog mutation batches do not yield between their ownership check and
completion. Ownership is checked again after persistence. An export
already started is not cancelled, but a stale completion cannot clear recovery.
These guards cover TuneTrees callback work, not persistence that oosync performs
internally before invoking the callback.
No database/schema version is bumped by the guard integration itself.

The goals configuration expansion now advances SQLite to version 28 with migration
0028. It uses this guard and full-download marker; it does not weaken the approval
list. Populated `goal_user_settings` is currently blocked on a subsequent rebuild
until its new application write paths receive a preservation review. Finish and
synchronize pending practice before testing a version-27 database upgrade.
