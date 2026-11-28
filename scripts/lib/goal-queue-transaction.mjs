import { requireValue, same, uniqueEntries } from "./cutover-checks.mjs";
import { prepareQueueCompletions } from "./goal-cutover/queue-completions.ts";

export function validateQueueCompletions(queues, history, entries) {
  requireValue(Array.isArray(entries), "Missing queue-completion plan");
  uniqueEntries(
    entries.map((entry) => ({ id: entry.expected.row.id })),
    "id"
  );
  const currentById = new Map(queues.map((queue) => [queue.row.id, queue]));
  const writes = [];
  for (const entry of entries) {
    const current = currentById.get(entry.expected.row.id);
    requireValue(current, "Queue completion source is unavailable");
    const applied = {
      ...entry.expected,
      row: {
        ...entry.expected.row,
        displayed_practice_record_id: entry.event.key,
      },
    };
    const alreadyApplied = same(current, applied);
    requireValue(
      alreadyApplied || same(current, entry.expected),
      "Queue completion changed; prepare a new plan"
    );
    // Recheck event evidence even on retry; a deleted/edited event must not be
    // silently replaced by a different latest event. Existing links stay intact.
    const unlinked = {
      ...current,
      row: { ...current.row, displayed_practice_record_id: null },
    };
    const derived = prepareQueueCompletions([unlinked], history).updates;
    requireValue(
      derived.length === 1 && same(derived[0], entry),
      "Queue completion evidence changed or is ambiguous"
    );
    if (!alreadyApplied) writes.push(entry);
  }
  return writes;
}

export async function writeQueueCompletions(tx, entries) {
  for (const entry of entries) {
    const [updated] = await tx`
      UPDATE public.daily_practice_queue AS q
      SET displayed_practice_record_id = ${entry.event.key}
      WHERE id = ${entry.expected.row.id} AND displayed_practice_record_id IS NULL
      RETURNING to_jsonb(q) AS row
    `;
    requireValue(
      updated &&
        same(updated.row, {
          ...entry.expected.row,
          displayed_practice_record_id: entry.event.key,
        }),
      "Queue completion write changed other content; transaction must roll back"
    );
  }
}
