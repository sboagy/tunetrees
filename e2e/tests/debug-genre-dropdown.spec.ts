/**
 * Focused test for genre dropdown reactivity issue
 */

import { test } from "@playwright/test";

async function loginUser(page: any) {
  const testUsername =
    process.env.TUNETREES_TEST_USERNAME || "sboagy@gmail.com";
  const testPassword =
    process.env.TUNETREES_TEST_PASSWORD || "serf.pincers3BITTERS";

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(testUsername);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.locator('button:has-text("Sign In")').click();
  await page.waitForTimeout(3000);
}

test.describe("Debug Genre Dropdown", () => {
  test("check genre dropdown specifically", async ({ page }) => {
    console.log("=== DEBUGGING GENRE DROPDOWN REACTIVITY ===");

    // Capture console logs
    const logs: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      logs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    await loginUser(page);
    await page.goto("/");

    // Wait for sync and data loading
    await page.waitForTimeout(8000);

    // Check if genre dropdown has options
    const genreButton = page.locator('button:has-text("Genre:")');
    if ((await genreButton.count()) > 0) {
      console.log("✅ Found genre button");

      await genreButton.click();
      await page.waitForTimeout(1000);

      // Look for genre options
      const genreOptions = page.locator(
        '[role="option"], button:has-text("reel"), button:has-text("jig")'
      );
      const optionCount = await genreOptions.count();

      console.log(`📊 Genre options visible: ${optionCount}`);

      if (optionCount > 0) {
        for (let i = 0; i < Math.min(optionCount, 5); i++) {
          const optionText = await genreOptions.nth(i).textContent();
          console.log(`  Genre option ${i}: "${optionText}"`);
        }
      }
    } else {
      console.log("❌ No genre button found");
    }

    // Print filtered logs
    console.log("\n=== RELEVANT LOGS ===");
    const relevantLogs = logs.filter(
      (log) =>
        log.includes("CombinedFilterDropdown") ||
        log.includes("availableGenres") ||
        log.includes("🔄 Sync completed")
    );

    for (const log of relevantLogs) {
      console.log(log);
    }
  });
});
