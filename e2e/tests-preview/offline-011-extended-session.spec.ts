/**
 * Offline Test 4.1: Extended Offline Session (5+ minutes)
 *
 * Simulates a realistic extended offline session with multiple operations
 * across different tabs and features. Verifies data integrity and sync.
 *
 * Priority: P0 (Critical)
 * Feature: Extended Offline Usage
 */

import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_43_ID,
  CATALOG_TUNE_54_ID,
  CATALOG_TUNE_55_ID,
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  CATALOG_TUNE_72_ID,
  CATALOG_TUNE_113_ID,
  CATALOG_TUNE_A_FIG_FOR_A_KISS,
  CATALOG_TUNE_ABBY_REEL,
  CATALOG_TUNE_ALASDRUIMS_MARCH,
  CATALOG_TUNE_ALEXANDERS_ID,
  CATALOG_TUNE_BANISH_MISFORTUNE,
  CATALOG_TUNE_COOLEYS_ID,
  CATALOG_TUNE_DANCING_MASTER_ID,
  CATALOG_TUNE_KESH_ID,
  CATALOG_TUNE_MORRISON_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { goOffline, goOnline } from "../helpers/network-control";
import { setupDeterministicTestParallel } from "../helpers/practice-scenarios";
import {
  getSyncOutboxCount,
  triggerManualSync,
  verifySyncOutboxEmpty,
  waitForSync,
} from "../helpers/sync-verification";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";
import { BASE_URL } from "../test-config";

let ttPage: TuneTreesPage;

