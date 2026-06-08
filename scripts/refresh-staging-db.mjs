#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const DISABLED_PASSWORD_HASH =
  "$2b$10$yu1qMLlp6nvy/RyZ55VF/O/UMK.UpzqO0dTH3pO/.KBUi4Um4NKBe";
const STAGING_EMAIL_DOMAIN = "staging.tunetrees.com";
const EMAIL_REGEX = "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}";

function env(name, fallback) {
  return process.env[name] ?? fallback;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseProjectRefFromSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const [ref] = url.hostname.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

function parseProjectRefFromDatabaseUrl(value) {
  try {
    const url = new URL(value);
    const match = /^db\.([^.]+)\.supabase\.co$/i.exec(url.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function sqlLiteral(value) {
  if (value == null) {
    return "NULL";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function regexLiteral(value) {
  return sqlLiteral(value);
}

async function readWhitelist(filePath) {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Staging whitelist must be a JSON array.");
  }

  return parsed.map((entry, index) => {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Whitelist entry ${index} must be an object.`);
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const email = typeof entry.email === "string" ? entry.email.trim() : "";
    const regex = typeof entry.regex === "string" ? entry.regex.trim() : "";

    if (!id && !email && !regex) {
      throw new Error(
        `Whitelist entry ${index} must include at least one of id, email, or regex.`
      );
    }

    return { id, email, regex };
  });
}

function whitelistValuesSql(whitelist) {
  if (whitelist.length === 0) {
    return "SELECT NULL::uuid AS id, NULL::text AS email, NULL::text AS regex WHERE false";
  }

  const rows = whitelist
    .map(
      (entry) =>
        `(${entry.id ? `${sqlLiteral(entry.id)}::uuid` : "NULL::uuid"}, ${sqlLiteral(
          entry.email || null
        )}, ${regexLiteral(entry.regex || null)})`
    )
    .join(",\n    ");

  return `VALUES\n    ${rows}`;
}

function whitelistMatchSql(alias, emailExpression = `${alias}.email`) {
  return `EXISTS (
    SELECT 1
    FROM staging_whitelist sw
    WHERE (sw.id IS NOT NULL AND ${alias}.id = sw.id)
       OR (sw.email IS NOT NULL AND lower(${emailExpression}) = lower(sw.email))
       OR (sw.regex IS NOT NULL AND ${emailExpression} ~* sw.regex)
  )`;
}

function whitelistTempTableSql(whitelist) {
  return `
CREATE TEMP TABLE staging_whitelist (
  id uuid,
  email text,
  regex text
) ON COMMIT DROP;

INSERT INTO staging_whitelist (id, email, regex)
SELECT id, email, regex
FROM (${whitelistValuesSql(whitelist)}) AS entries(id, email, regex);
`;
}

async function run(command, args, options = {}) {
  const label = options.label ?? command;
  console.log(`Running ${label}...`);
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "inherit", "inherit"],
    });

    child.on("error", rejectRun);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${label} failed with exit code ${code}`));
      }
    });
  });
}

async function runPsql(databaseUrl, sqlPath, label) {
  await run(
    "psql",
    [
      "--set=ON_ERROR_STOP=1",
      "--no-psqlrc",
      "--quiet",
      databaseUrl,
      "--file",
      sqlPath,
    ],
    { label }
  );
}

