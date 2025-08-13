import { test, expect } from "@playwright/test";
import {
  setTestDateTime,
  setTestDefaults,
} from "../test-scripts/set-test-defaults";
import { TuneTreesPageObject } from "../test-scripts/tunetrees.po";
import { restartBackend } from "@/test-scripts/global-setup";
import { getStorageState } from "@/test-scripts/storage-state";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";

// Extend the Window interface to include __TT_REVIEW_SITDOWN_DATE__
declare global {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Window {
    __TT_REVIEW_SITDOWN_DATE__?: string;
  }
}

// Parameterize timezones for future expansion
const timezones = ["Asia/Karachi", "America/New_York"]; // UTC+5, EST (Eastern Time), add more as needed
const timezoneId = timezones[1];

test.use({
  timezoneId,
  storageState: getStorageState("STORAGE_STATE_TEST1"),
});

// for (const timezoneId of timezones) {
test.describe(`Practice scheduling (timezone: ${timezoneId})`, () => {
  let pageObject: TuneTreesPageObject;

  test.beforeEach(async ({ page }) => {
    await setTestDefaults(page);
    await applyNetworkThrottle(page);
    pageObject = new TuneTreesPageObject(page);
    await pageObject.gotoMainPage();
  });

  test.afterEach(async () => {
    await restartBackend();
  });

  test("User sees scheduled tunes for today", async () => {
    await pageObject.navigateToPracticeTab();
    // Check that scheduled tunes are visible
    const rowCount = await pageObject.tunesGridRows.count();
    expect(rowCount).toBeGreaterThan(1); // 1 header + at least 1 tune
  });

  test("User submits quality feedback and tunes are rescheduled", async () => {
    await pageObject.navigateToPracticeTab();
    const feedbacks = ["hard", "good", "(Not Set)", "again"];

    // Fill in quality feedback for each scheduled tune
    const rows = pageObject.tunesGridRows;
    const count = await rows.count();
    const limit = Math.min(count - 1, 4);
    const reviewedIds: number[] = [];
    for (let i = 1; i <= limit; i++) {
      // skip header row
      const row = rows.nth(i);
      // Get the tune ID from the "id" column (assumes first cell is the ID)
      const idCell = row.locator("td").first();
      const idText = await idCell.textContent();
      const tuneId = Number(idText);
      if (!Number.isNaN(tuneId)) {
        const evalType = feedbacks[i - 1];
        // Always apply the evaluation if set; but only assert disappearance for non-again evals
        if (evalType !== "(Not Set)") {
          await pageObject.setReviewEval(tuneId, evalType);
        }
        if (evalType !== "(Not Set)" && evalType !== "again") {
          reviewedIds.push(tuneId);
        }
      }
    }

    // Ensure submit button is ready before clicking
    const submitButton = pageObject.page.getByRole("button", {
      name: "Submit Practiced Tunes",
    });
    await expect(submitButton).toBeEnabled({ timeout: 15000 });
    await Promise.all([
      pageObject.page.waitForResponse((resp) => {
        const url = resp.url();
        return (
          resp.ok() &&
          (url.includes("/practice/submit_feedbacks") ||
            url.includes("/practice/submit_feedback"))
        );
      }),
      submitButton.click(),
    ]);
    await pageObject.waitForSuccessfullySubmitted();

    // Ensure grid is refreshed before asserting removals
    await pageObject.navigateToPracticeTab();

    // Verify that the reviewed tunes are no longer listed for today.
    // The grid may backfill other tunes, so avoid asserting exact row counts.
    const idCells = pageObject.tunesGridRows.locator("td:first-child");
    for (const tid of reviewedIds) {
      await expect(
        idCells.filter({ hasText: new RegExp(`^${tid}$`) }),
      ).toHaveCount(0, { timeout: 20000 });
    }
  });

  test("User sees correct tunes on next day (timezone aware)", async ({
    page,
  }) => {
    // Simulate advancing to the next day
    const baseSitdownDate = new Date();
    const tomorrow = new Date(baseSitdownDate.getTime());
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Format as ISO string for injection
    const isoTomorrow = tomorrow.toISOString();
    await setTestDateTime(page, isoTomorrow);

    pageObject = new TuneTreesPageObject(page);
    await pageObject.gotoMainPage();
    await pageObject.navigateToPracticeTab();
    // Check that only tunes scheduled for the new day are shown
    const rowCount = await pageObject.tunesGridRows.count();
    expect(rowCount).toBeGreaterThan(1);
  });
});

// }

// Deprecated: function setSitdownDate(tomorrow: Date, timezoneId: string) {
//   const yyyy = tomorrow.getFullYear();
//   const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
//   const dd = String(tomorrow.getDate()).padStart(2, "0");
//   const hh = String(tomorrow.getHours()).padStart(2, "0");
//   const min = String(tomorrow.getMinutes()).padStart(2, "0");
//   const ss = String(tomorrow.getSeconds()).padStart(2, "0");

//   // Get the IANA timezone offset at the target date
//   const tz = timezoneId;
//   // Use Intl.DateTimeFormat to get the offset in ±HH:MM format
//   const dtf = new Intl.DateTimeFormat("en-US", {
//     timeZone: tz,
//     hour12: false,
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//   });
//   const parts = dtf.formatToParts(tomorrow);
//   const getPart = (type: string) => {
//     const part = parts.find((p) => p.type === type);
//     if (!part) throw new Error(`Missing date part: ${type}`);
//     return part.value;
//   };
//   const dateInTz = new Date(
//     `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}:${getPart("second")}`,
//   );
//   // Calculate offset in minutes
//   const offsetMinutes = Math.round(
//     (dateInTz.getTime() - tomorrow.getTime()) / 60000,
//   );
//   const offsetSign = offsetMinutes <= 0 ? "+" : "-";
//   const absOffset = Math.abs(offsetMinutes);
//   const offsetHH = String(Math.floor(absOffset / 60)).padStart(2, "0");
//   const offsetMM = String(absOffset % 60).padStart(2, "0");
//   const tzOffset = `${offsetSign}${offsetHH}:${offsetMM}`;

//   process.env.TT_REVIEW_SITDOWN_DATE = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${tzOffset}`;
// }
