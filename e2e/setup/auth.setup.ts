/**
 * e2e/setup/auth.setup.ts
 *
 * Playwright setup project that authenticates all 8 test users and saves
 * their auth state to `e2e/.auth/<key>.json`.
 *
 * Run to regenerate all auth files:
 *   RESET_DB=true npm run test:e2e -- --project=setup
 *   # or regenerate tokens without clearing DB rows:
 *   npm run test:e2e -- --project=setup
 *
 * Prerequisites:
 *   - The shared local Supabase instance must be running (`supabase start`).
 *   - The app dev server must be running with MODE=test (or Playwright's
 *     webServer config spins it up automatically).
 *   - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *     must be set (via `op run --env-file=".env.local.template"` locally or
 *     CI secrets in production).
 *
 * IMPORTANT: Never call `supabase db reset` here. The shared Supabase instance
 * is multi-tenant (TuneTrees + CubeFSRS). Use `resetTunetreesUserData()` which
 * truncates only the user-scoped TuneTrees `public` schema rows.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config, parse } from "dotenv";
import postgres from "postgres";
import {
  AUTH_STATE_DB_VERSION_STORAGE_KEY,
  AUTH_STATE_SNAPSHOT_VERSION_STORAGE_KEY,
  CURRENT_AUTH_STATE_DB_VERSION,
  CURRENT_AUTH_STATE_SNAPSHOT_VERSION,
  readStoredAuthStateMetadata,
} from "../helpers/auth-state";
import { TEST_USERS } from "../helpers/test-users";
import { BASE_URL } from "../test-config";

// Load .env.local as a convenience for local dev. No-op in CI where secrets
// are injected via `op run` or GitHub Actions environment variables.
config({ path: ".env.local", quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const ENV_TEMPLATE_PATH = resolve(REPO_ROOT, ".env.local.template");
const E2E_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Auth state files live in e2e/.auth/ (gitignored) */
const AUTH_DIR = resolve(__dirname, "../.auth");

/**
 * TuneTrees user-scoped tables in the `public` Postgres schema.
 * These are safe to truncate on RESET_DB because they contain only per-user data.
 *
 * NEVER add catalog/reference tables here: tune, genre, genre_tune_type, goal,
 * instrument, tune_type, sync_change_log.
 *
 * Deletion order matters: practice_record and repertoire_tune reference
 * repertoire (no direct user column), so they must be deleted before repertoire.
 */
const TUNETREES_USER_TABLES_BY_USER_REF = [
  "daily_practice_queue",
  "note",
  "plugin",
  "reference",
  "tag",
  "tune_override",
] as const;

const TUNETREES_USER_TABLES_BY_USER_ID = [
  "prefs_scheduling_options",
  "prefs_spaced_repetition",
  "tab_group_main_state",
  "table_state",
  "table_transient_data",
  "user_genre_selection",
] as const;

/**
 * Tables that reference repertoire rather than having a direct user column.
 * Must be deleted BEFORE deleting from repertoire.
 */
const TUNETREES_REPERTOIRE_CHILD_TABLES = [
  "practice_record",
  "repertoire_tune",
] as const;

/** Minimum remaining validity before we consider the snapshot stale. */
const AUTH_EXPIRY_SAFETY_WINDOW_MS = 5 * 60 * 1000;

function getRequiredTestPassword(): string {
  const value =
    process.env.TEST_USER_PASSWORD ?? process.env.ALICE_TEST_PASSWORD;

  if (value && value.trim().length > 0) {
    return value;
  }

  throw new Error(
    "[auth.setup] Missing TEST_USER_PASSWORD or ALICE_TEST_PASSWORD environment variable."
  );
}

// -- helpers ------------------------------------------------------------------

function ensureAuthDir(): void {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }
}

function hasEnvValue(key: string): boolean {
  const value = process.env[key];
  return value != null && value.trim().length > 0;
}

function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  return /https?:\/\/(127\.0\.0\.1|localhost):54321\/?$/i.test(url);
}

