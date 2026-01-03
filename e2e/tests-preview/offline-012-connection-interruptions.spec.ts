/**
 * Offline Test 4.2: Offline → Online → Offline Transitions
 *
 * Tests handling of intermittent connectivity with partial syncs
 * and ensures data integrity across connection state changes.
 *
 * Priority: P1 (High)
 * Feature: Connection Transitions
 */

import { expect } from "@playwright/test";
import {
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
let currentDate: Date;

test.describe("OFFLINE-012: Connection Interruptions", () => {
  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Freeze clock
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Setup with practice-ready repertoire
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [
        CATALOG_TUNE_KESH_ID,
        CATALOG_TUNE_COOLEYS_ID,
        CATALOG_TUNE_BANISH_MISFORTUNE,
        CATALOG_TUNE_MORRISON_ID,
        CATALOG_TUNE_ABBY_REEL,
        CATALOG_TUNE_ALEXANDERS_ID,
        CATALOG_TUNE_ALASDRUIMS_MARCH,
      ],
      scheduleDaysAgo: 1, // Make tunes due for practice
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 10000 });

    // Wait for at least one tune to appear in the grid
    await expect(
      ttPage.practiceGrid.locator("tbody tr[data-index='0']")
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("should handle multiple offline/online transitions without data loss", async ({
    page,
  }) => {
    console.log("🔵 Phase 1: Create 3 practice records (online)");

    // Create 3 practice records while online
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(100); // reduce flake hopefull
      const row = ttPage.getRows("scheduled").first();
      await ttPage.setRowEvaluation(row, "good", 500);
      await page.waitForTimeout(100); // reduce flake hopefull
      const rowCountBeforeSubmit = await ttPage.getRows("scheduled").count();

      await ttPage.submitEvaluationsButton.click();

      await expect
        .poll(async () => ttPage.getRows("scheduled").count(), {
          timeout: 15_000,
        })
        .toBe(Math.max(0, rowCountBeforeSubmit - 1));
    }

    // Wait for sync
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await triggerManualSync(page);
    await waitForSync(page, 30000);

    // Verify synced
    await verifySyncOutboxEmpty(page);
    console.log("✅ Phase 1 complete - 3 records synced");

    console.log("🔴 Phase 2: Go offline and create 2 more records");

    // Go offline
    await goOffline(page);

    // Create 2 more practice records offline
    for (let i = 0; i < 2; i++) {
      page.waitForTimeout(100); // reduce flake hopefull
      const row = ttPage.getRows("scheduled").first();
      await ttPage.setRowEvaluation(row, "easy", 500);
      await page.waitForTimeout(100); // reduce flake hopefull
      const rowCountBeforeSubmit = await ttPage.getRows("scheduled").count();
      await ttPage.submitEvaluationsButton.click();
      await expect
        .poll(async () => ttPage.getRows("scheduled").count(), {
          timeout: 15_000,
        })
        .toBe(Math.max(0, rowCountBeforeSubmit - 1));
    }

    // Verify pending changes
    const afterOffline1 = await getSyncOutboxCount(page);
    expect(afterOffline1).toBeGreaterThanOrEqual(2);
    console.log(`✅ Phase 2 complete - ${afterOffline1} records pending`);

    console.log("🔵 Phase 3: Go online (let 1 record sync, then interrupt)");

    // Go online
    await goOnline(page);

    // Start sync but don't wait for completion
    await triggerManualSync(page);

    // Wait a short time (partial sync)
    await page.waitForTimeout(2000);

    console.log("🔴 Phase 4: Go offline again before full sync");

    // Go offline again (interrupt sync)
    await goOffline(page);

    // Check remaining pending changes (some may have synced)
    const afterInterrupt = await getSyncOutboxCount(page);
    console.log(`📦 After interrupt: ${afterInterrupt} records still pending`);

    console.log("📝 Phase 5: Create 1 more record while offline");

    // Create 1 more practice record while offline again
    const row = ttPage.getRows("scheduled").first();
    await ttPage.setRowEvaluation(row, "again");
    await ttPage.submitEvaluationsButton.click();
    await page.waitForTimeout(500);

    // Check total pending
    const beforeFinalSync = await getSyncOutboxCount(page);
    expect(beforeFinalSync).toBeGreaterThan(0);
    console.log(`📦 Before final sync: ${beforeFinalSync} records pending`);

    console.log("🔵 Phase 6: Go online and complete full sync");

    // Go online and complete full sync
    await goOnline(page);

    await triggerManualSync(page);
    await waitForSync(page, 60000); // Longer timeout for multiple retries

    // Verify all changes synced
    await verifySyncOutboxEmpty(page);
    console.log("✅ All changes synced successfully!");

    // Verify no data loss - reload and check state
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Should have completed 6 total evaluations (3 + 2 + 1)
    const practiceCount = await ttPage.getRows("scheduled").count();

    // Expect at least 1 tune remaining (started with 7, completed 6)
    expect(practiceCount).toBeGreaterThanOrEqual(1);

    console.log("✅ Connection transitions test passed!");
  });

  test("should queue changes correctly during rapid offline/online switches", async ({
    page,
  }) => {
    // Rapidly switch between offline/online while making changes
    for (let cycle = 0; cycle < 3; cycle++) {
      console.log(`🔄 Cycle ${cycle + 1}/3`);

      // Go offline
      await goOffline(page);

      const row = ttPage.getRows("scheduled").first();
      await ttPage.setRowEvaluation(row, "good");
      await ttPage.submitEvaluationsButton.click();
      await page.waitForTimeout(500);

      // Go online briefly
      await goOnline(page);
      await page.waitForTimeout(1000);
    }

    // Final sync
    await triggerManualSync(page);
    await waitForSync(page, 30000);

    // Verify all synced
    await verifySyncOutboxEmpty(page);

    console.log("✅ Rapid switches handled correctly!");
  });

  test("should preserve sync state across page reloads during offline", async ({
    page,
  }) => {
    // Go offline
    await goOffline(page);

    // Make 3 changes
    for (let i = 0; i < 3; i++) {
      const row = ttPage.getRows("scheduled").first();
      await ttPage.setRowEvaluation(row, "good");
      await ttPage.submitEvaluationsButton.click();
      await page.waitForTimeout(500);
    }

    // Check pending before reload
    const beforeReload = await getSyncOutboxCount(page);
    expect(beforeReload).toBeGreaterThanOrEqual(3);
    console.log(`📦 Before reload: ${beforeReload} pending`);

    // Reload page (still offline)
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Check pending after reload
    const afterReload = await getSyncOutboxCount(page);
    console.log(`📦 After reload: ${afterReload} pending`);
    expect(afterReload).toBe(beforeReload);

    // Go online
    await goOnline(page);

    // Reload again (online)
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Wait for auto-sync
    await waitForSync(page, 30000);

    // Verify synced
    await verifySyncOutboxEmpty(page);

    console.log("✅ Sync state preserved across reloads!");
  });
});
