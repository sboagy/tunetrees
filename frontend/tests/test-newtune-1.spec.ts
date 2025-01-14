import { restartBackend } from "@/test-scripts/global-setup";
import { navigateToRepertoireTab } from "@/test-scripts/navigate-tabs";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  // trace: "on",
  actionTimeout: 10_000,
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
  page.on("pageerror", (exception) => {
    console.error(`Uncaught exception: "${exception}"`);
    throw exception;
  });
  await navigateToRepertoireTab(page);

  // await page.waitForTimeout(1000 * 200);

  await page.getByRole("button", { name: "Tabs" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Catalog" }).click();
  const catalogTabLocator = page.getByRole("tab", { name: "Catalog" });
  await expect(catalogTabLocator).toBeVisible();
  await catalogTabLocator.click();
  const addToRepertoireButtonLocator = page
    .locator("#tt-all-tunes-header div")
    .filter({ hasText: "Add To Repertoire" });
  await expect(addToRepertoireButtonLocator).toBeVisible();
  const addTuneLoacator = page
    .getByTestId("tt-catalog-tab")
    .getByLabel("Add new reference");
  await addTuneLoacator.click();

  // await page.waitForTimeout(1000 * 20);

  await page.getByTestId("tt-tune-editor-title-input").click();
  await page.getByTestId("tt-tune-editor-title-input").fill("abcde");
  await page.getByLabel("Type:").click();
  await page.getByLabel("Type:").fill("hornpipe");
  await page.getByLabel("Type:").press("Tab");
  await page.getByLabel("Structure:").fill("AABB");
  await page.getByLabel("Structure:").press("Tab");
  await page.getByLabel("Mode:").fill("D Major");
  await page.getByLabel("Mode:").press("Tab");
  await page.getByLabel("Incipit:").fill("DLJLKJDF");
  await page.getByLabel("Genre:").click();
  await page.getByLabel("Genre:").fill("ITRAD");
  await page.getByTestId("tt-tune-editor-submit-button").click();
});