function getLocalSupabaseServiceRoleKey(): string {
  try {
    const statusJson = execFileSync(
      "supabase",
      ["status", "--output", "json"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      }
    );
    const status = JSON.parse(statusJson) as { SERVICE_ROLE_KEY?: string };
    const serviceRoleKey = status.SERVICE_ROLE_KEY?.trim();

    if (!serviceRoleKey) {
      throw new Error(
        "SERVICE_ROLE_KEY missing from `supabase status --output json`"
      );
    }

    return serviceRoleKey;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[auth.setup] Failed to get local Supabase service role key from \`supabase status\`: ${message}`
    );
  }
}

function resolveResetServiceRoleKey(): string {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (isLocalSupabaseUrl(supabaseUrl) && !process.env.CI) {
    const localServiceRoleKey = getLocalSupabaseServiceRoleKey();

    if (envKey !== localServiceRoleKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = localServiceRoleKey;
      console.log(
        "ℹ️  Using SUPABASE_SERVICE_ROLE_KEY from local `supabase status` for RESET_DB"
      );
    }

    return localServiceRoleKey;
  }

  if (envKey) {
    return envKey;
  }

  throw new Error(
    "[auth.setup] RESET_DB=true requires SUPABASE_SERVICE_ROLE_KEY to be set."
  );
}

async function clearPracticeRecordsForRepertoires(
  repertoireIds: string[]
): Promise<void> {
  if (repertoireIds.length === 0) {
    return;
  }

  const sql = postgres(E2E_DATABASE_URL, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe(
        "SELECT set_config('app.allow_practice_record_delete', 'on', true)"
      );
      await transaction.unsafe(
        `
        DELETE FROM public.practice_record
        WHERE repertoire_ref = ANY($1::uuid[])
      `,
        [repertoireIds]
      );
    });
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
}

