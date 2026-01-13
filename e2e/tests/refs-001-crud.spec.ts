// spec: e2e/tests/notes-references-test-plan.md

import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * REFS-001: References CRUD Operations
 * Priority: Critical
 *
 * Tests for creating, reading, editing, and deleting references.
 */

let ttPage: TuneTreesPage;
const REFS_TEST_TUNE_PREFIX = "E2E-REFS-001";

test.describe("REFS-001: References CRUD Operations", () => {
  // Run tests serially to avoid database conflicts on shared tune
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, testUser }, testInfo) => {
    ttPage = new TuneTreesPage(page);

    const testTuneTitle = `${REFS_TEST_TUNE_PREFIX}-${testInfo.project.name.replace(/\s+/g, "-")}`;

    // Setup deterministic test environment
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
      clearNotesAndReferences: true,
    });

    // Navigate to Catalog tab to find (or create) and select a tune
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Some public catalog tunes may include system/legacy references (user_ref IS NULL),
    // which makes "0 references" impossible even after clearing user tables.
    // Use a user-created test tune to guarantee an empty reference state.
    await ttPage.searchForTune(testTuneTitle, ttPage.catalogGrid);
    await page.waitForTimeout(250);
    const matchingRow = ttPage.getRows("catalog").filter({ hasText: testTuneTitle }).first();
    const existingTuneVisible = await matchingRow
      .isVisible({ timeout: 1500 })
      .catch(() => false);

    if (!existingTuneVisible) {
      await ttPage.catalogAddTuneButton.click();
      const newButton = page.getByRole("button", { name: /^new$/i });
      await newButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });

      const titleField = ttPage.tuneEditorForm.getByTestId(
        "tune-editor-input-title"
      );
      await expect(titleField).toBeVisible({ timeout: 10000 });
      await titleField.fill(testTuneTitle);
      await ttPage.selectTypeInTuneEditor("Reel (4/4)");

      const saveButton = page.getByRole("button", { name: /save/i });
      await saveButton.click();
      await page.waitForLoadState("networkidle", { timeout: 15000 });
    }

    await ttPage.searchForTune(testTuneTitle, ttPage.catalogGrid);
    await page.waitForTimeout(250);
    await expect(matchingRow).toBeVisible({ timeout: 10000 });
    await matchingRow.click();

    // On mobile, expand the sidebar (collapsed by default)
    await ttPage.ensureSidebarExpanded();

    // Wait for sidebar to show tune details
    await expect(page.getByRole("heading", { name: testTuneTitle })).toBeVisible(
      {
        timeout: 10000,
      }
    );
  });

  test("should display references panel with empty state", async ({ page }) => {
    // Verify references panel shows 0 references
    await expect(ttPage.referencesPanel).toBeVisible({ timeout: 10000 });
    await expect(ttPage.referencesCount).toHaveText(/^0\s+references$/i, {
      timeout: 5000,
    });

    // Verify empty state message
    await expect(page.getByText("No references yet")).toBeVisible({
      timeout: 5000,
    });

    // Verify Add button is visible
    await expect(ttPage.referencesAddButton).toBeVisible({
      timeout: 5000,
    });
  });

  test("should create a reference with YouTube URL", async ({ page }) => {
    // Click Add button to create a new reference
    await ttPage.referencesAddButton.click();

    // Wait for reference form to appear
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });

    // Enter YouTube URL
    await ttPage.referenceUrlInput.fill(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );

    // Wait for auto-detection (type should change to video)
    await expect(ttPage.referenceTypeSelect).toHaveValue("video", {
      timeout: 5000,
    });

    // Submit the reference
    await ttPage.referenceSubmitButton.click();

    // Verify reference appears in list
    await expect(ttPage.referencesCount).toHaveText(/^1\s+reference$/i, {
      timeout: 15000,
    });
  });

  test("should show validation error for invalid URL", async ({ page }) => {
    // Click Add button to create a new reference
    await ttPage.referencesAddButton.click();

    // Wait for reference form to appear
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });

    // Enter invalid URL
    await ttPage.referenceUrlInput.fill("not a valid url");

    // Try to submit
    await ttPage.referenceSubmitButton.click();

    // Verify validation error appears
    await expect(page.getByText(/valid URL/i)).toBeVisible({ timeout: 5000 });
  });

  test("should cancel reference creation", async ({ page }) => {
    // Click Add button to create a new reference
    await ttPage.referencesAddButton.click();

    // Wait for reference form to appear
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });

    // Enter a URL
    await ttPage.referenceUrlInput.fill("https://example.com");

    // Cancel
    await ttPage.referenceCancelButton.click();

    // Verify form is closed
    await expect(ttPage.referenceForm).not.toBeVisible();

    // Verify no reference was created
    await expect(ttPage.referencesCount).toHaveText(/^0\s+references$/i, {
      timeout: 5000,
    });
  });

  test("should create reference with custom fields", async ({ page }) => {
    // Click Add button to create a new reference
    await ttPage.referencesAddButton.click();

    // Wait for reference form to appear
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });

    // Enter URL
    await ttPage.referenceUrlInput.fill("https://thesession.org/tunes/2");

    // Enter custom title
    await ttPage.referenceTitleInput.fill("The Session - Banish Misfortune");

    // Select type
    await ttPage.referenceTypeSelect.selectOption("sheet-music");

    // Enter comment
    await ttPage.referenceCommentInput.fill("Great notation for this tune");

    // Toggle favorite
    await ttPage.referenceFavoriteCheckbox.check();

    // Submit
    await ttPage.referenceSubmitButton.click();

    // Verify reference appears in list
    await expect(ttPage.referencesCount).toHaveText(/^1\s+reference$/i, {
      timeout: 15000,
    });

    // Verify custom title is displayed
    await expect(page.getByText("The Session - Banish Misfortune")).toBeVisible(
      {
        timeout: 5000,
      }
    );
  });
});
