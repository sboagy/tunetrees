import { exec } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test as setup } from "@playwright/test";
import { config } from "dotenv";
import { BASE_URL } from "../test-config";

// Load .env.local for local development (optional, won't fail in CI)
config({ path: ".env.local" });

const execAsync = promisify(exec);

const PROJECT_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const authFile = "e2e/.auth/alice.json";
const ALICE_EMAIL = "alice.test@tunetrees.test";
const ALICE_PASSWORD =
  process.env.ALICE_TEST_PASSWORD ||
  process.env.TEST_USER_PASSWORD ||
  "TestPassword123!";
const AUTH_EXPIRY_MINUTES = 10080; // 7 days in minutes (matches jwt_expiry = 604800 seconds in supabase/config.toml)

/**
 * Authentication setup for Alice test user
 * This runs before all tests and:
 * 1. Resets the Supabase database (if RESET_DB=true)
 * 2. Loads fresh test data (if RESET_DB=true)
 * 3. Authenticates as Alice (only if needed)
 * 4. Saves authentication state for reuse
 */
setup("authenticate as Alice", async ({ page }) => {
  // Increase timeout for database reset operations (90 seconds)
  setup.setTimeout(90000);

  // Check if auth file exists and is fresh
  const authExists = existsSync(authFile);
  const shouldReset = process.env.RESET_DB === "true";

  // If database was reset, force fresh login (old auth tokens are invalid)
  if (shouldReset && authExists) {
    console.log("⚠️  RESET_DB=true, clearing cached auth file...");
    rmSync(authFile, { force: true });
  }

  if (authExists && !shouldReset) {
    // Check if auth file is recent (not stale)
    try {
      const authData = JSON.parse(readFileSync(authFile, "utf-8"));
      const fileStats = statSync(authFile);
      const fileAgeMinutes = (Date.now() - fileStats.mtimeMs) / 1000 / 60;

      // Check if this is Alice's session
      const origins = authData.origins || [];
      const hasAliceData = origins.some((origin: any) => {
        const localStorage = origin.localStorage || [];
        return localStorage.some((item: any) =>
          item.value?.includes(ALICE_EMAIL)
        );
      });

      if (hasAliceData && fileAgeMinutes < AUTH_EXPIRY_MINUTES) {
        console.log(
          `✅ Using cached auth for Alice (${Math.round(fileAgeMinutes)} min old)`
        );
        console.log("   (Set RESET_DB=true to force fresh login)");
        return; // Skip login flow
      } else if (!hasAliceData) {
        console.log("⚠️  Cached auth is not for Alice, logging in fresh...");
      } else {
        console.log(
          `⚠️  Cached auth is stale (${Math.round(fileAgeMinutes)} min old), logging in fresh...`
        );
      }
    } catch {
      console.log("⚠️  Invalid auth file, logging in fresh...");
    }
  }

  // Reset database and load test data (only if RESET_DB=true)
  // For local development: skip reset (fast iteration)
  // For CI or clean runs: RESET_DB=true npx playwright test
  if (shouldReset) {
    console.log("⏳ Resetting database and loading test data...");
    console.log("   Step 1: Running supabase db reset...");

    try {
      // Step 1: Reset the database
      const { stdout: resetStdout, stderr: resetStderr } = await execAsync(
        `cd ${PROJECT_ROOT} && supabase db reset`,
        { timeout: 60000 }
      );
      if (resetStdout) console.log(resetStdout);
      if (resetStderr) console.error(resetStderr);

      // If reset succeeded, continue with readiness checks below.
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStderr =
        typeof (error as { stderr?: unknown }).stderr === "string"
          ? (error as { stderr: string }).stderr
          : "";
      const combined = `${errorMessage}\n${errorStderr}`;

      const looksLikeStorageUnionFailure =
        combined.includes("UNION types text and uuid cannot be matched") ||
        (combined.includes("Restarting containers") &&
          combined.includes("Error status 502"));

      // Supabase CLI local reset sometimes fails late with a Storage-layer error.
      // Symptom A: Postgres raises: "UNION types text and uuid cannot be matched".
      // Symptom B: The CLI prints a generic "Error status 502" right after "Restarting containers".
      //
      // Root cause (known upstream issue): Supabase Storage internally performs a UNION ALL between
      // storage.buckets and storage.buckets_analytics, but the id column types differ in some local
      // environments (buckets.id is TEXT while buckets_analytics.id is UUID). Postgres requires UNION
      // operands to have compatible types, so this breaks the query and can cause the storage service
      // (or an API endpoint it uses) to error during reset.
      //
      // Upstream tracking: https://github.com/supabase/cli/issues/4520
      //
      // Workaround (local dev/test only): if we detect this late-reset failure pattern, we connect as
      // supabase_admin and normalize storage.buckets_analytics.id (and dependent FK columns) to TEXT.
      // This makes the internal UNION query type-compatible, allowing the reset flow (and subsequent
      // E2E test setup) to proceed.
      if (looksLikeStorageUnionFailure) {
        console.warn(
          "⚠️  supabase db reset failed late; attempting workaround..."
        );

        const fixSql = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'id'
      AND data_type = 'text'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets_analytics'
      AND column_name = 'id'
      AND udt_name = 'uuid'
  ) THEN
    -- Drop dependent foreign keys first
    ALTER TABLE IF EXISTS storage.iceberg_namespaces
      DROP CONSTRAINT IF EXISTS iceberg_namespaces_catalog_id_fkey;
    ALTER TABLE IF EXISTS storage.iceberg_tables
      DROP CONSTRAINT IF EXISTS iceberg_tables_catalog_id_fkey;

    -- Drop PK so we can alter the id type
    ALTER TABLE IF EXISTS storage.buckets_analytics
      DROP CONSTRAINT IF EXISTS buckets_analytics_pkey;

    -- Normalize id to TEXT
    ALTER TABLE IF EXISTS storage.buckets_analytics
      ALTER COLUMN id TYPE text USING id::text,
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

    -- Recreate PK
    ALTER TABLE IF EXISTS storage.buckets_analytics
      ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);

    -- Update dependent columns
    ALTER TABLE IF EXISTS storage.iceberg_namespaces
      ALTER COLUMN catalog_id TYPE text USING catalog_id::text;
    ALTER TABLE IF EXISTS storage.iceberg_tables
      ALTER COLUMN catalog_id TYPE text USING catalog_id::text;

    -- Recreate foreign keys
    ALTER TABLE IF EXISTS storage.iceberg_namespaces
      ADD CONSTRAINT iceberg_namespaces_catalog_id_fkey
      FOREIGN KEY (catalog_id)
      REFERENCES storage.buckets_analytics(id)
      ON DELETE CASCADE;
    ALTER TABLE IF EXISTS storage.iceberg_tables
      ADD CONSTRAINT iceberg_tables_catalog_id_fkey
      FOREIGN KEY (catalog_id)
      REFERENCES storage.buckets_analytics(id)
      ON DELETE CASCADE;
  END IF;
END $$;
`;

        const tempDir = mkdtempSync(join(tmpdir(), "tunetrees-reset-"));
        const sqlFilePath = join(tempDir, "fix-storage-union.sql");
        try {
          writeFileSync(sqlFilePath, fixSql, "utf8");
          await execAsync(
            `psql "postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f "${sqlFilePath}"`,
            { timeout: 30000 }
          );
        } finally {
          rmSync(tempDir, { recursive: true, force: true });
        }

        console.log("✅ Applied storage UNION workaround");

        console.log("   Retrying supabase db reset after workaround...");
        const { stdout: retryStdout, stderr: retryStderr } = await execAsync(
          `cd ${PROJECT_ROOT} && supabase db reset`,
          { timeout: 60000 }
        );
        if (retryStdout) console.log(retryStdout);
        if (retryStderr) console.error(retryStderr);
      } else {
        console.error("❌ Database reset failed:", error);
        throw error;
      }
    }

    // Step 2: Wait for containers to start up
    console.log("   Step 2: Waiting for Supabase to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 4000)); // Initial 4s wait

    // Step 3: Poll supabase status until it's ready (max 30 seconds)
    const maxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds max
    let attempt = 0;
    let isReady = false;

    while (attempt < maxAttempts && !isReady) {
      attempt++;
      try {
        const { stdout: statusStdout } = await execAsync(
          `cd ${PROJECT_ROOT} && supabase status`,
          {
            timeout: 5000,
          }
        );

        // Check if status output indicates services are running
        // Look for "API URL", "Project URL", or "REST" which all indicate services are up
        if (
          statusStdout?.includes("Project URL") ||
          statusStdout?.includes("API URL") ||
          statusStdout?.includes("REST")
        ) {
          isReady = true;
          console.log(
            `   ✅ Supabase ready after ${attempt} attempts (${4 + attempt * 2}s total)`
          );
        }
      } catch {
        // Status check failed, wait and retry
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!isReady) {
      throw new Error(
        "Supabase did not become ready after 30 seconds of polling"
      );
    }

    // Step 4: Additional wait for auth service to be fully ready
    console.log("   Step 3: Waiting for auth service...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 5: Run setup script to create test users and data
    console.log("   Step 4: Running setup-test-environment.ts...");
    const { stdout: setupStdout, stderr: setupStderr } = await execAsync(
      `cd ${PROJECT_ROOT} && npx tsx scripts/setup-test-environment.ts`,
      {
        timeout: 30000,
        env: process.env, // Pass through all environment variables (from .env.local or CI)
      }
    );
    if (setupStdout) console.log(setupStdout);
    if (setupStderr) console.error(setupStderr);

    console.log("✅ Database reset complete");
  } else {
    console.log("ℹ️  Skipping database reset (set RESET_DB=true to enable)");
    console.log("   Using existing database state for faster test iteration");
  }

  // Navigate to login page
  console.log("⏳ Navigating to login page...");
  await page.goto(`${BASE_URL}/login`);

  // Debug: Log what we're about to try
  console.log(`🔍 DEBUG: Attempting login with:`);
  console.log(`   Email: ${ALICE_EMAIL}`);
  console.log(`   Password length: ${ALICE_PASSWORD.length} chars`);
  console.log(`   BASE_URL: ${BASE_URL}`);

  // Check what Supabase URL the page is using
  const supabaseUrl = await page.evaluate(() => {
    return (window as any).__SUPABASE_URL || "not set";
  });
  console.log(`   Page's Supabase URL: ${supabaseUrl}`);

  // Fill in Alice's credentials
  console.log("⏳ Filling credentials for alice.test@tunetrees.test...");
  await page.getByLabel("Email").fill("alice.test@tunetrees.test");
  await page.locator("input#password").fill(ALICE_PASSWORD);

  // Click sign in button
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for redirect to home page (any path except /login)
  console.log("⏳ Waiting for authentication redirect...");
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000,
  });

  // Wait for sync to complete
  console.log("⏳ Waiting for initial sync to complete...");
  await page.waitForTimeout(7000); // Give sync plenty of time

  // Verify we're logged in by checking for user email in TopNav
  await expect(page.getByText("alice.test@tunetrees.test")).toBeVisible({
    timeout: 5000,
  });

  // Clear sync timestamps from localStorage before saving auth state
  // This ensures tests start fresh and do an initial sync (not incremental)
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
    if (keysToRemove.length > 0) {
      console.log(
        `Cleared ${keysToRemove.length} sync timestamp(s) before saving auth state`
      );
    }
  });

  // Save authentication state
  console.log("⏳ Saving authentication state...");
  await page.context().storageState({ path: authFile });

  console.log(`✅ Authentication setup complete - saved to ${authFile}`);
  console.log("   Other tests will reuse this authenticated state");
});
