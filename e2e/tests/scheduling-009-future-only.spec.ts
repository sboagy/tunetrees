import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import {
  applyDeterministicFsrsConfig,
  DEFAULT_DETERMINISTIC_FSRS_TEST_CONFIG,
} from "../helpers/fsrs-test-config";
import { waitForSyncComplete } from "../helpers/local-db-lifecycle";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import {
  queryLatestPracticeRecord,
  validateIncreasingIntervals,
  validateScheduledDatesInFuture,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { BASE_URL } from "../test-config";

/**
 * SCHEDULING-009: Future-Only Due over multi-day Good/Easy chain
 * Priority: HIGH
 *
 * Validates that for a sequence of successful reviews (Good/Easy),
 * the next due date is ALWAYS strictly in the future relative to the practice time.
 *
 * This guards against regression where a tune might be scheduled for "today" or "past"
 * due to timezone issues or FSRS calculation errors.
 *
 * Sequence:
 * 1. Start with new tune
 * 2. Day 1: Evaluate "Good" -> Due D1 + I1
 * 3. Advance to D1 + I1
 * 4. Evaluate "Good" -> Due D2 + I2
 * 5. Advance to D2 + I2
 * 6. Evaluate "Easy" -> Due D3 + I3
 *
 * Invariants:
 * - Due date > Practice Date (always)
 * - Interval >= 1 day (always)
 * - Intervals increasing (monotonic growth for Good/Easy)
 */

let ttPage: TuneTreesPage;
let currentDate: Date;
const TUNE_ID = TEST_TUNE_BANISH_ID;
const REPERTOIRE_SIZE = DEFAULT_DETERMINISTIC_FSRS_TEST_CONFIG.repertoireSize;
const MAX_DAILY_TUNES = DEFAULT_DETERMINISTIC_FSRS_TEST_CONFIG.maxReviews;
const ENABLE_FUZZ = DEFAULT_DETERMINISTIC_FSRS_TEST_CONFIG.enableFuzz;

test.describe("SCHEDULING-009: Future-Only Due over multi-day Good/Easy chain", () => {
  test.setTimeout(120000); // Multi-day simulation takes time

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Override FSRS config for deterministic interval assertions.
    await applyDeterministicFsrsConfig(page, {
      repertoireSize: REPERTOIRE_SIZE,
      enableFuzz: ENABLE_FUZZ,
      maxReviews: MAX_DAILY_TUNES,
    });

    // Setup: deterministic single-tune practice queue due for review
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TUNE_ID],
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
    await page.waitForTimeout(2000); // Wait for setup to stabilize
  });

  test("should ensure due dates are strictly in future across Good/Easy chain", async ({
    page,
    context,
    testUser,
  }) => {
    const tuneId = TUNE_ID;

    const ratings: ("good" | "easy")[] = ["good", "good", "easy", "good"];
    const intervals: number[] = [];

    const waitForTuneInPracticeQueue = async () => {
      await waitForSyncComplete(page, 45000);

      await expect(ttPage.practiceColumnsButton).toBeVisible({
        timeout: 30000,
      });
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 30000 });
      await expect(page.getByText("Loading practice queue...")).not.toBeVisible(
        { timeout: 30000 }
      );

      const recallEvalControls = ttPage.practiceGrid.getByTestId(
        /^recall-eval-[0-9a-f-]+$/i
      );

      await expect
        .poll(async () => await recallEvalControls.count(), {
          timeout: 30000,
          intervals: [200, 500, 1000],
        })
        .toBeGreaterThan(0);

      const tuneRecallEvalControl = page.getByTestId(`recall-eval-${tuneId}`);
      await expect
        .poll(async () => await tuneRecallEvalControl.count(), {
          timeout: 30000,
          intervals: [200, 500, 1000],
        })
        .toBeGreaterThan(0);

      await expect(tuneRecallEvalControl).toBeVisible({ timeout: 15000 });
    };

    // 2. Evaluation Loop
    for (let i = 0; i < ratings.length; i++) {
      const rating = ratings[i];
      console.log(
        `\n=== Iteration ${i + 1}: Evaluating '${rating}' on ${currentDate.toISOString()} ===`
      );

      // Go to practice
      // Use navigateToTab so we avoid re-clicking an already active tab,
      // which can drop ?practiceDate=YYYY-MM-DD and cause queue/date drift.
      await ttPage.navigateToTab("practice");

      // Wait for queue generation to settle and for target tune row to be present.
      await waitForTuneInPracticeQueue();

      // Evaluate
      await ttPage.enableFlashcardMode();
      await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });
      await ttPage.selectFlashcardEvaluation(rating);
      await ttPage.submitEvaluations();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await page.waitForTimeout(2000); // Sync wait

      // Query Record
      const record = await queryLatestPracticeRecord(
        page,
        tuneId,
        testUser.repertoireId,
        { waitForRecordMs: 12000, pollIntervalMs: 300 }
      );
      if (!record) throw new Error("Record not found");

      console.log(`  Result: Interval=${record.interval}d, Due=${record.due}`);

      // Assertions
      const practicedDate = new Date(record.practiced);
      const dueDate = new Date(record.due);

      // A. Due > Practiced
      expect(dueDate.getTime()).toBeGreaterThan(practicedDate.getTime());

      // B. Due >= Practiced + 1 day (approx, allowing for DST/Timezone, but strictly future day)
      // We use the helper which checks for strict future
      validateScheduledDatesInFuture([record], currentDate);

      // C. Interval >= 1
      expect(record.interval).toBeGreaterThanOrEqual(1);

      intervals.push(record.interval);

      // Advance Clock to Due Date for next iteration
      if (i < ratings.length - 1) {
        const nextDue = new Date(record.due);
        // Add 1 minute buffer to ensure we are strictly past the due time
        nextDue.setMinutes(nextDue.getMinutes() + 1);
        currentDate = nextDue;

        // Persist DB before reload
        await page.evaluate(() => (window as any).__persistDbForTest?.());

        // Clear Flashcard Mode persistence to ensure we start in Grid Mode
        await page.evaluate(() => {
          localStorage.removeItem("TT_PRACTICE_FLASHCARD_MODE");
          localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
        });

        await setStableDate(context, currentDate);
        await verifyClockFrozen(
          page,
          currentDate,
          undefined,
          test.info().project.name
        );

        // Navigate with explicit practiceDate param to ensure app sees the correct date
        // (Playwright clock override sometimes fails to affect bundled modules after reload)
        const nextPracticeDateIso = encodeURIComponent(
          currentDate.toISOString()
        );
        await page.goto(
          `${BASE_URL}/practice?practiceDate=${nextPracticeDateIso}`,
          {
            waitUntil: "domcontentloaded",
          }
        );

        await waitForSyncComplete(page, 45000);

        await verifyClockFrozen(page, currentDate, undefined, "After Reload");
        await page.waitForTimeout(2000);

        // Re-login check
        const loginVisible = await page
          .getByText("Sign in to continue")
          .isVisible()
          .catch(() => false);
        if (loginVisible) {
          await page.getByLabel("Email").fill(testUser.email);
          await page.locator('input[type="password"]').fill("TestPassword123!");
          await page.getByRole("button", { name: "Sign In" }).click();
        }

        // Force sync down
        await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
        await waitForSyncComplete(page, 45000);
        await page.waitForLoadState("networkidle", { timeout: 15000 });
      }
    }

    // Final check on intervals
    console.log("Interval sequence:", intervals);
    validateIncreasingIntervals(intervals, 1.0);
  });
});
