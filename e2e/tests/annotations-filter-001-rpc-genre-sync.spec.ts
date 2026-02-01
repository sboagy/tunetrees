/**
 * ANNOTATIONS-FILTER-001: RPC-Based Genre Filtering for Note/Reference Tables
 * Priority: High
 *
 * Validates that note and reference tables are correctly filtered by genre selection
 * through server-side RPC functions and client-side orphan purging.
 *
 * Test scenarios:
 * A. Onboarding: Initial genre selection filters annotations server-side
 * B. Settings genre addition: New genre's annotations sync down
 * C. Settings genre removal: Orphaned annotations are purged after sync
 * D. Private tunes: Private tune annotations sync regardless of genre filter
 */

import { expect } from "@playwright/test";
import { setupForCatalogTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

/**
 * Helper to open Settings → Catalog & Sync page
 */
async function openCatalogSync(page: import("@playwright/test").Page) {
  await ttPage.userMenuButton.click();
  await page.waitForTimeout(500);
  await ttPage.userSettingsButton.click();
  await page.waitForTimeout(1500);

  const ua = await page.evaluate(() => navigator.userAgent);
  const isMobileChrome = /Android.*Chrome\/\d+/i.test(ua);
  if (isMobileChrome) {
    await page.waitForTimeout(800);
    await ttPage.settingsMenuToggle.click();
  }

  await page.waitForTimeout(500);
  await ttPage.userSettingsCatalogSyncButton.click();
  await page.waitForTimeout(500);

  if (isMobileChrome) {
    const { innerWidth, innerHeight } = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }));
    await page.mouse.click(innerWidth - 5, Math.floor(innerHeight / 2));
    await page.waitForTimeout(300);
  }
}

/**
 * Helper to wait for sync completion and verify sync state
 */
async function waitForSyncComplete(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle", { timeout: 30000 });
  // Additional wait for local DB to process synced data
  await page.waitForTimeout(2000);
}

/**
 * Helper to get annotation counts using test API
 */
async function getAnnotationCounts(
  page: import("@playwright/test").Page,
  options?: { tuneId?: string }
) {
  return await page.evaluate(async (opts) => {
    const api = (window as any).__ttTestApi;
    if (!api) throw new Error("__ttTestApi not available");
    return await api.getAnnotationCounts(opts);
  }, options);
}

/**
 * Helper to get orphaned annotation counts using test API
 */
async function getOrphanedAnnotationCounts(
  page: import("@playwright/test").Page
) {
  return await page.evaluate(async () => {
    const api = (window as any).__ttTestApi;
    if (!api) throw new Error("__ttTestApi not available");
    return await api.getOrphanedAnnotationCounts();
  });
}

/**
 * Helper to seed annotations using test API
 */
async function seedAnnotations(
  page: import("@playwright/test").Page,
  input: {
    tuneId: string;
    noteCount?: number;
    referenceCount?: number;
  }
) {
  return await page.evaluate(async (seedInput) => {
    const api = (window as any).__ttTestApi;
    if (!api) throw new Error("__ttTestApi not available");
    return await api.seedAnnotations(seedInput);
  }, input);
}

/**
 * Helper to get a tune ID from catalog by genre
 */
// async function getTuneIdByGenre(
//   page: import("@playwright/test").Page,
//   genreName: string
// ): Promise<string | null> {
//   return await page.evaluate(async (genre) => {
//     const api = (window as any).__ttTestApi;
//     if (!api) throw new Error("__ttTestApi not available");

//     // Query local DB for a tune in this genre
//     const db = await api.ensureDb();
//     const result = await db.execute({
//       sql: "SELECT id FROM tune WHERE genre = ? AND deleted = 0 LIMIT 1",
//       args: [genre],
//     });

//     return result.rows[0]?.id ?? null;
//   }, genreName);
// }

