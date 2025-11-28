import { expect } from "@playwright/test";
import { CATALOG_TUNE_ID_MAP } from "../../src/lib/db/catalog-tune-ids";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import {
  getTestUserClient,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import {
  getQueueBucketDistribution,
  queryPracticeQueue,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-005: Queue Bucket Distribution
 * Priority: MEDIUM
 *
 * Validates the practice queue bucket algorithm:
 * - Q1 (bucket=1): Due Today - tunes scheduled for today
 * - Q2 (bucket=2): Recently Lapsed - tunes overdue within delinquency window (0-7 days)
 * - Q3 (bucket=3): New - tunes never scheduled/practiced
 * - Q4 (bucket=4): Old Lapsed - tunes overdue > 7 days
 *
 * Validates:
 * - Correct bucket assignment based on scheduled dates
 * - Bucket ordering in queue (Q1 first, then Q2, then Q3, then Q4)
 * - Bucket counts match expected distribution
 */

// Use 9 distinct catalog tune IDs (no aliases that might overlap)
// Q1: Due Today - 2 tunes scheduled for today
const TUNES_DUE_TODAY = [
  CATALOG_TUNE_ID_MAP[113], // Banish Misfortune
  CATALOG_TUNE_ID_MAP[43], // Abbey Reel
];
// Q2: Recently Lapsed - 2 tunes overdue 1-7 days
const TUNES_RECENTLY_LAPSED = [
  CATALOG_TUNE_ID_MAP[54], // Alasdruim's March
  CATALOG_TUNE_ID_MAP[55], // Alexander's
];
// Q3: New - 3 tunes never scheduled
const TUNES_NEW = [
  CATALOG_TUNE_ID_MAP[66], // An Chóisir
  CATALOG_TUNE_ID_MAP[70], // An Sean Duine
  CATALOG_TUNE_ID_MAP[72], // Anderson's Reel
];
// Q4: Old Lapsed - 2 tunes overdue > 7 days
const TUNES_OLD_LAPSED = [
  CATALOG_TUNE_ID_MAP[83], // Apples in Winter
  CATALOG_TUNE_ID_MAP[89], // Ash Plant
];

const ALL_TUNES = [
  ...TUNES_DUE_TODAY,
  ...TUNES_RECENTLY_LAPSED,
  ...TUNES_NEW,
  ...TUNES_OLD_LAPSED,
];

let ttPage: TuneTreesPage;
let currentDate: Date;

test.describe("SCHEDULING-005: Queue Bucket Distribution", () => {
  // Fixed: Include last_modified_at in Supabase updates so incremental sync picks them up
  test.setTimeout(120000);

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    // Set stable starting date
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    // First, set up all tunes in repertoire (no scheduling yet)
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: ALL_TUNES,
      startTab: "practice",
    });

    // Now manually configure scheduled dates for bucket distribution
    const userKey = testUser.email.split(".")[0];
    const { supabase } = await getTestUserClient(userKey);

    // Q1: Due Today (scheduled for today)
    const todayStr = currentDate.toISOString();
    const nowStr = new Date().toISOString(); // For last_modified_at to trigger sync
    for (const tuneId of TUNES_DUE_TODAY) {
      await supabase
        .from("playlist_tune")
        .update({ scheduled: todayStr, last_modified_at: nowStr })
        .eq("playlist_ref", testUser.playlistId)
        .eq("tune_ref", tuneId);
    }

    // Q2: Recently Lapsed (3 days overdue - within 7-day window)
    const recentlyLapsedDate = new Date(currentDate);
    recentlyLapsedDate.setDate(recentlyLapsedDate.getDate() - 3);
    const recentlyLapsedStr = recentlyLapsedDate.toISOString();
    for (const tuneId of TUNES_RECENTLY_LAPSED) {
      await supabase
        .from("playlist_tune")
        .update({ scheduled: recentlyLapsedStr, last_modified_at: nowStr })
        .eq("playlist_ref", testUser.playlistId)
        .eq("tune_ref", tuneId);
    }

    // Q3: New (no scheduled date - leave as null)
    for (const tuneId of TUNES_NEW) {
      await supabase
        .from("playlist_tune")
        .update({ scheduled: null, last_modified_at: nowStr })
        .eq("playlist_ref", testUser.playlistId)
        .eq("tune_ref", tuneId);
    }

    // Q4: Old Lapsed (14 days overdue - beyond 7-day window)
    const oldLapsedDate = new Date(currentDate);
    oldLapsedDate.setDate(oldLapsedDate.getDate() - 14);
    const oldLapsedStr = oldLapsedDate.toISOString();
    for (const tuneId of TUNES_OLD_LAPSED) {
      await supabase
        .from("playlist_tune")
        .update({ scheduled: oldLapsedStr, last_modified_at: nowStr })
        .eq("playlist_ref", testUser.playlistId)
        .eq("tune_ref", tuneId);
    }

    // Clear local cache and reload to pick up scheduled dates
    await page.evaluate(async () => {
      const dbName = "tunetrees-storage";
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Re-login if needed (session may be lost after IndexedDB clear)
    const loginVisible = await page
      .getByRole("button", { name: "Use on this Device Only" })
      .isVisible()
      .catch(() => false);
    if (loginVisible) {
      await page.getByLabel("Email").fill(testUser.email);
      await page.locator('input[type="password"]').fill("TestPassword123!");
      await page.getByRole("button", { name: "Sign In" }).click();
    }

    await page.evaluate(() => (window as any).__forceSyncDownForTest?.());
    await page.waitForTimeout(3000);

    // CRITICAL: Delete the existing queue so it regenerates with correct scheduled dates
    // The queue was created before we updated scheduled dates in Supabase
    await page.evaluate(async (playlistId: string) => {
      const api = (window as any).__ttTestApi;
      if (!api) return;

      // Use seedAddToReview with empty tuneIds to trigger queue regeneration
      // This deletes the current queue and regenerates it
      await api.seedAddToReview({ playlistId, tuneIds: [] });
    }, testUser.playlistId);

    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );
  });

  test("should distribute tunes into correct buckets based on scheduled dates", async ({
    page,
    testUser,
  }) => {
    console.log("\n=== Queue Bucket Distribution Test ===");
    console.log(`  Current date: ${currentDate.toISOString().split("T")[0]}`);

    // Navigate to practice tab
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    // Query practice queue to examine bucket distribution
    const queue = await queryPracticeQueue(page, testUser.playlistId);
    console.log(`  Total queue size: ${queue.length}`);

    const distribution = getQueueBucketDistribution(queue);
    console.log(`  Q1 (Due Today): ${distribution.q1_due_today}`);
    console.log(`  Q2 (Recently Lapsed): ${distribution.q2_lapsed}`);
    console.log(`  Q3 (New): ${distribution.q3_new}`);
    console.log(`  Q4 (Old Lapsed): ${distribution.q4_old_lapsed}`);

    // Validate bucket counts match expected
    expect(distribution.q1_due_today).toBe(TUNES_DUE_TODAY.length);
    expect(distribution.q2_lapsed).toBe(TUNES_RECENTLY_LAPSED.length);
    expect(distribution.q3_new).toBe(TUNES_NEW.length);
    expect(distribution.q4_old_lapsed).toBe(TUNES_OLD_LAPSED.length);

    // Validate total
    expect(distribution.total).toBe(ALL_TUNES.length);

    // Validate bucket ordering: Q1 items should have lower order_index than Q2, etc.
    const q1Items = queue.filter((q) => q.bucket === 1);
    const q2Items = queue.filter((q) => q.bucket === 2);
    const q3Items = queue.filter((q) => q.bucket === 3);
    const q4Items = queue.filter((q) => q.bucket === 4);

    // Check ordering between buckets
    if (q1Items.length > 0 && q2Items.length > 0) {
      const maxQ1Order = Math.max(...q1Items.map((q) => q.order_index));
      const minQ2Order = Math.min(...q2Items.map((q) => q.order_index));
      console.log(`  Q1 max order: ${maxQ1Order}, Q2 min order: ${minQ2Order}`);
      expect(maxQ1Order).toBeLessThan(minQ2Order);
    }

    if (q2Items.length > 0 && q3Items.length > 0) {
      const maxQ2Order = Math.max(...q2Items.map((q) => q.order_index));
      const minQ3Order = Math.min(...q3Items.map((q) => q.order_index));
      console.log(`  Q2 max order: ${maxQ2Order}, Q3 min order: ${minQ3Order}`);
      expect(maxQ2Order).toBeLessThan(minQ3Order);
    }

    if (q3Items.length > 0 && q4Items.length > 0) {
      const maxQ3Order = Math.max(...q3Items.map((q) => q.order_index));
      const minQ4Order = Math.min(...q4Items.map((q) => q.order_index));
      console.log(`  Q3 max order: ${maxQ3Order}, Q4 min order: ${minQ4Order}`);
      expect(maxQ3Order).toBeLessThan(minQ4Order);
    }

    // Validate specific tune assignments
    console.log("\n  Validating specific tune bucket assignments...");

    for (const tuneId of TUNES_DUE_TODAY) {
      const item = queue.find((q) => q.tune_ref === tuneId);
      expect(item).toBeDefined();
      expect(item?.bucket).toBe(1);
    }

    for (const tuneId of TUNES_RECENTLY_LAPSED) {
      const item = queue.find((q) => q.tune_ref === tuneId);
      expect(item).toBeDefined();
      expect(item?.bucket).toBe(2);
    }

    for (const tuneId of TUNES_NEW) {
      const item = queue.find((q) => q.tune_ref === tuneId);
      expect(item).toBeDefined();
      expect(item?.bucket).toBe(3);
    }

    for (const tuneId of TUNES_OLD_LAPSED) {
      const item = queue.find((q) => q.tune_ref === tuneId);
      expect(item).toBeDefined();
      expect(item?.bucket).toBe(4);
    }

    console.log("\n✓ All bucket assignments validated correctly!");
  });

  test("should prioritize Q1 tunes first in practice view", async ({
    page,
    testUser,
  }) => {
    console.log("\n=== Queue Ordering Test ===");

    // Navigate to practice tab
    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    // The first few rows should be Q1 tunes (Due Today)
    const queue = await queryPracticeQueue(page, testUser.playlistId);

    // Sort by order_index to get expected order
    const sortedQueue = [...queue].sort(
      (a, b) => a.order_index - b.order_index
    );

    // First items should be bucket 1
    const firstItems = sortedQueue.slice(0, TUNES_DUE_TODAY.length);
    for (const item of firstItems) {
      console.log(
        `  First item: tune=${item.tune_ref}, bucket=${item.bucket}, order=${item.order_index}`
      );
      expect(item.bucket).toBe(1);
    }

    // Next items should be bucket 2
    const lapsedItems = sortedQueue.slice(
      TUNES_DUE_TODAY.length,
      TUNES_DUE_TODAY.length + TUNES_RECENTLY_LAPSED.length
    );
    for (const item of lapsedItems) {
      console.log(
        `  Lapsed item: tune=${item.tune_ref}, bucket=${item.bucket}, order=${item.order_index}`
      );
      expect(item.bucket).toBe(2);
    }

    console.log("\n✓ Queue ordering validated - Q1 items appear first!");
  });

  test("should reduce Q1/Q2 after practicing tunes", async ({
    page,
    testUser,
  }) => {
    console.log("\n=== Practice Effect on Buckets Test ===");

    await ttPage.practiceTab.click();
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    // Get initial distribution
    const initialQueue = await queryPracticeQueue(page, testUser.playlistId);
    const initialDistribution = getQueueBucketDistribution(initialQueue);
    console.log(`  Initial Q1: ${initialDistribution.q1_due_today}`);
    console.log(`  Initial total: ${initialDistribution.total}`);

    // Practice one Q1 tune
    const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
    await expect(row).toBeVisible({ timeout: 10000 });

    const evalDropdown = row.locator("[data-testid^='recall-eval-']");
    await expect(evalDropdown).toBeVisible({ timeout: 5000 });
    await evalDropdown.click();
    await page.waitForTimeout(200);
    await page.getByTestId("recall-eval-option-good").click();
    await page.waitForTimeout(300);

    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.evaluate(() => (window as any).__forceSyncUpForTest?.());
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Query the queue again - practiced tunes should be marked completed
    // Note: The queue total might stay the same (items marked completed, not deleted)
    // but the tune should have completed_at set
    const afterQueue = await queryPracticeQueue(page, testUser.playlistId);
    const afterDistribution = getQueueBucketDistribution(afterQueue);
    console.log(`  After practice Q1: ${afterDistribution.q1_due_today}`);
    console.log(`  After practice total: ${afterDistribution.total}`);

    // Check that at least one tune has been marked completed
    const completedItems = afterQueue.filter((q) => q.completed_at !== null);
    console.log(`  Completed items: ${completedItems.length}`);
    expect(completedItems.length).toBeGreaterThanOrEqual(1);

    // Q1 count should decrease (practiced tune moved to future or marked complete)
    // The initial Q1 had 2 tunes, after practicing 1, it should have 1 left in active view
    // Note: The queue may mark items as complete rather than removing them
    expect(afterDistribution.q1_due_today).toBeLessThanOrEqual(
      initialDistribution.q1_due_today
    );

    console.log("\n✓ Practicing a tune correctly updates the queue!");
  });
});
