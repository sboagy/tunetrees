/**
 * TUNE-EDITOR-001: Double-Click to Edit Tune
 * Priority: Critical
 *
 * Tests that double-clicking a tune row in any grid opens the tune editor.
 *
 * User Flow:
 * 1. Log in as test user
 * 2. Navigate to tab (Catalog, Repertoire, or Practice)
 * 3. Double-click a tune row
 * 4. Verify tune editor opens with correct tune data
 * 5. Verify URL changes to /tunes/:id/edit
 *
 * Edge Cases:
 * - Works in Catalog tab
 * - Works in Repertoire tab
 * - Works in Practice tab (if tunes present)
 * - Loads correct tune data in editor
 */

import { expect } from "@playwright/test";
import { CATALOG_TUNE_A_FIG_FOR_A_KISS } from "../../src/lib/db/catalog-tune-ids";
import { setupForCatalogTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

test.describe("TUNE-EDITOR-001: Double-Click to Edit", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Setup: Start on catalog tab with some tunes
    await setupForCatalogTestsParallel(page, testUser, {
      emptyRepertoire: false,
      startTab: "catalog",
    });
  });

  test("should open tune editor when double-clicking catalog row", async ({
    page,
  }) => {
    // ARRANGE: Wait for catalog grid to be visible
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500); // Allow grid to render

    // Find a tune row (A Fig for a Kiss)
    const tuneRow = page
      .locator('[data-testid="tunes-grid-catalog"] tbody tr')
      .filter({ hasText: "A Fig for a Kiss" })
      .first();

    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // Get the tune ID from the row (for URL verification)
    const tuneId = CATALOG_TUNE_A_FIG_FOR_A_KISS;

    // ACT: Double-click the tune row
    await tuneRow.dblclick();

    // ASSERT: Verify navigation to edit page
    await expect(page).toHaveURL(new RegExp(`/tunes/${tuneId}/edit`), {
      timeout: 10000,
    });

    // Verify tune editor is displayed
    await expect(page.getByText(/edit tune/i)).toBeVisible({
      timeout: 10000,
    });

    // Verify tune title is loaded
    await expect(page.getByLabel(/title/i)).toHaveValue(/a fig for a kiss/i);
  });

  test("should open tune editor when double-clicking repertoire row", async ({
    page,
  }) => {
    // ARRANGE: Navigate to repertoire tab
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500); // Allow grid to render

    // Find a tune row in repertoire
    const tuneRow = page
      .locator('[data-testid="tunes-grid-repertoire"] tbody tr')
      .first();

    await expect(tuneRow).toBeVisible({ timeout: 5000 });

    // ACT: Double-click the tune row
    await tuneRow.dblclick();

    // ASSERT: Verify navigation to edit page
    await expect(page).toHaveURL(/\/tunes\/\d+\/edit/, { timeout: 10000 });

    // Verify tune editor is displayed
    await expect(page.getByText(/edit tune/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
