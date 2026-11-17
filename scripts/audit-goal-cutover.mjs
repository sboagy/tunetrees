/** Local, read-only preflight. Run with: npx tsx scripts/audit-goal-cutover.mjs
 * This is not a migration or proof that devices have synchronized their work.
 */
import { camelizeKeys } from "oosync/sync/casing";
import postgres from "postgres";
import { getBuiltInGoals } from "../src/lib/goals/builtins.ts";
import { parseGoalConfig } from "../src/lib/goals/config.ts";
import { prepareLegacyRecallSettings } from "../src/lib/goals/legacy-preferences.ts";

function auditRecallPreferences(users, result) {
  for (const user of users) {
    try {
      const prepared = prepareLegacyRecallSettings({
        hasExistingOverride: user.existing,
        scheduling: user.scheduling ? camelizeKeys(user.scheduling) : null,
        spacedRepetition: user.fsrs ? camelizeKeys(user.fsrs) : null,
      });
      if (prepared === null) result.existingRecallSettingsPreserved++;
      else result.recallSettingsReady++;
    } catch {
      // Report identifiers only; do not dump saved preferences or payloads.
      result.invalidRecallPreferenceUserIds.push(user.id);
    }
  }
}

function auditGoalDefinitions(goals, builtins, result) {
  for (const goal of goals) {
    if (
      goal.private_for !== null &&
      builtins.some((builtin) => builtin.name === goal.name)
    ) {
      result.collidingCustomGoalIds.push(goal.id);
    }
    if (goal.default_config === null) {
      if (
        !builtins.some(
          (builtin) => builtin.id === goal.id && goal.private_for === null
        )
      ) {
        result.legacyCustomGoalIds.push(goal.id);
      }
    } else {
      try {
        parseGoalConfig(JSON.parse(goal.default_config));
      } catch {
        result.invalidConfiguredGoalIds.push(goal.id);
      }
    }
  }
}

const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  {
    max: 1,
  }
);
try {
  const report = await sql.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      const builtins = getBuiltInGoals();
      const recall = builtins.find((goal) => goal.name === "recall");
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
      SELECT id, name, private_for, default_config, deleted FROM public.goal
    `;
      const result = {
        users: users.length,
        recallSettingsReady: 0,
        existingRecallSettingsPreserved: 0,
        invalidRecallPreferenceUserIds: [],
        legacyCustomGoalIds: [],
        collidingCustomGoalIds: [],
        invalidConfiguredGoalIds: [],
        missingBuiltInGoalIds: builtins
          .filter(
            (builtin) =>
              !goals.some(
                (goal) =>
                  goal.id === builtin.id &&
                  goal.private_for === null &&
                  !goal.deleted
              )
          )
          .map((goal) => goal.id),
      };
      auditRecallPreferences(users, result);
      auditGoalDefinitions(goals, builtins, result);
      return result;
    }
  );
  console.log(JSON.stringify(report, null, 2));
  if (
    report.invalidRecallPreferenceUserIds.length ||
    report.legacyCustomGoalIds.length ||
    report.collidingCustomGoalIds.length ||
    report.invalidConfiguredGoalIds.length ||
    report.missingBuiltInGoalIds.length
  )
    process.exitCode = 1;
} finally {
  await sql.end();
}
