import { requireValue } from "./cutover-checks.mjs";
import { prepareCompleteGoalCutover } from "./goal-cutover-preflight.mjs";
import { readGoalCutoverSnapshot } from "./goal-cutover-snapshot.mjs";
import {
  applyGoalCutoverPlan,
  lockGoalCutoverTables,
} from "./goal-cutover-transaction.mjs";

function pendingWrites(plan) {
  return (
    plan.goalUpdates.length +
    plan.recallSettingsInserts.length +
    plan.references.updates.length +
    plan.queueCompletions.updates.length
  );
}

/** One transaction: read current data, convert, verify, then commit or dry-run rollback. */
export async function migrateGoals(sql, { apply = false } = {}) {
  const dryRun = new Error("Successful goal migration dry run");
  let result;
  try {
    await sql.begin(async (tx) => {
      await lockGoalCutoverTables(tx);
      const before = prepareCompleteGoalCutover(
        await readGoalCutoverSnapshot(tx)
      );
      const counts = await applyGoalCutoverPlan(tx, before.plan);
      const after = prepareCompleteGoalCutover(
        await readGoalCutoverSnapshot(tx)
      );
      requireValue(
        pendingWrites(after.plan) === 0,
        "Goal migration verification found remaining writes"
      );
      result = {
        ...counts,
        unresolvedGoalReferences: after.report.unresolvedGoalReferences.length,
        unresolvedQueueCompletions:
          after.report.unresolvedQueueCompletions.length,
        committed: apply,
      };
      if (!apply) throw dryRun;
    });
  } catch (error) {
    if (error !== dryRun) throw error;
  }
  return result;
}
