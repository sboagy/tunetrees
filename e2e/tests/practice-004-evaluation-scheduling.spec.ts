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

    test("should schedule 'Again' rating for tomorrow (not today)", async ({
      page,
    }) => {
      // ARRANGE: Get first tune evaluation dropdown
      const firstRow = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      await expect(firstRow).toBeVisible({ timeout: 5000 });

      const evalDropdown = firstRow.locator("[data-testid^='recall-eval-']");
      await expect(evalDropdown).toBeVisible({ timeout: 5000 });

      // ACT: Select "Again" rating
      await evalDropdown.click();
      await page.waitForTimeout(500);

      const againOption = page.getByTestId("recall-eval-option-again");
      await expect(againOption).toBeVisible({ timeout: 5000 });
      await againOption.click();

      // Wait for staging to complete
      await page.waitForLoadState("networkidle", { timeout: 10000 });
      await page.waitForTimeout(1000);

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

    test("should evaluate first tune as Good", async ({ page }) => {
      // ARRANGE: Get first tune evaluation dropdown
      const firstRow = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");
      await expect(firstDropdown).toBeVisible({ timeout: 5000 });

      // ACT: Select "Good" rating
      await firstDropdown.click();
      await page.waitForTimeout(500);

      const goodOption = page.getByTestId("recall-eval-option-good");
      await expect(goodOption).toBeVisible({ timeout: 5000 });
      await goodOption.click();
      await page.waitForTimeout(500);

      // ASSERT: Verify dropdown shows "Good"
      await expect(firstDropdown).toContainText(/Good/i, { timeout: 5000 });

      // const submitTextContent =
      //   await ttPage.submitEvaluationsButton.textContent();

      const badgeSpan = await ttPage.submitEvaluationsButton
        .locator("span")
        .nth(1);

      await expect(badgeSpan).toHaveText("1");
    });

    test("should evaluate second tune as Hard", async ({ page }) => {
      // ARRANGE: Get second tune evaluation dropdown
      const secondRow = ttPage.practiceGrid.locator("tbody tr[data-index='1']");
      await expect(secondRow).toBeVisible({ timeout: 5000 });

      const secondDropdown = secondRow.locator("[data-testid^='recall-eval-']");
      await expect(secondDropdown).toBeVisible({ timeout: 5000 });

      // ACT: Select "Hard" rating
      await secondDropdown.click();
      await page.waitForTimeout(500);

      const hardOption = page.getByTestId("recall-eval-option-hard");
      await expect(hardOption).toBeVisible({ timeout: 5000 });
      await hardOption.click();
      await page.waitForTimeout(500);

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
      const firstRow = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      await expect(firstDropdown).toBeVisible({ timeout: 5000 });
      await firstDropdown.click();
      await page.waitForTimeout(500);

      const goodOption = page.getByTestId("recall-eval-option-good");
      await goodOption.click();
      await page.waitForTimeout(500);

      await expect(firstDropdown).toContainText(/Good/i, { timeout: 5000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 });

      // Count initial rows
      const initialRows = ttPage.practiceGrid.locator("tbody tr[data-index]");
      const initialCount = await initialRows.count();
      console.log(`Initial tune count: ${initialCount}`);

      // ACT: Submit evaluation
      await ttPage.submitEvaluationsButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
      await page.waitForTimeout(2000);

      // ASSERT: Verify success message
      await expect(page.getByText(/Successfully submitted/i)).toBeVisible({
        timeout: 5000,
      });

      // Verify tune disappeared from grid
      const afterRows = ttPage.practiceGrid.locator("tbody tr[data-index]");
      const afterCount = await afterRows.count();
      console.log(`After submission count: ${afterCount}`);

      expect(afterCount).toBe(initialCount - 1);
    });

    test("should allow changing evaluation before submission", async ({
      page,
    }) => {
      // ARRANGE: Select "Again" rating first
      const firstRow = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      await expect(firstDropdown).toBeVisible({ timeout: 5000 });
      await firstDropdown.click();
      await page.waitForTimeout(500);

      const againOption = page.getByTestId("recall-eval-option-again");
      await againOption.click();
      await page.waitForTimeout(500);

      await expect(firstDropdown).toContainText(/Again/i, { timeout: 5000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 });

      // ACT: Change to "Good"
      await firstDropdown.click();
      await page.waitForTimeout(500);

      const goodOption = page.getByTestId("recall-eval-option-good");
      await goodOption.click();
      await page.waitForTimeout(500);

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
      // ARRANGE: Select "Good" rating first
      const firstRow = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");

      await expect(firstDropdown).toBeVisible({ timeout: 5000 });
      await firstDropdown.click();
      await page.waitForTimeout(500);

      const goodOption = page.getByTestId("recall-eval-option-good");
      await goodOption.click();
      await page.waitForTimeout(500);

      // Verify evaluation count is 1
      const badgeSpan = await ttPage.submitEvaluationsButton
        .locator("span")
        .nth(1);

      await expect(badgeSpan).toHaveText("1");

      // ACT: Clear evaluation by selecting "(Not Set)"
      await firstDropdown.click();
      await page.waitForTimeout(500);

      const notSetOption = page.getByTestId("recall-eval-option-not-set");
      await expect(notSetOption).toBeVisible({ timeout: 5000 });
      await notSetOption.click();
      await page.waitForTimeout(500);

      // ASSERT: Dropdown shows "(Not Set)"
      await expect(firstDropdown).toContainText(/(Not Set)/i, {
        timeout: 5000,
      });

      // Evaluations count should be 0
      await expect(ttPage.submitEvaluationsButton.locator("span")).toHaveCount(
        1
      );
    });
  });
