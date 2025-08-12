import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { screenShotDir } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { expect, test } from "@playwright/test";
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

// helper removed; tests assert dynamically now

test.describe.serial("Practice Tests", () => {
  test("Practice tab renders rows", async ({ page }) => {
    const ttPO = new TuneTreesPageObject(page);

    await ttPO.navigateToPracticeTab();

    const tunesGrid = page.getByTestId("tunes-grid");
    const tunesGridRows = tunesGrid.locator("tr");
    const rowCount = await tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(1);

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
    // Fill evals for first up to 3 data rows
    const maxRows = Math.min(rowCountBefore - 1, 3);
    const evals = ["hard", "(Not Set)", "again"] as const;
    for (let i = 0; i < maxRows; i++) {
      const row = ttPO.tunesGridRows.nth(i + 1); // skip header
      const idText = await row.locator("td").first().textContent();
      const tuneId = Number(idText);
      await ttPO.setReviewEval(tuneId, evals[i]);
    }

    // Wait for evaluations to be processed
    await page.waitForTimeout(1000);

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

    const totalRowCount = await ttPO.tunesGridRows.count();
    console.log(`Number of rows after submit: ${totalRowCount}`);
    // Expect the count to decrease after submission
    expect(totalRowCount).toBeLessThan(rowCountBefore);
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

    const tunesGrid = page.getByTestId("tunes-grid");
    const tunesGridRows = tunesGrid.locator("tr");
    const rowCount = await tunesGridRows.count();
    console.log(`Number of rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(1);

    console.log("===> test-practice-1.ts:45 ~ ", "test complete!");
  });
});
