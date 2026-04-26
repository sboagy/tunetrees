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

test.describe("REFS-001: References CRUD Operations", () => {
  // Run tests serially to avoid database conflicts on shared tune
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Setup deterministic test environment
    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
      seedRepertoire: [],
      clearNotesAndReferences: true,
    });

    // Navigate to Catalog tab to find and select a tune
    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for and select Banish Misfortune tune
    await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);
    await page.waitForTimeout(500); // Wait for filter to apply

    // Catalog search results are not stable enough to key this suite off a row index.
    const tuneRow = ttPage.getRows("catalog").first();
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
    await tuneRow.click();

    // On mobile, expand the sidebar (collapsed by default)
    await ttPage.ensureSidebarExpanded();
    await ttPage.ensureTuneInfoExpanded();

    // Wait for sidebar to show tune details
    await expect(
      page.getByRole("heading", { name: "Banish Misfortune" })
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display references panel with existing baseline reference", async () => {
    await expect(ttPage.referencesPanel).toBeVisible({ timeout: 10000 });
    await expect(ttPage.referencesCount).toHaveText(/^1 reference$/i, {
      timeout: 5000,
    });
    await expect(ttPage.getAllReferenceItems()).toHaveCount(1, {
      timeout: 5000,
    });

    // Verify Add button is visible
    await expect(ttPage.referencesAddButton).toBeVisible({
      timeout: 5000,
    });
  });

  test("should open add form with visible type options and disabled save", async ({
    page,
  }) => {
    await ttPage.referencesAddButton.click();

    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("reference-type-option-audio")).toBeVisible({
      timeout: 5000,
    });
    await expect(ttPage.referenceSubmitButton).toBeDisabled({ timeout: 5000 });
  });

  test("should open a file chooser from Choose Audio File and create an ingested audio reference", async ({
    page,
  }) => {
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });

    await ttPage.selectReferenceType("audio");

    await expect(ttPage.referenceAudioDropzone).toBeVisible({ timeout: 5000 });
    await expect(ttPage.referenceUrlInput).toBeHidden({ timeout: 5000 });

    await page.evaluate(() => {
      const pickerFile = new File(
        ["audio-bytes"],
        "sidebar-audio-default.mp3",
        {
          type: "audio/mpeg",
        }
      );

      (
        window as Window & { __TT_ALLOW_DEBUG_FILE_PICKER__?: boolean }
      ).__TT_ALLOW_DEBUG_FILE_PICKER__ = true;

      Object.defineProperty(window, "showOpenFilePicker", {
        configurable: true,
        writable: true,
        value: async () => [
          {
            getFile: async () => pickerFile,
          },
        ],
      });
    });

    await ttPage.referenceAudioChooseFileButton.click();

    await expect(ttPage.referenceAudioSelectedFile).toHaveText(
      "sidebar-audio-default.mp3",
      { timeout: 5000 }
    );

    await expect(ttPage.referenceSubmitButton).toBeEnabled({ timeout: 5000 });
    await ttPage.referenceSubmitButton.click();

    await expect(ttPage.referencesCount).toHaveText(/^2 references$/i, {
      timeout: 20000,
    });
    await expect(ttPage.referencesList).toContainText("sidebar-audio-default", {
      timeout: 10000,
    });
  });

  test("should seed the audio upload form when an audio file is dropped on the references panel", async () => {
    await ttPage.dropAudioFileOnReferencesPanel({
      fileName: "banish-misfortune.mp3",
    });

    await expect(ttPage.referenceForm).toBeVisible({ timeout: 10000 });
    await expect(ttPage.referenceAudioSelectedFile).toHaveText(
      "banish-misfortune.mp3",
      { timeout: 5000 }
    );
    await expect(ttPage.referenceTypeSelect).toContainText(/audio/i);
    await expect(ttPage.referenceSubmitButton).toBeEnabled({ timeout: 5000 });
  });

  test("should create a reference with YouTube URL", async () => {
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
    await expect(ttPage.referenceTypeSelect).toContainText(/video/i, {
      timeout: 5000,
    });

    // Submit the reference
    await ttPage.referenceSubmitButton.click();

    // Verify reference appears in list
    await expect(ttPage.referencesCount).toHaveText(/^2 references$/i, {
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

    await expect(ttPage.referenceSubmitButton).toBeDisabled({ timeout: 5000 });

    // Verify validation error appears
    await expect(page.getByText(/valid URL/i)).toBeVisible({ timeout: 5000 });
  });

  test("should cancel reference creation", async () => {
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

    // Verify the existing baseline reference count is unchanged.
    await expect(ttPage.referencesCount).toHaveText(/^1 reference$/i, {
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
    await ttPage.selectReferenceType("sheet-music");

    // Enter comment
    await ttPage.referenceCommentInput.fill("Great notation for this tune");

    // Toggle favorite
    await ttPage.referenceFavoriteCheckbox.check();

    // Submit
    await ttPage.referenceSubmitButton.click();

    // Verify reference appears in list
    await expect(ttPage.referencesCount).toHaveText(/^2 references$/i, {
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
