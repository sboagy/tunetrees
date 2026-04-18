// spec: e2e/tests/notes-references-test-plan.md

import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
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
      clearNotesAndReferences: true,
    });

    // Navigate to Catalog tab to find and select a tune
    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for and select Banish Misfortune tune
    await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);
    await page.waitForTimeout(500); // Wait for filter to apply

    const tuneRow = ttPage.getTuneRowById(
      TEST_TUNE_BANISH_ID,
      ttPage.catalogGrid
    );
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
    await ttPage.selectGridRow(tuneRow);

    // On mobile, expand the sidebar (collapsed by default)
    await ttPage.ensureSidebarExpanded();
    await ttPage.ensureTuneInfoExpanded();

    // Wait for sidebar to show tune details
    await expect(
      page.getByRole("heading", { name: "Banish Misfortune" })
    ).toBeVisible({
      timeout: 10000,
    });

    // Shared catalog tunes can pick up leftover note state during full-suite runs.
    // Reset the selected tune in the UI so this spec always starts from two known notes.
    await ttPage.deleteAllNotes();
    await expect(ttPage.notesCount).toContainText("0 notes", {
      timeout: 10000,
    });

    // Create first note
    await ttPage.addNote("First note for reorder test");
    await expect(ttPage.notesCount).toContainText("1 note", {
      timeout: 15000,
    });
    await expect(ttPage.getAllNoteItems()).toHaveCount(1, { timeout: 10000 });

    // Create second note
    await ttPage.addNote("Second note for reorder test");
    await expect(ttPage.notesCount).toContainText("2 notes", {
      timeout: 15000,
    });
    await expect(ttPage.getAllNoteItems()).toHaveCount(2, { timeout: 10000 });
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

    await ttPage.dispatchHtml5DragAndDrop(firstDragHandle, secondNoteItem);

    // Verify order changed - second note should now be first
    // try for a few times
    let newFirstNoteTestId: string | null = null;
    for (let i = 0; i < 10; i++) {
      newFirstNoteTestId = await noteItems.first().getAttribute("data-testid");
      if (newFirstNoteTestId === `note-item-${secondNoteId}`) {
        break;
      }
      await page.waitForTimeout(20);
    }
    expect(newFirstNoteTestId).toBe(`note-item-${secondNoteId}`);
  });
});
