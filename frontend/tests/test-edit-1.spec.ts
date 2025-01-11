import { checkHealth } from "@/test-scripts/check-servers";
import { restartBackend } from "@/test-scripts/global-setup";
import { initialPageLoadTimeout } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
});

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
});

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
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");

  // CANCEL
  await page.getByRole("button", { name: "Cancel" }).click();

  // The test may fail without this wait, not sure why.
  await page.waitForTimeout(500);

  const tuneTitle1 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-edit-1.ts:135 ~ ", tuneTitle1);

  // The Cancel button should have reverted the title back to "Lakes of Sligo"
  const currentTuneTitleLocator = page.locator("#current-tune-title");
  expect(await currentTuneTitleLocator.textContent()).toEqual("Lakes of Sligo");

  // ========== Now do a title edit, then Save ==============
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");

  // Save
  await page.getByRole("button", { name: "Save" }).click();

  // The test may fail without this wait, not sure why.
  await page.waitForTimeout(1000);

  const tuneTitle2 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
  expect(await currentTuneTitleLocator.textContent()).toEqual(
    "Lakes of Sligo x",
  );
});
