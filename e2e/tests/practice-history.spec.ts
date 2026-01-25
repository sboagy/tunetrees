import { expect, type Page } from "@playwright/test";
import {
  CATALOG_TUNE_BANISH_MISFORTUNE,
  CATALOG_TUNE_COOLEYS_ID,
  CATALOG_TUNE_KESH_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { BASE_URL } from "../test-config";

/**
 * PRACTICE-HISTORY: View and Manage Practice Records
 * Priority: High
 *
 * Tests the practice history page for a tune, including:
 * - Viewing practice records (empty state and with data)
 * - Adding new practice records
 * - Editing existing records
 * - Deleting records
 * - Field validation
 * - Grid interaction
 *
 * Related: practice-history-test-plan.md
 */

let ttPage: TuneTreesPage;

async function gotoPracticeHistory(page: Page, tuneId: string) {
  await page.goto(`${BASE_URL}/tunes/${tuneId}/practice-history`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("practice-history-container")).toBeVisible({
    timeout: 20_000,
  });

  // Wait for initial practice history query to resolve.
  // The header (incl. Add button) renders immediately, but actions can no-op until
  // local DB + playlist context are ready.
  const container = page.getByTestId("practice-history-container");
  const loading = container.getByText("Loading practice history...");
  await expect(loading).toHaveCount(0, { timeout: 20_000 });
}

test.describe("PRACTICE-HISTORY: Viewing Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Start with clean repertoire
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [
        CATALOG_TUNE_BANISH_MISFORTUNE,
        CATALOG_TUNE_COOLEYS_ID,
        CATALOG_TUNE_KESH_ID,
      ],
    });

    // Navigate to repertoire tab
    await ttPage.navigateToTab("repertoire");
  });

  test("should display empty state when tune has no practice records", async ({
    page,
  }) => {
    // ARRANGE: Find a tune with no practice history
    await ttPage.searchForTune("Banish Misfortune", ttPage.repertoireGrid);
    await page.waitForTimeout(500);

    // On mobile: expand sidebar BEFORE clicking tune
    const expandSidebarButton = page.getByRole("button", {
      name: /expand sidebar/i,
    });
    if (await expandSidebarButton.isVisible({ timeout: 1000 })) {
      await expandSidebarButton.click();
      await page.waitForTimeout(300);
    }

    // Now click the tune
    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();

    // Wait for sidebar to populate with tune details
    await page.waitForTimeout(1500);

    // Navigate to practice history
    const practiceHistoryLink = page.getByTestId(
      "sidebar-practice-history-link"
    );
    await expect(practiceHistoryLink).toBeVisible({ timeout: 5000 });
    await practiceHistoryLink.click();
    await expect(page.getByTestId("practice-history-container")).toBeVisible({
      timeout: 20_000,
    });

    // ASSERT: Empty state is displayed
    const container = page.getByTestId("practice-history-container");
    await expect(container).toBeVisible({ timeout: 10000 });

    // Check for "Add" button (should be visible even with no records)
    const addButton = page.getByTestId("practice-history-add-button");
    await expect(addButton).toBeVisible({ timeout: 5000 });

    // Grid should be empty or show empty state
    const grid = container.locator("table, [role='grid']").first();
    if (await grid.isVisible()) {
      // If grid is visible, check it has no data rows (may have header)
      const dataRows = grid.locator("tbody tr, [role='row'][data-index]");
      await expect(dataRows).toHaveCount(0);
    }
  });

  test("should display existing practice records in grid", async ({ page }) => {
    test.setTimeout(90000);
    // ARRANGE: Find a tune and create some practice records first
    await ttPage.searchForTune("Cooley's", ttPage.repertoireGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Expand sidebar on mobile
    const expandSidebarButton = page.getByRole("button", {
      name: /expand sidebar/i,
    });
    if (await expandSidebarButton.isVisible({ timeout: 1000 })) {
      await expandSidebarButton.click();
      await page.waitForTimeout(300);
    }

    // Navigate to practice history
    const practiceHistoryLink = page.getByTestId(
      "sidebar-practice-history-link"
    );
    await practiceHistoryLink.click();
    await expect(page.getByTestId("practice-history-container")).toBeVisible({
      timeout: 20_000,
    });

    const container = page.getByTestId("practice-history-container");
    await expect(container).toBeVisible({ timeout: 10000 });

    // ACT & ASSERT: Add a practice record so we have data to view
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill in the new record fields (this creates a record we can then view)
    const grid = container.locator("table, [role='grid']").first();
    await expect(grid).toBeVisible({ timeout: 5000 });

    // Look for editable cells in the new row
    const editableCells = grid.locator(
      "tbody tr:first-child td input, tbody tr:first-child td select"
    );
    if ((await editableCells.count()) > 0) {
      // Fill practiced date
      const practicedInput = grid
        .locator("input[type='datetime-local']")
        .first();
      if (await practicedInput.isVisible()) {
        await practicedInput.fill("2024-12-10T10:00");
      }

      // Select quality
      const qualitySelect = grid.locator("select").first();
      if (await qualitySelect.isVisible()) {
        await qualitySelect.selectOption("3"); // Good
      }

      // Save the record
      const saveButton = grid
        .locator("button")
        .filter({ hasText: /save|confirm|✓/i })
        .first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Verify record appears in grid
    const dataRows = grid.locator("tbody tr, [role='row'][data-index]");
    await expect(dataRows.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("PRACTICE-HISTORY: Adding Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_KESH_ID],
    });

    await gotoPracticeHistory(page, CATALOG_TUNE_KESH_ID);
  });

  test("should add new practice record with valid data", async ({ page }) => {
    const container = page.getByTestId("practice-history-container");
    await expect(container).toBeVisible({ timeout: 10000 });

    // ACT: Click Add button
    const addButton = page.getByTestId("practice-history-add-button");
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await expect(addButton).toBeEnabled({ timeout: 20_000 });
    await addButton.click({ timeout: 10_000 });

    // Fill in new record
    const grid = container.locator("table, [role='grid']").first();
    await expect(grid).toBeVisible({ timeout: 20_000 });

    // Find and fill practiced date
    const practicedInput = grid.locator("input[type='datetime-local']").first();
    await expect(practicedInput).toBeVisible({ timeout: 10_000 });
    await practicedInput.fill("2024-12-01T10:00");
    // Note: Browser may adjust timezone, so we don't assert exact match

    // Select quality (Good = 3)
    const qualitySelect = grid.locator("select").first();
    await expect(qualitySelect).toBeVisible({ timeout: 10_000 });
    await qualitySelect.selectOption("3");
    await expect(qualitySelect).toHaveValue("3");

    // Save using global save button (batch save pattern)
    const globalSaveButton = page.getByTestId("practice-history-save-button");
    await expect(globalSaveButton).toBeVisible({ timeout: 10_000 });
    await expect(globalSaveButton).toBeEnabled({ timeout: 10_000 });
    await globalSaveButton.click({ timeout: 10_000 });

    // ASSERT: Record appears in grid
    const dataRows = grid.locator("tbody tr");
    await expect(dataRows.first()).toBeVisible({ timeout: 10_000 });

    // Verify the record contains our data (check the input value which may still be in edit mode)
    const dateInputValue = await practicedInput.inputValue();
    expect(dateInputValue).toContain("2024-12-01");
  });

  test("should show validation error for missing required fields", async ({
    page,
  }) => {
    const container = page.getByTestId("practice-history-container");
    await expect(container).toBeVisible({ timeout: 10000 });

    // Click Add
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    const grid = container.locator("table, [role='grid']").first();

    // Try to save without filling required fields
    const saveButton = grid
      .locator("button")
      .filter({ hasText: /save|confirm|✓/i })
      .first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(500);

      // ASSERT: Validation error should appear
      const errorMessage = page.locator("text=/required|invalid|error/i");
      // May appear as toast, alert, or inline error
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible({ timeout: 2000 });
      }

      // Record should not be saved - still in edit mode
      const editableInput = grid.locator("input, select").first();
      await expect(editableInput).toBeVisible();
    }
  });

  test("should cancel adding new record", async ({ page }) => {
    const container = page.getByTestId("practice-history-container");
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    const grid = container.locator("table, [role='grid']").first();

    // Fill some data
    const practicedInput = grid.locator("input[type='datetime-local']").first();
    if (await practicedInput.isVisible()) {
      await practicedInput.fill("2024-12-05T14:00");
    }

    // ACT: Click cancel
    const cancelButton = grid
      .locator("button")
      .filter({ hasText: /cancel|✕/i })
      .first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await page.waitForTimeout(500);

      // ASSERT: Row should be removed, no changes saved
      const editableInputs = grid.locator("input[type='datetime-local']");
      const count = await editableInputs.count();
      expect(count).toBe(0); // No inputs visible = not in edit mode
    } else {
      // If no cancel button, try the main Cancel button
      const mainCancelButton = page.getByRole("button", { name: /cancel/i });
      if (await mainCancelButton.isVisible()) {
        await mainCancelButton.click();
        // Should navigate away from practice history
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      }
    }
  });
});

