#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import bcrypt from "bcryptjs";

// Hash for a deliberately disabled staging account — not a live credential.
const DISABLED_PASSWORD_HASH =
  "$2b$10$yu1qMLlp6nvy/RyZ55VF/O/UMK.UpzqO0dTH3pO/.KBUi4Um4NKBe"; // NOSONAR: hash for a deliberately disabled account, not a live credential
const STAGING_EMAIL_DOMAIN = "staging.tunetrees.com";
const EMAIL_REGEX = String.raw`[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}`;

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
    throw new TypeError("Staging whitelist must be a JSON array.");
  }

  return parsed.map((entry, index) => {
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`Whitelist entry ${index} must be an object.`);
    }

    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const email = typeof entry.email === "string" ? entry.email.trim() : "";
    const regex = typeof entry.regex === "string" ? entry.regex.trim() : "";

    // Validate regex syntax early so bad patterns don't surface as opaque
    // PostgreSQL errors later.  Note: JS and PG regex dialects differ, so
    // this is a best-effort check; a passing test does not guarantee PG
    // compatibility, but it catches most typos and unbalanced tokens.
    if (regex) {
      try {
        new RegExp(regex);
      } catch (err) {
        throw new Error(
          `Whitelist entry ${index} regex "${regex}" is not a valid pattern: ${err.message}`
        );
      }
    }

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
    .map((entry) => {
      const idPart = entry.id ? `${sqlLiteral(entry.id)}::uuid` : "NULL::uuid";
      return `(${idPart}, ${sqlLiteral(
        entry.email || null
      )}, ${regexLiteral(entry.regex || null)})`;
    })
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

