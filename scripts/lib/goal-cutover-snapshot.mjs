/** Shared server snapshot for local cutover preparation and rehearsal. */
import { camelizeKeys } from "oosync/sync/casing";
import { getBuiltInGoals } from "../../src/lib/goals/builtins.ts";

export function legacyPreferences(user) {
  return {
    hasExistingOverride: user.existing,
    scheduling: user.scheduling ? camelizeKeys(user.scheduling) : null,
    spacedRepetition: user.fsrs ? camelizeKeys(user.fsrs) : null,
  };
}

export async function readGoalCutoverSnapshot(tx) {
  const recall = getBuiltInGoals().find((goal) => goal.name === "recall");
  if (!recall) throw new Error("Recall defaults are unavailable");
  const users = await tx`
      SELECT u.id, to_jsonb(s) AS scheduling, to_jsonb(f) AS fsrs,
        EXISTS (SELECT 1 FROM public.goal_user_settings g
          WHERE g.user_id = u.id AND g.goal_id = ${recall.id}) AS existing
      FROM public.user_profile u
      LEFT JOIN public.prefs_scheduling_options s ON s.user_id = u.id
      LEFT JOIN public.prefs_spaced_repetition f
        ON f.user_id = u.id AND f.alg_type = 'fsrs'
    `;
  const goals = await tx`
      SELECT id, name, private_for, default_config, deleted, default_technique,
        base_intervals, display_name, description, last_modified_at::text FROM public.goal
    `;

  const assignments = await tx`
    SELECT r.user_ref AS owner, to_jsonb(rt) AS row
    FROM public.repertoire_tune rt JOIN public.repertoire r ON r.repertoire_id = rt.repertoire_ref
    WHERE NOT rt.deleted AND NOT r.deleted
  `;
  const history = await tx`
    SELECT r.user_ref AS owner, to_jsonb(pr) AS row
    FROM public.practice_record pr JOIN public.repertoire r ON r.repertoire_id = pr.repertoire_ref
  `;
  const references = [
    ...assignments.map(({ owner, row }) => ({
      kind: "assignment",
      key: JSON.stringify([row.repertoire_ref, row.tune_ref]),
      ownerId: owner,
      goal: row.goal,
      goalId: row.goal_id,
      schedulerId: null,
      row,
    })),
    ...history.map(({ owner, row }) => ({
      kind: "history",
      key: row.id,
      ownerId: owner,
      goal: row.goal,
      goalId: row.goal_id,
      schedulerId: row.scheduler_id,
      row,
    })),
  ];
  // Even note-only or sparse rows can represent unsubmitted work. Do not infer
  // safety from evaluation fields, age, repertoire deletion, or sync status.
  // Read identities only: the preflight must not expose private draft content.
  const stagedWork = await tx`
    SELECT user_id, repertoire_id, tune_id FROM public.table_transient_data
    ORDER BY user_id, repertoire_id, tune_id
  `;
  return { users, goals, references, stagedWork };
}
