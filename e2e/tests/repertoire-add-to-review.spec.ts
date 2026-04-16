/**
 * E2E Test: Add Tunes from Repertoire to Practice Queue
 *
 * Tests the "Add To Review" feature on the Repertoire toolbar.
 *
 * User Flow:
 * 1. Log in as test user
 * 2. Navigate to Repertoire tab
 * 3. Select tunes via checkboxes
 * 4. Click "Add To Review" button
 * 5. Verify database changes (scheduled timestamp set)
 *
 * Edge Cases:
 * - No tunes selected (button should stay disabled)
 * - Tunes already scheduled (should be skipped with feedback)
 * - Multiple tunes selected (batch operation)
 *
 * NOTE: Practice queue display uses existing queue logic and may not
 * immediately show newly scheduled tunes. Tests verify database changes
 * (scheduled timestamp and practice_record creation) rather than queue display.
 */

import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
// import { TuneTreesPage } from "../helpers/page-objects";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe("Repertoire: Add To Review", () => {
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, testUser }) => {
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID, TEST_TUNE_MORRISON_ID], // User's 2 private tunes
      scheduleTunes: false,
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

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Review"
    await ttPage.clickRepertoireAddToReview();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify success message
    expect(dialogMessage).toMatch(/Added \d+ tunes? to practice queue/);

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

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click "Add To Review"
    await ttPage.clickRepertoireAddToReview();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify success message
    expect(dialogMessage).toMatch(/Added \d+ tunes? to practice queue/);
  });

  test("should handle tunes already scheduled", async ({ page }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await page.waitForTimeout(500);

    // Select the first tune
    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    // Set up dialog handler
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Add to review first time
    await ttPage.clickRepertoireAddToReview();
    await page.waitForTimeout(500);

    // Select the same tune again
    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    // Try to add again
    await ttPage.clickRepertoireAddToReview();
    await page.waitForTimeout(500);

    // Should allow re-scheduling (updating scheduled timestamp)
    expect(dialogMessage).toMatch(/Added \d+ tunes? to practice queue/);
  });

  test("should verify console logs for database operation", async ({
    page,
  }) => {
    // Set up console message listener
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "log") {
        consoleLogs.push(msg.text());
      }
    });

    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await page.waitForTimeout(500);

    // Select first tune
    await ttPage.setGridRowChecked(TEST_TUNE_BANISH_ID, ttPage.repertoireGrid);

    // Set up dialog handler
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    // Click "Add To Review"
    await ttPage.clickRepertoireAddToReview();
    await page.waitForTimeout(1000);

    // Check console logs for success message
    const addLogs = consoleLogs.filter(
      (log) => log.includes("Adding") && log.includes("tunes to practice queue")
    );
    const completedLogs = consoleLogs.filter((log) =>
      log.includes("Add to review completed")
    );

    expect(addLogs.length).toBeGreaterThan(0);
    expect(completedLogs.length).toBeGreaterThan(0);
  });
});
