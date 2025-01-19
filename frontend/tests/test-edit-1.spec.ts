import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneEditorPageObject } from "@/test-scripts/tune-editor.po";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  // trace: "on",
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

async function doEditAndButtonClick(
  ttPO: TuneEditorPageObject,
  formFieldTestId: string,
  buttonName: string,
  originalText: string,
  modifiedText: string,
  expectedText: string | null = null,
) {
  const formFieldTextBox = await ttPO.navigateToFormField(formFieldTestId);
  await expect(formFieldTextBox).toHaveValue(originalText, {
    timeout: 5000,
  });
  await formFieldTextBox.fill(modifiedText);

  await ttPO.pressButton(buttonName);

  // Wait for the response to the POST request, which will hopefully
  // be the first response after the Save button is clicked?
  const tuneTitle2 = await ttPO.currentTuneTitle.textContent();
  console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
  const expectedText2 = expectedText ?? modifiedText;
  await expect(ttPO.currentTuneTitle).toHaveText(expectedText2, {
    timeout: 5_000 * 100,
  });
}

// async function navigateToTune(page: Page, tuneTitle: string) {
//   await checkHealth();

//   console.log("===> test-edit-1.ts:88 ~ creating new page for tunetrees");

//   await page.goto("https://localhost:3000", {
//     timeout: initialPageLoadTimeout,
//     waitUntil: "networkidle",
//   });

//   await page.waitForSelector("body");
//   const ttMainTabGroup = page.getByTestId("tt-main-tabs");
//   await ttMainTabGroup.waitFor({ state: "visible" });

//   const repertoireTabSelector = 'role=tab[name="Repertoire"]';
//   console.log(
//     "===> test-edit-1.ts:106 ~ waiting for selector, tabSelector: ",
//     repertoireTabSelector,
//   );
//   const repertoireTab = await page.waitForSelector(repertoireTabSelector, {
//     state: "visible",
//   });
//   await repertoireTab.click();

//   await page.waitForSelector("#current-tune-title", { state: "visible" });
//   await page.getByRole("tab", { name: "Repertoire" }).click();
//   await page.getByPlaceholder("Filter").click();

//   await page.getByPlaceholder("Filter").fill(tuneTitle);
//   await page.getByRole("row", { name: tuneTitle }).click();

//   const currentTuneTitleLocator = page.locator("#current-tune-title");
//   const tuneTitle2 = await currentTuneTitleLocator.textContent();
//   console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
//   await expect(currentTuneTitleLocator).toHaveText(tuneTitle, {
//     timeout: 5000,
//   });
// }

test.describe.serial("Tune Edit Tests", () => {
  test("test-edit-1", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);

    await ttPO.navigateToTune("Lakes of Sligo");

    // ========== First do a title edit, then Cancel ==============
    await ttPO.openTuneEditorForCurrentTune();
    await doEditAndButtonClick(
      ttPO,
      "tt-tune-editor-title",
      "Cancel",
      "Lakes of Sligo",
      "Lakes of Sligo x",
      "Lakes of Sligo",
    );

    // ========== Now do a title edit, then Save ==============
    await ttPO.openTuneEditorForCurrentTune();
    await doEditAndButtonClick(
      ttPO,
      "tt-tune-editor-title",
      "Save",
      "Lakes of Sligo",
      "Lakes of Sligo x",
    );
    await ttPO.addToReviewButton.waitFor({ state: "visible" });
    await ttPO.filterInput.fill("Lakes of Sligo x");
    await expect(ttPO.tunesGridRows).toHaveCount(2); // 1 for the header, 1 for the tune
    expect(page.getByRole("row", { name: "Lakes of Sligo x" }).isVisible());
    // I get a 500 error here without the wait when it's doing a get on table state.  Not good.
    // would a waitForResponse be better?
    await page.waitForTimeout(100);
    console.log("===> test-edit-1.ts:158 ~ exit test-edit-1");
  });

  test("test-edit-2", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);

    await ttPO.navigateToTune("Boyne Hunt");

    await ttPO.openTuneEditorForCurrentTune();

    await page.pause();

    // await page.waitForTimeout(60_000 * 20);

    // // ========== First do a title edit, then Cancel ==============
    // await doEditAndButtonClick(
    //   page,
    //   "tt-tune-editor-title",
    //   "Cancel",
    //   "Lakes of Sligo",
    //   "Lakes of Sligo x",
    //   "Lakes of Sligo",
    // );

    // // ========== Now do a title edit, then Save ==============
    // await doEditAndButtonClick(
    //   page,
    //   "tt-tune-editor-title",
    //   "Save",
    //   "Lakes of Sligo",
    //   "Lakes of Sligo x",
    // );

    await ttPO.pressCancel();

    await page.waitForTimeout(100);
    console.log("===> test-edit-1.spec.ts:182 ~ ");
  });
});
