import { exec } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { promisify } from "node:util";
import { expect, test as setup } from "@playwright/test";
import { config } from "dotenv";

// Load .env.local for local development (optional, won't fail in CI)
config({ path: ".env.local" });

const execAsync = promisify(exec);

const authFile = "e2e/.auth/alice.json";
const ALICE_EMAIL = "alice.test@tunetrees.test";
const ALICE_PASSWORD = process.env.ALICE_TEST_PASSWORD; // Default to null, i.e. its an error if not specified
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
        "cd /Users/sboag/gittt/tunetrees && supabase db reset",
        { timeout: 60000 }
      );
      if (resetStdout) console.log(resetStdout);
      if (resetStderr) console.error(resetStderr);

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
            "cd /Users/sboag/gittt/tunetrees && supabase status",
            {
              timeout: 5000,
            }
          );

          // Check if status output indicates services are running
          if (statusStdout?.includes("API URL")) {
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
        "cd /Users/sboag/gittt/tunetrees && npx tsx scripts/setup-test-environment.ts",
        {
          timeout: 30000,
          env: process.env, // Pass through all environment variables (from .env.local or CI)
        }
      );
      if (setupStdout) console.log(setupStdout);
      if (setupStderr) console.error(setupStderr);

      console.log("✅ Database reset complete");
    } catch (error) {
      console.error("❌ Database reset failed:", error);
      throw error;
    }
  } else {
    console.log("ℹ️  Skipping database reset (set RESET_DB=true to enable)");
    console.log("   Using existing database state for faster test iteration");
  }

  // Navigate to login page
  console.log("⏳ Navigating to login page...");
  await page.goto("http://localhost:5173/login");

  // Fill in Alice's credentials
  console.log("⏳ Filling credentials for alice.test@tunetrees.test...");
  await page.getByLabel("Email").fill("alice.test@tunetrees.test");
  if (!ALICE_PASSWORD) {
    if (!ALICE_PASSWORD) {
      console.error(
        "🛑 Missing ALICE_TEST_PASSWORD. Set ALICE_TEST_PASSWORD in your environment to run E2E tests."
      );
      throw new Error(
        "ALICE_TEST_PASSWORD environment variable is not set. Export ALICE_TEST_PASSWORD or provide it in CI secrets."
      );
    }
  }
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
