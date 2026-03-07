import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_KESH_ID,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SYNC-001: Queue row count is stable across page reloads.
 * Priority: MEDIUM — regression guard (expected to pass before the fix too).
 *
 * Verifies that `ensureDailyQueue` is idempotent: reloading the practice tab
 * multiple times must NOT duplicate rows in `daily_practice_queue`.  If the
 * queue grows on every reload it means the idempotency guard is broken, which
 * could cause a completely wrong count on device B where no prior queue existed.
 *
 * Seeded: 3 tunes, all due today.
 * Reloads: 3 round trips.
 * Assert: rowCount returned by getQueueInfo() equals exactly 3 on every load.
 */

const SEED_TUNES = [
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_MORRISON_ID,
  TEST_TUNE_KESH_ID,
];
const RELOAD_COUNT = 3;

async function getRowCount(page: Page, repertoireId: string): Promise<number> {
  return await page.evaluate(async (rid) => {
    const api = (
      window as unknown as {
        __ttTestApi?: {
          getQueueInfo: (id: string) => Promise<{
            windowStartUtc: string;
            rowCount: number;
            completedCount: number;
          }>;
        };
      }
    ).__ttTestApi;
    if (!api || typeof api.getQueueInfo !== "function") {
      throw new Error("__ttTestApi.getQueueInfo is not available");
    }
    const info = await api.getQueueInfo(rid);
    return info.rowCount;
  }, repertoireId);
}

import type { Page } from "@playwright/test";

test.describe("SYNC-001: Queue row count stable across reloads", () => {
  test.setTimeout(120_000);

  let ttPage: TuneTreesPage;
  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    ttPage = new TuneTreesPage(page);
    await ttPage.setSchedulingPrefs();

    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: SEED_TUNES,
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });
  });

  test("rowCount should equal seed count after each reload (idempotent ensureDailyQueue)", async ({
    page,
    testUser,
  }) => {
    // Confirm initial count equals exactly the seeded tune count.
    const initialCount = await getRowCount(page, testUser.repertoireId);
    expect(
      initialCount,
      "Initial queue should have exactly one row per tune"
    ).toBe(SEED_TUNES.length);

    // Reload multiple times and confirm the count never grows.
    for (let i = 1; i <= RELOAD_COUNT; i++) {
      await page.reload();
      await page.waitForLoadState("networkidle", { timeout: 30_000 });
      // Wait for practice grid to settle.
      await expect(page.getByTestId("practice-columns-button")).toBeVisible({
        timeout: 20_000,
      });

      const countAfterReload = await getRowCount(page, testUser.repertoireId);
      expect(
        countAfterReload,
        `Reload #${i}: expected ${SEED_TUNES.length} rows but got ${countAfterReload} — ensureDailyQueue is not idempotent`
      ).toBe(SEED_TUNES.length);
    }
  });
});
