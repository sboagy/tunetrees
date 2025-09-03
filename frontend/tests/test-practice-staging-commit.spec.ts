import { test, expect } from "@playwright/test";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { getStorageState } from "@/test-scripts/storage-state";
import { restartBackend } from "@/test-scripts/global-setup";
import {
  TuneTreesPageObject,
  navigateToPracticeTabStandalone,
} from "@/test-scripts/tunetrees.po";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "@/test-scripts/test-logging";
import { checkHealth } from "@/test-scripts/check-servers";

// Use storage state for auth if available (falls back to direct login tests if not configured)
// This mirrors established patterns: keep fast and deterministic.

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
});

test.describe.serial("Practice staging + commit flow", () => {
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
    await page.waitForTimeout(2_000);
    await restartBackend();
    logBrowserContextEnd();
    logTestEnd(testInfo);
  });

  test("stage evaluation then submission clears staged row styling", async ({
    page,
  }) => {
    // Navigate to practice tab
    await navigateToPracticeTabStandalone(page);
    const ttPO = new TuneTreesPageObject(page);
    await expect(ttPO.practiceTab).toBeVisible({ timeout: 60000 });

    // Locate first recall evaluation trigger (first data row)
    const firstEvalTrigger = page
      .locator(
        '[data-testid$="_recall_eval"] [data-testid="tt-recal-eval-popover-trigger"]',
      )
      .first();
    await expect(firstEvalTrigger).toBeVisible({ timeout: 30000 });

    // Stage a rating (Good)
    await firstEvalTrigger.click();
    await page.getByTestId("tt-recal-eval-good").click();

    // Expect a per-row staged marker to appear (data-testid pattern staged-row-<tuneId>)
    const stagedRow = page.locator('[data-testid^="staged-row-"]').first();
    await expect(stagedRow).toBeVisible({ timeout: 10000 });

    // Submit practiced tunes (this now commits staged evaluations implicitly)
    const submitBtn = page.getByRole("button", {
      name: "Submit Practiced Tunes",
    });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();
    await ttPO.waitForSuccessfullySubmitted();

    // After submission, staged styling should clear (row testid no longer present)
    await expect(
      page.locator('[data-testid^="staged-row-"]').first(),
    ).toHaveCount(0, {
      timeout: 20000,
    });

    // Light-weight verification: reopen and ensure popover renders; don't assert selection state strictly
    await firstEvalTrigger.click();
    await page
      .getByTestId("tt-recal-eval-group-menu")
      .waitFor({ state: "visible", timeout: 10000 });
    // Close popover to leave clean state
    await page.keyboard.press("Escape");
  });
});
