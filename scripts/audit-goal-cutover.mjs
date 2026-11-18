/** Local read-only diagnostic audit. The main operator command is goals:migrate. */
import { writeFileSync } from "node:fs";
import postgres from "postgres";
import {
  hasCutoverBlockers,
  inspectGoalCutover,
  prepareCompleteGoalCutover,
} from "./lib/goal-cutover-preflight.mjs";
import { readGoalCutoverSnapshot } from "./lib/goal-cutover-snapshot.mjs";

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
      const snapshot = await readGoalCutoverSnapshot(tx);
      const report = inspectGoalCutover(snapshot);
      const plan =
        destination && !hasCutoverBlockers(report)
          ? prepareCompleteGoalCutover(snapshot).plan
          : null;
      return { report, plan };
    }
  );
  console.log(JSON.stringify(report, null, 2));
  if (hasCutoverBlockers(report)) process.exitCode = 1;
  if (plan) {
    // A review artifact only. Refuse overwrite and keep local preference data private.
    writeFileSync(destination, `${JSON.stringify(plan, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Prepared definition/settings/reference plan; no database writes performed."
    );
  }
} finally {
  await sql.end();
}
