import { contextCleanup } from "@/test-scripts/context-cleanup";
import { testResultsDirPath } from "@/test-scripts/paths-for-tests";
import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import path from "node:path";
import { checkHealth } from "../test-scripts/check-servers";
import { runLogin } from "../test-scripts/run-login2";

test("test-login-1", async ({ browser }) => {
  console.log("===> test-login-1:21 ~ ", "Basic login test");
  await checkHealth();

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
    // storageState: storageState,
    recordVideo: {
      dir: videoDir, // Directory to save the videos
      size: { width: 1280, height: 720 }, // Optional: specify video size
    },
  });

  console.log("===> test-login-1:72 ~ creating new page for health check");
  const pageHello = await context.newPage();
  const response = await pageHello.request.get(
    "https://localhost:3000/api/health",
  );
  const responseBody = await response.json();
  console.log(`===> test-login-1:78 ~ health check ${responseBody.status}`);
  expect(responseBody.status).toBe("ok");

  console.log("===> test-login-1:88 ~ creating new page for tunetrees");
  // Set the storage state
  const page = await context.newPage();

  await page.goto("https://localhost:3000", { timeout: 40000 });

  await runLogin(
    page,
    process.env.TEST1_LOGIN_USER_EMAIL,
    process.env.TEST1_LOGIN_USER_PASSWORD,
  );

  await page.waitForTimeout(1000 * 3);

  await page.screenshot({
    path: path.join(screenShotDir, "page_just_loaded.png"),
  });

  console.log("===> test-login-1:106 ~ waiting for selector");
  await page.waitForSelector('role=tab[name="Repertoire"]', {
    state: "visible",
  });
  await page.screenshot({
    path: path.join(screenShotDir, "page_just_after_repertoire_select.png"),
  });

  await contextCleanup(context, page);

  console.log("===> test-login-1:100 ~ ", "test-1 completed");
});
