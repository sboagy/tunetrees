# One-time goals cutover

This is the #426 procedure for the one real user's devices and existing test users.
Local imported-completion rehearsal is complete; staging and production acceptance
remain pending. **Run production cutover only after staging rehearsal and approval
of the complete #426 runtime/UI release.** Development of the tooling does not
require migrating production now.

Implementation details and script contracts are in the
[goals migration README](../../scripts/lib/goal-cutover/README.md).

## Run the cutover

1. Stop practice/settings edits on all your devices. Synchronize pending changes
   and resolve failed writes/conflicts. Submit or explicitly discard staged practice;
   preserve local-only work/media drafts. Confirm server receipt and close old tabs.
   An empty server staging table alone cannot prove every device is synchronized.
2. Back up the synchronized production database with `npm run db:remote:backup`
   (public and auth), and retain the resulting backup before proceeding.
3. From the intended release checkout, apply its additive schema with
   `npm run db:production:schema:push`. Follow the existing
   [schema promotion workflow](schema-promotion.md); this command does not deploy
   the app or Worker. Keep devices closed throughout conversion and deployment.
4. Run the dry run, check the printed target and counts, then apply:

   ```sh
   npm run goals:migrate:production
   npm run goals:migrate:production -- --apply
   ```

   The environment wrapper supplies credentials. No exported plan is required.
   Put host/port/database in the URL authority/path, not query overrides; an
   omitted port is fixed to 5432. The printed target matches these values.
   The default command performs real writes inside a transaction and rolls them
   back. `--apply` commits only after preflight and post-write verification pass.
   Staging uses `goals:migrate:staging`; local testing uses
   `npm run goals:migrate -- --local` (also a rollback by default).
5. Deploy the matching ready Worker and Pages release through the existing workflow.
   Update each device to that release, keeping other tabs closed and making no
   practice/settings edits yet. After verifying step 1 was completed for that
   device, open the database/sync menu and run **Force Clean Local Reset** while
   online and signed in. This explicitly deletes that user's SQLite mirror and
   sync cursor, reinitializes it, and downloads the converted server data. Do this
   on every device, including devices already on database version 29: reopening
   alone does not trigger a rebuild when the version is unchanged.

   This manual reset is destructive and does **not** run the automatic upgrade's
   preservation guard. Use it only after verifying all local work was synchronized
   or separately preserved. If automatic initialization is blocked, follow
   [database upgrade guidance](database-upgrades.md) to recover the work first;
   do not bypass the block by deleting storage.

   Wait for the full download to complete with no sync errors. Reload and verify
   goals, repertoire, history and queue before resuming practice. Fresh database
   creation sets the existing full-download recovery marker; an interrupted
   download repeats on restart until it has been persisted successfully.

## What the command does

In one locked transaction it converts supported custom definitions/stable keys,
seeds missing personal Recall settings, attributes unambiguous legacy history and
assignments, and links completed queue rows when exact submission evidence identifies one
event, or an imported queue window has exactly one eligible in-window event.
The latter is an explicitly accepted best-effort historical display recovery;
uncertain completions remain unlinked and display “Not available”. Existing overrides, history timestamps and raw historical
goal names are preserved. A repeat application makes no additional writes.

Incomplete new-format events without a goal identity, pending server drafts,
missing built-in seeds, invalid settings and unsupported or
colliding custom goals block the operation. Resolve reported IDs before retrying.
Unknown historical goal references and queue rows without unique evidence are
reported and left unattributed; they are not guessed. Allocation snapshots and
selection reasons are handled by the new runtime queue integration, not this script.

## Failure and recovery

A failure before commit rolls back the batch. A lost connection during commit can
leave its outcome unknown: keep devices closed and rerun the dry run to inspect
remaining work before retrying `--apply`. Do not revert to an old scheduler bundle
after recording new-format practice. Restoring a backup is a deliberate recovery
operation with writes stopped, not an automatic response to a command error.

The older audit/export and local rollback rehearsal tools remain available for
investigation; they are not extra required rollout steps. Ordinary schema promotion
never invokes this semantic data conversion automatically.

## Local validation

`npm run test:db:goal-cutover` requires the local migrations/seeds and a
cutover-ready database with no pending drafts (the CI setup supplies this before
E2E). It validates that prerequisite before creating fixtures, accepts additional
convertible custom goals, and rolls back all fixture and conversion writes.
