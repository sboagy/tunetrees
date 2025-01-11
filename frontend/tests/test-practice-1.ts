import { checkHealth } from "@/test-scripts/check-servers";
import { restartBackend } from "@/test-scripts/global-setup";
import { initialPageLoadTimeout } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { type Locator, type Page, expect, test } from "@playwright/test";

test.describe.serial("Practice Tests", () => {
  test.use({
    storageState: getStorageState("STORAGE_STATE_TEST1"),
    // actionTimeout: 4000,
  });

  // testInfo.project.name,

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(({ page }, testInfo) => {
    console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
    // doConsolelogs(page, testInfo);
  });

  test.afterEach(async ({ page }) => {
    // After each test is run in this set, restore the backend to its original state.
    await restartBackend();
    await page.waitForTimeout(100);
  });

  async function clickWithTimeAfter(
    page: Page,
    locator: Locator,
    timeout = 500,
  ) {
    // await locator.click({ trial: true });
    await locator.click();
    await page.waitForTimeout(timeout);
  }

  async function navigateToPracticeTab(page: Page) {
    await checkHealth();

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
    await page.waitForTimeout(500);
    await practiceTab.click();
    await page.waitForTimeout(1000);

    const ttReviewSitdownDate = process.env.TT_REVIEW_SITDOWN_DATE;
    console.log(
      `===> test-practice-1.ts:106 ~ check practice tunes for ${ttReviewSitdownDate}`,
    );
  }

  async function checkForCellId(page: Page, cellId: number) {
    const idCell = page.getByRole("cell", { name: `${cellId}` });
    const value = await idCell.textContent({ timeout: 2000 });
    console.log("===> test-practice-1.ts:37 ~ value", value);

    await expect(idCell).toHaveText(`${cellId}`);
  }

  test("test-practice-1-1", async ({ page }) => {
    /**
     * Perform the following actions:
     * - Checks the health of necessary servers.
     * - Uses TT_REVIEW_SITDOWN_DATE env var as a reference date.
     * - Navigates to the Practice tab within the application.
     * - Validates specific cell IDs to ensure data integrity.
     * - Verifies the number of rows in the tunes grid.
     * - Logs significant steps and outcomes throughout the test execution.
     **/
    await navigateToPracticeTab(page);

    await checkForCellId(page, 1081);
    await checkForCellId(page, 1820);
    await checkForCellId(page, 2451);
    await checkForCellId(page, 1684);

    const tunesGrid = page.getByTestId("tunes-grid");
    const tunesGridRows = tunesGrid.locator("tr");
    const rowCount = await tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    await expect(tunesGridRows).toHaveCount(5);

    console.log("===> test-practice-1.ts:45 ~ ", "test complete!");
  });

  test("test-practice-1-2", async ({ page }) => {
    await navigateToPracticeTab(page);

    console.log("===> test-practice-1.ts:77 ~ ");

    const lakesRecallQualityButton = page
      .getByRole("row", { name: "1081 Recall Quality... Lakes" })
      .getByRole("button");
    await clickWithTimeAfter(page, lakesRecallQualityButton);
    const responseRecalledButton = page.getByText(
      "3: correct response recalled",
    );
    await clickWithTimeAfter(page, responseRecalledButton);

    const churchRecallQualityButton = page
      .getByRole("row", { name: "2451 Recall Quality... Church" })
      .getByRole("button");
    await clickWithTimeAfter(page, churchRecallQualityButton);
    const responseAfterAButton = page.getByText("4: correct response after a");
    await clickWithTimeAfter(page, responseAfterAButton);

    const responseAfterAButtonElement = page.getByRole("button", {
      name: "4: correct response after a",
    });
    await clickWithTimeAfter(page, responseAfterAButtonElement);
    const notSetOption = page.getByRole("option", { name: "(Not Set)" });
    await clickWithTimeAfter(page, notSetOption);

    const roadRecallQualityButton = page
      .getByRole("row", { name: "1684 Recall Quality... Road" })
      .getByRole("button");
    await clickWithTimeAfter(page, roadRecallQualityButton);
    const incorrectResponseButton = page.getByText(
      "1: incorrect response; the",
    );
    await clickWithTimeAfter(page, incorrectResponseButton);

    const submitButton = page.getByRole("button", {
      name: "Submit Practiced Tunes",
    });
    await page.waitForFunction(
      (button) => {
        const btn = button as HTMLButtonElement;
        return !btn.disabled;
      },
      await submitButton.elementHandle(),
      { timeout: 2000 },
    );

    await clickWithTimeAfter(page, submitButton, 1000);

    const tunesGrid = page.getByTestId("tunes-grid");
    const tunesGridRows = tunesGrid.locator("tr");
    const rowCount = await tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    await expect(tunesGridRows).toHaveCount(3);

    await checkForCellId(page, 1820);
    await checkForCellId(page, 2451);
  });

  test("test-practice-1-3", async ({ page }) => {
    /**
     * This just repeats the first test to ensure that the server was restarted properly,
     * and that the test can run multiple times without issue.
     **/
    await navigateToPracticeTab(page);

    await checkForCellId(page, 1081);
    await checkForCellId(page, 1820);
    await checkForCellId(page, 2451);
    await checkForCellId(page, 1684);

    const tunesGrid = page.getByTestId("tunes-grid");
    const tunesGridRows = tunesGrid.locator("tr");
    const rowCount = await tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    await expect(tunesGridRows).toHaveCount(5);

    console.log("===> test-practice-1.ts:45 ~ ", "test complete!");
  });
});
