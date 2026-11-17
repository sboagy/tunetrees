/** Local, read-only preflight. Run with: npx tsx scripts/audit-goal-cutover.mjs
 * This is not a migration or proof that devices have synchronized their work.
 */
import { writeFileSync } from "node:fs";
import { camelizeKeys } from "oosync/sync/casing";
import postgres from "postgres";
import { getBuiltInGoals } from "../src/lib/goals/builtins.ts";
import { prepareGoalCutoverPlan } from "../src/lib/goals/cutover-plan.ts";
import { prepareLegacyGoalDefinition } from "../src/lib/goals/legacy-goals.ts";
import { prepareLegacyRecallSettings } from "../src/lib/goals/legacy-preferences.ts";
import {
  legacyPreferences,
  readGoalCutoverSnapshot,
} from "./lib/goal-cutover-snapshot.mjs";

function auditRecallPreferences(users, result) {
  for (const user of users) {
    try {
      const prepared = prepareLegacyRecallSettings(legacyPreferences(user));
      if (prepared === null) result.existingRecallSettingsPreserved++;
      else result.recallSettingsReady++;
    } catch {
      // Report identifiers only; do not dump saved preferences or payloads.
      result.invalidRecallPreferenceUserIds.push(user.id);
    }
  }
}

function auditGoalDefinition(goal, builtins, result) {
  if (
    goal.private_for !== null &&
    builtins.some((builtin) => builtin.name === goal.name)
  ) {
    result.collidingCustomGoalIds.push(goal.id);
  }
  const legacy =
    goal.default_config === null &&
    !builtins.some(
      (builtin) => builtin.id === goal.id && goal.private_for === null
    );
  if (legacy) result.legacyCustomGoalIds.push(goal.id);
  try {
    prepareLegacyGoalDefinition(camelizeKeys(goal));
    if (legacy) result.convertibleCustomGoalIds.push(goal.id);
  } catch {
    if (legacy) result.blockedLegacyGoalIds.push(goal.id);
    else result.invalidConfiguredGoalIds.push(goal.id);
  }
}

function hasBlockers(report) {
  return (
    report.invalidRecallPreferenceUserIds.length ||
    report.blockedLegacyGoalIds.length ||
    report.collidingCustomGoalIds.length ||
    report.invalidConfiguredGoalIds.length ||
    report.missingBuiltInGoalIds.length
  );
}

const [mode, destination, ...extra] = process.argv.slice(2);
if (
  mode !== undefined &&
  (mode !== "--prepare" || !destination || extra.length)
) {
  throw new Error(
    "Usage: tsx scripts/audit-goal-cutover.mjs [--prepare <new-plan.json>]"
  );
}

const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  {
    max: 1,
  }
);
try {
  const { report, plan } = await sql.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      const builtins = getBuiltInGoals();
      const { users, goals } = await readGoalCutoverSnapshot(tx);
      const result = {
        users: users.length,
        recallSettingsReady: 0,
        existingRecallSettingsPreserved: 0,
        invalidRecallPreferenceUserIds: [],
        legacyCustomGoalIds: [],
        convertibleCustomGoalIds: [],
        blockedLegacyGoalIds: [],
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
      for (const goal of goals) auditGoalDefinition(goal, builtins, result);
      const plan =
        destination && !hasBlockers(result)
          ? prepareGoalCutoverPlan(
              goals.map(camelizeKeys),
              users.map((user) => ({
                id: user.id,
                preferences: legacyPreferences(user),
              }))
            )
          : null;
      return { report: result, plan };
    }
  );
  console.log(JSON.stringify(report, null, 2));
  if (hasBlockers(report)) process.exitCode = 1;
  if (plan) {
    // A review artifact only. Refuse overwrite and keep local preference data private.
    writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Prepared definition/settings plan; no database writes performed."
    );
  }
} finally {
  await sql.end();
}
