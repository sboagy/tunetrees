import { frontendDirPath } from "@/test-scripts/paths-for-tests";
import { type Page, expect, test } from "@playwright/test";
import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkBackend, checkFrontend } from "../test-scripts/check-servers";
import { contextCleanup } from "../test-scripts/context-cleanup";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

// test.beforeEach(async () => {
//   await setupDatabase();
// });

// test.use({ storageState: "storageState.json" });

test("test-edit-1", async ({ browser }) => {
  const backendOk = await checkBackend();
  const frontendOk = await checkFrontend();
  console.log(
    `===> test-edit-1.ts:44 ~ backendOk: ${backendOk}, frontendOk: ${frontendOk}`,
  );
  if (!frontendOk || !backendOk) {
    console.error(
      "Backend or frontend not up.  Exiting test.  Please start backend and frontend.",
    );
    return;
  }

  if (!process.env.STORAGE_STATE_TEST1) {
    console.error(
      "STORAGE_STATE_TEST1 environment variable not set. Exiting test-edit-1.",
    );
    return;
  }

  let storageStateContent = "";
  if (process.env.STORAGE_STATE_TEST1.startsWith("test-scripts/storageState")) {
    const storageStatePath = path.resolve(
      frontendDirPath,
      process.env.STORAGE_STATE_TEST1,
    );
    storageStateContent = await fs.promises.readFile(storageStatePath, "utf8");
  } else {
    // Assume it's coming from a secret and the value is already JSON
    storageStateContent = process.env.STORAGE_STATE_TEST1;
  }
  const storageState = JSON.parse(storageStateContent);

  // Warning, don't normally enable this, it will show the storage state in the console.
  // console.log("===> test-edit-1.ts:48 ~ Storage State:", storageState);

  const playwrightTestResulsDir = path.join(
    __dirname,
    "../test-results/playwright",
  );

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
