import { test, expect } from "@playwright/test";

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

test("test with real Supabase data only (no seed data)", async ({ page }) => {
  console.log("=== TESTING WITH REAL SUPABASE DATA ONLY ===");

  // Enable all console logging
  page.on("console", (msg) => {
    console.log(`Console: ${msg.text()}`);
  });

  await loginUser(page);
  await page.goto("/?tab=catalog");

  // Wait longer for sync to complete
  await page.waitForTimeout(15000);

  console.log("✅ Logged in and waited for sync");

  // Click filter button to see genres
  const filterButton = page.locator('button:has-text("Filters")');
  await expect(filterButton).toBeVisible();
  await filterButton.click();
  await page.waitForTimeout(2000);

  // Check what's in the genre section
  const noGenresVisible = await page
    .locator("text=No genres available")
    .isVisible();
  console.log('❌ "No genres available" showing:', noGenresVisible);

  // Take screenshot
  await page.screenshot({ path: "test-results/real-data-only-test.png" });

  console.log("=== REAL DATA TEST COMPLETE ===");
});
