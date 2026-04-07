import { expect } from "@playwright/test";
import { CATALOG_TUNE_KESH_ID } from "../../src/lib/db/catalog-tune-ids";
import {
  expectIsoClose,
  STANDARD_TEST_DATE,
  setStableDate,
} from "../helpers/clock-control";
import { setupForRepertoireTestsParallel } from "../helpers/practice-scenarios";
import { queryScheduledDates } from "../helpers/scheduling-queries";
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

    await setupForRepertoireTestsParallel(page, testUser, {
      repertoireTunes: [CATALOG_TUNE_KESH_ID],
      scheduleTunes: false,
    });

    await ttPage.expectGridHasContent(ttPage.repertoireGrid);
  });

  test("should apply and clear a schedule override from the single-surface grid picker", async ({
    page,
    testUser,
  }) => {
    if (test.info().project.name === "Mobile Chrome") {
      test.skip(true, "Grid picker assertions are currently desktop-only.");
    }

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
      .click();

    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(popover).toBeHidden({ timeout: 10000 });

    const expectedScheduledIso = buildLocalIsoForDate(currentDate, 8, 15, "AM");

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

    await trigger.click();
    await expect(popover).toBeVisible({ timeout: 10000 });
    await popover.getByRole("button", { name: "Clear" }).click();

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
  });
});
