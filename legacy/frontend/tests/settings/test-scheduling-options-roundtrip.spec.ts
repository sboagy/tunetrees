import { test, expect, type Page } from "@playwright/test";
import { getStorageState } from "@/test-scripts/storage-state";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { restartBackend } from "@/test-scripts/global-setup";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "@/test-scripts/test-logging";

// Authentication & viewport configuration
test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1280, height: 800 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

async function gotoScheduling(page: Page) {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.gotoMainPage();

  // Open settings dialog if trigger button appears; fallback to direct navigation otherwise.
  const settingsButton = page.getByTestId("tt-select-setting");
  if (await settingsButton.isVisible()) {
    await settingsButton.click();
    await page.waitForTimeout(300);
  } else {
    // Log for diagnostics when running headless
    console.log(
      "[roundtrip-test] settings trigger not visible; navigating directly to user-settings page",
    );
  }
  await page.goto("/user-settings/scheduling-options");
  await page.waitForLoadState("domcontentloaded");
}

test("scheduling options persist after reload", async ({ page }) => {
  await gotoScheduling(page);

  const delinquency = page.getByTestId("sched-acceptable-delinquency-input");
  const minPerDay = page.getByTestId("sched-min-per-day-input");
  const maxPerDay = page.getByTestId("sched-max-per-day-input");
  const daysPerWeek = page.getByTestId("sched-days-per-week-input");
  const weeklyRules = page.getByTestId("sched-weekly-rules-input");
  const exceptions = page.getByTestId("sched-exceptions-input");
  const submit = page.getByTestId("sched-submit-button");

  // Use recognizable sentinel values
  await delinquency.fill("33");
  await minPerDay.fill("7");
  await maxPerDay.fill("77");
  await daysPerWeek.fill("4");
  await weeklyRules.fill('{"mon":true,"thu":true}');
  await exceptions.fill('["2025-12-24","2025-12-31"]');

  await expect(submit).toBeEnabled();
  await submit.click();

  // Multiple toasts can exist in strict mode; assert on the last matching toast
  const toast = page
    .getByTestId("shadcn-toast")
    .filter({ hasText: "Scheduling options updated" })
    .last();
  await expect(toast).toBeVisible({ timeout: 15_000 });

  // Reload the page; form should refetch server values (round-trip persistence)
  await page.reload();
  await page.waitForLoadState("domcontentloaded");

  await expect(delinquency).toHaveValue("33");
  await expect(minPerDay).toHaveValue("7");
  await expect(maxPerDay).toHaveValue("77");
  await expect(daysPerWeek).toHaveValue("4");
  await expect(weeklyRules).toHaveValue('{"mon":true,"thu":true}');
  await expect(exceptions).toHaveValue('["2025-12-24","2025-12-31"]');
});