async function verifySmtpSafety(stagingSupabaseUrl) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN for read-only staging SMTP preflight."
    );
  }

  const projectRef = parseProjectRefFromSupabaseUrl(stagingSupabaseUrl);
  if (!projectRef) {
    throw new Error("Could not parse staging Supabase project ref.");
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Supabase auth config preflight failed with HTTP ${response.status}.`
    );
  }

  const config = await response.json();
  const smtpHost = typeof config.smtp_host === "string" ? config.smtp_host : "";
  const safeHostPattern = process.env.STAGING_SMTP_SAFE_HOST_PATTERN?.trim();
  const allowDisabledBuiltIn =
    process.env.STAGING_SMTP_BUILT_IN_DISABLED === "true";

  if (smtpHost) {
    if (!safeHostPattern) {
      throw new Error(
        "Staging custom SMTP is configured, but STAGING_SMTP_SAFE_HOST_PATTERN is not set."
      );
    }

    const pattern = new RegExp(safeHostPattern, "i");
    if (!pattern.test(smtpHost)) {
      throw new Error(
        "Refusing to run because staging SMTP host is not in the safe null/catch-all allow-list."
      );
    }

    console.log("Staging SMTP preflight passed using an allow-listed host.");
    return;
  }

  if (!allowDisabledBuiltIn) {
    throw new Error(
      "Staging SMTP host is empty. Set STAGING_SMTP_BUILT_IN_DISABLED=true only after confirming built-in email delivery is disabled."
    );
  }

  console.log(
    "Staging SMTP preflight passed using disabled built-in email delivery assertion."
  );
}

function preRestoreSql() {
  return `
BEGIN;
CREATE TEMP TABLE public_tables_to_truncate AS
SELECT format('%I.%I', schemaname, tablename) AS table_name
FROM pg_tables
WHERE schemaname = 'public';

DO $$
DECLARE
  table_list text;
BEGIN
  SELECT string_agg(table_name, ', ')
  INTO table_list
  FROM public_tables_to_truncate;

  IF table_list IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || table_list || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

TRUNCATE TABLE auth.users CASCADE;
ALTER TABLE auth.users DISABLE TRIGGER ALL;
COMMIT;
`;
}

function disableAuthTriggersSql() {
  return "ALTER TABLE auth.users DISABLE TRIGGER ALL;\n";
}

function sanitizeAndValidateSql(whitelist) {
  const userWhitelistMatch = whitelistMatchSql("u");
  const profileWhitelistMatch = whitelistMatchSql("p", "p.email");

  return `
BEGIN;
${whitelistTempTableSql(whitelist)}

ALTER TABLE auth.users DISABLE TRIGGER ALL;

UPDATE auth.users AS u
SET
  email = 'scrubbed-' || u.id::text || '@${STAGING_EMAIL_DOMAIN}',
  phone = NULL,
  raw_user_meta_data = '{}'::jsonb,
  raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
  email_change = NULL,
  encrypted_password = ${sqlLiteral(DISABLED_PASSWORD_HASH)},
  confirmation_token = NULL,
  recovery_token = NULL,
  email_change_token_new = NULL,
  email_change_token_current = NULL,
  reauthentication_token = NULL,
  updated_at = now()
WHERE NOT (${userWhitelistMatch});

UPDATE public.user_profile AS p
SET
  name = 'Staging User ' || left(p.id::text, 8),
  email = 'scrubbed-' || p.id::text || '@${STAGING_EMAIL_DOMAIN}',
  phone = NULL,
  phone_verified = NULL,
  avatar_url = NULL,
  last_modified_at = now()::text
WHERE NOT (${profileWhitelistMatch});

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*)
  INTO bad_count
  FROM auth.users AS u
  WHERE NOT (${userWhitelistMatch})
    AND u.email !~* ('^[^@]+@${STAGING_EMAIL_DOMAIN.replaceAll(".", "\\.")}$');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Non-whitelisted auth.users rows retained unsafe emails: %', bad_count;
  END IF;

  SELECT count(*)
  INTO bad_count
  FROM auth.users AS u
  WHERE NOT (${userWhitelistMatch})
    AND (
      coalesce(u.raw_user_meta_data::text, '') ~* ${sqlLiteral(EMAIL_REGEX)}
      OR coalesce(u.raw_app_meta_data::text, '') ~* ${sqlLiteral(EMAIL_REGEX)}
    );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Non-whitelisted auth.users metadata retained email-shaped strings: %', bad_count;
  END IF;

  SELECT count(*)
  INTO bad_count
  FROM public.user_profile AS p
  WHERE NOT (${profileWhitelistMatch})
    AND (
      p.email !~* ('^[^@]+@${STAGING_EMAIL_DOMAIN.replaceAll(".", "\\.")}$')
      OR p.phone IS NOT NULL
      OR p.phone_verified IS NOT NULL
      OR p.avatar_url IS NOT NULL
      OR p.name !~ '^Staging User '
    );
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Non-whitelisted public.user_profile rows retained PII-looking values: %', bad_count;
  END IF;

  SELECT count(*)
  INTO bad_count
  FROM auth.identities AS i
  LEFT JOIN staging_whitelist AS sw ON sw.id IS NOT NULL AND i.user_id = sw.id
  WHERE sw.id IS NULL;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'auth.identities contains non-whitelisted rows after restore: %', bad_count;
  END IF;
END $$;

ALTER TABLE auth.users ENABLE TRIGGER ALL;
COMMIT;
`;
}

function cleanupSql(whitelist) {
  const userWhitelistMatch = whitelistMatchSql("u");
  return `
