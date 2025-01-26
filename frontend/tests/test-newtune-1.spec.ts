import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneEditorPageObject } from "@/test-scripts/tune-editor.po";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  // trace: "on",
  // actionTimeout: 10_000,
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  // await page.waitForTimeout(1);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
});

test("test-newtune-1", async ({ page }) => {
  const ttPO = new TuneEditorPageObject(page);
  await ttPO.gotoMainPage();

  await ttPO.navigateToRepertoireTab();

  // await page.waitForTimeout(1000 * 200);

  await ttPO.tabsMenuButton.click();
  await ttPO.tabsMenuCatalogChoice.click();
  await expect(ttPO.catalogTab).toBeVisible();
  await ttPO.catalogTab.click();

  // await page.waitForTimeout(60_000 * 60);

  await expect(ttPO.addToRepertoireButton).toBeVisible();
  await ttPO.newTuneButton.click();

  // await page.getByTestId("tt-tune-editor-title-input").click();

  // Note this is testing the accented characters in the title bug as well.
  // See https://github.com/axios/axios/issues/6761
  for (const formField of ttPO.sampleSiBheagSiMhorShort) {
    await formField.locator.fill(formField.modification);
    await page.waitForTimeout(50);
  }

  await ttPO.pressSave();

  await ttPO.waitForTablePopulationToStart();

  const tuneTitle = ttPO.sampleSiBheagSiMhorShort[0].modification;

  await ttPO.navigateToTune(tuneTitle);

  const currentTuneTitleLocator = page.locator("#current-tune-title");
  const tuneTitle2 = await currentTuneTitleLocator.textContent();
  console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
  const expectedText2 = tuneTitle;
  await expect(currentTuneTitleLocator).toHaveText(expectedText2);

  // await page.waitForTimeout(60_000 * 60);
});
