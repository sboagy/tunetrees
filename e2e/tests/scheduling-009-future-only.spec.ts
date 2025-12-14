import { expect } from "@playwright/test";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import {
  getTestUserClient,
  setupDeterministicTestParallel,
} from "../helpers/practice-scenarios";
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
const TUNE_TITLE = "SCHED-009 Future Check";

test.describe("SCHEDULING-009: Future-Only Due over multi-day Good/Easy chain", () => {
  test.setTimeout(120000); // Multi-day simulation takes time

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Setup: Clean repertoire
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
      purgeTitlePrefixes: [TUNE_TITLE],
    });

    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );
  });

  test("should ensure due dates are strictly in future across Good/Easy chain", async ({
    page,
    context,
    testUser,
  }) => {
    // Helper to create, configure, and add a tune to review
    async function createAndAddToReview(title: string) {
      await ttPage.catalogTab.click();
      await ttPage.catalogAddTuneButton.click();
      const newButton = page.getByRole("button", { name: /^new$/i });
      await newButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      const titleField = ttPage.tuneEditorForm.getByTestId(
        "tune-editor-input-title"
      );
      await titleField.fill(title);
      await ttPage.selectTypeInTuneEditor("Reel (4/4)");
      const saveButton = page.getByRole("button", { name: /save/i });
      await saveButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      // Add to repertoire
      await ttPage.searchForTune(title, ttPage.catalogGrid);
      const checkbox = ttPage.catalogGrid
        .locator('input[type="checkbox"]')
        .nth(1);
      await checkbox.check();
      await ttPage.catalogAddToRepertoireButton.click();
      await page.waitForTimeout(1000);
      // Add to review
      await ttPage.repertoireTab.click();
      await ttPage.searchForTune(title, ttPage.repertoireGrid);
      const repCheckbox = ttPage.repertoireGrid
        .locator('input[type="checkbox"]')
        .nth(1);
      await repCheckbox.check();
      await ttPage.repertoireAddToReviewButton.click();
      await page.waitForTimeout(1000);
    }

    // Cleanup helper
    async function cleanupTune() {
      try {
        const userKey = testUser.email.split(".")[0];
        const { supabase } = await getTestUserClient(userKey);
        const { data } = await supabase
          .from("tune")
          .select("id")
          .eq("title", TUNE_TITLE);
        const ids = (data || []).map((r: any) => r.id).filter(Boolean);
        if (ids.length === 0) return;

        const cascade = [
          "playlist_tune",
          "practice_record",
          "daily_practice_queue",
          "tune_override",
        ];
        for (const table of cascade) {
          try {
            const q = supabase
              .from(table)
              .delete()
              .in("tune_ref", ids)
              .eq(
                table === "tune_override" ? "user_ref" : "playlist_ref",
                table === "tune_override"
                  ? (await supabase.auth.getUser()).data.user?.id
                  : testUser.playlistId
              );
            await q;
          } catch (e) {
            console.warn(`Cleanup error for ${table}:`, e);
          }
        }
        await supabase.from("tune").delete().in("id", ids);
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }

    try {
      // 1. Create and add tune
      await createAndAddToReview(TUNE_TITLE);

      // Resolve tune ID
      const userKey = testUser.email.split(".")[0];
      const { supabase } = await getTestUserClient(userKey);
      const { data: tuneData } = await supabase
        .from("tune")
        .select("id")
        .eq("title", TUNE_TITLE)
        .single();
      const tuneId = tuneData?.id;
      expect(tuneId).toBeDefined();

      const ratings: ("good" | "easy")[] = ["good", "good", "easy", "good"];
      const intervals: number[] = [];

      // 2. Evaluation Loop
      for (let i = 0; i < ratings.length; i++) {
        const rating = ratings[i];
        console.log(
          `\n=== Iteration ${i + 1}: Evaluating '${rating}' on ${currentDate.toISOString()} ===`
        );

        // Go to practice
        await ttPage.practiceTab.click();

        // Wait for loading to complete (sync can take time after reload)
        await expect(
          page.getByText("Loading practice queue...")
        ).not.toBeVisible({ timeout: 30000 });

        await expect(ttPage.practiceGrid).toBeVisible({ timeout: 30000 });

        // Verify tune is present
        const row = ttPage.practiceGrid.getByText(TUNE_TITLE);
        await expect(row).toBeVisible({ timeout: 10000 });

        // Evaluate
        await ttPage.enableFlashcardMode();
        await expect(ttPage.flashcardView).toBeVisible({ timeout: 5000 });
        await ttPage.selectFlashcardEvaluation(rating);
        await ttPage.submitEvaluationsButton.click();
        await page.waitForLoadState("networkidle", { timeout: 15000 });
        await page.waitForTimeout(2000); // Sync wait

        // Query Record
        const record = await queryLatestPracticeRecord(
          page,
          tuneId,
          testUser.playlistId
        );
        if (!record) throw new Error("Record not found");

        console.log(
          `  Result: Interval=${record.interval}d, Due=${record.due}`
        );

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
          const nextDateIso = currentDate.toISOString().split("T")[0];
          await page.goto(`${BASE_URL}/practice?practiceDate=${nextDateIso}`, {
            waitUntil: "domcontentloaded",
          });

          await verifyClockFrozen(page, currentDate, undefined, "After Reload");
          await page.waitForTimeout(2000);

          // Re-login check
          const loginVisible = await page
            .getByText("Sign in to continue")
            .isVisible()
            .catch(() => false);
          if (loginVisible) {
            await page.getByLabel("Email").fill(testUser.email);
            await page
              .locator('input[type="password"]')
              .fill("TestPassword123!");
            await page.getByRole("button", { name: "Sign In" }).click();
          }

          // Force sync down
          await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
          await page.waitForLoadState("networkidle", { timeout: 15000 });
        }
      }

      // Final check on intervals
      console.log("Interval sequence:", intervals);
      validateIncreasingIntervals(intervals, 1.0);
    } finally {
      await cleanupTune();
    }
  });
});