BEGIN;
${whitelistTempTableSql(whitelist)}
ALTER TABLE auth.users DISABLE TRIGGER ALL;
DELETE FROM auth.users AS u
WHERE NOT (${userWhitelistMatch});
ALTER TABLE auth.users ENABLE TRIGGER ALL;
COMMIT;
`;
}

async function main() {
  const sourceEnv = requireEnv("SOURCE_ENV");
  const targetEnv = requireEnv("TARGET_ENV");
  const sourceDatabaseUrl = requireEnv("PRODUCTION_DATABASE_URL");
  const targetDatabaseUrl = env(
    "STAGING_DATABASE_URL",
    process.env.DATABASE_URL
  );
  const stagingSupabaseUrl = requireEnv("SUPABASE_URL");
  const productionSupabaseUrl = requireEnv("PRODUCTION_SUPABASE_URL");

  if (!targetDatabaseUrl) {
    throw new Error("Missing STAGING_DATABASE_URL or DATABASE_URL.");
  }

  if (sourceEnv !== "production") {
    throw new Error("Refusing to run unless SOURCE_ENV=production.");
  }

  if (targetEnv !== "staging") {
    throw new Error("Refusing to run unless TARGET_ENV=staging.");
  }

  const sourceRef =
    parseProjectRefFromDatabaseUrl(sourceDatabaseUrl) ??
    parseProjectRefFromSupabaseUrl(productionSupabaseUrl);
  const targetRef =
    parseProjectRefFromDatabaseUrl(targetDatabaseUrl) ??
    parseProjectRefFromSupabaseUrl(stagingSupabaseUrl);

  if (!sourceRef || !targetRef) {
    throw new Error("Could not parse source/target Supabase project refs.");
  }

  console.log(`Source project ref: ${sourceRef}`);
  console.log(`Target project ref: ${targetRef}`);

  if (sourceRef === targetRef) {
    throw new Error(
      "Refusing to run because source and target project refs match."
    );
  }

  if (stagingSupabaseUrl === productionSupabaseUrl) {
    throw new Error(
      "Refusing to run because staging and production Supabase URLs match."
    );
  }

  const whitelistPath = resolve(
    process.env.STAGING_WHITELIST_PATH ?? "config/staging-whitelist.json"
  );
  const whitelist = await readWhitelist(whitelistPath);
  await verifySmtpSafety(stagingSupabaseUrl);

  const workDir = await mkdtemp(join(tmpdir(), "tunetrees-staging-refresh-"));
  const publicDump = join(workDir, "public.sql");
  const authUsersDump = join(workDir, "auth-users.sql");
  const combinedDump = join(workDir, "combined.sql");
  const preRestorePath = join(workDir, "pre-restore.sql");
  const disablePath = join(workDir, "disable-auth-triggers.sql");
  const sanitizePath = join(workDir, "sanitize.sql");
  const cleanupPath = join(workDir, "cleanup.sql");

  try {
    await writeFile(preRestorePath, preRestoreSql());
    await writeFile(disablePath, disableAuthTriggersSql());
    await writeFile(sanitizePath, sanitizeAndValidateSql(whitelist));
    await writeFile(cleanupPath, cleanupSql(whitelist));

    await run("pg_dump", [
      "--data-only",
      "--no-owner",
      "--no-acl",
      "--disable-triggers",
      "-n",
      "public",
      "--file",
      publicDump,
      sourceDatabaseUrl,
    ]);
    await run("pg_dump", [
      "--data-only",
      "--no-owner",
      "--no-acl",
      "--disable-triggers",
      "-t",
      "auth.users",
      "--file",
      authUsersDump,
      sourceDatabaseUrl,
    ]);

    const authSql = await readFile(authUsersDump, "utf8");
    const publicSql = await readFile(publicDump, "utf8");
    await writeFile(combinedDump, `${authSql}\n${publicSql}`);

    await runPsql(
      targetDatabaseUrl,
      preRestorePath,
      "pre-restore staging cleanup"
    );
    await run("psql", [
      "--set=ON_ERROR_STOP=1",
      "--no-psqlrc",
      "--quiet",
      "--single-transaction",
      targetDatabaseUrl,
      "--file",
      combinedDump,
    ]);
    await runPsql(
      targetDatabaseUrl,
      disablePath,
      "post-restore auth trigger isolation"
    );
    await runPsql(
      targetDatabaseUrl,
      sanitizePath,
      "staging sanitization and validation"
    );

    console.log(
      "Staging database refresh, sanitization, and validation completed."
    );
  } catch (error) {
    console.error(
      "Staging refresh failed. Running fail-safe auth.users cleanup before exiting."
    );
    try {
      await runPsql(
        targetDatabaseUrl,
        cleanupPath,
        "fail-safe auth.users cleanup"
      );
    } catch (cleanupError) {
      console.error("Fail-safe cleanup also failed:", cleanupError);
    }
    throw error;
  } finally {
    if (process.env.KEEP_STAGING_REFRESH_WORKDIR !== "true") {
      await rm(workDir, { recursive: true, force: true });
    } else {
      console.log(`Keeping staging refresh work directory: ${workDir}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