function whitelistMatchesUser(whitelist, id, email) {
  return whitelist.some((entry) => {
    if (entry.id && id === entry.id) {
      return true;
    }
    if (entry.email && email?.toLowerCase() === entry.email.toLowerCase()) {
      return true;
    }
    return Boolean(
      entry.regex && email && new RegExp(entry.regex, "i").test(email)
    );
  });
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

function whitelistSeedSql(whitelist, passwordHash) {
  const seedUsers = whitelist.filter((entry) => entry.id && entry.email);
  if (seedUsers.length === 0) {
    return "";
  }

  const rows = seedUsers
    .map(
      (entry) =>
        `(${sqlLiteral(entry.id)}::uuid, ${sqlLiteral(entry.email)}, ${sqlLiteral(
          passwordHash
        )})`
    )
    .join(",\n    ");

  return `
CREATE TEMP TABLE staging_seed_users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL
) ON COMMIT DROP;

INSERT INTO staging_seed_users (id, email, password_hash)
VALUES
    ${rows};

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  reauthentication_token,
  phone_change,
  phone_change_token,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  s.id,
  'authenticated',
  'authenticated',
  s.email,
  s.password_hash,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('email', s.email),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  now(),
  now(),
  false,
  false
FROM staging_seed_users AS s
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profile (
  id,
  name,
  email,
  sync_version,
  last_modified_at,
  deleted
)
SELECT
  s.id,
  initcap(split_part(s.email, '@', 1)),
  s.email,
  1,
  now(),
  false
FROM staging_seed_users AS s
ON CONFLICT (id) DO NOTHING;
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

function verifySmtpSafety() {
  const smtpHost = process.env.SUPABASE_SMTP_HOST?.trim() ?? "";
  const safeHostPattern = process.env.STAGING_SMTP_SAFE_HOST_PATTERN?.trim();

  if (!smtpHost) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SMTP_HOST"
    );
  }

  if (!safeHostPattern) {
    throw new Error(
      "Missing required environment variable: STAGING_SMTP_SAFE_HOST_PATTERN"
    );
  }

  let pattern;
  try {
    pattern = new RegExp(safeHostPattern, "i");
  } catch (error) {
    throw new Error(
      `STAGING_SMTP_SAFE_HOST_PATTERN contains invalid regex syntax: ${error.message}`
    );
  }

  if (!pattern.test(smtpHost)) {
    throw new Error(
      "Refusing to run because SUPABASE_SMTP_HOST does not match STAGING_SMTP_SAFE_HOST_PATTERN."
    );
  }

  console.log(
    "Staging SMTP preflight passed using locally asserted allow-listed host."
  );
}

function unescapeCopyValue(value) {
  if (value === String.raw`\N`) {
    return null;
  }

  return value.replace(/\\([bfnrtv\\])/g, (_match, escaped) => {
    switch (escaped) {
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "v":
        return "\v";
      case "\\":
        return "\\";
      default:
        return escaped;
    }
  });
}

function escapeCopyValue(value) {
  if (value == null) {
    return String.raw`\N`;
  }

  return String(value)
    .replaceAll("\\", String.raw`\\`)
    .replaceAll("\b", String.raw`\b`)
    .replaceAll("\f", String.raw`\f`)
    .replaceAll("\n", String.raw`\n`)
    .replaceAll("\r", String.raw`\r`)
    .replaceAll("\t", String.raw`\t`)
    .replaceAll("\v", String.raw`\v`);
}

function parseCopyColumns(copyHeader) {
  const match =
    /^COPY\s+(?:(?:"auth"|auth)\.)?(?:"users"|users)\s+\((.*)\)\s+FROM\s+stdin;$/i.exec(
      copyHeader
    );
  if (!match) {
    return null;
  }

  return match[1].split(",").map((column) => {
    const trimmed = column.trim();
    return trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1).replaceAll('""', '"')
      : trimmed;
  });
}

function parseCopyTable(copyHeader) {
  // Two-step parse to stay under the Sonar regex-complexity limit:
  //  1) capture the non-whitespace identifier before the opening paren
  //  2) split on '.' and unquote each part
  // Also reject lines missing the FROM stdin; suffix.
  const identMatch = /^COPY\s+(\S+)\s+\(/i.exec(copyHeader);
  if (!identMatch || !/FROM\s+stdin;$/i.test(copyHeader)) {
    return null;
  }

  const ident = identMatch[1];
  const dotIdx = ident.indexOf(".");
  if (dotIdx < 0) {
    return { schema: "public", table: unquoteIdent(ident) };
  }

  return {
    schema: unquoteIdent(ident.slice(0, dotIdx)),
    table: unquoteIdent(ident.slice(dotIdx + 1)),
  };
}

/** Strip surrounding double-quotes and unescape embedded "". */
function unquoteIdent(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }
  return trimmed;
}

function extractCopyTables(sql) {
  const seen = new Set();
  const tables = [];

  for (const line of sql.split("\n")) {
    const table = parseCopyTable(line);
    if (!table) {
      continue;
    }

    const key = `${table.schema}.${table.table}`;
    if (!seen.has(key)) {
      seen.add(key);
      tables.push(table);
    }
  }

  return tables;
}

function schemaPreflightSql(tables) {
  const rows = tables
    .map(
      ({ schema, table }) =>
        `(${sqlLiteral(schema)}, ${sqlLiteral(table)}, ${sqlLiteral(
          `${schema}.${table}`
        )})`
    )
    .join(",\n    ");

  return `
DO $$
DECLARE
  missing_tables text;
BEGIN
  WITH expected(schema_name, table_name, regclass_name) AS (
    VALUES
    ${rows}
  )
  SELECT string_agg(format('%I.%I', schema_name, table_name), ', ')
  INTO missing_tables
  FROM expected
  WHERE to_regclass(regclass_name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Staging schema is missing required table(s): %. Apply TuneTrees migrations to staging before running db:staging:refresh.', missing_tables;
  END IF;
END $$;
`;
}

function setCopyField(row, columnIndexes, columnName, value) {
  const index = columnIndexes.get(columnName);
  if (index !== undefined) {
    row[index] = value;
  }
}

/** Build a Map from column name to array index. */
function columnIndexMap(columns) {
  return new Map(columns.map((column, index) => [column, index]));
}

/** Throw if any required column is missing from the parsed COPY header. */
function assertRequiredColumns(columnIndexes, required) {
  for (const column of required) {
    if (!columnIndexes.has(column)) {
      throw new Error(
        `auth.users dump is missing required sanitization column: ${column}`
      );
    }
  }
}

/** Overwrite row fields with scrubbed staging-safe values in-place. */
function scrubAuthRow(row, colIdx, userId) {
  setCopyField(
    row,
    colIdx,
    "email",
    `scrubbed-${userId}@${STAGING_EMAIL_DOMAIN}`
  );
  setCopyField(row, colIdx, "phone", null);
  setCopyField(row, colIdx, "phone_change", "");
  setCopyField(row, colIdx, "raw_user_meta_data", "{}");
  setCopyField(
    row,
    colIdx,
    "raw_app_meta_data",
    '{"provider":"email","providers":["email"]}'
  );
  setCopyField(row, colIdx, "email_change", "");
  setCopyField(row, colIdx, "encrypted_password", DISABLED_PASSWORD_HASH);
  setCopyField(row, colIdx, "confirmation_token", "");
  setCopyField(row, colIdx, "recovery_token", "");
  setCopyField(row, colIdx, "email_change_token_new", "");
  setCopyField(row, colIdx, "email_change_token_current", "");
  setCopyField(row, colIdx, "reauthentication_token", "");
  setCopyField(row, colIdx, "phone_change_token", "");
}

function sanitizeAuthUsersDump(authSql, whitelist) {
  const lines = authSql.split("\n");
  const output = [];
  let columns = null;
  let columnIndexes = null;
  let foundAuthUsersCopy = false;
  let sanitizedRows = 0;
  const requiredColumns = [
    "id",
    "email",
    "phone",
    "raw_user_meta_data",
    "raw_app_meta_data",
    "email_change",
    "encrypted_password",
    "phone_change",
    "phone_change_token",
    "confirmation_token",
    "recovery_token",
    "email_change_token_new",
    "email_change_token_current",
    "reauthentication_token",
  ];

  for (const line of lines) {
    if (!columns) {
      const parsedColumns = parseCopyColumns(line);
      if (parsedColumns) {
        columns = parsedColumns;
        columnIndexes = columnIndexMap(parsedColumns);
        foundAuthUsersCopy = true;
        assertRequiredColumns(columnIndexes, requiredColumns);
      }
      output.push(line);
      continue;
    }

    if (line === String.raw`\.`) {
      columns = null;
      columnIndexes = null;
      output.push(line);
      continue;
    }

    if (line === "") {
      output.push(line);
      continue;
    }

    if (processAuthCopyRow(line, columns, columnIndexes, whitelist, output)) {
      sanitizedRows += 1;
    }
  }

  if (!foundAuthUsersCopy) {
    throw new Error("Could not find auth.users COPY block in auth dump.");
  }

  if (sanitizedRows > 0) {
    console.log(`Sanitized ${sanitizedRows} auth.users rows before restore.`);
  }

  return output.join("\n");
}

/** Parse a single COPY data line, optionally scrub, and append to output.
 *  Returns true if the row was scrubbed. */
function processAuthCopyRow(line, columns, columnIndexes, whitelist, output) {
  const row = line.split("\t").map(unescapeCopyValue);
  if (row.length !== columns.length) {
    throw new Error("auth.users COPY row does not match column count.");
  }

  const id = row[columnIndexes.get("id")] ?? "";
  const email = row[columnIndexes.get("email")] ?? "";
  const scrubbed = !whitelistMatchesUser(whitelist, id, email);
  if (scrubbed) {
    scrubAuthRow(row, columnIndexes, id);
  }

  output.push(row.map(escapeCopyValue).join("\t"));
  return scrubbed;
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
COMMIT;
`;
}

function sanitizeAndValidateSql(whitelist, stagingPasswordHash) {
  const userWhitelistMatch = whitelistMatchSql("u");
  const profileWhitelistMatch = whitelistMatchSql("p", "p.email");

  return `
BEGIN;
${whitelistTempTableSql(whitelist)}
${whitelistSeedSql(whitelist, stagingPasswordHash)}

UPDATE public.user_profile AS p
SET
  name = 'Staging User ' || left(p.id::text, 8),
  email = 'scrubbed-' || p.id::text || '@${STAGING_EMAIL_DOMAIN}',
  phone = NULL,
  phone_verified = NULL,
  avatar_url = NULL,
  last_modified_at = now()
WHERE NOT (${profileWhitelistMatch});

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  coalesce(u.created_at, now()),
  now()
FROM auth.users AS u
ON CONFLICT (provider_id, provider) DO UPDATE
SET
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*)
  INTO bad_count
  FROM auth.users AS u
  WHERE NOT (${userWhitelistMatch})
    AND u.email !~* ('^[^@]+@${STAGING_EMAIL_DOMAIN.replaceAll(".", String.raw`\.`)}$');
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
  FROM auth.users AS u
  WHERE u.confirmation_token IS NULL
     OR u.recovery_token IS NULL
     OR u.email_change_token_new IS NULL
     OR u.email_change_token_current IS NULL
     OR u.email_change IS NULL
     OR u.reauthentication_token IS NULL
     OR u.phone_change IS NULL
     OR u.phone_change_token IS NULL;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'auth.users contains NULL GoTrue string token fields that break password login: %', bad_count;
  END IF;

  SELECT count(*)
  INTO bad_count
  FROM public.user_profile AS p
  WHERE NOT (${profileWhitelistMatch})
    AND (
      p.email !~* ('^[^@]+@${STAGING_EMAIL_DOMAIN.replaceAll(".", String.raw`\.`)}')
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
  LEFT JOIN auth.users AS u ON u.id = i.user_id
  WHERE u.id IS NULL
    OR i.provider <> 'email'
    OR i.provider_id <> i.user_id::text
    OR i.identity_data->>'email' IS DISTINCT FROM u.email
    OR i.identity_data::text ~* ${sqlLiteral(EMAIL_REGEX)}
       AND i.identity_data->>'email' !~* ('^[^@]+@${STAGING_EMAIL_DOMAIN.replaceAll(".", String.raw`\.`)}$')
       AND NOT (${whitelistMatchSql("u")});
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'auth.identities contains unsafe or non-email staging rows: %', bad_count;
  END IF;

  SELECT count(*)
  INTO bad_count
  FROM auth.users AS u
  LEFT JOIN auth.identities AS i
    ON i.user_id = u.id
   AND i.provider = 'email'
   AND i.provider_id = u.id::text
  WHERE i.id IS NULL;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'auth.users rows missing synthesized email identities: %', bad_count;
  END IF;
END $$;
COMMIT;
`;
}

function cleanupSql(whitelist) {
  const userWhitelistMatch = whitelistMatchSql("u");
  return `
BEGIN;
${whitelistTempTableSql(whitelist)}
DELETE FROM auth.users AS u
WHERE NOT (${userWhitelistMatch});
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
  const stagingTestUserPassword = env(
    "STAGING_TEST_USER_PASSWORD",
    process.env.ALICE_TEST_PASSWORD
  );
  if (!stagingTestUserPassword) {
    throw new Error(
      "Missing STAGING_TEST_USER_PASSWORD or ALICE_TEST_PASSWORD for whitelisted staging test users."
    );
  }
  const stagingTestUserPasswordHash = bcrypt.hashSync(
    stagingTestUserPassword,
    10
  );
  verifySmtpSafety();

  const workDir = await mkdtemp(join(tmpdir(), "tunetrees-staging-refresh-"));
  const publicDump = join(workDir, "public.sql");
  const authUsersDump = join(workDir, "auth-users.sql");
  const combinedDump = join(workDir, "combined.sql");
  const schemaPreflightPath = join(workDir, "schema-preflight.sql");
  const preRestorePath = join(workDir, "pre-restore.sql");
  const sanitizePath = join(workDir, "sanitize.sql");
  const cleanupPath = join(workDir, "cleanup.sql");

  try {
    await writeFile(preRestorePath, preRestoreSql());
    await writeFile(
      sanitizePath,
      sanitizeAndValidateSql(whitelist, stagingTestUserPasswordHash)
    );
    await writeFile(cleanupPath, cleanupSql(whitelist));

    await run("pg_dump", [
      "--data-only",
      "--no-owner",
      "--no-acl",
      "-n",
      "public",
      "--exclude-table=public.sync_change_log",
      "--file",
      publicDump,
      sourceDatabaseUrl,
    ]);
    await run("pg_dump", [
      "--data-only",
      "--no-owner",
      "--no-acl",
      "-t",
      "auth.users",
      "--file",
      authUsersDump,
      sourceDatabaseUrl,
    ]);

    const authSql = sanitizeAuthUsersDump(
      await readFile(authUsersDump, "utf8"),
      whitelist
    );
    const publicSql = await readFile(publicDump, "utf8");
    const expectedTables = [
      { schema: "auth", table: "users" },
      ...extractCopyTables(publicSql).filter(
        ({ schema }) => schema === "public"
      ),
    ];
    await writeFile(schemaPreflightPath, schemaPreflightSql(expectedTables));
    await writeFile(combinedDump, `${authSql}\n${publicSql}`);

    await runPsql(
      targetDatabaseUrl,
      schemaPreflightPath,
      "staging schema preflight"
    );
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
    if (process.env.KEEP_STAGING_REFRESH_WORKDIR === "true") {
      console.log(`Keeping staging refresh work directory: ${workDir}`);
    } else {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
