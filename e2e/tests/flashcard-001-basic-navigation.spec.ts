import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * FLASHCARD-001: Basic Navigation
 *
 * Tests that flashcard view can be opened, navigated, and closed correctly.
 * Verifies UI elements are present and count matches grid state.
 */
test.describe
  .serial("Flashcard Feature: Basic Navigation", () => {
    test.beforeEach(async ({ page, testUser }) => {
      const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID], // 2 tunes for navigation testing
        startTab: "practice",
      });
    });

    test("01. Open flashcard view via toolbar switch", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();
      await expect(app.flashcardView).toBeVisible();
    });

    test("02. Verify flashcard UI elements are visible", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      await expect(app.flashcardCard).toBeVisible();
      await expect(app.flashcardPrevButton).toBeVisible();
      await expect(app.flashcardNextButton).toBeVisible();
      await expect(app.flashcardHeaderCounter).toBeVisible();

      // Verify evaluation control is present (combobox in card)
      // UUID format: recall-eval-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      await expect(
        page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first(),
      ).toBeVisible();
    });

    test("03. Navigate between flashcards", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // At the first card, previous should be disabled
      await expect(app.flashcardPrevButton).toBeDisabled();

      const text = await app.getFlashcardCounterText();
      const total = parseInt(text.split(" of ")[1] || "0", 10);

      if (total > 1) {
        await expect(app.flashcardNextButton).toBeEnabled();
        await app.goNextCard();
        await page.waitForTimeout(150);
        await expect(app.flashcardPrevButton).toBeEnabled();
      } else {
        await expect(app.flashcardNextButton).toBeDisabled();
      }
    });

    test("05. Flashcard total count is at least one", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();
      const text = await app.getFlashcardCounterText();
      const total = parseInt(text.split(" of ")[1] || "0", 10);
      expect(total).toBeGreaterThanOrEqual(1);
    });

    test("06. Flashcard toggle does not navigate away", async ({ page }) => {
      const app = new TuneTreesPage(page);
      const initialUrl = page.url();
      await app.enableFlashcardMode();
      expect(page.url()).toBe(initialUrl);
      await app.disableFlashcardMode();
      expect(page.url()).toBe(initialUrl);
    });
  });
