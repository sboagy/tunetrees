import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MASONS_ID,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
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

    test.beforeEach(async ({ page, testUser }) => {
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [
          TEST_TUNE_BANISH_ID,
          TEST_TUNE_MORRISON_ID,
          TEST_TUNE_MASONS_ID,
        ], // 3 tunes that exist in seed data
        scheduleDaysAgo: 1,
        startTab: "practice",
      });
      await page.waitForTimeout(500);
    });

    test("01. Select evaluation on flashcard", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Select "Good" via evaluation combobox
      await app.selectFlashcardEvaluation("good");

      // Verify the combobox now shows "Good"
      // page.getByTestId(/^recall-eval-[0-9a-f-]+$/i)
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Good/i);
    });

    test("02. Evaluation staging reflected in submit count", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Select evaluation
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(500); // Allow time for staging

      // Verify evaluation reflected in Submit count (acts as staging indicator)
      await expect(app.submitEvaluationsButton).toContainText("1");
    });

    test("03. Evaluation persists after navigation", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Select evaluation on first card
      await app.selectFlashcardEvaluation("good");

      // Navigate to next card
      await app.goNextCard();

      // Navigate back to first card
      await app.goPrevCard();

      // Verify combobox still shows "Good"
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Good/i);
    });

    test("04. Evaluation clears when selecting different tune", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Select evaluation on first card
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Navigate to second card
      await app.goNextCard();
      await page.waitForTimeout(300);

      // Verify no evaluation selected on second card
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Not set|Select/i);
    });

    test("05. Multiple evaluations on same card - last one wins", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Select "Good"
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Change to "Easy"
      await app.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(300);

      // Verify only "Easy" is shown
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Easy/i);
    });

    test("06. Evaluation count updates in Submit button", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Initially no evaluations
      const submitButton = app.submitEvaluationsButton;
      // New UX: button shows label "Submit" and badge appears only when count > 0
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toContainText(/Submit/i);

      // Select evaluation on first card
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Verify count updated to 1
      await expect(submitButton).toContainText("1");

      // Navigate to second card and select evaluation
      await app.goNextCard();
      await page.waitForTimeout(300);
      await app.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(300);

      // Verify count updated to 2
      await expect(submitButton).toContainText("2");
    });

    test("07. Can clear evaluation by clicking again", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode(500);

      // Select evaluation
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Clear by selecting "Not set"
      await app.selectFlashcardEvaluation("not-set");
      await page.waitForTimeout(300);

      // Verify deselected (combobox shows Not set)
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Not set|Select/i);

      // Verify Submit button count back to 0
      const submitButton = app.submitEvaluationsButton;
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toContainText(/Submit/i);
    });
  });
