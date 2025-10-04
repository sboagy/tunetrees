import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
// import { applyNetworkThrottle } from "@/test-scripts/network-utils";
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
  // await applyNetworkThrottle(page);
  await checkHealth();
  // await page.waitForTimeout(1_000);
});

test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await page.waitForTimeout(2_000);
  await restartBackend();
  logBrowserContextEnd();
  logTestEnd(testInfo);
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

  // Wait deterministically for either an error overlay or selection cleared
  const errorOverlay = page.getByRole("button", {
    name: "Open issues overlay",
  });
  const tableStatus = ttPO.tableStatus;
  const selectionCleared = async () => {
    try {
      await expect(tableStatus).toContainText("0 row(s) selected", {
        timeout: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  };

  const errorVisible = await errorOverlay
    .isVisible({ timeout: 10_000 })
    .catch(() => false);
  if (!errorVisible) {
    const cleared = await selectionCleared();
    if (!cleared) {
      // one more short wait to let UI settle, then re-check overlay once
      await page.waitForTimeout(500);
      if (await errorOverlay.isVisible().catch(() => false)) {
        console.log(
          "ERROR DETECTED: Issue 201 - Secondary playlist error occurred",
        );
      }
    } else {
      console.log("Selection cleared successfully after Add To Repertoire");
    }
  } else {
    console.log(
      "ERROR DETECTED: Issue 201 - Secondary playlist error occurred",
    );
  }

  // If overlay is present, open and capture stack trace for diagnostics
  if (await errorOverlay.isVisible().catch(() => false)) {
    await errorOverlay.click();
    const stackTraceButton = page.getByRole("button", {
      name: "Copy Stack Trace",
    });
    if (await stackTraceButton.isVisible().catch(() => false)) {
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
  await page.waitForTimeout(1_000);
  await ttPO.waitForTablePopulationToStart();

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

  // Wait deterministically for either error overlay or selection cleared
  {
    const errorOverlay = page.getByRole("button", {
      name: "Open issues overlay",
    });
    const selectionCleared = async () => {
      try {
        await expect(ttPO.tableStatus).toContainText("0 row(s) selected", {
          timeout: 10_000,
        });
        return true;
      } catch {
        return false;
      }
    };
    const errorVisible = await errorOverlay
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!errorVisible) {
      const cleared = await selectionCleared();
      if (!cleared) {
        await page.waitForTimeout(500);
      }
    }
  }

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

  // Click Add To Repertoire and wait deterministically for outcome
  await ttPO.clickWithTimeAfter(ttPO.addToRepertoireButton);
  {
    const errorOverlay = page.getByRole("button", {
      name: "Open issues overlay",
    });
    const selectionCleared = async () => {
      try {
        await expect(ttPO.tableStatus).toContainText("0 row(s) selected", {
          timeout: 10_000,
        });
        return true;
      } catch {
        return false;
      }
    };
    const errorVisible = await errorOverlay
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!errorVisible) {
      const cleared = await selectionCleared();
      if (!cleared) {
        await page.waitForTimeout(500);
      }
    }
  }

  await ttPO.repertoireTabTrigger.click({ timeout: 60000 });
  await page.waitForTimeout(2_000);

  await expect(ttPO.tunesGridRows).toHaveCount(3, { timeout: expectTimeout });

  await ttPO.expectTuneInTableAndClick(66, "An Chóisir");
  await ttPO.expectTuneInTableAndClick(54, "Alasdruim's March");

  await ttPO.addTuneToSelection("66");
  await ttPO.addTuneToSelection("54");

  // Click Add To Review and wait for the "Successfully submitted" snackbar or table update
  await ttPO.clickWithTimeAfter(ttPO.addToReviewButton);
  {
    // Prefer a concrete UI signal; fallback to short delay if not available
    const successText = page.getByText("Practice successfully submitted", {
      exact: false,
    });
    const submitted = await successText
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!submitted) {
      // as a fallback, ensure rows remain in practice table before switching tabs
      await expect(ttPO.tunesGridRows.first())
        .toBeVisible({ timeout: expectTimeout })
        .catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  await ttPO.clickWithTimeAfter(ttPO.practiceTabTrigger);

  await page.waitForTimeout(1_000);

  await ttPO.expectTuneInTableAndClick(66, "An Chóisir");
  await ttPO.expectTuneInTableAndClick(54, "Alasdruim's March");

  await page.waitForTimeout(1_000);
  console.log("Secondary playlist 'Add To Review' completed");
});
