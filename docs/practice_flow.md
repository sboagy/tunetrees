# Practice Flow: Code Map

Current SolidJS, local-first practice flow for #426. Product behavior is described
in [Goals and Scheduling](reference/scheduling.md); storage/sync responsibilities
are in [ARCHITECTURE.md](../ARCHITECTURE.md). This map replaces the pre-goals
FSRS-only staging/recording flow; those services are removed.

## Runtime Boundaries

| Boundary | Source | Responsibility |
| --- | --- | --- |
| Practice UI | `src/routes/practice.tsx`, `usePracticeEvaluations.ts`, `usePracticeQueueDate.ts` | Own selection, staging/submission interaction, queue date and recovery |
| Effective goal | `src/lib/goals/resolve.ts`, `config.ts` | Resolve owner-visible goal/settings, selected plugin and canonical predecessor |
| Calculation | `src/lib/goals/calculate.ts`, `fsrs.ts`, `ladder.ts`, `src/lib/plugins/goal-scheduler.ts` | Calculate the selected scheduler's result; no database writes |
| Preview | `src/lib/goals/preview.ts` | Bind result to predecessor/config/plugin fingerprints; menu estimates do not stage |
| Draft storage | `src/lib/goals/staging.ts` | Recheck caller/context ownership and persist the selected complete preview |
| Submit | `src/lib/goals/commit.ts` | Validate draft, perform atomic event/queue/assignment writes, enforce exact retry identity |
| Queue | `src/lib/goals/queue-commands.ts`, `queue.ts`, `queue-allocation.ts` | Shared load/refresh/add-more/manual allocation and save-only retry |
| Queue navigation | `src/lib/services/practice-queue.ts` | Read available windows; not a second allocator |
| History | `src/lib/goals/history.ts`, `practice-history.ts`, `practice-state.ts`, `src/lib/db/practice-history-sql.ts` | Canonical ordering, mixed-goal presentation and state decoding |
| Sync | generated runtime configuration plus oosync | Outbox push/pull, not an alternate UI database |

## Queue → Preview → Submit

1. Resolve the repertoire's effective goal settings and candidate due dates.
   Allocate per goal, combine in deterministic order, and persist queue metadata.
   Loading an existing queue preserves it; Refresh retains completed/staged work.
2. On evaluation selection, read the owner-scoped practice context and calculate
   a preview using the selected scheduler. Record practice time at staging; delayed
   Submit does not change it to the later submission time.
3. Recheck the request and context before writing `table_transient_data`. A stale
   asynchronous calculation must not overwrite a newer selection. Local persistence
   and background synchronization are separate completion states.
4. Submit checks predecessor/configuration identity, complete event content and
   queue ownership. Built-in results are recalculated for comparison; plugin results
   are checked against their captured calculation receipt without reexecuting a
   potentially nondeterministic script.
5. In the commit transaction, insert the practice event, update the repertoire's
   current due date (preserving an independent scheduled override when required),
   complete/update the queue row and its displayed-event link, and clear the draft.
   Exact retries reuse event identity; conflicting IDs or practice timestamps are
   reported, never resolved by silently incrementing seconds.
6. Persist SQLite, then refresh the UI through the existing reactive state. Sync
   triggers/outbox carry writes to the Worker/Supabase in the background. Failed
   local persistence retries save the existing mutation rather than repeating it.

## Display and Re-practice

`daily_practice_queue.displayed_practice_record_id` identifies the displayed
submitted result. It is distinct from the latest event used for future scheduling.
The UI must not borrow a newer unrelated result to fill an unlinked historical
completion. Queue allocation identity/reason are snapshots, not retrospective
reconstructions of the tune's current goal.

Practice Again preserves completed history and starts a new draft. Its successful
Submit appends a distinct event and updates the displayed link. Cancellation leaves
the original completion intact. This is not history correction or deletion repair
(#958), nor the full future #931 feature.

## Data and Recovery Invariants

- New-format scheduler JSON is authoritative. Malformed new-format state cannot
  fall back to historical FSRS columns. Only unambiguous legacy Recall uses the
  centralized legacy decoder.
- The predecessor is the canonical latest submitted event within the repertoire,
  including deterministic timestamp/tie handling. Returning to an old goal does not
  revive an older event behind the latest one.
- Plugin errors leave the evaluation unsubmitted; there is no FSRS/ladder fallback.
- Conflicts retain drafts and direct the user to History. Legacy draft notes require
  explicit review/preservation before clearing; no silent draft deletion.
- Manual History Add uses the goal-aware calculation/storage path. History deletion
  controls exist, so describing the whole table as never deleted is inaccurate;
  general edit/delete scheduling and sync repair remains #958.
- Browser UI reads local SQLite. The synchronization implementation and generated
  metadata belong to the oosync integration documented in ARCHITECTURE.md.

## Verification and Release

Focused coverage lives in `src/lib/goals/*.test.ts`, the plugin tests, and the
Practice/Goals/History Playwright suites. The [UI review report](development/goals-ui-review.md)
records tested layouts/interactions and explicit accessibility gaps. Unit tests do
not substitute for staged deployment or device-upgrade verification.

Old-data conversion is an operator step, outside browser runtime. Follow the
[cutover runbook](development/goals-cutover.md) and its linked script contract;
ordinary schema promotion alone does not perform semantic data conversion.
