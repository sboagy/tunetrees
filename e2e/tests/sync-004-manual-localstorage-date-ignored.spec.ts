import { expect } from "@playwright/test";
import { TEST_TUNE_BANISH_ID } from "../../tests/fixtures/test-data";
import { STANDARD_TEST_DATE, setStableDate } from "../helpers/clock-control";
import { setupForPracticeTestsParallel } from "../helpers/practice-scenarios";
import { test } from "../helpers/test-fixture";
import { TuneTreesPage } from "../page-objects/TuneTreesPage";

async function setInjectedTestUserId(
  page: import("@playwright/test").Page,
  userId: string
) {
  await page.addInitScript((id) => {
    (window as unknown as { __ttTestUserId?: string }).__ttTestUserId = id;
  }, userId);
  await page.evaluate((id) => {
    (window as unknown as { __ttTestUserId?: string }).__ttTestUserId = id;
  }, userId);
}

/**
 * SYNC-004: Manual localStorage date must NOT override DB queue window.
 * Priority: HIGH — deterministic fail with current code.
 *
 * The problem (issue #427):
 *   When TT_PRACTICE_QUEUE_DATE_MANUAL=true is set in localStorage the current
 *   resolver in Index.tsx returns early, using the stored date without ever
 *   querying the DB for the latest active window.  This means a stale date
 *   injected before page load silently wins — breaking cross-device consistency.
 *
 * Expected behaviour (Rule 1 from the plan):
 *   The queue date MUST always be derived from the most recent active window in
 *   `daily_practice_queue`.  A manual localStorage override is only valid as a
 *   display hint for a date WITHIN that window; it must never skip the DB query.
 *
 * How this test forces the failure deterministically:
 *   1. A real queue window is seeded for STANDARD_TEST_DATE (today).
 *   2. Before the page loads, localStorage is pre-loaded with a date 3 days in
 *      the past AND the manual flag set to "true".
 *   3. After the page loads we ask the test API for the window that the app
 *      actually used (getQueueInfo).
 *   4. PASS criterion: the resolved windowStartUtc date-portion equals today
 *      (i.e. the app ignored the stale injected date and used the DB value).
 *   5. FAIL criterion (current behaviour): the resolved date equals the stale
 *      injected date — proving the early-return bug is active.
 *
 * NOTE: This test is expected to FAIL before the fix lands and PASS after it.
 */

const STALE_DATE_OFFSET_DAYS = 3;

/** Return ISO date string for N days before today (STANDARD_TEST_DATE). */
function staleDateIso(daysAgo: number): string {
  const d = new Date(STANDARD_TEST_DATE);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/** Extract YYYY-MM-DD portion of an ISO string (UTC). */
function dateOnly(isoString: string): string {
  return isoString.slice(0, 10);
}

test.describe("SYNC-004: Manual localStorage date does not override DB window", () => {
  test.setTimeout(90_000);

  let ttPage: TuneTreesPage;
  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);
    await setInjectedTestUserId(page, testUser.userId);

    ttPage = new TuneTreesPage(page);
    await ttPage.setSchedulingPrefs();

    // Seed one tune due today.  setupForPracticeTestsParallel clears storage &
    // tables, seeds the repertoire, builds a queue, then navigates to the
    // practice tab — so the DB now has a real window for today.
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      startTab: "practice",
    });

    // The page is now loaded and the real queue window exists in SQLite.
    // We need to reload with the stale date already sitting in localStorage
    // BEFORE the app initialises (addInitScript runs before any page script).
    //
    // Inject stale date via addInitScript so it is present on the *next* load.
    const staleDate = staleDateIso(STALE_DATE_OFFSET_DAYS);
    await page.addInitScript(
      ({ dateKey, manualKey, staleIso }) => {
        localStorage.setItem(dateKey, staleIso);
        localStorage.setItem(manualKey, "true");
      },
      {
        dateKey: "TT_PRACTICE_QUEUE_DATE",
        manualKey: "TT_PRACTICE_QUEUE_DATE_MANUAL",
        staleIso: staleDate,
      }
    );

    // Reload so the injected values are live from the very first script tick.
    await page.reload();
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
    await setInjectedTestUserId(page, testUser.userId);

    // Wait for the test API to be registered.
    await page.waitForFunction(
      () => !!(window as { __ttTestApi?: unknown }).__ttTestApi,
      { timeout: 20_000 }
    );
  });

  test("should resolve queue date from DB, not from stale manual localStorage", async ({
    page,
    testUser,
  }) => {
    // Ask the test API what window the app loaded.
    const queueInfo = await page.evaluate(async (repertoireId: string) => {
      const api = (
        window as {
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
      return await api.getQueueInfo(repertoireId);
    }, testUser.repertoireId);

    // The resolved windowStartUtc must be TODAY's date, not the stale date.
    // With the bug: windowStartUtc will be "" (ensureDailyQueue(July17) creates 0 rows
    // because BANISH is only due from July19 onwards) — so dateOnly("") = "" ≠ "2025-07-20".
    // After fix: app ignores stale date, falls back to today, generates July20 queue → passes.
    const expectedDatePortion = dateOnly(STANDARD_TEST_DATE); // "2025-07-20"
    const resolvedDate = dateOnly(queueInfo.windowStartUtc);
    const staleDatePortion = dateOnly(staleDateIso(STALE_DATE_OFFSET_DAYS));

    expect(
      resolvedDate,
      `Queue resolved to "${resolvedDate || "(empty — no queue rows created)"}" ` +
        `but expected "${expectedDatePortion}" (today). ` +
        `Empty or stale "${staleDatePortion}" means the app used the injected localStorage date ` +
        `instead of querying the DB. This confirms issue #427.`
    ).toBe(expectedDatePortion);
  });
});
