# Preserving local work during database upgrades

A database-version change rebuilds the per-user SQLite mirror. A schema-version
change can clear tables. Both paths use the oosync guard before destructive work.

| Persisted data | Upgrade policy |
| --- | --- |
| Existing audited synced application tables | Approve only during authenticated initialization, with a prior successful sync and all three old tracking triggers. The runtime separately requires an empty outbox and no unreplayed backup. |
| `view_column_meta` | Regenerated from app view descriptions. |
| `sync_change_log` | Derived local change notification metadata; full pull rebuilds data. |
| `media_draft_outbox` | Block while populated. These upload tasks are not synchronized; their SQLite records are required even though the blobs live elsewhere. |
| Unknown, renamed or removed tables | Block until a reviewed preservation path is supplied. |
| Anonymous application data | Block; anonymous sync is pull-only. A download timestamp does not demonstrate preservation of local practice. |
| Runtime outbox and backup | oosync blocks outstanding rows regardless of status, and nonempty/unsupported/unreadable backups. Consumer approval cannot waive this. |
| SQLite internal tables and trigger-control metadata | Managed by the runtime. |
| Media vault, BYOS drafts, OAuth secrets, localStorage preferences | Separate stores; this operation does not delete them. |

The exact reviewed application-table list lives in `upgrade-policy.ts`. It includes
practice staging (`table_transient_data`), the daily queue, preferences, goals,
plugins, catalog and repertoire/history data, as well as groups, sets and media
metadata, under their existing synchronization contract. New sync metadata alone
never extends the list. Existing triggers are additional historical evidence, not
proof of remote preservation: direct writes made with tracking suppressed must
be separately audited before a cutover. Do not approve arbitrary plugin-created
tables or local-only data merely because their names appear in generated metadata.

Before cutover, synchronize each device using a compatible app, finish pending
uploads, and close old tabs. If blocked, retain site storage. Use the previous
compatible version on the same browser origin/profile to finish synchronization,
or arrange a verified export/recovery with the developer. Another device's sync
cannot preserve this device's local writes. There is no automatic export/restore
or bypass button in this change.

Rebuilds retain a per-user full-download marker until downloaded SQLite data is
persisted successfully. On restart with the marker, the old sync cursor is cleared
before constructing the sync engine, so interrupted downloads repeat safely.
No database/schema version is bumped by the guard integration itself.
