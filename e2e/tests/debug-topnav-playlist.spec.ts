/**
 * Debug TopNav Playlist Dropdown Reactivity
 *
 * Focus specifically on the playlist dropdown in the top navigation
 * to understand why it's not populating after sync.
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

test.describe("Debug TopNav Playlist Dropdown", () => {
  test("debug playlist dropdown step by step", async ({ page }) => {
    console.log("=== DEBUGGING TOPNAV PLAYLIST DROPDOWN ===");

    // Capture console logs
    const logs: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      logs.push(text);
      if (text.includes("🔍") && text.includes("TOPNAV")) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    // Login first
    await loginUser(page);

    // Go to any page (doesn't matter since TopNav is always there)
    await page.goto("/");
    console.log("📍 Navigated to home page");

    // Wait for sync and data loading
    await page.waitForTimeout(8000);

    // Take screenshot of current state
    await page.screenshot({ path: "test-results/debug-topnav-loaded.png" });

    // Look for the playlist dropdown button
    console.log("📍 Looking for playlist dropdown button...");

    const playlistSelectors = [
      'button:has-text("Playlist")',
      'button[aria-label*="playlist"]',
      'button[aria-label*="Playlist"]',
      "button[aria-expanded]",
      ".playlist",
      '[data-testid*="playlist"]',
    ];

    let playlistButton = null;
    for (const selector of playlistSelectors) {
      const element = page.locator(selector);
      if ((await element.count()) > 0) {
        console.log(`✅ Found playlist button with selector: ${selector}`);
        const buttonText = await element.textContent();
        console.log(`   Button text: "${buttonText}"`);
        playlistButton = element.first();
        break;
      }
    }

    if (!playlistButton) {
      console.log("❌ No playlist button found with any selector");

      // Log all buttons in the top nav to see what's available
      const topNavButtons = page.locator("nav button, header button");
      const buttonCount = await topNavButtons.count();
      console.log(`Found ${buttonCount} buttons in navigation:`);

      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const buttonText = await topNavButtons.nth(i).textContent();
        const buttonClasses = await topNavButtons.nth(i).getAttribute("class");
        console.log(
          `  Button ${i}: "${buttonText}" classes="${buttonClasses}"`
        );
      }

      throw new Error("Could not find playlist button");
    }

    // Click the playlist button
    console.log("📍 Clicking playlist dropdown button...");
    await playlistButton.click();
    await page.waitForTimeout(2000);

    // Take screenshot after clicking
    await page.screenshot({
      path: "test-results/debug-playlist-dropdown-open.png",
    });

    // Look for playlist options
    console.log("📍 Checking for playlist options...");

    const playlistOptionSelectors = [
      'button:has-text("tune")',
      'button:has-text("Tune")',
      '[role="menuitem"]',
      '[role="option"]',
      ".playlist-option",
      'div:has-text("tune")',
    ];

    let playlistOptions = null;
    let optionCount = 0;

    for (const selector of playlistOptionSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        console.log(
          `✅ Found ${count} playlist options with selector: ${selector}`
        );
        playlistOptions = elements;
        optionCount = count;
        break;
      }
    }

    if (optionCount === 0) {
      console.log("❌ No playlist options found");

      // Check for loading text
      const loadingText = page.locator('text="Loading playlists..."');
      const hasLoading = (await loadingText.count()) > 0;
      console.log(`📊 "Loading playlists..." text found: ${hasLoading}`);

      // Check for "No playlists" text
      const noPlaylistsText = page.locator('text="No playlists"');
      const hasNoPlaylists = (await noPlaylistsText.count()) > 0;
      console.log(`📊 "No playlists" text found: ${hasNoPlaylists}`);

      // Log the actual content of the dropdown
      const dropdownContent = await page.locator("body").textContent();
      if (dropdownContent) {
        const dropdownLines = dropdownContent
          .split("\n")
          .filter(
            (line) =>
              line.includes("playlist") ||
              line.includes("Playlist") ||
              line.includes("tune")
          );
        console.log("📊 Dropdown content lines mentioning playlists/tunes:");
        for (let i = 0; i < dropdownLines.length; i++) {
          console.log(`  ${i}: "${dropdownLines[i].trim()}"`);
        }
      }
    } else {
      console.log(`✅ Found ${optionCount} playlist options`);

      // Log the text of each option
      for (let i = 0; i < Math.min(optionCount, 5); i++) {
        const optionText = await playlistOptions!.nth(i).textContent();
        console.log(`  Option ${i}: "${optionText}"`);
      }
    }

    // Print relevant TOPNAV logs
    console.log("\n=== RELEVANT TOPNAV LOGS ===");
    const relevantLogs = logs.filter(
      (log) => log.includes("🔍") && log.includes("TOPNAV")
    );

    relevantLogs.forEach((log) => {
      console.log(log);
    });

    console.log("=== TOPNAV DEBUG COMPLETE ===");
  });
});
