import { expect, test } from "@playwright/test";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { restartBackend } from "@/test-scripts/global-setup";
import {
  TuneTreesPageObject,
  navigateToPracticeTabStandalone,
} from "@/test-scripts/tunetrees.po";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
});

test.describe.serial("Practice header controls + footer metrics", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
    await setTestDefaults(page);
    await applyNetworkThrottle(page);
  });

  test.afterEach(async ({ page }) => {
    await restartBackend();
    await page.waitForTimeout(1000);
  });

  test("toggle submitted, add tunes dialog, footer metrics dialog", async ({
    page,
  }) => {
    await navigateToPracticeTabStandalone(page);
    const ttPO = new TuneTreesPageObject(page);

    // Ensure header controls are visible
    await expect(ttPO.submitPracticedTunesButton).toBeVisible();

    // Toggle show submitted: should be present
    await expect(ttPO.showSubmittedToggle).toBeVisible();
    await ttPO.showSubmittedToggle.click();

    // Add tunes via dialog (adds 1)
    await ttPO.addTunesButton.click();
    await expect(ttPO.addTunesCountInput).toBeVisible();
    await ttPO.addTunesCountInput.fill("1");
    await ttPO.addTunesConfirmButton.click();

    // Footer present and double-click opens dialog (by side-effect we just check that footer exists)
    await expect(ttPO.tableFooter).toBeVisible();
    await ttPO.tableFooter.dblclick();
    // Dialog should appear with title
    const metricsTitle = page.getByRole("heading", {
      name: "Practice Queue Metrics",
    });
    await expect(metricsTitle).toBeVisible();
    // Close dialog
    await page.getByTestId("metrics-dialog-close").click();
  });
});
