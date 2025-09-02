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
import { checkHealth } from "@/test-scripts/check-servers";

// set 5 minutes for each test in this file
const testTimeout = process.env.CI ? 5 * 60 * 1000 : 1 * 60 * 1000;

test.setTimeout(testTimeout);

const expectTimeout = process.env.CI ? 60_000 : 30_000;

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
  await checkHealth();
  await page.waitForTimeout(1_000);
});

test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend(true);
  logBrowserContextEnd();
  logTestEnd(testInfo);
  await page.waitForTimeout(1_000);
});

test("test-secondary-add-to-repertoire-deselection", async ({ page }) => {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.gotoMainPage();

  // Navigate to Irish Tenor Banjo instrument for secondary playlist testing
  await ttPO.navigateToIrishTenorBanjoInstrument();

  // Navigate to the Catalog tab
  await ttPO.navigateToCatalogTab();

  await expect(ttPO.addToRepertoireButton).toBeVisible();

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
  await ttPO.clickWithTimeAfter(ttPO.addToRepertoireButton);

  // Wait for potential dialog or error
  await page.waitForTimeout(1_000);

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

  await ttPO.clickWithTimeAfter(ttPO.repertoireTabTrigger);
  await page.waitForTimeout(2_000);

  await ttPO.clickWithTimeAfter(ttPO.catalogTab);
  await page.waitForTimeout(4_000);

  await ttPO.expectTuneUnselected("66");
  await ttPO.expectTuneUnselected("54");

  await page.waitForTimeout(1_000);
  console.log("test-secondary-add-to-repertoire-deselection completed");
});

test("test-secondary-playlist-add-to-repertoire", async ({ page }) => {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.gotoMainPage();

  // Navigate to Irish Tenor Banjo instrument for secondary playlist testing
  await ttPO.navigateToIrishTenorBanjoInstrument(false);

  // There's a bit of a race condition here if the catalog tab is invoked before,
  // to try and ensure we're past the loading stage.
  // Still, this is really a bug I'm hacking around.
  await ttPO.addToReviewButton.isVisible();
  await page.waitForTimeout(2_000);

  // Navigate to the Catalog tab
  await ttPO.navigateToCatalogTab();

  // Test for Issue 201: Secondary playlist functionality
  // Select specific tunes to test the secondary playlist issue
  await ttPO.addTuneToSelection("66");
  await ttPO.addTuneToSelection("54");

  // Wait for button to be enabled
  await expect(ttPO.addToRepertoireButton).toBeEnabled();

  await ttPO.clickWithTimeAfter(ttPO.addToRepertoireButton);

  await page.waitForTimeout(1_000);

  await ttPO.clickWithTimeAfter(ttPO.repertoireTabTrigger);

  // Ensure the repertoire panel and table are visible and populated before measuring rows
  await ttPO.repertoireTab.waitFor({ state: "visible", timeout: 60000 });
  await ttPO.waitForTablePopulationToStart();

  await expect(ttPO.tunesGridRows).toHaveCount(3, { timeout: expectTimeout });

  await ttPO.expectTuneInTableAndClick(66, "An Chóisir");
  await ttPO.expectTuneInTableAndClick(54, "Alasdruim's March");

  await page.waitForTimeout(1_000);
  console.log("test-secondary-playlist-add-to-repertoire completed");
});

test("test-secondary-playlist-add-to-review", async ({ page }) => {
  const ttPO = new TuneTreesPageObject(page);
  await page.waitForTimeout(2_000);
  await ttPO.gotoMainPage();
  await page.waitForTimeout(2_000);

  // Navigate to Irish Tenor Banjo instrument for secondary playlist testing
  await ttPO.navigateToIrishTenorBanjoInstrument();

  // There's a bit of a race condition here if the catalog tab is invoked before,
  // to try and ensure we're past the loading stage.
  // Still, this is really a bug I'm hacking around.
  await ttPO.addToReviewButton.isVisible();
  await page.waitForTimeout(2_000);

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

  await expect(ttPO.tunesGridRows).toHaveCount(3, { timeout: expectTimeout });

  await ttPO.expectTuneInTableAndClick(66, "An Chóisir");
  await ttPO.expectTuneInTableAndClick(54, "Alasdruim's March");

  await ttPO.addTuneToSelection("66");
  await ttPO.addTuneToSelection("54");

  await ttPO.clickWithTimeAfter(ttPO.addToReviewButton);
  await page.waitForTimeout(1_000);

  await ttPO.clickWithTimeAfter(ttPO.practiceTabTrigger);

  await page.waitForTimeout(1_000);

  await ttPO.expectTuneInTableAndClick(66, "An Chóisir");
  await ttPO.expectTuneInTableAndClick(54, "Alasdruim's March");

  await page.waitForTimeout(1_000);
  console.log("Secondary playlist 'Add To Review' completed");
});
