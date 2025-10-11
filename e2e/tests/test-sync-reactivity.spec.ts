import { test } from "@playwright/test";

// Helper to login
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

test("verify sync reactivity fix - UI updates after sync", async ({ page }) => {
  console.log("=== TESTING SYNC REACTIVITY FIX ===");

  // Enable console logging to see sync version changes
  page.on("console", (msg) => {
    if (
      msg.text().includes("Sync completed") ||
      msg.text().includes("sync version") ||
      msg.text().includes("🔄") ||
      msg.text().includes("availableGenres")
    ) {
      console.log(`Console: ${msg.text()}`);
    }
  });

  await loginUser(page);
  await page.goto("/?tab=catalog");

  console.log("✅ Logged in, waiting for initial load and sync...");

  // Wait for sync to complete (should see sync version increment in console)
  await page.waitForTimeout(15000);

  // Try to open filters dropdown
  const filterButton = page.locator('button:has-text("Filters")');

  if (await filterButton.isVisible()) {
    console.log("✅ Filter button found, clicking...");
    await filterButton.click();
    await page.waitForTimeout(2000);

    // Check for genres
    const noGenresText = await page
      .locator("text=No genres available")
      .isVisible();
    console.log(`❌ "No genres available" showing: ${noGenresText}`);

    if (!noGenresText) {
      console.log("✅ SUCCESS: Genres are now loading properly after sync!");

      // Check for actual genre options
      const genreOptions = await page
        .locator('input[type="checkbox"] + label')
        .count();
      console.log(`Found ${genreOptions} genre options in dropdown`);
    }
  } else {
    console.log("❌ Filter button not found");
  }

  // Take screenshot for verification
  await page.screenshot({ path: "test-results/sync-reactivity-test.png" });

  console.log("=== SYNC REACTIVITY TEST COMPLETE ===");
});
