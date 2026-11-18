import { camelizeKeys } from "oosync/sync/casing";
import { getBuiltInGoals } from "../../src/lib/goals/builtins.ts";
import { parseGoalConfig } from "../../src/lib/goals/config.ts";
import { requireValue, same, uniqueEntries } from "./cutover-checks.mjs";
import {
  prepareLegacyGoalDefinition,
  validateCustomGoalKeys,
} from "./goal-cutover/legacy-goals.ts";
import { prepareLegacyRecallSettings } from "./goal-cutover/legacy-preferences.ts";
import {
  legacyPreferences,
  readGoalCutoverSnapshot,
} from "./goal-cutover-snapshot.mjs";
import {
  validateReferenceUpdates,
  validateRenameCoverage,
  writeReferenceUpdates,
} from "./goal-reference-transaction.mjs";

function validateGoalUpdate(entry, current) {
  requireValue(
    current &&
      entry.expected?.id === entry.id &&
      entry.expected.privateFor !== null,
    "Goal conversion source is unavailable"
  );
  const config = parseGoalConfig(JSON.parse(entry.values.defaultConfig));
  const ids = config.evaluations.map((choice) => choice.id);
  requireValue(
    entry.expected.defaultConfig !== null ||
      ids.every((id) =>
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
          id
        )
      ),
    "Converted custom choices must have UUID identities"
  );
  let index = 0;
  const derived = prepareLegacyGoalDefinition(
    entry.expected,
    () => ids[index++]
  );
  requireValue(
    same(derived, entry.values),
    "Goal conversion differs from its source"
  );
  if (same(current, { ...entry.expected, ...entry.values })) return false;
  requireValue(
    same(current, entry.expected),
    "Goal source changed; prepare a new plan"
  );
  return true;
}

async function validateRecallInsert(tx, entry, user, recallId) {
  requireValue(
    user &&
      entry.goalId === recallId &&
      entry.expected?.hasExistingOverride === false,
    "Recall conversion source is unavailable"
  );
  const derived = prepareLegacyRecallSettings(entry.expected);
  requireValue(
    same(derived, JSON.parse(entry.overrides)),
    "Recall conversion differs from its source"
  );
  const current = legacyPreferences(user);
  requireValue(
    same({ ...current, hasExistingOverride: false }, entry.expected),
    "Recall preferences changed; prepare a new plan"
  );
  if (!current.hasExistingOverride) return true;
  const [existing] = await tx`
    SELECT overrides, deleted FROM public.goal_user_settings
    WHERE user_id = ${entry.userId} AND goal_id = ${recallId}
  `;
  requireValue(
    existing &&
      !existing.deleted &&
      same(JSON.parse(existing.overrides), derived),
    "Recall override changed; existing settings are preserved"
  );
  return false;
}

/**
 * Apply definition/settings and goal-reference entries inside a caller-owned transaction.
 * The only CLI caller always rolls back. Locks protect both existing and absent
 * rows, including preference inserts and override tombstones, until completion.
 * A savepoint also guarantees batch rollback if the caller catches a failure.
 */
export async function applyGoalCutoverPlan(tx, plan) {
  return tx.savepoint((sp) => applyLockedPlan(sp, plan));
}

async function applyLockedPlan(tx, plan) {
  requireValue(
    plan?.version === 3 && plan.scope === "definitions-settings-and-references",
    "Unsupported cutover plan; prepare a new version-3 plan"
  );
  uniqueEntries(plan.goalUpdates, "id");
  uniqueEntries(plan.recallSettingsInserts, "userId");
  await tx`SET LOCAL lock_timeout = '2s'`;
  await tx`SET LOCAL statement_timeout = '15s'`;
  await tx`LOCK TABLE public.goal, public.goal_user_settings,
    public.prefs_scheduling_options, public.prefs_spaced_repetition,
    public.user_profile, public.repertoire, public.repertoire_tune,
    public.practice_record, public.table_transient_data IN SHARE ROW EXCLUSIVE MODE`;
  const { users, goals, references, stagedWork } =
    await readGoalCutoverSnapshot(tx);
  requireValue(
    stagedWork.length === 0,
    "Pending staged work blocks cutover; submit or explicitly discard drafts and synchronize all devices"
  );
  validateCustomGoalKeys(goals.map(camelizeKeys));
  const recallId = getBuiltInGoals().find((goal) => goal.name === "recall")?.id;
  requireValue(
    goals.some(
      (goal) =>
        goal.id === recallId && goal.private_for === null && !goal.deleted
    ),
    "Active shared Recall is unavailable"
  );
  const updates = [];
  const inserts = [];
  // Validate the entire batch before the first write. Never accept edited payloads
  // merely because their old snapshot still matches: rederive their values too.
  for (const entry of plan.goalUpdates) {
    const row = goals.find((goal) => goal.id === entry.id);
    if (validateGoalUpdate(entry, row ? camelizeKeys(row) : null))
      updates.push(entry);
  }
  for (const entry of plan.recallSettingsInserts) {
    if (
      await validateRecallInsert(
        tx,
        entry,
        users.find((user) => user.id === entry.userId),
        recallId
      )
    ) {
      inserts.push(entry);
    }
  }
  const referenceWrites = validateReferenceUpdates(
    goals.map(camelizeKeys),
    references,
    plan.references?.updates
  );
  validateRenameCoverage(
    goals.map(camelizeKeys),
    references,
    updates,
    referenceWrites
  );
  for (const entry of updates) {
    const [updated] = await tx`
      UPDATE public.goal SET name = ${entry.values.name}, display_name = ${entry.values.displayName},
        description = ${entry.values.description}, default_config = ${entry.values.defaultConfig}
      WHERE id = ${entry.id}
      RETURNING last_modified_at::text AS stamp
    `;
    requireValue(
      updated?.stamp === entry.expected.lastModifiedAt,
      "Goal timestamp changed during conversion; transaction must roll back"
    );
  }
  for (const entry of inserts) {
    const inserted = await tx`
      INSERT INTO public.goal_user_settings (user_id, goal_id, overrides)
      VALUES (${entry.userId}, ${entry.goalId}, ${entry.overrides})
      ON CONFLICT (user_id, goal_id) DO NOTHING RETURNING user_id
    `;
    requireValue(
      inserted.length === 1,
      "Recall insert conflicted; transaction must roll back"
    );
  }
  await writeReferenceUpdates(tx, referenceWrites);
  return {
    referencesUpdated: referenceWrites.length,
    goalsUpdated: updates.length,
    recallSettingsInserted: inserts.length,
    alreadyApplied:
      plan.goalUpdates.length +
      plan.recallSettingsInserts.length +
      plan.references.updates.length -
      referenceWrites.length -
      updates.length -
      inserts.length,
  };
}

/** Always roll back, including trigger-produced sync-log changes. No commit mode. */
export async function rehearseGoalCutover(sql, plan) {
  const rollback = new Error("Successful cutover rehearsal rollback");
  let result;
  try {
    await sql.begin(async (tx) => {
      result = await applyGoalCutoverPlan(tx, plan);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}
