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
      clearNotesAndReferences: true,
    });

    // Navigate to Catalog tab to find and select a tune
    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Search for and select Banish Misfortune tune
    await ttPage.searchForTune("Banish Misfortune", ttPage.catalogGrid);
    await page.waitForTimeout(500); // Wait for filter to apply

    const tuneRow = ttPage.getRows("catalog").first();
    await expect(tuneRow).toBeVisible({ timeout: 5000 });
    await tuneRow.click();

    // On mobile, expand the sidebar (collapsed by default)
    await ttPage.ensureSidebarExpanded();

    const tuneInfoToggle = page.getByTestId("sidebar-tune-info-toggle");
    if (await tuneInfoToggle.isVisible().catch(() => false)) {
      const expanded = await tuneInfoToggle
        .getAttribute("aria-expanded")
        .catch(() => null);
      if (expanded !== "true") {
        await page.keyboard.press("Escape").catch(() => undefined);
        await tuneInfoToggle.click({ force: true, timeout: 8000 });
        await expect(tuneInfoToggle).toHaveAttribute("aria-expanded", "true", {
          timeout: 8000,
        });
      }
    }

    // Wait for sidebar to show tune details
    await expect(
      page.getByRole("heading", { name: /Banish Misfortune/i })
    ).toBeVisible({
      timeout: 10000,
    });

    // Create first reference
    await expect(ttPage.referencesAddButton).toBeVisible({ timeout: 10000 });
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });
    await ttPage.referenceUrlInput.fill(
      "https://www.youtube.com/watch?v=abc123"
    );
    await ttPage.referenceTitleInput.fill("First Reference");
    await ttPage.referenceSubmitButton.click();
    await page.waitForTimeout(500);

    // The public baseline already includes one tune-level reference.
    await expect(ttPage.referencesCount).toHaveText(/^2 references$/i, {
      timeout: 15000,
    });

    // Create second reference
    await expect(ttPage.referencesAddButton).toBeVisible({ timeout: 10000 });
    await ttPage.referencesAddButton.click();
    await expect(ttPage.referenceForm).toBeVisible({
      timeout: 10000,
    });
    await ttPage.referenceUrlInput.fill("https://thesession.org/tunes/2");
    await ttPage.referenceTitleInput.fill("Second Reference");
    await ttPage.referenceSubmitButton.click();
    await page.waitForTimeout(500);
    await expect(ttPage.referencesCount).toHaveText(/^3 references$/i, {
      timeout: 15000,
    });
  });

  test("should hide drag handles when shared references are present", async ({
    page,
  }) => {
    // Get the reference items
    const refItems = page.getByTestId(/^reference-item-/);
    await expect(refItems).toHaveCount(3, { timeout: 10000 });

    // Mixed ownership disables drag-reorder entirely.
    const dragHandles = page.getByTestId(/^reference-drag-handle-/);
    await expect(dragHandles).toHaveCount(0);

    const visibilityBadges = page.getByTestId(/^reference-visibility-badge-/);
    await expect(visibilityBadges.first()).toBeVisible({ timeout: 5000 });
  });

  test("should keep mixed-ownership references non-draggable", async ({
    page,
  }) => {
    // Get the reference items
    const refItems = page.getByTestId(/^reference-item-/);
    await expect(refItems).toHaveCount(3, { timeout: 10000 });

    const dragHandles = page.getByTestId(/^reference-drag-handle-/);
    await expect(dragHandles).toHaveCount(0);
  });
});
