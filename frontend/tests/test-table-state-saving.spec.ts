import { expect, test } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { setTestDefaults } from "@/test-scripts/set-test-defaults";
import { getStorageState } from "@/test-scripts/storage-state";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "@/test-scripts/test-logging";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";

interface INetworkRequest {
  url: string;
  method: string;
  timestamp: number;
}

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await page.waitForTimeout(1_000);
  await restartBackend();
  await page.waitForTimeout(1_000);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe("Table State Saving Test", () => {
  test("change the table state then switch tabs and back and make sure change is persisted", async ({
    page,
  }) => {
    // Navigate to a simple page first to test if server is accessible
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.gotoMainPage();

    // Check if main UI elements are available
    const mainContent = page.locator("body");
    await mainContent.waitFor({ state: "visible", timeout: 5000 });

    // Set up network monitoring to track API calls
    const tableStateRequests: INetworkRequest[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/settings/table_state")) {
        tableStateRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now(),
        });
      }
    });

    // Look for main tabs - if not found, skip the interactive test
    const mainTabs = page.getByTestId("tt-main-tabs");
    await expect(mainTabs).toBeAttached();
    await expect(mainTabs).toBeVisible();

    await ttPO.navigateToPracticeTabDirectly();

    // small wait to see if it helps in CI
    await page.waitForTimeout(1000);

    const practiceGridColumnsLocator = ttPO.tunesGridRows.nth(0).nth(0);

    const cellTitlesBeforeExpected: string = [
      "Id",
      "Bucket",
      "Evaluation",
      "Title",
      "Goal",
      "Type",
      "Structure",
      "Scheduled",
      "Practiced",
      "Stability",
      "Due",
      "Notes",
      "Deleted in Repertoire?",
    ].join("\n");

    const cellTitlesOriginal = await practiceGridColumnsLocator.innerText();
    console.log("Cell titles: (cellTitlesOriginal)", cellTitlesOriginal);
    expect(cellTitlesOriginal).toEqual(cellTitlesBeforeExpected);

    const columnsMenuButton = page.getByRole("button", { name: "Columns" });
    const menuColumnsBucket = page.getByRole("menuitemcheckbox", {
      name: "Bucket",
    });
    const menuColumnsNotes = page.getByRole("menuitemcheckbox", {
      name: "Notes",
    });
    const menuColumnsDue = page.getByRole("menuitemcheckbox", {
      name: "Due",
    });
    const menuColumnsDifficulty = page.getByRole("menuitemcheckbox", {
      name: "Difficulty",
    });

    // Monkey with columns to trigger table state saves
    await ttPO.clickWithTimeAfter(columnsMenuButton);
    await ttPO.clickWithTimeAfter(menuColumnsBucket, Number.NaN, 500);

    await ttPO.clickWithTimeAfter(columnsMenuButton);
    await expect(menuColumnsBucket).toBeChecked({ checked: false });
    await ttPO.clickWithTimeAfter(menuColumnsNotes, Number.NaN, 500);

    await ttPO.clickWithTimeAfter(columnsMenuButton);
    await expect(menuColumnsNotes).toBeChecked({ checked: false });
    await ttPO.clickWithTimeAfter(menuColumnsDue, Number.NaN, 500);

    await ttPO.clickWithTimeAfter(columnsMenuButton);
    await expect(menuColumnsDue).toBeChecked({ checked: false });
    await ttPO.clickWithTimeAfter(menuColumnsDifficulty, Number.NaN, 500);

    await ttPO.clickWithTimeAfter(columnsMenuButton);
    await expect(menuColumnsDifficulty).toBeChecked({ checked: true });
    await ttPO.clickWithTimeAfter(columnsMenuButton);

    // allow debounce/batching to flush table-state save requests
    await page.waitForTimeout(500);

    const cellTitlesAfterClicksExpected: string = [
      "Id",
      "Evaluation",
      "Title",
      "Goal",
      "Type",
      "Structure",
      "Scheduled",
      "Practiced",
      "Stability",
      "Difficulty",
      "Deleted in Repertoire?",
    ].join("\n");

    // get innerHTML of the first tunes grid row
    // const rowHtml: string = await ttPO.tunesGridRows.nth(0).innerHTML();
    // console.log("First tunes grid row innerHTML:", rowHtml);
    const cellTitlesAfterClicks = await practiceGridColumnsLocator.innerText();
    console.log("Cell titles (cellTitlesAfterClicks):", cellTitlesAfterClicks);
    expect(cellTitlesAfterClicks).toEqual(cellTitlesAfterClicksExpected);

    await ttPO.navigateToRepertoireTabDirectly();
    await page.waitForTimeout(500);

    await ttPO.navigateToPracticeTabDirectly();
    await page.waitForTimeout(500);

    const cellTitlesAfterTabSwitch =
      await practiceGridColumnsLocator.innerText();
    console.log(
      "Cell titles after tab switch (cellTitlesAfterTabSwitch):",
      cellTitlesAfterTabSwitch,
    );

    expect(cellTitlesAfterTabSwitch).toEqual(cellTitlesAfterClicksExpected);

    // Wait for any batched requests
    await page.waitForTimeout(3000);

    // Check the API call pattern - with caching, should be fewer calls
    console.log(`Table state API calls made: ${tableStateRequests.length}`);
  });
});
