/**
 * Example of enhanced test logging - apply this pattern to your test files
 *
 * Add these imports and hooks to your existing test files for better diagnostics
 */

import { test } from "@playwright/test";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "../test-scripts/test-logging";

// Enhanced beforeEach with logging
test.beforeEach(async ({ page }, testInfo) => {
  // Log test start
  logTestStart(testInfo);

  // Log browser context creation
  logBrowserContextStart();

  // Your existing setup
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);

  // Log that setup is complete
  console.log(`🔧 Test setup complete for: "${testInfo.title}"`);
});

// Enhanced afterEach with logging
test.afterEach(async ({ page }, testInfo) => {
  // Log browser context cleanup
  logBrowserContextEnd();

  // Your existing cleanup
  // await restartBackend();
  await page.waitForTimeout(100);

  // Log test completion
  logTestEnd(testInfo);
});

// Example test with enhanced logging
test("example enhanced test", async ({ page }) => {
  console.log("🚀 Starting main test logic");

  // Your test logic here
  await page.goto("/");

  console.log("✨ Test logic completed");
});
