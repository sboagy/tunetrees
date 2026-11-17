/** Real local Postgres tests. All fixture and conversion writes roll back. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { camelizeKeys } from "oosync/sync/casing";
import postgres from "postgres";
import { getBuiltInGoals } from "../src/lib/goals/builtins.ts";
import { prepareGoalCutoverPlan } from "../src/lib/goals/cutover-plan.ts";
import {
  legacyPreferences,
  readGoalCutoverSnapshot,
} from "./lib/goal-cutover-snapshot.mjs";
import { applyGoalCutoverPlan } from "./lib/goal-cutover-transaction.mjs";

const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { max: 2 }
);
const userId = randomUUID();
const goalId = randomUUID();
const goalName = `cutover:${goalId}`;
const recallId = getBuiltInGoals().find((goal) => goal.name === "recall").id;
const stamp = "2020-01-02 03:04:05.123456";
const rollback = new Error("Rollback successful fixture");

async function planFixture(tx) {
  const { goals, users } = await readGoalCutoverSnapshot(tx);
  return prepareGoalCutoverPlan(
    goals
      .filter((goal) => [goalId, recallId].includes(goal.id))
      .map(camelizeKeys),
    users
      .filter((user) => user.id === userId)
      .map((user) => ({ id: user.id, preferences: legacyPreferences(user) }))
  );
}

async function assertUnconverted(tx) {
  const [goal] =
    await tx`SELECT default_config FROM public.goal WHERE id = ${goalId}`;
  assert.equal(goal.default_config, null);
}

async function rollbackCase(tx, test) {
  try {
    await tx.savepoint(async (sp) => {
      await test(sp);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

try {
  await sql.begin(async (tx) => {
    await tx`INSERT INTO public.user_profile (id) VALUES (${userId})`;
    await tx`INSERT INTO public.goal (id, name, private_for, default_technique, base_intervals, last_modified_at)
      VALUES (${goalId}, ${goalName}, ${userId}, 'base_interval', '[0.1,1,3]', ${stamp})`;
    await tx`INSERT INTO public.prefs_scheduling_options (user_id, min_reviews_per_day, max_reviews_per_day)
      VALUES (${userId}, 0, 0)`;
    const plan = await planFixture(tx);

    await rollbackCase(tx, async (sp) => {
      const before =
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`;
      await rollbackCase(sp, async (nested) => {
        assert.deepEqual(await applyGoalCutoverPlan(nested, plan), {
          goalsUpdated: 1,
          recallSettingsInserted: 1,
          alreadyApplied: 0,
        });
        const [goal] =
          await nested`SELECT last_modified_at::text AS stamp, name, base_intervals
          FROM public.goal WHERE id = ${goalId}`;
        assert.equal(goal.stamp, stamp);
        assert.equal(goal.name, goalName);
        assert.equal(goal.base_intervals, "[0.1,1,3]");
        const logs =
          await nested`SELECT * FROM public.sync_change_log ORDER BY table_name`;
        assert.deepEqual(await applyGoalCutoverPlan(nested, plan), {
          goalsUpdated: 0,
          recallSettingsInserted: 0,
          alreadyApplied: 2,
        });
        assert.deepEqual(
          await nested`SELECT * FROM public.sync_change_log ORDER BY table_name`,
          logs
        );
      });
      await assertUnconverted(sp);
      assert.equal(
        (
          await sp`SELECT 1 FROM public.goal_user_settings WHERE user_id = ${userId}`
        ).length,
        0
      );
      assert.deepEqual(
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`,
        before
      );
    });

    await rollbackCase(tx, async (sp) => {
      // A transient NOT VALID constraint permits existing data but rejects the
      // later INSERT, after the goal UPDATE has already run. The enclosing
      // savepoint removes the test constraint too; no schema change persists.
      await sp`ALTER TABLE public.goal_user_settings ADD CONSTRAINT cutover_rehearsal_test_reject
        CHECK (overrides IS NULL) NOT VALID`;
      const before =
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        (error) => error.code === "23514"
      );
      await assertUnconverted(sp);
      assert.deepEqual(
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`,
        before
      );
    });

    await rollbackCase(tx, async (sp) => {
      await sp`UPDATE public.prefs_scheduling_options SET min_reviews_per_day = 5 WHERE user_id = ${userId}`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /preferences changed/
      );
      await assertUnconverted(sp);
    });
    await rollbackCase(tx, async (sp) => {
      await sp`UPDATE public.goal SET name = 'Changed' WHERE id = ${goalId}`;
      await assert.rejects(applyGoalCutoverPlan(sp, plan), /source changed/);
      assert.equal(
        (
          await sp`SELECT 1 FROM public.goal_user_settings WHERE user_id = ${userId}`
        ).length,
        0
      );
    });
    await rollbackCase(tx, async (sp) => {
      await sp`INSERT INTO public.goal_user_settings (user_id, goal_id, deleted)
        VALUES (${userId}, ${recallId}, true)`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /existing settings are preserved/
      );
      await assertUnconverted(sp);
      assert.equal(
        (
          await sp`SELECT deleted FROM public.goal_user_settings WHERE user_id = ${userId}`
        )[0].deleted,
        true
      );
    });
    const tampered = structuredClone(plan);
    tampered.recallSettingsInserts[0].overrides =
      '{"version":1,"daily":{"minimum":99}}';
    await assert.rejects(
      applyGoalCutoverPlan(tx, tampered),
      /differs from its source/
    );
    await assertUnconverted(tx);

    // A competing UPDATE must block even when its predicate matches no rows:
    // table locks protect absent preferences/overrides as well as existing rows.
    await applyGoalCutoverPlan(tx, plan);
    await assert.rejects(
      sql.begin(async (other) => {
        await other`SET LOCAL lock_timeout = '100ms'`;
        await other`UPDATE public.prefs_scheduling_options SET min_reviews_per_day = 6 WHERE user_id = ${userId}`;
      }),
      (error) => error.code === "55P03"
    );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  try {
    assert.equal(
      (await sql`SELECT 1 FROM public.user_profile WHERE id = ${userId}`)
        .length,
      0
    );
    assert.equal(
      (await sql`SELECT 1 FROM public.goal WHERE id = ${goalId}`).length,
      0
    );
    assert.equal(
      (
        await sql`SELECT 1 FROM public.goal_user_settings WHERE user_id = ${userId}`
      ).length,
      0
    );
  } finally {
    await sql.end();
  }
}
console.log(
  "Cutover transaction: timestamp preservation, idempotency, stale/tampered input, tombstones, locking and rollback passed."
);
