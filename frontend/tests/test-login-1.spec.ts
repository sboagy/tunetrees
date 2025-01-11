import { contextCleanup } from "@/test-scripts/context-cleanup";
import { restartBackend } from "@/test-scripts/global-setup";
import {
  initialPageLoadTimeout,
  screenShotDir,
} from "@/test-scripts/paths-for-tests";
import { test } from "@playwright/test";
import path from "node:path";
import { checkHealth } from "../test-scripts/check-servers";
import { runLogin } from "../test-scripts/run-login2";

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
});

test("test-login-1", async ({ browser }) => {
  console.log("===> test-login-1:21 ~ ", "Basic login test");
  await checkHealth();

  const context = await browser.newContext();

  console.log("===> test-login-1:88 ~ creating new page for tunetrees");
  // Set the storage state
  const page = await context.newPage();

  await page.goto("https://localhost:3000", {
    timeout: initialPageLoadTimeout,
    waitUntil: "networkidle",
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