function resolveTemplateEnv(
  templateEnv: Record<string, string>
): Record<string, string> {
  const missingEntries = Object.entries(templateEnv).filter(
    ([key, value]) => !hasEnvValue(key) && value.trim().length > 0
  );

  if (missingEntries.length === 0) {
    return {};
  }

  const injectTemplate = missingEntries
    .map(([key, value]) => {
      const templateValue = value.startsWith("op://")
        ? `{{ ${value} }}`
        : value;
      return `${key}=${JSON.stringify(templateValue)}`;
    })
    .join("\n");

  let injectedEnvFile: string;
  try {
    injectedEnvFile = execFileSync(
      "sh",
      ["-lc", 'printf %s "$OP_INJECT_TEMPLATE" | op inject'],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          OP_INJECT_TEMPLATE: injectTemplate,
        },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[auth.setup] Failed to resolve env template via 1Password CLI: ${message}`
    );
  }

  return parse(injectedEnvFile);
}

/**
 * When this file is run directly instead of via the standard npm scripts,
 * populate missing env vars through 1Password CLI so setup remains portable.
 */
function injectOpEnvIfNeeded(): void {
  if (hasEnvValue("VITE_SUPABASE_ANON_KEY")) {
    return;
  }

  if (!existsSync(ENV_TEMPLATE_PATH)) {
    throw new Error(
      `[auth.setup] Missing env template at ${ENV_TEMPLATE_PATH}.`
    );
  }

  const injectStartMs = Date.now();
  try {
    const templateEnv = parse(readFileSync(ENV_TEMPLATE_PATH, "utf8"));
    const resolvedEnv = resolveTemplateEnv(templateEnv);
    for (const [key, value] of Object.entries(resolvedEnv)) {
      if (!hasEnvValue(key) && value.trim().length > 0) {
        process.env[key] = value;
      }
    }
  } finally {
    console.log(
      `ℹ️  Environment bootstrap resolution took ${Date.now() - injectStartMs}ms`
    );
  }

  if (!hasEnvValue("VITE_SUPABASE_ANON_KEY")) {
    throw new Error(
      "[auth.setup] Automatic env bootstrap completed, but " +
        "VITE_SUPABASE_ANON_KEY is still missing."
    );
  }

  console.log(
    "ℹ️  Injected environment variables via 1Password CLI because " +
      "VITE_SUPABASE_ANON_KEY was missing"
  );
}

/**
 * Returns true when a saved auth state file is valid and does not need to be
 * regenerated. Checks:
 *   1. File exists and can be parsed
 *   2. Has an IndexedDB snapshot (local SQLite was persisted)
 *   3. Token has not expired (with safety buffer)
 *   4. Snapshot shape version matches CURRENT_AUTH_STATE_SNAPSHOT_VERSION
 *   5. DB schema version matches CURRENT_AUTH_STATE_DB_VERSION (if known)
 */
function isAuthFileFresh(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  const metadata = readStoredAuthStateMetadata(filePath);
  if (!metadata?.hasIndexedDbSnapshot) return false;
  if (metadata.expiresAtMs == null) return false;
  if (metadata.snapshotVersion !== CURRENT_AUTH_STATE_SNAPSHOT_VERSION) {
    return false;
  }
  if (
    CURRENT_AUTH_STATE_DB_VERSION != null &&
    metadata.dbVersion !== CURRENT_AUTH_STATE_DB_VERSION
  ) {
    return false;
  }
  return metadata.expiresAtMs - Date.now() > AUTH_EXPIRY_SAFETY_WINDOW_MS;
}

/**
 * Wait for the local tune catalog to be populated in the browser's SQLite DB.
 * Auth snapshots must include catalog data so tests can run seeded practice
 * scenarios immediately after restoring the session.
 */
async function waitForCatalogSnapshotReady(
  page: import("@playwright/test").Page,
  timeoutMs: number
): Promise<void> {
  console.log(
    `    [catalog] waiting for catalog snapshot (timeout=${timeoutMs}ms)`
  );
  // Log every 5s so we can see it's alive while Playwright is polling.
  const heartbeat = setInterval(() => {
    console.log(`    [catalog] still waiting for catalog snapshot...`);
  }, 5_000);
  try {
    // Each individual evaluation of the predicate resolves within 2 seconds
    // via Promise.race with a browser-side timer, so that CDP never blocks
    // indefinitely on a stalled async call. The outer timeout fires if we
    // still haven't seen a truthy return after timeoutMs total.
    await page.waitForFunction(
      () => {
        const api = (
          window as unknown as {
            __ttTestApi?: {
              getCatalogTuneCountsForUser: () => Promise<{
                total: number;
                filtered: number;
              }>;
            };
          }
        ).__ttTestApi;
        if (!api) return false;
        // Use Promise.race so each evaluation resolves in ≤2 s even if the
        // inner async call stalls. Playwright CDP awaits the returned Promise;
        // without this race, a hung getCatalogTuneCountsForUser() would prevent
        // the outer timeout from ever firing.
        return Promise.race([
          api
            .getCatalogTuneCountsForUser()
            .then((counts) => counts.total > 0)
            .catch(() => false),
          new Promise<false>((resolve) =>
            setTimeout(() => resolve(false), 2_000)
          ),
        ]);
      },
      { timeout: timeoutMs, polling: 500 }
    );
    console.log(`    [catalog] catalog snapshot ready!`);
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Delete all anonymous and ephemeral E2E auth users via the Supabase Admin
 * Auth API. This cascades into public.user_profile (and any other tables
 * backed by FK triggers) automatically.
 *
 * Targets:
 *   - Native Supabase anonymous users (is_anonymous = true).
 *   - Email accounts matching "anon-test-*@tunetrees.test" left behind by
 *     the anonymous account-conversion E2E tests.
 *
 * Named TEST_USERS are never touched; their IDs are excluded from the delete
 * set explicitly.
 */
async function deleteAnonAuthUsers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: ReturnType<typeof createClient<any>>
): Promise<void> {
  const namedTestUserIds = new Set(
    Object.values(TEST_USERS).map((u) => u.userId)
  );

  // Collect candidate anonymous auth user IDs via the Admin Auth API.
  // The Supabase JS admin.listUsers() is paginated; we iterate all pages.
  const anonUserIds: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(
        `[auth.setup] Failed to list auth users for anon cleanup (page ${page}): ${error.message}`
      );
    }

    const users = data?.users ?? [];

    for (const user of users) {
      if (namedTestUserIds.has(user.id)) continue;

      const isAnon = user.is_anonymous === true;
      const isEphemeralEmail = user.email?.endsWith("@tunetrees.test") === true;

      if (isAnon || isEphemeralEmail) {
        anonUserIds.push(user.id);
      }
    }

    // Stop when the page is smaller than perPage (last page).
    if (users.length < perPage) break;
    page++;
  }

  if (anonUserIds.length === 0) {
    console.log("    ℹ️  No anonymous/ephemeral auth users to delete.");
    return;
  }

  console.log(
    `    🗑️  Deleting ${anonUserIds.length} anonymous/ephemeral auth user(s)…`
  );

  for (const userId of anonUserIds) {
    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      // Warn rather than throw: a partially cleaned state is better than
      // aborting the entire reset.
      console.warn(
        `    ⚠️  Failed to delete auth user ${userId}: ${error.message}`
      );
    }
  }

  console.log(
    `  ✅ Deleted ${anonUserIds.length} anonymous/ephemeral auth user(s)`
  );
}

/**
 * Clear all user-owned TuneTrees data from Supabase Postgres for every test
 * user. Only called when RESET_DB=true. Never touches catalog tables (tune,
 * genre, etc.) or the sync_change_log system table.
 */
async function resetTunetreesUserData(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = resolveResetServiceRoleKey();

  if (!supabaseUrl) {
    throw new Error(
      "[auth.setup] RESET_DB=true requires VITE_SUPABASE_URL to be set."
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userIds = Object.values(TEST_USERS).map((u) => u.userId);

  // Step 1: gather all repertoire IDs for the test users so we can delete
  //         practice_record and repertoire_tune rows (which have no direct user_id).
  const { data: repertoires, error: repertoireQueryError } = await adminClient
    .from("repertoire")
    .select("repertoire_id")
    .in("user_ref", userIds);

  if (repertoireQueryError) {
    throw new Error(
      `[auth.setup] Failed to fetch repertoire IDs: ${repertoireQueryError.message}`
    );
  }

  const repertoireIds = (repertoires ?? []).map(
    (r: { repertoire_id: string }) => r.repertoire_id
  );

  // Step 2: delete repertoire child tables by repertoire_ref
  if (repertoireIds.length > 0) {
    for (const table of TUNETREES_REPERTOIRE_CHILD_TABLES) {
      if (table === "practice_record") {
        await clearPracticeRecordsForRepertoires(repertoireIds);

        console.log(
          `  ✅ Cleared public.practice_record for ${repertoireIds.length} repertoires`
        );
        continue;
      }

      const { error } = await adminClient
        .from(table)
        .delete()
        .in("repertoire_ref", repertoireIds);

      if (error) {
        throw new Error(
          `[auth.setup] Failed to clear public.${table}: ${error.message}`
        );
      }

      console.log(
        `  ✅ Cleared public.${table} for ${repertoireIds.length} repertoires`
      );
    }
  }

  // Step 3: delete tables with a direct user_ref column
  for (const table of TUNETREES_USER_TABLES_BY_USER_REF) {
    const { error } = await adminClient
      .from(table)
      .delete()
      .in("user_ref", userIds);

    if (error) {
      throw new Error(
        `[auth.setup] Failed to clear public.${table}: ${error.message}`
      );
    }

    console.log(`  ✅ Cleared public.${table} for ${userIds.length} users`);
  }

  // Step 4: delete tables with a direct user_id column
  for (const table of TUNETREES_USER_TABLES_BY_USER_ID) {
    const { error } = await adminClient
      .from(table)
      .delete()
      .in("user_id", userIds);

    if (error) {
      throw new Error(
        `[auth.setup] Failed to clear public.${table}: ${error.message}`
      );
    }

    console.log(`  ✅ Cleared public.${table} for ${userIds.length} users`);
  }

  // Step 5: delete repertoire rows (after children are gone)
  const { error: repertoireDeleteError } = await adminClient
    .from("repertoire")
    .delete()
    .in("user_ref", userIds);

  if (repertoireDeleteError) {
    throw new Error(
      `[auth.setup] Failed to clear public.repertoire: ${repertoireDeleteError.message}`
    );
  }

  console.log(`  ✅ Cleared public.repertoire for ${userIds.length} users`);

  // Step 5b: delete anonymous / ephemeral auth users BEFORE clearing
  // user_profile, so their cascade (auth.users → user_profile) removes anon
  // rows first. Named TEST_USERS are excluded; their auth.users rows stay.
  //
  // We target:
  //   1. Native anonymous users (is_anonymous = true in auth.users).
  //   2. Email accounts matching "*@tunetrees.test" left by account-conversion tests.
  console.log("  🗑️  Cleaning up anonymous / ephemeral auth users…");
  await deleteAnonAuthUsers(adminClient);

  // Step 5c: wipe ALL user_profile rows (and cascade to any remaining child
  // rows from non-TEST_USERS accounts such as real developer profiles in the
  // local DB). The JS client cannot issue a no-filter bulk DELETE, and even
  // the `.gt("id", …)` workaround fails if non-test users still have child
  // rows referencing user_profile (e.g. daily_practice_queue). Using
  // TRUNCATE … CASCADE via a direct postgres connection sidesteps both
  // issues: it handles FK ordering automatically and bypasses row-level
  // triggers (including the practice_record delete-guard trigger).
  const pgForTruncate = postgres(E2E_DATABASE_URL, { max: 1 });
  try {
    await pgForTruncate.unsafe("TRUNCATE public.user_profile CASCADE");
    console.log("  ✅ Truncated public.user_profile CASCADE (all users)");
  } finally {
    await pgForTruncate.end({ timeout: 5 }).catch(() => undefined);
  }
}

// -- main setup test ----------------------------------------------------------

/**
 * Authenticate all 8 test users and persist their auth state (including
 * IndexedDB) to e2e/.auth/<key>.json.
 */
setup("authenticate all test users", async ({ browser }) => {
  // 8 users × ~30s each (login + __ttTestApi wait + catalog sync) = ~240s worst
  // case on a cold start. 300s gives comfortable headroom without masking hangs.
  setup.setTimeout(300_000);

  injectOpEnvIfNeeded();

  ensureAuthDir();

  const shouldReset = process.env.RESET_DB === "true";
  const isCI = !!process.env.CI;

  // Optional DB reset — TuneTrees user rows only, never catalog tables
  if (shouldReset) {
    console.log("🗑️  RESET_DB=true — clearing TuneTrees user data in Supabase…");
    await resetTunetreesUserData();
    console.log("✅ TuneTrees user data cleared");
  } else {
    console.log("ℹ️  Skipping DB reset (set RESET_DB=true to clear test data)");
  }

  // Per-user auth flow
  for (const [userKey, testUser] of Object.entries(TEST_USERS)) {
    const authFile = `${AUTH_DIR}/${userKey}.json`;

    // Skip re-auth for users whose snapshot is still fresh (local dev only)
    if (!shouldReset && !isCI && isAuthFileFresh(authFile)) {
      const metadata = readStoredAuthStateMetadata(authFile);
      const remainingMinutes = metadata?.expiresAtMs
        ? Math.round((metadata.expiresAtMs - Date.now()) / 1000 / 60)
        : 0;
      console.log(
        `✅ [${testUser.name}] Using cached auth state (${remainingMinutes} min until expiry)`
      );
      continue;
    }

    console.log(`⏳ [${testUser.name}] Logging in as ${testUser.email}…`);

    // Each user gets an isolated browser context to avoid session bleed.
    // BASE_URL already has a trailing slash (e.g. "http://localhost:5173/"),
    // so we must NOT append another slash here or goto('/login') would produce "//login".
    const baseUrl = String(BASE_URL).replace(/\/$/, "");
    const context = await browser.newContext({
      baseURL: `${baseUrl}/`,
    });
    const page = await context.newPage();

    // Forward browser console messages so we can see what the app is doing
    // while waiting for auth/DB init without opening the browser.
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      // Skip noisy Vite HMR heartbeat pings
      if (text.includes("[vite]") && text.includes("connected")) return;
      console.log(`    [browser:${type}] ${text}`);
    });
    page.on("pageerror", (error) => {
      console.error(`    [browser:error] ${error.message}`);
    });

    try {
      // Step 1 — Navigate to login page (relative path; context baseURL is already set)
      console.log(
        `  [${testUser.name}] step 1: navigating to ${baseUrl}/login`
      );
      await page.goto("/login");
      console.log(
        `  [${testUser.name}] step 1: done (current url: ${page.url()})`
      );

      // Step 2 — Fill and submit credentials
      console.log(`  [${testUser.name}] step 2a: filling email`);
      await page.getByLabel("Email").fill(testUser.email);
      console.log(`  [${testUser.name}] step 2b: filling password`);
      await page.locator("input#password").fill(getRequiredTestPassword());
      console.log(`  [${testUser.name}] step 2c: clicking Sign In`);
      await page.getByRole("button", { name: "Sign In" }).click();
      console.log(`  [${testUser.name}] step 2: sign-in clicked`);

      // Step 3 — Wait for redirect away from /login
      console.log(
        `  [${testUser.name}] step 3: waiting for redirect away from /login`
      );
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 15_000,
      });
      console.log(`  [${testUser.name}] step 3: redirected to ${page.url()}`);

      // Step 4 — Wait for __ttTestApi to attach — signals auth + DB init complete
      console.log(
        `  [${testUser.name}] step 4: waiting for __ttTestApi to attach`
      );
      await page.waitForFunction(
        () =>
          (window as unknown as { __ttTestApi?: unknown }).__ttTestApi !==
          undefined,
        { timeout: 30_000 }
      );
      console.log(`  [${testUser.name}] step 4: __ttTestApi attached`);

      // Step 5 — Wait for the tune catalog to be populated in local SQLite
      console.log(`  [${testUser.name}] step 5: waiting for catalog snapshot`);
      await waitForCatalogSnapshotReady(page, 30_000);
      console.log(`  [${testUser.name}] step 5: catalog ready`);

      // Clear sync timestamps so tests start with a clean incremental baseline
      await page.evaluate(() => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("TT_LAST_SYNC_TIMESTAMP")) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }
      });

      // Record the DB schema version for post-migration staleness detection
      if (CURRENT_AUTH_STATE_DB_VERSION != null) {
        await page.evaluate(
          ({ key, value }) => {
            localStorage.setItem(key, String(value));
          },
          {
            key: AUTH_STATE_DB_VERSION_STORAGE_KEY,
            value: CURRENT_AUTH_STATE_DB_VERSION,
          }
        );
      }

      // Record snapshot shape version — bump CURRENT_AUTH_STATE_SNAPSHOT_VERSION
      // in auth-state.ts to force a global re-auth on the next run.
      await page.evaluate(
        ({ key, value }) => {
          localStorage.setItem(key, String(value));
        },
        {
          key: AUTH_STATE_SNAPSHOT_VERSION_STORAGE_KEY,
          value: CURRENT_AUTH_STATE_SNAPSHOT_VERSION,
        }
      );

      // Sanity check: confirm we are not accidentally still on /login
      await expect(page).not.toHaveURL(/\/login/, { timeout: 2_000 });

      // Persist auth state including IndexedDB (local SQLite snapshot)
      await context.storageState({ path: authFile, indexedDB: true });

      console.log(`✅ [${testUser.name}] Auth state saved to ${authFile}`);
    } finally {
      await context.close();
    }
  }

  console.log("🎉 All test users authenticated");
});
