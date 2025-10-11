/**
 * Debug which filter component is actually being used
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

test.describe("Debug Filter Component", () => {
  test("check which filter component is being used", async ({ page }) => {
    console.log("=== DEBUGGING FILTER COMPONENT ===");

    // Capture console logs
    page.on("console", (msg) => {
      console.log(`[BROWSER] ${msg.text()}`);
    });

    await loginUser(page);
    await page.goto("/catalog");
    await page.waitForTimeout(3000);

    // Look for any filter button
    const filterButton = page.locator('button:has-text("Filters")');
    const filterCount = await filterButton.count();

    console.log(`🔍 Filter buttons found: ${filterCount}`);

    if (filterCount > 0) {
      console.log("✅ FilterPanel is being used!");

      // Click it to see the dropdown
      await filterButton.first().click();
      await page.waitForTimeout(1000);

      // Look for the new organized layout header
      const newHeaderText = page.locator('h3:has-text("Filters")');
      const newHeaderCount = await newHeaderText.count();

      // Look for the old grid layout header
      const oldHeaderText = page.locator('h3:has-text("Filter Options")');
      const oldHeaderCount = await oldHeaderText.count();

      console.log(`📋 NEW organized dropdown header found: ${newHeaderCount}`);
      console.log(`📊 OLD grid dropdown header found: ${oldHeaderCount}`);

      if (newHeaderCount > 0) {
        console.log("🎉 SUCCESS: New FilterPanel dropdown is working!");
      } else if (oldHeaderCount > 0) {
        console.log(
          "❌ PROBLEM: Old CombinedFilterDropdown is still being used!"
        );
      } else {
        console.log("❓ UNKNOWN: Some other dropdown structure");
      }
    } else {
      console.log("❓ No filter button found at all!");
    }

    // Take a screenshot for debugging
    await page.screenshot({
      path: "debug-filter-component.png",
      fullPage: true,
    });
  });
});
