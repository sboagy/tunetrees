/** Real local Postgres tests. All fixture and conversion writes roll back. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { camelizeKeys } from "oosync/sync/casing";
import postgres from "postgres";
import { getBuiltInGoals } from "../src/lib/goals/builtins.ts";
import { prepareGoalCutoverPlan } from "./lib/goal-cutover/cutover-plan.ts";
import {
  legacyPreferences,
  readGoalCutoverSnapshot,
} from "./lib/goal-cutover-snapshot.mjs";
import { applyGoalCutoverPlan } from "./lib/goal-cutover-transaction.mjs";
import { writeReferenceUpdates } from "./lib/goal-reference-transaction.mjs";

const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { max: 2 }
);
const userId = randomUUID();
const goalId = randomUUID();
const repertoireId = randomUUID();
const tuneId = randomUUID();
const eventId = randomUUID();
const due = "2020-01-05 03:04:05.123456";
const goalName = `cutover:${goalId}`;
const recallId = getBuiltInGoals().find((goal) => goal.name === "recall").id;
const stamp = "2020-01-02 03:04:05.123456";
const rollback = new Error("Rollback successful fixture");

async function planFixture(tx) {
  const { goals, users, references } = await readGoalCutoverSnapshot(tx);
  return prepareGoalCutoverPlan(
    goals
      .filter((goal) => [goalId, recallId].includes(goal.id))
      .map(camelizeKeys),
    users
      .filter((user) => user.id === userId)
      .map((user) => ({ id: user.id, preferences: legacyPreferences(user) })),
    references.filter((source) => source.ownerId === userId)
  );
}

async function assertUnconverted(tx) {
  const [goal] =
    await tx`SELECT default_config FROM public.goal WHERE id = ${goalId}`;
  assert.equal(goal.default_config, null);
  assert.equal(
    (
      await tx`SELECT goal_id FROM public.practice_record WHERE id = ${eventId}`
    )[0].goal_id,
    null
  );
  assert.equal(
    (
      await tx`SELECT goal_id FROM public.repertoire_tune WHERE repertoire_ref = ${repertoireId} AND tune_ref = ${tuneId}`
    )[0].goal_id,
    null
  );
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
    await tx`INSERT INTO public.repertoire (repertoire_id, user_ref) VALUES (${repertoireId}, ${userId})`;
    await tx`INSERT INTO public.tune (id, private_for) VALUES (${tuneId}, ${userId})`;
    await tx`INSERT INTO public.repertoire_tune (repertoire_ref, tune_ref, goal, scheduled, last_modified_at)
      VALUES (${repertoireId}, ${tuneId}, ${goalName}, ${due}, ${stamp})`;
    await tx`INSERT INTO public.practice_record (id, repertoire_ref, tune_ref, goal, practiced, due, last_modified_at, quality)
      VALUES (${eventId}, ${repertoireId}, ${tuneId}, ${goalName}, ${stamp}, ${due}, ${stamp}, 2)`;
    const plan = await planFixture(tx);

    await rollbackCase(tx, async (sp) => {
      const before =
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`;
      await rollbackCase(sp, async (nested) => {
        assert.deepEqual(await applyGoalCutoverPlan(nested, plan), {
          referencesUpdated: 2,
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
        const [event] =
          await nested`SELECT goal_id, goal, practiced::text, due::text, last_modified_at::text, quality
          FROM public.practice_record WHERE id = ${eventId}`;
        assert.deepEqual(event, {
          goal_id: goalId,
          goal: goalName,
          practiced: stamp,
          due,
          last_modified_at: stamp,
          quality: 2,
        });
        const [assignment] =
          await nested`SELECT goal_id, goal, scheduled::text, last_modified_at::text
          FROM public.repertoire_tune WHERE repertoire_ref = ${repertoireId} AND tune_ref = ${tuneId}`;
        assert.deepEqual(assignment, {
          goal_id: goalId,
          goal: goalName,
          scheduled: due,
          last_modified_at: stamp,
        });
        const logs =
          await nested`SELECT * FROM public.sync_change_log ORDER BY table_name`;
        assert.deepEqual(await applyGoalCutoverPlan(nested, plan), {
          referencesUpdated: 0,
          goalsUpdated: 0,
          recallSettingsInserted: 0,
          alreadyApplied: 4,
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
    await rollbackCase(tx, async (sp) => {
      await sp`UPDATE public.practice_record SET quality = 3 WHERE id = ${eventId}`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /Goal-reference source changed/
      );
      await assertUnconverted(sp);
    });
    await rollbackCase(tx, async (sp) => {
      // Fail at the last phase, after definitions, settings and assignment writes.
      await sp`ALTER TABLE public.practice_record ADD CONSTRAINT cutover_reference_test_reject
        CHECK (goal_id IS NULL) NOT VALID`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        (error) => error.code === "23514"
      );
      await assertUnconverted(sp);
      assert.equal(
        (
          await sp`SELECT 1 FROM public.goal_user_settings WHERE user_id = ${userId}`
        ).length,
        0
      );
    });
    await rollbackCase(tx, async (sp) => {
      // This partial event is permitted by the expanded schema. Neither the
      // planner nor an edited plan nor the SQL writer may attribute it as legacy.
      await sp`UPDATE public.practice_record SET evaluation_id = 'again' WHERE id = ${eventId}`;
      const partialPlan = await planFixture(sp);
      assert.equal(
        partialPlan.references.updates.filter(
          (entry) => entry.expected.kind === "history"
        ).length,
        0
      );
      assert.equal(partialPlan.references.unresolved[0].key, eventId);
      const { references } = await readGoalCutoverSnapshot(sp);
      const expected = references.find(
        (source) => source.kind === "history" && source.key === eventId
      );
      const forged = { expected, goalId };
      partialPlan.references.updates.push(forged);
      await assert.rejects(
        applyGoalCutoverPlan(sp, partialPlan),
        /attribution changed/
      );
      await assert.rejects(
        writeReferenceUpdates(sp, [forged]),
        /Goal-reference write/
      );
      await assertUnconverted(sp);
      assert.equal(
        (
          await sp`SELECT evaluation_id FROM public.practice_record WHERE id = ${eventId}`
        )[0].evaluation_id,
        "again"
      );
    });
    // Plans created while staging was empty must still fail if any draft arrives.
    // Include sparse and note-only rows; absence of an evaluation is not consent
    // to discard work. Everything, including the inserted draft, stays unchanged.
    for (const draft of [
      {},
      { note_private: "Private pending note" },
      { evaluation_id: "again", scheduler_id: "fsrs" },
    ]) {
      await rollbackCase(tx, async (sp) => {
        await sp`INSERT INTO public.table_transient_data ${sp({
          user_id: userId,
          repertoire_id: repertoireId,
          tune_id: tuneId,
          ...draft,
        })}`;
        const snapshot = await readGoalCutoverSnapshot(sp);
        assert.deepEqual(
          [...snapshot.stagedWork],
          [
            {
              user_id: userId,
              repertoire_id: repertoireId,
              tune_id: tuneId,
            },
          ]
        );
        const before = await sp`SELECT * FROM public.table_transient_data`;
        const logs =
          await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`;
        await assert.rejects(
          applyGoalCutoverPlan(sp, plan),
          /Pending staged work/
        );
        await assertUnconverted(sp);
        assert.equal(
          (
            await sp`SELECT 1 FROM public.goal_user_settings WHERE user_id = ${userId}`
          ).length,
          0
        );
        assert.deepEqual(
          await sp`SELECT * FROM public.table_transient_data`,
          before
        );
        assert.deepEqual(
          await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`,
          logs
        );
      });
    }

    const wrongReference = structuredClone(plan);
    wrongReference.references.updates[0].goalId = recallId;
    await assert.rejects(
      applyGoalCutoverPlan(tx, wrongReference),
      /attribution changed/
    );
    await assertUnconverted(tx);

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
    // The empty staging check is protected against concurrent draft insertion.
    await assert.rejects(
      sql.begin(async (other) => {
        await other`SET LOCAL lock_timeout = '100ms'`;
        await other`INSERT INTO public.table_transient_data (user_id, repertoire_id, tune_id)
          VALUES (${userId}, ${repertoireId}, ${tuneId})`;
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
