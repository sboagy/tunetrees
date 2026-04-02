import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

// Local convenience for developers; CI / scripted runs can still inject env.
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL environment variable.");
  console.error(
    'Run via `op run --env-file=".env.local.template" -- ...` or set DATABASE_URL explicitly.'
  );
  process.exit(1);
}

const sql = postgres(connectionString);
const repoRoot = process.cwd();

const viewFiles = [
  "sql_scripts/view_playlist_joined.sql",
  "sql_scripts/view_practice_list_joined.sql",
  "sql_scripts/view_practice_list_staged.sql",
] as const;

async function main() {
  console.log("\nCreating TuneTrees Postgres views");

  try {
    for (const relativePath of viewFiles) {
      const absolutePath = path.join(repoRoot, relativePath);
      const viewSql = readFileSync(absolutePath, "utf-8");
      console.log(`Applying ${relativePath}`);
      await sql.unsafe(viewSql);
    }

    console.log("\nViews created successfully.");
  } finally {
    await sql.end();
  }
}

await main();
