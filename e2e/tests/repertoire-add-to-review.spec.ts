/** Regression coverage for Add To Review feedback and duplicate handling. */

import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe("Repertoire: Add To Review", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID, TEST_TUNE_MORRISON_ID], // User's 2 private tunes
      scheduleTunes: true,
      scheduleDaysAgo: -30,
    });

    ttPage = new TuneTreesPage(page);
  });

  test("should keep Add To Review disabled until rows are selected", async ({
    page,
  }) => {
    const isMobileChrome = test.info().project.name === "Mobile Chrome";

    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await page.waitForTimeout(500);

    if (isMobileChrome) {
      await ttPage.repertoireColumnsButton.click();
    }
    await expect(ttPage.repertoireAddToReviewButton).toBeDisabled();

    if (isMobileChrome) {
      await page.keyboard.press("Escape").catch(() => undefined);
    }

    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    if (isMobileChrome) {
      await ttPage.repertoireColumnsButton.click();
    }
    await expect(ttPage.repertoireAddToReviewButton).toBeEnabled();
  });

  test("should add selected tunes to practice queue", async ({ page }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await page.waitForTimeout(500);

    // Select first tune in repertoire (should exist from test setup)
    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    // Verify selection count
    await expect(page.getByText(/1 tune selected/)).toBeVisible();

    // Click "Add To Review"
    await ttPage.clickRepertoireAddToReview();

    await expect(
      page.getByText(/Added \d+ tunes? to practice queue/)
    ).toBeVisible({ timeout: 10000 });

    // Verify selection was cleared by checking selection count disappeared
    await expect(page.getByText(/\d+ tunes? selected/)).not.toBeVisible({
      timeout: 3000,
    });
  });

  test("should handle multiple tunes selection", async ({ page }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await page.waitForTimeout(500);

    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);
    await ttPage.setGridRowChecked(
      TEST_TUNE_MORRISON_ID,
      ttPage.repertoireGrid
    );

    // Verify selection count
    await expect(page.getByText(/2 tunes selected/)).toBeVisible();

    // Click "Add To Review"
    await ttPage.clickRepertoireAddToReview();

    await expect(
      page.getByText(/Added \d+ tunes? to practice queue/)
    ).toBeVisible({ timeout: 10000 });
  });

  test("should skip tunes already in the queue", async ({ page }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await page.waitForTimeout(500);

    // Select the first tune
    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    // Wait for the durable result before selecting the same tune again.
    await ttPage.clickRepertoireAddToReview();
    await expect(
      page.getByText("Added 1 tune to practice queue.", { exact: true })
    ).toBeVisible({ timeout: 10000 });

    // Select the same tune again
    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    // Try to add again
    await ttPage.clickRepertoireAddToReview();
    await page.waitForTimeout(500);

    await expect(
      page.getByText("1 tune is already in this queue.", { exact: true })
    ).toBeVisible({ timeout: 10000 });
  });
});
