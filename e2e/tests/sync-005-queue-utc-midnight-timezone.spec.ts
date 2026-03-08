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

// Inject window.__ttTestUserId so test-api.ts can resolve the user after
// page reloads (Supabase session may not be available immediately after resync).
async function setInjectedTestUserId(page: Page, userId: string) {
  await page.addInitScript((id) => {
    (window as unknown as { __ttTestUserId?: string }).__ttTestUserId = id;
  }, userId);
  await page.evaluate((id) => {
    (window as unknown as { __ttTestUserId?: string }).__ttTestUserId = id;
  }, userId);
}

/**
 * SYNC-005: UTC-midnight window_start_utc must not trigger false rollover banner.
 * Priority: HIGH — targeted regression guard for the timezone bug fixed in this PR.
 *
 * THE BUG (pre-fix):
 *   When a queue row has window_start_utc = "YYYY-MM-DDT00:00:00" (UTC midnight —
 *   produced by a server or browser running in UTC+0/UTC+12 timezone), and the user
 *   is in a UTC-negative timezone (EST = UTC−4 in July), the old parseStoredDate()
 *   helper appended "Z" and interpreted that value as UTC midnight:
 *
 *     new Date("2025-07-20T00:00:00Z") → July 19, 8 PM EDT
 *
 *   toLocalDateString() then returned "2025-07-19", which mismatched today
 *   ("2025-07-20") and triggered the rollover banner — even though the queue
 *   was correctly scoped to the current calendar day.
 *
 * THE FIX:
 *   Step 2 of usePracticeQueueDate now extracts only the YYYY-MM-DD portion
 *   from window_start_utc and constructs a local-noon Date:
 *
 *     new Date("2025-07-20T12:00:00")  →  July 20, 12:00 PM in any local timezone
 *
 *   This always matches local getPracticeDate() convention and never triggers a
 *   false rollover.
 *
 * WHY THE EXISTING E2E SUITE DID NOT CATCH IT:
 *   - STANDARD_TEST_DATE is "2025-07-20T14:00:00.000Z" (14:00 UTC).
 *   - The queue created by the app in those tests has window_start_utc = "…T16:00:00"
 *     (local EDT noon → UTC 16:00). Appending "Z" gives 4 PM UTC → 12 PM EDT → still
 *     the same calendar day. The bug only fires when UTC time < 04:00.
 *   - CI runs in UTC, where UTC midnight IS local midnight — no date shift at all.
 *
 * TEST STRATEGY:
 *   1. Set browser timezone to "America/New_York" (UTC-4 in July / UTC-5 in winter).
 *   2. Freeze clock at STANDARD_TEST_DATE (10:00 AM EDT July 20 2025).
 *   3. After standard setup, replace all queue rows in Supabase with ONE row whose
 *      window_start_utc is exactly "2025-07-20T00:00:00.000Z" — UTC midnight, the
 *      value that would have been misinterpreted as July 19 by the old code.
 *   4. Wipe local DB and resync from Supabase (fresh-device simulation).
 *   5. PASS: rollover banner never appears (queueDate resolves to July 20 ✓).
 *   6. PASS: queue window date portion resolves to "2025-07-20", not "2025-07-19".
 */

// UTC midnight for the STANDARD_TEST_DATE calendar day — the minimal UTC time that
// triggers the bug in EDT (UTC-4): parseStoredDate() → July 19, 8 PM local.
const UTC_MIDNIGHT_WINDOW_START = "2025-07-20T00:00:00.000Z";

// The expected local calendar date when viewed in "America/New_York":
// substring(0,10) of the DB value → "2025-07-20" (correct = today in the test).
const EXPECTED_DATE = "2025-07-20";

