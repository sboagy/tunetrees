import { expect } from "@playwright/test";
import { CATALOG_TUNE_KESH_ID } from "../../src/lib/db/catalog-tune-ids";
import {
  expectIsoClose,
  STANDARD_TEST_DATE,
  setStableDate,
} from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { submitAndWaitForPracticeSettled } from "../helpers/practice-view";
import {
  queryLatestPracticeRecord,
  queryScheduledDates,
} from "../helpers/scheduling-queries";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SCHEDULE-OVERRIDE-001: In-grid schedule override picker
 * Priority: High
 *
 * Verifies the repertoire grid schedule override cell opens a single popover
 * surface that includes the calendar, time controls, and action buttons, and
 * that Apply and Clear persist correctly.
 */

let ttPage: TuneTreesPage;
let currentDate: Date;

function formatGridDateTitle(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function buildLocalIsoForDate(
  baseDate: Date,
  hour12: number,
  minute: number,
  period: "AM" | "PM"
): string {
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;

  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour24,
    minute,
    0,
    0
  ).toISOString();
}

async function getScheduledOverride(
  page: Parameters<typeof queryScheduledDates>[0],
  repertoireId: string,
  tuneId: string
): Promise<string | null> {
  const scheduledDates = await queryScheduledDates(page, repertoireId, [
    tuneId,
  ]);
  return scheduledDates.get(tuneId)?.scheduled ?? null;
}

test.describe("SCHEDULE-OVERRIDE-001: Grid Picker", () => {
  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);

    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [CATALOG_TUNE_KESH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    await ttPage.expectGridHasContent(ttPage.practiceGrid);
  });

  test("should apply and clear a schedule override from the single-surface grid picker", async ({
    page,
    testUser,
  }) => {
    const practiceRow = ttPage.getRows("scheduled").first();
    await expect(practiceRow).toBeVisible({ timeout: 10000 });
    await ttPage.setRowEvaluation(practiceRow, "good");
    await submitAndWaitForPracticeSettled(page, ttPage, 20000);

    const practiceRecord = await queryLatestPracticeRecord(
      page,
      CATALOG_TUNE_KESH_ID,
      testUser.repertoireId,
      { waitForRecordMs: 10000, pollIntervalMs: 250 }
    );
    expect(practiceRecord).not.toBeNull();
    expect(practiceRecord?.due).toBeTruthy();

    await ttPage.navigateToTab("repertoire");
    await ttPage.ensureGridView("repertoire");
    await ttPage.expectGridHasContent(ttPage.repertoireGrid);

    await ttPage.searchForTune("Kesh Jig", ttPage.repertoireGrid);
    await ttPage.ensureGridColumnVisible("repertoire", "Scheduled");

    const trigger = page.getByTestId(
      `scheduled-override-trigger-${CATALOG_TUNE_KESH_ID}`
    );
    await expect(trigger).toBeVisible({ timeout: 10000 });
    await trigger.scrollIntoViewIfNeeded();

    await trigger.click();

    const popover = page.getByTestId(
      `scheduled-override-popover-${CATALOG_TUNE_KESH_ID}`
    );
    await expect(popover).toBeVisible({ timeout: 10000 });
    await expect(popover.getByRole("button", { name: "Today" })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      popover.getByTestId(`scheduled-override-hour-${CATALOG_TUNE_KESH_ID}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      popover.getByTestId(`scheduled-override-minute-${CATALOG_TUNE_KESH_ID}`)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      popover.getByTestId(`scheduled-override-apply-${CATALOG_TUNE_KESH_ID}`)
    ).toBeVisible({ timeout: 10000 });

    // setupForPracticeTestsParallel seeds the queue by writing an initial
    // scheduled value. Clear that inherited override first so the baseline UI
    // state for the rest of the test is the fallback latest_due display.
    await popover.getByRole("button", { name: "Clear" }).click({
      force: true,
    });
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(popover).toBeHidden({ timeout: 10000 });

    await expect
      .poll(
        () =>
          getScheduledOverride(
            page,
            testUser.repertoireId,
            CATALOG_TUNE_KESH_ID
          ),
        {
          timeout: 10000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBeNull();

    const fallbackLabel = ((await trigger.textContent()) ?? "").trim();
    const fallbackTitle = await trigger.getAttribute("title");
    const triggerIcon = page.getByTestId(
      `scheduled-override-icon-${CATALOG_TUNE_KESH_ID}`
    );

    expect(fallbackLabel.length).toBeGreaterThan(0);
    expect(fallbackTitle).toBe(formatGridDateTitle(practiceRecord!.due));
    await expect(triggerIcon).toHaveClass(/text-gray-(400|500)/);
    await expect(triggerIcon).toHaveClass(/border-transparent/);

    await trigger.click();
    await expect(popover).toBeVisible({ timeout: 10000 });

    await popover.getByRole("button", { name: "Today" }).click();

    const hourInput = popover.getByTestId(
      `scheduled-override-hour-${CATALOG_TUNE_KESH_ID}`
    );
    const minuteInput = popover.getByTestId(
      `scheduled-override-minute-${CATALOG_TUNE_KESH_ID}`
    );

    await hourInput.fill("8");
    await hourInput.blur();
    await minuteInput.fill("15");
    await minuteInput.blur();
    await popover.getByRole("button", { name: "AM" }).click();
    await popover
      .getByTestId(`scheduled-override-apply-${CATALOG_TUNE_KESH_ID}`)
      .click({ force: true });

    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(popover).toBeHidden({ timeout: 10000 });

    const expectedScheduledIso = buildLocalIsoForDate(currentDate, 8, 15, "AM");
    const expectedScheduledTitle = formatGridDateTitle(expectedScheduledIso);

    await expect
      .poll(
        () =>
          getScheduledOverride(
            page,
            testUser.repertoireId,
            CATALOG_TUNE_KESH_ID
          ),
        {
          timeout: 10000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .not.toBeNull();

    const persistedScheduled = await getScheduledOverride(
      page,
      testUser.repertoireId,
      CATALOG_TUNE_KESH_ID
    );
    expect(persistedScheduled).not.toBeNull();
    expectIsoClose(
      persistedScheduled!,
      expectedScheduledIso,
      test.info().project.name,
      1000
    );
    await expect(trigger).toHaveText(/Today/, { timeout: 10000 });
    await expect(trigger).toHaveAttribute("title", expectedScheduledTitle);
    await expect(triggerIcon).toHaveClass(/text-purple-400|text-purple-600/);
    await expect(triggerIcon).toHaveClass(/border-current/);

    await trigger.click();
    await expect(popover).toBeVisible({ timeout: 10000 });
    await popover.getByRole("button", { name: "Clear" }).click({
      force: true,
    });

    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(popover).toBeHidden({ timeout: 10000 });

    await expect
      .poll(
        () =>
          getScheduledOverride(
            page,
            testUser.repertoireId,
            CATALOG_TUNE_KESH_ID
          ),
        {
          timeout: 10000,
          intervals: [100, 250, 500, 1000],
        }
      )
      .toBeNull();

    await expect(trigger).toHaveText(fallbackLabel, { timeout: 10000 });
    await expect(trigger).toHaveAttribute("title", fallbackTitle ?? "", {
      timeout: 10000,
    });
    await expect(triggerIcon).toHaveClass(/text-gray-(400|500)/);
    await expect(triggerIcon).toHaveClass(/border-transparent/);
  });
});
