import { checkHealth } from "@/test-scripts/check-servers";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { initialPageLoadTimeout } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { type Page, expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
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
  page: Page,
  formFieldTestId: string,
  buttonName: string,
  originalText: string,
  modifiedText: string,
  expectedText: string | null = null,
) {
  const tuneEditLocatorButton = page.getByTestId("tt-sidebar-edit-tune");
  await expect(tuneEditLocatorButton).toBeAttached();
  await expect(tuneEditLocatorButton).toBeVisible();
  await expect(tuneEditLocatorButton).toBeEnabled();

  await tuneEditLocatorButton.click();

  // const titleFormFieldLocator = page.getByTestId("tt-tune-editor-title");
  // const titleFormFieldLocator = page.getByLabel("Title:");
  const formFieldLocator = page
    .getByTestId("tt-tune-editor-form")
    .getByTestId(formFieldTestId);
  await expect(formFieldLocator).toBeAttached({ timeout: 5000 });
  await expect(formFieldLocator).toBeVisible({ timeout: 5000 });

  const formFieldTextBox = formFieldLocator.getByRole("textbox");
  await expect(formFieldTextBox).toBeVisible({ timeout: 5000 });
  await expect(formFieldTextBox).toBeEnabled({ timeout: 5000 });

  const formFieldText4 = await formFieldTextBox.inputValue();
  console.log("===> test-edit-1.spec.ts:57 ~ formFieldText3", formFieldText4);

  await expect(formFieldTextBox).toHaveValue(originalText, {
    timeout: 5000,
  });
  await expect(formFieldTextBox).toBeEditable({ timeout: 5000 });
  await formFieldTextBox.click();
  await formFieldTextBox.fill(modifiedText);

  // Save
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === "https://localhost:3000/home" &&
      response.status() === 200 &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: buttonName }).click();
  await responsePromise;

  // Wait for the response to the POST request, which will hopefully
  // be the first response after the Save button is clicked?
  const tuneTitle2 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
  const expectedText2 = expectedText ?? modifiedText;
  const currentTuneTitleLocator = page.locator("#current-tune-title");
  await expect(currentTuneTitleLocator).toHaveText(expectedText2, {
    timeout: 5000,
  });
}

test("test-edit-1", async ({ page }) => {
  await checkHealth();

  console.log("===> test-edit-1.ts:88 ~ creating new page for tunetrees");

  await page.goto("https://localhost:3000", {
    timeout: initialPageLoadTimeout,
    waitUntil: "networkidle",
  });

  await page.waitForSelector("body");
  const ttMainTabGroup = page.getByTestId("tt-main-tabs");
  await ttMainTabGroup.waitFor({ state: "visible" });

  const repertoireTabSelector = 'role=tab[name="Repertoire"]';
  console.log(
    "===> test-edit-1.ts:106 ~ waiting for selector, tabSelector: ",
    repertoireTabSelector,
  );
  const repertoireTab = await page.waitForSelector(repertoireTabSelector, {
    state: "visible",
  });
  await repertoireTab.click();

  await page.waitForSelector("#current-tune-title", { state: "visible" });
  await page.getByRole("tab", { name: "Repertoire" }).click();
  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("lakes of");
  await page.getByRole("row", { name: "1081 Lakes of Sligo Polka" }).click();

  // ========== First do a title edit, then Cancel ==============
  await doEditAndButtonClick(
    page,
    "tt-tune-editor-title",
    "Cancel",
    "Lakes of Sligo",
    "Lakes of Sligo x",
    "Lakes of Sligo",
  );

  // ========== Now do a title edit, then Save ==============
  await doEditAndButtonClick(
    page,
    "tt-tune-editor-title",
    "Save",
    "Lakes of Sligo",
    "Lakes of Sligo x",
  );
});
