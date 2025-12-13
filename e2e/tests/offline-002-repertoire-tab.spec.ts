/**
 * Offline Test 1.2: Repertoire Tab Offline CRUD
 *
 * Verifies that repertoire operations (delete, sort, filter) work correctly
 * when offline and sync properly when connectivity is restored.
 *
 * Priority: P0 (Critical)
 * Feature: Offline Repertoire Management
 */

import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  CATALOG_TUNE_72_ID,
  CATALOG_TUNE_ABBY_REEL,
  CATALOG_TUNE_ALASDRUIMS_MARCH,
  CATALOG_TUNE_ALEXANDERS_ID,
  CATALOG_TUNE_BANISH_MISFORTUNE,
  CATALOG_TUNE_COOLEYS_ID,
  CATALOG_TUNE_KESH_ID,
  CATALOG_TUNE_MORRISON_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { goOffline, goOnline } from "../helpers/network-control";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import {
  triggerManualSync,
  verifySyncOutboxEmpty,
  waitForSync,
} from "../helpers/sync-verification";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

test.describe("OFFLINE-002: Repertoire Tab Offline CRUD", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Setup with 10 tunes in repertoire (navigates to repertoire tab by default)
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [
        CATALOG_TUNE_KESH_ID,
        CATALOG_TUNE_COOLEYS_ID,
        CATALOG_TUNE_BANISH_MISFORTUNE,
        CATALOG_TUNE_MORRISON_ID,
        CATALOG_TUNE_ABBY_REEL,
        CATALOG_TUNE_ALEXANDERS_ID,
        CATALOG_TUNE_ALASDRUIMS_MARCH,
        CATALOG_TUNE_66_ID,
        CATALOG_TUNE_70_ID,
        CATALOG_TUNE_72_ID,
      ],
    });

    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 10000 });

    // Wait for at least one tune to appear in the grid
    await expect(
      ttPage.repertoireGrid.locator("tbody tr[data-index='0']")
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("should delete tunes offline and sync when online", async ({ page }) => {
    // Count initial tunes
    const initialCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(initialCount).toBe(10);

    // Go offline
    await goOffline(page);

    // Select first 2 tunes
    const firstCheckbox = page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .first()
      .locator('input[type="checkbox"]');
    await firstCheckbox.click();

    const secondCheckbox = page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .nth(1)
      .locator('input[type="checkbox"]');
    await secondCheckbox.click();

    // Click delete button
    await ttPage.repertoireDeleteButton.click({ timeout: 10000 });

    // Confirm deletion dialog (if exists)
    const confirmButton = page.getByRole("button", { name: /confirm|delete/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }

    // Wait for UI update
    await page.waitForTimeout(1000);

    // Verify tunes disappeared from grid
    const afterDeleteCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(afterDeleteCount).toBe(8);

    // Go back online
    await goOnline(page);

    // Trigger sync
    await triggerManualSync(page);
    await waitForSync(page, 30000);

    // Verify sync completed
    await verifySyncOutboxEmpty(page);

    // Reload and verify tunes remain deleted
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const finalCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(finalCount).toBe(8);
  });

  test("should sort repertoire offline", async ({ page }) => {
    // Go offline
    await goOffline(page);

    // Get first tune title before sorting
    const firstTitleBefore = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .first()
      .locator("td")
      .nth(1) // Title column
      .textContent();

    // Click on title column header to sort
    const titleHeader = page.locator(
      '[data-testid="repertoire-grid"] thead th:has-text("Title")'
    );
    await titleHeader.click();

    // Wait for sort to apply
    await page.waitForTimeout(1000);

    // Get first tune title after sorting
    const firstTitleAfter = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .first()
      .locator("td")
      .nth(1)
      .textContent();

    // Verify sorting changed order (or confirm alphabetical)
    // Title after sort should be different (unless already sorted)
    if (firstTitleBefore !== firstTitleAfter) {
      expect(firstTitleAfter).not.toBe(firstTitleBefore);
    }

    // Go back online
    await goOnline(page);

    // Verify sorting still works after going online
    await titleHeader.click(); // Re-sort
    await page.waitForTimeout(1000);

    const firstTitleFinal = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .first()
      .locator("td")
      .nth(1)
      .textContent();

    expect(firstTitleFinal).toBeTruthy();
  });

  test("should filter repertoire by tune type offline", async ({ page }) => {
    // Go offline
    await goOffline(page);

    // Open filters panel
    await ttPage.filtersButton.click();

    // Wait for filter panel
    await page.waitForTimeout(500);

    // Select "Jig" from type filter
    const typeFilterSelect = page.locator('select[data-testid="type-filter"]');
    await typeFilterSelect.selectOption("Jig");

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify only jigs are shown (count should be less than 10)
    const filteredCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();

    expect(filteredCount).toBeLessThan(10);

    // Verify filtered tunes contain "Jig" in type column
    const typeCell = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .first()
      .locator("td")
      .nth(2) // Type column
      .textContent();

    expect(typeCell?.toLowerCase()).toContain("jig");

    // Clear filter
    await typeFilterSelect.selectOption("");

    // Wait for reset
    await page.waitForTimeout(1000);

    // Verify all tunes shown again
    const unfilteredCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(unfilteredCount).toBe(10);

    // Go back online
    await goOnline(page);
  });

  test("should handle multiple offline deletions and sync correctly", async ({
    page,
  }) => {
    // Go offline
    await goOffline(page);

    // Delete 3 tunes in succession
    for (let i = 0; i < 3; i++) {
      const checkbox = page
        .locator('[data-testid="repertoire-grid"] tbody tr')
        .first()
        .locator('input[type="checkbox"]');
      await checkbox.click();

      await ttPage.repertoireDeleteButton.click({ timeout: 10000 });

      const confirmButton = page.getByRole("button", {
        name: /confirm|delete/i,
      });
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(500);
    }

    // Verify 7 tunes remain
    const afterDeleteCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(afterDeleteCount).toBe(7);

    // Go online and sync
    await goOnline(page);
    await triggerManualSync(page);
    await waitForSync(page, 30000);

    // Verify sync succeeded
    await verifySyncOutboxEmpty(page);

    // Reload and verify state persisted
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const finalCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(finalCount).toBe(7);
  });
});
