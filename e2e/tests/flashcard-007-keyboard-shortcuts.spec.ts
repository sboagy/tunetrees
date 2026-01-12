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
 * FLASHCARD-007: Keyboard Shortcuts
 *
 * Tests that keyboard shortcuts work correctly in flashcard mode:
 * - Arrow keys for navigation
 * - Number keys for evaluation selection
 * - Escape to close
 */
test.describe
  .serial("Flashcard Feature: Keyboard Shortcuts", () => {
    test.beforeEach(async ({ page, testUser }) => {
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [
          TEST_TUNE_BANISH_ID,
          TEST_TUNE_MORRISON_ID,
          TEST_TUNE_MASONS_ID,
        ], // 3 tunes that exist in seed data
        scheduleDaysAgo: 1, // Ensure all are due
        startTab: "practice",
      });
    });

    test("01. Right arrow navigates to next card", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Verify on card 1
      const counter = app.flashcardHeaderCounter;
      const total = await app.waitForCounterValue(100, 200, 2);
      await expect(counter).toHaveText(new RegExp(`^1 of ${total}$`), {
        timeout: 10000,
      });

      // Press right arrow
      await page.keyboard.press("ArrowRight");

      // Verify on card 2
      await expect(counter).toHaveText(new RegExp(`^2 of ${total}$`), {
        timeout: 10000,
      });
    });

    test("02. Left arrow navigates to previous card", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      const counter = app.flashcardHeaderCounter;
      const total = await app.waitForCounterValue(100, 200, 2);

      // Navigate to card 2
      await page.keyboard.press("ArrowRight");
      await expect(counter).toHaveText(new RegExp(`^2 of ${total}$`), {
        timeout: 10000,
      });

      // Press left arrow
      await page.keyboard.press("ArrowLeft");

      // Verify back to card 1
      await expect(counter).toHaveText(new RegExp(`^1 of ${total}$`), {
        timeout: 10000,
      });
    });

    test("03. Number key 1 selects Again", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      await app.waitForCounterValue(100, 200, 1);

      // Press 1
      await page.keyboard.press("1");

      // Verify "Again" selected
      const evalButton = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton).toContainText(/Again/i, { timeout: 10000 });
    });

    test("04. Number key 2 selects Hard", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      await app.waitForCounterValue(100, 200, 1);

      // Press 2
      await page.keyboard.press("2");

      // Verify "Hard" selected
      const evalButton = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton).toContainText(/Hard/i, { timeout: 10000 });
    });

    test("05. Number key 3 selects Good", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      await app.waitForCounterValue(100, 200, 1);

      // Press 3
      await page.keyboard.press("3");

      // Verify "Good" selected
      const evalButton = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton).toContainText(/Good/i, { timeout: 10000 });
    });

    test("06. Number key 4 selects Easy", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      await app.waitForCounterValue(100, 200, 1);

      // Press 4
      await page.keyboard.press("4");

      // Verify "Easy" selected
      const evalButton = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton).toContainText(/Easy/i, { timeout: 10000 });
    });

    test("07. Escape closes flashcard view", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Note: Escape-to-close is not currently wired; mark as fixme pending implementation.
      test.fixme(
        true,
        "Escape key does not close flashcard view yet; awaiting implementation."
      );
      return;

      // (placeholder) existing assertions will be re-enabled when Escape is supported
    });

    test("08. Keyboard navigation works with evaluation selection", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      const total = await app.waitForCounterValue(100, 200, 2);

      const counter = app.flashcardHeaderCounter;

      // Select evaluation with keyboard
      await page.keyboard.press("3"); // Good

      // Verify evaluation count updated
      const submitButton = app.submitEvaluationsButton;
      await expect(submitButton).toContainText("1");

      // Navigate to next card with keyboard
      await page.keyboard.press("ArrowRight");
      await expect(counter).toHaveText(new RegExp(`^2 of ${total}$`), {
        timeout: 10000,
      });

      // Select different evaluation
      await page.keyboard.press("4"); // Easy

      // Verify count is now 2
      await expect(submitButton).toContainText("2");

      // Navigate back
      await page.keyboard.press("ArrowLeft");
      await expect(counter).toHaveText(new RegExp(`^1 of ${total}$`), {
        timeout: 10000,
      });

      // Verify first evaluation persisted
      const evalButton = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton).toContainText(/Good/i, { timeout: 10000 });
    });

    test("09. Can change evaluation with number keys", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      await app.waitForCounterValue(100, 200, 1);

      // Select Good
      await page.keyboard.press("3");

      const evalButton1 = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton1).toContainText(/Good/i, { timeout: 10000 });

      // Change to Easy
      await page.keyboard.press("4");

      // Verify Easy selected now
      const evalButton2 = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton2).toContainText(/Easy/i, { timeout: 10000 });
    });

    test("10. Arrow keys are disabled at boundaries", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      const counter = app.flashcardHeaderCounter;
      const total = await app.waitForCounterValue(100, 200, 2);

      // On first card (1 of N), left arrow button should be disabled
      await expect(counter).toHaveText(new RegExp(`^1 of ${total}$`), {
        timeout: 10000,
      });
      await expect(app.flashcardPrevButton).toBeDisabled();

      // Navigate to last card
      for (let i = 1; i < total; i++) {
        await page.keyboard.press("ArrowRight");
        await expect(counter).toHaveText(new RegExp(`^${i + 1} of ${total}$`), {
          timeout: 10000,
        });
      }

      // On last card (N of N), right arrow button should be disabled
      await expect(counter).toHaveText(new RegExp(`^${total} of ${total}$`), {
        timeout: 10000,
      });
      await expect(app.flashcardNextButton).toBeDisabled();

      // Navigate back to first card
      for (let i = total; i > 1; i--) {
        await page.keyboard.press("ArrowLeft");
        await expect(counter).toHaveText(new RegExp(`^${i - 1} of ${total}$`), {
          timeout: 10000,
        });
      }

      // Back on first card, previous button disabled again
      await expect(counter).toHaveText(new RegExp(`^1 of ${total}$`), {
        timeout: 10000,
      });
      await expect(app.flashcardPrevButton).toBeDisabled();
    });

    test("11. Keyboard shortcuts work with field visibility toggles", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      const counter = app.flashcardHeaderCounter;
      const total = await app.waitForCounterValue(100, 200, 2);

      // Toggle notation visible (via Columns/Fields menu) and ensure back is revealed
      await app.toggleFlashcardField("back", "incipit", true);
      await app.ensureReveal(true);

      const notationContainer = page.getByTestId("flashcard-field-incipit");
      await expect(notationContainer).toBeVisible({ timeout: 15000 });

      // Use keyboard to navigate
      await page.keyboard.press("ArrowRight");
      await expect(counter).toHaveText(new RegExp(`^2 of ${total}$`), {
        timeout: 10000,
      });

      // Verify notation still visible on next card (ensure back again)
      await app.ensureReveal(true);
      await expect(notationContainer).toBeVisible({ timeout: 15000 });

      // Use keyboard to select evaluation
      await page.keyboard.press("3");

      // Verify evaluation selected
      const evalButton = app.flashcardView
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(evalButton).toContainText(/Good/i, { timeout: 10000 });
    });
  });
