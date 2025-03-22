import path from "node:path";

import { restartBackend } from "@/test-scripts/global-setup";

import { applyNetworkThrottle } from "@/test-scripts/network-utils";

import {
  initialPageLoadTimeout,
  screenShotDir,
} from "@/test-scripts/paths-for-tests";

import { test } from "@playwright/test";

import { checkHealth } from "../test-scripts/check-servers";

import { TuneEditorPageObject } from "@/test-scripts/tune-editor.po";

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
});

test("test-login-1", async ({ page }) => {
  console.log("===> test-login-1:21 ~ ", "Basic login test");
  const ttPO = new TuneEditorPageObject(page);

  await checkHealth();

  await page.goto("https://localhost:3000", {
    timeout: initialPageLoadTimeout,
    waitUntil: "networkidle",
  });

  await ttPO.runLogin(
    process.env.TEST1_LOGIN_USER_EMAIL,
    process.env.TEST1_LOGIN_USER_PASSWORD,
  );

  // await page.waitForTimeout(1000 * 3);

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

  console.log("===> test-login-1:100 ~ ", "test-1 completed");
});
