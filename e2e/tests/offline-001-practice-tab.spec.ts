/**
 * Offline Test 1.1: Practice Tab Offline CRUD
 *
 * Verifies that practice evaluations work correctly when offline
 * and sync properly when connectivity is restored.
 *
 * Priority: P0 (Critical)
 * Feature: Offline Practice
 */

import { expect } from "@playwright/test";
import {
  goOffline,
  goOnline,
} from "../helpers/network-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import {
  getSyncOutboxCount,
  triggerManualSync,
  verifySyncOutboxEmpty,
  waitForSync,
} from "../helpers/sync-verification";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;

test.describe("OFFLINE-001: Practice Tab Offline CRUD", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Setup with 5 tunes in repertoire
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: ["1", "2", "3", "4", "5"],
      startTab: "practice",
    });

    // Navigate to Practice tab
    await page.goto("http://localhost:5173/?tab=practice");
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify initial data loads correctly
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });
  });

  test("should save practice evaluations offline and sync when online", async ({
    page,
  }) => {
    // Verify we have tunes to practice
    const initialCount = await page
      .locator('[data-testid="practice-grid"] tbody tr')
      .count();
    expect(initialCount).toBeGreaterThan(0);

    // Go offline
    await goOffline(page);

    // Wait a moment for offline state to propagate
    await page.waitForTimeout(1000);

    // Rate a tune (click "Good" button on first row)
    const firstRow = page
      .locator('[data-testid="practice-grid"] tbody tr')
      .first();
    const goodButton = firstRow.locator('button[title="Good"]');
    await goodButton.click({ timeout: 10000 });

    // Wait for UI to update
    await page.waitForTimeout(500);

    // Submit 3 more evaluations with mixed ratings
    // Again
    const secondRow = page
      .locator('[data-testid="practice-grid"] tbody tr')
      .first();
    const againButton = secondRow.locator('button[title="Again"]');
    await againButton.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Hard
    const thirdRow = page
      .locator('[data-testid="practice-grid"] tbody tr')
      .first();
    const hardButton = thirdRow.locator('button[title="Hard"]');
    await hardButton.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Easy
    const fourthRow = page
      .locator('[data-testid="practice-grid"] tbody tr')
      .first();
    const easyButton = fourthRow.locator('button[title="Easy"]');
    await easyButton.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify sync_outbox contains pending changes
    const pendingCount = await getSyncOutboxCount(page);
    expect(pendingCount).toBeGreaterThanOrEqual(4);

    // Verify practice queue updated correctly (count decreased)
    const afterOfflineCount = await page
      .locator('[data-testid="practice-grid"] tbody tr')
      .count();
    expect(afterOfflineCount).toBeLessThan(initialCount);

    // Go back online
    await goOnline(page);

    // Trigger manual sync
    await triggerManualSync(page);

    // Wait for sync to complete
    await waitForSync(page, 30000);

    // Verify sync_outbox is cleared
    await verifySyncOutboxEmpty(page);

    // Verify no data loss - practice records should be synced to Supabase
    // (This would require additional verification against Supabase)
    const finalCount = await page
      .locator('[data-testid="practice-grid"] tbody tr')
      .count();

    // Practice queue should remain consistent
    expect(finalCount).toBe(afterOfflineCount);
  });

  test("should handle rapid offline evaluations without data loss", async ({
    page,
  }) => {
    // Go offline immediately
    await goOffline(page);

    // Rapidly submit 5 evaluations
    for (let i = 0; i < 5; i++) {
      const row = page
        .locator('[data-testid="practice-grid"] tbody tr')
        .first();
      const goodButton = row.locator('button[title="Good"]');
      await goodButton.click({ timeout: 10000 });
      await page.waitForTimeout(200); // Minimal delay between clicks
    }

    // Verify all changes queued
    const pendingCount = await getSyncOutboxCount(page);
    expect(pendingCount).toBeGreaterThanOrEqual(5);

    // Go online and sync
    await goOnline(page);
    await triggerManualSync(page);
    await waitForSync(page, 30000);

    // Verify sync completed successfully
    await verifySyncOutboxEmpty(page);
  });

  test("should persist offline evaluations across page reload", async ({
    page,
  }) => {
    // Go offline
    await goOffline(page);

    // Submit 2 evaluations
    for (let i = 0; i < 2; i++) {
      const row = page
        .locator('[data-testid="practice-grid"] tbody tr')
        .first();
      const goodButton = row.locator('button[title="Good"]');
      await goodButton.click({ timeout: 10000 });
      await page.waitForTimeout(500);
    }

    // Check pending count before reload
    const beforeReload = await getSyncOutboxCount(page);
    expect(beforeReload).toBeGreaterThanOrEqual(2);

    // Reload page (still offline)
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Verify pending changes still queued
    const afterReload = await getSyncOutboxCount(page);
    expect(afterReload).toBe(beforeReload);

    // Go online and sync
    await goOnline(page);
    await page.reload(); // Reload to trigger sync
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await waitForSync(page, 30000);

    // Verify sync completed
    await verifySyncOutboxEmpty(page);
  });
});
