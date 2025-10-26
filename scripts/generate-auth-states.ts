/**
 * Generate auth state files for all test users
 * Run with: npx tsx scripts/generate-auth-states.ts
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const TEST_USERS = [
  { email: "alice.test@tunetrees.test", name: "alice" },
  { email: "bob.test@tunetrees.test", name: "bob" },
  { email: "carol.test@tunetrees.test", name: "carol" },
  { email: "dave.test@tunetrees.test", name: "dave" },
  { email: "eve.test@tunetrees.test", name: "eve" },
  { email: "frank.test@tunetrees.test", name: "frank" },
  { email: "grace.test@tunetrees.test", name: "grace" },
  { email: "henry.test@tunetrees.test", name: "henry" },
  { email: "iris.test@tunetrees.test", name: "iris" },
];

const PASSWORD = "TestPassword123!";
const AUTH_DIR = resolve(process.cwd(), "e2e/.auth");

async function generateAuthStates() {
  console.log("🔐 Generating auth state files...\n");

  // Ensure auth directory exists
  mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const user of TEST_USERS) {
    console.log(`Authenticating ${user.email}...`);

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to login
      await page.goto("http://localhost:5173/");
      await page.waitForTimeout(1000);

      // Check if already on main app (already logged in from previous run)
      const isOnLogin = await page
        .locator('input[type="email"]')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (isOnLogin) {
        // Fill login form
        await page.locator('input[type="email"]').fill(user.email);
        await page.locator('input[type="password"]').fill(PASSWORD);
        await page.locator('button[type="submit"]').click();

        // Wait for redirect to main app
        await page.waitForURL("http://localhost:5173/", { timeout: 10000 });
      }

      // Wait for app to load
      await page.waitForTimeout(2000);

      // Save auth state
      const authFile = resolve(AUTH_DIR, `${user.name}.json`);
      await context.storageState({ path: authFile });

      console.log(`   ✅ Saved to e2e/.auth/${user.name}.json`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed: ${errorMessage}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log("\n✨ All auth states generated!");
}

generateAuthStates().catch(console.error);
