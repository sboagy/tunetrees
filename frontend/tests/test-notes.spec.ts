import { setTestDefaults } from "../test-scripts/set-test-defaults";
import { restartBackend } from "@/test-scripts/global-setup";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { getStorageState } from "@/test-scripts/storage-state";
import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { expect, test } from "@playwright/test";

test.use({
  storageState: getStorageState("STORAGE_STATE_TEST1"),
  trace: "retain-on-failure",
  // actionTimeout: 10_000,
});

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  // await page.waitForTimeout(1);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(1_000);
});

test("test-notes-1", async ({ page }) => {
  const ttPO = new TuneTreesPageObject(page);

  await ttPO.navigateToRepertoireTab();

  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("Peacock's Feather");
  await page
    .getByRole("row", { name: "4377 Peacock's Feather Hpipe" })
    .getByRole("cell")
    .nth(1)
    .click();

  await page.waitForSelector("#current-tune-title", {
    state: "visible",
    timeout: 60000,
  });
  const currentTuneTitleLocator = page.getByTestId("current-tune-title");
  await expect(currentTuneTitleLocator).toHaveText("Peacock's Feather");

  const notesContentLocator = page.getByTestId("tt-notes-content");
  await expect(notesContentLocator).toBeVisible();

  const notesCount = await notesContentLocator.evaluate(
    (node) => node.children.length,
  );
  console.log(`Number of notes: ${notesCount}`);

  const newNoteLocator = page.getByLabel("New Note");
  await expect(newNoteLocator).toBeVisible();
  await expect(newNoteLocator).toBeEnabled();
  await newNoteLocator.click({ trial: true });
  await newNoteLocator.click();
  await ttPO.page.waitForLoadState("domcontentloaded");
  await ttPO.page.waitForTimeout(1000);

  const noteEditBoxLocator = page.locator(".jodit-wysiwyg");
  await expect(noteEditBoxLocator).toBeVisible();
  await expect(noteEditBoxLocator).toBeEditable();
  await noteEditBoxLocator.click();
  await ttPO.page.waitForTimeout(1000);

  const newNoteText = "abcdef";

  await noteEditBoxLocator.pressSequentially(newNoteText, { delay: 100 });

  const saveEditButtonLocator = page.getByTestId("tt-save-note");
  await expect(saveEditButtonLocator).toBeVisible();
  await expect(saveEditButtonLocator).toBeEnabled();

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url() === "https://localhost:3000/home" &&
      response.status() === 200 &&
      response.request().method() === "POST",
  );
  await saveEditButtonLocator.click();
  await responsePromise;

  // Wait for the DOM to calm down by ensuring no network activity and a short pause
  // await page.waitForLoadState("networkidle");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(500);

  console.log("===> test-notes.ts:38 ~ exit test-notes-1");

  const notesContentLocator2 = page.getByTestId("tt-notes-content");
  await expect(notesContentLocator2).toBeVisible();

  const notesCount2 = await notesContentLocator2.evaluate(
    (node) => node.children.length,
  );
  console.log(`Number of notes after add: ${notesCount2}`);

  // Assert the count using evaluate
  await expect(
    notesContentLocator2.evaluate((node) => node.children.length),
  ).resolves.toBe(notesCount + 1);

  // "tt-note-text"
  const firstNoteLocator = notesContentLocator2.locator(
    ":scope > :first-child",
  );
  await expect(firstNoteLocator).toBeVisible();

  // Instead of increasing the timeout, ensure the save action is fully awaited before checking for the new note.
  // The previous `await responsePromise;` should guarantee the backend save is done.
  // To further reduce flakiness, you can add a short waitForSelector for the new note text,
  // but usually Playwright's default timeout (5s) is enough.
  const editorFieldLocator1 = firstNoteLocator.getByText(newNoteText);
  await expect(editorFieldLocator1).toBeVisible();

  const secondNoteLocator = notesContentLocator2.locator(
    ":scope > :nth-child(2)",
  );
  await expect(secondNoteLocator).toBeVisible();

  const editorFieldLocator2 = secondNoteLocator.getByText(
    "2017-06-01: worked on the",
  );
  await expect(editorFieldLocator2).toBeVisible();

  const thirdNoteLocator = notesContentLocator2.locator(
    ":scope > :nth-child(3)",
  );
  await expect(thirdNoteLocator).toBeVisible();

  const editorFieldLocator3 = thirdNoteLocator.getByText(
    "https://www.youtube.com/watch",
  );
  await expect(editorFieldLocator3).toBeVisible();

  // await page.waitForTimeout(1000 * 100);
});
