import { checkHealth } from "@/test-scripts/check-servers";
import { initialPageLoadTimeout } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
});

test("test-practice-1.ts", async ({ page }) => {
  /**
   * Perform the following actions:
   * - Checks the health of necessary servers.
   * - Uses TT_REVIEW_SITDOWN_DATE env var as a reference date.
   * - Navigates to the Practice tab within the application.
   * - Validates specific cell IDs to ensure data integrity.
   * - Verifies the number of rows in the tunes grid.
   * - Logs significant steps and outcomes throughout the test execution.
   **/
  await checkHealth();

  async function checkForCellId(cellId: number) {
    const idCell = page.getByRole("cell", { name: `${cellId}` });
    const value = await idCell.textContent({ timeout: 100 });
    console.log("===> test-practice-1.ts:37 ~ value", value);

    await expect(idCell).toHaveText(`${cellId}`);
  }

  console.log("===> test-edit-1.ts:88 ~ creating new page for tunetrees");

  await page.goto("https://localhost:3000", {
    timeout: initialPageLoadTimeout,
  });

  await page.waitForSelector("body");

  const tabSelector = 'role=tab[name="Practice"]';
  console.log(
    "===> test-edit-1.ts:106 ~ waiting for selector, tabSelector: ",
    tabSelector,
  );
  const practiceTab = await page.waitForSelector(tabSelector, {
    state: "visible",
  });
  await page.waitForTimeout(1000);
  await practiceTab.click();

  const ttReviewSitdownDate = process.env.TT_REVIEW_SITDOWN_DATE;
  console.log(
    `===> test-practice-1.ts:106 ~ check practice tunes for ${ttReviewSitdownDate}`,
  );

  await checkForCellId(1081);
  await checkForCellId(1820);
  await checkForCellId(2451);
  await checkForCellId(1684);

  const tunesGrid = page.getByTestId("tunes-grid");
  const tunesGridRows = tunesGrid.locator("tr");
  const rowCount = await tunesGridRows.count();
  console.log(`Number of rows: ${rowCount}`);
  await expect(tunesGridRows).toHaveCount(5);

  console.log("===> test-practice-1.ts:45 ~ ", "test complete!");
});