test.describe("SYNC-005: UTC-midnight window_start_utc regression (timezone bug)", () => {
  // Set browser timezone to EDT/EST. This is the specific timezone where UTC
  // midnight for a given date resolves to the PREVIOUS local calendar day.
  test.use({ timezoneId: "America/New_York" });

  if (!process.env.PWDEBUG) {
    test.setTimeout(120_000);
  }

  let ttPage: TuneTreesPage;
  let currentDate: Date;

  test.beforeEach(async ({ page, context, testUser }) => {
    currentDate = new Date(STANDARD_TEST_DATE);
    await setStableDate(context, currentDate);
    // Must be called before any navigation so addInitScript survives all reloads.
    await setInjectedTestUserId(page, testUser.userId);

    ttPage = new TuneTreesPage(page);

    // Standard setup: seeds repertoire_tune with one tune due today.
    // We don't use the resulting queue — we'll replace it below.
    await setupForPracticeTestsParallel(page, testUser, {
      repertoireTunes: [TEST_TUNE_BANISH_ID],
      scheduleDaysAgo: 1,
      scheduleBaseDate: currentDate,
      // Don't navigate to practice yet — we need to replace the queue first.
      startTab: "repertoire",
    });
  });

  test("should NOT show rollover banner when DB queue has UTC-midnight window_start_utc", async ({
    page,
    testUser,
    testUserKey,
  }) => {
    const { supabase } = await getTestUserClient(testUserKey);

    // --- Replace Supabase queue rows with the UTC-midnight problematic value ---
    const { error: deleteError } = await supabase
      .from("daily_practice_queue")
      .delete()
      .eq("repertoire_ref", testUser.repertoireId);
    expect(
      deleteError,
      `Failed to delete existing queue rows: ${deleteError?.message}`
    ).toBeNull();

    const nowIso = new Date().toISOString();
    const windowEndIso = new Date(
      new Date(UTC_MIDNIGHT_WINDOW_START).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: insertError } = await supabase
      .from("daily_practice_queue")
      .insert({
        id: randomUUID(),
        user_ref: testUser.userId,
        repertoire_ref: testUser.repertoireId,
        tune_ref: TEST_TUNE_BANISH_ID,
        // This is the problematic value: UTC midnight for the test calendar day.
        // Old code: new Date("2025-07-20T00:00:00Z") → July 19 8 PM EDT → false rollover.
        // Fix:      substring(0,10) → "2025-07-20" → local noon July 20 → no rollover.
        window_start_utc: UTC_MIDNIGHT_WINDOW_START,
        window_end_utc: windowEndIso,
        bucket: 1,
        order_index: 0,
        snapshot_coalesced_ts: UTC_MIDNIGHT_WINDOW_START,
        generated_at: nowIso,
        active: true,
        sync_version: 1,
        last_modified_at: nowIso,
      });
    expect(
      insertError,
      `Failed to insert UTC-midnight queue row: ${insertError?.message}`
    ).toBeNull();

    // --- Wipe local DB and resync so the app sees only the UTC-midnight row ---
    await resetLocalDbAndResync(page);

    // Navigate to practice tab (setup used "repertoire" to avoid premature queue creation)
    const practiceTab = page.getByTestId("tab-practice");
    await practiceTab.click();

    // Wait for practice UI to settle after queueReady resolves
    await expect(page.getByTestId("practice-columns-button")).toBeVisible({
      timeout: 20_000,
    });

    // --- Primary assertion: rollover banner must NOT appear ---
    // OLD CODE FAILURE: queueDate resolved to "2025-07-19" (July 19 8 PM EDT from UTC midnight)
    //   → "2025-07-19" ≠ today "2025-07-20" → banner fires.
    // FIXED CODE:       queueDate resolves to "2025-07-20" (local noon from date-part only)
    //   → "2025-07-20" = today "2025-07-20" → no banner.
    await expect(ttPage.dateRolloverBanner).toBeHidden({ timeout: 10_000 });

    // --- Secondary assertion: resolved queue window date is the correct calendar day ---
    await page.waitForFunction(
      () => !!(window as unknown as { __ttTestApi?: unknown }).__ttTestApi,
      { timeout: 20_000 }
    );

    const queueInfo = await page.evaluate(async (rid) => {
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
      if (!api?.getQueueInfo)
        throw new Error("__ttTestApi.getQueueInfo not available");
      return await api.getQueueInfo(rid);
    }, testUser.repertoireId);

    // The resolved date portion must be the test calendar day, not the day before.
    expect(
      queueInfo.windowStartUtc.slice(0, 10),
      `Expected resolved queue date to be "${EXPECTED_DATE}" (today in EDT) ` +
        `but got "${queueInfo.windowStartUtc.slice(0, 10)}". ` +
        `The UTC-midnight window_start_utc was misinterpreted as the previous local day.`
    ).toBe(EXPECTED_DATE);
  });
});
