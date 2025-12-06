import type { FullConfig } from "@playwright/test";

/**
 * Global teardown for Playwright tests
 *
 * This runs once after all tests complete.
 * Use for:
 * - Cleanup test data
 * - Close database connections
 * - Generate reports
 */
async function globalTeardown(_config: FullConfig) {
  console.log("🧹 Playwright Global Teardown");

  // TODO: Add any global cleanup needed for TuneTrees
  // - Clear test data
  // - Reset database state
  // - Cleanup temporary files

  console.log("✅ Global teardown complete");
}

export default globalTeardown;
