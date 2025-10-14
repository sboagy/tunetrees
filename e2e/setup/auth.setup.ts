import { exec } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { promisify } from "node:util";
import { expect, test as setup } from "@playwright/test";

const execAsync = promisify(exec);

const authFile = "e2e/.auth/alice.json";
const ALICE_EMAIL = "alice.test@tunetrees.test";
const AUTH_EXPIRY_MINUTES = 50; // Consider auth stale after 50 minutes (tokens typically expire at 60 min)

/**
 * Authentication setup for Alice test user
 * This runs before all tests and:
 * 1. Resets the Supabase database (if RESET_DB=true)
 * 2. Loads fresh test data (if RESET_DB=true)
 * 3. Authenticates as Alice (only if needed)
 * 4. Saves authentication state for reuse
 */
setup("authenticate as Alice", async ({ page }) => {
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
          `✅ Using cached auth for Alice (${Math.round(
            fileAgeMinutes
          )} min old)`
        );
        console.log("   (Set RESET_DB=true to force fresh login)");
        return; // Skip login flow
      } else if (!hasAliceData) {
        console.log("⚠️  Cached auth is not for Alice, logging in fresh...");
      } else {
        console.log(
          `⚠️  Cached auth is stale (${Math.round(
            fileAgeMinutes
          )} min old), logging in fresh...`
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
    console.log(
      "   Running: supabase db reset && npx tsx scripts/setup-test-environment.ts"
    );

    try {
      const { stdout, stderr } = await execAsync(
        "cd /Users/sboag/gittt/tunetrees && supabase db reset && npx tsx scripts/setup-test-environment.ts",
        { timeout: 60000 } // 60 second timeout for database operations
      );

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

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
  await page.locator("input#password").fill("TestPassword123!");

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

  // Save authentication state
  console.log("⏳ Saving authentication state...");
  await page.context().storageState({ path: authFile });

  console.log(`✅ Authentication setup complete - saved to ${authFile}`);
  console.log("   Other tests will reuse this authenticated state");
});
