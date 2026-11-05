/**
 * #609 / #769: Add To Review survives reload and preserves the active queue.
 * No persistence test hook is called after the action under test.
 */
import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_ABBY_REEL,
  CATALOG_TUNE_ALEXANDERS_ID,
  CATALOG_TUNE_MORRISON_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { waitForPracticeViewSettled } from "../helpers/practice-view";
import {
  queryPracticeQueue,
  queryScheduledDates,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

const tuneIds = [
  CATALOG_TUNE_ABBY_REEL,
  CATALOG_TUNE_ALEXANDERS_ID,
  CATALOG_TUNE_MORRISON_ID,
];

test.describe("Add To Review persistence", () => {
  let ttPage: TuneTreesPage;
  test.beforeEach(async ({ page, context, testUser }) => {
    await setStableDate(context, STANDARD_TEST_DATE);
    await page.addInitScript((userId) => {
      (globalThis as unknown as { __ttTestUserId?: string }).__ttTestUserId =
        userId;
    }, testUser.userId);
    // Future overrides keep automatic queue generation empty. Explicit additions
    // must still work and must leave those overrides unchanged.
    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: tuneIds,
      scheduleTunes: true,
      scheduleDaysAgo: -30,
      scheduleBaseDate: STANDARD_TEST_DATE,
    });
    ttPage = new TuneTreesPage(page);
    await ttPage.expectGridHasContent(ttPage.repertoireGrid);
    expect(await queryPracticeQueue(page, testUser.repertoireId)).toEqual([]);
    // Isolate local durability from remote recovery, including after reload.
    await page.route("**/api/sync**", (route) => route.abort());
  });

  test("creates only selected entries and survives an immediate reload", async ({
    page,
    testUser,
  }) => {
    // An unselected due tune would be pulled in by normal queue generation.
    // Add To Review must create only the explicitly selected entry.
    await page.evaluate(
      async ({ repertoireId, tuneId }) => {
        const api = window.__ttTestApi;
        if (!api) throw new Error("Test API unavailable");
        await api.updateScheduledDates(repertoireId, [
          { tuneId, scheduled: "2025-07-20T00:00:00" },
        ]);
      },
      { repertoireId: testUser.repertoireId, tuneId: CATALOG_TUNE_MORRISON_ID }
    );
    const schedulesBefore = await queryScheduledDates(
      page,
      testUser.repertoireId,
      tuneIds
    );
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_ABBY_REEL,
      ttPage.repertoireGrid
    );
    await ttPage.clickRepertoireAddToReview();
    await expect(
      page.getByText("Added 1 tune to practice queue.", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    await page.reload();
    await ttPage.navigateToTab("practice");
    await waitForPracticeViewSettled(page, ttPage, {
      expectRows: true,
      timeoutMs: 20000,
    });
    expect(
      (await queryPracticeQueue(page, testUser.repertoireId)).map(
        (row) => row.tune_ref
      )
    ).toEqual([CATALOG_TUNE_ABBY_REEL]);
    expect(
      await queryScheduledDates(page, testUser.repertoireId, tuneIds)
    ).toEqual(schedulesBefore);
  });

  test("saves an offline addition before reporting success", async ({
    page,
    context,
    testUser,
  }) => {
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_ABBY_REEL,
      ttPage.repertoireGrid
    );
    await context.setOffline(true);
    await ttPage.clickRepertoireAddToReview();
    await expect(
      page.getByText("Added 1 tune to practice queue.", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    // The dev server must be reachable to reload its assets; sync stays blocked.
    await context.setOffline(false);
    await page.reload();
    await ttPage.navigateToTab("practice");
    await waitForPracticeViewSettled(page, ttPage, {
      expectRows: true,
      timeoutMs: 20000,
    });
    expect(
      (await queryPracticeQueue(page, testUser.repertoireId)).map(
        (row) => row.tune_ref
      )
    ).toEqual([CATALOG_TUNE_ABBY_REEL]);
  });

  test("appends after rollover without replacing the previous queue", async ({
    page,
    context,
    testUser,
  }) => {
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_ABBY_REEL,
      ttPage.repertoireGrid
    );
    await ttPage.clickRepertoireAddToReview();
    await expect(
      page.getByText("Added 1 tune to practice queue.", { exact: true })
    ).toBeVisible({ timeout: 10000 });
    const before = await queryPracticeQueue(page, testUser.repertoireId);
    await setStableDate(context, "2025-07-21T14:00:00.000Z");
    // Make today's normal queue nonempty, so a generation-before-append bug
    // would create a different queue and hide yesterday's work.
    await page.evaluate(
      async ({ repertoireId, tuneId }) => {
        const api = window.__ttTestApi;
        if (!api) throw new Error("Test API unavailable");
        await api.updateScheduledDates(repertoireId, [
          { tuneId, scheduled: "2025-07-21T00:00:00" },
        ]);
      },
      { repertoireId: testUser.repertoireId, tuneId: CATALOG_TUNE_MORRISON_ID }
    );
    await ttPage.setGridRowChecked(
      CATALOG_TUNE_ALEXANDERS_ID,
      ttPage.repertoireGrid
    );
    await ttPage.clickRepertoireAddToReview();
    // Selection clears only after persistence finishes; the first toast may still exist.
    await expect(page.getByText(/\d+ tunes? selected/)).not.toBeVisible({
      timeout: 10000,
    });
    await page.reload();
    await ttPage.navigateToTab("practice");
    await waitForPracticeViewSettled(page, ttPage, {
      expectRows: true,
      timeoutMs: 20000,
    });
    const after = await queryPracticeQueue(page, testUser.repertoireId);
    expect(after).toHaveLength(2);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]).toMatchObject({
      tune_ref: CATALOG_TUNE_ALEXANDERS_ID,
      window_start_utc: before[0].window_start_utc,
      order_index: before[0].order_index + 1,
    });
  });
});
