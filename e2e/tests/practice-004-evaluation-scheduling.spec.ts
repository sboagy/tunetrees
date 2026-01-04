import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * PRACTICE-004: Evaluation Scheduling and Submission
 * Priority: Critical
 *
 * Tests practice evaluation workflow with focus on:
 * 1. Minimum next-day scheduling for "Again" ratings (Issue #1)
 * 2. Dropdown state after submission (Issue #2)
 * 3. Proper filtering of completed tunes
 *
 * Test Scenarios:
 * - User evaluates tunes with different ratings (Again, Hard, Good, Easy)
 * - Verifies "Again" rating schedules for next day minimum (not same day)
 * - Verifies submitted tunes disappear from grid (completed_at filtering)
 * - Verifies evaluation dropdowns reflect correct state before/after submission
 */

let ttPage: TuneTreesPage;

test.describe
  .serial("PRACTICE-004: Evaluation Scheduling", () => {
    test.setTimeout(45000);

    test.beforeEach(async ({ page, testUser }) => {
      ttPage = new TuneTreesPage(page);

      // Set up clean test state with 2 unscheduled tunes
      const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
      await setupForPracticeTestsParallel(page, testUser, {
        repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID],
        startTab: "practice",
      });

      // Wait for practice grid to load
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
    });

    test("should schedule 'Again' rating for tomorrow (not today)", async () => {
      // ARRANGE: Get first tune evaluation dropdown
      const rows = ttPage.getRows("scheduled");
      const firstRow = rows.first();
      const evalDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      // ACT: Select "Again" rating
      await ttPage.setRowEvaluation(firstRow, "again");

      // ASSERT: Verify dropdown shows "Again"
      await expect(evalDropdown).toContainText(/Again/i, { timeout: 5000 });

      // Verify "Scheduled" column does NOT show "Today"
      const scheduledColumnIndex = await ttPage.getColumnIndexByHeaderText(
        "tunes-grid-scheduled",
        "scheduled"
      );
      const scheduledCell = firstRow
        .getByRole("cell")
        .nth(scheduledColumnIndex);
      const scheduledText = await scheduledCell.textContent();

      console.log(`Scheduled text after "Again" rating: "${scheduledText}"`);
      expect(scheduledText).not.toContain("Today");
    });

    test("should evaluate first tune as Good", async () => {
      // ARRANGE: Get first tune evaluation dropdown
      const rows = ttPage.getRows("scheduled");
      const firstRow = rows.first();
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      await expect(firstDropdown).toBeVisible({ timeout: 5000 });

      // ACT: Select "Good" rating
      await ttPage.setRowEvaluation(firstRow, "good");

      // ASSERT: Verify dropdown shows "Good"
      await expect(firstDropdown).toContainText(/Good/i, { timeout: 5000 });

      // const submitTextContent =
      //   await ttPage.submitEvaluationsButton.textContent();

      const badgeSpan = await ttPage.submitEvaluationsButton
        .locator("span")
        .nth(1);

      await expect(badgeSpan).toHaveText("1");
    });

    test("should evaluate second tune as Hard", async () => {
      const rows = ttPage.getRows("scheduled");
      const secondRow = rows.nth(1);

      // ARRANGE: Get second tune evaluation dropdown
      await expect(secondRow).toBeVisible({ timeout: 5000 });

      const secondDropdown = secondRow.locator("[data-testid^='recall-eval-']");
      await expect(secondDropdown).toBeVisible({ timeout: 5000 });

      // ACT: Select "Hard" rating
      await ttPage.setRowEvaluation(secondRow, "hard");

      // ASSERT: Verify dropdown shows "Hard"
      await expect(secondDropdown).toContainText(/Hard/i, { timeout: 5000 });

      // Verify evaluations count shows 1
      const badgeSpan = await ttPage.submitEvaluationsButton
        .locator("span")
        .nth(1);

      await expect(badgeSpan).toHaveText("1");
    });

    test("should submit evaluation and remove tune from grid", async ({
      page,
    }) => {
      // ARRANGE: Evaluate first tune as "Good"
      const rows = ttPage.getRows("scheduled");
      const firstRow = rows.first();
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      await ttPage.setRowEvaluation(firstRow, "good", 500);

      await expect(firstDropdown).toContainText(/Good/i, { timeout: 5000 });

      // Count initial rows
      const initialRows = ttPage.practiceGrid.locator("tbody tr[data-index]");
      const initialCount = await initialRows.count();
      expect(initialCount).toBe(2);
      console.log(`Initial tune count: ${initialCount}`);

      // ACT: Submit evaluation
      await ttPage.submitEvaluationsButton.click();
      await page.waitForTimeout(500);

      // ASSERT: Verify success message
      await expect(page.getByText(/Successfully submitted/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify tune disappeared from grid
      const afterRows = ttPage.practiceGrid.locator("tbody tr[data-index]");

      const expectedCount = initialCount - 1;
      const maxAttempts = 8;
      const retryDelayMs = 250;

      let afterCount = await afterRows.count();

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        afterCount = await afterRows.count();
        console.log(
          `After submission count (attempt ${attempt}/${maxAttempts}): ${afterCount}`
        );

        if (afterCount === expectedCount) break;

        if (attempt < maxAttempts) {
          await page.waitForTimeout(retryDelayMs);
        }
      }

      expect(afterCount).toBe(expectedCount);
    });

    test("should allow changing evaluation before submission", async () => {
      // ARRANGE: Select "Again" rating first
      const rows = ttPage.getRows("scheduled");
      const firstRow = rows.first();
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      await ttPage.setRowEvaluation(firstRow, "again");

      await expect(firstDropdown).toContainText(/Again/i, { timeout: 5000 });

      // ACT: Change to "Good"
      await ttPage.setRowEvaluation(firstRow, "good");

      // ASSERT: Dropdown now shows "Good"
      await expect(firstDropdown).toContainText(/Good/i, { timeout: 5000 });

      // Verify only 1 evaluation is counted
      const badgeSpan = await ttPage.submitEvaluationsButton
        .locator("span")
        .nth(1);

      await expect(badgeSpan).toHaveText("1");
    });

    test("should clear evaluation when selecting '(Not Set)'", async ({
      page,
    }) => {
      const rows = ttPage.getRows("scheduled");
      const firstRow = rows.first();

      await ttPage.setRowEvaluation(firstRow, "good", 500);

      // Verify evaluation count is 1
      const badgeSpan = await ttPage.submitEvaluationsButton
        .locator("span")
        .nth(1);

      await expect(badgeSpan).toHaveText("1");

      await ttPage.setRowEvaluation(firstRow, "not-set", 500);

      const evalNotSetDropdown = page
        .getByRole("cell", { name: "(Not Set)" })
        .first();

      await expect(evalNotSetDropdown).toBeVisible();

      // Evaluations count should be 0
      await expect(ttPage.submitEvaluationsButton.locator("span")).toHaveCount(
        1
      );
    });
  });
