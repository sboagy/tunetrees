// spec: e2e/tests/notes-references-test-plan.md

import { expect } from "@playwright/test";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * REFS-002: References Drag-and-Drop Reordering
 * Priority: High
 *
 * Tests for drag-and-drop reordering of references.
 * Requires creating at least 2 references first.
 */

let ttPage: TuneTreesPage;

test.describe("REFS-002: References Drag Reorder", () => {
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

    // Create first reference
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });
    await ttPage.referenceUrlInput.fill(
      "https://www.youtube.com/watch?v=abc123"
    );
    await ttPage.referenceTitleInput.fill("First Reference");
    await ttPage.referenceSubmitButton.click();
    await expect(
      page.getByRole("heading", { name: "1 reference" })
    ).toBeVisible({
      timeout: 15000,
    });

    // Create second reference
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });
    await ttPage.referenceUrlInput.fill("https://thesession.org/tunes/2");
    await ttPage.referenceTitleInput.fill("Second Reference");
    await ttPage.referenceSubmitButton.click();
    await expect(
      page.getByRole("heading", { name: "2 references" })
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display drag handles on references", async ({ page }) => {
    // Get the reference items
    const refItems = page.getByTestId(/^reference-item-/);
    await expect(refItems).toHaveCount(2, { timeout: 10000 });

    // Verify drag handles are visible
    const firstRefId = await refItems.first().getAttribute("data-testid");
    const refId = firstRefId?.replace("reference-item-", "");

    if (refId) {
      const dragHandle = page.getByTestId(`reference-drag-handle-${refId}`);
      await expect(dragHandle).toBeVisible({ timeout: 5000 });
    }
  });

  test("should reorder references via drag-and-drop", async ({ page }) => {
    // Get the reference items
    const refItems = page.getByTestId(/^reference-item-/);
    await expect(refItems).toHaveCount(2, { timeout: 10000 });

    // Get initial order
    const firstRefTestId = await refItems.first().getAttribute("data-testid");
    const secondRefTestId = await refItems.nth(1).getAttribute("data-testid");

    const firstRefId = firstRefTestId?.replace("reference-item-", "") || "";
    const secondRefId = secondRefTestId?.replace("reference-item-", "") || "";

    expect(firstRefId).not.toBe("");
    expect(secondRefId).not.toBe("");

    // Verify first reference is "First Reference"
    await expect(page.getByText("First Reference").first()).toBeVisible();

    // Drag first reference to second position
    const firstDragHandle = page.getByTestId(
      `reference-drag-handle-${firstRefId}`
    );
    const secondRefItem = page.getByTestId(`reference-item-${secondRefId}`);

    await expect(firstDragHandle).toBeVisible({ timeout: 5000 });
    await expect(secondRefItem).toBeVisible({ timeout: 5000 });
    await firstDragHandle.scrollIntoViewIfNeeded();
    await secondRefItem.scrollIntoViewIfNeeded();

    await firstDragHandle.dragTo(secondRefItem, { force: true });

    // Verify order changed - second reference should now be first
    await expect
      .poll(async () => refItems.first().getAttribute("data-testid"), {
        timeout: 5000,
      })
      .toBe(`reference-item-${secondRefId}`);
  });
});
