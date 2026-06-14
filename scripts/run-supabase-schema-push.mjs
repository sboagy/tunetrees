import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SUPABASE_CLI_VERSION = "2.98.2";

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

function assertTargetEnvironment({ targetEnv, databaseUrl, supabaseUrl }) {
  const projectRef = parseProjectRefFromSupabaseUrl(supabaseUrl);
  const dbText = databaseUrl.toLowerCase();
  if (!dbText.includes(projectRef.toLowerCase())) {
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
    "npx",
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

function classifyPushOutput(output) {
  if (
    /No migrations to apply|database is up to date|remote database is up to date/i.test(
      output
    )
  ) {
    return "skipped: no pending migrations";
  }
  if (
    /Applying migration|Applied migration|Pushing migration|Finished supabase db push/i.test(
      output
    )
  ) {
    return "applied or confirmed by Supabase CLI";
  }
  return "unknown";
}

function main() {
  const { targetEnv } = parseArgs(process.argv.slice(2));
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    fail("Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  }

  mask(databaseUrl);
  assertTargetEnvironment({ targetEnv, databaseUrl, supabaseUrl });

  try {
    const migrationListOutput = runSupabase(
      ["migration", "list", "--db-url", databaseUrl],
      `${targetEnv} migration preflight`
    );
    appendSummary(`
### Supabase migration preflight (${targetEnv})

\`\`\`text
${migrationListOutput.trim() || "(no output)"}
\`\`\`
`);

    const pushOutput = runSupabase(
      ["db", "push", "--db-url", databaseUrl],
      `${targetEnv} schema push`
    );
    const status = classifyPushOutput(pushOutput);
    if (status === "unknown") {
      appendSummary(`
### Supabase schema push (${targetEnv})

- Result: \`unknown output format\`
- Action: workflow failed closed; update schema-push output parsing before retrying.
`);
      fail(
        "Supabase schema push succeeded, but the output format was not recognized. Failing closed."
      );
    }

    appendSummary(`
### Supabase schema push (${targetEnv})

- Result: \`${status}\`
`);
  } catch (err) {
    appendSummary(`
### Supabase schema push (${targetEnv})

- Result: \`failed\`
- Action: inspect \`supabase migration list --db-url "$DATABASE_URL"\` before retrying.
`);
    fail(err instanceof Error ? err.message : String(err));
  }
}

main();