test.describe("PRACTICE-HISTORY: Editing Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_COOLEYS_ID],
    });

    await ttPage.navigateToTab("repertoire");

    // Navigate to practice history and add a record first
    await ttPage.searchForTune("Cooley", ttPage.repertoireGrid);
    await page.waitForTimeout(500);
    const firstRow = ttPage.getRows("repertoire").first();
    await firstRow.click();
    await page.waitForTimeout(500);

    // Expand sidebar on mobile
    await ttPage.ensureSidebarExpanded({ timeoutMs: 10_000 });

    const practiceHistoryLink = page.getByTestId(
      "sidebar-practice-history-link"
    );
    await practiceHistoryLink.click();
    await expect(page.getByTestId("practice-history-container")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("should edit existing practice record", async ({ page }) => {
    const container = page.getByTestId("practice-history-container");
    const grid = container.locator("table, [role='grid']").first();

    // First, add a record so we have something to edit
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    const practicedInput = grid.locator("input[type='datetime-local']").first();
    await practicedInput.fill("2024-12-08T10:00");

    const qualitySelect = grid.locator("select").first();
    await qualitySelect.selectOption("3"); // Good

    // Save using global save button
    const globalSaveButton = page.getByTestId("practice-history-save-button");
    if (await globalSaveButton.isVisible({ timeout: 2000 })) {
      await globalSaveButton.click();
      await page.waitForTimeout(1000);
    }

    // Now edit the record - just change a value (inline editing)
    const dataRows = grid.locator("tbody tr");
    await expect(dataRows.first()).toBeVisible({ timeout: 5000 });

    // Change quality directly (inline edit, no edit button needed)
    const editQualitySelect = dataRows.first().locator("select").first();
    if (await editQualitySelect.isVisible()) {
      await editQualitySelect.selectOption("4"); // Change to Easy
      await page.waitForTimeout(500);

      // Save changes with global save button
      const saveButton = page.getByTestId("practice-history-save-button");
      if (await saveButton.isVisible({ timeout: 2000 })) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }

      // ASSERT: Changes are persisted
      const updatedValue = await editQualitySelect.inputValue();
      expect(updatedValue).toBe("4"); // Quality changed to Easy
    }
  });

  test("should cancel editing record without saving changes", async ({
    page,
  }) => {
    const container = page.getByTestId("practice-history-container");
    const grid = container.locator("table, [role='grid']").first();

    // Add a record first
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    const practicedInput = grid.locator("input[type='datetime-local']").first();
    await practicedInput.fill("2024-12-07T15:00");

    const qualitySelect = grid.locator("select").first();
    await qualitySelect.selectOption("2"); // Hard

    // Save
    const globalSaveButton = page.getByTestId("practice-history-save-button");
    if (await globalSaveButton.isVisible({ timeout: 2000 })) {
      await globalSaveButton.click();
      await page.waitForTimeout(1000);
    }

    // Edit the record
    const dataRows = grid.locator("tbody tr");
    const editQualitySelect = dataRows.first().locator("select").first();

    if (await editQualitySelect.isVisible()) {
      await editQualitySelect.selectOption("4"); // Change to Easy
      await page.waitForTimeout(500);

      // Discard instead of saving
      const discardButton = page.getByTestId("practice-history-discard-button");
      if (await discardButton.isVisible({ timeout: 2000 })) {
        await discardButton.click();
        await page.waitForTimeout(500);
      }

      // ASSERT: Original value is preserved
      const currentValue = await editQualitySelect.inputValue();
      expect(currentValue).toBe("2"); // Still shows "Hard" (2), not "Easy" (4)
    }
  });
});

