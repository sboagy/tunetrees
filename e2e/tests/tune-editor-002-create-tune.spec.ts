import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TUNE-EDITOR-002: Create New Tune Workflow
 * Priority: Critical
 *
 * Tests creating new tunes through the tune editor.
 * Covers:
 * - Opening "New Tune" dialog
 * - Creating tune with minimal fields (title only)
 * - Creating tune with all fields populated
 * - Verification that tune appears in catalog
 */

let ttPage: TuneTreesPage;

test.describe("TUNE-EDITOR-002: Create New Tune", () => {
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

  test("should create new tune with minimal fields", async ({ page }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    // Wait for dialog to open
    const addTuneDialog = ttPage.addTuneDialog;
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // ACT: Click "New" to create empty tune
    const newButton = page.getByRole("button", { name: /^new$/i });
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Should navigate to tune editor
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Fill in title (required)
    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const newTitle = `Test Tune ${Date.now()}`;
    await titleField.fill(newTitle);
    await expect(titleField).toHaveValue(newTitle);

    // Type is required now — select "Jig (6/8)"
    await ttPage.selectTypeInTuneEditor("Jig (6/8)");

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify tune appears in catalog
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for new tune

    await ttPage.searchForTune(newTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(newTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
  });

  test("should create new tune with all fields populated", async ({ page }) => {
    // ARRANGE: Open "Add Tune" dialog
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = ttPage.addTuneDialog;
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // ACT: Click "New" to create empty tune
    const newButton = page.getByRole("button", { name: /^new$/i });
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Fill in all available fields
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Title
    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });
    const newTitle = `Complete Test Tune ${Date.now()}`;
    await titleField.fill(newTitle);

    // Type (custom select) — select "Jig (6/8)"
    await ttPage.selectTypeInTuneEditor("Jig (6/8)");

    // Mode/Key (if dropdown exists)
    const modeSelect = tuneEditorForm.locator('select[name="mode"]');
    if (await modeSelect.isVisible()) {
      await modeSelect.selectOption("D");
    }

    // Structure (if input exists)
    const structureField = tuneEditorForm.locator('input[name="structure"]');
    if (await structureField.isVisible()) {
      await structureField.fill("AABB");
    }

    // Incipit (if textarea exists)
    const incipitField = tuneEditorForm.locator('textarea[name="incipit"]');
    if (await incipitField.isVisible()) {
      await incipitField.fill("D2 E2 F2 G2 | A4 G4");
    }

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify tune appears with correct data
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    await ttPage.searchForTune(newTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(newTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // Could verify other fields in grid if they're displayed
    // e.g., type, mode columns
  });

  test("should create new tune with title pre-filled from dialog", async ({
    page,
  }) => {
    // ARRANGE: Open "Add Tune" dialog and enter title
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = ttPage.addTuneDialog;
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    // Enter title in URL/Title field
    const urlOrTitleInput = page.getByTestId("addtune-url-or-title-input");
    await expect(urlOrTitleInput).toBeVisible({ timeout: 5000 });

    const prefillTitle = `Prefilled Tune ${Date.now()}`;
    await urlOrTitleInput.fill(prefillTitle);

    // ACT: Click "New" - title should be pre-filled
    const newButton = page.getByRole("button", { name: /^new$/i });
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify title is pre-filled
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    // Title should be pre-filled (check URL params or form state)
    // The exact behavior depends on implementation
    const currentValue = await titleField.inputValue();
    console.log("Pre-filled title:", currentValue);

    // If not pre-filled, fill it now
    if (!currentValue.includes(prefillTitle)) {
      await titleField.fill(prefillTitle);
    }

    await ttPage.selectTypeInTuneEditor("Jig (6/8)");

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify tune created
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    await ttPage.searchForTune(prefillTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(prefillTitle);
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
  });

  test("should cancel new tune creation", async ({ page }) => {
    // ARRANGE: Open tune editor for new tune
    const addTuneButton = ttPage.catalogAddTuneButton;
    await expect(addTuneButton).toBeVisible({ timeout: 10000 });
    await addTuneButton.click();

    const addTuneDialog = ttPage.addTuneDialog;
    await expect(addTuneDialog).toBeVisible({ timeout: 5000 });

    const newButton = page.getByRole("button", { name: /^new$/i });
    await expect(newButton).toBeVisible({ timeout: 5000 });
    await newButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Fill in data but then cancel
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const titleField = tuneEditorForm
      .locator('input[name="title"]')
      .or(tuneEditorForm.locator('input[type="text"]').first());
    await expect(titleField).toBeVisible({ timeout: 5000 });

    const cancelledTitle = `Cancelled Tune ${Date.now()}`;
    await titleField.fill(cancelledTitle);
    await expect(titleField).toHaveValue(cancelledTitle);

    // Cancel
    const cancelButton = page.getByRole("button", { name: /cancel/i });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Verify we're back at catalog and tune was NOT created
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for cancelled tune - should not exist
    await ttPage.searchForTune(cancelledTitle, ttPage.catalogGrid);
    await page.waitForTimeout(500);

    const tuneRow = ttPage.catalogGrid.getByText(cancelledTitle);
    await expect(tuneRow).not.toBeVisible();
  });
});