test.describe("OFFLINE-011: Extended Offline Session", () => {
  test.beforeEach(async ({ page, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Setup with substantial repertoire (18 tunes - all available named constants)
    const repertoire = [
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
      CATALOG_TUNE_54_ID,
      CATALOG_TUNE_55_ID,
      CATALOG_TUNE_43_ID,
      CATALOG_TUNE_113_ID,
      CATALOG_TUNE_DANCING_MASTER_ID,
      CATALOG_TUNE_A_FIG_FOR_A_KISS,
      // Add duplicates to reach 20 tunes
      CATALOG_TUNE_KESH_ID,
      CATALOG_TUNE_COOLEYS_ID,
    ];

    await setupDeterministicTestParallel(page, testUser, {
      seedRepertoire: repertoire,
    });

    // Navigate to Practice tab
    await ttPage.practiceTab.click();
    await page.waitForTimeout(1000);

    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

    // Wait for at least one tune to appear in the repertoire grid first
    await ttPage.repertoireTab.click();
    await expect(
      ttPage.repertoireGrid.locator("tbody tr[data-index='0']")
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("should handle 30+ operations offline and sync successfully", async ({
    page,
  }) => {
    // Submit first evaluation while online
    const initialRow = page
      .locator('[data-testid="practice-grid"] tbody tr')
      .first();
    const initialButton = initialRow.locator('button[title="Good"]');
    await initialButton.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Go offline after first evaluation
    await goOffline(page);

    console.log("📴 Starting extended offline session...");

    // ===== PRACTICE TAB: 20 evaluations =====
    console.log("🎯 Submitting 19 more practice evaluations...");
    for (let i = 0; i < 19; i++) {
      const row = page
        .locator('[data-testid="practice-grid"] tbody tr')
        .first();

      // Alternate between evaluation types
      const buttons = ["Good", "Easy", "Hard", "Again"];
      const buttonTitle = buttons[i % buttons.length];
      const button = row.locator(`button[title="${buttonTitle}"]`);

      await button.click({ timeout: 10000 });
      await page.waitForTimeout(300);

      if (i % 5 === 0) {
        console.log(`  ✓ Completed ${i + 1}/19 evaluations`);
      }
    }

    // ===== REPERTOIRE TAB: Add/remove tunes =====
    console.log("📝 Navigating to Repertoire tab...");
    await ttPage.repertoireTab.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log("🗑️ Removing 2 tunes from repertoire...");
    // Delete 2 tunes
    for (let i = 0; i < 2; i++) {
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

    // ===== CATALOG TAB: Add to repertoire =====
    console.log("📚 Navigating to Catalog tab...");
    await ttPage.catalogTab.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log("➕ Adding 3 tunes to repertoire from catalog...");
    // Add 3 tunes to repertoire
    for (let i = 0; i < 3; i++) {
      const checkbox = page
        .locator('[data-testid="catalog-grid"] tbody tr')
        .nth(i + 10) // Start from row 10 to avoid already-added tunes
        .locator('input[type="checkbox"]');
      await checkbox.click();
      await page.waitForTimeout(200);
    }

    await ttPage.catalogAddToRepertoireButton.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // ===== NOTES: Create notes on multiple tunes =====
    console.log("📝 Creating 5 notes on different tunes...");
    await ttPage.repertoireTab.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    for (let i = 0; i < 5; i++) {
      // Click on tune to open sidebar
      const tuneRow = page
        .locator('[data-testid="repertoire-grid"] tbody tr')
        .nth(i);
      await tuneRow.click();
      await page.waitForTimeout(500);

      // Click "Add Note" button
      await ttPage.notesAddButton.click({ timeout: 5000 });
      await page.waitForTimeout(300);

      // Type note content
      const noteEditor = ttPage.notesNewEditor;
      await noteEditor.fill(`Offline note ${i + 1} - Testing extended session`);

      // Save note
      await ttPage.notesSaveButton.click({ timeout: 5000 });
      await page.waitForTimeout(300);

      if (i % 2 === 0) {
        console.log(`  ✓ Created ${i + 1}/5 notes`);
      }
    }

    // ===== USER SETTINGS: Update preferences =====
    console.log("⚙️ Updating user settings...");
    await ttPage.userMenuButton.click();
    await page.waitForTimeout(300);
    await ttPage.userSettingsButton.click();
    await page.waitForTimeout(500);

    // Navigate to Scheduling Options
    await ttPage.userSettingsSchedulingOptionsButton.click();
    await page.waitForTimeout(500);

    // Change tunes per day limit (adjust selector as needed)
    const tunesPerDayInput = page.locator('input[name="maxDailyTunes"]');
    if (await tunesPerDayInput.isVisible({ timeout: 2000 })) {
      await tunesPerDayInput.fill("15");
      const saveButton = page.getByRole("button", { name: /save/i });
      await saveButton.click();
      await page.waitForTimeout(500);
    }

    // ===== ANALYSIS TAB: View stats =====
    console.log("📊 Navigating to Analysis tab...");
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify all changes persisted locally
    console.log("🔍 Verifying pending changes in sync_outbox...");
    const pendingCount = await getSyncOutboxCount(page);
    console.log(`📦 Pending sync items: ${pendingCount}`);
    expect(pendingCount).toBeGreaterThanOrEqual(30); // 20 practice + deletions + additions + notes + settings

    // ===== ONLINE RECONNECTION =====
    console.log("🌐 Going back online...");
    await goOnline(page);

    // Trigger sync
    console.log("🔄 Triggering sync...");
    await triggerManualSync(page);

    // Wait for sync to complete (may take longer with many changes)
    console.log("⏳ Waiting for sync to complete (max 60s)...");
    await waitForSync(page, 60000);

    // Verify sync completed successfully
    console.log("✅ Verifying sync completed...");
    await verifySyncOutboxEmpty(page);

    // Verify data integrity after sync
    console.log("🔍 Verifying data integrity...");

    // Check repertoire count (started with 20, removed 2, added 3 = 21)
    await page.goto(`${BASE_URL}/?tab=repertoire`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    const finalRepertoireCount = await page
      .locator('[data-testid="repertoire-grid"] tbody tr')
      .count();
    expect(finalRepertoireCount).toBe(21);

    console.log("✅ Extended offline session test completed successfully!");
  });

  test("should remain responsive during extended offline session", async ({
    page,
  }) => {
    // Go offline
    await goOffline(page);

    // Measure performance of operations
    const startTime = Date.now();

    // Submit 10 evaluations and measure time
    for (let i = 0; i < 10; i++) {
      const row = page
        .locator('[data-testid="practice-grid"] tbody tr')
        .first();
      const goodButton = row.locator('button[title="Good"]');
      await goodButton.click({ timeout: 10000 });
      await page.waitForTimeout(100);
    }

    const elapsed = Date.now() - startTime;
    const avgTimePerOp = elapsed / 10;

    console.log(`⏱️ Average time per operation: ${avgTimePerOp.toFixed(0)}ms`);

    // Each operation should complete in under 1 second
    expect(avgTimePerOp).toBeLessThan(1000);

    // UI should remain responsive (check practice grid still visible)
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 5000 });

    // Go online and cleanup
    await goOnline(page);
    await triggerManualSync(page);
    await waitForSync(page, 30000);
  });
});
