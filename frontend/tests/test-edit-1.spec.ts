import { checkHealth } from "@/test-scripts/check-servers";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "@/test-scripts/test-logging";
import { TuneEditorPageObject } from "@/test-scripts/tune-editor.po";
import { expect, test } from "@playwright/test";

// Allow extra time for this suite under full-run concurrency and Next.js dev retries
test.setTimeout(process.env.CI ? 120_000 : 75_000);

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  // trace: "on",
});

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
  await page.waitForLoadState("domcontentloaded");
  await checkHealth();
  await page.waitForTimeout(500);
});

test.afterEach(async ({ page }, testInfo) => {
  // await page.waitForTimeout(500);
  await page.waitForLoadState("domcontentloaded");
  await restartBackend();
  await checkHealth();
  logBrowserContextEnd();
  logTestEnd(testInfo);
  await page.waitForTimeout(500);
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
  await expect(formFieldTextBox).toHaveValue(originalText);
  await ttPO.page.waitForTimeout(500);
  await formFieldTextBox.fill(modifiedText);
  await ttPO.page.waitForTimeout(500);
  await formFieldTextBox.press("Tab");
  await ttPO.page.waitForTimeout(500);
  await expect(formFieldTextBox).toHaveValue(modifiedText);

  // Click the button and, if saving, wait for the editor modal to close (submit button detached)
  await Promise.all([
    ttPO.pressButton(buttonName),
    buttonName === "Save"
      ? ttPO.tuneEditorSubmitButton.waitFor({
          state: "detached",
          timeout: 15000,
        })
      : Promise.resolve(),
  ]);

  // Now assert the current title reflects the change (or expected text)
  const expectedText2 = expectedText ?? modifiedText;
  await expect(ttPO.currentTuneTitle).toHaveText(expectedText2, {
    timeout: 30000,
  });
}

test.describe.serial("Tune Edit Tests", () => {
  test("test-edit-1", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await ttPO.page.waitForTimeout(1000);

    await ttPO.navigateToTune("Lakes of Sligo");

    // ========== First do a title edit, then Cancel ==============
    await ttPO.openTuneEditorForCurrentTune();

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1_000);

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
    await ttPO.navigateToTune("Lakes of Sligo x");
    // await ttPO.filterInput.fill("Lakes of Sligo x");
    await expect(ttPO.tunesGridRows).toHaveCount(2); // 1 for the header, 1 for the tune
    expect(page.getByRole("row", { name: "Lakes of Sligo x" }).isVisible());

    console.log("===> test-edit-1.ts:158 ~ exit test-edit-1");
  });

  test("test-edit-2", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await ttPO.page.waitForTimeout(1000);

    await ttPO.navigateToTune("Boyne Hunt");

    await ttPO.openTuneEditorForCurrentTune();

    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1_000);

    const typeValue = await ttPO.ffType.textContent();
    console.log("===> test-edit-1.spec.ts:99 ~ ", typeValue);
    const inputValue = await ttPO.ffType.locator("select").inputValue();
    console.log("===> test-edit-1.spec.ts:101 ~ ", inputValue);

    // Confirm that the values are as expected
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      console.log(`${formField.label}: ${await sampleLocator.inputValue()}`);
      await expect(sampleLocator).toHaveValue(formField.original);
    }

    // Fill in new values
    for (const formField of ttPO.sampleBoyneHunt) {
      await ttPO.doFormFieldValueMod(formField);

      // await formField.locator.fill(formField.modification);
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
    await page.waitForTimeout(1000);

    console.log("===> test-edit-1.spec.ts:182 ~ ");
  });

  test("test-edit-3", async ({ page }) => {
    const ttPO = new TuneEditorPageObject(page);
    await ttPO.gotoMainPage();
    await ttPO.page.waitForTimeout(1000);

    await ttPO.navigateToTune("Boyne Hunt");

    await ttPO.openTuneEditorForCurrentTune();

    for (const formField of ttPO.sampleBoyneHunt) {
      await expect(formField.locator).toBeVisible();
    }

    // Confirm that the values are as expected
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      console.log(`${formField.label}: ${await sampleLocator.inputValue()}`);
      await expect(sampleLocator).toHaveValue(formField.original);
    }

    // Fill in new values
    for (const formField of ttPO.sampleBoyneHunt) {
      // await formField.locator.fill(formField.modification);
      await ttPO.doFormFieldValueMod(formField);
      await page.waitForTimeout(100);
    }

    // Confirm all the fields were changed
    for (const formField of ttPO.sampleBoyneHunt) {
      const sampleLocator = formField.locator;
      await expect(sampleLocator).toHaveValue(formField.modification);
    }

    await ttPO.pressSave();

    const newTuneTitle = ttPO.findUpdateByLabel(
      "Title",
      ttPO.sampleBoyneHunt,
    )?.modification;

    await ttPO.navigateToTune(newTuneTitle || "");

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

    console.log("===> test-edit-1.spec.ts:182 ~ ");
  });
});
