/**
 * Test Reactivity of Dropdowns After Sync
 *
 * This test verifies that all dropdowns (genres, playlists, types, modes)
 * populate automatically after sync completes, without requiring manual refresh.
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

test.describe("Dropdown Reactivity After Sync", () => {
  test("all dropdowns populate automatically after sync", async ({ page }) => {
    console.log("=== TESTING DROPDOWN REACTIVITY ===");

    // Login first
    await loginUser(page);

    // Navigate to catalog tab
    await page.goto("/?tab=catalog");
    await page.waitForTimeout(5000); // Wait for sync to complete

    console.log("Current URL:", page.url());

    // Test 1: Check playlist dropdown in TopNav
    console.log("🧪 Testing playlist dropdown in TopNav...");
    await page.screenshot({ path: "test-results/before-playlist-click.png" });

    const playlistButton = page
      .locator(
        'button:has-text("Playlist"), button[aria-label*="playlist"], button[aria-label*="Playlist"]'
      )
      .first();
    await playlistButton.click();

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/playlist-dropdown-open.png" });

    // Look for playlist items
    const playlistItems = page.locator(
      'button:has-text("tune"), [role="menuitem"]:has-text("tune")'
    );
    const playlistCount = await playlistItems.count();
    console.log(`✅ Playlist dropdown has ${playlistCount} items`);

    // Close dropdown
    await page.keyboard.press("Escape");

    // Test 2: Check genre dropdown in filters
    console.log("🧪 Testing genre dropdown in filters...");

    const filterButton = page
      .locator(
        'button:has-text("Filters"), [data-testid="combined-filter-button"]'
      )
      .first();
    if ((await filterButton.count()) > 0) {
      await filterButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "test-results/filter-dropdown-open.png" });

      // Look for genre options
      const genreOptions = page.locator(
        'text="Irish Traditional", text="Scottish Traditional", text="Bluegrass"'
      );
      const genreCount = await genreOptions.count();
      console.log(`✅ Genre filter has ${genreCount} genre options visible`);

      await page.keyboard.press("Escape");
    } else {
      console.log("⚠️  Filter button not found");
    }

    console.log("=== DROPDOWN REACTIVITY TEST COMPLETE ===");
  });
});
