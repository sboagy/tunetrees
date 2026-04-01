/**
 * E2E Test: Add To Review - ACTUAL FUNCTIONALITY TEST
 *
 * This test verifies that "Add To Review" ACTUALLY WORKS:
 * 1. Selects specific tunes from repertoire
 * 2. Adds them to practice queue
 * 3. Verifies those EXACT TUNES appear in the practice tab
 * 4. Verifies they have TODAY'S date as scheduled
 * 5. Verifies they persist after reload
 */

import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_ABBY_REEL,
  CATALOG_TUNE_ALEXANDERS_ID,
  CATALOG_TUNE_MORRISON_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import {
  runTestHook,
  waitForPracticeViewSettled,
} from "../helpers/practice-view";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

test.describe("Repertoire: Add To Review - FUNCTIONALITY TEST", () => {
  let ttPage: TuneTreesPage;

  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Setup with 3 known tunes in repertoire
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [
        CATALOG_TUNE_ABBY_REEL,
        CATALOG_TUNE_ALEXANDERS_ID,
        CATALOG_TUNE_MORRISON_ID,
      ], // User's private tune, Morrison's Jig, tune 54
    });
  });

  test("CRITICAL: Add To Review must actually add the selected tunes to practice queue", async ({
    page,
  }) => {
    if (test.info().project.name === "Mobile Chrome") {
      console.log(
        "FIXME: Test needs to be adapted for mobile, skipping for now!"
      );
      return;
    }
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");

    // Wait for table to load - use data-index to get actual rows
    await page.waitForSelector("tbody tr[data-index]", {
      state: "visible",
      timeout: 10000,
    });

    // Get the NAMES of the first 3 tunes we're going to select
    const rows = page.locator("tbody tr[data-index]");
    const tune1Name = await rows.nth(0).locator("td").nth(1).textContent(); // Title is 2nd column
    const tune2Name = await rows.nth(1).locator("td").nth(1).textContent();
    const tune3Name = await rows.nth(2).locator("td").nth(1).textContent();

    console.log(
      `📝 Selecting tunes: "${tune1Name}", "${tune2Name}", "${tune3Name}"`
    );

    // Select those 3 tunes
    const checkboxes = page.locator(
      'input[type="checkbox"][aria-label^="Select row"]'
    );
    await checkboxes.nth(0).check();
    await page.waitForTimeout(200);
    await checkboxes.nth(1).check();
    await page.waitForTimeout(200);
    await checkboxes.nth(2).check();
    await page.waitForTimeout(200);

    console.log("✅ Selected 3 tunes from repertoire");

    // Click "Add To Review"
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      console.log("Dialog message:", dialog.message());
      await dialog.accept();
    });
    await page.getByTestId("add-to-review-button").click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Verify dialog shows correct count
    expect(dialogMessage).toMatch(/Added \d+ tune/);
    const addedCount = Number.parseInt(
      dialogMessage.match(/Added (\d+)/)?.[1] || "0",
      10
    );
    console.log(`📨 Dialog says added: ${addedCount} tunes`);
    expect(addedCount).toBe(3);

    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Navigate to Practice tab
    await ttPage.navigateToTab("practice");

    // Select "Today" from queue date picker to trigger queue display
    const queueButton = page.getByRole("button", {
      name: /Select practice queue date/i,
    });
    if (await queueButton.isVisible()) {
      await queueButton.click();
      await page.getByRole("button", { name: /^Today$/ }).click();
    }

    await waitForPracticeViewSettled(page, ttPage, {
      expectRows: true,
      timeoutMs: 20000,
    });

    // CRITICAL: Verify those EXACT 3 tunes appear in the practice queue
    console.log("🔍 Verifying the selected tunes appear in practice queue...");

    // const practiceTable = page.locator(
    //   '[data-testid="tunes-grid-scheduled"] table tbody'
    // );

    // Look for each tune by name in the practice tab
    // const tune1InPractice = practiceTable.locator(`text="${tune1Name}"`);
    // const tune2InPractice = practiceTable.locator(`text="${tune2Name}"`);
    // const tune3InPractice = practiceTable.locator(`text="${tune3Name}"`);
    const tune1InPractice = page.getByRole("cell", { name: `${tune1Name}` });
    const tune2InPractice = page.getByRole("cell", { name: `${tune2Name}` });
    const tune3InPractice = page.getByRole("cell", { name: `${tune3Name}` });

    await expect(tune1InPractice).toBeVisible({ timeout: 8000 });
    await expect(tune2InPractice).toBeVisible({ timeout: 8000 });
    await expect(tune3InPractice).toBeVisible({ timeout: 8000 });

    console.log(`✅ All 3 tunes found in practice queue!`);
    // Verify they are scheduled for today (not "Never" or some past date)
    // Check that at least one of them shows today's date or "Today" in scheduled column
    const todayText = ttPage
      .getRows("scheduled")
      .getByRole("cell", { name: "Today", exact: true });
    const todayCount = await todayText.count();

    console.log(`📅 Found ${todayCount} tunes scheduled for "Today"`);
    expect(todayCount).toBe(3);

    await runTestHook(page, "__persistDbForTest");

    // RELOAD THE PAGE
    console.log("🔄 Reloading page...");
    await page.reload();

    // Navigate back to Practice tab
    await ttPage.navigateToTab("practice");
    await waitForPracticeViewSettled(page, ttPage, {
      expectRows: true,
      timeoutMs: 20000,
    });

    // CRITICAL: Verify those EXACT 3 tunes STILL appear after reload
    console.log("🔍 Verifying tunes persist after reload...");

    await expect(tune1InPractice).toBeVisible({ timeout: 5000 });
    await expect(tune2InPractice).toBeVisible({ timeout: 5000 });
    await expect(tune3InPractice).toBeVisible({ timeout: 5000 });

    console.log(`✅ PASS: All 3 tunes persist after reload!`);
  });
});
