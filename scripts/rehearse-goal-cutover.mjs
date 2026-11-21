/** Local-only rollback rehearsal, never an apply/deployment command. */
import { readFileSync, statSync } from "node:fs";
import postgres from "postgres";
import { rehearseGoalCutover } from "./lib/goal-cutover-transaction.mjs";

const [file, ...extra] = process.argv.slice(2);
if (!file || extra.length)
  throw new Error("Usage: tsx scripts/rehearse-goal-cutover.mjs <plan.json>");
if (statSync(file).size > 16 * 1024 * 1024)
  throw new Error("Cutover plan exceeds 16 MiB");
const plan = JSON.parse(readFileSync(file, "utf8"));
const sql = postgres(
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { max: 1 }
);
try {
  console.log({ ...(await rehearseGoalCutover(sql, plan)), rolledBack: true });
} finally {
  await sql.end();
}
