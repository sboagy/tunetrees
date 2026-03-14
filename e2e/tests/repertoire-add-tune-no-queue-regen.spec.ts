/**
 * E2E Test: Adding a tune via "Add To Review" must NOT regenerate the queue
 *
 * Regression test for bug: "Adding new tune causes new queue to be created"
 * https://github.com/sboagy/tunetrees/issues/...
 *
 * Steps to reproduce the bug:
 * 1. Evaluate and submit all tunes in the current queue (queue becomes complete).
 * 2. Go to Repertoire tab.
 * 3. Select a tune (one NOT already in the queue).
 * 4. Click "Add To Review".
 * 5. Go to Practice tab → BUG: entire new queue was regenerated with all due tunes.
 *
 * Expected behavior:
 * - Only the selected tune is appended to the existing queue.
 * - The queue entry count increases by exactly 1.
 * - All previously-completed entries remain present (with completedAt set).
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  CATALOG_TUNE_66_ID,
  CATALOG_TUNE_70_ID,
  CATALOG_TUNE_MORRISON_ID,
} from "../../src/lib/db/catalog-tune-ids";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import {
  seedUserRepertoire,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

// Tunes that will be in the initial practice queue (scheduled due yesterday)
const QUEUE_TUNES = [CATALOG_TUNE_MORRISON_ID, CATALOG_TUNE_66_ID];

// A tune in the repertoire but NOT in the initial queue (unscheduled)
const EXTRA_TUNE = CATALOG_TUNE_70_ID;

let ttPage: TuneTreesPage;
let currentDate: Date;

async function setInjectedTestUserId(page: Page, userId: string) {
  await page.addInitScript((id) => {
    window.__ttTestUserId = id;
  }, userId);
  await page.evaluate((id) => {
    window.__ttTestUserId = id;
  }, userId);
}

async function waitForTestApi(page: Page) {
  await page.waitForFunction(() => !!(window as any).__ttTestApi, {
    timeout: 20000,
  });
}

async function getRepertoireCount(
  page: Page,
  repertoireId: string
): Promise<number> {
  return await page.evaluate(async (rid) => {
    const api = (window as any).__ttTestApi;
    if (!api || typeof api.getRepertoireCount !== "function") {
      throw new Error("__ttTestApi.getRepertoireCount is not available");
    }
    return await api.getRepertoireCount(rid);
  }, repertoireId);
}

/**
 * Retrieve the current active queue rows via __ttTestApi.
 */
async function getQueueRows(
  page: Page,
  repertoireId: string
): Promise<
  Array<{
    id: string;
    tune_ref: string;
    bucket: number;
    order_index: number;
    completed_at: string | null;
    window_start_utc: string;
  }>
> {
  return await page.evaluate(async (rid) => {
    const api = (window as any).__ttTestApi;
    if (!api || typeof api.getPracticeQueue !== "function") {
      throw new Error("__ttTestApi.getPracticeQueue is not available");
    }
    return await api.getPracticeQueue(rid);
  }, repertoireId);
}

