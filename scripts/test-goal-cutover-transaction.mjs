/** Real local Postgres tests. All fixture and conversion writes roll back.
 * Requires migrated/seeded, cutover-ready local data without pending drafts.
 * CI supplies this before E2E; locally submit/discard drafts before running.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { camelizeKeys } from "oosync/sync/casing";
import postgres from "postgres";
import { getBuiltInGoals } from "../src/lib/goals/builtins.ts";
import { prepareGoalCutoverPlan } from "./lib/goal-cutover/cutover-plan.ts";
import {
  GoalCutoverBlocked,
  prepareCompleteGoalCutover,
} from "./lib/goal-cutover-preflight.mjs";
import {
  legacyPreferences,
  readGoalCutoverSnapshot,
} from "./lib/goal-cutover-snapshot.mjs";
import { applyGoalCutoverPlan } from "./lib/goal-cutover-transaction.mjs";
import { migrateGoals } from "./lib/goal-migration.mjs";
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
const queueId = randomUUID();
const due = "2020-01-05 03:04:05.123456";
const goalName = `cutover:${goalId}`;
const recallId = getBuiltInGoals().find((goal) => goal.name === "recall").id;
const stamp = "2020-01-02 03:04:05.123456";
const rollback = new Error("Rollback successful fixture");

async function planFixture(tx) {
  const { goals, users, references, queues } =
    await readGoalCutoverSnapshot(tx);
  return prepareGoalCutoverPlan(
    goals
      .filter((goal) => [goalId, recallId].includes(goal.id))
      .map(camelizeKeys),
    users
      .filter((user) => user.id === userId)
      .map((user) => ({ id: user.id, preferences: legacyPreferences(user) })),
    references.filter((source) => source.ownerId === userId),
    queues.filter((source) => source.ownerId === userId)
  );
}

async function assertUnconverted(tx) {
  const [goal] =
    await tx`SELECT default_config, name FROM public.goal WHERE id = ${goalId}`;
  assert.equal(goal.default_config, null);
  assert.equal(goal.name, goalName);
  assert.equal(
    (
      await tx`SELECT displayed_practice_record_id FROM public.daily_practice_queue WHERE id = ${queueId}`
    )[0].displayed_practice_record_id,
    null
  );
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
    // CI's restored legacy seed can overwrite configuration installed by migrations.
    // Apply the canonical seed only inside this rollback scope, as restore does.
    const seed = readFileSync(
      new URL("../sql_scripts/seed_goal_configuration.sql", import.meta.url),
      "utf8"
    )
      .replace(/^BEGIN;$/m, "")
      .replace(/^COMMIT;$/m, "");
    await tx.unsafe(seed);
    await tx`SET LOCAL tunetrees.goal_seed_write = 'off'`;
    // Fail explicitly on unsupported test setup, before inserting any fixture.
    const baseline = prepareCompleteGoalCutover(
      await readGoalCutoverSnapshot(tx)
    );
    const expectedGoalUpdates = baseline.plan.goalUpdates.length + 1;
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
    await tx`INSERT INTO public.daily_practice_queue
      (id, user_ref, repertoire_ref, tune_ref, window_start_utc, window_end_utc,
       bucket, order_index, snapshot_coalesced_ts, generated_at, completed_at, last_modified_at)
      VALUES (${queueId}, ${userId}, ${repertoireId}, ${tuneId}, '2020-01-01', '2020-01-02',
        1, 0, ${stamp}, '2020-01-01', ${stamp}, ${stamp})`;
    const plan = await planFixture(tx);

    // Exercise the operator command's complete transaction, including apply mode,
    // inside an outer rollback scope so neither fixtures nor baseline data persist.
    await rollbackCase(tx, async (sp) => {
      const connection = { begin: (callback) => sp.savepoint(callback) };
      const dryRun = await migrateGoals(connection);
      assert.equal(dryRun.committed, false);
      assert.equal(dryRun.goalsUpdated, expectedGoalUpdates);
      await assertUnconverted(sp);
      const applied = await migrateGoals(connection, { apply: true });
      assert.equal(applied.committed, true);
      assert.equal(applied.goalsUpdated, expectedGoalUpdates);
      assert.equal(
        (await sp`SELECT name FROM public.goal WHERE id = ${goalId}`)[0].name,
        `custom:${goalId}`
      );
      const logs =
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`;
      const retry = await migrateGoals(connection, { apply: true });
      assert.equal(
        retry.goalsUpdated +
          retry.referencesUpdated +
          retry.recallSettingsInserted +
          retry.queueCompletionsUpdated,
        0
      );
      assert.deepEqual(
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`,
        logs
      );
    });
    await assertUnconverted(tx);
    await rollbackCase(tx, async (sp) => {
      await sp`INSERT INTO public.table_transient_data (user_id, repertoire_id, tune_id, note_private)
        VALUES (${userId}, ${repertoireId}, ${tuneId}, 'pending')`;
      await assert.rejects(
        migrateGoals(
          { begin: (callback) => sp.savepoint(callback) },
          { apply: true }
        ),
        (error) =>
          error instanceof GoalCutoverBlocked &&
          error.report.stagedWork.length > 0
      );
      await assertUnconverted(sp);
    });
    await rollbackCase(tx, async (sp) => {
      await sp`ALTER TABLE public.daily_practice_queue ADD CONSTRAINT migration_apply_test_reject
        CHECK (displayed_practice_record_id IS NULL) NOT VALID`;
      await assert.rejects(
        migrateGoals(
          { begin: (callback) => sp.savepoint(callback) },
          { apply: true }
        ),
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
      const before =
        await sp`SELECT * FROM public.sync_change_log ORDER BY table_name`;
      await rollbackCase(sp, async (nested) => {
        assert.deepEqual(await applyGoalCutoverPlan(nested, plan), {
          queueCompletionsUpdated: 1,
          referencesUpdated: 2,
          goalsUpdated: 1,
          recallSettingsInserted: 1,
          alreadyApplied: 0,
        });
        const [linkedQueue] =
          await nested`SELECT to_jsonb(q) AS row FROM public.daily_practice_queue q WHERE id = ${queueId}`;
        assert.deepEqual(linkedQueue.row, {
          ...plan.queueCompletions.updates[0].expected.row,
          displayed_practice_record_id: eventId,
        });
        const [goal] =
          await nested`SELECT last_modified_at::text AS stamp, name, base_intervals
          FROM public.goal WHERE id = ${goalId}`;
        assert.equal(goal.stamp, stamp);
        assert.equal(goal.name, `custom:${goalId}`);
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
          goal: `custom:${goalId}`,
          scheduled: due,
          last_modified_at: stamp,
        });
        const logs =
          await nested`SELECT * FROM public.sync_change_log ORDER BY table_name`;
        assert.deepEqual(await applyGoalCutoverPlan(nested, plan), {
          queueCompletionsUpdated: 0,
          referencesUpdated: 0,
          goalsUpdated: 0,
          recallSettingsInserted: 0,
          alreadyApplied: 5,
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
      await assert.rejects(
        migrateGoals(
          { begin: (callback) => sp.savepoint(callback) },
          { apply: true }
        ),
        (error) =>
          error instanceof GoalCutoverBlocked &&
          error.report.incompleteNewEventIds.includes(eventId)
      );
      await assertUnconverted(sp);
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
      const forged = { expected, goalId, goalKey: expected.goal };
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

    await rollbackCase(tx, async (sp) => {
      // Existing new configuration and friendly names survive a key-only conversion.
      const config = plan.goalUpdates[0].values.defaultConfig;
      await sp`UPDATE public.goal SET default_config = ${config}, display_name = 'Retained label'
        WHERE id = ${goalId}`;
      const configuredPlan = await planFixture(sp);
      await applyGoalCutoverPlan(sp, configuredPlan);
      const [converted] =
        await sp`SELECT name, display_name, default_config, last_modified_at::text AS stamp
        FROM public.goal WHERE id = ${goalId}`;
      assert.deepEqual(converted, {
        name: `custom:${goalId}`,
        display_name: "Retained label",
        default_config: config,
        stamp,
      });
      assert.equal(
        (await applyGoalCutoverPlan(sp, configuredPlan)).alreadyApplied,
        5
      );
    });
    await rollbackCase(tx, async (sp) => {
      await sp`ALTER TABLE public.daily_practice_queue ADD CONSTRAINT cutover_queue_test_reject
        CHECK (displayed_practice_record_id IS NULL) NOT VALID`;
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
      await sp`INSERT INTO public.practice_record (id, repertoire_ref, tune_ref, practiced, last_modified_at)
        VALUES (${randomUUID()}, ${repertoireId}, ${tuneId}, '2020-01-01 12:00:00', ${stamp})`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /completion evidence changed or is ambiguous/
      );
      await assertUnconverted(sp);
    });
    await rollbackCase(tx, async (sp) => {
      await sp`UPDATE public.daily_practice_queue SET completed_at = null WHERE id = ${queueId}`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /Queue completion changed/
      );
      await assertUnconverted(sp);
    });
    const wrongCompletion = structuredClone(plan);
    wrongCompletion.queueCompletions.updates[0].event.key = randomUUID();
    await assert.rejects(
      applyGoalCutoverPlan(tx, wrongCompletion),
      /completion evidence changed/
    );
    await assertUnconverted(tx);
    await rollbackCase(tx, async (sp) => {
      const queueOnly = {
        ...plan,
        goalUpdates: [],
        recallSettingsInserts: [],
        references: { updates: [] },
      };
      await sp`UPDATE public.practice_record SET quality = 4 WHERE id = ${eventId}`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, queueOnly),
        /completion evidence changed/
      );
      await assertUnconverted(sp);
    });
    const oldPlan = { ...plan, version: 2 };
    await assert.rejects(
      applyGoalCutoverPlan(tx, oldPlan),
      /new version-4 plan/
    );
    await assertUnconverted(tx);

    for (const kind of ["assignment", "history"]) {
      const incomplete = structuredClone(plan);
      incomplete.references.updates = incomplete.references.updates.filter(
        (entry) => entry.expected.kind !== kind
      );
      await assert.rejects(
        applyGoalCutoverPlan(tx, incomplete),
        /missing an affected reference/
      );
      await assertUnconverted(tx);
    }
    const missingGoal = structuredClone(plan);
    missingGoal.goalUpdates = [];
    await assert.rejects(
      applyGoalCutoverPlan(tx, missingGoal),
      /matching custom goal conversion/
    );
    await assertUnconverted(tx);

    await rollbackCase(tx, async (sp) => {
      // New history inserted after plan preparation must not lose name attribution.
      await sp`INSERT INTO public.practice_record (id, repertoire_ref, tune_ref, goal, practiced)
        VALUES (${randomUUID()}, ${repertoireId}, ${tuneId}, ${goalName}, '2020-02-01')`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /missing an affected reference/
      );
      await assertUnconverted(sp);
    });
    await rollbackCase(tx, async (sp) => {
      const occupiedGoalKey = `custom:${goalId}`;
      await sp`INSERT INTO public.goal (id, name, private_for, default_technique)
        VALUES (${randomUUID()}, ${occupiedGoalKey}, ${userId}, 'fsrs')`;
      await assert.rejects(
        applyGoalCutoverPlan(sp, plan),
        /target key is occupied/
      );
      await assertUnconverted(sp);
    });

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
    // Assignment attribution cannot change between validation and commit.
    await assert.rejects(
      sql.begin(async (other) => {
        await other`SET LOCAL lock_timeout = '100ms'`;
        await other`UPDATE public.repertoire_tune SET goal_id = ${recallId}
          WHERE repertoire_ref = ${repertoireId} AND tune_ref = ${tuneId}`;
      }),
      (error) => error.code === "55P03"
    );
    await assert.rejects(
      sql.begin(async (other) => {
        await other`SET LOCAL lock_timeout = '100ms'`;
        await other`UPDATE public.daily_practice_queue SET completed_at = null WHERE id = ${queueId}`;
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
