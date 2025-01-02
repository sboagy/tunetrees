import { contextCleanup } from "@/test-scripts/context-cleanup";
import {
  initialPageLoadTimeout,
  screenShotDir,
  videoDir,
} from "@/test-scripts/paths-for-tests";
import { test } from "@playwright/test";
import path from "node:path";
import { checkHealth } from "../test-scripts/check-servers";
import { runLogin } from "../test-scripts/run-login2";

test("test-login-1", async ({ browser }) => {
  console.log("===> test-login-1:21 ~ ", "Basic login test");
  await checkHealth();

  const context = await browser.newContext({
    // storageState: storageState,
    recordVideo: {
      dir: videoDir, // Directory to save the videos
      size: { width: 1280, height: 720 }, // Optional: specify video size
    },
  });

  console.log("===> test-login-1:88 ~ creating new page for tunetrees");
  // Set the storage state
  const page = await context.newPage();

  await page.goto("https://localhost:3000", {
    timeout: initialPageLoadTimeout,
  });

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
