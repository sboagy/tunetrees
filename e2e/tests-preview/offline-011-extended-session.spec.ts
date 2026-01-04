/**
 * Offline Test 4.1: Extended Offline Session (5+ minutes)
 *
 * Simulates a realistic extended offline session with multiple operations
 * across different tabs and features. Verifies data integrity and sync.
 *
 * Priority: P0 (Critical)
 * Feature: Extended Offline Usage
 */

import { expect, type Page } from "@playwright/test";
import {
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  CATALOG_TUNE_72_ID,
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
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
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
let currentDate: Date;

test.describe("OFFLINE-011: Extended Offline Session", () => {
  async function getLocalRepertoireCount(page: Page, playlistId: string) {
    return await page.evaluate(async (pid: string) => {
      const api = (window as any).__ttTestApi;
      if (!api) throw new Error("__ttTestApi not available");
      if (typeof api.getRepertoireCount !== "function") {
        throw new Error("getRepertoireCount not available on __ttTestApi");
      }
      return await api.getRepertoireCount(pid);
    }, playlistId);
  }

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
    CATALOG_TUNE_DANCING_MASTER_ID,
    CATALOG_TUNE_A_FIG_FOR_A_KISS,
  ];

  test.beforeEach(async ({ page, context, testUser }, testInfo) => {
    test.setTimeout(testInfo.timeout * 3);
    ttPage = new TuneTreesPage(page);

    // Freeze clock
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Setup with substantial repertoire (18 tunes - all available named constants)

    await setupDeterministicTestParallel(page, testUser, {
      clearRepertoire: true,
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
    testUser,
  }) => {
    let repertoireCount = await getLocalRepertoireCount(
      page,
      testUser.playlistId
    );
    expect(repertoireCount).toBe(12);

    await ttPage.navigateToTab("practice");
    // Submit first evaluation while online
    const initialRow = ttPage.getRows("scheduled").first();

    await ttPage.setRowEvaluation(initialRow, "good");

    // Go offline after first evaluation
    await goOffline(page);

    console.log("📴 Starting extended offline session...");

    // ===== PRACTICE TAB: 20 evaluations =====
    console.log("🎯 Submitting 19 more practice evaluations...");
    const nRowsCount = await ttPage.getRows("scheduled").count();
    let i = 0;
    for (i = 1; i < nRowsCount; i++) {
      const row = ttPage.getRows("scheduled").nth(i);

      // Alternate between evaluation types
      const grades = ["good", "easy", "hard", "again"];
      const whichGrade = grades[i % grades.length];

      await ttPage.setRowEvaluation(row, whichGrade);

      if (i % 5 === 0) {
        console.log(`  ✓ Completed ${i}/${nRowsCount} evaluations`);
      }
    }
    console.log(`  ✓ Completed ${i}/${nRowsCount} evaluations`);

    // ===== REPERTOIRE TAB: Add/remove tunes =====
    console.log("📝 Navigating to Repertoire tab...");
    await ttPage.repertoireTab.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log("🗑️ Removing 2 tunes from repertoire...");
    // Delete 2 tunes
    for (let i = 0; i < 2; i++) {
      const beforeDeleteCount = await getLocalRepertoireCount(
        page,
        testUser.playlistId
      );

      const checkbox = ttPage
        .getRows("repertoire")
        .first()
        .locator('input[type="checkbox"]');
      await checkbox.click();
      await expect(ttPage.repertoireRemoveButton).toBeEnabled({
        timeout: 5000,
      });
      await ttPage.repertoireRemoveButton.click({ timeout: 10000 });

      const heading = page.getByRole("heading", {
        name: "Remove selected tunes?",
      });
      await expect(heading).toBeVisible({ timeout: 10000 });
      const dialog = page
        .locator('[role="dialog"], [role="alertdialog"]')
        .filter({ has: heading });
      await dialog.getByRole("button", { name: /^Remove$/ }).click();

      await expect
        .poll(async () => getLocalRepertoireCount(page, testUser.playlistId), {
          timeout: 15000,
          intervals: [250, 500, 1000],
        })
        .toBe(beforeDeleteCount - 1);
      repertoireCount = beforeDeleteCount - 1;
    }

    // ===== CATALOG TAB: Add to repertoire =====
    console.log("📚 Navigating to Catalog tab...");
    await ttPage.navigateToTab("catalog");
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    console.log("➕ Adding 3 tunes to repertoire from catalog...");
    // Add 3 tunes to repertoire
    const beforeAddCount = await getLocalRepertoireCount(
      page,
      testUser.playlistId
    );
    for (let i = 0; i < 3; i++) {
      const checkbox = ttPage
        .getRows("catalog")
        .nth(i + 10) // Start from row 10 to avoid already-added tunes
        .locator('input[type="checkbox"]');
      await checkbox.click();
      await page.waitForTimeout(200);
    }

    await ttPage.catalogAddToRepertoireButton.click({ timeout: 10000 });

    await expect
      .poll(async () => getLocalRepertoireCount(page, testUser.playlistId), {
        timeout: 15000,
        intervals: [250, 500, 1000],
      })
      .toBe(beforeAddCount + 3);
    repertoireCount = beforeAddCount + 3;

    // ===== NOTES: Create notes on multiple tunes =====
    console.log("📝 Creating 5 notes on different tunes...");
    await ttPage.navigateToTab("repertoire");

    const intermediateRepertoireCount = await getLocalRepertoireCount(
      page,
      testUser.playlistId
    );
    console.log(
      `intermediateRepertoireCount: ${intermediateRepertoireCount}, repertoireCount: ${repertoireCount}`
    );
    expect(intermediateRepertoireCount).toBe(repertoireCount);

    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
    await page.waitForTimeout(1000);

    for (let i = 0; i < 5; i++) {
      // Click on tune to open sidebar
      const tuneRow = ttPage.getRows("repertoire").nth(i);
      await tuneRow.click();
      await page.waitForTimeout(500);

      // Type note content
      await ttPage.addNote(`Offline note ${i + 1} - Testing extended session`);

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

    // Change tunes per day limit (adjust selector as needed)
    const tunesPerDayInput = page.locator('input[name="maxDailyTunes"]');
    if (await tunesPerDayInput.isVisible({ timeout: 2000 })) {
      await tunesPerDayInput.fill("15");
      const saveButton = page.getByRole("button", { name: /save/i });
      await saveButton.click();
      await page.waitForTimeout(500);
    }

    console.log("Reloading page");
    await page.goto(`${BASE_URL}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

    // Verify all changes persisted locally
    console.log("🔍 Verifying pending changes in sync_outbox...");
    let pendingCount = await getSyncOutboxCount(page);
    const targetPendingCount = 20;
    const maxRetries = 40;

    let attempt: number;
    for (attempt = 1; attempt <= maxRetries; attempt++) {
      // console.log(
      //   `📦 Pending sync items (attempt ${attempt}/${maxRetries}): ${pendingCount}`
      // );

      if (pendingCount >= targetPendingCount) break;

      await page.waitForTimeout(250);
      pendingCount = await getSyncOutboxCount(page);
    }

    console.log(`📦 sync items (final): ${pendingCount} attempts: ${attempt}`);
    expect(pendingCount).toBeGreaterThanOrEqual(20); // 20 practice + deletions + additions + notes + settings

    await ttPage.navigateToTab("repertoire");
    const justBeforeOnlineRepertoireCount = await getLocalRepertoireCount(
      page,
      testUser.playlistId
    );
    console.log(
      `justBeforeOnlineRepertoireCount: ${justBeforeOnlineRepertoireCount}, repertoireCount: ${repertoireCount}`
    );
    expect(justBeforeOnlineRepertoireCount).toBe(repertoireCount);

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

    // Check repertoire count (started with 12, removed 2, added 3 = 13)
    await page.goto(`${BASE_URL}/?tab=repertoire`);
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect
      .poll(async () => getLocalRepertoireCount(page, testUser.playlistId), {
        timeout: 20000,
        intervals: [250, 500, 1000],
      })
      .toBe(repertoireCount);

    const finalRepertoireCount = await getLocalRepertoireCount(
      page,
      testUser.playlistId
    );
    console.log(
      `finalRepertoireCount: ${finalRepertoireCount}, repertoireCount: ${repertoireCount}`
    );
    expect(finalRepertoireCount).toBe(repertoireCount);

    console.log("✅ Extended offline session test completed successfully!");
  });

  test("should remain responsive during extended offline session", async ({
    page,
  }) => {
    // Go offline
    await goOffline(page);

    await ttPage.navigateToTab("practice");

    // Leave one in the grid for visibility check
    const nRowInQueueSub1 = (await ttPage.getRows("scheduled").count()) - 1;

    // Measure performance of operations
    const startTime = Date.now();

    // Submit 10 evaluations and measure time
    for (let i = 0; i < nRowInQueueSub1; i++) {
      const row = ttPage.getRows("scheduled").first();
      await ttPage.setRowEvaluation(row, "good", false);
      await ttPage.submitEvaluationsButton.click();
      await page.waitForTimeout(100);
    }

    const elapsed = Date.now() - startTime;
    const avgTimePerOp = elapsed / nRowInQueueSub1;

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
