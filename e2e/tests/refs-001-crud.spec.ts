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
    });

    // Navigate to Catalog tab to find and select a tune
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for and select Banish Misfortune tune
    await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);
    await page.waitForTimeout(500); // Wait for filter to apply

    const tuneRow = ttPage.getRows("catalog").first();
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
    await tuneRow.click();

    // On mobile, expand the sidebar (collapsed by default)
    await ttPage.ensureSidebarExpanded();

    // Wait for sidebar to show tune details
    await expect(
      page.getByRole("heading", { name: "Banish Misfortune" })
    ).toBeVisible({
      timeout: 10000,
    });

    // Clean up any existing references from previous test runs
    await ttPage.deleteAllReferences();
  });

  test("should display references panel with empty state", async ({ page }) => {
    // Verify references panel shows 0 references
    await expect(ttPage.referencesPanel).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "0 references" })
    ).toBeVisible({
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
    await expect(
      page.getByRole("heading", { name: "1 reference" })
    ).toBeVisible({
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
    await expect(
      page.getByRole("heading", { name: "0 references" })
    ).toBeVisible({
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
    await expect(
      page.getByRole("heading", { name: "1 reference" })
    ).toBeVisible({
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
