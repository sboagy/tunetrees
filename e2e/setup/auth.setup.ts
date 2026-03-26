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

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
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
config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const TEST_PASSWORD = "TestPassword123!";

// -- helpers ------------------------------------------------------------------

function ensureAuthDir(): void {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true });
  }
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
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;

  while (Date.now() < deadline) {
    lastCount = await page.evaluate(async () => {
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
      if (!api) return 0;
      const counts = await api.getCatalogTuneCountsForUser();
      return counts.total;
    });

    if (lastCount > 0) {
      return;
    }

    await page.waitForTimeout(100);
  }

  throw new Error(
    `[auth.setup] Timed out waiting for tune catalog in local SQLite (last count: ${lastCount}). ` +
      "Ensure the dev server is running and the sync worker can reach Supabase."
  );
}

/**
 * Clear all user-owned TuneTrees data from Supabase Postgres for every test
 * user. Only called when RESET_DB=true. Never touches catalog tables (tune,
 * genre, etc.) or the sync_change_log system table.
 */
async function resetTunetreesUserData(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "[auth.setup] RESET_DB=true requires VITE_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY to be set."
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
}

// -- main setup test ----------------------------------------------------------

/**
 * Authenticate all 8 test users and persist their auth state (including
 * IndexedDB) to e2e/.auth/<key>.json.
 */
setup("authenticate all test users", async ({ browser }) => {
  setup.setTimeout(120_000);

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

    // Each user gets an isolated browser context to avoid session bleed
    const context = await browser.newContext({
      baseURL: `${BASE_URL}/`,
    });
    const page = await context.newPage();

    try {
      // Navigate to login page
      await page.goto(`${BASE_URL}/login`);

      // Fill and submit credentials
      await page.locator("#login-email").fill(testUser.email);
      await page.locator("#login-password").fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Sign In" }).click();

      // Wait for redirect away from /login
      await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 15_000,
      });

      // Wait for __ttTestApi to attach — signals auth + DB init complete
      await page.waitForFunction(
        () =>
          (window as unknown as { __ttTestApi?: unknown }).__ttTestApi !==
          undefined,
        { timeout: 30_000 }
      );

      // Wait for the tune catalog to be populated in local SQLite
      await waitForCatalogSnapshotReady(page, 30_000);

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