test.describe("Regression: Add To Review must NOT regenerate the queue", () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page, context, testUser }) => {
    ttPage = new TuneTreesPage(page);
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);
    // Inject test user ID before and after navigation so __ttTestApi resolves the correct user.
    await setInjectedTestUserId(page, testUser.userId);

    // Phase 1: Seed only the 2 QUEUE_TUNES as scheduled for yesterday.
    // setupForPracticeTestsParallel clears the repertoire before seeding, so this is
    // the only call that can set scheduled dates; EXTRA_TUNE is added separately below.
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: QUEUE_TUNES,
      scheduleDaysAgo: 1, // QUEUE_TUNES due yesterday → will appear in practice queue
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    // Phase 2: Add EXTRA_TUNE to the repertoire as unscheduled (scheduled: null).
    // It will be visible in the repertoire grid but NOT in the practice queue.
    await seedUserRepertoire(testUser, [EXTRA_TUNE]);

    await waitForTestApi(page);
    await page.evaluate(async () => {
      const syncDown = (window as any).__forceSyncDownForTest;
      if (typeof syncDown !== "function") {
        throw new Error("__forceSyncDownForTest is not available");
      }
      await syncDown();
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect
      .poll(
        () => getRepertoireCount(page, testUser.repertoireId),
        { timeout: 20_000, intervals: [300, 500, 1000] }
      )
      .toBe(QUEUE_TUNES.length + 1);

    await waitForTestApi(page);
  });

  test("adding a tune after completing the queue should append only that tune, not regenerate", async ({
    page,
    testUser,
  }) => {
    // Skip on mobile — UI layout differs for evaluation controls.
    if (test.info().project.name === "Mobile Chrome") {
      test.skip();
    }

    // STEP 1: Verify initial queue contains exactly the 2 scheduled tunes.
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20_000 });

    const initialRows = await getQueueRows(page, testUser.repertoireId);
    expect(
      initialRows.length,
      "Initial queue should have exactly 2 tunes"
    ).toBe(QUEUE_TUNES.length);
    const initialWindowStart = initialRows[0].window_start_utc;

    // STEP 2: Evaluate and submit all tunes in the queue.
    const practiceRows = ttPage.getRows("scheduled");
    await expect(practiceRows).toHaveCount(QUEUE_TUNES.length, {
      timeout: 15_000,
    });

    // Set evaluations for all visible rows, then submit.
    for (let i = 0; i < QUEUE_TUNES.length; i++) {
      await ttPage.setRowEvaluation(practiceRows.nth(i), "good");
    }
    await ttPage.submitEvaluations({ timeoutMs: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 });

    // Wait until all queue rows are marked as completed.
    await expect
      .poll(
        async () => {
          const rows = await getQueueRows(page, testUser.repertoireId);
          return (
            rows.length > 0 &&
            rows.every((r) => !!r.completed_at)
          );
        },
        { timeout: 20_000, intervals: [300, 500, 1000] }
      )
      .toBe(true);

    // Record queue state after all evaluations submitted.
    const completedRows = await getQueueRows(page, testUser.repertoireId);
    const completedCount = completedRows.length;
    expect(completedCount, "All rows should be completed").toBe(
      QUEUE_TUNES.length
    );

    // STEP 3: Navigate to Repertoire tab.
    await ttPage.navigateToTab("repertoire");
    await expect(ttPage.repertoireGrid).toBeVisible({ timeout: 15_000 });

    // STEP 4: Select EXTRA_TUNE from the repertoire.
    // The repertoire grid shows all 3 tunes; select EXTRA_TUNE by its specific
    // aria-label (using the tune UUID) rather than relying on row order.
    const repertoireRows = ttPage.getRows("repertoire");
    await expect(repertoireRows).toHaveCount(
      QUEUE_TUNES.length + 1, // All 3 tunes should appear in repertoire
      { timeout: 15_000 }
    );

    // Target EXTRA_TUNE's checkbox directly by its aria-label (tune UUID).
    const extraTuneCheckbox = page.locator(
      `[data-testid="tunes-grid-repertoire"] input[type="checkbox"][aria-label="Select row ${EXTRA_TUNE}"]`
    );
    await expect(extraTuneCheckbox).toBeVisible({ timeout: 10_000 });
    await extraTuneCheckbox.check();
    // Wait for the selection to register in the row model.
    await expect(extraTuneCheckbox).toBeChecked({ timeout: 5_000 });

    // Set up dialog handler before clicking "Add To Review".
    let dialogMessage = "";
    page.on("dialog", async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // STEP 5: Click "Add To Review".
    await page.getByTestId("add-to-review-button").click();

    // Wait deterministically for the dialog to fire and be handled.
    await expect
      .poll(() => dialogMessage, { timeout: 10_000, intervals: [100, 250, 500] })
      .toMatch(/Added \d+ tune/);

    // Confirm the dialog shows the tune was added.
    expect(dialogMessage, "Dialog should confirm tune was added").toMatch(
      /Added \d+ tune/
    );

    // Wait for sync to flush local changes upstream before navigating away.
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // STEP 6: Navigate back to Practice tab.
    await ttPage.navigateToTab("practice");
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20_000 });

    // STEP 7: Query the queue state via test API.
    await expect
      .poll(
        async () => {
          const rows = await getQueueRows(page, testUser.repertoireId);
          return rows.length;
        },
        { timeout: 15_000, intervals: [300, 500, 1000] }
      )
      .toBe(QUEUE_TUNES.length + 1); // Should be 2 original + 1 new = 3

    const finalRows = await getQueueRows(page, testUser.repertoireId);

    // THE KEY ASSERTION: queue should have exactly 3 rows (2 original + 1 added),
    // NOT a full regeneration (which would replace the queue with all due tunes
    // and lose the completed_at markers).
    expect(
      finalRows.length,
      `Queue should have ${QUEUE_TUNES.length + 1} rows (original ${QUEUE_TUNES.length} + 1 new), not a full regeneration`
    ).toBe(QUEUE_TUNES.length + 1);

    // The newly added tune should be in the queue.
    const addedRow = finalRows.find((r) => r.tune_ref === EXTRA_TUNE);
    expect(addedRow, "The newly added tune should be in the queue").toBeDefined();
    expect(addedRow?.completed_at, "Newly added tune should be incomplete").toBeNull();

    // The window start should be the same — no new queue was created.
    for (const row of finalRows) {
      expect(
        row.window_start_utc,
        "All rows should belong to the same queue window"
      ).toBe(initialWindowStart);
    }

    // REGRESSION CHECK: The previously completed rows should still have completed_at.
    const originalCompletedRows = finalRows.filter(
      (r) => r.tune_ref !== EXTRA_TUNE
    );
    expect(
      originalCompletedRows.length,
      "Should still have the 2 original completed rows"
    ).toBe(QUEUE_TUNES.length);
    for (const row of originalCompletedRows) {
      expect(
        row.completed_at,
        `Original row for tune ${row.tune_ref} should still be marked completed`
      ).not.toBeNull();
    }
  });
});
