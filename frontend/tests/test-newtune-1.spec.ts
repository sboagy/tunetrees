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

  // await page.waitForTimeout(60_000 * 60);

  const addToRepertoireButtonLocator = page
    .locator("#tt-all-tunes-header div")
    .filter({ hasText: "Add To Repertoire" });

  await expect(addToRepertoireButtonLocator).toBeVisible();
  const addTuneLoacator = page
    .getByTestId("tt-catalog-tab")
    .getByLabel("Add new reference");
  await addTuneLoacator.click();

  await page.getByTestId("tt-tune-editor-title-input").click();
  // Note this is testing the accented characters in the title bug as well.
  // See https://github.com/axios/axios/issues/6761
  await page
    .getByTestId("tt-tune-editor-title-input")
    .fill("Sí Bheag, Sí Mhór");
  await page.getByLabel("Type:").click();
  await page.getByLabel("Type:").fill("waltz");
  await page.getByLabel("Type:").press("Tab");
  await page.getByLabel("Structure:").fill("AABB");
  await page.getByLabel("Structure:").press("Tab");
  await page.getByLabel("Mode:").fill("D Major");
  await page.getByLabel("Mode:").press("Tab");
  await page.getByLabel("Incipit:").fill("de|:f3e d2|d2 de d2|B4 A2|F4 A2|");
  await page.getByLabel("Genre:").click();
  await page.getByLabel("Genre:").fill("ITRAD");

  await page.getByTestId("tt-tune-editor-submit-button").click();

  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("Sí Bheag");
  await page.getByRole("cell", { name: "Sí Bheag, Sí Mhór" }).click();

  const currentTuneTitleLocator = page.locator("#current-tune-title");
  const tuneTitle2 = await currentTuneTitleLocator.textContent();
  console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
  const expectedText2 = "Sí Bheag, Sí Mhór";
  await expect(currentTuneTitleLocator).toHaveText(expectedText2);

  // await page.waitForTimeout(60_000 * 60);
});
