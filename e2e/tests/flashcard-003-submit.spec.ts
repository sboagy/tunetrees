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
 * FLASHCARD-003: Submit Functionality
 *
 * Tests that Submit button works correctly: creates practice_record,
 * clears staged evaluations, updates grid and flashcard list.
 */
test.describe
  .serial("Flashcard Feature: Submit", () => {
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
    });

    test("01. Submit button disabled with no evaluations", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Verify Submit button disabled
      const submitButton = app.submitEvaluationsButton;
      await expect(submitButton).toBeDisabled();
    });

    test("02. Submit with 1 evaluation creates practice_record", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Select evaluation
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Click Submit
      const submitButton = app.submitEvaluationsButton;
      await expect(submitButton).toBeEnabled();
      await submitButton.click();
      await page.waitForTimeout(1500); // Wait for sync

      // Verify Submit succeeded (count resets to 0)
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toContainText(/Submit/i);
    });

    test("03. Submit with multiple evaluations", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Ensure we have at least 2 cards
      const counter = app.flashcardHeaderCounter;
      const initialText = await counter.textContent();
      const total = parseInt(initialText?.split(" of ")[1] || "0", 10);
      if (total < 2) {
        test.fixme(
          true,
          `Only ${total} card(s) available; skipping multi-evaluation submit test.`
        );
        return;
      }

      // Evaluate first card
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Navigate and evaluate second card
      await app.goNextCard();
      await page.waitForTimeout(300);
      await app.selectFlashcardEvaluation("easy");
      await page.waitForTimeout(300);

      // Submit
      const submitButton = app.submitEvaluationsButton;
      await submitButton.click();
      await page.waitForTimeout(1500);

      // Verify Submit succeeded (count resets to 0)
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toContainText(/Submit/i);
    });

    test("04. Submit clears staged evaluations", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Select evaluation
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Submit
      await app.submitEvaluationsButton.click();
      await page.waitForTimeout(1500);

      // Verify Submit button shows 0 evaluations
      const submitButton = app.submitEvaluationsButton;
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toContainText(/Submit/i);
    });

    test("05. Submit updates grid immediately", async ({ page }) => {
      const app = new TuneTreesPage(page);
      // Ensure Show Submitted is OFF for deterministic row decrease
      const showSwitch = app.displaySubmittedSwitch.getByRole("switch");
      await expect(showSwitch).toHaveAttribute("aria-checked", "false");

      // Count initial grid rows (evaluation triggers as proxy)
      const grid = app.practiceGrid;
      const initialRows = await grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .count();

      await app.enableFlashcardMode();

      // Select and submit evaluation
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);
      await app.submitEvaluationsButton.click();
      await page.waitForTimeout(1500);

      // Ensure Show Submitted is OFF for deterministic row decrease
      const showSubmittedToggle =
        app.displaySubmittedSwitch.getByRole("switch");
      const isOn =
        (await showSubmittedToggle.getAttribute("aria-checked")) === "true";
      if (isOn) {
        await showSubmittedToggle.click();
        await page.waitForTimeout(300);
      }

      // Exit flashcard via toolbar switch to avoid close-button races
      const stillVisible = await app.flashcardView
        .isVisible()
        .catch(() => false);
      if (stillVisible) {
        await app.disableFlashcardMode().catch(() => {});
      }

      // Verify grid updated (row count should decrease)
      // Allow some settling time then assert decrease

      let attemptCount = 0;
      await expect
        .poll(
          async () => {
            const updatedRows = await grid
              .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
              .count();
            attemptCount++;
            console.debug(
              `[Poll #${attemptCount}] updatedTotal: ${updatedRows}, initialTotal: ${initialRows}`
            );
            return updatedRows;
          },
          { timeout: 20000, intervals: [100, 500, 1000] }
        )
        .toBeLessThan(initialRows);

      const updatedRows = await grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .count();
      expect(updatedRows).toBeLessThan(initialRows);
    });

    test("06. Submit updates flashcard list count", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Get initial count
      const counter = app.flashcardHeaderCounter;

      // Before we get the initial count, wait for it to be our expected count of 3.
      // This is to hopefully fix this flaky test.
      await expect(async () => {
        const updatedText = await counter.textContent();
        const updatedTotal = parseInt(updatedText?.split(" of ")[1] || "0", 10);
        expect(updatedTotal).toBe(3);
      }).toPass({ timeout: 5000 });

      const initialText = await counter.textContent();
      const initialTotal = parseInt(initialText?.split(" of ")[1] || "0", 10);

      // Select and submit evaluation
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);
      await app.submitEvaluationsButton.click();

      // Verify flashcard count updated (if Show Submitted OFF)
      const showSubmittedToggle =
        app.displaySubmittedSwitch.getByRole("switch");

      await expect(showSubmittedToggle).toHaveAttribute(
        "aria-checked",
        "false"
      );

      // Wait for flashcard count to update (poll until it decreases)
      let attemptCount = 0;
      await expect
        .poll(
          async () => {
            const updatedText = (await counter.textContent()) || "";
            const parts = updatedText.split(" of ");
            const updatedTotal =
              parts.length > 1 ? parseInt(parts[1] || "0", 10) : 0;
            attemptCount++;
            console.debug(
              `[Poll #${attemptCount}] updatedTotal: ${updatedTotal}, initialTotal: ${initialTotal}`
            );
            return updatedTotal;
          },
          { timeout: 20000, intervals: [100, 500, 1000] }
        )
        .toBeLessThan(initialTotal);

      // double-check
      const updatedText = (await counter.textContent()) || "";
      const parts = updatedText.split(" of ");
      const updatedTotal = parts.length > 1 ? parseInt(parts[1] || "0", 10) : 0;
      expect(updatedTotal).toBe(2);
    });

    test("07. Submit works from any card position", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Ensure we have at least 2 cards
      const counter = app.flashcardHeaderCounter;
      const initialText = await counter.textContent();
      const total = parseInt(initialText?.split(" of ")[1] || "0", 10);
      if (total < 2) {
        test.fixme(
          true,
          `Only ${total} card(s) available; skipping any-position submit test.`
        );
        return;
      }

      // Navigate to second card
      await app.goNextCard();
      await page.waitForTimeout(300);

      // Select evaluation on second card
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);

      // Submit from second card
      const submitButton = app.submitEvaluationsButton;
      await submitButton.click();
      await page.waitForTimeout(1500);

      // Verify Submit succeeded (count resets to 0)
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toHaveAttribute(
        "title",
        /Submit 0 practice evaluations/
      );
      await expect(submitButton).toContainText(/Submit/i);
    });
  });
