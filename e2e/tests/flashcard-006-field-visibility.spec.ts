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
 * FLASHCARD-006: Field Visibility
 *
 * Tests that Show Notation, Show Audio, and Show Links toggles work correctly
 * in flashcard mode, persist across cards, and remain independent from grid.
 */
test.describe
  .serial("Flashcard Feature: Field Visibility", () => {
    test.beforeEach(async ({ page, testUser }) => {
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [
          TEST_TUNE_BANISH_ID,
          TEST_TUNE_MASONS_ID,
          TEST_TUNE_MORRISON_ID,
        ], // ensure >= 2 cards available
        scheduleDaysAgo: 1, // Ensure multiple cards are available
        startTab: "practice",
      });
    });

    test("01. Default hides back-only fields until toggled", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Back-only field 'incipit' should be hidden until revealed and enabled
      const incipit = page.getByTestId("flashcard-field-incipit");
      await expect(incipit).toBeHidden();
    });

    test("02. Toggle back field 'incipit' via Fields menu", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      const incipit = page.getByTestId("flashcard-field-incipit");
      await expect(incipit).toBeHidden();

      // Enable 'incipit' on back face and reveal card
      await app.toggleFlashcardField("back", "incipit", true);
      await app.ensureReveal(true);
      await expect(incipit).toBeVisible({ timeout: 15000 });

      // Disable again -> should hide
      await app.toggleFlashcardField("back", "incipit", false);
      await page.waitForTimeout(200);
      await expect(incipit).toBeHidden();
    });

    test("03. Toggle back field 'favorite_url' (links)", async ({ page }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      const links = page.getByTestId("flashcard-field-favorite_url");
      await expect(links).toBeHidden();

      await app.toggleFlashcardField("back", "favorite_url", true);
      await app.ensureReveal(true);
      await expect(links).toBeVisible({ timeout: 15000 });

      await app.toggleFlashcardField("back", "favorite_url", false);
      await page.waitForTimeout(200);
      await expect(links).toBeHidden();
    });

    test("04. Multiple field toggles persist across cards", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Ensure we have at least 2 cards before navigating.
      await app.waitForCounterValue(100, 200, 2);

      // Enable incipit and favorite_url on back
      await app.toggleFlashcardField("back", "incipit", true);
      await app.toggleFlashcardField("back", "favorite_url", true);
      await app.ensureReveal(true);

      const incipit = page.getByTestId("flashcard-field-incipit");
      const links = page.getByTestId("flashcard-field-favorite_url");
      await expect(incipit).toBeVisible({ timeout: 15000 });
      await expect(links).toBeVisible({ timeout: 15000 });

      // Navigate next and verify still visible (reveal back again)
      await app.goNextCard();
      await app.ensureReveal(true);
      await expect(incipit).toBeVisible({ timeout: 15000 });
      await expect(links).toBeVisible({ timeout: 15000 });
    });

    test("05. Field visibility independent from grid", async ({ page }) => {
      const app = new TuneTreesPage(page);
      // Ensure grid toggle doesn't impact flashcard (simulate grid-only toggle if present)
      const gridShowNotation = page.getByTestId("grid-show-notation");
      const gridToggleVisible = await gridShowNotation
        .isVisible()
        .catch(() => false);
      if (gridToggleVisible) {
        await gridShowNotation.click();
        await page.waitForTimeout(200);
      }

      await app.enableFlashcardMode();
      const incipit = page.getByTestId("flashcard-field-incipit");
      await expect(incipit).toBeHidden();

      await app.toggleFlashcardField("back", "incipit", true);
      await app.ensureReveal(true);
      await expect(incipit).toBeVisible({ timeout: 15000 });

      // Close and reopen to verify persistence
      await app.disableFlashcardMode();
      await app.enableFlashcardMode();
      await app.ensureReveal(true);
      await expect(incipit).toBeVisible({ timeout: 15000 });
    });
    // Note: Persistence across open/close covered above
  });
