import { testResultsDirPath } from "@/test-scripts/paths-for-tests";
import { getStorageState } from "@/test-scripts/storage-state";
import { type Page, expect, test } from "@playwright/test";
import * as fs from "node:fs";
import path from "node:path";
import { checkHealth } from "../test-scripts/check-servers";
import { contextCleanup } from "../test-scripts/context-cleanup";

// test.beforeEach(async () => {
//   await setupDatabase();
// });

// test.use({ storageState: "storageState.json" });

test("test-edit-1", async ({ browser }) => {
  await checkHealth();

  const storageState = await getStorageState("STORAGE_STATE_TEST1");

  const playwrightTestResulsDir = path.join(testResultsDirPath, "playwright");

  const videoDir = path.join(playwrightTestResulsDir, "videos");
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  const screenShotDir = path.join(playwrightTestResulsDir, "screenshots");
  if (!fs.existsSync(screenShotDir)) {
    fs.mkdirSync(screenShotDir, { recursive: true });
  }

  const context = await browser.newContext({
    storageState: storageState,
    // recordVideo: {
    //   dir: videoDir, // Directory to save the videos
    //   size: { width: 1280, height: 720 }, // Optional: specify video size
    // },
  });

  console.log("===> test-edit-1.ts:72 ~ creating new page for health check");
  const pageHello = await context.newPage();
  const response = await pageHello.request.get(
    "https://localhost:3000/api/health",
  );
  const responseBody = await response.json();
  console.log(`===> test-edit-1.ts:78 ~ health check ${responseBody.status}`);
  expect(responseBody.status).toBe("ok");

  console.log("===> test-edit-1.ts:88 ~ creating new page for tunetrees");
  // Set the storage state
  const page: Page = await context.newPage();

  // await page.waitForTimeout(5000);

  // await page.waitForTimeout(2000);

  // Increase the timeout for page.goto
  await page.goto("https://localhost:3000", { timeout: 60000 });

  await page.waitForTimeout(1000 * 5);

  await page.screenshot({
    path: path.join(screenShotDir, "page_just_loaded.png"),
  });

  console.log("===> test-edit-1.ts:106 ~ waiting for selector");
  await page.waitForSelector('role=tab[name="Repertoire"]', {
    state: "visible",
    timeout: 900000, // 90 seconds timeout
  });
  await page.screenshot({
    path: path.join(screenShotDir, "page_just_after_repertoire_select.png"),
  });
  await page.waitForTimeout(1000);
  await page.getByRole("tab", { name: "Repertoire" }).click();
  await page.getByPlaceholder("Filter").click();
  await page.getByPlaceholder("Filter").fill("lakes of");
  await page.getByRole("row", { name: "1081 Lakes of Sligo Polka" }).click();

  // ========================
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");

  // CANCEL
  await page.getByRole("button", { name: "Cancel" }).click();
  // I think this is needed mostly for the useEffect to take effect?
  await page.waitForTimeout(1000);

  const tuneTitle1 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-edit-1.ts:135 ~ ", tuneTitle1);
  // Bogus expect, this should test for "Lakes of Sligo x"
  expect(await page.locator("#current-tune-title").textContent()).toEqual(
    "Lakes of Sligo",
  );
  // ========================
  // await page.waitForTimeout(1000);
  // ========================
  // Should this be two tests?
  await page
    .locator("div")
    .filter({ hasText: /^Lakes of Sligo$/ })
    .getByLabel("Edit")
    .click();
  await page.getByLabel("Title:").click();
  await page.getByLabel("Title:").fill("Lakes of Sligo x");

  // Save
  await page.getByRole("button", { name: "Save" }).click();
  // I think this is needed mostly for the useEffect to take effect?
  await page.waitForTimeout(1000);

  const tuneTitle2 = await page.locator("#current-tune-title").textContent();
  console.log("===> test-edit-1.ts:158 ~ ", tuneTitle2);
  // Bogus expect, this should test for "Lakes of Sligo x"
  expect(await page.locator("#current-tune-title").textContent()).toEqual(
    "Lakes of Sligo x",
  );

  await contextCleanup(context, page);
});
