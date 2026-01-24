import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  getPrivateTuneIds,
  TEST_PLAYLIST_IRISH_FIDDLE_NAME,
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

const PLAYLIST_B_NAME = `${TEST_PLAYLIST_IRISH_FIDDLE_NAME} (E2E)`;

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

async function getQueueRows(page: Page, playlistId: string) {
  return await page.evaluate(async (pid) => {
    const api = (window as any).__ttTestApi;
    if (!api || typeof api.getPracticeQueue !== "function") {
      throw new Error("__ttTestApi.getPracticeQueue is not available");
    }
    return await api.getPracticeQueue(pid);
  }, playlistId);
}

async function getQueueSnapshot(page: Page, playlistId: string) {
  const rows = await getQueueRows(page, playlistId);
  if (!rows.length) {
    throw new Error("Expected practice queue rows but found none");
  }

  return {
    windowStartUtc: rows[0].window_start_utc,
    tuneOrder: rows.map((row: { tune_ref: string }) => row.tune_ref),
    rows,
  };
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

async function expectQueueMatchesGrid(page: Page, playlistId: string) {
  const snapshot = await getQueueSnapshot(page, playlistId);
  const rows = ttPage.getRows("scheduled");
  await expect(rows).toHaveCount(snapshot.tuneOrder.length, {
    timeout: 10000,
  });
  return snapshot;
}

async function selectPlaylistByName(page: Page, playlistName: string) {
  await ttPage.playlistDropdownButton.click();
  await expect(ttPage.topNavManagePlaylistsPanel).toBeVisible({
    timeout: 10000,
  });
  await ttPage.topNavManagePlaylistsPanel
    .getByRole("button", { name: new RegExp(playlistName) })
    .click();
  await expect(ttPage.topNavManagePlaylistsPanel).toBeHidden({
    timeout: 10000,
  });
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}

async function ensurePlaylistWithTunes(
  userKey: string,
  userId: string,
  playlistName: string,
  tuneIds: string[],
  scheduleBase: Date
) {
  const { supabase } = await getTestUserClient(userKey);
  const playlistId = randomUUID();

  const { error: clearQueueError } = await supabase
    .from("daily_practice_queue")
    .delete()
    .eq("playlist_ref", playlistId);
  if (clearQueueError) {
    throw new Error(
      `Failed to clear daily_practice_queue: ${clearQueueError.message}`
    );
  }

  const { error: clearPracticeError } = await supabase
    .from("practice_record")
    .delete()
    .eq("playlist_ref", playlistId);
  if (clearPracticeError) {
    throw new Error(
      `Failed to clear practice_record: ${clearPracticeError.message}`
    );
  }

  const { error: clearPlaylistTunesError } = await supabase
    .from("playlist_tune")
    .delete()
    .eq("playlist_ref", playlistId);
  if (clearPlaylistTunesError) {
    throw new Error(
      `Failed to clear playlist_tune: ${clearPlaylistTunesError.message}`
    );
  }

  const { error: playlistError } = await supabase.from("playlist").upsert(
    {
      playlist_id: playlistId,
      user_ref: userId,
      name: playlistName,
      deleted: false,
      sync_version: 1,
      last_modified_at: new Date().toISOString(),
      device_id: "test-seed",
    },
    { onConflict: "playlist_id" }
  );
  if (playlistError) {
    throw new Error(`Failed to upsert playlist: ${playlistError.message}`);
  }

  const scheduledDate = new Date(scheduleBase);
  scheduledDate.setDate(scheduledDate.getDate() - 1);
  const scheduledIso = scheduledDate.toISOString();

  for (const tuneId of tuneIds) {
    const { error: tuneError } = await supabase.from("playlist_tune").upsert(
      {
        playlist_ref: playlistId,
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
      { onConflict: "playlist_ref,tune_ref" }
    );

    if (tuneError) {
      throw new Error(`Failed to seed playlist_tune: ${tuneError.message}`);
    }
  }

  return playlistId;
}

async function cleanupPlaylist(userKey: string, playlistId: string) {
  const { supabase } = await getTestUserClient(userKey);

  await supabase
    .from("daily_practice_queue")
    .delete()
    .eq("playlist_ref", playlistId);
  await supabase
    .from("practice_record")
    .delete()
    .eq("playlist_ref", playlistId);
  await supabase.from("playlist_tune").delete().eq("playlist_ref", playlistId);
  await supabase.from("playlist").delete().eq("playlist_id", playlistId);
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
      testUser.playlistId
    );
    const initialStorage = await getQueueStorage(page);

    currentDate = await advanceDays(context, 1, currentDate);
    await expect(ttPage.dateRolloverBanner).toBeVisible({ timeout: 10000 });

    const afterQueue = await getQueueSnapshot(page, testUser.playlistId);
    const afterStorage = await getQueueStorage(page);

    expect(afterQueue.windowStartUtc).toBe(initialQueue.windowStartUtc);
    expect(afterQueue.tuneOrder).toEqual(initialQueue.tuneOrder);
    expect(afterStorage.queueDate).toBe(initialStorage.queueDate);
    expect(afterStorage.manualFlag).toBe(initialStorage.manualFlag);

    currentDate = await advanceDays(context, 1, currentDate);
    await page.waitForTimeout(ROLLOVER_WAIT_MS);

    const afterSecondQueue = await getQueueSnapshot(page, testUser.playlistId);
    expect(afterSecondQueue.windowStartUtc).toBe(initialQueue.windowStartUtc);
    expect(afterSecondQueue.tuneOrder).toEqual(initialQueue.tuneOrder);
  });

  test("should refresh queue and hide banner when Refresh Now is pressed", async ({
    page,
    context,
    testUser,
  }) => {
    const initialQueue = await expectQueueMatchesGrid(
      page,
      testUser.playlistId
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
          (await getQueueSnapshot(page, testUser.playlistId)).windowStartUtc,
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .not.toBe(initialQueue.windowStartUtc);

    const refreshedQueue = await expectQueueMatchesGrid(
      page,
      testUser.playlistId
    );
    const refreshedStorage = await getQueueStorage(page);

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
      testUser.playlistId
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
          const rows = await getQueueRows(page, testUser.playlistId);
          return rows.every(
            (row: { completed_at: string | null }) => !!row.completed_at
          );
        },
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .toBe(true);

    currentDate = await advanceDays(context, 1, currentDate);
    await page.waitForTimeout(ROLLOVER_WAIT_MS);
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 5000 });

    await expect
      .poll(
        async () =>
          (await getQueueSnapshot(page, testUser.playlistId)).windowStartUtc,
        { timeout: 15000, intervals: [200, 500, 1000] }
      )
      .not.toBe(initialQueue.windowStartUtc);

    const refreshedStorage = await getQueueStorage(page);
    expect(refreshedStorage.queueDate?.slice(0, 10)).toBe(
      currentDate.toISOString().slice(0, 10)
    );
    expect(refreshedStorage.manualFlag).toBe("false");
  });

  // This test is skipped because it has side effects on the database, such as creating and deleting playlists,
  // so it needs work to isolate its effects.
  test.skip("should preserve queues when switching repertoires", async ({
    page,
    testUser,
    testUserKey,
  }) => {
    const { supabase } = await getTestUserClient(testUserKey);
    const { data: playlistAData, error: playlistAError } = await supabase
      .from("view_playlist_joined")
      .select("instrument")
      .eq("playlist_id", testUser.playlistId)
      .single();
    if (playlistAError) {
      throw new Error(
        `Failed to load primary playlist instrument: ${playlistAError.message}`
      );
    }
    const playlistAName = playlistAData?.instrument?.trim() || "";
    if (!playlistAName) {
      throw new Error(
        "Primary playlist instrument name is empty; cannot select in UI"
      );
    }

    let playlistBId: string | null = null;
    try {
      playlistBId = await ensurePlaylistWithTunes(
        testUserKey,
        testUser.userId,
        PLAYLIST_B_NAME,
        [TEST_TUNE_MORRISON_ID],
        currentDate
      );

      await resetLocalDbAndResync(page);
      ttPage = new TuneTreesPage(page);
      await waitForTestApi(page);
      await expect(ttPage.practiceGrid).toBeVisible({ timeout: 20000 });

      await selectPlaylistByName(page, playlistAName);
      const queueA = await getQueueSnapshot(page, testUser.playlistId);

      await selectPlaylistByName(page, PLAYLIST_B_NAME);
      if (!playlistBId) {
        throw new Error("Secondary playlist ID missing after creation");
      }
      const queueB = await getQueueSnapshot(page, playlistBId);
      expect(queueB.tuneOrder).not.toEqual(queueA.tuneOrder);

      await selectPlaylistByName(page, playlistAName);
      const queueAAfter = await getQueueSnapshot(page, testUser.playlistId);
      expect(queueAAfter.windowStartUtc).toBe(queueA.windowStartUtc);
      expect(queueAAfter.tuneOrder).toEqual(queueA.tuneOrder);
    } finally {
      if (playlistBId) {
        await cleanupPlaylist(testUserKey, playlistBId);
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

    await ttPage.playlistDropdownButton.click();
    await expect(ttPage.topNavManagePlaylistsPanel).toBeVisible({
      timeout: 10000,
    });
    await ttPage.playlistDropdownButton.click();
    await expect(ttPage.topNavManagePlaylistsPanel).toBeHidden({
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
