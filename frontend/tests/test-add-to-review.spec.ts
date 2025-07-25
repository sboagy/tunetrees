import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { expect, test } from "@playwright/test";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
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

test.describe.serial("Add to Review Tests", () => {
  test("test-add-to-review-functionality", async ({ page }) => {
    // Increase test timeout for this complex test
    test.setTimeout(90000); // 90 seconds

    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // We should already be on the Repertoire tab at the point.  Assert that fact:
    await expect(ttPO.addToReviewButton).toBeVisible();

    await expect(ttPO.tableStatus).toContainText("1 of 488 row(s) selected", {
      timeout: 15000,
    });

    // Find the row with ID 669 "Foxhunter's Reel" and select it
    const foxhunterRow = page
      .getByRole("row")
      .filter({ hasText: "669" })
      .filter({ hasText: "Foxhunter's Reel" });

    await expect(foxhunterRow).toBeVisible({ timeout: 10000 });

    await foxhunterRow.click();

    // Click the checkbox for Foxhunter's Reel
    // const foxhunterCheckbox = foxhunterRow.locator('input[type="checkbox"]');
    // "tt-row-checkbox"
    const foxhunterCheckbox = foxhunterRow.getByTestId("tt-row-checkbox");
    // await expect(foxhunterCheckbox).toBeVisible();
    await foxhunterCheckbox.check();

    // Verify that 2 tunes are now selected (assuming Sweep's Hornpipe was already selected)
    await expect(ttPO.tableStatus).toContainText("2 of 488 row(s) selected", {
      timeout: 10000,
    });

    // Click the "Add To Review" button
    await expect(ttPO.addToReviewButton).toBeVisible();
    await expect(ttPO.addToReviewButton).toBeEnabled();

    // Monitor for any console errors during the Add to Review action
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await ttPO.addToReviewButton.click();

    // Wait for the operation to complete and check for errors
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      console.log("❌ Frontend errors detected:", errors);
    }

    await expect(ttPO.tableStatus).toContainText("0 of 488 row(s) selected", {
      timeout: 10000,
    });

    // Navigate to the practice tab to verify tunes were added
    await ttPO.navigateToPracticeTab();

    // The practice tab should now contain the added tunes
    const practiceGrid = ttPO.tunesGrid;
    await expect(practiceGrid).toContainText("Foxhunter's Reel", {
      timeout: 10000,
    });

    // If Sweep's Hornpipe was also selected, it should be there too
    const sweepsRow = page.getByText("Sweep's Hornpipe");
    if (await sweepsRow.isVisible()) {
      console.log("✅ Both tunes successfully added to practice");
    }

    // Verify we have the expected number of practice rows (at least the ones we added)
    const practiceRows = ttPO.tunesGridRows;
    const practiceRowCount = await practiceRows.count();
    console.log(`Practice tab has ${practiceRowCount} rows (including header)`);

    // Should have at least 2 rows (header + at least 1 tune)
    expect(practiceRowCount).toEqual(7);

    console.log("✅ Add to Review functionality test completed successfully");
  });
});
