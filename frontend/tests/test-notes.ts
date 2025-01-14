import { restartBackend } from "@/test-scripts/global-setup";
import { navigateToRepertoireTab } from "@/test-scripts/navigate-tabs";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
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

test("test-notes-1", async ({ page }) => {
  // Log all uncaught errors to the terminal
  page.on("pageerror", (exception) => {
    console.error(`Uncaught exception: "${exception}"`);
    throw exception;
  });

  await navigateToRepertoireTab(page);
  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("Peacock's Feather");
  await page.getByRole("row", { name: "4377 Peacock's Feather Hpipe" }).click();

  await page.waitForSelector("#current-tune-title", {
    state: "visible",
    timeout: 60000,
  });
  const currentTuneTitleLocator = page.getByTestId("current-tune-title");
  await expect(currentTuneTitleLocator).toHaveText("Peacock's Feather");

  const newNoteLocator = page.getByLabel("New Note");
  await expect(newNoteLocator).toBeVisible();
  await expect(newNoteLocator).toBeEnabled();
  await newNoteLocator.click({ trial: true });
  await newNoteLocator.click();

  const noteEditBoxLocator = page.locator(".jodit-wysiwyg");
  await expect(noteEditBoxLocator).toBeVisible();
  await expect(noteEditBoxLocator).toBeEditable();
  await noteEditBoxLocator.click();

  await noteEditBoxLocator.pressSequentially("abcdef", { delay: 100 });

  const saveEditButtonLocator = page.getByTestId("tt-save-note");
  await expect(saveEditButtonLocator).toBeVisible();
  await expect(saveEditButtonLocator).toBeEnabled();
  await saveEditButtonLocator.click();

  console.log("===> test-notes.ts:38 ~ exit test-notes-1");

  // await page.waitForTimeout(1000 * 100);
});
