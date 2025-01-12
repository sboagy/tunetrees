import { restartBackend } from "@/test-scripts/global-setup";
import { navigateToPracticeTab } from "@/test-scripts/navigate-tabs";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { screenShotDir } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { type Locator, type Page, expect, test } from "@playwright/test";
import path from "node:path";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  // trace: "on",
  // actionTimeout: 4000,
});

// testInfo.project.name,

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  await applyNetworkThrottle(page, 0);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
});

async function clickWithTimeAfter(
  page: Page,
  locator: Locator,
  timeout = 9000,
) {
  await locator.waitFor({ state: "attached", timeout: timeout });
  await locator.waitFor({ state: "visible", timeout: timeout });
  await expect(locator).toBeAttached({ timeout: timeout });
  await expect(locator).toBeVisible({ timeout: timeout });
  await expect(locator).toBeEnabled({ timeout: timeout });
  // await locator.click({ trial: true });
  await locator.click({ timeout: timeout });
}

async function checkForCellId(page: Page, cellId: number) {
  const idCell = page.getByRole("cell", { name: `${cellId}` });
  const value = await idCell.textContent({ timeout: 6000 });
  console.log("===> test-practice-1.ts:37 ~ value", value);

  await expect(idCell).toHaveText(`${cellId}`);
}

async function setReviewEval(page: Page, tuneId: number, evalType: string) {
  const qualityButton = page
    .getByRole("row", { name: `${tuneId} ` })
    .getByTestId("tt-recal-eval-popover-trigger");
  await expect(qualityButton).toBeVisible({ timeout: 60000 });
  await expect(qualityButton).toBeEnabled({ timeout: 60000 });
  await clickWithTimeAfter(page, qualityButton);
  await page
    .getByTestId("tt-recal-eval-group-menu")
    .waitFor({ state: "visible", timeout: 60000 });
  const responseRecalledButton = page.getByTestId(`tt-recal-eval-${evalType}`);
  await expect(responseRecalledButton).toBeVisible({ timeout: 60000 });
  await expect(responseRecalledButton).toBeEnabled({ timeout: 60000 });
  await clickWithTimeAfter(page, responseRecalledButton);
  await page
    .getByTestId("tt-recal-eval-popover-content")
    .waitFor({ state: "detached", timeout: 60000 });
}

test.describe.serial("Practice Tests", () => {
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
    await setReviewEval(page, 1081, "struggled");

    await setReviewEval(page, 2451, "trivial");
    await setReviewEval(page, 2451, "(Not Set)");

    await setReviewEval(page, 1684, "failed");

    const submitButton = page.getByRole("button", {
      name: "Submit Practiced Tunes",
    });
    await submitButton.waitFor({ state: "visible" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled({ timeout: 60 * 1000 });

    await page.screenshot({
      path: path.join(screenShotDir, "practice_just_before_submitted.png"),
    });
    await clickWithTimeAfter(page, submitButton, 1000);
    await page.screenshot({
      path: path.join(screenShotDir, "practice_just_after_submitted.png"),
    });
    page.on("response", (data) => {
      console.log("===> test-practice-1.ts:108 ~ data", data);
    });
    const tunesGrid = page.getByTestId("tunes-grid");
    const tunesGridRows = tunesGrid.locator("tr");
    const rowCount = await tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    // Make a very long timeout to allow for the server to respond.
    await expect(tunesGridRows).toHaveCount(3, { timeout: 60000 });

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