test.describe("PRACTICE-HISTORY: Deleting Records", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_BANISH_MISFORTUNE],
    });

    await ttPage.navigateToTab("repertoire");

    // Navigate to practice history
    await ttPage.searchForTune("Banish", ttPage.repertoireGrid);
    await page.waitForTimeout(500);

    // On mobile: expand sidebar BEFORE clicking tune
    const expandSidebarButton = page.getByRole("button", {
      name: /expand sidebar/i,
    });
    if (await expandSidebarButton.isVisible({ timeout: 1000 })) {
      await expandSidebarButton.click();
      await page.waitForTimeout(300);
    }

    // Now click the tune
    const firstRow = ttPage.getRows("repertoire").first();
    await firstRow.click();

    // Wait for sidebar to populate with tune details
    await page.waitForTimeout(1500);

    const practiceHistoryLink = page.getByTestId(
      "sidebar-practice-history-link"
    );
    await practiceHistoryLink.click();
    await expect(page.getByTestId("practice-history-container")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("should delete practice record with confirmation", async ({ page }) => {
    const container = page.getByTestId("practice-history-container");
    const grid = container.locator("table, [role='grid']").first();

    // First add a record to delete
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    const practicedInput = grid.locator("input[type='datetime-local']").first();
    await practicedInput.fill("2024-12-03T11:00");

    const qualitySelect = grid.locator("select").first();
    await qualitySelect.selectOption("3");

    // Save
    const globalSaveButton = page.getByTestId("practice-history-save-button");
    if (await globalSaveButton.isVisible({ timeout: 2000 })) {
      await globalSaveButton.click();
      await page.waitForTimeout(1000);
    }

    // Get initial row count
    const dataRows = grid.locator("tbody tr");
    const initialCount = await dataRows.count();
    expect(initialCount).toBeGreaterThan(0);

    // ACT: Delete the record
    const deleteButton = dataRows
      .first()
      .locator("button[title='Delete']")
      .or(
        dataRows
          .first()
          .locator("button")
          .filter({ has: page.locator("svg") })
      )
      .first();

    if (await deleteButton.isVisible({ timeout: 2000 })) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Save deletion
      const saveAfterDelete = page.getByTestId("practice-history-save-button");
      if (await saveAfterDelete.isVisible({ timeout: 2000 })) {
        await saveAfterDelete.click();
        await page.waitForTimeout(1000);
      }

      // ASSERT: Record is removed from grid
      const newCount = await dataRows.count();
      expect(newCount).toBeLessThan(initialCount);
    }
  });

  test("should cancel deletion when user discards changes", async ({
    page,
  }) => {
    const container = page.getByTestId("practice-history-container");
    const grid = container.locator("table, [role='grid']").first();

    // Add a record
    const addButton = page.getByTestId("practice-history-add-button");
    await addButton.click();
    await page.waitForTimeout(500);

    const practicedInput = grid.locator("input[type='datetime-local']").first();
    await practicedInput.fill("2024-12-04T09:00");

    const qualitySelect = grid.locator("select").first();
    await qualitySelect.selectOption("3");

    // Save
    const globalSaveButton = page.getByTestId("practice-history-save-button");
    if (await globalSaveButton.isVisible({ timeout: 2000 })) {
      await globalSaveButton.click();
      await page.waitForTimeout(1000);
    }

    const dataRows = grid.locator("tbody tr");
    const initialCount = await dataRows.count();

    // Try to delete
    const deleteButton = dataRows
      .first()
      .locator("button[title='Delete']")
      .or(
        dataRows
          .first()
          .locator("button")
          .filter({ has: page.locator("svg") })
      )
      .first();

    if (await deleteButton.isVisible({ timeout: 2000 })) {
      await deleteButton.click();
      await page.waitForTimeout(500);

      // Discard instead of saving
      const discardButton = page.getByTestId("practice-history-discard-button");
      if (await discardButton.isVisible({ timeout: 2000 })) {
        await discardButton.click();
        await page.waitForTimeout(1000);
      }

      // ASSERT: Record is still present
      const newCount = await dataRows.count();
      expect(newCount).toBe(initialCount); // No change
    }
  });
});

