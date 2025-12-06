// spec: e2e/tests/notes-references-test-plan.md

import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * NOTES-002: Notes Drag-and-Drop Reordering
 * Priority: High
 *
 * Tests for drag-and-drop reordering of notes.
 * Requires creating at least 2 notes first.
 */

let ttPage: TuneTreesPage;

test.describe("NOTES-002: Notes Drag Reorder", () => {
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

    // Create first note
    await ttPage.notesAddButton.click();
    await expect(ttPage.notesNewEditor).toBeVisible({
      timeout: 10000,
    });
    const joditEditor = page.locator(".jodit-wysiwyg");
    await joditEditor.click();
    await joditEditor.fill("First note for reorder test");
    await ttPage.notesSaveButton.click();
    await expect(page.getByRole("heading", { name: "1 note" })).toBeVisible({
      timeout: 15000,
    });

    // Create second note
    await ttPage.notesAddButton.click();
    await expect(ttPage.notesNewEditor).toBeVisible({
      timeout: 10000,
    });
    await joditEditor.click();
    await joditEditor.fill("Second note for reorder test");
    await ttPage.notesSaveButton.click();
    await expect(page.getByRole("heading", { name: "2 notes" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display drag handles on notes", async ({ page }) => {
    // Get the first note item
    const noteItems = page.getByTestId(/^note-item-/);
    await expect(noteItems).toHaveCount(2, { timeout: 10000 });

    // Verify drag handles are visible
    const firstNoteId = await noteItems.first().getAttribute("data-testid");
    const noteId = firstNoteId?.replace("note-item-", "");

    if (noteId) {
      const dragHandle = page.getByTestId(`note-drag-handle-${noteId}`);
      await expect(dragHandle).toBeVisible({ timeout: 5000 });
    }
  });

  test("should reorder notes via drag-and-drop", async ({ page }) => {
    // Get the note items
    const noteItems = page.getByTestId(/^note-item-/);
    await expect(noteItems).toHaveCount(2, { timeout: 10000 });

    // Get initial order
    const firstNoteTestId = await noteItems.first().getAttribute("data-testid");
    const secondNoteTestId = await noteItems.nth(1).getAttribute("data-testid");

    const firstNoteId = firstNoteTestId?.replace("note-item-", "") || "";
    const secondNoteId = secondNoteTestId?.replace("note-item-", "") || "";

    // Verify first note is "First note for reorder test"
    await expect(
      page.getByText("First note for reorder test").first()
    ).toBeVisible();

    // Drag first note to second position
    const firstDragHandle = page.getByTestId(`note-drag-handle-${firstNoteId}`);
    const secondNoteItem = page.getByTestId(`note-item-${secondNoteId}`);

    await firstDragHandle.dragTo(secondNoteItem);

    // Wait for reorder to complete
    await page
      .waitForResponse(
        (response) =>
          response.url().includes("note") && response.status() === 200,
        { timeout: 15000 }
      )
      .catch(() => {
        // Sync might not make network request immediately, continue
      });

    // Verify order changed - second note should now be first
    const newFirstNoteTestId = await noteItems
      .first()
      .getAttribute("data-testid");
    expect(newFirstNoteTestId).toBe(`note-item-${secondNoteId}`);
  });
});
