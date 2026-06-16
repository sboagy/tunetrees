import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import postgres from "postgres";

const SUPABASE_CLI_VERSION = "2.98.2";
const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
// Absolute path avoids PATH-search command injection (SonarQube S4036).
const NPX = join(dirname(process.execPath), "npx");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseArgs(argv) {
  const envFlagIndex = argv.indexOf("--env");
  if (envFlagIndex === -1 || !argv[envFlagIndex + 1]) {
    fail(
      "Usage: node scripts/run-supabase-schema-push.mjs --env staging|production"
    );
  }

  const targetEnv = argv[envFlagIndex + 1];
  if (!["staging", "production"].includes(targetEnv)) {
    fail(`Unsupported schema push target: ${targetEnv}`);
  }
  return { targetEnv };
}

function mask(value) {
  if (process.env.GITHUB_ACTIONS === "true" && value) {
    console.log(`::add-mask::${value}`);
  }
}

function appendSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${markdown.trimEnd()}\n`);
  }
}

function parseProjectRefFromSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const [projectRef] = url.hostname.split(".");
    if (!projectRef || projectRef === "localhost" || projectRef === "127") {
      throw new Error(`not a Supabase project host: ${url.hostname}`);
    }
    return projectRef;
  } catch (err) {
    fail(
      `Unable to parse SUPABASE_URL project ref: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function redactedDatabaseTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "") || "(none)";
  return {
    host: url.hostname,
    dbName,
    redacted: `${url.hostname}/${dbName}`,
    hash: createHash("sha256")
      .update(`${url.hostname}/${dbName}`)
      .digest("hex")
      .slice(0, 12),
  };
}

function databaseUrlForSupabaseCli(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("default_query_exec_mode")) {
    // Supabase remote URLs may use the IPv4-capable pooler in CI. Supabase CLI
    // uses pgx, and pgx's default prepared statement cache can collide with
    // pooler connections as "prepared statement lrupsc_* already exists".
    url.searchParams.set("default_query_exec_mode", "describe_exec");
  }
  return url.toString();
}

function assertTargetEnvironment({ targetEnv, databaseUrl, supabaseUrl }) {
  const projectRef = parseProjectRefFromSupabaseUrl(supabaseUrl);
  const url = new URL(databaseUrl);
  const ref = projectRef.toLowerCase();

  // Direct connections embed the ref as a hostname segment (db.{ref}.supabase.co);
  // pooler connections embed it as a username segment (postgres.{ref}).
  // Split on "." so a ref that is a prefix/suffix of another segment can't match.
  const inHostname = url.hostname.toLowerCase().split(".").includes(ref);
  const inUsername = url.username.toLowerCase().split(".").includes(ref);

  if (!inHostname && !inUsername) {
    fail(
      `DATABASE_URL does not appear to target the ${targetEnv} Supabase project ref ${projectRef}.`
    );
  }

  const target = redactedDatabaseTarget(databaseUrl);
  appendSummary(`
### Supabase schema target (${targetEnv})

- Supabase project ref: \`${projectRef}\`
- Database target hash: \`${target.hash}\`
- Database target: \`${target.redacted}\`
`);
}

function runSupabase(args, label) {
  console.log(`Running ${label}...`);
  const result = spawnSync(
    NPX,
    ["--yes", `supabase@${SUPABASE_CLI_VERSION}`, ...args],
    {
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const error = new Error(`${label} failed with exit code ${result.status}`);
    error.stdout = stdout;
    error.stderr = stderr;
    throw error;
  }

  return `${stdout}\n${stderr}`;
}

async function getLocalMigrations() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = entry.name.match(/^(\d{14})_(.+)\.sql$/);
      if (!match) {
        return null;
      }
      const [, version, name] = match;
      return {
        version,
        name,
        path: join(MIGRATIONS_DIR, entry.name),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.version.localeCompare(right.version));
}

async function ensureMigrationTable(sql) {
  await sql`CREATE SCHEMA IF NOT EXISTS supabase_migrations`;
  await sql`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text NOT NULL PRIMARY KEY
    )
  `;
  await sql`
    ALTER TABLE supabase_migrations.schema_migrations
    ADD COLUMN IF NOT EXISTS statements text[]
  `;
  await sql`
    ALTER TABLE supabase_migrations.schema_migrations
    ADD COLUMN IF NOT EXISTS name text
  `;
}

async function getRemoteMigrationVersions(sql) {
  await ensureMigrationTable(sql);
  const rows = await sql`
    SELECT version
    FROM supabase_migrations.schema_migrations
    ORDER BY version
  `;
  return new Set(rows.map((row) => row.version));
}

async function applyPendingMigrations(databaseUrl) {
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
  });

  try {
    const localMigrations = await getLocalMigrations();
    const remoteVersions = await getRemoteMigrationVersions(sql);
    const pendingMigrations = localMigrations.filter(
      ({ version }) => !remoteVersions.has(version)
    );

    if (pendingMigrations.length === 0) {
      return {
        status: "skipped: no pending migrations",
        applied: [],
      };
    }

    const applied = [];
    for (const migration of pendingMigrations) {
      console.log(
        `Applying migration ${migration.version}_${migration.name}...`
      );
      const contents = await readFile(migration.path, "utf8");
      await sql.unsafe(contents);
      await sql`
        INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
        VALUES(${migration.version}, ${migration.name}, ${[contents]})
        ON CONFLICT (version) DO NOTHING
      `;
      applied.push(`${migration.version}_${migration.name}`);
    }

    return {
      status: "applied pending migrations",
      applied,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const { targetEnv } = parseArgs(process.argv.slice(2));
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseCliDatabaseUrl = databaseUrlForSupabaseCli(databaseUrl);
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    fail("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  }

  mask(databaseUrl);
  mask(supabaseCliDatabaseUrl);
  assertTargetEnvironment({ targetEnv, databaseUrl, supabaseUrl });

  try {
    const migrationListOutput = runSupabase(
      ["migration", "list", "--db-url", supabaseCliDatabaseUrl],
      `${targetEnv} migration preflight`
    );
    appendSummary(`
### Supabase migration preflight (${targetEnv})

\`\`\`text
${migrationListOutput.trim() || "(no output)"}
\`\`\`
`);

    console.log(`Running ${targetEnv} schema push...`);
    const { status, applied } = await applyPendingMigrations(databaseUrl);

    appendSummary(`
### Supabase schema push (${targetEnv})

- Result: \`${status}\`
- Applied migrations: \`${applied.length ? applied.join(", ") : "(none)"}\`
`);
  } catch (err) {
    appendSummary(`
### Supabase schema push (${targetEnv})

- Result: \`failed\`
- Action: inspect \`npm run db:${targetEnv}:schema:push\` output before retrying.
`);
    fail(err instanceof Error ? err.message : String(err));
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
