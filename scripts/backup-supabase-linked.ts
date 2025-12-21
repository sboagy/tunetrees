import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

function formatUtcTimestampForFilename(date: Date): string {
  // YYYYMMDD_HHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "_",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function run(cmd: string, args: string[]): void {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with code ${res.status}`);
  }
}

function main(): void {
  const repoRoot = process.cwd();
  const backupsDir = path.join(repoRoot, "backups");
  mkdirSync(backupsDir, { recursive: true });

  const stamp = formatUtcTimestampForFilename(new Date());
  const base = path.join(backupsDir, `backup_${stamp}`);

  // Note: supabase db dump defaults to schema-only.
  // We generate two files: schema + data. Together they provide a restorable snapshot.
  const schemaFile = `${base}_schema.sql`;
  const dataFile = `${base}_data.sql`;

  console.log(`\n[backup] Writing schema to: ${schemaFile}`);
  run("supabase", [
    "db",
    "dump",
    "--linked",
    "--schema",
    "public,auth",
    "-f",
    schemaFile,
  ]);

  console.log(`\n[backup] Writing data to: ${dataFile}`);
  run("supabase", [
    "db",
    "dump",
    "--linked",
    "--data-only",
    "--use-copy",
    "--schema",
    "public,auth",
    "-f",
    dataFile,
  ]);

  console.log("\n[backup] Done.");
  console.log(
    "[backup] If you see a password prompt, set SUPABASE_DB_PASSWORD for automation."
  );
}

main();
