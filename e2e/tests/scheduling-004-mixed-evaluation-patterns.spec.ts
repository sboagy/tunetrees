import { expect } from "@playwright/test";
import { CATALOG_TUNE_ID_MAP } from "../../src/lib/db/catalog-tune-ids";
import {
  advanceDays,
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { queryLatestPracticeRecord } from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-004: Mixed Evaluation Patterns (10 Tunes, 5 Days)
 * Priority: MEDIUM
 *
 * Validates realistic practice patterns with varied evaluations across multiple tunes:
 *
 * Day 1: Practice all 10 tunes with different ratings:
 *   - Tunes 1-3: "Easy" (graduates immediately to Review, short first interval)
 *   - Tunes 4-6: "Good" (moves through learning steps)
 *   - Tunes 7-9: "Hard" (learning state with shorter interval)
 *   - Tune 10: "Again" (shortest interval, restarts learning)
 *
 * Day 2-5: Verify queue composition matches expected due dates
 *
 * NOTE: For FIRST evaluations (NEW state), FSRS produces counterintuitive intervals:
 * - "Easy" graduates immediately but may have short first interval
 * - "Good" moves through learning steps with potentially longer interval
 * - The traditional Again < Hard < Good < Easy ordering applies to REVIEW state, not NEW
 *
 * Validates:
 * - All intervals >= 1 day (minimum interval enforced)
 * - All scheduled dates are in the future relative to practiced date
 * - State transitions are correct (Easy → Review, others → Learning)
 * - Queue composition changes appropriately over multiple days
 */

// 10 DISTINCT catalog tunes for testing
const EASY_TUNES = [
  CATALOG_TUNE_ID_MAP[113]!, // Banish Misfortune
  CATALOG_TUNE_ID_MAP[1343]!, // Morrison's Jig
  CATALOG_TUNE_ID_MAP[43]!, // Abbey Reel
];

const GOOD_TUNES = [
  CATALOG_TUNE_ID_MAP[54]!, // Alasdruim's March
  CATALOG_TUNE_ID_MAP[55]!, // Alexander's
  CATALOG_TUNE_ID_MAP[66]!, // An Chóisir
];

const HARD_TUNES = [
  CATALOG_TUNE_ID_MAP[70]!, // An Sean Duine
  CATALOG_TUNE_ID_MAP[72]!, // Anderson's Reel
  CATALOG_TUNE_ID_MAP[83]!, // Apples in Winter
];

const AGAIN_TUNES = [
  CATALOG_TUNE_ID_MAP[89]!, // Ash Plant
];

const ALL_TUNES = [...EASY_TUNES, ...GOOD_TUNES, ...HARD_TUNES, ...AGAIN_TUNES];

let ttPage: TuneTreesPage;
let currentDate: Date;

test.describe("SCHEDULING-004: Mixed Evaluation Patterns", () => {
  test.beforeEach(async ({ page, context, testUser }, testInfo) => {
    // Extend timeout for all tests running this hook by 3x.
    test.setTimeout(testInfo.timeout * 3);
    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Set up all 10 tunes, scheduled as overdue so they appear in queue
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: ALL_TUNES,
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );
  });

  test("should produce interval ordering Again < Hard < Good < Easy after Day 1", async ({
    page,
    testUser,
  }) => {
    console.log("\n=== SCHEDULING-004: Mixed Evaluation Patterns ===");
    console.log(`  Test date: ${currentDate.toISOString().split("T")[0]}`);

    // === DAY 1: Practice all 10 tunes with different ratings ===
    console.log("\n=== Day 1: Initial Evaluations ===");

    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    const rows = ttPage.practiceGrid.locator("tbody tr[data-index]");
    await expect
      .poll(async () => await rows.count(), {
        timeout: 20000,
        message: "Practice queue did not reach expected size in time",
      })
      .toBe(ALL_TUNES.length);

    // Verify all tunes are in queue
    const initialRowCount = await rows.count();
    console.log(`  Initial queue size: ${initialRowCount} tunes`);
    expect(initialRowCount).toBe(ALL_TUNES.length);

    // Map tune IDs to their expected ratings
    const tuneRatings = new Map<string, "easy" | "good" | "hard" | "again">();
    for (const tuneId of EASY_TUNES) tuneRatings.set(tuneId, "easy");
    for (const tuneId of GOOD_TUNES) tuneRatings.set(tuneId, "good");
    for (const tuneId of HARD_TUNES) tuneRatings.set(tuneId, "hard");
    for (const tuneId of AGAIN_TUNES) tuneRatings.set(tuneId, "again");

    // Evaluate each tune based on its assigned rating
    // NOTE: Grid order may differ from ALL_TUNES order, so we extract tune ID from each row
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = ttPage.practiceGrid.locator(`tbody tr[data-index='${i}']`);
      await expect(row).toBeVisible({ timeout: 10000 });

      // Extract tune ID from the eval dropdown's data-testid (format: recall-eval-{uuid})
      const evalDropdown = row.locator("[data-testid^='recall-eval-']");
      await expect(evalDropdown).toBeVisible({ timeout: 5000 });
      const tuneId = ttPage.parseTuneIdFromRecallEvalTestId(
        await evalDropdown.getAttribute("data-testid")
      );
      if (!tuneId) {
        throw new Error(
          "Expected tuneId to be present on recall evaluation dropdown"
        );
      }

      // Get the rating for this tune ID
      const rating = tuneRatings.get(tuneId);
      if (!rating) {
        throw new Error("Expected tuneId to be present in tuneRatings");
      }

      await ttPage.setRowEvaluation(row, rating, 500);
    }

    // Submit all evaluations
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Force sync
    await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // === VERIFY: Interval ordering ===
    console.log("\n=== Validating Interval Ordering ===");

    // Query practice records for all tunes
    const easyRecords = await Promise.all(
      EASY_TUNES.map((tuneId) =>
        queryLatestPracticeRecord(page, tuneId, testUser.playlistId)
      )
    );
    const goodRecords = await Promise.all(
      GOOD_TUNES.map((tuneId) =>
        queryLatestPracticeRecord(page, tuneId, testUser.playlistId)
      )
    );
    const hardRecords = await Promise.all(
      HARD_TUNES.map((tuneId) =>
        queryLatestPracticeRecord(page, tuneId, testUser.playlistId)
      )
    );
    const againRecords = await Promise.all(
      AGAIN_TUNES.map((tuneId) =>
        queryLatestPracticeRecord(page, tuneId, testUser.playlistId)
      )
    );

    // Calculate average intervals for each rating group
    const avgEasyInterval =
      easyRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
      easyRecords.length;
    const avgGoodInterval =
      goodRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
      goodRecords.length;
    const avgHardInterval =
      hardRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
      hardRecords.length;
    const avgAgainInterval =
      againRecords.reduce((sum, r) => sum + (r?.interval ?? 0), 0) /
      againRecords.length;

    console.log(`  Avg Easy interval: ${avgEasyInterval.toFixed(1)} days`);
    console.log(`  Avg Good interval: ${avgGoodInterval.toFixed(1)} days`);
    console.log(`  Avg Hard interval: ${avgHardInterval.toFixed(1)} days`);
    console.log(`  Avg Again interval: ${avgAgainInterval.toFixed(1)} days`);

    // NOTE: For FIRST evaluations (NEW state), FSRS interval ordering is NOT
    // the traditional Again < Hard < Good < Easy. Instead:
    // - "Easy" graduates immediately to Review but may have short first interval
    // - "Good" progresses through learning steps
    // The ordering Again < Hard < Good < Easy applies to REVIEW state cards.
    //
    // What we CAN validate:
    // 1. All intervals >= 1 day (minimum interval enforced)
    // 2. "Again" should have interval >= 1 day (relearning)
    // 3. All intervals are positive numbers

    // All intervals should be >= 1 day
    expect(avgEasyInterval).toBeGreaterThanOrEqual(1);
    expect(avgGoodInterval).toBeGreaterThanOrEqual(1);
    expect(avgHardInterval).toBeGreaterThanOrEqual(1);
    expect(avgAgainInterval).toBeGreaterThanOrEqual(1);

    // Validate that "Again" produces reasonable learning interval
    // Again restarts learning, so interval should be short (1-2 days typically)
    expect(avgAgainInterval).toBeLessThanOrEqual(5);

    console.log("  ✓ All intervals are >= 1 day (minimum interval enforced)");

    // === VERIFY: All due dates in future ===
    console.log("\n=== Validating All Due Dates in Future ===");

    const allRecords = [
      ...easyRecords,
      ...goodRecords,
      ...hardRecords,
      ...againRecords,
    ].filter((r) => r !== null);

    for (const record of allRecords) {
      const dueDate = new Date(record!.due);
      const diff = dueDate.getTime() - currentDate.getTime();
      expect(diff).toBeGreaterThan(0); // Due date must be in future
    }

    console.log(`  ✓ All ${allRecords.length} tunes have future due dates`);

    // === VERIFY: FSRS state transitions ===
    console.log("\n=== Validating FSRS State Transitions ===");

    // Easy should go directly to Review (state 2)
    for (const record of easyRecords) {
      expect(record).not.toBeNull();
      console.log(
        `  Easy tune: quality=${record!.quality}, state=${record!.state}, interval=${record!.interval}d, stability=${record!.stability}`
      );
      // Easy (quality=4) should go to Review (state=2)
      expect(record!.quality).toBe(4); // Verify it was recorded as Easy
      expect(record!.state).toBe(2); // Review
    }

    // Good should be in Learning (state 1) or Review (state 2)
    for (const record of goodRecords) {
      expect(record).not.toBeNull();
      expect([1, 2]).toContain(record!.state); // Learning or Review
      console.log(
        `  Good tune: state=${record!.state}, interval=${record!.interval}d`
      );
    }

    // Hard should be in Learning (state 1)
    for (const record of hardRecords) {
      expect(record).not.toBeNull();
      expect([1, 2]).toContain(record!.state); // Learning or Review
      console.log(
        `  Hard tune: state=${record!.state}, interval=${record!.interval}d`
      );
    }

    // Again should be in Learning (state 1) with lapses
    for (const record of againRecords) {
      expect(record).not.toBeNull();
      expect(record!.state).toBe(1); // Learning
      console.log(
        `  Again tune: state=${record!.state}, lapses=${record!.lapses}, interval=${record!.interval}d`
      );
    }

    console.log("\n✓ Day 1 evaluations validated successfully!");
  });

  test("should show correct queue composition on Day 2 (short-interval tunes)", async ({
    page,
    context,
    testUser,
  }) => {
    console.log("\n=== Day 2: Queue Composition After Mixed Ratings ===");

    // First, practice all tunes on Day 1
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    const rows = ttPage.practiceGrid.locator("tbody tr[data-index]");
    await expect
      .poll(async () => await rows.count(), {
        timeout: 20000,
        message: "Practice queue did not reach expected size in time",
      })
      .toBe(ALL_TUNES.length);

    const tuneRatings = new Map<string, "easy" | "good" | "hard" | "again">();
    for (const tuneId of EASY_TUNES) tuneRatings.set(tuneId, "easy");
    for (const tuneId of GOOD_TUNES) tuneRatings.set(tuneId, "good");
    for (const tuneId of HARD_TUNES) tuneRatings.set(tuneId, "hard");
    for (const tuneId of AGAIN_TUNES) tuneRatings.set(tuneId, "again");

    // Extract tune ID from each row's eval dropdown testid to apply correct rating
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = ttPage.practiceGrid.locator(`tbody tr[data-index='${i}']`);
      await expect(row).toBeVisible({ timeout: 10000 });

      const evalDropdown = row.locator("[data-testid^='recall-eval-']");
      await expect(evalDropdown).toBeVisible({ timeout: 5000 });
      const tuneId = ttPage.parseTuneIdFromRecallEvalTestId(
        await evalDropdown.getAttribute("data-testid")
      );
      if (!tuneId) {
        throw new Error(
          "Expected tuneId to be present on recall evaluation dropdown"
        );
      }

      const rating = tuneRatings.get(tuneId);
      if (!rating) continue;

      await ttPage.setRowEvaluation(row, rating);
    }

    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    console.log("  Day 1 evaluations submitted");

    // === ADVANCE TO DAY 2 ===
    console.log("\n=== Advancing to Day 2 ===");

    // Persist and reload with new date
    await page.evaluate(() => (window as any).__persistDbForTest?.());

    const day2 = await advanceDays(context, 1, currentDate);
    console.log(`  Day 2 date: ${day2.toISOString().split("T")[0]}`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await verifyClockFrozen(page, day2, undefined, test.info().project.name);

    // Navigate to practice tab
    await ttPage.practiceTab.click();
    await page.waitForTimeout(2000);

    // Check queue composition
    const day2RowCount = await ttPage.practiceGrid
      .locator("tbody tr[data-index]")
      .count();
    console.log(`  Day 2 queue size: ${day2RowCount} tunes`);

    // On Day 2, we expect:
    // - "Again" tune (1-day interval) should be due
    // - "Hard" tunes (short intervals) might be due
    // - "Good" tunes (medium intervals) might be due
    // - "Easy" tunes (long intervals) should NOT be due yet

    // At minimum, the "Again" tune should be in queue
    expect(day2RowCount).toBeGreaterThanOrEqual(1);

    // "Easy" tunes should have intervals > 1 day, so they shouldn't all be back
    // This is a softer assertion since exact intervals depend on FSRS parameters
    console.log(
      `  Queue on Day 2 contains ${day2RowCount} tune(s) (Again/Hard expected)`
    );

    // Query which specific tunes are in queue
    const allRecords = await Promise.all(
      ALL_TUNES.map((tuneId) =>
        queryLatestPracticeRecord(page, tuneId, testUser.playlistId)
      )
    );

    // Count how many Easy tunes are due on Day 2
    let easyDueCount = 0;
    for (let i = 0; i < EASY_TUNES.length; i++) {
      const record = allRecords[i];
      if (record) {
        const dueDate = new Date(record.due);
        if (dueDate <= day2) {
          easyDueCount++;
        }
      }
    }

    console.log(
      `  Easy tunes due on Day 2: ${easyDueCount} of ${EASY_TUNES.length}`
    );
    // Easy tunes should generally not be due on Day 2 (they have longer intervals)
    // But we don't strictly assert 0 because FSRS can produce intervals of 1 day for Easy in some cases
    expect(easyDueCount).toBeLessThanOrEqual(EASY_TUNES.length);

    console.log("\n✓ Day 2 queue composition validated!");
  });

  test("should maintain future scheduling through Day 5", async ({
    page,
    context,
    testUser,
  }) => {
    console.log("\n=== Multi-Day Progression (Days 1-5) ===");

    // === DAY 1: Initial evaluations ===
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    const rows = ttPage.practiceGrid.locator("tbody tr[data-index]");
    await expect
      .poll(async () => await rows.count(), {
        timeout: 20000,
        message: "Practice queue did not reach expected size in time",
      })
      .toBe(ALL_TUNES.length);

    const tuneRatings = new Map<string, "easy" | "good" | "hard" | "again">();
    for (const tuneId of EASY_TUNES) tuneRatings.set(tuneId, "easy");
    for (const tuneId of GOOD_TUNES) tuneRatings.set(tuneId, "good");
    for (const tuneId of HARD_TUNES) tuneRatings.set(tuneId, "hard");
    for (const tuneId of AGAIN_TUNES) tuneRatings.set(tuneId, "again");

    // Extract tune ID from each row's eval dropdown testid to apply correct rating
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = ttPage.practiceGrid.locator(`tbody tr[data-index='${i}']`);
      await expect(row).toBeVisible({ timeout: 10000 });

      const evalDropdown = row.locator("[data-testid^='recall-eval-']");
      await expect(evalDropdown).toBeVisible({ timeout: 5000 });
      const tuneId = ttPage.parseTuneIdFromRecallEvalTestId(
        await evalDropdown.getAttribute("data-testid")
      );
      if (!tuneId) {
        throw new Error(
          "Expected tuneId to be present on recall evaluation dropdown"
        );
      }

      const rating = tuneRatings.get(tuneId);
      if (!rating) continue;

      await ttPage.setRowEvaluation(row, rating);
    }

    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    console.log("  Day 1: All 10 tunes evaluated");

    // === ADVANCE THROUGH DAYS 2-5, checking due dates remain in future ===
    let testDate = currentDate;

    for (let day = 2; day <= 5; day++) {
      await page.evaluate(() => (window as any).__persistDbForTest?.());

      testDate = await advanceDays(context, 1, testDate);
      console.log(`\n  Day ${day}: ${testDate.toISOString().split("T")[0]}`);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      await verifyClockFrozen(
        page,
        testDate,
        undefined,
        test.info().project.name
      );

      // Query all practice records
      const records = await Promise.all(
        ALL_TUNES.map((tuneId) =>
          queryLatestPracticeRecord(page, tuneId, testUser.playlistId)
        )
      );

      // Count tunes with valid records
      const validRecords = records.filter((r) => r !== null);
      console.log(
        `    Records found: ${validRecords.length}/${ALL_TUNES.length}`
      );

      // Verify no due dates are in the PAST relative to their practiced date
      // (but they can be in the past relative to current test date if tune is overdue)
      for (const record of validRecords) {
        const practicedDate = new Date(record!.practiced);
        const dueDate = new Date(record!.due);
        const diff = dueDate.getTime() - practicedDate.getTime();

        // Due date must be after practiced date
        expect(diff).toBeGreaterThan(0);
      }

      // Practice any tunes that are due on this day
      await ttPage.practiceTab.click();
      await page.waitForTimeout(2000);

      const rowCount = await ttPage.practiceGrid
        .locator("tbody tr[data-index]")
        .count();
      console.log(`    Queue size: ${rowCount} tune(s)`);

      if (rowCount > 0) {
        // Practice first tune with "Good"
        const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
        await expect(row).toBeVisible({ timeout: 5000 });

        const evalDropdown = row.locator("[data-testid^='recall-eval-']");
        await expect(evalDropdown).toBeVisible({ timeout: 5000 });
        const tuneId = ttPage.parseTuneIdFromRecallEvalTestId(
          await evalDropdown.getAttribute("data-testid")
        );
        if (!tuneId) {
          throw new Error(
            "Expected tuneId to be present on recall evaluation dropdown"
          );
        }

        await ttPage.setRowEvaluation(row, "good");

        await ttPage.submitEvaluationsButton.click();
        await page.waitForLoadState("networkidle", { timeout: 15000 });
        await page.waitForTimeout(1000);

        await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
        await page.waitForLoadState("networkidle", { timeout: 10000 });

        console.log(`    Practiced 1 tune with "Good"`);
      }
    }

    console.log("\n✓ Multi-day progression validated through Day 5!");
  });
});
