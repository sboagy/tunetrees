import { test } from "@playwright/test";
import { restartBackend } from "@/test-scripts/global-setup";

import { navigateToPageWithRetry } from "@/test-scripts/navigation-utils";
import { applyNetworkThrottle } from "@/test-scripts/network-utils";
import { runLoginWithCookieSave } from "@/test-scripts/run-login2";

import { TuneTreesPageObject } from "@/test-scripts/tunetrees.po";
import { checkHealth } from "../test-scripts/check-servers";
import { setTestDefaults } from "../test-scripts/set-test-defaults";
import {
  logBrowserContextEnd,
  logBrowserContextStart,
  logTestEnd,
  logTestStart,
} from "../test-scripts/test-logging";

test.beforeEach(async ({ page }, testInfo) => {
  logTestStart(testInfo);
  logBrowserContextStart();
  console.log(`===> ${testInfo.file}, ${testInfo.title} <===`);
  // doConsolelogs(page, testInfo);
  await setTestDefaults(page);
  await applyNetworkThrottle(page);
});

test.afterEach(async ({ page }, testInfo) => {
  // After each test is run in this set, restore the backend to its original state.
  await restartBackend();
  await page.waitForTimeout(100);
  logBrowserContextEnd();
  logTestEnd(testInfo);
});

test("test-login-1", async ({ page }) => {
  console.log("===> test-login-1:21 ~ ", "Basic login test");

  await checkHealth();

  const isCookieSave = process.env.SAVE_COOKIES === "true";

  // Use improved navigation with retry logic
  await navigateToPageWithRetry(page, "/");
  if (isCookieSave) {
    await page.waitForTimeout(500);

    await runLoginWithCookieSave(
      page,
      process.env.TEST1_LOGIN_USER_EMAIL,
      process.env.TEST1_LOGIN_USER_PASSWORD,
    );
  } else {
    const ttPO = new TuneTreesPageObject(page);
    await ttPO.runLogin(
      process.env.TEST1_LOGIN_USER_EMAIL,
      process.env.TEST1_LOGIN_USER_PASSWORD,
    );
  }

  // await page.waitForTimeout(1000 * 3);

  console.log("===> test-login-1:106 ~ waiting for selector");
  await page.waitForSelector('role=tab[name="Repertoire"]', {
    state: "visible",
  });

  console.log("===> test-login-1:100 ~ ", "test-1 completed");
});
