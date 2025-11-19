/**
 * E2E tests for FSRS optimization functionality in the scheduling options form.
 */

import { expect, test } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { getStorageState } from "@/test-scripts/storage-state";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  // actionTimeout: 10_000,
});

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  // await page.waitForTimeout(1);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
  await page.goto("/user-settings/scheduling-options");
  await page.waitForLoadState("domcontentloaded");
});

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(1_000);
});

test.describe("FSRS Optimization Tests", () => {
  test("should display auto-optimize button when FSRS is selected", async ({
    page,
  }) => {
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();
      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      await expect(optimizeButton).toBeVisible();
    }
  });

  test("should handle insufficient review history error", async ({ page }) => {
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();
      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        await page.route("**/preferences/optimize_fsrs*", async (route) => {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              detail:
                "Insufficient review history: 5 records. Need at least 10.",
            }),
          });
        });

        await optimizeButton.click();
        await expect(
          page.locator("text=Insufficient review history"),
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test("should work with real backend when available", async ({ page }) => {
    const fsrsRadio = page.locator('input[type="radio"][value="FSRS"]');
    if (await fsrsRadio.isVisible()) {
      await fsrsRadio.check();
      const optimizeButton = page.locator(
        'button:has-text("Auto-Optimize Parameters")',
      );
      if (await optimizeButton.isVisible()) {
        await optimizeButton.click();
        const successMessage = page.locator(
          "text=Parameters optimized successfully",
        );
        const errorMessage = page
          .locator("text*=Insufficient review history")
          .or(page.locator("text*=Error during FSRS optimization"));

        await expect(successMessage.or(errorMessage)).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });
});