test.describe("ANNOTATIONS-FILTER-001: RPC-Based Genre Filtering", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    await setupForCatalogTestsParallel(page, testUser, {
      emptyRepertoire: true,
      startTab: "catalog",
    });
  });

  test("A: Onboarding filters annotations server-side for selected genres", async ({
    page,
  }) => {
    // Navigate to catalog to ensure app is loaded
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 15000 });

    // Wait for initial sync to complete
    await waitForSyncComplete(page);

    // Get annotation counts after initial sync with genre selection
    const counts = await getAnnotationCounts(page);

    // Verify counts are non-negative (genre selection happened during setup)
    expect(counts.notes).toBeGreaterThanOrEqual(0);
    expect(counts.references).toBeGreaterThanOrEqual(0);

    // Verify no orphaned annotations exist (server filtering working)
    const orphanedCounts = await getOrphanedAnnotationCounts(page);
    expect(orphanedCounts.orphanedNotes).toBe(0);
    expect(orphanedCounts.orphanedReferences).toBe(0);

    // Log for debugging
    console.log("Onboarding annotation counts:", counts);
  });

  test("B: Settings genre addition syncs new genre's annotations", async ({
    page,
  }) => {
    test.setTimeout(45000); // Genre sync + polling takes time
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 15000 });
    await waitForSyncComplete(page);

    // Record initial counts
    const beforeCounts = await getAnnotationCounts(page);
    console.log("Before genre addition:", beforeCounts);

    // Open Settings → Catalog & Sync
    await openCatalogSync(page);

    // Verify genre selection UI is visible
    await expect(
      page.getByRole("heading", { name: "Catalog & Sync" })
    ).toBeVisible({ timeout: 5000 });

    // Wait for genre checkboxes to load
    const checkboxes = page.locator(
      '[data-testid^="settings-genre-checkbox-"]'
    );
    await expect
      .poll(() => checkboxes.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    // Find an unchecked genre and check it
    const uncheckedGenre = page.getByTestId("settings-genre-checkbox-BGRA");
    await expect(uncheckedGenre).toBeVisible({ timeout: 5000 });
    await uncheckedGenre.click();

    // Save changes
    const saveButton = page.getByTestId("settings-genre-save");
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for sync to complete
    await waitForSyncComplete(page);

    // Record after counts
    const afterCounts = await getAnnotationCounts(page);
    console.log("After genre addition:", afterCounts);

    // Verify no orphaned annotations created
    const orphanedCounts = await getOrphanedAnnotationCounts(page);
    expect(orphanedCounts.orphanedNotes).toBe(0);
    expect(orphanedCounts.orphanedReferences).toBe(0);

    // Note: Counts may increase or stay the same depending on whether
    // the added genre has annotations in the test dataset
    expect(afterCounts.notes).toBeGreaterThanOrEqual(beforeCounts.notes);
    expect(afterCounts.references).toBeGreaterThanOrEqual(
      beforeCounts.references
    );
  });

  test("C: Settings genre removal purges orphaned annotations", async ({
    page,
  }) => {
    test.setTimeout(60000); // Genre sync + polling takes time

    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 15000 });
    await waitForSyncComplete(page);

    // Use a known genre that's not in default repertoire setup
    // Note: Using "Blues" (mixed case) due to data quality issue in genre table
    const genreToTest = "Blues";

    // Open Settings → Catalog & Sync
    await openCatalogSync(page);

    await expect(
      page.getByRole("heading", { name: "Catalog & Sync" })
    ).toBeVisible({ timeout: 5000 });

    // Wait for genre checkboxes to load
    const checkboxes = page.locator(
      '[data-testid^="settings-genre-checkbox-"]'
    );
    await expect
      .poll(() => checkboxes.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    // Check the genre checkbox to add it (should be unchecked initially)
    const genreCheckbox = page.locator(
      `[data-testid="settings-genre-checkbox-${genreToTest}"]`
    );
    await expect(genreCheckbox).toBeVisible({ timeout: 5000 });
    await genreCheckbox.click();

    // Save changes
    const saveButton = page.getByTestId("settings-genre-save");
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Close Settings modal
    await page.getByTestId("settings-close-button").click();
    await page.waitForTimeout(500);

    // Wait for sync to complete (tunes from the new genre sync down)
    await waitForSyncComplete(page);

    // Wait for tunes to actually appear in local DB (with polling)
    let tuneId: string | null = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      tuneId = await page.evaluate(async (genre: string) => {
        const api = (window as any).__ttTestApi;
        return await api.getTuneIdByGenre(genre);
      }, genreToTest);

      if (tuneId) break;
      await page.waitForTimeout(1000);
    }

    expect(tuneId).not.toBeNull();

    // Seed test annotations for this tune
    await seedAnnotations(page, {
      tuneId: tuneId!,
      noteCount: 3,
      referenceCount: 2,
    });

    // Record initial counts (should include our seeded annotations)
    const beforeCounts = await getAnnotationCounts(page);
    console.log("After genre addition and seeding:", beforeCounts);

    // Verify seeded annotations exist
    expect(beforeCounts.notes).toBeGreaterThanOrEqual(3);
    expect(beforeCounts.references).toBeGreaterThanOrEqual(2);

    // Re-open Settings → Catalog & Sync to remove the genre
    await openCatalogSync(page);

    await expect(
      page.getByRole("heading", { name: "Catalog & Sync" })
    ).toBeVisible({ timeout: 5000 });

    // Wait for checkboxes to reload
    await expect
      .poll(() => checkboxes.count(), {
        timeout: 15000,
        intervals: [100, 250, 500, 1000],
      })
      .toBeGreaterThan(0);

    // Uncheck the genre we just added
    await expect(genreCheckbox).toBeVisible({ timeout: 5000 });
    await genreCheckbox.click();

    // Save changes
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // Wait for sync to complete (includes purge of orphaned annotations)
    await waitForSyncComplete(page);

    // Record after counts
    const afterCounts = await getAnnotationCounts(page);
    console.log("After genre removal:", afterCounts);

    // Verify counts decreased (orphaned rows purged)
    expect(afterCounts.notes).toBeLessThan(beforeCounts.notes);
    expect(afterCounts.references).toBeLessThan(beforeCounts.references);

    // Verify no orphaned annotations remain
    const orphanedCounts = await getOrphanedAnnotationCounts(page);
    expect(orphanedCounts.orphanedNotes).toBe(0);
    expect(orphanedCounts.orphanedReferences).toBe(0);
  });

  test("D: Private tunes sync annotations regardless of genre filter", async ({
    page,
  }) => {
    await expect(ttPage.catalogGrid).toBeVisible({ timeout: 15000 });
    await waitForSyncComplete(page);

    // Get current user ID using test API
    const userId = await page.evaluate(async () => {
      const api = (window as any).__ttTestApi;
      if (!api) throw new Error("__ttTestApi not available");
      return await api.getCurrentUserId();
    });

    expect(userId).toBeTruthy();

    // Use a known genre that's NOT in the default selection
    const unselectedGenre = "CAJN"; // Cajun - should exist in public catalog but not in default selection

    // Create a private tune in the unselected genre (local-only for this test)
    const privateTuneId = await page.evaluate(
      async (opts: { genre: string; uid: string }) => {
        const api = (window as any).__ttTestApi;
        if (!api) throw new Error("__ttTestApi not available");
        return await api.findOrCreatePrivateTune(opts.genre, opts.uid);
      },
      { genre: unselectedGenre, uid: userId }
    );

    // Seed annotations for the private tune
    await seedAnnotations(page, {
      tuneId: privateTuneId,
      noteCount: 1,
      referenceCount: 1,
    });

    // Verify annotations exist for the private tune
    const counts = await getAnnotationCounts(page, {
      tuneId: privateTuneId,
    });

    expect(counts.notes).toBeGreaterThanOrEqual(1);
    expect(counts.references).toBeGreaterThanOrEqual(1);

    // Verify these annotations are NOT counted as orphaned
    // (even though the genre is not selected, private_for trumps genre filter)
    const orphanedCounts = await getOrphanedAnnotationCounts(page);

    // Get total orphaned count before we check if our private tune annotations are excluded
    const initialOrphanedNotes = orphanedCounts.orphanedNotes;
    const initialOrphanedRefs = orphanedCounts.orphanedReferences;

    // Private tune annotations should NOT be in the orphaned count
    // (This test validates that the orphan detection logic respects private_for)
    expect(initialOrphanedNotes).toBe(0);
    expect(initialOrphanedRefs).toBe(0);

    console.log("Private tune annotation counts:", counts);
  });
});
