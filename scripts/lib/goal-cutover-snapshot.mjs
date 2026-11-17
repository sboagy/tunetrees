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

  return { users, goals };
}
