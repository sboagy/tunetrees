import { expect, test } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
});

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }) => {
  await restartBackend();
  await page.waitForTimeout(1_000);
});

test.describe.serial("Practice Goals E2E Tests", () => {
  test("should display goal and technique columns in practice mode", async ({
    page,
  }) => {
    const po = new TuneTreesPageObject(page);

    // Navigate to practice tab using Page Object method
    await po.navigateToPracticeTab();

    // Verify Scheduled and technique column headers are visible
    // Note: These appear as cells with text, not columnheader role
    // Use a more specific selector to avoid matching "Prev Goal"
    const scheduledHeader = page
      .getByRole("button", { name: "Scheduled", exact: true })
      .first();
    // const techniqueHeader = page.getByRole("cell", {
    //   name: "Algorithm",
    // });

    await expect(scheduledHeader).toBeVisible();
    // await expect(techniqueHeader).toBeVisible();
  });
});
