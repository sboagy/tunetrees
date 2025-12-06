// spec: e2e/tests/notes-references-test-plan.md

import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * NOTES-001: Notes CRUD Operations
 * Priority: Critical
 *
 * Tests for creating, reading, editing, and deleting notes.
 * Uses the Catalog tab to select a public tune (Banish Misfortune).
 */

let ttPage: TuneTreesPage;

test.describe("NOTES-001: Notes CRUD Operations", () => {
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

    // Clean up any existing notes from previous test runs
    await ttPage.deleteAllNotes();
  });

  test("should display notes panel with empty state", async ({ page }) => {
    // Verify notes panel shows 0 notes
    await expect(ttPage.notesPanel).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "0 notes" })).toBeVisible({
      timeout: 5000,
    });

    // Verify empty state message
    await expect(ttPage.notesEmptyMessage).toBeVisible({ timeout: 5000 });

    // Verify Add button is visible
    await expect(ttPage.notesAddButton).toBeVisible({
      timeout: 5000,
    });
  });

  test("should disable save button when editor is empty", async () => {
    // Click Add button to create a new note
    await ttPage.notesAddButton.click();

    // Wait for Jodit editor to appear
    await expect(ttPage.notesNewEditor).toBeVisible({
      timeout: 10000,
    });

    // Verify Save button is disabled when editor is empty
    await expect(ttPage.notesSaveButton).toBeDisabled();
  });

  test("should create a new note with text content", async ({ page }) => {
    // Click Add button to create a new note
    await ttPage.notesAddButton.click();

    // Wait for Jodit editor to appear
    await expect(ttPage.notesNewEditor).toBeVisible({
      timeout: 10000,
    });

    // Type in Jodit editor
    const joditEditor = page.locator(".jodit-wysiwyg");
    await joditEditor.click();
    await joditEditor.fill("Test note content");

    // Verify Save button is now enabled
    await expect(ttPage.notesSaveButton).toBeEnabled();

    // Save the note
    await ttPage.notesSaveButton.click();

    // Verify note appears in list
    await expect(page.getByRole("heading", { name: "1 note" })).toBeVisible({
      timeout: 15000,
    });

    // Verify note content is displayed
    await expect(page.getByText("Test note content")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should cancel note creation without saving", async ({ page }) => {
    // Click Add button to create a new note
    await ttPage.notesAddButton.click();

    // Wait for Jodit editor to appear
    await expect(ttPage.notesNewEditor).toBeVisible({
      timeout: 10000,
    });

    // Type some content
    const joditEditor = page.locator(".jodit-wysiwyg");
    await joditEditor.click();
    await joditEditor.fill("This will be cancelled");

    // Click Cancel button
    await ttPage.notesCancelButton.click();

    // Verify editor is closed
    await expect(ttPage.notesNewEditor).not.toBeVisible();

    // Verify no note was created
    await expect(page.getByRole("heading", { name: "0 notes" })).toBeVisible({
      timeout: 5000,
    });
  });
});
