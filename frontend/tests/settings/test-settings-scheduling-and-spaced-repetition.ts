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

// Configure authentication via storage state
// Assumes STORAGE_STATE_TEST1 exists and is valid
// Adjust viewport for consistency

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
  await page.waitForTimeout(1000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

async function gotoSettings(page: Page, tab: string) {
  const ttPO = new TuneTreesPageObject(page);
  await ttPO.gotoMainPage();
  const userMenuTrigger = page.getByTestId("tt-user-menu-trigger");
  await expect(userMenuTrigger).toBeVisible({ timeout: 30000 });
  await userMenuTrigger.click();
  const userSettingsItem = page.getByTestId("tt-user-settings-menu-item");
  await expect(userSettingsItem).toBeVisible({ timeout: 10000 });
  await userSettingsItem.click();
  if (tab) {
    // Navigate via direct route (kept for simplicity until tab nav component exists)
    await page.goto(`/user-settings/${tab}`);
    await page.waitForLoadState("domcontentloaded");
  }
}

test("update scheduling options", async ({ page }) => {
  await gotoSettings(page, "scheduling-options");

  const delinquencyInput = page.getByTestId(
    "sched-acceptable-delinquency-input",
  );
  await expect(delinquencyInput).toBeVisible();
  await delinquencyInput.fill("25");

  await page.getByTestId("sched-min-per-day-input").fill("5");
  await page.getByTestId("sched-max-per-day-input").fill("40");
  await page.getByTestId("sched-days-per-week-input").fill("6");
  await page
    .getByTestId("sched-weekly-rules-input")
    .fill('{"mon":true,"tue":true,"wed":true}');
  await page
    .getByTestId("sched-exceptions-input")
    .fill('["2025-08-15","2025-08-22"]');

  const updateButton = page.getByTestId("sched-submit-button");
  await expect(updateButton).toBeEnabled();
  await updateButton.click();

  const toasts = page.getByTestId("shadcn-toast");
  // Use last toast to avoid strict mode violation when multiple toasts present
  const toast = toasts.last();
  await expect(toast).toContainText("Scheduling options updated", {
    timeout: 15000,
  });
});

test("optimize FSRS parameters", async ({ page }) => {
  await gotoSettings(page, "spaced-repetition");

  const mainOptimizeButton = page.getByTestId("optimize-params-main-button");
  await expect(mainOptimizeButton).toBeVisible();
  await mainOptimizeButton.click();

  await expect(mainOptimizeButton).toHaveText(/Optimizing.../, {
    timeout: 5000,
  });

  const toast = page.getByTestId("shadcn-toast").last();
  await toast.waitFor({ state: "visible", timeout: 30000 });
  const toastText = (await toast.textContent()) || "";
  expect(toastText.length).toBeGreaterThan(0);
});
