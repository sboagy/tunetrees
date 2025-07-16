import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { expect, test } from "@playwright/test";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  // trace: "on",
  // actionTimeout: 10_000,
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);

  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe.serial("Secondary Playlist Tests - Issue 201", () => {
  test("test-secondary-add-to-repertoire-deselection", async ({ page }) => {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // Navigate to Irish Tenor Banjo instrument for secondary playlist testing
    await ttPO.navigateToIrishTenorBanjoInstrument();

    // Navigate to the Catalog tab
    await ttPO.navigateToCatalogTab();

    // Test for Issue 201: Secondary playlist functionality
    // Select specific tunes to test the secondary playlist issue
    await ttPO.addTuneToSelection("66");
    await ttPO.addTuneToSelection("54");

    // Wait for button to be enabled
    await expect(ttPO.addToRepertoireButton).toBeEnabled();

    // Set up error handling for the fetch failure
    ttPO.setupConsoleErrorHandling();
    ttPO.setupNetworkFailureHandling();

    // Try to click Add To Repertoire - this should trigger the Issue 201 error
    await ttPO.addToRepertoireButton.click();

    // Wait for potential dialog or error
    await page.waitForTimeout(2_000);

    // Check if error overlay appeared (this indicates Issue 201)
    const errorOverlay = page.getByRole("button", {
      name: "Open issues overlay",
    });
    if (await errorOverlay.isVisible()) {
      console.log(
        "ERROR DETECTED: Issue 201 - Secondary playlist error occurred",
      );
      await errorOverlay.click();

      // Try to capture error details
      const stackTraceButton = page.getByRole("button", {
        name: "Copy Stack Trace",
      });
      if (await stackTraceButton.isVisible()) {
        await stackTraceButton.click();
        console.log("Stack trace captured for Issue 201");
      }
    }

    console.log("Checking if tunes are unselected...");
    await ttPO.expectTuneUnselected("66");
    await ttPO.expectTuneUnselected("54");

    await ttPO.repertoireTabTrigger.click();
    await page.waitForTimeout(2_000);

    await ttPO.catalogTab.click();
    await page.waitForTimeout(4_000);

    await ttPO.expectTuneUnselected("66");
    await ttPO.expectTuneUnselected("54");

    console.log("test-secondary-add-to-repertoire-deselection completed");
  });

  test("test-secondary-playlist-add-to-repertoire", async ({ page }) => {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // Navigate to Irish Tenor Banjo instrument for secondary playlist testing
    await ttPO.navigateToIrishTenorBanjoInstrument();

    // Navigate to the Catalog tab
    await ttPO.navigateToCatalogTab();

    // Test for Issue 201: Secondary playlist functionality
    // Select specific tunes to test the secondary playlist issue
    await ttPO.addTuneToSelection("66");
    await ttPO.addTuneToSelection("54");

    // Wait for button to be enabled
    await expect(ttPO.addToRepertoireButton).toBeEnabled();

    await ttPO.addToRepertoireButton.click();

    await page.waitForTimeout(1_000);

    await ttPO.repertoireTabTrigger.click({ timeout: 60000 });
    await page.waitForTimeout(2_000);

    const rowCount = await ttPO.tunesGridRows.count();
    expect(rowCount).toBe(3);

    await ttPO.expectTuneInTableAndClick(66, "An Chóisir");
    await ttPO.expectTuneInTableAndClick(54, "Alasdruim's March");

    console.log("test-secondary-playlist-add-to-repertoire completed");
  });

  test.skip("test-secondary-playlist-switching", async ({ page }) => {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // Navigate to Irish Tenor Banjo instrument for secondary playlist testing
    await ttPO.navigateToIrishTenorBanjoInstrument();

    // Navigate to the Catalog tab
    await ttPO.navigateToCatalogTab();

    // Test switching between different playlists/instruments
    // This should test the secondary playlist functionality

    // Look for playlist/instrument selector
    const playlistSelector = page
      .locator('[data-testid*="playlist"], [data-testid*="instrument"]')
      .first();
    if (await playlistSelector.isVisible()) {
      await playlistSelector.click();

      // Wait for dropdown to appear
      await page.waitForTimeout(500);

      // Look for other playlist options
      const playlistOptions = page.locator(
        '[role="menuitem"], [role="option"]',
      );
      const optionCount = await playlistOptions.count();

      if (optionCount > 1) {
        // Select a different playlist
        await playlistOptions.nth(1).click();

        // Wait for the change to take effect
        await page.waitForTimeout(1_000);
      }
    }

    console.log("Secondary playlist switching test completed");
  });
});
