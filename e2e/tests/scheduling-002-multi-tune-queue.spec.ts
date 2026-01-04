import { expect } from "@playwright/test";
import { CATALOG_TUNE_ID_MAP } from "../../src/lib/db/catalog-tune-ids";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { queryPracticeRecords } from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-002: Multi-Tune Queue Management (10 Tunes, 2 Days)
 * Priority: HIGH
 *
 * Validates queue generation and prioritization with multiple tunes:
 * - Queue contains all seeded tunes on Day 1
 * - Submitting evaluations removes tunes from queue (until next due date)
 * - Practice records are created for each tune
 *
 * Uses a subset of 10 distinct catalog tunes.
 */

// Use 10 DISTINCT catalog tunes for testing
const TEST_TUNES = [
  CATALOG_TUNE_ID_MAP[113]!, // Banish Misfortune
  CATALOG_TUNE_ID_MAP[1343]!, // Morrison's Jig
  CATALOG_TUNE_ID_MAP[43]!, // Abbey Reel
  CATALOG_TUNE_ID_MAP[54]!, // Alasdruim's March
  CATALOG_TUNE_ID_MAP[55]!, // Alexander's
  CATALOG_TUNE_ID_MAP[66]!, // An Chóisir
  CATALOG_TUNE_ID_MAP[70]!, // An Sean Duine
  CATALOG_TUNE_ID_MAP[72]!, // Anderson's Reel
  CATALOG_TUNE_ID_MAP[83]!, // Apples in Winter
  CATALOG_TUNE_ID_MAP[89]!, // Ash Plant
];

test.describe("SCHEDULING-002: Multi-Tune Queue Management", () => {
  test.setTimeout(180000); // Multi-tune test

  let ttPage: TuneTreesPage;
  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Set up 10 tunes, all scheduled as "overdue" so they appear in queue
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: TEST_TUNES,
      scheduleDaysAgo: 1, // Due yesterday (overdue)
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    // Verify clock is frozen
    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );
  });

  test.skip("should manage queue correctly with multiple tunes", async ({
    page,
  }) => {
    // === STEP 1: Verify all tunes in queue initially ===
    console.log("\n=== Step 1: Initial Queue Check ===");

    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    // Count rows in practice grid
    const initialRowCount = await ttPage.practiceGrid
      .locator("tbody tr[data-index]")
      .count();
    console.log(`  Initial queue size: ${initialRowCount} tunes`);

    // All 10 tunes should be in the queue
    expect(initialRowCount).toBe(TEST_TUNES.length);

    // === STEP 2: Practice first 5 tunes ===
    console.log("\n=== Step 2: Practice First 5 Tunes ===");

    const ratings: Array<"good" | "easy" | "hard"> = [
      "good",
      "easy",
      "good",
      "hard",
      "easy",
    ];

    for (let i = 0; i < ratings.length; i++) {
      const rating = ratings[i];

      // Select the row by its index - each tune is on a different row
      const row = ttPage.practiceGrid.locator(`tbody tr[data-index='${i}']`);
      await expect(row).toBeVisible({ timeout: 10000 });

      // Select evaluation - the dropdown testid includes the tune ID
      await page.waitForTimeout(1000);
      await ttPage.setRowEvaluation(row, rating, 700);

      console.log(`  Tune ${i + 1}: Evaluated as "${rating}"`);
    }
    await page.waitForTimeout(500);

    // Submit all staged evaluations
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Force sync
    await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // === STEP 3: Verify queue reduced after submission ===
    console.log("\n=== Step 3: Verify Queue Reduced ===");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await page.waitForTimeout(700);
    const afterFirstBatchCount = await ttPage.practiceGrid
      .locator("tbody tr[data-index]")
      .count();
    console.log(
      `  After first batch submissions: ${afterFirstBatchCount} tunes remain`
    );

    // Should have fewer tunes (practiced tunes should be removed)
    expect(afterFirstBatchCount).toBeLessThan(initialRowCount);
    // At minimum, we should have 5 remaining (the unpracticed ones)
    expect(afterFirstBatchCount).toBeGreaterThanOrEqual(
      TEST_TUNES.length - ratings.length
    );

    // === STEP 4: Practice remaining tunes ===
    console.log("\n=== Step 4: Practice Remaining Tunes ===");

    const remainingRatings: Array<"good" | "easy"> = [];
    for (let i = 0; i < afterFirstBatchCount; i++) {
      remainingRatings.push(i % 2 === 0 ? "good" : "easy");
    }

    for (let i = 0; i < afterFirstBatchCount; i++) {
      const rating = remainingRatings[i];

      const row = ttPage.practiceGrid.locator(`tbody tr[data-index='${i}']`);
      await expect(row).toBeVisible({ timeout: 10000 });

      await page.waitForTimeout(1000);
      await ttPage.setRowEvaluation(row, rating, 700);

      console.log(`  Tune ${i + 1}: Evaluated as "${rating}"`);
    }

    await page.waitForTimeout(500);
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // === STEP 5: Verify practice records exist ===
    console.log("\n=== Step 5: Verify Practice Records ===");

    // Query all practice records
    const allRecords = await queryPracticeRecords(page, TEST_TUNES);
    console.log(`  Total practice records found: ${allRecords.length}`);

    // Should have at least 10 records (one per tune)
    // Note: Some tunes might have been practiced twice if their new scheduled
    // date fell within today's queue window
    expect(allRecords.length).toBeGreaterThanOrEqual(TEST_TUNES.length);

    // All intervals should be >= 1 day (FSRS minimum)
    for (const record of allRecords) {
      expect(record.interval).toBeGreaterThanOrEqual(1);
    }

    // Verify we have records for each tune
    const tuneTouchCount = new Map<string, number>();
    for (const record of allRecords) {
      const count = tuneTouchCount.get(record.tune_ref) || 0;
      tuneTouchCount.set(record.tune_ref, count + 1);
    }
    console.log(`  Unique tunes with records: ${tuneTouchCount.size}`);

    // Each of our 10 tunes should have at least one practice record
    expect(tuneTouchCount.size).toBe(TEST_TUNES.length);

    // Calculate interval statistics
    const intervals = allRecords.map((r) => r.interval);
    const avgInterval =
      intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    console.log(
      `  Average interval: ${avgInterval.toFixed(1)} days (range: ${Math.min(...intervals)}-${Math.max(...intervals)})`
    );

    console.log("\n✓ Multi-tune queue management validated successfully!");
  });
});
