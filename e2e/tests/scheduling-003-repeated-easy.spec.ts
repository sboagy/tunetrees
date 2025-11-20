import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import {
  advanceDays,
  expectDateClose,
  setStableDate,
  STANDARD_TEST_DATE,
  verifyClockFrozen,
} from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import {
  queryLatestPracticeRecord,
  queryPracticeRecords,
  validateIncreasingIntervals,
  validateScheduledDatesInFuture,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-003: Repeated "Easy" Evaluations
 * Priority: HIGHEST
 *
 * Reproduces reported bug: "Easy" evaluations not advancing scheduling dates properly.
 * When marking a tune as "Easy" repeatedly over multiple days, scheduled dates should
 * continue advancing exponentially into the future, not staying stuck at "today".
 *
 * Test validates:
 * - Each "Easy" evaluation produces longer interval than previous
 * - Scheduled dates continue advancing into future (no "today" loop)
 * - Final scheduled date is weeks/months in future
 * - All intervals >= 1 day (minimum constraint respected)
 * - Exponential growth pattern (interval[9] > interval[0] * 5)
 */

let ttPage: TuneTreesPage;
let currentDate: Date;

test.describe("SCHEDULING-003: Repeated Easy Evaluations", () => {
  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Set up ONE tune for repeated evaluation
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1, // Due yesterday (overdue)
      startTab: "practice",
    });

    // Verify clock is frozen
    await verifyClockFrozen(page, currentDate, undefined, test.info().project.name);
  });

  test("should advance scheduling dates with repeated Easy evaluations over 10 days", async ({
    page,
    context,
    testUser,
  }) => {
    const intervals: number[] = [];
    const scheduledDates: Date[] = [];
    const difficulties: number[] = [];
    const stabilities: number[] = [];

    // Enable flashcard mode for easier evaluation
    await ttPage.enableFlashcardMode();
    await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });

    // Day 1-10: Mark tune as "Easy" each day
    for (let day = 1; day <= 10; day++) {
      console.log(`\n=== Day ${day} (${currentDate.toISOString().split("T")[0]}) ===`);

      // Ensure practice queue has loaded
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

      // Verify flashcard counter shows 1 tune
      const counter = ttPage.flashcardHeaderCounter;
      await expect(counter).toContainText("1 of 1", { timeout: 5000 });

      // Select "Easy" evaluation
      await ttPage.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(500); // Allow staging to process

      // Submit evaluation
      await ttPage.submitEvaluationsButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await page.waitForTimeout(2000); // Allow sync to complete

      // Query latest practice record to get FSRS metrics
      const playlistId = testUser.defaultPlaylistIdInt;
      const record = await queryLatestPracticeRecord(
        page,
        TEST_TUNE_BANISH_ID,
        playlistId
      );

      console.log(`  Interval: ${record.interval} days`);
      console.log(`  Scheduled: ${record.due}`);
      console.log(`  Stability: ${record.stability}`);
      console.log(`  Difficulty: ${record.difficulty}`);

      // Record metrics
      intervals.push(record.interval);
      scheduledDates.push(new Date(record.due));
      difficulties.push(record.difficulty);
      stabilities.push(record.stability);

      // === CRITICAL VALIDATIONS PER DAY ===

      // 1. Scheduled date must be in the future (not past, not today)
      const scheduledDate = new Date(record.due);
      const daysDiff = Math.floor(
        (scheduledDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeGreaterThanOrEqual(
        1,
        `Day ${day}: Scheduled date must be at least 1 day in future. ` +
          `Current: ${currentDate.toISOString()}, Scheduled: ${scheduledDate.toISOString()}`
      );

      // 2. Interval must increase from previous day
      if (day > 1) {
        expect(intervals[day - 1]).toBeGreaterThan(
          intervals[day - 2],
          `Day ${day}: Interval (${intervals[day - 1]}) should be greater than ` +
            `previous interval (${intervals[day - 2]})`
        );

        // Scheduled date must advance from previous day
        expect(scheduledDates[day - 1].getTime()).toBeGreaterThan(
          scheduledDates[day - 2].getTime(),
          `Day ${day}: Scheduled date should advance from previous day`
        );
      }

      // 3. Stability should generally increase with "Easy"
      // (FSRS may occasionally decrease stability after lapse, but trend should be upward)
      if (day > 1 && stabilities[day - 1] < stabilities[day - 2]) {
        console.warn(
          `  ⚠️  Stability decreased: ${stabilities[day - 2]} → ${stabilities[day - 1]}`
        );
      }

      // Advance to next day if not final iteration
      if (day < 10) {
        currentDate = await advanceDays(context, 1, currentDate);
        await verifyClockFrozen(page, currentDate, undefined, test.info().project.name);

        // Reload page to pick up new date
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2000); // Allow sync

        // Navigate back to practice tab and re-enable flashcard mode
        await ttPage.navigateToTab("practice");
        await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
        await ttPage.enableFlashcardMode();
        await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });
      }
    }

    // === FINAL VALIDATIONS AFTER 10 DAYS ===

    console.log("\n=== Final Validation ===");
    console.log("Intervals:", intervals);
    console.log(
      "Scheduled dates:",
      scheduledDates.map((d) => d.toISOString().split("T")[0])
    );
    console.log("Stabilities:", stabilities);
    console.log("Difficulties:", difficulties);

    // 1. All intervals >= 1 day (minimum constraint)
    intervals.forEach((interval, idx) => {
      expect(interval).toBeGreaterThanOrEqual(
        1,
        `Day ${idx + 1}: Interval must be >= 1 day (got ${interval})`
      );
    });

    // 2. Validate increasing intervals across all days
    validateIncreasingIntervals(intervals, 1.1); // At least 10% growth each time

    // 3. Exponential growth check: final interval should be >> initial interval
    const growthFactor = intervals[9] / intervals[0];
    expect(growthFactor).toBeGreaterThan(
      5,
      `Interval should grow exponentially over 10 "Easy" evaluations. ` +
        `Growth factor: ${growthFactor.toFixed(2)}x (expected > 5x)`
    );

    // 4. All scheduled dates in future relative to their practice dates
    const allRecords = await queryPracticeRecords(page, [TEST_TUNE_BANISH_ID]);
    validateScheduledDatesInFuture(allRecords, new Date(STANDARD_TEST_DATE));

    // 5. Final scheduled date should be far in future (weeks/months out)
    const finalScheduled = scheduledDates[9];
    const finalDate = new Date(STANDARD_TEST_DATE);
    const daysOut =
      (finalScheduled.getTime() - finalDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysOut).toBeGreaterThan(
      30,
      `After 10 "Easy" evaluations, tune should be scheduled ` +
        `>30 days out (got ${daysOut.toFixed(1)} days)`
    );

    console.log(`\n✓ All validations passed!`);
    console.log(`  Growth factor: ${growthFactor.toFixed(2)}x`);
    console.log(`  Final interval: ${intervals[9].toFixed(1)} days`);
    console.log(`  Final scheduled: ${daysOut.toFixed(1)} days out`);
  });

  test("should respect minimum next-day constraint even with Easy", async ({
    page,
    context,
    testUser,
  }) => {
    // Simplified variant focusing on the minimum constraint

    await ttPage.enableFlashcardMode();
    await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });

    // First evaluation: "Easy"
    await ttPage.selectFlashcardEvaluation("easy");
    await page.waitForTimeout(500);
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check scheduled date
    const playlistId = testUser.defaultPlaylistIdInt;
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      playlistId
    );

    const scheduledDate = new Date(record.due);
    const daysDiff = Math.floor(
      (scheduledDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // CRITICAL: Must be >= 1 day in future (ensureMinimumNextDay constraint)
    expect(daysDiff).toBeGreaterThanOrEqual(
      1,
      `Even with "Easy", scheduled date must be >= 1 day in future. ` +
        `Current: ${currentDate.toISOString()}, Scheduled: ${scheduledDate.toISOString()}, ` +
        `Diff: ${daysDiff} days`
    );

    // Verify it's actually tomorrow or later (not same day)
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    expect(scheduledDate.getTime()).toBeGreaterThanOrEqual(
      tomorrow.getTime(),
      `Scheduled date should be tomorrow or later (respects +25h buffer)`
    );
  });
});
