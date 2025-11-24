import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import {
  STANDARD_TEST_DATE,
  setStableDate,
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
// Test password used for all seeded users (see e2e/helpers/test-users.ts)
const TEST_PASSWORD = "TestPassword123!";
// CI shortening: set CI_DIAG_FAST=1 to reduce loop days for diagnostics
const MAX_DAYS = 10;

// Diagnostic helper: invoke auth session diagnostic hook with label if available.
async function diagAuth(page: import("@playwright/test").Page, label: string) {
  await page.evaluate(
    (l) => (window as any).__authSessionDiagForTest?.(l),
    label
  );
}

async function ensureLoggedIn(
  page: import("@playwright/test").Page,
  testUser: { email: string }
) {
  // If we're on /login or sign-in form visible, re-authenticate (time travel may expire session)
  console.log(`ensureLoggedIn: ${page.url()}`);
  if (
    page.url().includes("/login") ||
    (await page
      .getByRole("button", { name: "Sign In" })
      .isVisible()
      .catch(() => false))
  ) {
    console.log("Attempting to login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.locator("input#password").fill(TEST_PASSWORD);
    console.log("About to press Sign In click()");
    const signInLocator = page.getByRole("button", { name: "Sign In" });
    const maxWaitMs = 15000;
    const pollIntervalMs = 200;
    const maxAttempts = Math.ceil(maxWaitMs / pollIntervalMs);
    let signInEnabled = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      signInEnabled = await signInLocator.isEnabled().catch(() => false);
      if (signInEnabled) break;
      await page.waitForTimeout(pollIntervalMs);
    }

    if (!signInEnabled) {
      throw new Error("Sign In button did not become enabled within timeout");
    }
    await signInLocator.click();
    console.log("Back from pressing Sign In click()");
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
    await page.waitForTimeout(2000); // Allow post-login sync
  }
}

test.describe("SCHEDULING-003: Repeated Easy Evaluations", () => {
  // NOTE: Per-project timeout for 'chromium-debug' is already 0 (unlimited).
  // Avoid overriding it with a finite value when debugging.
  if (!process.env.PWDEBUG) {
    // In normal runs allow up to 90s to cover multi-day loop logic.
    test.setTimeout(120_000);
  }
  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Set up ONE tune for repeated evaluation
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1, // Due yesterday (overdue)
      scheduleBaseDate: currentDate, // Align Supabase scheduled dates with frozen browser date
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

  test("should advance scheduling dates with repeated Easy evaluations over 10 days", async ({
    page,
    context,
    testUser,
  }) => {
    const intervals: number[] = [];
    const scheduledDates: Date[] = [];
    const difficulties: number[] = [];
    const stabilities: number[] = [];

    // Ensure practice queue has loaded
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

    // Enable flashcard mode for easier evaluation
    await ttPage.enableFlashcardMode();
    await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });

    // Day loop (diagnostic-aware)
    for (let day = 1; day <= MAX_DAYS; day++) {
      console.log(
        `\n=== Day ${day} (${currentDate.toISOString().split("T")[0]}) ===`
      );

      // Verify flashcard counter shows 1 tune
      const counter = ttPage.flashcardHeaderCounter;
      await expect(counter).toContainText("1 of 1", { timeout: 5000 });

      // Select "Easy" evaluation
      await ttPage.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(500); // Allow staging to process

      // Submit evaluation
      await ttPage.submitEvaluationsButton.click({ timeout: 900_000 });
      await page.waitForTimeout(500); // Allow sync to complete
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await page.waitForTimeout(2000); // Allow sync to complete

      // Diagnostics: session after submission before sync up
      await diagAuth(page, `day-${day}-post-submit-pre-syncup`);

      // CRITICAL: Flush local changes to Supabase before any time travel/reload
      await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await diagAuth(page, `day-${day}-after-syncup`);

      // Query latest practice record to get FSRS metrics
      const playlistId = testUser.playlistId;
      const record = await queryLatestPracticeRecord(
        page,
        TEST_TUNE_BANISH_ID,
        playlistId
      );
      if (!record)
        throw new Error("Practice record not found after Easy evaluation");

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
        (scheduledDate.getTime() - currentDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysDiff < 1) {
        throw new Error(
          `Day ${day}: Scheduled date must be at least 1 day in future. Current: ${currentDate.toISOString()}, Scheduled: ${scheduledDate.toISOString()}`
        );
      }
      expect(daysDiff).toBeGreaterThanOrEqual(1);

      // 2. Interval must increase from previous day
      if (day > 1) {
        if (!(intervals[day - 1] > intervals[day - 2])) {
          throw new Error(
            `Day ${day}: Interval (${intervals[day - 1]}) should be greater than previous interval (${intervals[day - 2]})`
          );
        }
        expect(intervals[day - 1]).toBeGreaterThan(intervals[day - 2]);

        // Scheduled date must advance from previous day
        if (
          !(
            scheduledDates[day - 1].getTime() >
            scheduledDates[day - 2].getTime()
          )
        ) {
          throw new Error(
            `Day ${day}: Scheduled date should advance from previous day`
          );
        }
        expect(scheduledDates[day - 1].getTime()).toBeGreaterThan(
          scheduledDates[day - 2].getTime()
        );
      }

      // 3. Stability should generally increase with "Easy"
      // (FSRS may occasionally decrease stability after lapse, but trend should be upward)
      if (day > 1 && stabilities[day - 1] < stabilities[day - 2]) {
        console.warn(
          `  ⚠️  Stability decreased: ${stabilities[day - 2]} → ${stabilities[day - 1]}`
        );
      }

      // Advance time to the card's actual scheduled due date (simulate practicing exactly when due)
      if (day < 10) {
        // Persist DB before reload so practice_record inserts aren't lost
        await page.evaluate(() => (window as any).__persistDbForTest?.());
        await diagAuth(page, `day-${day}-before-advance`);

        const nextDue = new Date(record.due);
        // Guard: ensure nextDue is in the future relative to currentDate
        if (nextDue.getTime() <= currentDate.getTime()) {
          throw new Error(
            `Next due (${nextDue.toISOString()}) must be > current date (${currentDate.toISOString()})`
          );
        }
        // Persist DB snapshot and reload to pick up new frozen time
        await page.evaluate(() => (window as any).__persistDbForTest?.());

        currentDate = nextDue;
        await setStableDate(context, currentDate);
        await verifyClockFrozen(
          page,
          currentDate,
          undefined,
          test.info().project.name
        );

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(process.env.CI ? 5000 : 1500);
        await diagAuth(page, `day-${day}-after-reload-pre-login`);

        await ensureLoggedIn(page, testUser);
        await diagAuth(page, `day-${day}-after-login`);

        await expect(page.locator("input#password")).not.toBeVisible({
          timeout: 1000,
        });

        // After re-login, ensure we pull any data that was flushed server-side
        await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
        await page.waitForLoadState("networkidle", { timeout: 15000 });
        await diagAuth(page, `day-${day}-after-syncdown`);

        // Re-enter flashcard mode for next evaluation
        await ttPage.disableFlashcardMode();
        await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
        await ttPage.enableFlashcardMode();
        await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });
      }
    }

    // === FINAL VALIDATIONS AFTER LOOP ===

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
      if (interval < 1) {
        throw new Error(
          `Day ${idx + 1}: Interval must be >= 1 day (got ${interval})`
        );
      }
      expect(interval).toBeGreaterThanOrEqual(1);
    });

    // 2. Validate increasing intervals across all days
    validateIncreasingIntervals(intervals, 1.0); // At least 9.5% growth each time

    // 3. Exponential growth check: final interval should be >> initial interval
    const lastIndex = intervals.length - 1;
    const growthFactor = intervals[lastIndex] / intervals[0];
    if (!(growthFactor > 5)) {
      throw new Error(
        `Interval should grow exponentially over 10 "Easy" evaluations. Growth factor: ${growthFactor.toFixed(2)}x (expected > 5x)`
      );
    }
    expect(growthFactor).toBeGreaterThan(5);

    // 4. All scheduled dates in future relative to their practice dates
    const allRecords = await queryPracticeRecords(page, [TEST_TUNE_BANISH_ID]);
    validateScheduledDatesInFuture(allRecords, new Date(STANDARD_TEST_DATE));

    // 5. Final scheduled date should be far in future (weeks/months out)
    const finalScheduled = scheduledDates[lastIndex];
    const finalDate = new Date(STANDARD_TEST_DATE);
    const daysOut =
      (finalScheduled.getTime() - finalDate.getTime()) / (1000 * 60 * 60 * 24);
    if (!(daysOut > 30)) {
      throw new Error(
        `After 10 "Easy" evaluations, tune should be scheduled >30 days out (got ${daysOut.toFixed(1)} days)`
      );
    }
    expect(daysOut).toBeGreaterThan(30);

    console.log(`\n✓ All validations passed!`);
    console.log(`  Growth factor: ${growthFactor.toFixed(2)}x`);
    console.log(`  Final interval: ${intervals[9].toFixed(1)} days`);
    console.log(`  Final scheduled: ${daysOut.toFixed(1)} days out`);
  });

  test("should respect minimum next-day constraint even with Easy", async ({
    page,
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
    const playlistId = testUser.playlistId;
    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      playlistId
    );
    if (!record)
      throw new Error("Practice record not found after Easy evaluation");

    const scheduledDate = new Date(record.due);
    const daysDiff = Math.floor(
      (scheduledDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // CRITICAL: Must be >= 1 day in future (ensureMinimumNextDay constraint)
    if (daysDiff < 1) {
      throw new Error(
        `Even with "Easy", scheduled date must be >= 1 day in future. Current: ${currentDate.toISOString()}, Scheduled: ${scheduledDate.toISOString()}, Diff: ${daysDiff} days`
      );
    }
    expect(daysDiff).toBeGreaterThanOrEqual(1);

    // Verify it's actually tomorrow or later (not same day)
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    if (!(scheduledDate.getTime() >= tomorrow.getTime())) {
      throw new Error(
        `Scheduled date should be tomorrow or later (respects +25h buffer)`
      );
    }
    expect(scheduledDate.getTime()).toBeGreaterThanOrEqual(tomorrow.getTime());
  });
});
