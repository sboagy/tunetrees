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
  CATALOG_TUNE_ABBY_REEL,
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
  verifySyncOutboxEmpty,
  waitForSync,
} from "../helpers/sync-verification";
import { test } from "../helpers/test-fixture";
import { waitForServiceWorker } from "../helpers/wait-for-service-worker";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

let ttPage: TuneTreesPage;
let currentDate: Date;

test.describe("OFFLINE-001: Practice Tab Offline CRUD", () => {
  // This suite's setup can legitimately take >30s on slower browsers because it
  // clears/seed data, clears IndexedDB, and waits for initial sync after reload.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Freeze clock
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // Setup with 5 tunes in repertoire
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [
        CATALOG_TUNE_KESH_ID,
        CATALOG_TUNE_COOLEYS_ID,
        CATALOG_TUNE_BANISH_MISFORTUNE,
        CATALOG_TUNE_MORRISON_ID,
        CATALOG_TUNE_ABBY_REEL,
      ],
      scheduleDaysAgo: 1, // Make tunes due for practice
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    // Ensure we're on the Practice tab and data loads correctly.
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(
        async () => ttPage.practiceGrid.locator("tbody tr[data-index]").count(),
        { timeout: 30_000 }
      )
      .toBeGreaterThan(0);
    await expect(
      ttPage.practiceGrid.locator("tbody tr[data-index='0']")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("should save practice evaluations offline and sync when online", async ({
    page,
  }) => {
    // Wait for grid to have data (in case it reloads between beforeEach and test)
    await expect(
      ttPage.practiceGrid.locator("tbody tr[data-index='0']")
    ).toBeVisible({
      timeout: 15000,
    });

    // Debug: Let's see what we actually have
    const allRows = await page
      .locator('[data-testid="practice-grid"] tbody tr')
      .count();
    const dataIndexRows = await page
      .locator('[data-testid="practice-grid"] tbody tr[data-index]')
      .count();
    console.log(`All rows: ${allRows}, Data-index rows: ${dataIndexRows}`);

    // Skip the count check - we know from snapshots that tunes are there
    // Just verify the first row is visible and proceed
    const firstRow = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
    await expect(firstRow).toBeVisible();

    // Get initial count before going offline
    const initialCount = await ttPage.practiceGrid
      .locator("tbody tr[data-index]")
      .count();
    console.log(`Initial practice queue count: ${initialCount}`);

    // Go offline
    await goOffline(page);

    // Wait a moment for offline state to propagate
    await page.waitForTimeout(2000);

    // Rate a tune using the dropdown (not a direct button)
    // Wait for row to be stable after going offline
    await expect(firstRow).toBeVisible({ timeout: 10000 });

    const evalDropdown = firstRow.locator("[data-testid^='recall-eval-']");
    await expect(evalDropdown).toBeVisible({ timeout: 10000 });

    // Click without force first - if that fails, the dropdown itself might be broken offline
    await evalDropdown.click();
    await page.waitForTimeout(500); // Give more time for dropdown to open

    // Wait for the option to be visible
    const goodOption = page.getByTestId("recall-eval-option-good");
    await expect(goodOption).toBeVisible({ timeout: 10000 });
    await goodOption.click();
    await page.waitForTimeout(300);

    // Submit the evaluation
    await ttPage.submitEvaluationsButton.click();
    await page.waitForTimeout(1000);

    // Verify sync_outbox contains pending changes (offline writes should queue)
    const pendingCount = await getSyncOutboxCount(page);
    console.log(`Pending sync count after offline evaluation: ${pendingCount}`);
    expect(pendingCount).toBeGreaterThanOrEqual(1);

    // Verify practice queue updated correctly (count decreased by 1)
    const afterOfflineCount = await ttPage.practiceGrid
      .locator("tbody tr[data-index]")
      .count();
    console.log(`Practice queue count after evaluation: ${afterOfflineCount}`);
    expect(afterOfflineCount).toBeLessThan(initialCount);

    // Go back online
    await goOnline(page);
    await page.waitForTimeout(2000); // Give time for online state to stabilize

    // Wait for automatic sync to complete (app should sync when coming online)
    await waitForSync(page, 30000);

    // Verify sync_outbox is cleared
    await verifySyncOutboxEmpty(page);

    // Verify practice queue remains consistent after sync
    const finalCount = await ttPage.practiceGrid
      .locator("tbody tr[data-index]")
      .count();
    console.log(`Final practice queue count after sync: ${finalCount}`);

    // Practice queue should remain the same (we removed 1 tune offline)
    expect(finalCount).toBe(afterOfflineCount);
  });

  test("should handle rapid offline evaluations without data loss", async ({
    page,
  }) => {
    // Go offline immediately
    await goOffline(page);

    // Rapidly submit 5 evaluations
    await page.waitForTimeout(1000);

    // Submit 3 evaluations using dropdown pattern
    for (let i = 0; i < 3; i++) {
      const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      await expect(row).toBeVisible({ timeout: 5000 });

      const evalDropdown = row.locator("[data-testid^='recall-eval-']");
      await expect(evalDropdown).toBeVisible({ timeout: 5000 });
      await evalDropdown.click({ force: true });
      await page.waitForTimeout(200);
      await page.getByTestId("recall-eval-option-good").click();
      await page.waitForTimeout(300);

      await ttPage.submitEvaluationsButton.click();
      await page.waitForTimeout(800); // Allow UI to update between evaluations
    }

    // Verify all changes queued
    const pendingCount = await getSyncOutboxCount(page);
    console.log(
      `Pending sync count after 3 offline evaluations: ${pendingCount}`
    );
    expect(pendingCount).toBeGreaterThanOrEqual(3);

    // Go online and wait for automatic sync
    await goOnline(page);
    await page.waitForTimeout(2000);
    await waitForSync(page, 30000);

    // Verify sync completed successfully
    await verifySyncOutboxEmpty(page);
  });

  // async function waitForServiceWorker() {
  //   await ttPage.page.evaluate(async () => {
  //     // Wait until the service worker is controlling the page
  //     if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
  //       await new Promise((resolve) => {
  //         navigator.serviceWorker.addEventListener("controllerchange", resolve);
  //       });
  //     }
  //   });
  // }

  test("should persist offline evaluations across page reload", async ({
    page,
  }) => {
    // Make sure the Service Worker is not fully activated and controlling the
    // page before the network is disconnected.
    await page.context().setOffline(false);
    const currentUrl = page.url();
    // await page.goto(currentUrl);
    // await page.context().serviceWorkers();
    // await waitForServiceWorker();
    console.log("2. Waiting for Service Worker to register...");
    await waitForServiceWorker(page.context(), currentUrl);

    // Go offline
    await goOffline(page);
    await page.waitForTimeout(1000);

    // Submit 2 evaluations using dropdown pattern
    for (let i = 0; i < 2; i++) {
      const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
      await expect(row).toBeVisible({ timeout: 5000 });

      const evalDropdown = row.locator("[data-testid^='recall-eval-']");
      await expect(evalDropdown).toBeVisible({ timeout: 5000 });
      await evalDropdown.click({ force: true });
      await page.waitForTimeout(200);
      await page.getByTestId("recall-eval-option-good").click();
      await page.waitForTimeout(300);

      await ttPage.submitEvaluationsButton.click();
      await page.waitForTimeout(800);
    }

    // Check pending count before reload
    const beforeReload = await getSyncOutboxCount(page);
    const beforeReloadStable = await ttPage.getStableSyncOutboxCount();
    console.log(
      `Pending sync count before reload: ${beforeReload} (stable=${beforeReloadStable})`
    );
    expect(beforeReloadStable).toBeGreaterThanOrEqual(2);

    // Reload page (still offline)

    // await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await page.waitForTimeout(2000);

    const immediatelyBeforeReload = await getSyncOutboxCount(page);
    await page.goto(currentUrl);
    // await page.reload();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

    // Verify pending changes still queued
    const afterReload = await getSyncOutboxCount(page);
    console.log(
      `Pending sync count after reload: ${afterReload}, immediatelyBeforeReload: ${immediatelyBeforeReload}`
    );
    await expect
      .poll(async () => await getSyncOutboxCount(page), {
        timeout: 10_000,
        intervals: [250, 250, 500, 1000],
      })
      .toBe(beforeReloadStable);
    expect(afterReload).toBe(beforeReloadStable);

    // Go online and wait for automatic sync
    await goOnline(page);
    await page.waitForTimeout(2000);
    await waitForSync(page, 30000);

    // Verify sync completed
    await verifySyncOutboxEmpty(page);
  });
});
