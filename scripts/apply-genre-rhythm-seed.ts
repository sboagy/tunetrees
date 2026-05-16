import { spawnSync } from "node:child_process";
import path from "node:path";

const DEFAULT_LOCAL_DB_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const UPDATE_PATH = path.join(
  process.cwd(),
  "sql_scripts/update_genre_tune_tempo_and_rhythms.sql"
);

function main(): void {
  const databaseUrl =
    process.env.SUPABASE_LOCAL_DB_URL ??
    process.env.DATABASE_URL ??
    DEFAULT_LOCAL_DB_URL;
  const shouldRollback = process.argv.includes("--rollback");
  const txEnd = shouldRollback ? "ROLLBACK;" : "COMMIT;";

  const sql = [
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    "",
    `\\i '${UPDATE_PATH.replaceAll("'", "''")}'`,
    "",
    txEnd,
    "",
  ].join("\n");

  console.log(
    `[seed] ${shouldRollback ? "Previewing" : "Applying"} genre/rhythm updates to local Supabase using ${databaseUrl}`
  );
  console.log(
    `[seed] ${shouldRollback ? "Transaction will be rolled back after execution." : "Updates will be committed."}`
  );

  const result = spawnSync("psql", [databaseUrl], {
    stdio: ["pipe", "inherit", "inherit"],
    input: sql,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`psql exited with code ${result.status}`);
  }

  console.log(
    `[seed] ${shouldRollback ? "Preview completed; no changes were committed." : "Local genre/rhythm seed applied successfully."}`
  );
}

try {
  main();
} catch (error) {
  console.error("[seed] Failed to apply genre/rhythm seed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
