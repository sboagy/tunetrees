import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { resetLocalDbAndResync } from "../helpers/local-db-lifecycle";
import {
  getTestUserClient,
  setupForPracticeTestsParallel,
} from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

/**
 * SYNC-003: A fresh device picks up the queue window that exists in Supabase.
 * Priority: MEDIUM — timing-dependent regression guard.
 *
 * Simulates the "second device" scenario from issue #427:
 *  1. Supabase already has a `daily_practice_queue` row seeded with YESTERDAY's
 *     window (placed there by a hypothetical "first device" yesterday).
 *  2. The local IndexedDB is completely wiped → "fresh device".
 *  3. After a full resync from Supabase the app must pick up yesterday's queue
 *     window, NOT create a brand-new one for today.
 *
 * Assertion: `getQueueInfo().windowStartUtc` date portion = yesterday.
 *
 * Classification: regression guard — expected to pass once the composable
 * always resolves from DB (MAX window_start_utc) rather than defaulting to today.
 *
 * NOTE: If the queue already has an *incomplete* yesterday window the rollover
 * banner should appear rather than a fresh today queue, which is the intended
 * post-fix behaviour.  This test validates the DB-first resolution only; UI
 * assertions are deliberately omitted to avoid sensitivity to the exact UI state.
 */

/** Extract YYYY-MM-DD portion of an ISO/timestamp string (UTC). */
function dateOnly(isoOrTs: string): string {
  // Handles both "2025-07-19T14:00:00.000Z" and "2025-07-19 14:00:00"
  return isoOrTs.slice(0, 10);
}

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
    return await api.getQueueInfo(rid);
  }, repertoireId);
}

test.describe("SYNC-003: Fresh device picks up synced queue window from Supabase", () => {
  test.setTimeout(120_000);

  let ttPage: TuneTreesPage;
  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);

    ttPage = new TuneTreesPage(page);
    await ttPage.setSchedulingPrefs();

    // Step 1: Seed repertoire and clear all practice tables in Supabase.
    // We pass no scheduleDaysAgo here so the helper does NOT create a queue;
    // we will insert one manually below with yesterday's window.
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      startTab: "practice",
      // No scheduleDaysAgo → repertoire_tune.scheduled defaults/none; queue
      // table is cleared by setupForPracticeTestsParallel. We build the custom
      // Supabase row below.
    });
  });

  test("should resolve to synced yesterday window after full local DB wipe", async ({
    page,
    testUser,
    testUserKey,
  }) => {
    // --- Build the "yesterday" window timestamps (UTC midnight boundaries) ---
    // Use UTC midnight so the seeded window_start_utc matches the convention
    // used by formatAsWindowStart() in production, avoiding a mismatch where
    // ensureDailyQueue misidentifies the window date and creates a duplicate.
    const yesterdayUtc = new Date(currentDate);
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
    const windowStartUtcDate = new Date(
      Date.UTC(
        yesterdayUtc.getUTCFullYear(),
        yesterdayUtc.getUTCMonth(),
        yesterdayUtc.getUTCDate(),
        0, 0, 0, 0
      )
    );
    const windowStartIso = windowStartUtcDate.toISOString(); // "2025-07-19T00:00:00.000Z"
    const windowEndUtcDate = new Date(windowStartUtcDate);
    windowEndUtcDate.setUTCDate(windowEndUtcDate.getUTCDate() + 1);
    const windowEndIso = windowEndUtcDate.toISOString(); // "2025-07-20T00:00:00.000Z"
    const nowIso = new Date().toISOString();

    // --- Insert queue row directly into Supabase ---
    const { supabase } = await getTestUserClient(testUserKey);
    const { error: insertError } = await supabase
      .from("daily_practice_queue")
      .insert({
        id: randomUUID(),
        user_ref: testUser.userId,
        repertoire_ref: testUser.repertoireId,
        tune_ref: TEST_TUNE_BANISH_ID,
        window_start_utc: windowStartIso,
        window_end_utc: windowEndIso,
        bucket: 1,
        order_index: 0,
        snapshot_coalesced_ts: windowStartIso,
        generated_at: nowIso,
        active: true,
        sync_version: 1,
        last_modified_at: nowIso,
      });
    expect(
      insertError,
      `Supabase insert failed: ${insertError?.message}`
    ).toBeNull();

    // --- Wipe local state and resync from Supabase ---
    // resetLocalDbAndResync: clears IndexedDB → navigates to app → waits for sync.
    await resetLocalDbAndResync(page);

    // Wait for practice panel to settle (may show rollover banner or empty-state
    // since tune has no schedule → that's fine, we only care about the DB row).
    await page.waitForFunction(
      () => !!(window as { __ttTestApi?: unknown }).__ttTestApi,
      { timeout: 20_000 }
    );

    // --- Poll until the synced row appears in local DB ---
    // Polling handles timing between sync completion and SQLite write.
    let queueInfo: {
      windowStartUtc: string;
      rowCount: number;
      completedCount: number;
    } = { windowStartUtc: "", rowCount: 0, completedCount: 0 };
    await expect
      .poll(
        async () => {
          queueInfo = await getQueueInfo(page, testUser.repertoireId);
          return queueInfo.rowCount;
        },
        { timeout: 25_000, intervals: [500, 1000, 2000] }
      )
      .toBeGreaterThan(0);

    // --- Assert the resolved window is yesterday's, not today's ---
    const expectedDatePortion = dateOnly(windowStartIso); // "2025-07-19"
    const todayDatePortion = dateOnly(currentDate.toISOString()); // "2025-07-20"

    expect(
      dateOnly(queueInfo.windowStartUtc),
      `After fresh-device resync the app resolved to "${dateOnly(queueInfo.windowStartUtc)}" ` +
        `but expected yesterday's synced window "${expectedDatePortion}" (not today "${todayDatePortion}"). ` +
        `This means ensureDailyQueue created a new window for today instead of reusing the synced one.`
    ).toBe(expectedDatePortion);
  });
});
