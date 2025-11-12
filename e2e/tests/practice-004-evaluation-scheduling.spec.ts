import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import type { TestUser } from "../helpers/test-users";

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

let ttPage: any; // TuneTreesPage not available yet, use any for now
let currentTestUser: TestUser;

test.describe.serial("PRACTICE-004: Evaluation Scheduling", () => {
  test.beforeEach(async ({ page, testUser }) => {
    currentTestUser = testUser;
    
    // Set up clean test state with 3 unscheduled tunes
    const { privateTune1Id } = getPrivateTuneIds(testUser.userId);
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [privateTune1Id, TEST_TUNE_MORRISON_ID],
      startTab: "practice",
    });

    // Wait for practice grid to load
    const grid = page.getByTestId("tunes-grid-scheduled");
    await expect(grid).toBeVisible({ timeout: 10000 });
  });

  test("should schedule 'Again' rating for next day minimum (not same day)", async ({
    page,
  }) => {
    // ARRANGE: Get first tune from grid
    const grid = page.getByTestId("tunes-grid-scheduled");
    const firstRow = grid.locator("tbody tr[data-index='0']");
    await expect(firstRow).toBeVisible({ timeout: 5000 });

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

    // Calculate tomorrow's date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find the evaluation dropdown in the first row
    const evalDropdown = firstRow.locator("[data-testid^='recall-eval-']");
    await expect(evalDropdown).toBeVisible({ timeout: 5000 });

    // ACT: Select "Again" rating
    await evalDropdown.click();
    await page.waitForTimeout(500); // Wait for dropdown menu to appear

    const againOption = page.getByTestId("recall-eval-option-again");
    await expect(againOption).toBeVisible({ timeout: 5000 });
    await againOption.click();

    // Wait for staging to complete
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    await page.waitForTimeout(1000); // Wait for database update

    // ASSERT: Verify dropdown shows "Again"
    await expect(evalDropdown).toContainText(/Again/i, { timeout: 5000 });

    // Verify the "Scheduled" column shows tomorrow (not today)
    const scheduledCell = firstRow.locator("td", {
      has: page.locator("text=/20\\d{2}-\\d{2}-\\d{2}/"),
    }).first();
    
    const scheduledText = await scheduledCell.textContent();
    console.log(`Scheduled date text: ${scheduledText}`);

    // Verify it's NOT today
    if (scheduledText) {
      expect(scheduledText).not.toContain(todayStr);
      // Should be tomorrow or later
      expect(
        scheduledText.includes(tomorrowStr) ||
        new Date(scheduledText) >= tomorrow
      ).toBeTruthy();
    }
  });

  test("should submit evaluations and filter completed tunes from grid", async ({
    page,
  }) => {
    // ARRANGE: Evaluate two tunes with different ratings
    const grid = page.getByTestId("tunes-grid-scheduled");
    
    // Count initial rows
    const initialRows = grid.locator("tbody tr[data-index]");
    const initialCount = await initialRows.count();
    console.log(`Initial tune count: ${initialCount}`);
    expect(initialCount).toBeGreaterThan(0);

    // Get first tune dropdown
    const firstRow = grid.locator("tbody tr[data-index='0']");
    const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");
    await expect(firstDropdown).toBeVisible({ timeout: 5000 });

    // Select "Good" for first tune
    await firstDropdown.click();
    await page.waitForTimeout(500);
    const goodOption = page.getByTestId("recall-eval-option-good");
    await expect(goodOption).toBeVisible({ timeout: 5000 });
    await goodOption.click();
    await page.waitForTimeout(500);

    // Verify first dropdown shows "Good"
    await expect(firstDropdown).toContainText(/Good/i, { timeout: 5000 });

    // Select "Hard" for second tune (if exists)
    if (initialCount > 1) {
      const secondRow = grid.locator("tbody tr[data-index='1']");
      const secondDropdown = secondRow.locator("[data-testid^='recall-eval-']");
      await expect(secondDropdown).toBeVisible({ timeout: 5000 });

      await secondDropdown.click();
      await page.waitForTimeout(500);
      const hardOption = page.getByTestId("recall-eval-option-hard");
      await expect(hardOption).toBeVisible({ timeout: 5000 });
      await hardOption.click();
      await page.waitForTimeout(500);

      // Verify second dropdown shows "Hard"
      await expect(secondDropdown).toContainText(/Hard/i, { timeout: 5000 });
    }

    // Wait for staging to complete
    await page.waitForLoadState("networkidle", { timeout: 10000 });

    // Verify evaluations count shows 2 (or at least 1)
    const evaluationsCountText = page.getByText(/\d+ evaluation/i);
    await expect(evaluationsCountText).toBeVisible({ timeout: 5000 });

    // ACT: Submit evaluations
    const submitButton = page.getByRole("button", {
      name: /Submit|Complete/i,
    });
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // Wait for submission to complete
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for grid refresh

    // ASSERT: Verify success message
    await expect(page.getByText(/Successfully submitted/i)).toBeVisible({
      timeout: 5000,
    });

    // Verify tunes disappeared from grid (completed_at filter applied)
    // Grid should now have fewer rows or be empty
    const afterRows = grid.locator("tbody tr[data-index]");
    const afterCount = await afterRows.count();
    console.log(`After submission count: ${afterCount}`);

    // Completed tunes should be filtered out (unless "Show Submitted" is enabled)
    // We expect afterCount < initialCount
    expect(afterCount).toBeLessThan(initialCount);
  });

  test("should show submitted tunes with correct quality when 'Show Submitted' is enabled", async ({
    page,
  }) => {
    // ARRANGE: Evaluate one tune
    const grid = page.getByTestId("tunes-grid-scheduled");
    const firstRow = grid.locator("tbody tr[data-index='0']");
    const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");
    
    await expect(firstDropdown).toBeVisible({ timeout: 5000 });

    // Select "Easy" rating
    await firstDropdown.click();
    await page.waitForTimeout(500);
    const easyOption = page.getByTestId("recall-eval-option-easy");
    await expect(easyOption).toBeVisible({ timeout: 5000 });
    await easyOption.click();
    await page.waitForTimeout(500);

    // Verify dropdown shows "Easy"
    await expect(firstDropdown).toContainText(/Easy/i, { timeout: 5000 });

    // Submit evaluation
    const submitButton = page.getByRole("button", {
      name: /Submit|Complete/i,
    });
    await submitButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // ACT: Enable "Show Submitted" toggle
    const showSubmittedToggle = page.getByRole("checkbox", {
      name: /Show Submitted/i,
    });
    
    // Toggle might be a button or checkbox - try both selectors
    let toggleElement = page.locator(
      "[data-testid='show-submitted-toggle'], button:has-text('Show Submitted')"
    ).first();
    
    if (await toggleElement.isVisible({ timeout: 2000 })) {
      await toggleElement.click();
      await page.waitForTimeout(1000);
    }

    // ASSERT: Submitted tune should now be visible with static evaluation text
    await page.waitForTimeout(1000);
    const rows = grid.locator("tbody tr[data-index]");
    const rowCount = await rows.count();
    
    if (rowCount > 0) {
      // Look for the evaluation column showing "Easy" as static text (not dropdown)
      // When completed_at is set, the evaluation shows as italic text, not dropdown
      const evaluationCells = grid.locator(
        "td span.italic:has-text('Easy')"
      );
      
      // Should have at least one evaluation cell showing "Easy" as static text
      const evalCount = await evaluationCells.count();
      expect(evalCount).toBeGreaterThan(0);
    }
  });

  test("should allow changing evaluation before submission", async ({
    page,
  }) => {
    // ARRANGE: Select initial evaluation
    const grid = page.getByTestId("tunes-grid-scheduled");
    const firstRow = grid.locator("tbody tr[data-index='0']");
    const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");
    
    await expect(firstDropdown).toBeVisible({ timeout: 5000 });

    // Select "Again" first
    await firstDropdown.click();
    await page.waitForTimeout(500);
    const againOption = page.getByTestId("recall-eval-option-again");
    await againOption.click();
    await page.waitForTimeout(500);

    // Verify shows "Again"
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
    
    // Verify only 1 evaluation is counted (not 2)
    const evaluationsCountText = page.getByText(/\d+ evaluation/i);
    await expect(evaluationsCountText).toContainText(/1 evaluation/i, {
      timeout: 5000,
    });
  });

  test("should clear evaluation when selecting '(Not Set)'", async ({
    page,
  }) => {
    // ARRANGE: Select an evaluation first
    const grid = page.getByTestId("tunes-grid-scheduled");
    const firstRow = grid.locator("tbody tr[data-index='0']");
    const firstDropdown = firstRow.locator("[data-testid^='recall-eval-']");
    
    await expect(firstDropdown).toBeVisible({ timeout: 5000 });

    // Select "Good"
    await firstDropdown.click();
    await page.waitForTimeout(500);
    const goodOption = page.getByTestId("recall-eval-option-good");
    await goodOption.click();
    await page.waitForTimeout(500);

    // Verify evaluations count is 1
    let evaluationsCountText = page.getByText(/\d+ evaluation/i);
    await expect(evaluationsCountText).toContainText(/1 evaluation/i, {
      timeout: 5000,
    });

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
    evaluationsCountText = page.getByText(/\d+ evaluation/i);
    await expect(evaluationsCountText).toContainText(/0 evaluation/i, {
      timeout: 5000,
    });
  });
});
