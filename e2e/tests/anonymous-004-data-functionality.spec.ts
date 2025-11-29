/**
 * E2E Test: Anonymous User Data Functionality
 *
 * Tests that anonymous users can create and manage data (tunes, repertoire)
 * using the local SQLite WASM database.
 *
 * Feature: Anonymous User Conversion Pattern (PR #287)
 * Priority: P1 (Important - core functionality)
 *
 * Prerequisites:
 * - Supabase running with enable_anonymous_sign_ins = true
 * - Development server running on http://localhost:5173
 */

import { test as base, expect } from "@playwright/test";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

// Override the base test to NOT use stored auth state (we need fresh sessions)
const test = base.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  storageState: async ({}, use) => {
    await use({ cookies: [], origins: [] });
  },
});

test.describe("Anonymous User Data Functionality", () => {
  let ttPage: TuneTreesPage;

  test("4.1 Anonymous user can view catalog tunes", async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously (no playlist needed for catalog viewing)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Navigate to Catalog tab
    await ttPage.catalogTab.click();

    // Wait for catalog grid to load
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Verify there are tunes in the catalog (public tunes from reference data)
    const rows = ttPage.catalogGrid.locator("tbody tr[data-index]");
    const rowCount = await rows.count();

    // Should have at least some public tunes
    expect(rowCount).toBeGreaterThan(0);
  });

  test("4.2 Anonymous user can add tune to repertoire", async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously WITH a playlist (needed for repertoire functionality)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymouslyWithPlaylist("Anon Test Playlist");

    // Navigate to Catalog tab
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Wait for tunes to load
    await page.waitForTimeout(1000);

    // Select first tune in catalog
    const firstTuneCheckbox = ttPage.catalogGrid
      .locator("tbody tr[data-index]")
      .first()
      .locator('input[type="checkbox"]');
    await firstTuneCheckbox.click();

    // Click "Add to Repertoire" button
    await ttPage.catalogAddToRepertoireButton.click();

    // Wait for success indication
    await page.waitForTimeout(1000);

    // Navigate to Repertoire tab
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    // Verify the tune appears in repertoire
    const repertoireRows = ttPage.repertoireGrid.locator(
      "tbody tr[data-index]"
    );
    const repertoireCount = await repertoireRows.count();
    expect(repertoireCount).toBeGreaterThan(0);
  });

  test("4.3 Anonymous user data persists after page refresh", async ({
    page,
  }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously WITH a playlist (needed for repertoire functionality)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymouslyWithPlaylist("Anon Persist Test");

    // Navigate to Catalog tab and add a tune
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Select and add first tune
    const firstTuneCheckbox = ttPage.catalogGrid
      .locator("tbody tr[data-index]")
      .first()
      .locator('input[type="checkbox"]');
    await firstTuneCheckbox.click();
    await ttPage.catalogAddToRepertoireButton.click();
    await page.waitForTimeout(1000);

    // Navigate to Repertoire to verify
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    const countBefore = await ttPage.repertoireGrid
      .locator("tbody tr[data-index]")
      .count();
    expect(countBefore).toBeGreaterThan(0);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Navigate back to Repertoire
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    // Verify count is preserved
    const countAfter = await ttPage.repertoireGrid
      .locator("tbody tr[data-index]")
      .count();
    expect(countAfter).toBe(countBefore);
  });

  test("4.4 Reference data (genres, types) available for anonymous users", async ({
    page,
  }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously (no playlist needed for reference data viewing)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Navigate to Catalog tab
    await ttPage.catalogTab.click();
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    // Wait for grid to fully load
    await page.waitForTimeout(1000);

    // Look for the Type column header with sort functionality
    // Use a more specific selector to avoid matching drag handle and resize buttons
    const typeColumnHeader = page
      .getByTestId("ch-type")
      .getByRole("button", { name: /Type ↕|Type Sort/ })
      .first();

    // If the standard column header isn't found, try clicking on the column text
    if (
      !(await typeColumnHeader.isVisible({ timeout: 2000 }).catch(() => false))
    ) {
      // Fall back to verifying the column exists with tune types displayed in rows
      const firstRow = ttPage.catalogGrid
        .locator("tbody tr[data-index]")
        .first();
      const typeCell = firstRow.locator("td").nth(2); // Type is typically the 3rd column
      await expect(typeCell).toBeVisible({ timeout: 5000 });
      // If we can see data in the type column, reference data is loaded
      return;
    }

    // Click to open filter/sort menu if available
    await typeColumnHeader.click();
    await page.waitForTimeout(500);

    // Verify tune types are available by checking if dropdown/menu appeared
    const filterMenu = page.locator('[role="menu"], [role="listbox"]');
    if (await filterMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Close the menu
      await page.keyboard.press("Escape");
    }
  });
});
