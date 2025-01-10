import { checkHealth } from "@/test-scripts/check-servers";
import { restartBackend } from "@/test-scripts/global-setup";
import {
  initialPageLoadTimeout,
  videoDir,
} from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { type Page, expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  video: "on",
  // launchOptions: {
  //   slowMo: 2000,
  // },
  contextOptions: {
    recordVideo: {
      dir: videoDir, // Directory to save the videos
      size: { width: 1280, height: 720 }, // Optional: specify video size
    },
  },
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
  await page.waitForTimeout(1000);
  await practiceTab.click();

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

  await page
    .getByRole("row", { name: "1081 Recall Quality... Lakes" })
    .getByRole("button")
    .click();
  await page.getByText("3: correct response recalled").click();
  await page
    .getByRole("row", { name: "2451 Recall Quality... Church" })
    .getByRole("button")
    .click();
  await page.getByText("4: correct response after a").click();
  await page
    .getByRole("button", { name: "4: correct response after a" })
    .click();
  await page.getByRole("option", { name: "(Not Set)" }).click();
  await page
    .getByRole("row", { name: "1684 Recall Quality... Road" })
    .getByRole("button")
    .click();
  await page.getByText("1: incorrect response; the").click();
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

  await submitButton.click();
  await page.waitForTimeout(1000);

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
