import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MASONS_ID,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * FLASHCARD-002: Evaluations
 *
 * Tests that evaluations can be selected, staged to database, and persist
 * across navigation. Verifies evaluation count updates in Submit button.
 */
test.describe
  .serial("Flashcard Feature: Evaluations", () => {
    test.setTimeout(60000);

    let ttPage: TuneTreesPage;
    let currentDate: Date;

    test.beforeEach(async ({ page, context, testUser }) => {
      ttPage = new TuneTreesPage(page);

      // Set stable starting date
      currentDate = new Date(STANDARD_TEST_DATE);
      await setStableDate(context, currentDate);

      // Set up 10 tunes, all scheduled as "overdue" so they appear in queue
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [
          TEST_TUNE_BANISH_ID,
          TEST_TUNE_MORRISON_ID,
          TEST_TUNE_MASONS_ID,
        ], // 3 tunes that exist in seed data
        scheduleDaysAgo: 1, // Due yesterday (overdue)
        scheduleBaseDate: currentDate,
        startTab: "practice",
      });

      await page.waitForTimeout(500);
    });

    test("01. Select evaluation on flashcard", async ({ page }) => {
      await ttPage.enableFlashcardMode(500);

      // Select "Good" via evaluation combobox
      await ttPage.selectFlashcardEvaluation("good");

      // Verify the combobox now shows "Good"
      // page.getByTestId(/^recall-eval-[0-9a-f-]+$/i)
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Good/i);
    });

    test("02. Evaluation staging reflected in submit count", async ({
      page,
    }) => {
      await ttPage.enableFlashcardMode(500);

      // Select evaluation
      await ttPage.selectFlashcardEvaluation("good");
      await page.waitForTimeout(500); // Allow time for staging

      // Verify evaluation reflected in Submit count (acts as staging indicator)
      await expect(ttPage.submitEvaluationsButton).toContainText("1");
    });

    test("03. Evaluation persists after navigation", async ({ page }) => {
      await ttPage.enableFlashcardMode(500);

      // Select evaluation on first card
      await ttPage.selectFlashcardEvaluation("good");

      // Navigate to next card
      await ttPage.goNextCard();

      // Navigate back to first card
      await ttPage.goPrevCard();

      // Verify combobox still shows "Good"
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Good/i);
    });

    test("04. Evaluation clears when selecting different tune", async ({
      page,
    }) => {
      await ttPage.enableFlashcardMode(500);

      // Select evaluation on first card
      await ttPage.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Navigate to second card
      await ttPage.goNextCard();

      // Verify no evaluation selected on second card
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Not set|Select/i);
    });

    test("05. Multiple evaluations on same card - last one wins", async ({
      page,
    }) => {
      await ttPage.enableFlashcardMode(500);

      // Select "Good"
      await ttPage.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Change to "Easy"
      await ttPage.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(300);

      // Verify only "Easy" is shown
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Easy/i);
    });

    test("06. Evaluation count updates in Submit button", async ({ page }) => {
      await ttPage.enableFlashcardMode(500);

      // Initially no evaluations
      const submitButton = ttPage.submitEvaluationsButton;
      // New UX: button shows label "Submit" and badge appears only when count > 0
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toContainText(/Submit/i);

      // Select evaluation on first card
      await ttPage.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Verify count updated to 1
      await expect(submitButton).toContainText("1");

      // Navigate to second card and select evaluation
      await ttPage.goNextCard();

      await ttPage.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(300);

      // Verify count updated to 2
      await expect(submitButton).toContainText("2");
    });

    test("07. Can clear evaluation by clicking again", async ({ page }) => {
      await ttPage.enableFlashcardMode();

      // Select evaluation
      await ttPage.selectFlashcardEvaluation("good", 800);

      // Clear by selecting "Not set"
      await ttPage.selectFlashcardEvaluation("not-set");

      // Verify deselected (combobox shows Not set)
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i);
      await expect(evalButton).toContainText(/Not Set|Select/i);

      // Verify Submit button count back to 0
      const submitButton = ttPage.submitEvaluationsButton;
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toContainText(/Submit/i);
    });
  });
