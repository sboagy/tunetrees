/**
 * E2E Test: Add To Review - ACTUAL FUNCTIONALITY TEST
 *
 * This test verifies that "Add To Review" ACTUALLY WORKS:
 * 1. Selects specific tunes from repertoire
 * 2. Adds them to practice queue
 * 3. Verifies those EXACT TUNES appear in the practice tab
 * 4. Verifies they are appended to today's practice queue without writing
 *    manual schedule overrides
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
import {
  queryPracticeQueue,
  queryScheduledDates,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

async function setInjectedTestUserId(
  page: import("@playwright/test").Page,
  userId: string
) {
  await page.addInitScript((id) => {
    (window as unknown as { __ttTestUserId?: string }).__ttTestUserId = id;
  }, userId);
  await page.evaluate((id) => {
    (window as unknown as { __ttTestUserId?: string }).__ttTestUserId = id;
  }, userId);
}

test.describe("Repertoire: Add To Review - FUNCTIONALITY TEST", () => {
  let ttPage: TuneTreesPage;

  let currentDate: Date;
  const expectedTuneTitles = ["Abbey Reel", "Alexander's", "Morrison's Jig"];

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);
    await setInjectedTestUserId(page, testUser.userId);

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
    testUser,
  }) => {
    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");

    await ttPage.expectGridHasContent(ttPage.repertoireGrid);
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_ABBY_REEL,
      ttPage.repertoireGrid
    );
    await page.waitForTimeout(200);
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_ALEXANDERS_ID,
      ttPage.repertoireGrid
    );
    await page.waitForTimeout(200);
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_MORRISON_ID,
      ttPage.repertoireGrid
    );
    await page.waitForTimeout(200);

    console.log("✅ Selected 3 tunes from repertoire");

    // Click "Add To Review"
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      console.log("Dialog message:", dialog.message());
      await dialog.accept();
    });
    await ttPage.clickRepertoireAddToReview();

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
    for (const title of expectedTuneTitles) {
      await ttPage.expectTuneVisible(title, ttPage.practiceGrid, 8000);
    }

    console.log(`✅ All 3 tunes found in practice queue!`);
    // Add To Review appends the tunes directly to today's queue; it must NOT
    // write a manual scheduled override. Verify the queue entries exist and the
    // underlying scheduled column remains null for each selected tune.
    const expectedTuneIds = [
      CATALOG_TUNE_ABBY_REEL,
      CATALOG_TUNE_ALEXANDERS_ID,
      CATALOG_TUNE_MORRISON_ID,
    ];
    const queue = await queryPracticeQueue(page, testUser.repertoireId);
    const activeQueueTuneIds = queue
      .filter((item) => item.completed_at === null)
      .map((item) => item.tune_ref)
      .sort();

    expect(activeQueueTuneIds).toEqual([...expectedTuneIds].sort());

    const scheduledDates = await queryScheduledDates(
      page,
      testUser.repertoireId,
      expectedTuneIds
    );
    for (const tuneId of expectedTuneIds) {
      expect(scheduledDates.get(tuneId)?.scheduled ?? null).toBeNull();
    }

    await runTestHook(page, "__persistDbForTest");

    // RELOAD THE PAGE
    console.log("🔄 Reloading page...");
    await page.reload();
    await setInjectedTestUserId(page, testUser.userId);

    // Navigate back to Practice tab
    await ttPage.navigateToTab("practice");
    await waitForPracticeViewSettled(page, ttPage, {
      expectRows: true,
      timeoutMs: 20000,
    });

    // CRITICAL: Verify those EXACT 3 tunes STILL appear after reload
    console.log("🔍 Verifying tunes persist after reload...");

    for (const title of expectedTuneTitles) {
      await ttPage.expectTuneVisible(title, ttPage.practiceGrid, 5000);
    }

    const reloadedQueue = await queryPracticeQueue(page, testUser.repertoireId);
    const reloadedActiveTuneIds = reloadedQueue
      .filter((item) => item.completed_at === null)
      .map((item) => item.tune_ref)
      .sort();
    expect(reloadedActiveTuneIds).toEqual([...expectedTuneIds].sort());

    console.log(`✅ PASS: All 3 tunes persist after reload!`);
  });
});
