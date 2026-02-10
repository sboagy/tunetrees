import { expect } from "@playwright/test";
import {
  TEST_TUNE_BANISH_ID,
  TEST_TUNE_BANISH_TITLE,
} from "../../tests/fixtures/test-data";
import {
  STANDARD_TEST_DATE,
  setStableDate,
  verifyClockFrozen,
} from "../helpers/clock-control";
import {
  seedSchedulingPluginLocally,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import { queryLatestPracticeRecord } from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULING-010: Plugin Scheduler Override
 * Priority: HIGH
 *
 * Ensures scheduling plugins can override FSRS output deterministically.
 */

test.describe("SCHEDULING-010: Plugin Scheduler Override", () => {
  test.setTimeout(60000);

  let currentDate: Date;
  let ttPage: TuneTreesPage;

  test.beforeEach(async ({ page, context, testUser }) => {
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    ttPage = new TuneTreesPage(page);
    await ttPage.setSchedulingPrefs();

    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    await seedSchedulingPluginLocally(page, {
      goals: ["recall"],
    });

    await verifyClockFrozen(
      page,
      currentDate,
      undefined,
      test.info().project.name
    );
  });

  test("should apply plugin schedule overrides", async ({ page, testUser }) => {
    test.setTimeout(120000);
    await ttPage.navigateToTab("practice");
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

    const row = ttPage.practiceGrid.locator("tbody tr[data-index='0']");
    await expect(
      row.getByRole("cell", { name: TEST_TUNE_BANISH_TITLE })
    ).toBeVisible({ timeout: 10000 });

    await ttPage.setRowEvaluation(row, "good");
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.waitForTimeout(1200);

    const record = await queryLatestPracticeRecord(
      page,
      TEST_TUNE_BANISH_ID,
      testUser.playlistId
    );
    if (!record) throw new Error("No practice record found after evaluation");

    expect(record.interval).toBe(1);

    const practiced = new Date(record.practiced);
    const due = new Date(record.due);
    const diffDays = Math.round(
      (due.getTime() - practiced.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(1);
  });
});
