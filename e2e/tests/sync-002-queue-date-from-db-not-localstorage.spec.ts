import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_KESH_ID,
} from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SYNC-002: Queue date resolved from DB even after localStorage keys are wiped.
 * Priority: MEDIUM — regression guard (expected to pass before the fix too).
 *
 * Validates that the non-manual path always queries the DB for the latest
 * active window.  If localStorage keys `TT_PRACTICE_QUEUE_DATE` and
 * `TT_PRACTICE_QUEUE_DATE_MANUAL` are removed mid-session and the page is
 * reloaded, the app must still find the same existing DB window and show the
 * same row count — it must NOT create a new / second queue window.
 *
 * Seeded: 2 tunes, all due today.
 * Action: wipe both localStorage keys, reload page.
 * Assert: getQueueInfo().windowStartUtc unchanged; rowCount unchanged.
 */

const SEED_TUNES = [TEST_TUNE_BANISH_ID, TEST_TUNE_KESH_ID];

async function getQueueInfo(
  page: Page,
  repertoireId: string
): Promise<{
  windowStartUtc: string;
  rowCount: number;
  completedCount: number;
}> {
  return await page.evaluate(async (rid) => {
    const api = (
      window as unknown as {
        __ttTestApi?: {
          getQueueInfo: (
            id: string
          ) => Promise<{
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
    return await api.getQueueInfo(rid);
  }, repertoireId);
}

test.describe("SYNC-002: Queue date resolved from DB after localStorage wipe", () => {
  test.setTimeout(90_000);

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

  test("should use same DB window after localStorage keys are removed and page reloaded", async ({
    page,
    testUser,
  }) => {
    // Record the initial DB state.
    const beforeInfo = await getQueueInfo(page, testUser.repertoireId);
    expect(
      beforeInfo.rowCount,
      "Pre-wipe: expected seeded tunes in queue"
    ).toBe(SEED_TUNES.length);

    // Wipe both localStorage queue-date keys so the app can't use them on next load.
    await page.evaluate(() => {
      localStorage.removeItem("TT_PRACTICE_QUEUE_DATE");
      localStorage.removeItem("TT_PRACTICE_QUEUE_DATE_MANUAL");
    });

    // Reload so the cleared state takes effect before any app code runs.
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
    await expect(page.getByTestId("practice-columns-button")).toBeVisible({
      timeout: 20_000,
    });

    // Wait for test API to be available again after reload.
    await page.waitForFunction(
      () => !!(window as { __ttTestApi?: unknown }).__ttTestApi,
      { timeout: 20_000 }
    );

    // After reload, the app must resolve the same DB window.
    const afterInfo = await getQueueInfo(page, testUser.repertoireId);

    expect(
      afterInfo.windowStartUtc,
      "After localStorage wipe, queue window changed — resolver is not DB-first"
    ).toBe(beforeInfo.windowStartUtc);

    expect(
      afterInfo.rowCount,
      "After localStorage wipe, row count changed — a new window was incorrectly created"
    ).toBe(beforeInfo.rowCount);
  });
});
