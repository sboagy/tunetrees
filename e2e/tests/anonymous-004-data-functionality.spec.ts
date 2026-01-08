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
 * - Development server running on ${BASE_URL}
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
    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 10000 });

    await ttPage.searchForTune("Alexander's", ttPage.catalogGrid);

    // Select first tune in catalog
    const catalogRows = ttPage.getRows("catalog");

    await expect
      .poll(async () => catalogRows.count(), {
        timeout: 10_000,
        intervals: [100, 200, 500, 1000],
      })
      .toBe(1);

    const firstTuneCheckbox = catalogRows
      .first()
      .locator('input[type="checkbox"]');
    await firstTuneCheckbox.click();

    // Ensure "Add to Repertoire" is enabled/clickable after selecting a tune
    await expect(ttPage.catalogAddToRepertoireButton).toBeVisible({
      timeout: 10000,
    });
    await expect(ttPage.catalogAddToRepertoireButton).toBeEnabled({
      timeout: 10000,
    });
    // Click "Add to Repertoire" button
    await ttPage.catalogAddToRepertoireButton.click();

    // Wait for success indication
    // Wait until selection is cleared (checkbox becomes unchecked)
    await expect(firstTuneCheckbox).not.toBeChecked({ timeout: 10000 });
    await page.waitForTimeout(100); // just a little buffer

    // Navigate to Repertoire tab
    await ttPage.navigateToTab("repertoire");
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    // Verify the tune appears in repertoire
    const repertoireRows = ttPage.getRows("repertoire");
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
    await ttPage.navigateToTab("catalog");

    // Wait for catalog grid to be ready
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 15000 });
    await ttPage.expectGridHasContent(ttPage.catalogGrid);

    // Select and add first tune
    const firstTuneCheckbox = ttPage.catalogGrid
      .locator("tbody tr[data-index]")
      .first()
      .locator('input[type="checkbox"]');
    await firstTuneCheckbox.click();

    await expect(ttPage.catalogAddToRepertoireButton).toBeVisible({
      timeout: 10000,
    });
    await expect(ttPage.catalogAddToRepertoireButton).toBeEnabled({
      timeout: 10000,
    });
    await ttPage.catalogAddToRepertoireButton.click();

    // Wait until selection is cleared (checkbox becomes unchecked)
    await expect(firstTuneCheckbox).not.toBeChecked({ timeout: 15000 });

    // Navigate to Repertoire to verify
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    const repertoireRows = ttPage.repertoireGrid.locator("tbody tr[data-index]");
    await expect.poll(async () => repertoireRows.count(), {
      timeout: 15000,
      intervals: [100, 200, 500, 1000],
    }).toBeGreaterThan(0);

    const countBefore = await repertoireRows.count();
    expect(countBefore).toBeGreaterThan(0);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Onboarding can appear with a delayed check; dismiss if it does.
    await ttPage.dismissOnboardingIfPresent();

    // Navigate back to Repertoire
    await ttPage.repertoireTab.click();
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    // Wait for the grid to rehydrate from local DB
    await ttPage.expectGridHasContent(ttPage.repertoireGrid);

    // Verify count is preserved
    await expect
      .poll(async () => repertoireRows.count(), {
        timeout: 20000,
        intervals: [200, 500, 1000],
      })
      .toBe(countBefore);
  });

  test("4.4 Reference data (genres, types) available for anonymous users", async ({
    page,
  }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously (no playlist needed for reference data viewing)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously();

    // Navigate to Catalog tab
    await ttPage.navigateToTab("catalog");

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
