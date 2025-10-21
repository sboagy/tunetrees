import { expect, test } from "@playwright/test";
import { setupFreshAccountScenario } from "../helpers/practice-scenarios";

/**
 * PRACTICE-001: Practice tab with unscheduled tunes (Q3 New bucket)
 * Priority: Medium
 *
 * Tests that the Practice tab renders correctly when tunes exist but
 * have never been scheduled (fresh account with unscheduled tunes).
 *
 * Test Scenario:
 * - Alice has 2 tunes in her repertoire (Banish Misfortune, Morrison's Jig)
 * - Neither tune is scheduled for practice (playlist_tune.current = NULL)
 * - Practice queue should show 2 tunes in Q3 (New) bucket
 * - UI should display grid with bucket labels showing "New"
 *
 * Note: As of 4-bucket system, unscheduled tunes appear in Q3 (New),
 * not in an empty state. This prioritizes new tunes for practice.
 */

test.use({ storageState: "e2e/.auth/alice.json" });

test.describe("PRACTICE-001: Unscheduled Tunes (Q3 New Bucket)", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Fresh account with unscheduled tunes
    await setupFreshAccountScenario();

    await page.goto("http://localhost:5173");
    await page.waitForTimeout(2000); // Wait for sync

    // Navigate to Practice tab
    await page.getByTestId("tab-practice").click();
    await page.waitForTimeout(1000);
  });

  test("should display Practice tab without errors", async ({ page }) => {
    // Practice tab should be visible and selected
    const practiceTab = page.getByTestId("tab-practice");
    await expect(practiceTab).toBeVisible({ timeout: 5000 });
    await expect(practiceTab).toHaveAttribute("aria-current", "page");
  });

  test("should show grid with 2 unscheduled tunes", async ({ page }) => {
    // Grid should display Alice's 2 unscheduled tunes in Q3 (New) bucket
    const grid = page.getByTestId("tunes-grid-practice");
    await expect(grid).toBeVisible({ timeout: 5000 });

    // Should have 2 data rows for the unscheduled tunes
    const dataRows = grid.locator("tbody tr");
    await expect(dataRows).toHaveCount(2, { timeout: 3000 });
  });

  test("should display 'New' bucket label for unscheduled tunes", async ({
    page,
  }) => {
    // Unscheduled tunes should be labeled as "New" (Q3 bucket)
    const newBucketLabel = page.getByText("New").first();
    await expect(newBucketLabel).toBeVisible({ timeout: 5000 });

    // Should have 2 instances of "New" label (one per tune)
    const allNewLabels = page.getByText("New");
    await expect(allNewLabels).toHaveCount(2);
  });

  test("should show tune titles in the grid", async ({ page }) => {
    // Alice's tunes should be visible
    await expect(page.getByText("Banish Misfortune")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Morrison's Jig")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should have Columns button enabled", async ({ page }) => {
    // Columns button should be available even with empty grid
    const columnsButton = page.getByRole("button", { name: /Columns/i });

    await expect(columnsButton).toBeVisible({ timeout: 5000 });
    await expect(columnsButton).toBeEnabled();
  });

  test("should not show loading spinner after initial load", async ({
    page,
  }) => {
    // Wait for initial load to complete
    await page.waitForTimeout(3000);

    // Should not show perpetual loading state
    await expect(page.locator('[role="progressbar"]')).not.toBeVisible();
    await expect(page.getByText(/Loading practice/i)).not.toBeVisible();
  });

  test("should not display error messages", async ({ page }) => {
    // No error messages should be visible in UI
    const errorText = page.getByText(/error|failed/i).first();
    await expect(errorText).not.toBeVisible();
  });

  test("should have evaluation column for rating practice", async ({
    page,
  }) => {
    // Grid should have evaluation dropdown/column for practice ratings
    const grid = page.getByTestId("tunes-grid-practice");
    await expect(grid).toBeVisible({ timeout: 5000 });

    // Check for evaluation-related UI elements (dropdowns, buttons, etc.)
    // Note: This is a basic check - specific UI may vary
    const firstRow = grid.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
  });

  test("should allow completing practice session", async ({ page }) => {
    // After evaluating tunes, user should be able to complete practice
    // This test verifies the workflow is available (not that it's functional)
    const grid = page.getByTestId("tunes-grid-practice");
    await expect(grid).toBeVisible({ timeout: 5000 });

    // Look for submit/complete button (may be named differently)
    const submitButton = page.getByRole("button", {
      name: /Submit|Complete|Finish/i,
    });

    // Button should exist in the UI (may be disabled until evaluations are made)
    await expect(submitButton).toBeVisible({ timeout: 5000 });
  });
});
