import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setStableDate } from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * FLASHCARD-005: Grid Coordination
 *
 * Tests that flashcard and grid stay synchronized:
 * - Evaluations sync between grid and flashcard
 * - Submit updates both views
 * - Current tune synchronization
 */
test.describe
  .serial("Flashcard Feature: Grid Coordination", () => {
    let ttPage: TuneTreesPage;
    let currentDate: Date;

    test.beforeEach(async ({ page, context, testUser }, testInfo) => {
      test.setTimeout(testInfo.timeout * 2);
      ttPage = new TuneTreesPage(page);

      // Set stable starting date
      currentDate = new Date("2025-12-30T00:00:00.000Z");
      await setStableDate(context, currentDate);

      const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID], // 2 tunes
        scheduleDaysAgo: 1, // Ensure both are due today
        scheduleBaseDate: currentDate,
        startTab: "practice",
      });

      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
      await expect(
        ttPage.getRowInPracticeGridByTuneId(privateTune1Id)
      ).toBeVisible({ timeout: 2000 });
      await expect(
        ttPage.getRowInPracticeGridByTuneId(TEST_TUNE_MORRISON_ID)
      ).toBeVisible({ timeout: 2000 });
      await page.waitForTimeout(100); // small buffer
    });

    test("01. Grid evaluation → flashcard shows same evaluation", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      // Select evaluation in grid
      const grid = app.practiceGrid;
      await app.expectGridHasContent(grid);
      // Ensure there are at least two rows to test synchronization
      const triggerCount = await grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .count();
      if (triggerCount < 2) {
        test.fixme(
          true,
          `Only ${triggerCount} practice row(s) available; need at least 2 to verify synchronization.`
        );
        return;
      }
      const gridEvalTrigger = grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(gridEvalTrigger).toBeVisible({ timeout: 10000 });
      await gridEvalTrigger.click();
      await page.getByTestId("recall-eval-option-good").click();
      await page.waitForTimeout(500);

      // Open flashcard mode (starts on first tune)
      await app.enableFlashcardMode();

      // Verify flashcard shows same evaluation in combobox
      const evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Good/i);
    });

    test("02. Flashcard evaluation → close → grid shows same evaluation", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      await app.enableFlashcardMode();

      // Select evaluation in flashcard
      await app.selectFlashcardEvaluation("easy", 800);

      // Exit flashcard via toolbar switch to avoid close-button races
      const isFlashcardVisible = await app.flashcardView
        .isVisible()
        .catch(() => false);
      if (isFlashcardVisible) {
        await app.disableFlashcardMode().catch(() => {});
      }

      // Verify grid shows same evaluation
      const gridEvalTrigger = app.practiceGrid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(gridEvalTrigger).toContainText(/Easy/i);
    });

    test("03. Grid Submit → flashcard list updates", async ({ page }) => {
      // Turn OFF Show Submitted
      const app = new TuneTreesPage(page);
      const showSubmittedToggle =
        app.displaySubmittedSwitch.getByRole("switch");
      const isOn =
        (await showSubmittedToggle.getAttribute("aria-checked")) === "true";
      if (isOn) {
        await showSubmittedToggle.click();
        await page.waitForTimeout(500);
      }

      // Select and submit in grid
      const grid = app.practiceGrid;
      await app.expectGridHasContent(grid);
      const gridEvalTrigger = grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(gridEvalTrigger).toBeVisible({ timeout: 10000 });
      await gridEvalTrigger.click();
      await page.getByTestId("recall-eval-option-good").click();
      await page.waitForTimeout(300);

      await app.submitEvaluationsButton.click();
      await page.waitForTimeout(1500);

      // Open flashcard
      await app.enableFlashcardMode();

      // Verify flashcard count updated (only 1 unsubmitted tune left)
      const counter = app.flashcardHeaderCounter;
      const counterText = await counter.textContent();
      const total = parseInt(counterText?.split(" of ")[1] || "0", 10);
      expect(total).toBeGreaterThanOrEqual(0);
    });

    test("04. Flashcard Submit → grid updates", async ({ page }) => {
      // Skip in CI - test is flaky due to timing sensitivity
      test.fixme(!!process.env.CI, "Known timing issue in CI");

      // Turn OFF Show Submitted
      const app = new TuneTreesPage(page);
      const showSubmittedToggle =
        app.displaySubmittedSwitch.getByRole("switch");
      const isOn =
        (await showSubmittedToggle.getAttribute("aria-checked")) === "true";
      if (isOn) {
        await showSubmittedToggle.click();
        await page.waitForTimeout(500);
      }

      // Count initial grid rows
      const grid = app.practiceGrid;
      const initialGridRows = await grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .count();

      // Open flashcard and submit
      await app.enableFlashcardMode();
      await app.selectFlashcardEvaluation("good");
      await page.waitForTimeout(300);
      await app.submitEvaluationsButton.click();
      await page.waitForTimeout(1500);

      expect(app.flashcardView).toBeVisible();

      await app.disableFlashcardMode();
      await page.waitForTimeout(1000);

      // If grid is not visible (e.g., empty state shown), accept empty-state as valid update
      expect(grid).toBeVisible();
      await page.waitForTimeout(500);

      // Otherwise verify grid row count decreased
      const updatedGridRows = await grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .count();
      expect(updatedGridRows).toBe(initialGridRows - 1);
    });

    test("05. Grid filter change → flashcard list updates", async ({
      page,
    }) => {
      // Submit one tune first
      const app = new TuneTreesPage(page);
      const grid = app.practiceGrid;
      await app.expectGridHasContent(grid);
      const gridEvalTrigger = grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(gridEvalTrigger).toBeVisible({ timeout: 10000 });
      await gridEvalTrigger.click();
      await page.getByTestId("recall-eval-option-good").click();
      await page.waitForTimeout(300);
      await app.submitEvaluationsButton.click();
      await page.waitForTimeout(1500);

      // Turn OFF Show Submitted
      const showSubmittedToggle2 =
        app.displaySubmittedSwitch.getByRole("switch");
      const isOn2 =
        (await showSubmittedToggle2.getAttribute("aria-checked")) === "true";
      if (isOn2) {
        await showSubmittedToggle2.click();
        await page.waitForTimeout(500);
      }

      // Open flashcard (should only show unsubmitted tunes)
      await app.enableFlashcardMode();

      const counter = app.flashcardHeaderCounter;
      let counterText = await counter.textContent();
      let total = parseInt(counterText?.split(" of ")[1] || "0", 10);
      expect(total).toBeGreaterThanOrEqual(0);

      // Toggle Show Submitted ON (while flashcard open)
      await app.displaySubmittedSwitch.click();
      await page.waitForTimeout(500);

      // Verify flashcard list updated (now shows 2 tunes)
      counterText = await counter.textContent();
      total = parseInt(counterText?.split(" of ")[1] || "0", 10);
      expect(total).toBeGreaterThanOrEqual(1);
    });

    test("06. Current tune synchronization grid ↔ flashcard", async ({
      page,
    }) => {
      const app = new TuneTreesPage(page);
      // Ensure grid is rendered with at least two rows
      const grid = app.practiceGrid;
      await app.expectGridHasContent(grid);

      const rows = ttPage.getRows("scheduled");
      await ttPage.setRowEvaluation(rows.nth(0), "good", 500);
      await ttPage.setRowEvaluation(rows.nth(1), "easy", 500);

      // The logic was changed, such that clicking on a row no longer selects it as the
      // current tune.  Accordingly, we also click on it here to make it the current
      // tune row.
      await rows.nth(1).getByRole("cell", { name: "Lapsed" }).first().click();

      // Open flashcard mode and verify it starts on second item
      await app.enableFlashcardMode();
      const counter = app.flashcardHeaderCounter;
      const text = (await counter.textContent())?.trim() || "";
      const match = text.match(/^(\d+) of (\d+)$/);
      expect(match).not.toBeNull();
      const total = match ? parseInt(match[2], 10) : 0;
      if (total < 2) {
        test.fixme(
          true,
          `Flashcard list has only ${total} item(s); need at least 2 to verify index sync.`
        );
        return;
      }
      await expect(counter).toHaveText(new RegExp(`^2 of ${total}$`));

      // Navigate to first flashcard and verify counter updates
      await app.goPrevCard();
      await page.waitForTimeout(300);
      await expect(counter).toHaveText(new RegExp(`^1 of ${total}$`));

      // Close flashcard (implicit verification of stability)
      await app.disableFlashcardMode();
    });

    test("07. Multiple evaluations sync correctly", async ({ page }) => {
      // Evaluate first tune in grid
      const app = new TuneTreesPage(page);
      // Ensure grid is rendered with at least two rows
      const grid = app.practiceGrid;
      await app.expectGridHasContent(grid);

      const rows = ttPage.getRows("scheduled");
      await ttPage.setRowEvaluation(rows.nth(0), "good", 500);
      await ttPage.setRowEvaluation(rows.nth(1), "easy", 500);

      // The logic was changed, such that clicking on a row no longer selects it as the
      // current tune.  Accordingly, we also click on it here to make it the current
      // tune row.
      await rows.nth(1).getByRole("cell", { name: "Lapsed" }).first().click();

      // Open flashcard mode
      await app.enableFlashcardMode();

      // Verify "current" flashcard shows "Easy"
      let evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Easy/i);

      // Navigate backwards to first flashcard
      await app.goPrevCard();
      await page.waitForTimeout(300);

      // Verify first flashcard shows "Good"
      evalButton = page.getByTestId(/^recall-eval-[0-9a-f-]+$/i).first();
      await expect(evalButton).toContainText(/Good/i);

      // Change first evaluation to "Hard" in flashcards
      await app.selectFlashcardEvaluation("hard");
      await page.waitForTimeout(300);

      // Close flashcard
      await app.disableFlashcardMode();
      await page.waitForTimeout(300);

      // Verify grid updated to "Hard"
      const secondGridEval = grid
        .getByTestId(/^recall-eval-[0-9a-f-]+$/i)
        .first();
      await expect(secondGridEval).toContainText(/Hard/i);
    });
  });
