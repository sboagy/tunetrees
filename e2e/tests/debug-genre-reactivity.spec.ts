/**
 * Debug Genre Reactivity Issues
 *
 * This test investigates the exact data flow to understand why genres
 * aren't showing up in the catalog filter dropdown.
 */

import { test } from "@playwright/test";

// Helper to login first
async function loginUser(page: any) {
  const testUsername =
    process.env.TUNETREES_TEST_USERNAME || "sboagy@gmail.com";
  const testPassword =
    process.env.TUNETREES_TEST_PASSWORD || "serf.pincers3BITTERS";

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(testUsername);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.locator('button:has-text("Sign In")').click();

  // Wait for auth state to settle
  await page.waitForTimeout(3000);
}

test.describe("Debug Genre Reactivity", () => {
  test("debug genre data flow step by step", async ({ page }) => {
    console.log("=== DEBUGGING GENRE REACTIVITY ===");

    // Capture console logs
    const logs: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      logs.push(text);
      if (
        text.includes("🔍") ||
        text.includes("CATALOG") ||
        text.includes("availableGenres")
      ) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    // Login first
    await loginUser(page);

    // Navigate to catalog tab and wait for data to load
    await page.goto("/?tab=catalog");
    console.log("📍 Navigated to catalog tab");

    // Wait for sync and data loading
    await page.waitForTimeout(8000);

    // Take screenshot of current state
    await page.screenshot({ path: "test-results/debug-catalog-loaded.png" });

    // Open the filter dropdown
    console.log("📍 Opening filter dropdown...");
    const filterButton = page.locator('[data-testid="combined-filter-button"]');
    await filterButton.click();
    await page.waitForTimeout(2000);

    // Take screenshot of dropdown
    await page.screenshot({ path: "test-results/debug-filter-dropdown.png" });

    // Check what genre options are visible
    const genreSection = page.locator('h4:has-text("Genre")').locator("..");
    const genreOptions = genreSection.locator("label");
    const genreCount = await genreOptions.count();

    console.log(`📊 Genre section has ${genreCount} options`);

    if (genreCount > 0) {
      for (let i = 0; i < genreCount; i++) {
        const optionText = await genreOptions.nth(i).textContent();
        console.log(`  Genre option ${i}: "${optionText}"`);
      }
    } else {
      // Check for "No genres available" text
      const noGenresText = await genreSection
        .locator('text="No genres available"')
        .count();
      console.log(`📊 "No genres available" text found: ${noGenresText > 0}`);
    }

    // Print relevant logs
    console.log("\n=== RELEVANT BROWSER LOGS ===");
    const relevantLogs = logs.filter(
      (log) =>
        log.includes("🔍") ||
        log.includes("CATALOG") ||
        log.includes("availableGenres") ||
        log.includes("allGenres") ||
        log.includes("allTunes")
    );

    relevantLogs.forEach((log) => {
      console.log(log);
    });

    console.log("=== DEBUG COMPLETE ===");
  });
});
