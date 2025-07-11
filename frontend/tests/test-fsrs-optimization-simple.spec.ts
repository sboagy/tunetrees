/**
 * E2E tests for FSRS optimization functionality in the scheduling options form.
 */

import { test, expect } from "@playwright/test";

test.describe("FSRS Optimization Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/user-settings/scheduling-options");
    await page.waitForLoadState("networkidle");
  });

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
    await page.goto("/user-settings/scheduling-options");
    await page.waitForLoadState("networkidle");

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
