import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { screenShotDir } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { type Page, expect, test } from "@playwright/test";
import path from "node:path";
import {
  logTestStart,
  logTestEnd,
  logBrowserContextStart,
  logBrowserContextEnd,
} from "../test-scripts/test-logging";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  // trace: "on",
  // actionTimeout: 4000,
});

// testInfo.project.name,

import { setTestDefaults } from "../test-scripts/set-test-defaults";

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  await setTestDefaults(page);
  await applyNetworkThrottle(page, 0);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

async function checkForCellId(page: Page, cellId: number) {
  const idCell = page.getByRole("cell", { name: `${cellId}` });
  const value = await idCell.textContent({ timeout: 6000 });
  console.log("===> test-practice-1.ts:37 ~ value", value);

  await expect(idCell).toHaveText(`${cellId}`);
}

test.describe.serial("Practice Tests", () => {
  test("Test for the predicted number of rows in the Practice tab", async ({
    page,
  }) => {
    const ttPO = new TuneTreesPageObject(page);

    await ttPO.navigateToPracticeTab();

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

  test("Basic set review evaluations, submit, and check new row count", async ({
    page,
  }) => {
    const ttPO = new TuneTreesPageObject(page);

    await ttPO.navigateToPracticeTab();

    const rowCountBefore = await ttPO.tunesGridRows.count();
    console.log(`Number of rows before submit: ${rowCountBefore}`);

    console.log("===> test-practice-1.ts:77 ~ ");
    await ttPO.setReviewEval(1081, "hard");

    await ttPO.setReviewEval(2451, "good");
    await ttPO.setReviewEval(2451, "(Not Set)");

    await ttPO.setReviewEval(1684, "again");

    const submitButton = page.getByRole("button", {
      name: "Submit Practiced Tunes",
    });
    await submitButton.waitFor({ state: "visible" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled({ timeout: 60 * 1000 });

    await page.screenshot({
      path: path.join(screenShotDir, "practice_just_before_submitted.png"),
    });
    await ttPO.clickWithTimeAfter(submitButton, 1000);
    await page.screenshot({
      path: path.join(screenShotDir, "practice_just_after_submitted.png"),
    });
    await ttPO.waitForSuccessfullySubmitted();
    // page.on("response", (data) => {
    //   console.log("===> test-practice-1.ts:108 ~ data", data);
    // });

    const rowCount = await ttPO.tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    // Make a very long timeout to allow for the server to respond.
    await expect(ttPO.tunesGridRows).toHaveCount(3, { timeout: 60000 });

    await checkForCellId(page, 1820);
    await checkForCellId(page, 2451);
  });

  test("Check that server/database is restored after submit test", async ({
    page,
  }) => {
    /**
     * This just repeats the first test to ensure that the server was restarted properly,
     * and that the test can run multiple times without issue.
     **/
    const ttPO = new TuneTreesPageObject(page);

    await ttPO.navigateToPracticeTab();

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
