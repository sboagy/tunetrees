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
  const formFieldTextBox = await ttPO.navigateToFormFieldById(formFieldTestId);
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

    // Confirm that the values are as expected
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      console.log(`${formField.label}: ${await sampleLocator.inputValue()}`);
      await expect(sampleLocator).toHaveValue(formField.original);
    }

    // Fill in new values
    for (const formField of ttPO.sampleBoyneHunt) {
      await formField.locator.fill(formField.modification);
      await page.waitForTimeout(50);
    }

    // Confirm all the fields were changed
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      await expect(sampleLocator).toHaveValue(formField.modification);
    }

    await ttPO.pressCancel();

    await ttPO.navigateToTune("Boyne Hunt");

    // Do some light checking in the grid (not a full test)
    for (const formField of ttPO.sampleBoyneHunt) {
      const cellId = formField.cellId;
      if (!cellId) {
        continue;
      }
      const cellLocator = page.getByTestId(`${cellId}`);
      const cellText = await cellLocator.textContent();
      console.log("===> test-edit-1.spec.ts:165 ~ cellText", cellText);
      await expect(cellLocator).toHaveText(formField.original);
    }

    await ttPO.openTuneEditorForCurrentTune();

    // Full check that the values haven't been changed
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      console.log(`${formField.label}: ${await sampleLocator.inputValue()}`);
      await expect(sampleLocator).toHaveValue(formField.original);
    }

    await page.waitForTimeout(100);
    console.log("===> test-edit-1.spec.ts:182 ~ ");
  });

  test("test-edit-3", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);

    await ttPO.navigateToTune("Boyne Hunt");

    await ttPO.openTuneEditorForCurrentTune();

    // Confirm that the values are as expected
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      console.log(`${formField.label}: ${await sampleLocator.inputValue()}`);
      await expect(sampleLocator).toHaveValue(formField.original);
    }

    // Fill in new values
    for (const formField of ttPO.sampleBoyneHunt) {
      await formField.locator.fill(formField.modification);
      await page.waitForTimeout(50);
    }

    // Confirm all the fields were changed
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      await expect(sampleLocator).toHaveValue(formField.modification);
    }

    await ttPO.pressSave();

    await ttPO.navigateToTune("Boyne Hunt");

    // Do some light checking in the grid (not a full test)
    for (const formField of ttPO.sampleBoyneHunt) {
      const cellId = formField.cellId;
      if (!cellId) {
        continue;
      }
      const cellLocator = page.getByTestId(`${cellId}`);
      const cellText = await cellLocator.textContent();
      console.log("===> test-edit-1.spec.ts:165 ~ cellText", cellText);
      await expect(cellLocator).toHaveText(formField.modification);
    }

    await ttPO.openTuneEditorForCurrentTune();

    // Full check that the values haven't been changed
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      console.log(`${formField.label}: ${await sampleLocator.inputValue()}`);
      await expect(sampleLocator).toHaveValue(formField.modification);
    }

    await page.waitForTimeout(100);
    console.log("===> test-edit-1.spec.ts:182 ~ ");
  });
});
