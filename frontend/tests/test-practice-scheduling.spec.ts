import { test, expect } from "@playwright/test";
import { TuneTreesPageObject } from "../test-scripts/tunetrees.po";
import { restartBackend } from "@/test-scripts/global-setup";
import { getStorageState } from "@/test-scripts/storage-state";

// Parameterize timezones for future expansion
const timezones = ["Asia/Karachi"]; // UTC+5, add more as needed

for (const timezoneId of timezones) {
  test.describe(`Practice scheduling (timezone: ${timezoneId})`, () => {
    test.use({
      timezoneId,
      storageState: getStorageState("STORAGE_STATE_TEST1"),
    });

    let pageObject: TuneTreesPageObject;

    test.beforeEach(async ({ page }) => {
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
      const feedbacks = ["struggled", "trivial", "(Not Set)", "failed"];

      // Fill in quality feedback for each scheduled tune
      const rows = pageObject.tunesGridRows;
      const count = await rows.count();
      for (let i = 1; i < count; i++) {
        // skip header row
        const row = rows.nth(i);
        // Get the tune ID from the "id" column (assumes first cell is the ID)
        const idCell = row.locator("td").first();
        const idText = await idCell.textContent();
        const tuneId = Number(idText);
        await pageObject.setReviewEval(tuneId, feedbacks[i - 1]);
      }

      // await pageObject.submitPracticedTunesButton.click();
      const submitButton = pageObject.page.getByRole("button", {
        name: "Submit Practiced Tunes",
      });
      await pageObject.clickWithTimeAfter(submitButton, 1000);

      // Make a very long timeout to allow for the server to respond.
      await expect(pageObject.toast.last()).toContainText(
        "Practice successfully submitted",
        { timeout: 60000 },
      );

      const rowCount = await pageObject.tunesGridRows.count();
      console.log(`Number of rows: ${rowCount}`);
      await expect(pageObject.tunesGridRows).toHaveCount(2, { timeout: 60000 });
    });

    test("User sees correct tunes on next day (timezone aware)", async ({
      page,
    }) => {
      // Simulate advancing to the next day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await page.addInitScript(`{
        Date = class extends Date {
          constructor(...args) {
            if (args.length === 0) return super(${tomorrow.getTime()});
            return super(...args);
          }
        }
      }`);
      pageObject = new TuneTreesPageObject(page);
      await pageObject.gotoMainPage();
      await pageObject.navigateToPracticeTab();
      // Check that only tunes scheduled for the new day are shown
      const rowCount = await pageObject.tunesGridRows.count();
      expect(rowCount).toBeGreaterThan(1);
    });
  });
}
