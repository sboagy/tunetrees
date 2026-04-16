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

  const ANON_REPERTOIRE_CONFIG = {
    name: "Anon Repertoire",
    default_genre: "ITRAD",
    instrument: "Irish Flute",
    genres_filter: ["ITRAD"],
  };

  test("4.1 Anonymous user can view catalog tunes", async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously (no repertoire needed for catalog viewing)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously(ANON_REPERTOIRE_CONFIG);

    // Navigate to Catalog tab
    await ttPage.navigateToTab("catalog");

    // Wait for catalog tab UI to be ready, then for the grid to hydrate.
    await expect(ttPage.catalogColumnsButton).toBeVisible({ timeout: 20000 });
    await ttPage.expectGridHasContent(ttPage.catalogGrid);

    // Verify there are tunes in the catalog (public tunes from reference data)
    const rows = ttPage.getRows("catalog");
    const rowCount = await rows.count();

    // Should have at least some public tunes
    expect(rowCount).toBeGreaterThan(0);
  });

  test("4.2 Anonymous user can add tune to repertoire", async ({ page }) => {
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously WITH a repertoire (needed for repertoire functionality)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously({
      ...ANON_REPERTOIRE_CONFIG,
      name: "Anon Test Repertoire",
    });

    // Navigate to Catalog tab
    await ttPage.navigateToTab("catalog");
    await expect(ttPage.catalogColumnsButton).toBeVisible({ timeout: 20000 });
    await ttPage.expectGridHasContent(ttPage.catalogGrid);

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
    await ttPage.expectToolbarVisible({
      addToRepertoire: true,
      tab: "catalog",
    });
    await expect(ttPage.catalogAddToRepertoireButton).toBeEnabled({
      timeout: 10000,
    });
    await ttPage.clickCatalogAddToRepertoire();

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
    test.setTimeout(60_000);
    ttPage = new TuneTreesPage(page);
    // Sign in anonymously WITH a repertoire (needed for repertoire functionality)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously({
      ...ANON_REPERTOIRE_CONFIG,
      name: "Anon Persist Test",
    });

    // Navigate to Catalog tab and add a tune
    await ttPage.navigateToTab("catalog");

    // Wait for catalog tab UI to be ready, then for the grid to hydrate.
    await expect(ttPage.catalogColumnsButton).toBeVisible({ timeout: 20000 });
    await ttPage.expectGridHasContent(ttPage.catalogGrid);

    // Select and add first tune
    const catalogRows = ttPage.getRows("catalog");
    await expect
      .poll(async () => catalogRows.count(), {
        timeout: 10000,
        intervals: [100, 200, 500, 1000],
      })
      .toBeGreaterThan(0);

    const firstTuneCheckbox = catalogRows
      .first()
      .locator('input[type="checkbox"]');
    await firstTuneCheckbox.click();

    await ttPage.expectToolbarVisible({
      addToRepertoire: true,
      tab: "catalog",
    });
    await expect(ttPage.catalogAddToRepertoireButton).toBeEnabled({
      timeout: 10000,
    });
    await ttPage.clickCatalogAddToRepertoire();

    // Wait until selection is cleared (checkbox becomes unchecked)
    await expect(firstTuneCheckbox).not.toBeChecked({ timeout: 15000 });

    // Navigate to Repertoire to verify
    await ttPage.navigateToTab("repertoire");
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    const repertoireRows = ttPage.getRows("repertoire");
    await expect
      .poll(async () => repertoireRows.count(), {
        timeout: 15000,
        intervals: [100, 200, 500, 1000],
      })
      .toBeGreaterThan(0);

    const countBefore = await repertoireRows.count();
    expect(countBefore).toBeGreaterThan(0);

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Onboarding can appear with a delayed check; dismiss if it does.
    await ttPage.dismissOnboardingIfPresent();

    // Navigate back to Repertoire
    await ttPage.navigateToTab("repertoire");
    await expect(ttPage.repertoireColumnsButton).toBeVisible({
      timeout: 20000,
    });
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 20000 });

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
    // Sign in anonymously (no repertoire needed for reference data viewing)
    await ttPage.gotoLogin();
    await ttPage.signInAnonymously(ANON_REPERTOIRE_CONFIG);

    // Navigate to Catalog tab
    await ttPage.navigateToTab("catalog");

    // Wait for catalog tab UI to be ready, then for the grid to hydrate.
    await expect(ttPage.catalogColumnsButton).toBeVisible({ timeout: 20000 });
    await ttPage.expectGridHasContent(ttPage.catalogGrid);

    await ttPage.filterByGenre("Irish Traditional Music");
    await ttPage.filterByType("JigD");
    await ttPage.expectTuneVisible("Banish Misfortune", ttPage.catalogGrid);
  });
});
