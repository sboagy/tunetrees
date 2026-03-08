import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_REPERTOIRE_IRISH_FIDDLE_NAME,
  TEST_TUNE_MORRISON_ID,
} from "../../tests/fixtures/test-data";
import {
  advanceDays,
  STANDARD_TEST_DATE,
  setStableDate,
} from "../helpers/clock-control";
import { resetLocalDbAndResync } from "../helpers/local-db-lifecycle";
import {
  getTestUserClient,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * PRACTICE-005: Date Rollover Banner
 * Priority: High
 *
 * Validates banner visibility, queue persistence/refresh behavior across day rollovers,
 * and top-nav accessibility while the banner is visible.
 */

const ROLLOVER_INTERVAL_MS = 1000;
const ROLLOVER_WAIT_MS = 1500;

const QUEUE_DATE_STORAGE_KEY = "TT_PRACTICE_QUEUE_DATE";
const QUEUE_DATE_MANUAL_FLAG_KEY = "TT_PRACTICE_QUEUE_DATE_MANUAL";

const REPERTOIRE_B_NAME = `${TEST_REPERTOIRE_IRISH_FIDDLE_NAME} (E2E)`;

let ttPage: TuneTreesPage;
let currentDate: Date;
let primaryTuneIds: string[];

async function setRolloverInterval(page: Page) {
  await page.addInitScript((intervalMs) => {
    (
      window as unknown as {
        __TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__?: number;
      }
    ).__TUNETREES_TEST_DATE_ROLLOVER_INTERVAL_MS__ = intervalMs;
  }, ROLLOVER_INTERVAL_MS);
}

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

async function getQueueRows(page: Page, repertoireId: string) {
  return await page.evaluate(async (rid) => {
    const api = (window as any).__ttTestApi;
    if (!api || typeof api.getPracticeQueue !== "function") {
      throw new Error("__ttTestApi.getPracticeQueue is not available");
    }
    return await api.getPracticeQueue(rid);
  }, repertoireId);
}

async function getQueueSnapshot(page: Page, repertoireId: string) {
  const rows = await getQueueRows(page, repertoireId);
  if (!rows.length) {
    throw new Error("Expected practice queue rows but found none");
  }

  return {
    windowStartUtc: rows[0].window_start_utc,
    tuneOrder: rows.map((row: { tune_ref: string }) => row.tune_ref),
    rows,
  };
}

function getPendingTuneOrder(
  rows: Array<{ tune_ref: string; completed_at: string | null }>
) {
  return rows.filter((row) => !row.completed_at).map((row) => row.tune_ref);
}

function getQueueSignature(
  rows: Array<{
    tune_ref: string;
    bucket: number;
    order_index: number;
    completed_at: string | null;
  }>
) {
  return rows.map((row) => ({
    tuneRef: row.tune_ref,
    bucket: row.bucket,
    orderIndex: row.order_index,
    completed: !!row.completed_at,
  }));
}

function normalizeWindowStartUtc(value: string) {
  if (value.includes("T")) {
    return value;
  }
  return `${value.replace(" ", "T")}Z`;
}

function normalizeRepertoireLabel(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";

  if (compact.length % 2 === 0) {
    const half = compact.length / 2;
    const first = compact.slice(0, half);
    const second = compact.slice(half);
    if (first === second) {
      return first.trim();
    }
  }

  return compact;
}

async function getQueueStorage(page: Page) {
  return await page.evaluate(
    (keys) => ({
      queueDate: localStorage.getItem(keys.queueKey),
      manualFlag: localStorage.getItem(keys.manualKey),
    }),
    {
      queueKey: QUEUE_DATE_STORAGE_KEY,
      manualKey: QUEUE_DATE_MANUAL_FLAG_KEY,
    }
  );
}

async function expectQueueMatchesGrid(page: Page, repertoireId: string) {
  const snapshot = await getQueueSnapshot(page, repertoireId);
  const rows = ttPage.getRows("scheduled");
  await expect(rows).toHaveCount(snapshot.tuneOrder.length, {
    timeout: 10000,
  });
  return snapshot;
}

async function selectRepertoireByName(page: Page, repertoireName: string) {
  await ttPage.repertoireDropdownButton.click();
  await expect(ttPage.topNavManageRepertoiresPanel).toBeVisible({
    timeout: 10000,
  });
  const escapedName = repertoireName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await ttPage.topNavManageRepertoiresPanel
    .getByRole("button", { name: new RegExp(escapedName) })
    .click();
  await expect(ttPage.topNavManageRepertoiresPanel).toBeHidden({
    timeout: 10000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}

async function ensureRepertoireWithTunes(
  userKey: string,
  userId: string,
  repertoireName: string,
  tuneIds: string[],
  scheduleBase: Date
) {
  const { supabase } = await getTestUserClient(userKey);
  const repertoireId = randomUUID();

  const { error: repertoireError } = await supabase.from("repertoire").upsert(
    {
      repertoire_id: repertoireId,
      user_ref: userId,
      name: repertoireName,
      deleted: false,
      sync_version: 1,
      last_modified_at: new Date().toISOString(),
      device_id: "test-seed",
    },
    { onConflict: "repertoire_id" }
  );
  if (repertoireError) {
    throw new Error(`Failed to upsert repertoire: ${repertoireError.message}`);
  }

  const scheduledDate = new Date(scheduleBase);
  scheduledDate.setDate(scheduledDate.getDate() - 1);
  const scheduledIso = scheduledDate.toISOString();

  for (const tuneId of tuneIds) {
    const { error: tuneError } = await supabase.from("repertoire_tune").upsert(
      {
        repertoire_ref: repertoireId,
        tune_ref: tuneId,
        current: null,
        learned: null,
        scheduled: scheduledIso,
        goal: "recall",
        deleted: false,
        sync_version: 1,
        last_modified_at: new Date().toISOString(),
        device_id: "test-seed",
      },
      { onConflict: "repertoire_ref,tune_ref" }
    );

    if (tuneError) {
      throw new Error(`Failed to seed repertoire_tune: ${tuneError.message}`);
    }
  }

  return repertoireId;
}

async function cleanupRepertoire(userKey: string, repertoireId: string) {
  const { supabase } = await getTestUserClient(userKey);

  await supabase
    .from("daily_practice_queue")
    .delete()
    .eq("repertoire_ref", repertoireId);
  await supabase.rpc("e2e_clear_practice_record", {
    target_repertoire: repertoireId,
  });
  await supabase
    .from("repertoire_tune")
    .delete()
    .eq("repertoire_ref", repertoireId);
  await supabase.from("repertoire").delete().eq("repertoire_id", repertoireId);
}

test.describe("PRACTICE-005: Date Rollover Banner", () => {
  if (!process.env.PWDEBUG) {
    test.setTimeout(120_000);
  }

  test.beforeEach(async ({ page, context, testUser }) => {
    await setRolloverInterval(page);
    await setInjectedTestUserId(page, testUser.userId);

    ttPage = new TuneTreesPage(page);
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    const { privateTune1Id, privateTune2Id } = getPrivateTuneIds(
      testUser.userId
    );
    primaryTuneIds = [privateTune1Id, privateTune2Id];

    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: primaryTuneIds,
      startTab: "practice",
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
    });

    await setInjectedTestUserId(page, testUser.userId);

    await waitForTestApi(page);
    await expect(ttPage.practiceColumnsButton).toBeVisible({ timeout: 20000 });
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });
    await expect(
      ttPage.getRowInPracticeGridByTuneId(primaryTuneIds[0])
    ).toBeVisible({ timeout: 10000 });
    await expect(
      ttPage.getRowInPracticeGridByTuneId(primaryTuneIds[1])
    ).toBeVisible({ timeout: 10000 });
  });

  test("should show banner on rollover and keep queue stable while incomplete", async ({
    page,
    context,
    testUser,
  }) => {
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 5000 });

    const initialQueue = await expectQueueMatchesGrid(
      page,
      testUser.repertoireId
    );
    const initialStorage = await getQueueStorage(page);

    currentDate = await advanceDays(context, 1, currentDate);
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    const afterQueue = await getQueueSnapshot(page, testUser.repertoireId);
    const afterStorage = await getQueueStorage(page);

    expect(afterQueue.windowStartUtc).toBe(initialQueue.windowStartUtc);
    expect(afterQueue.tuneOrder).toEqual(initialQueue.tuneOrder);
    expect(afterStorage.queueDate).toBe(initialStorage.queueDate);
    expect(afterStorage.manualFlag).toBe(initialStorage.manualFlag);

    currentDate = await advanceDays(context, 1, currentDate);
    await page.waitForTimeout(ROLLOVER_WAIT_MS);

    const afterSecondQueue = await getQueueSnapshot(
      page,
      testUser.repertoireId
    );
    expect(afterSecondQueue.windowStartUtc).toBe(initialQueue.windowStartUtc);
    expect(afterSecondQueue.tuneOrder).toEqual(initialQueue.tuneOrder);
  });

  test("should show banner after reload and keep incomplete queue window stable", async ({
    page,
    context,
    testUser,
  }) => {
    const initialQueue = await expectQueueMatchesGrid(
      page,
      testUser.repertoireId
    );

    currentDate = await advanceDays(context, 1, currentDate);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForTestApi(page);
    await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    const reloadedQueue = await getQueueSnapshot(page, testUser.repertoireId);
    expect(reloadedQueue.windowStartUtc).toBe(initialQueue.windowStartUtc);
    expect(reloadedQueue.tuneOrder).toEqual(initialQueue.tuneOrder);

    const reloadedStorage = await getQueueStorage(page);
    expect(reloadedStorage.queueDate?.slice(0, 10)).toBe(
      initialQueue.windowStartUtc.slice(0, 10)
    );
    expect(reloadedStorage.manualFlag).toBe("false");
  });

  test("should refresh queue and hide banner when Refresh Now is pressed", async ({
    page,
    context,
    testUser,
  }) => {
    const initialQueue = await expectQueueMatchesGrid(
      page,
      testUser.repertoireId
    );
    const initialStorage = await getQueueStorage(page);

    // Setting the first row evaluation to "again", will allow us to
    // properly observe if a new queue is generated on date rollover
    const rows = ttPage.getRows("scheduled");
    const firstRow = rows.first();

    await ttPage.setRowEvaluation(firstRow, "again");
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    currentDate = await advanceDays(context, 1, currentDate);
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    await ttPage.dateRolloverRefreshButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 10000 });

    await expect
      .poll(
        async () =>
          (await getQueueSnapshot(page, testUser.repertoireId)).windowStartUtc,
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .not.toBe(initialQueue.windowStartUtc);

    const refreshedQueue = await getQueueSnapshot(page, testUser.repertoireId);
    const refreshedPendingCount = refreshedQueue.rows.filter(
      (row: { completed_at: string | null }) => !row.completed_at
    ).length;

    if (refreshedPendingCount > 0) {
      await expect
        .poll(async () => await ttPage.getRows("scheduled").count(), {
          timeout: 10000,
          intervals: [200, 500, 1000],
        })
        .toBeGreaterThan(0);
    }

    const refreshedVisibleCount = await ttPage.getRows("scheduled").count();
    const refreshedStorage = await getQueueStorage(page);

    expect(refreshedVisibleCount).toBeLessThanOrEqual(refreshedPendingCount);

    expect(refreshedQueue.windowStartUtc).not.toBe(initialQueue.windowStartUtc);
    expect(refreshedQueue.windowStartUtc.slice(0, 10)).toBe(
      currentDate.toISOString().slice(0, 10)
    );
    expect(refreshedStorage.queueDate).not.toBe(initialStorage.queueDate);
    expect(refreshedStorage.queueDate?.slice(0, 10)).toBe(
      currentDate.toISOString().slice(0, 10)
    );
    expect(refreshedStorage.manualFlag).toBe("false");
  });

  test("should auto-refresh completed queue without showing banner", async ({
    page,
    context,
    testUser,
  }) => {
    const initialQueue = await expectQueueMatchesGrid(
      page,
      testUser.repertoireId
    );

    const rows = ttPage.getRows("scheduled");
    const firstRow = rows.first();
    const secondRow = rows.nth(1);

    await ttPage.setRowEvaluation(firstRow, "good");
    await ttPage.setRowEvaluation(secondRow, "good");
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    await expect
      .poll(
        async () => {
          const rows = await getQueueRows(page, testUser.repertoireId);
          return rows.every(
            (row: { completed_at: string | null }) => !!row.completed_at
          );
        },
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .toBe(true);

    currentDate = await advanceDays(context, 1, currentDate);
    await page.waitForTimeout(ROLLOVER_WAIT_MS);
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 10000 });

    await expect
      .poll(
        async () =>
          (await getQueueSnapshot(page, testUser.repertoireId)).windowStartUtc,
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .not.toBe(initialQueue.windowStartUtc);

    const refreshedStorage = await getQueueStorage(page);
    expect(refreshedStorage.queueDate?.slice(0, 10)).toBe(
      currentDate.toISOString().slice(0, 10)
    );
    expect(refreshedStorage.manualFlag).toBe("false");
  });

  test("should keep incomplete queue stable after local reset and reload", async ({
    page,
    testUser,
  }) => {
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 5000 });

    const firstRow = ttPage.getRows("scheduled").first();
    await ttPage.setRowEvaluation(firstRow, "again");
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect
      .poll(
        async () => {
          const rows = await getQueueRows(page, testUser.repertoireId);
          return rows.some(
            (row: { completed_at: string | null }) => !!row.completed_at
          );
        },
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .toBe(true);

    const afterEvalQueue = await getQueueSnapshot(page, testUser.repertoireId);
    const expectedPendingOrder = getPendingTuneOrder(afterEvalQueue.rows);

    expect(expectedPendingOrder.length).toBeGreaterThan(0);

    await resetLocalDbAndResync(page);
    ttPage = new TuneTreesPage(page);
    await setInjectedTestUserId(page, testUser.userId);
    await waitForTestApi(page);

    await ttPage.navigateToTab("practice");

    const queueAfterReset = await getQueueSnapshot(page, testUser.repertoireId);
    const pendingAfterReset = getPendingTuneOrder(queueAfterReset.rows);

    expect(normalizeWindowStartUtc(queueAfterReset.windowStartUtc)).toBe(
      normalizeWindowStartUtc(afterEvalQueue.windowStartUtc)
    );
    expect(pendingAfterReset).toEqual(expectedPendingOrder);
    expect(getQueueSignature(queueAfterReset.rows)).toEqual(
      getQueueSignature(afterEvalQueue.rows)
    );
  });

  test("should keep incomplete queue stable after rollover then local reset", async ({
    page,
    context,
    testUser,
  }) => {
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 5000 });

    const firstRow = ttPage.getRows("scheduled").first();
    await ttPage.setRowEvaluation(firstRow, "again");
    await ttPage.submitEvaluationsButton.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await expect
      .poll(
        async () => {
          const rows = await getQueueRows(page, testUser.repertoireId);
          return rows.some(
            (row: { completed_at: string | null }) => !!row.completed_at
          );
        },
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .toBe(true);

    const afterEvalQueue = await getQueueSnapshot(page, testUser.repertoireId);
    const expectedPendingOrder = getPendingTuneOrder(afterEvalQueue.rows);
    expect(expectedPendingOrder.length).toBeGreaterThan(0);

    currentDate = await advanceDays(context, 1, currentDate);
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    await resetLocalDbAndResync(page);
    ttPage = new TuneTreesPage(page);
    await setInjectedTestUserId(page, testUser.userId);
    await waitForTestApi(page);

    await ttPage.navigateToTab("practice");
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    const queueAfterReset = await getQueueSnapshot(page, testUser.repertoireId);
    const pendingAfterReset = getPendingTuneOrder(queueAfterReset.rows);

    expect(normalizeWindowStartUtc(queueAfterReset.windowStartUtc)).toBe(
      normalizeWindowStartUtc(afterEvalQueue.windowStartUtc)
    );
    expect(pendingAfterReset).toEqual(expectedPendingOrder);
    expect(getQueueSignature(queueAfterReset.rows)).toEqual(
      getQueueSignature(afterEvalQueue.rows)
    );
  });

  // This test is skipped because it has side effects on the database, such as creating and deleting repertoires,
  // so it needs work to isolate its effects.
  test("should preserve queues when switching repertoires", async ({
    page,
    testUser,
    testUserKey,
  }) => {
    let repertoireBId: string | null = null;
    try {
      repertoireBId = await ensureRepertoireWithTunes(
        testUserKey,
        testUser.userId,
        REPERTOIRE_B_NAME,
        [TEST_TUNE_MORRISON_ID],
        currentDate
      );

      await resetLocalDbAndResync(page);
      ttPage = new TuneTreesPage(page);
      await waitForTestApi(page);
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

      const repertoireAName = normalizeRepertoireLabel(
        (await ttPage.repertoireDropdownButton.textContent()) || ""
      );
      if (!repertoireAName) {
        throw new Error(
          "Primary repertoire selection is empty; cannot switch back in UI"
        );
      }

      const queueA = await getQueueSnapshot(page, testUser.repertoireId);

      await selectRepertoireByName(page, REPERTOIRE_B_NAME);
      if (!repertoireBId) {
        throw new Error("Secondary repertoire ID missing after creation");
      }
      const queueB = await getQueueSnapshot(page, repertoireBId);
      expect(queueB.tuneOrder).not.toEqual(queueA.tuneOrder);

      await selectRepertoireByName(page, repertoireAName);
      const queueAAfter = await getQueueSnapshot(page, testUser.repertoireId);
      expect(queueAAfter.windowStartUtc).toBe(queueA.windowStartUtc);
      expect(queueAAfter.tuneOrder).toEqual(queueA.tuneOrder);
    } finally {
      if (repertoireBId) {
        await cleanupRepertoire(testUserKey, repertoireBId);
      }
    }
  });

  test("should allow top-nav controls while banner is visible", async ({
    context,
  }) => {
    currentDate = await advanceDays(context, 1, currentDate);
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    await ttPage.logoDropdownButton.click();
    await expect(ttPage.logoDropdownPanel).toBeVisible({ timeout: 10000 });
    await ttPage.logoDropdownButton.click();
    await expect(ttPage.logoDropdownPanel).toBeHidden({ timeout: 10000 });

    await ttPage.repertoireDropdownButton.click();
    await expect(ttPage.topNavManageRepertoiresPanel).toBeVisible({
      timeout: 10000,
    });
    await ttPage.repertoireDropdownButton.click();
    await expect(ttPage.topNavManageRepertoiresPanel).toBeHidden({
      timeout: 10000,
    });

    await ttPage.userMenuButton.click();
    await expect(ttPage.userMenuPanel).toBeVisible({ timeout: 10000 });
    await ttPage.userMenuButton.click();
    await expect(ttPage.userMenuPanel).toBeHidden({ timeout: 10000 });

    await ttPage.databaseStatusButton.click();
    await expect(ttPage.databaseDropdownPanel).toBeVisible({ timeout: 10000 });
    await ttPage.databaseStatusButton.click();
    await expect(ttPage.databaseDropdownPanel).toBeHidden({ timeout: 10000 });
  });
});
