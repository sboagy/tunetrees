import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TUNE-IMPORT-001: Import Tune from TheSession.org
 * Priority: High
 *
 * Tests importing tunes from TheSession.org.
 * These tests require real network access to thesession.org.
 *
 * To run these tests locally:
 *   ENABLE_IMPORT_TESTS=true npx playwright test tune-import-001
 *
 * Covers:
 * - Import by direct URL (single setting)
 * - Import by direct URL (multiple settings - user selection)
 * - Search by title and import (multiple results)
 * - Error handling for invalid URLs
 * - Verification of imported data (title, type, mode, ABC notation)
 *
 * NOTE: These tests are SKIPPED in CI by default to avoid external dependencies.
 * Set ENABLE_IMPORT_TESTS=true in GitHub Actions secrets to enable.
 */

let ttPage: TuneTreesPage;

// Skip tests unless explicitly enabled
const importTestsEnabled = process.env.ENABLE_IMPORT_TESTS === "true";
const describeImport = importTestsEnabled ? test.describe : test.describe.skip;

describeImport("TUNE-IMPORT-001: Import from TheSession", () => {
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

  test("should import tune by direct URL with single setting", async ({
    page,
  }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = page.locator('[role="alertdialog"]');
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // Ensure ITRAD genre is selected (required for import)
    const genreSelect = addTuneDialog.locator("#genre-select");
    if (await genreSelect.isVisible()) {
      // Genre should default to ITRAD, but verify
      const selectedGenre = await genreSelect.textContent();
      expect(selectedGenre).toContain("Irish Traditional");
    }

    // ACT: Enter TheSession URL
    const urlOrTitleInput = page.getByTestId("addtune-url-or-title-input");
    await expect(urlOrTitleInput).toBeVisible({ timeout: 5000 });

    // Use a well-known tune with single setting: "Star of Munster"
    const testUrl = "https://thesession.org/tunes/1";
    await urlOrTitleInput.fill(testUrl);

    // Click Import button
    const importButton = page.getByRole("button", { name: /import/i });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await expect(importButton).toBeEnabled();
    await importButton.click();

    // Wait for import to complete and navigate to editor
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Should navigate to tune editor with imported data
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // ASSERT: Verify imported data
    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const importedTitle = await titleField.inputValue();
    expect(importedTitle).toBeTruthy();
    expect(importedTitle.length).toBeGreaterThan(0);
    console.log("Imported tune title:", importedTitle);

    // Verify type field is populated
    const typeSelect = tuneEditorForm.locator('select[name="type"]');
    if (await typeSelect.isVisible()) {
      const typeValue = await typeSelect.inputValue();
      expect(typeValue).toBeTruthy();
      console.log("Imported tune type:", typeValue);
    }

    // Verify mode/key is populated
    const modeSelect = tuneEditorForm.locator('select[name="mode"]');
    if (await modeSelect.isVisible()) {
      const modeValue = await modeSelect.inputValue();
      expect(modeValue).toBeTruthy();
      console.log("Imported tune mode:", modeValue);
    }

    // Verify incipit is populated
    const incipitField = tuneEditorForm.locator('textarea[name="incipit"]');
    if (await incipitField.isVisible()) {
      const incipitValue = await incipitField.inputValue();
      expect(incipitValue).toBeTruthy();
      expect(incipitValue.length).toBeGreaterThan(0);
      console.log("Imported incipit length:", incipitValue.length);
    }

    // Save the imported tune
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify tune appears in catalog
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    const searchBox = ttPage.searchBox;
    await expect(searchBox).toBeVisible({ timeout: 5000 });
    await searchBox.fill(importedTitle);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(importedTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
  });

  test("should import tune by direct URL with multiple settings", async ({
    page,
  }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = page.locator('[role="alertdialog"]');
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // ACT: Enter TheSession URL for tune with multiple settings
    const urlOrTitleInput = page.getByTestId("addtune-url-or-title-input");
    await expect(urlOrTitleInput).toBeVisible({ timeout: 5000 });

    // Use "Tam Lin" which has multiple settings
    const testUrl = "https://thesession.org/tunes/248";
    await urlOrTitleInput.fill(testUrl);

    const importButton = page.getByRole("button", { name: /import/i });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();

    // Wait for setting selection dialog to appear
    await page.waitForTimeout(2000); // Give time for API call

    const settingDialog = page.getByRole("heading", {
      name: /select a setting/i,
    });
    await expect(settingDialog).toBeVisible({ timeout: 15000 });

    // Select Setting 2
    const setting2Radio = page.getByText("Setting 2", { exact: true });
    await expect(setting2Radio).toBeVisible({ timeout: 5000 });
    await setting2Radio.click();

    // Confirm selection
    const selectButton = page.getByRole("button", { name: /select/i });
    await expect(selectButton).toBeVisible({ timeout: 5000 });
    await selectButton.click();

    // Wait for navigation to editor
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // ASSERT: Verify we're in editor with imported data
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const importedTitle = await titleField.inputValue();
    expect(importedTitle).toContain("Tam Lin");

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify in catalog
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    const searchBox = ttPage.searchBox;
    await searchBox.fill(importedTitle);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(importedTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
  });

  test("should search by title and select from multiple results", async ({
    page,
  }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = page.locator('[role="alertdialog"]');
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // ACT: Enter search term (not a URL)
    const urlOrTitleInput = page.getByTestId("addtune-url-or-title-input");
    await expect(urlOrTitleInput).toBeVisible({ timeout: 5000 });

    // Search for common term that returns multiple results
    await urlOrTitleInput.fill("Cooley");

    // Click Search button
    const searchButton = page.getByRole("button", { name: /search/i });
    await expect(searchButton).toBeVisible({ timeout: 5000 });
    await expect(searchButton).toBeEnabled();
    await searchButton.click();

    // Wait for tune selection dialog
    await page.waitForTimeout(2000); // Give time for API call

    const tuneSelectionHeading = page.getByRole("heading", {
      name: /select a tune/i,
    });
    await expect(tuneSelectionHeading).toBeVisible({ timeout: 15000 });

    // Select first result
    const firstTuneRadio = page
      .locator('input[type="radio"][name="tune-selection"]')
      .first();
    await expect(firstTuneRadio).toBeVisible({ timeout: 5000 });
    await firstTuneRadio.click();

    // Confirm selection
    const selectButton = page.getByRole("button", { name: /^select$/i });
    await expect(selectButton).toBeVisible({ timeout: 5000 });
    await selectButton.click();

    // Wait for potential setting selection or direct to editor
    await page.waitForTimeout(2000);

    // May need to select setting if tune has multiple
    const settingHeading = page.getByRole("heading", {
      name: /select a setting/i,
    });
    if (await settingHeading.isVisible({ timeout: 3000 })) {
      const firstSetting = page.getByText("Setting 1", { exact: true });
      await firstSetting.click();
      const settingSelectButton = page.getByRole("button", { name: /select/i });
      await settingSelectButton.click();
    }

    // Should navigate to editor
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // ASSERT: Verify we're in editor
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const importedTitle = await titleField.inputValue();
    expect(importedTitle).toBeTruthy();
    expect(importedTitle.toLowerCase()).toContain("cooley");
  });

  test("should handle invalid URL gracefully", async ({ page }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = page.locator('[role="alertdialog"]');
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // ACT: Enter invalid URL
    const urlOrTitleInput = page.getByTestId("addtune-url-or-title-input");
    await expect(urlOrTitleInput).toBeVisible({ timeout: 5000 });

    // Use invalid TheSession URL
    await urlOrTitleInput.fill("https://thesession.org/tunes/999999999");

    const importButton = page.getByRole("button", { name: /import/i });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();

    // ASSERT: Should show error message
    await page.waitForTimeout(3000); // Give time for API call to fail

    // Look for error message in dialog
    const errorMessage = addTuneDialog.locator(".text-red-600,.text-red-400");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Error text should indicate failure
    const errorText = await errorMessage.textContent();
    expect(errorText).toBeTruthy();
    console.log("Error message:", errorText);
  });

  test("should handle search with no results", async ({ page }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = page.locator('[role="alertdialog"]');
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // ACT: Search for nonsense term
    const urlOrTitleInput = page.getByTestId("addtune-url-or-title-input");
    await expect(urlOrTitleInput).toBeVisible({ timeout: 5000 });

    // Use search term that won't match any tunes
    await urlOrTitleInput.fill("XYZABC123456789NOTAREALTUNE");

    const searchButton = page.getByRole("button", { name: /search/i });
    await expect(searchButton).toBeVisible({ timeout: 5000 });
    await searchButton.click();

    // ASSERT: Should show "no results" error
    await page.waitForTimeout(3000); // Give time for API call

    const errorMessage = addTuneDialog.locator(".text-red-600,.text-red-400");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    const errorText = await errorMessage.textContent();
    expect(errorText?.toLowerCase()).toContain("no tunes found");
  });
});
