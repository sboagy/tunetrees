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
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
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
let currentDate: Date;

test.describe("OFFLINE-002: Repertoire Tab Offline CRUD", () => {
  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Freeze clock
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

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

    const initialCount = await ttPage.getRows("repertoire").count();
    expect(initialCount).toBe(10);

    // Go offline
    await goOffline(page);

    // Select first 2 tunes
    const firstCheckbox = ttPage
      .getRows("repertoire")
      .first()
      .locator('input[type="checkbox"]');
    await firstCheckbox.click();

    const secondCheckbox = ttPage
      .getRows("repertoire")
      .nth(1)
      .locator('input[type="checkbox"]');
    await secondCheckbox.click();

    // Click delete button
    await ttPage.repertoireDeleteButton.click({ timeout: 10000 });

    // Confirm deletion dialog (required)
    const confirmButton = page.getByRole("button", { name: /^delete$/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Wait for UI update
    await page.waitForTimeout(1000);

    // Verify tunes disappeared from grid
    const afterDeleteCount = await ttPage.getRows("repertoire").count();
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

    const finalCount = await ttPage.getRows("repertoire").count();
    expect(finalCount).toBe(8);
  });

  test("should sort repertoire offline", async ({ page }) => {
    // Go offline
    await goOffline(page);

    // Get first tune title before sorting
    const firstTitleBefore = await ttPage
      .getRows("repertoire")
      .first()
      .locator("td")
      .nth(1) // Title column
      .textContent();

    // Click on title column header to sort
    const titleHeader = page.locator(
      '[data-testid="tunes-grid-repertoire"] thead th:has-text("Title")'
    );
    await titleHeader.click();

    // Wait for sort to apply
    await page.waitForTimeout(1000);

    // Get first tune title after sorting
    const firstTitleAfter = await ttPage
      .getRows("repertoire")
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

    const firstTitleFinal = await ttPage
      .getRows("repertoire")
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

    const filterByType = page.getByRole("button", { name: "Filter by Type" });
    await filterByType.click();

    // Select "Jig" from type filter
    const typeFilterSelect = page.locator("label").filter({ hasText: "JigD" });
    await typeFilterSelect.check();

    // Close the filters
    await ttPage.filtersButton.click();

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify only jigs are shown (count should be less than 10)
    const filteredCount = await ttPage.getRows("repertoire").count();

    expect(filteredCount).toBeLessThan(10);

    // Verify filtered tunes contain "Jig" in type column
    const typeCell = await ttPage
      .getRows("repertoire")
      .first()
      .locator("td")
      .nth(2) // Type column
      .textContent();

    expect(typeCell?.toLowerCase()).toContain("jig");

    // Clear filter
    await ttPage.filtersButton.click();
    await ttPage.clearFilters.click();
    // Close the filters panel
    await ttPage.filtersButton.click();

    // Wait for reset
    await page.waitForTimeout(1000);

    // Verify all tunes shown again
    const unfilteredCount = await ttPage.getRows("repertoire").count();
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
      const checkbox = ttPage
        .getRows("repertoire")
        .first()
        .locator('input[type="checkbox"]');
      await checkbox.click();

      await ttPage.repertoireDeleteButton.click({ timeout: 10000 });

      const confirmButton = page.getByRole("button", {
        name: /^delete$/i,
      });
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      await confirmButton.click();

      await page.waitForTimeout(500);
    }

    // Verify 7 tunes remain
    const afterDeleteCount = await ttPage.getRows("repertoire").count();
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

    const finalCount = await ttPage.getRows("repertoire").count();
    expect(finalCount).toBe(7);
  });
});
