# Goals and Scheduling Reference

Current #426 behavior. For the implementation flow, see [Practice Flow](../practice_flow.md).
For deployment and existing-data conversion, see the [cutover runbook](../development/goals-cutover.md).

## Goals and Evaluation Choices

Each tune has one goal within its repertoire. Built-in display defaults are
**Learn, Session, Polish, Recall, and Fluency**. Labels, descriptions, evaluation
choices and scheduling options can be overridden by the user. Defaults live in
[`builtins.ts`](../../src/lib/goals/builtins.ts); historical events retain the
labels recorded when they were submitted.

Open **Settings → Goals** to edit a goal. Each goal dialog has its own Save Changes
and guarded Cancel/Close. Reset to Defaults changes that dialog's draft until saved.
Evaluation choices have their own immediate Save Changes boundary: canceling the
parent goal does not undo a saved choice. Saving a choice for a new goal also creates
that goal; missing required goal details must be completed first.

Shared calendar preferences are editable and saved, but do not yet control queue
scheduling. That integration is tracked in [#959](https://github.com/sboagy/tunetrees/issues/959).

## Schedulers

| Scheduler | Evaluation effect | State |
| --- | --- | --- |
| Recall / FSRS-6 | Choices map to Again, Hard, Good or Easy; FSRS computes the next state and due time | Versioned FSRS JSON |
| Interval ladder | Restart, step back, repeat, or advance through configured durations | Ladder index and interval-list hash in JSON |
| Explicit custom plugin | Choices map to named actions declared by the selected plugin | Validated, versioned plugin JSON envelope |

There is no SM2 fallback or implicit selection of a plugin by goal name. A plugin
failure keeps the evaluation unsubmitted and offers recovery; it does not silently
substitute FSRS or a ladder. See the [plugin contract](../development/extensibility.md).

FSRS uses the supported `DefaultScheduler` API with the FSRS-6 model. Per-goal
**Allow Reviews Later the Same Day** defaults off, preserving the next-day minimum;
turning it on retains short learning intervals. Ladder/plugin fractional intervals
remain supported independently. Same-day repeats use **Practice Again**, not
automatic re-entry into the queue. FSRS-7 is separate work in #924.

FSRS's effective maximum interval is the configured maximum, additionally capped
when a finite daily maximum is set: `round(3 * clamp(goalTuneCount, 50, 400) /
dailyMaximum)`, at least one day. Unlimited daily maximum removes this additional
population cap. The implementation is [`fsrs.ts`](../../src/lib/goals/fsrs.ts).

A fresh ladder starts at index zero. Restart, back and repeat therefore select the
first duration; advance selects the second duration if present. Advancing at the
last step repeats it. Changing the interval list starts fresh. A label edit does
not reset state. See [`ladder.ts`](../../src/lib/goals/ladder.ts).

Continuation considers only the latest submitted event for the tune/repertoire.
It continues only when the goal and scheduler state are compatible; it does not
search backward for an older matching goal. Switching goals and switching back
without an intervening submitted practice can therefore retain the original state.
Plugins may declare which earlier state versions they can read.

## Daily Queue Allocation

Settings belong to the user and apply separately in each repertoire. Each goal
has its own minimum, maximum, automatic-new-tune option and delinquency window.
There is one combined queue per repertoire and no configurable combined minimum
or maximum. Sub-queues are intermediate selections, not additional persisted entities.

Automatic allocation considers due-today, recently overdue, then older-overdue
tunes up to that goal's maximum. If the selection is below its minimum, it can
introduce unscheduled tunes when enabled, then the nearest future-due tunes.
Minimum zero means no automatic top-up; maximum zero means Unlimited. Old overdue
tunes precede new tunes even though their historical bucket number is larger.

An explicit scheduled date takes precedence over the latest event's due date.
Retained completed, staged and manual allocations count against the goal's budget.
Refresh preserves completed/staged work. Add More and manual additions are explicit
user requests handled by the same queue service, rather than silently increasing
automatic minima. Changing a goal preserves history and due dates and does not
add an absent tune to the queue; incompatible drafts are cleared.

Sources: [`queue-allocation.ts`](../../src/lib/goals/queue-allocation.ts),
[`queue.ts`](../../src/lib/goals/queue.ts), and
[`assignment.ts`](../../src/lib/goals/assignment.ts).

## Selecting, Submitting, and Practicing Again

Selecting an evaluation stages a preview; it does not submit practice. The closed
chooser displays the short label. Its menu shows scheduling effects/estimates,
with Explain Choices for more detail and Clear Evaluation as a separate action.
Submit validates that the predecessor and scheduling inputs still match the
reviewed preview. Stale input requires review again; genuine conflicts preserve
the draft rather than inventing a new practice timestamp.

Submitted controls show a checkmark. Practice Again opens a new evaluation while
preserving the previous event; submission appends a new event and updates the
queue's displayed-event link. Canceling the repeat retains the earlier completion.
The broader #931 interaction scope is not included.

## History and Storage

Practice History has an All Goals view and a goal filter. Goal-specific metrics
and charts are scoped to compatible events. Add records a manual entry for the
selected goal (or the tune's current goal from All Goals); adding older practice
must not replace a newer schedule. General history editing and deletion-related
schedule/sync repair are tracked in [#958](https://github.com/sboagy/tunetrees/issues/958).

New events store goal/evaluation identity and snapshots, scheduler identity/version,
and authoritative `scheduler_state` JSON. Common `practiced`, `due`, and fractional
`interval_days` remain typed fields. Old FSRS columns are historical decoder inputs
or compatibility projections, never an alternative authority for malformed new JSON.
The shared reader is [`practice-state.ts`](../../src/lib/goals/practice-state.ts).

Completed queue rows display their `displayed_practice_record_id`, not whichever
practice event happens to be latest today. Historical conversions preserve existing
links and use only the documented evidence rules; ambiguous old completions show
Not Available. New Submit writes the event and queue link atomically.