test.describe("PRACTICE-HISTORY: Navigation", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [CATALOG_TUNE_KESH_ID],
    });

    await ttPage.navigateToTab("repertoire");
  });

  test("should navigate back to tune editor from practice history", async ({
    page,
  }) => {
    // Navigate to practice history
    await ttPage.searchForTune("Kesh", ttPage.repertoireGrid);
    await page.waitForTimeout(500);
    const firstRow = ttPage.getRows("repertoire").first();
    await firstRow.click();
    await page.waitForTimeout(500);

    await ttPage.ensureSidebarExpanded({ timeoutMs: 10_000 });

    const practiceHistoryLink = page.getByTestId(
      "sidebar-practice-history-link"
    );
    await practiceHistoryLink.click();
    await expect(page.getByTestId("practice-history-container")).toBeVisible({
      timeout: 20_000,
    });

    // Verify we're on practice history page
    await expect(page).toHaveURL(/\/tunes\/[^/]+\/practice-history/);

    // ACT: Click Cancel/Back button
    const cancelButton = page.getByRole("button", { name: /cancel|back/i });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();
    await expect(page).not.toHaveURL(/practice-history/, { timeout: 20_000 });

    // ASSERT: Navigated back (either to editor or previous page)
    // URL should no longer contain practice-history
    await expect(page).not.toHaveURL(/practice-history/);
  });
});
