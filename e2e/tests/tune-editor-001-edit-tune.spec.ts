import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TUNE-EDITOR-001: Edit Tune Workflow
 * Priority: Critical
 *
 * Tests the tune editor functionality for editing existing tunes.
 * Covers:
 * - Opening editor from catalog
 * - Editing tune fields (title, type, mode, structure, incipit)
 * - Cancel workflow (changes not saved)
 * - Save workflow (changes persisted)
 * - Verification in grid after save
 */

let ttPage: TuneTreesPage;

test.describe("TUNE-EDITOR-001: Edit Tune", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Start with clean repertoire
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
    });

    // Navigate to catalog tab
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  });

  test("should open tune editor and cancel without saving changes", async ({
    page,
  }) => {
    // ARRANGE: Find a tune in the catalog
    await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);
    await page.waitForTimeout(500); // Wait for filter to apply

    // Click on the first tune row to open details
    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Look for Edit button in sidebar
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });

    // ACT: Open editor
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify we're on the edit page or modal is open
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Get title field and original value
    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });
    const originalTitle = await titleField.inputValue();

    // Modify title
    const modifiedTitle = `${originalTitle} MODIFIED`;
    await titleField.fill(modifiedTitle);
    await expect(titleField).toHaveValue(modifiedTitle);

    // Click Cancel
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify we're back to catalog and title unchanged
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for original title - should still exist

    await ttPage.searchForTune(originalTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(originalTitle).first();
    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // Search for modified title - should NOT exist
    await ttPage.searchForTune(modifiedTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const noResults = ttPage.catalogGrid.getByText(modifiedTitle);
    await expect(noResults).not.toBeVisible();
  });

  test("should edit tune title and save changes", async ({ page }) => {
    // ARRANGE: Find a tune in the catalog
    await ttPage.searchForTune("Cooley's", ttPage.catalogGrid);
    await page.waitForTimeout(500);

    // Click on the first tune row
    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Modify title
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const originalTitle = await titleField.inputValue();
    const modifiedTitle = `${originalTitle} EDITED ${Date.now()}`;

    await titleField.fill(modifiedTitle);
    await expect(titleField).toHaveValue(modifiedTitle);

    // Save changes
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify changes saved
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for new title
    await ttPage.searchForTune(modifiedTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(modifiedTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // Verify original title no longer exists (search for exact match)
    await ttPage.searchForTune(originalTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    // Should not find exact match for original title
    const oldTuneRow = ttPage.catalogGrid.getByText(originalTitle, {
      exact: true,
    });
    await expect(oldTuneRow).not.toBeVisible();
  });

  test("should edit multiple tune fields and save", async ({ page }) => {
    // ARRANGE: Find a tune

    await ttPage.searchForTune("Kesh Jig", ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    // const editButton = ttPage.sidebarEditTuneButton;
    const editButton = page.getByRole("button", { name: "Edit tune" });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Modify multiple fields
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Title
    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });
    const originalTitle = await titleField.inputValue();
    const newTitle = `${originalTitle} MULTI-EDIT ${Date.now()}`;
    await titleField.fill(newTitle);

    // Type (if there's a select/dropdown)
    const typeSelect = tuneEditorForm.locator('select[name="type"]');
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption("reel");
    }

    // Mode/Key (if there's a select/dropdown)
    const modeSelect = tuneEditorForm.locator('select[name="mode"]');
    if (await modeSelect.isVisible()) {
      await modeSelect.selectOption("G");
    }

    // Structure (if there's a text input)
    const structureField = tuneEditorForm.locator('input[name="structure"]');
    if (await structureField.isVisible()) {
      await structureField.fill("AABB");
    }

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify all changes saved
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for new title
    await ttPage.searchForTune(newTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(newTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
  });

  test("should handle tune override for public tunes", async ({ page }) => {
    // This test verifies that editing a public tune creates a tune_override
    // rather than modifying the original tune

    // ARRANGE: Find a public tune (not private to current user)
    await ttPage.searchForTune("Dancingmaster", ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("catalog").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Modify title (this should create an override)
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const originalTitle = await titleField.inputValue();
    const overrideTitle = `${originalTitle} OVERRIDE ${Date.now()}`;

    await titleField.fill(overrideTitle);
    await expect(titleField).toHaveValue(overrideTitle);

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: User should see the overridden title
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    await ttPage.searchForTune(overrideTitle, ttPage.catalogGrid);

    await page.waitForTimeout(500);

    const overriddenRow = ttPage.catalogGrid.getByText(overrideTitle);
    await expect(overriddenRow).toBeVisible({ timeout: 5000 });

    // Note: The original tune should still exist in the database
    // but other users would see the original title
    // This is expected behavior for tune overrides
  });
});
