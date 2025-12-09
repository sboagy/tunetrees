import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_BANISH_MISFORTUNE,
  CATALOG_TUNE_COOLEYS_ID,
  CATALOG_TUNE_DANCING_MASTER_ID,
  CATALOG_TUNE_KESH_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * TUNE-EDITOR-004: User-Specific Fields
 * Priority: High
 *
 * Tests that user-specific fields (learned, practiced, quality, FSRS/SM2, notes)
 * are properly saved when editing a tune.
 *
 * Covers:
 * - Loading user-specific fields in editor
 * - Editing learned date
 * - Editing practiced date
 * - Editing quality score
 * - Editing FSRS fields (difficulty, stability, etc.)
 * - Editing SM2 fields (easiness, interval)
 * - Editing private notes
 * - Verifying fields are persisted after save
 */

let ttPage: TuneTreesPage;

test.describe("TUNE-EDITOR-004: User-Specific Fields", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Start with clean repertoire with some test data
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [
        CATALOG_TUNE_BANISH_MISFORTUNE,
        CATALOG_TUNE_COOLEYS_ID,
        CATALOG_TUNE_KESH_ID,
        CATALOG_TUNE_DANCING_MASTER_ID,
      ],
    });

    // Navigate to practice tab to ensure we have playlist context
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireTab).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  });

  test("should save and load learned date field", async ({ page }) => {
    // ARRANGE: Find a tune in practice grid
    await ttPage.searchForTune("Banish Misfortune", ttPage.practiceGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Set learned date
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const learnedField = page.getByTestId("tune-editor-input-learned");
    await expect(learnedField).toBeVisible({ timeout: 5000 });

    // Set a specific learned date/time
    const learnedDateTime = "2024-01-15T10:30";
    await learnedField.fill(learnedDateTime);
    await expect(learnedField).toHaveValue(learnedDateTime);

    // Save changes
    const saveButton = page.getByRole("button", { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Reopen editor and verify learned date was saved
    await firstRow.click();
    await page.waitForTimeout(500);
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });
    const learnedFieldReloaded = page.getByTestId("tune-editor-input-learned");
    await expect(learnedFieldReloaded).toHaveValue(learnedDateTime);
  });

  test("should save and load practiced date and quality fields", async ({
    page,
  }) => {
    // ARRANGE: Find a tune
    await ttPage.searchForTune("Cooley's", ttPage.practiceGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Set practiced date and quality
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const practicedField = page.getByTestId("tune-editor-input-practiced");
    const qualityField = page.getByTestId("tune-editor-input-quality");

    await expect(practicedField).toBeVisible({ timeout: 5000 });
    await expect(qualityField).toBeVisible({ timeout: 5000 });

    const practicedDateTime = "2024-01-20T14:45";
    const qualityValue = "3.5";

    await practicedField.fill(practicedDateTime);
    await qualityField.fill(qualityValue);

    await expect(practicedField).toHaveValue(practicedDateTime);
    await expect(qualityField).toHaveValue(qualityValue);

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Reopen and verify
    await firstRow.click();
    await page.waitForTimeout(500);
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tune-editor-input-practiced")).toHaveValue(
      practicedDateTime
    );
    await expect(page.getByTestId("tune-editor-input-quality")).toHaveValue(
      qualityValue
    );
  });

  test("should save and load FSRS fields", async ({ page }) => {
    // ARRANGE: Find a tune
    await ttPage.searchForTune("Kesh Jig", ttPage.practiceGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = page.getByRole("button", { name: "Edit tune" });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Expand FSRS section and set fields
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Click to expand FSRS fields
    const fsrsToggle = page.getByRole("button", { name: /FSRS Fields/i });
    await expect(fsrsToggle).toBeVisible({ timeout: 5000 });
    await fsrsToggle.click();
    await page.waitForTimeout(300);

    // Fill FSRS fields
    const difficultyField = page.getByTestId("tune-editor-input-difficulty");
    const stabilityField = page.getByTestId("tune-editor-input-stability");
    const stepField = page.getByTestId("tune-editor-input-step");
    const stateField = page.getByTestId("tune-editor-input-state");
    const repetitionsField = page.getByTestId("tune-editor-input-repetitions");

    await difficultyField.fill("5.5");
    await stabilityField.fill("10.2");
    await stepField.fill("2");
    await stateField.fill("1");
    await repetitionsField.fill("5");

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Reopen and verify FSRS fields
    await firstRow.click();
    await page.waitForTimeout(500);
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Expand FSRS section again
    await fsrsToggle.click();
    await page.waitForTimeout(300);

    await expect(difficultyField).toHaveValue("5.5");
    await expect(stabilityField).toHaveValue("10.2");
    await expect(stepField).toHaveValue("2");
    await expect(stateField).toHaveValue("1");
    await expect(repetitionsField).toHaveValue("5");
  });

  test("should save and load SM2 fields", async ({ page }) => {
    // ARRANGE: Find a tune
    await ttPage.searchForTune("Dancingmaster", ttPage.practiceGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Expand SM2 section and set fields
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Click to expand SM2 fields
    const sm2Toggle = page.getByRole("button", { name: /SM2 Fields/i });
    await expect(sm2Toggle).toBeVisible({ timeout: 5000 });
    await sm2Toggle.click();
    await page.waitForTimeout(300);

    // Fill SM2 fields
    const easinessField = page.getByTestId("tune-editor-input-easiness");
    const intervalField = page.getByTestId("tune-editor-input-interval");

    await easinessField.fill("2.5");
    await intervalField.fill("7");

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Reopen and verify SM2 fields
    await firstRow.click();
    await page.waitForTimeout(500);
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Expand SM2 section again
    await sm2Toggle.click();
    await page.waitForTimeout(300);

    await expect(easinessField).toHaveValue("2.5");
    await expect(intervalField).toHaveValue("7");
  });

  test("should save and load private notes", async ({ page }) => {
    // ARRANGE: Find a tune
    await ttPage.searchForTune("Banish Misfortune", ttPage.practiceGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Set private notes
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    const notesField = page.getByTestId("tune-editor-textarea-notes");
    await expect(notesField).toBeVisible({ timeout: 5000 });

    const noteText =
      "This is a test note about the tune.\nIt has multiple lines.\nRemember to practice the ornaments!";
    await notesField.fill(noteText);
    await expect(notesField).toHaveValue(noteText);

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Reopen and verify notes
    await firstRow.click();
    await page.waitForTimeout(500);
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });
    const notesFieldReloaded = page.getByTestId("tune-editor-textarea-notes");
    await expect(notesFieldReloaded).toHaveValue(noteText);
  });

  test("should save multiple user-specific fields together", async ({
    page,
  }) => {
    // ARRANGE: Find a tune
    await ttPage.searchForTune("Cooley's", ttPage.practiceGrid);
    await page.waitForTimeout(500);

    const firstRow = ttPage.getRows("repertoire").first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });
    await firstRow.click();
    await page.waitForTimeout(500);

    // Open editor
    const editButton = ttPage.sidebarEditTuneButton;
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ACT: Set all user-specific fields
    const tuneEditorForm = page.getByTestId("tune-editor-form");
    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Set basic fields
    await page
      .getByTestId("tune-editor-input-learned")
      .fill("2024-01-10T09:00");
    await page
      .getByTestId("tune-editor-input-practiced")
      .fill("2024-01-25T15:30");
    await page.getByTestId("tune-editor-input-quality").fill("4.2");

    // Set FSRS fields
    const fsrsToggle = page.getByRole("button", { name: /FSRS Fields/i });
    await fsrsToggle.click();
    await page.waitForTimeout(300);

    await page.getByTestId("tune-editor-input-difficulty").fill("6.1");
    await page.getByTestId("tune-editor-input-stability").fill("12.5");
    await page.getByTestId("tune-editor-input-step").fill("3");
    await page.getByTestId("tune-editor-input-state").fill("2");
    await page.getByTestId("tune-editor-input-repetitions").fill("8");

    // Set SM2 fields
    const sm2Toggle = page.getByRole("button", { name: /SM2 Fields/i });
    await sm2Toggle.click();
    await page.waitForTimeout(300);

    await page.getByTestId("tune-editor-input-easiness").fill("2.8");
    await page.getByTestId("tune-editor-input-interval").fill("14");

    // Set notes
    await page
      .getByTestId("tune-editor-textarea-notes")
      .fill("Comprehensive test of all fields");

    // Save
    const saveButton = page.getByRole("button", { name: /save/i });
    await saveButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // ASSERT: Reopen and verify all fields
    await firstRow.click();
    await page.waitForTimeout(500);
    await editButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect(tuneEditorForm).toBeVisible({ timeout: 10000 });

    // Verify basic fields
    await expect(page.getByTestId("tune-editor-input-learned")).toHaveValue(
      "2024-01-10T09:00"
    );
    await expect(page.getByTestId("tune-editor-input-practiced")).toHaveValue(
      "2024-01-25T15:30"
    );
    await expect(page.getByTestId("tune-editor-input-quality")).toHaveValue(
      "4.2"
    );

    // Verify FSRS fields
    await fsrsToggle.click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("tune-editor-input-difficulty")).toHaveValue(
      "6.1"
    );
    await expect(page.getByTestId("tune-editor-input-stability")).toHaveValue(
      "12.5"
    );
    await expect(page.getByTestId("tune-editor-input-step")).toHaveValue("3");
    await expect(page.getByTestId("tune-editor-input-state")).toHaveValue("2");
    await expect(page.getByTestId("tune-editor-input-repetitions")).toHaveValue(
      "8"
    );

    // Verify SM2 fields
    await sm2Toggle.click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("tune-editor-input-easiness")).toHaveValue(
      "2.8"
    );
    await expect(page.getByTestId("tune-editor-input-interval")).toHaveValue(
      "14"
    );

    // Verify notes
    await expect(page.getByTestId("tune-editor-textarea-notes")).toHaveValue(
      "Comprehensive test of all fields"
    );
  });
});
