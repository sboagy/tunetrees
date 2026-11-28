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
      goal: entry.goalKey,
      row: {
        ...entry.expected.row,
        goal_id: entry.goalId,
        goal: entry.goalKey,
      },
    };
    if (same(current, applied)) continue;
    requireValue(
      same(current, entry.expected),
      "Goal-reference source changed; prepare a new plan"
    );
    const derived = prepareGoalReferenceBackfill(goals, [current]);
    requireValue(
      derived.updates.length === 1 &&
        derived.updates[0].goalId === entry.goalId &&
        derived.updates[0].goalKey === entry.goalKey,
      "Goal-reference attribution changed or is not allowed"
    );
    writes.push(entry);
  }
  return writes;
}

/** A rename must include all resolvable references and the corresponding goal write. */
export function validateRenameCoverage(
  goals,
  sources,
  goalWrites,
  referenceWrites
) {
  const projected = new Map(goals.map((goal) => [goal.id, goal]));
  const renamed = new Set();
  for (const entry of goalWrites) {
    projected.set(entry.id, { ...entry.expected, ...entry.values });
    if (entry.expected.name !== entry.values.name) renamed.add(entry.id);
  }
  for (const entry of referenceWrites) {
    if (entry.expected.kind !== "assignment") continue;
    const goal = projected.get(entry.goalId);
    requireValue(
      goal && (goal.privateFor === null || goal.name === entry.goalKey),
      "Assignment key requires its matching custom goal conversion"
    );
  }
  const required = prepareGoalReferenceBackfill(goals, sources).updates;
  const planned = new Map(
    referenceWrites.map((entry) => [identity(entry.expected), entry])
  );
  for (const entry of required) {
    if (!renamed.has(entry.goalId)) continue;
    requireValue(
      same(planned.get(identity(entry.expected)) ?? null, entry),
      "Custom goal rename is missing an affected reference; prepare a new plan"
    );
  }
}

/** History changes only goal_id; active assignments also receive the stable key. */
export async function writeReferenceUpdates(tx, entries) {
  for (const { expected, goalId, goalKey } of entries) {
    let rows;
    if (expected.kind === "assignment") {
      rows = await tx`
        UPDATE public.repertoire_tune AS rt SET goal_id = ${goalId}, goal = ${goalKey}
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
        same(rows[0].row, { ...expected.row, goal_id: goalId, goal: goalKey }),
      "Goal-reference write changed other content; transaction must roll back"
    );
  }
}
