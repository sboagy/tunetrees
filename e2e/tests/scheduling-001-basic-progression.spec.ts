import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_BANISH_TITLE,
} from "../../tests/fixtures/test-data";
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
 * SCHEDULING-001: Basic FSRS Progression (7-day single tune scenario)
 * Priority: HIGH
 *
 * Validates core progression rules without hard-coding numeric FSRS intervals:
 *  - Intervals always >= 1 day
 *  - Due dates always strictly in future relative to practiced date
 *  - Hard produces shorter interval than preceding Good/Easy
 *  - Good/Easy evaluations produce non-decreasing intervals relative to last successful Good/Easy
 *  - State progresses out of NEW after first evaluation
 *
 * Rating Sequence (illustrative realistic mix):
 *   Day1: Good
 *   Day2: Easy
 *   Day3: Good
 *   Day4: Hard
 *   Day5: Good
 *   Day6: Easy
 *   Day7: Good
 *
 * Assertions remain algorithm-agnostic and rely only on invariants from FSRS docs + project rules.
 */

const RATING_SEQUENCE: Array<"good" | "easy" | "hard"> = [
  "good",
  "easy",
  "good",
  "hard",
  "good",
  "easy",
  "good",
];

test.describe
  .skip("SCHEDULING-001: Basic FSRS Progression", () => {
    test.setTimeout(90000);

    let currentDate: Date;
    let ttPage: TuneTreesPage;
    const intervals: number[] = [];
    const goodEasyIntervals: number[] = []; // Track only Good/Easy for monotonic check

    test.beforeEach(async ({ page, context, testUser }) => {
      // Freeze clock
      currentDate = new Date(STANDARD_TEST_DATE);
      await setStableDate(context, currentDate);

      // Instantiate page object
      ttPage = new TuneTreesPage(page);

      // Seed single tune; schedule yesterday so it's due today
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [TEST_TUNE_BANISH_ID],
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

    test("should advance intervals and maintain ordering across mixed ratings (grid evaluations)", async ({
      page,
      context,
      testUser,
    }) => {
      // Ensure practice grid visible (single overdue tune seeded)
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

      // Helper to select evaluation from grid & submit
      async function evaluate(rating: "again" | "hard" | "good" | "easy") {
        // Locate first (and only) row; tune should be present when due
        const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
        await expect(row).toBeVisible({ timeout: 10000 });
        // Confirm row contains the tune title for robustness
        await expect(
          row.getByRole("cell", { name: TEST_TUNE_BANISH_TITLE })
        ).toBeVisible({ timeout: 10000 });

        const evalDropdown = row.locator("[data-testid^='recall-eval-']");
        await expect(evalDropdown).toBeVisible({ timeout: 5000 });
        await evalDropdown.click();
        await page.waitForTimeout(200);
        await page.getByTestId(`recall-eval-option-${rating}`).click();
        await page.waitForTimeout(300);
        await ttPage.submitEvaluationsButton.click();
        await page.waitForLoadState("networkidle", { timeout: 15000 });
        await page.waitForTimeout(1200); // allow sync & view update
      }

      for (let day = 0; day < RATING_SEQUENCE.length; day++) {
        const rating = RATING_SEQUENCE[day];
        // Evaluate
        await evaluate(rating);

        // Query latest record
        const record = await queryLatestPracticeRecord(
          page,
          TEST_TUNE_BANISH_ID,
          testUser.playlistId
        );
        if (!record)
          throw new Error("No practice record found after evaluation");

        // Basic future due invariant
        const practicedDate = new Date(record.practiced);
        const dueDate = new Date(record.due);
        expect(dueDate.getTime()).toBeGreaterThan(practicedDate.getTime());

        // Interval invariants
        const interval = record.interval;
        expect(interval).toBeGreaterThanOrEqual(1);
        intervals.push(interval);

        // Track Good/Easy for monotonic progression check
        if (rating === "good" || rating === "easy") {
          goodEasyIntervals.push(interval);
          if (goodEasyIntervals.length > 1) {
            const prev = goodEasyIntervals[goodEasyIntervals.length - 2];
            expect(interval).toBeGreaterThanOrEqual(prev);
          }
        }

        // Hard rating should be <= previous successful Good/Easy (if any)
        if (rating === "hard" && goodEasyIntervals.length > 0) {
          const lastSuccessful =
            goodEasyIntervals[goodEasyIntervals.length - 1];
          expect(interval).toBeLessThanOrEqual(lastSuccessful);
        }

        // State leaves NEW after first eval
        if (day === 0) {
          expect([1, 2]).toContain(record.state); // Learning or Review
        }

        // Advance clock to next due date (simulate waiting until tune due)
        if (day < RATING_SEQUENCE.length - 1) {
          // Advance days difference between today and due (minimum 1)
          const diffDays = Math.max(
            1,
            Math.round(
              (dueDate.getTime() - currentDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
          currentDate = await advanceDays(context, diffDays, currentDate);
          await verifyClockFrozen(
            page,
            currentDate,
            undefined,
            test.info().project.name
          );
          // Reload to surface tune if now due again
          await page.reload({ waitUntil: "domcontentloaded" });
          await page.waitForTimeout(1200);
          // Wait for tune to reappear (it was removed after submission)
          const rowAfter = ttPage.practiceGrid.locator(
            "tbody tr[data-index='0']"
          );
          await expect(rowAfter).toBeVisible({ timeout: 15000 });
          await expect(
            rowAfter.getByRole("cell", { name: TEST_TUNE_BANISH_TITLE })
          ).toBeVisible({ timeout: 15000 });
        }
      }

      // Final aggregate assertions
      expect(intervals.length).toBe(RATING_SEQUENCE.length);
      // Ensure at least one growth event (max > initial)
      expect(Math.max(...intervals)).toBeGreaterThan(intervals[0]);
    });
  });
