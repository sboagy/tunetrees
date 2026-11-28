/** Operator command; dry-run by default. See docs/development/goals-cutover.md. */
import postgres from "postgres";
import {
  goalMigrationConnection,
  goalMigrationOptions,
} from "./lib/goal-cutover/command.ts";
import { GoalCutoverBlocked } from "./lib/goal-cutover-preflight.mjs";
import { migrateGoals } from "./lib/goal-migration.mjs";

let sql;
try {
  const options = goalMigrationOptions(process.argv.slice(2));
  const { connection, target } = goalMigrationConnection(
    options.local,
    process.env.DATABASE_URL
  );
  console.log({ target, mode: options.apply ? "apply" : "dry-run (rollback)" });
  // Disable prepared statements for Supabase pooler connections. Never log the
  // connection string, queries, saved preferences, or database error payloads.
  sql = postgres(connection, { max: 1, prepare: false, onnotice: () => {} });
  console.log(await migrateGoals(sql, options));
} catch (error) {
  if (error instanceof GoalCutoverBlocked) {
    console.error(JSON.stringify(error.report, null, 2));
  }
  console.error(
    "Goal migration did not report success. Keep devices closed; run the dry run again before retrying. See docs/development/goals-cutover.md."
  );
  // A connection loss around COMMIT can leave the outcome unknown. Do not claim
  // rollback; a fresh dry run safely detects already-applied conversion work.
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
