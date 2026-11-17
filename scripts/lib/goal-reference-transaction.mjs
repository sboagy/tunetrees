import { requireValue, same, uniqueEntries } from "./cutover-checks.mjs";
import { prepareGoalReferenceBackfill } from "./goal-cutover/reference-backfill.ts";

const identity = (source) => JSON.stringify([source.kind, source.key]);

/** Recheck row content, ownership and the current goal namespace before any write. */
export function validateReferenceUpdates(goals, sources, entries) {
  requireValue(
    Array.isArray(entries),
    "Missing goal-reference plan; prepare a new plan"
  );
  uniqueEntries(
    entries.map((entry) => ({ key: identity(entry.expected) })),
    "key"
  );
  const byKey = new Map(sources.map((source) => [identity(source), source]));
  const writes = [];
  for (const entry of entries) {
    const current = byKey.get(identity(entry.expected));
    requireValue(current, "Goal-reference source is unavailable");
    const applied = {
      ...entry.expected,
      goalId: entry.goalId,
      row: { ...entry.expected.row, goal_id: entry.goalId },
    };
    if (same(current, applied)) continue;
    requireValue(
      same(current, entry.expected),
      "Goal-reference source changed; prepare a new plan"
    );
    const derived = prepareGoalReferenceBackfill(goals, [current]);
    requireValue(
      derived.updates.length === 1 &&
        derived.updates[0].goalId === entry.goalId,
      "Goal-reference attribution changed or is not allowed"
    );
    writes.push(entry);
  }
  return writes;
}

/** Only goal_id changes; compare the full returned row to detect trigger side effects. */
export async function writeReferenceUpdates(tx, entries) {
  for (const { expected, goalId } of entries) {
    let rows;
    if (expected.kind === "assignment") {
      rows = await tx`
        UPDATE public.repertoire_tune AS rt SET goal_id = ${goalId}
        WHERE repertoire_ref = ${expected.row.repertoire_ref} AND tune_ref = ${expected.row.tune_ref}
        RETURNING to_jsonb(rt) AS row
      `;
    } else {
      rows = await tx`
        UPDATE public.practice_record AS pr SET goal_id = ${goalId}
        WHERE id = ${expected.row.id} AND scheduler_id IS NULL AND goal_id IS NULL
          AND evaluation_id IS NULL AND evaluation_snapshot IS NULL
          AND scheduler_version IS NULL AND scheduler_state IS NULL AND interval_days IS NULL
        RETURNING to_jsonb(pr) AS row
      `;
    }
    requireValue(
      rows.length === 1 &&
        same(rows[0].row, { ...expected.row, goal_id: goalId }),
      "Goal-reference write changed other content; transaction must roll back"
    );
  }
}
