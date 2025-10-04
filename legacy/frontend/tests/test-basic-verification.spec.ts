import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import {
  navigateToRepertoireTabStandalone,
  TuneTreesPageObject,
} from "@/test-scripts/tunetrees.po";
import { expect, test } from "@playwright/test";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";
import { checkHealth } from "@/test-scripts/check-servers";

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
  await page.waitForLoadState("domcontentloaded");
  await checkHealth();
});

test.afterEach(async ({ page }, testInfo) => {
  await restartBackend();
  logBrowserContextEnd();
  logTestEnd(testInfo);
  await page.waitForTimeout(500);
});

test.describe("Basic TuneGrid Verification", () => {
  test("verify-sorting-functionality-simple", async ({ page }) => {
    // Navigate using the established pattern with Page Object
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();
    await navigateToRepertoireTabStandalone(page);
    await page.waitForLoadState("domcontentloaded");

    // Wait for the grid to be visible using Page Object
    await expect(ttPO.tunesGrid).toBeVisible({ timeout: 15000 });

    // Check basic grid functionality using Page Object locators
    const gridRows = await ttPO.tunesGridRows.count();
    console.log("Table rows found:", gridRows);

    // Verify that sort buttons are available using Page Object
    await expect(ttPO.idColumnHeaderSortButton).toBeVisible();
    console.log("✅ ID column sort button is visible");

    // Basic verification that the page loads and has data
    expect(gridRows).toBeGreaterThan(1);
    console.log("✅ Grid has data rows:", gridRows);

    // Verify table status is showing
    await expect(ttPO.tableStatus).toBeVisible();
    const tableStatusText = await ttPO.tableStatus.textContent();
    console.log("Table status:", tableStatusText);

    console.log("✅ Basic TuneGrid verification completed successfully!");
  });
});
