import { expect, test } from "@playwright/test";
import { checkHealth } from "@/test-scripts/check-servers";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneEditorPageObject } from "@/test-scripts/tune-editor.po";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "../test-scripts/test-logging";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  // trace: "on",
  // actionTimeout: 10_000,
  viewport: { width: 1728 - 50, height: 1117 - 200 },
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
  await checkHealth();
});

test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(1_000);
  await checkHealth();
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test.describe.serial("Add Tune Tests", () => {
  test("test-newtune-1", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);

    await ttPO.gotoMainPage();

    // await page.waitForTimeout(1000 * 200);
    await ttPO.clickWithTimeAfter(ttPO.tabsMenuButton);
    await ttPO.clickWithTimeAfter(ttPO.tabsMenuCatalogChoice);
    await expect(ttPO.catalogTab).toBeVisible();
    await ttPO.clickWithTimeAfter(ttPO.catalogTab);

    // await for the tab to be change
    await expect(ttPO.addToRepertoireButton).toBeAttached();
    await expect(ttPO.addToRepertoireButton).toBeVisible();

    await ttPO.clickWithTimeAfter(ttPO.addTuneButton);

    await ttPO.page.getByText("Select Genre:").isVisible();

    await ttPO.clickWithTimeAfter(ttPO.newTuneButton);

    // await page.getByTestId("tt-tune-editor-title-input").click();

    // Note this is testing the accented characters in the title bug as well.
    // See https://github.com/axios/axios/issues/6761
    for (const formField of ttPO.sampleSiBheagSiMhorShort) {
      await ttPO.doFormFieldValueMod(formField);
      const value = await formField.locator.inputValue();
      if (formField.select_modification) {
        expect(value.toLowerCase()).toBe(formField.modification.toLowerCase());
      } else {
        expect(value).toBe(formField.modification);
      }
      // await formField.locator.fill(formField.modification);
      await page.waitForTimeout(50);
    }

    await ttPO.pressSave();

    await ttPO.waitForTablePopulationToStart();

    const tuneTitle = ttPO.sampleSiBheagSiMhorShort[ttPO.iffTitle].modification;

    await ttPO.tableStatus.waitFor({ state: "visible" });
    await expect(ttPO.tableStatus).toContainText("0 of 489");
    await page.waitForTimeout(2000);

    await ttPO.navigateToTune(tuneTitle);

    const currentTuneTitleLocator = page.locator("#current-tune-title");
    const tuneTitle2 = await currentTuneTitleLocator.textContent();
    console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
    const expectedText2 = tuneTitle;
    await expect(currentTuneTitleLocator).toHaveText(expectedText2);

    await page.waitForTimeout(2_000);
    // await page.waitForTimeout(60_000 * 60);
  });

  test("test-import-1", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);

    await ttPO.gotoMainPage();

    await ttPO.clickWithTimeAfter(ttPO.addTuneButton);

    await ttPO.addtuneUrlOrTitleInput.fill("https://thesession.org/tunes/248"); // Tam Lin

    await ttPO.clickWithTimeAfter(ttPO.addtuneButtonImport);

    const selectSettingHeading = page.getByRole("heading", {
      name: "Select a Setting",
    });
    await selectSettingHeading.waitFor({ state: "visible" });

    // const setting2Locator = page.getByRole("radio", { name: "Setting 2" });
    // const setting2Locator = page.getByText("Setting 2");
    const setting2Locator = page.getByText("Setting 2", { exact: true });

    await ttPO.clickWithTimeAfter(setting2Locator);

    await ttPO.clickWithTimeAfter(ttPO.selectSettingButton);

    await ttPO.clickWithTimeAfter(ttPO.tuneEditorSubmitButton);

    const currentTuneTitleLocator = page.locator("#current-tune-title");
    await currentTuneTitleLocator.waitFor({ state: "visible" });

    const tuneTitle2 = await currentTuneTitleLocator.textContent();
    console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
    const expectedText2 = "Tam Lin";
    await expect(currentTuneTitleLocator).toHaveText(expectedText2);

    // await ttPO.newTuneButton.waitFor({ state: "visible" });
    // await ttPO.newTuneButton.isEnabled();
    // await ttPO.newTuneButton.click();

    await page.waitForTimeout(2_000);
  });
});
